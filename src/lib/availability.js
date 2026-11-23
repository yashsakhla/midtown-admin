import { addDays } from './format';
import { bookingState, bookingToday } from './bookings';

const HOLDING = ['Arriving', 'Confirmed'];

/** A booking is tied to a room by id, or by room number when the server only sends that. */
export const bookingRoomMatch = (b, room) =>
  (!!b.roomId && b.roomId === room.id) || (!!b.roomNo && b.roomNo === room.no);

/** Departure date of a booking (one night when none is stored). */
export const bookingEnd = (b) => (b.outD && b.outD > b.inD ? b.outD : addDays(b.inD, 1));

/**
 * Rooms that can take a booking for [from, to):
 *  - the right room type and enough beds for the guests,
 *  - not out of order, and not under maintenance past the arrival date,
 *  - not occupied, unless the current guest checks out on or before the arrival date,
 *  - not already held by another live booking that overlaps those dates.
 * `ignoreId` is the booking being edited, so its own room stays on the list.
 */
export function availableRooms({ db, type, guests = 1, from, to, ignoreId }) {
  if (!from || !to) return [];
  const todayStr = bookingToday(db);
  return db.rooms.filter((r) => {
    if (type && r.type !== type) return false;
    if ((r.sleeps || 4) < guests) return false;
    if (r.status === 'ooo') return false;
    if (r.status === 'maintenance' && !(r.maintenance?.until && r.maintenance.until <= from)) return false;
    if (r.stayId && !(r.checkOut && r.checkOut <= from)) return false;
    return !db.bookings.some((b) =>
      b.id !== ignoreId && bookingRoomMatch(b, r) && HOLDING.includes(bookingState(b, todayStr)) &&
      b.inD < to && bookingEnd(b) > from);
  });
}
