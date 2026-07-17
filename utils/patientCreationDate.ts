import { strictDateString } from './validation';

export const toLocalDateInputValue = (date = new Date()): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Converts a staff-selected calendar date into a stable database timestamp.
 * Noon UTC avoids the selected date moving backward or forward in the common
 * time zones where this application is used.
 */
export const buildPatientCreatedAt = (value: unknown, today = toLocalDateInputValue()): string => {
  const creationDate = strictDateString(value, 'Patient creation date');
  const currentDate = strictDateString(today, 'Current date');

  if (creationDate > currentDate) {
    throw new Error('Patient creation date cannot be in the future.');
  }

  if (creationDate < '1900-01-01') {
    throw new Error('Patient creation date must be on or after 1900-01-01.');
  }

  return `${creationDate}T12:00:00.000Z`;
};