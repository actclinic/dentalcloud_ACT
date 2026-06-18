import { formatTeethArray, parseTeethInput } from './toothNumbering';

export interface AppointmentClinicalFocus {
  clinicalFocus: string;
  targetTeeth: number[];
  notes: string;
}

const FOCUS_PREFIX = 'Clinical Focus:';
const TEETH_PREFIX = 'Target Teeth:';
const NOTES_PREFIX = 'Notes:';

export const parseAppointmentClinicalFocus = (rawNotes?: string | null): AppointmentClinicalFocus => {
  const notesText = (rawNotes || '').trim();
  if (!notesText) {
    return { clinicalFocus: '', targetTeeth: [], notes: '' };
  }

  const lines = notesText.split(/\r?\n/).map((line) => line.trim());
  const focusLine = lines.find((line) => line.startsWith(FOCUS_PREFIX));
  const teethLine = lines.find((line) => line.startsWith(TEETH_PREFIX));
  const notesIndex = lines.findIndex((line) => line.startsWith(NOTES_PREFIX));

  const clinicalFocus = focusLine ? focusLine.slice(FOCUS_PREFIX.length).trim() : '';
  const targetTeeth = teethLine
    ? parseTeethInput(teethLine.slice(TEETH_PREFIX.length).trim()).teeth
    : [];

  if (focusLine || teethLine || notesIndex >= 0) {
    const parsedNotes = notesIndex >= 0
      ? [lines[notesIndex].slice(NOTES_PREFIX.length).trim(), ...lines.slice(notesIndex + 1)]
          .join('\n')
          .trim()
      : '';
    return {
      clinicalFocus,
      targetTeeth,
      notes: parsedNotes
    };
  }

  // Legacy plain-text notes (before structured format).
  return {
    clinicalFocus: '',
    targetTeeth: [],
    notes: notesText
  };
};

export const buildAppointmentClinicalFocusNotes = (data: AppointmentClinicalFocus): string => {
  const cleanedFocus = data.clinicalFocus.trim();
  const cleanedTeeth = Array.from(new Set(data.targetTeeth)).sort((a, b) => a - b);
  const cleanedNotes = data.notes.trim();

  const lines: string[] = [];
  if (cleanedFocus) lines.push(`${FOCUS_PREFIX} ${cleanedFocus}`);
  if (cleanedTeeth.length > 0) lines.push(`${TEETH_PREFIX} ${formatTeethArray(cleanedTeeth)}`);
  if (cleanedNotes) lines.push(`${NOTES_PREFIX} ${cleanedNotes}`);

  return lines.join('\n').trim();
};

export const formatAppointmentNotesForDisplay = (rawNotes?: string | null): string => {
  return (rawNotes || '')
    .split(/\r?\n/)
    .map((line) => {
      const trimmedLine = line.trim();
      if (!trimmedLine.startsWith(TEETH_PREFIX)) return line;

      const parsedTeeth = parseTeethInput(trimmedLine.slice(TEETH_PREFIX.length).trim()).teeth;
      return parsedTeeth.length > 0
        ? `${TEETH_PREFIX} ${formatTeethArray(parsedTeeth)}`
        : TEETH_PREFIX;
    })
    .join('\n');
};
