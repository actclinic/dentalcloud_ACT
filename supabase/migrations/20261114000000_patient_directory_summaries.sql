-- Bounded, read-only summaries for the visible Patient Directory page.
-- No patient data is changed by this migration.
BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE OR REPLACE FUNCTION public.patient_directory_summaries(
  p_location_id uuid,
  p_patient_ids uuid[]
)
RETURNS TABLE (
  patient_id uuid,
  last_visit date,
  next_appointment jsonb,
  treatments jsonb,
  doctor_names text[]
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  WITH requested AS (
    SELECT DISTINCT unnest(p_patient_ids) AS id
  ), allowed AS (
    SELECT patient.id, patient.location_id
    FROM public.patients AS patient
    JOIN requested ON requested.id = patient.id
    WHERE p_location_id IS NULL OR patient.location_id = p_location_id
  )
  SELECT
    allowed.id,
    (SELECT max(appointment.date) FROM public.appointments AS appointment
      WHERE appointment.patient_id = allowed.id
        AND (allowed.location_id IS NULL OR appointment.location_id = allowed.location_id)),
    (SELECT jsonb_build_object('id', appointment.id, 'date', appointment.date,
      'time', appointment.time, 'status', appointment.status)
      FROM public.appointments AS appointment
      WHERE appointment.patient_id = allowed.id
        AND (allowed.location_id IS NULL OR appointment.location_id = allowed.location_id)
        AND appointment.status = 'Scheduled'
        AND (appointment.date > current_date OR (appointment.date = current_date AND appointment.time >= localtime))
      ORDER BY appointment.date, appointment.time, appointment.id LIMIT 1),
    coalesce((SELECT jsonb_agg(to_jsonb(preview) ORDER BY preview.date DESC NULLS LAST, preview.id DESC)
      FROM (SELECT treatment.id, treatment.date, treatment.description, treatment.doctor_id, doctor.name AS doctor_name
        FROM public.treatments AS treatment LEFT JOIN public.doctors AS doctor ON doctor.id = treatment.doctor_id
        WHERE treatment.patient_id = allowed.id
          AND (allowed.location_id IS NULL OR treatment.location_id = allowed.location_id)
        ORDER BY treatment.date DESC NULLS LAST, treatment.id DESC LIMIT 4) AS preview), '[]'::jsonb),
    coalesce((SELECT array_agg(DISTINCT doctor.name ORDER BY doctor.name)
      FROM public.treatments AS treatment JOIN public.doctors AS doctor ON doctor.id = treatment.doctor_id
      WHERE treatment.patient_id = allowed.id
        AND (allowed.location_id IS NULL OR treatment.location_id = allowed.location_id)
        AND nullif(btrim(doctor.name), '') IS NOT NULL), ARRAY[]::text[])
  FROM allowed;
$$;

REVOKE ALL ON FUNCTION public.patient_directory_summaries(uuid, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.patient_directory_summaries(uuid, uuid[]) TO anon, authenticated;

CREATE INDEX IF NOT EXISTS appointments_patient_directory_summary_idx
  ON public.appointments (patient_id, location_id, date DESC, time DESC);
CREATE INDEX IF NOT EXISTS treatments_patient_directory_summary_idx
  ON public.treatments (patient_id, location_id, date DESC, id DESC);

NOTIFY pgrst, 'reload schema';
COMMIT;
