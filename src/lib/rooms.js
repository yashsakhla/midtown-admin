/** Room categories, types and guest-based pricing rules. */

/** Charged per person beyond the two covered by a double room. */
export const EXTRA_GUEST_CHARGE = 300;

export const ROOM_CATEGORIES = {
  'Non AC': ['Non AC Standard', 'Non AC New Standard'],
  AC: ['AC Standard', 'AC Deluxe', 'AC Executive']
};

export const ROOM_TYPES = Object.values(ROOM_CATEGORIES).flat();

export const categoryOf = (type) =>
  Object.keys(ROOM_CATEGORIES).find((c) => ROOM_CATEGORIES[c].includes(type))
  ?? (/^non\s*-?\s*ac/i.test(type || '') ? 'Non AC' : 'AC');

export const GUEST_OPTIONS = [
  { value: '1', label: 'Single (1 guest)' },
  { value: '2', label: 'Double (2 guests)' },
  { value: '3', label: '3 guests (double + 1 extra)' },
  { value: '4', label: '4 guests (double + 2 extra)' }
];

/** People beyond a double room, each charged EXTRA_GUEST_CHARGE per night. */
export const extraGuests = (guests) => Math.max(0, (Number(guests) || 1) - 2);

/** Per-person charge beyond two guests: the room's own price, or the hotel default when it has none. */
export const extraChargeOf = (room) =>
  room?.additionalGuestPrice == null ? EXTRA_GUEST_CHARGE : room.additionalGuestPrice;

/** Nightly price: single, double, or double plus the extra-person charge. */
export const rateFor = (room, guests) =>
  (Number(guests) >= 2 ? room.doubleRate : room.singleRate) + extraGuests(guests) * extraChargeOf(room);

/** Describes a room change by comparing nightly prices. */
export function shiftKind(oldRate, newRate) {
  if (newRate > oldRate) return 'upgrade';
  if (newRate < oldRate) return 'downgrade';
  return 'same';
}

/**
 * Preview of a mid-stay shift: nights already stayed stay at the old price,
 * the remaining nights are charged at the new price.
 */
export function shiftPreview({ oldRate, newRate, nights, nightsUsed }) {
  const remaining = Math.max(0, (Number(nights) || 1) - (Number(nightsUsed) || 0));
  return {
    remaining,
    diffPerNight: newRate - oldRate,
    adjustment: (newRate - oldRate) * remaining,
    kind: shiftKind(oldRate, newRate)
  };
}

/** Nights still to stay from `date` until the stay's check-out. */
export const nightsLeft = (room, date) =>
  Math.max(0, Math.round((new Date(room.checkOut || date) - new Date(date)) / 86400000));

/** Features a room can have; the manager ticks them when adding or editing a room. */
export const ROOM_FEATURES = [
  'AC', 'TV', 'Hot water / geyser', 'Wi-Fi', 'Attached bathroom', 'Balcony', 'Double bed',
  'Twin beds', 'Extra bed available', 'Fridge', 'Sofa / seating', 'Work desk', 'Power backup', 'Window view'
];
