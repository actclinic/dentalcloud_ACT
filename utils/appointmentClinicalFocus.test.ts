import { describe, expect, it } from 'vitest';
import {
  buildAppointmentClinicalFocusNotes,
  formatAppointmentNotesForDisplay,
  parseAppointmentClinicalFocus
} from './appointmentClinicalFocus';

describe('appointment clinical tooth notation', () => {
  it('writes baby teeth using staff-facing labels', () => {
    expect(buildAppointmentClinicalFocusNotes({
      clinicalFocus: 'Filling',
      targetTeeth: [11, 51, 65, 85],
      notes: 'Review'
    })).toContain('Target Teeth: 11, 1A, 2E, 4E');
  });

  it('reads both new labels and legacy numeric appointment notes', () => {
    expect(parseAppointmentClinicalFocus('Target Teeth: 1A, 2E').targetTeeth).toEqual([51, 65]);
    expect(parseAppointmentClinicalFocus('Target Teeth: 51, 65').targetTeeth).toEqual([51, 65]);
  });

  it('converts legacy tooth numbers in exported appointment notes', () => {
    expect(formatAppointmentNotesForDisplay('Clinical Focus: Filling\nTarget Teeth: 51, 65'))
      .toContain('Target Teeth: 1A, 2E');
  });
});
