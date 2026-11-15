/** Desktop sidebar structure — same destinations as the app, grouped like the reference design. */
export const NAV = [
  ['Front desk', [
    ['tab', 'home', 'Dashboard'],
    ['tab', 'rooms', 'Room status'],
    ['tab', 'book', 'Day book & cash'],
    ['page', 'requests', 'Service requests', 'M6 9a6 6 0 0112 0c0 7 3 8 3 8H3s3-1 3-8M10 21h4'],
    ['page', 'bookings', 'Bookings (OTA)', 'M8 3v4M16 3v4M4 9h16M5 5h14v16H5z'],
    ['page', 'guests', 'Guest management', 'M16 20v-2a4 4 0 00-8 0v2M12 12a4 4 0 100-8 4 4 0 000 8'],
    ['page', 'customers', 'Customers', 'M17 20v-2a4 4 0 00-3-3.9M9 11a4 4 0 100-8 4 4 0 000 8M3 20v-2a4 4 0 014-4h4a4 4 0 014 4v2M17 3.1a4 4 0 010 7.8']
  ]],
  ['Food & service', [
    ['tab', 'food', 'Restaurant & orders']
  ]],
  ['Back office', [
    ['tab', 'more', 'Back office'],
    ['page', 'inventory', 'Inventory', 'M3 8l9-5 9 5-9 5zM3 8v8l9 5 9-5V8'],
    ['page', 'staff', 'Staff & attendance', 'M16 20v-2a4 4 0 00-8 0v2M12 12a4 4 0 100-8 4 4 0 000 8'],
    ['page', 'expenses', 'Expenses', 'M12 3v18M8 7h6a3 3 0 010 6H9a3 3 0 000 6h7'],
    ['page', 'invoice', 'GST invoices', 'M6 3h12v18H6zM9 8h6M9 12h6M9 16h3'],
    ['page', 'export', 'Reports', 'M4 20V10M10 20V4M16 20v-7M22 20H2']
  ]]
];

export const PAGE = {
  home: ['Dashboard', "Here's what's happening at The Midtown today."],
  rooms: ['Room status', 'Tap a room to change its status or open the folio'],
  book: ['Day book & cash', 'Every entry of the day, with opening balance and receipts by mode'],
  food: ['Restaurant & orders', 'Table billing, room orders and kitchen slips'],
  more: ['Back office', 'Bookings, stock, staff, expenses and reports'],
  requests: ['Service requests', 'All guest requests, filter by date'],
  bookings: ['Bookings (OTA)', 'MakeMyTrip, Booking.com, Goibibo, Agoda and phone bookings'],
  guests: ['Guest management', 'In-house guests, stay dates, folio and ID register'],
  customers: ['Customers', 'Every guest who has stayed: profile, ID and stay history'],
  inventory: ['Inventory', 'Linen, kitchen and housekeeping stock'],
  staff: ['Staff & attendance', 'Duty roster and daily attendance'],
  expenses: ['Expenses', 'Cash and bank outflow of the day'],
  invoice: ['GST invoices', 'Tax invoices for rooms, banquet and restaurant'],
  export: ['Reports', 'Download occupancy, revenue and collection reports']
};

/** Floating / header primary action per tab. */
export const FAB = {
  home: ['+ Check-in', 'checkIn'],
  rooms: ['+ Check-in', 'checkIn'],
  book: ['+ New entry', 'entry'],
  food: ['Print KOT', 'kot'],
  more: ['+ Booking', 'booking'],
  bookings: ['+ Booking', 'booking']
};
