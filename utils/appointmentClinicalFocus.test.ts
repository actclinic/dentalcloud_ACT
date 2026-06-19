import { describe, expect, it } from 'vitest';
import {
  buildAppointmentClinicalFocusNotes,
  formatAppointmentNotesForDisplay,
  parseAppointmentClinicalFocus
} from './appointmentClinicalFocus';

describe('appointment clinical notes', () => {
  it('writes only clinical focus and extra notes', () => {
    expect(buildAppointmentClinicalFocusNotes({
      clinicalFocus: 'Filling',
      notes: 'Review'
    })).toBe('Clinical Focus: Filling\nNotes: Review');
  });

  it('ignores legacy target teeth while preserving appointment details', () => {
    expect(parseAppointmentClinicalFocus(
      'Clinical Focus: Filling\nTarget Teeth: 1A, 2E\nNotes: Review'
    )).toEqual({
      clinicalFocus: 'Filling',
      notes: 'Review'
    });
  });

  it('removes legacy target teeth from exported appointment notes', () => {
    expect(formatAppointmentNotesForDisplay(
      'Clinical Focus: Filling\nTarget Teeth: 51, 65\nNotes: Review'
    )).toBe('Clinical Focus: Filling\nNotes: Review');
  });

  it('does not leak a misplaced legacy target teeth line into extra notes', () => {
    expect(parseAppointmentClinicalFocus(
      'Clinical Focus: Filling\nNotes: Review\nTarget Teeth: 51, 65'
    )).toEqual({
      clinicalFocus: 'Filling',
      notes: 'Review'
    });
  });
});
