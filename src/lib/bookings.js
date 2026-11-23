import { today } from './format';

/** The business day bookings are measured against: the open day, else the clock date. */
export const bookingToday = (db) => (db.day?.status === 'OPEN' && db.day.businessDate) || today();

/**
 * What a booking really is right now.
 * A booking whose arrival date has passed without a check-in is a "No show", whatever the server still says.
 */
export function bookingState(b, todayStr) {
  if (b.status === 'Cancelled' || b.status === 'Checked in') return b.status;
  if (b.inD && b.inD < todayStr) return 'No show';
  return b.status || 'Arriving';
}
