export type AppointmentDateShortcut =
  | { unit: 'weeks'; amount: number }
  | { unit: 'months'; amount: number };

const toLocalISODate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const calculateAppointmentShortcutDate = (
  shortcut: AppointmentDateShortcut,
  baseDate = new Date()
): string => {
  const date = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate());

  if (shortcut.unit === 'weeks') {
    date.setDate(date.getDate() + shortcut.amount * 7);
    return toLocalISODate(date);
  }

  const originalDay = date.getDate();
  date.setDate(1);
  date.setMonth(date.getMonth() + shortcut.amount);
  const lastDayOfTargetMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  date.setDate(Math.min(originalDay, lastDayOfTargetMonth));
  return toLocalISODate(date);
};