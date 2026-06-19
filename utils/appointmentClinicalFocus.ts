export interface AppointmentClinicalFocus {
  clinicalFocus: string;
  notes: string;
}

const FOCUS_PREFIX = 'Clinical Focus:';
const TEETH_PREFIX = 'Target Teeth:';
const NOTES_PREFIX = 'Notes:';

export const parseAppointmentClinicalFocus = (rawNotes?: string | null): AppointmentClinicalFocus => {
  const notesText = (rawNotes || '').trim();
  if (!notesText) {
    return { clinicalFocus: '', notes: '' };
  }

  const lines = notesText.split(/\r?\n/).map((line) => line.trim());
  const focusLine = lines.find((line) => line.startsWith(FOCUS_PREFIX));
  const teethLine = lines.find((line) => line.startsWith(TEETH_PREFIX));
  const notesIndex = lines.findIndex((line) => line.startsWith(NOTES_PREFIX));

  const clinicalFocus = focusLine ? focusLine.slice(FOCUS_PREFIX.length).trim() : '';

  if (focusLine || teethLine || notesIndex >= 0) {
    const parsedNotes = notesIndex >= 0
      ? [lines[notesIndex].slice(NOTES_PREFIX.length).trim(), ...lines.slice(notesIndex + 1)]
          .filter((line) => !line.startsWith(TEETH_PREFIX))
          .join('\n')
          .trim()
      : '';
    return {
      clinicalFocus,
      notes: parsedNotes
    };
  }

  // Legacy plain-text notes (before structured format).
  return {
    clinicalFocus: '',
    notes: notesText
  };
};

export const buildAppointmentClinicalFocusNotes = (data: AppointmentClinicalFocus): string => {
  const cleanedFocus = data.clinicalFocus.trim();
  const cleanedNotes = data.notes.trim();

  const lines: string[] = [];
  if (cleanedFocus) lines.push(`${FOCUS_PREFIX} ${cleanedFocus}`);
  if (cleanedNotes) lines.push(`${NOTES_PREFIX} ${cleanedNotes}`);

  return lines.join('\n').trim();
};

export const formatAppointmentNotesForDisplay = (rawNotes?: string | null): string => {
  return (rawNotes || '')
    .split(/\r?\n/)
    .filter((line) => !line.trim().startsWith(TEETH_PREFIX))
    .join('\n')
    .trim();
};
