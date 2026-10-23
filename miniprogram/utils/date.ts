export type DateInput = Date | number;
export type DateFormat = 'YYYY-MM-DD HH:mm:ss' | 'YYYY-MM-DD' | 'HH:mm:ss';

/** Formats in the device's local timezone; numeric inputs are Unix milliseconds. */
export function formatDate(input: DateInput, format: DateFormat = 'YYYY-MM-DD HH:mm:ss'): string {
  if (!(input instanceof Date) && typeof input !== 'number') {
    throw new TypeError('Date input must be a Date or a millisecond timestamp');
  }
  const date = input instanceof Date ? input : new Date(input);
  if (!Number.isFinite(date.getTime())) throw new RangeError('Invalid date');
  const year = date.getFullYear();
  if (year < 0 || year > 9999) throw new RangeError('Date year must be between 0000 and 9999');

  const pad = (value: number): string => String(value).padStart(2, '0');
  const datePart = (): string =>
    `${String(year).padStart(4, '0')}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const timePart = (): string =>
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;

  switch (format) {
    case 'YYYY-MM-DD':
      return datePart();
    case 'HH:mm:ss':
      return timePart();
    case 'YYYY-MM-DD HH:mm:ss':
      return `${datePart()} ${timePart()}`;
    default:
      throw new RangeError('Unsupported date format');
  }
}
