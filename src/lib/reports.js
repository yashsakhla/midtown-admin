/** Report definitions shared by the PDF and Excel exports. */

export const REPORTS = [
  { key: 'daily', label: 'Daily report — all entries' },
  { key: 'cash', label: 'Day book — cash & bank' },
  { key: 'rooms', label: 'Room status & guest register' },
  { key: 'bookings', label: 'Bookings from OTA' },
  { key: 'expenses', label: 'Expenses' },
  { key: 'stock', label: 'Inventory' },
  { key: 'staff', label: 'Staff attendance' },
  { key: 'online', label: 'Online food orders' }
];

const ATTENDANCE = { P: 'Present', A: 'Absent', L: 'Leave' };

export function buildReport(db, key = 'daily') {
  switch (key) {
    case 'cash':
      return {
        title: 'Day book',
        head: ['Head', 'Mode', 'Narration', 'Credit', 'Debit'],
        rows: db.cash.txns.map((t) => [
          t.head, t.mode, t.narration,
          t.dc === 'credit' ? t.amount : '',
          t.dc === 'debit' ? t.amount : ''
        ])
      };

    case 'rooms':
      return {
        title: 'Room status & guest register',
        head: ['Room', 'Type', 'Status', 'Guest', 'Phone', 'Vehicle', 'Check-in', 'Check-out', 'Nights', 'Folio'],
        rows: db.rooms.map((r) => [
          r.no, r.type, r.status, r.guest || '', r.phone || '', r.vehicle || '',
          r.checkIn || '', r.checkOut || '', r.nights, r.folio
        ])
      };

    case 'bookings':
      return {
        title: 'Bookings',
        head: ['Source', 'Reference', 'Guest', 'Phone', 'Type', 'Rooms', 'Check-in', 'Amount', 'Payment', 'Status'],
        rows: db.bookings.map((b) => [b.src, b.ref, b.guest, b.phone, b.type, b.rooms, b.inD, b.amount, b.pay, b.status])
      };

    case 'expenses':
      return {
        title: 'Expenses',
        head: ['Head', 'Paid to', 'Mode', 'Narration', 'Amount'],
        rows: db.expenses.map((e) => [e.head, e.vendor, e.mode, e.narration, e.amount])
      };

    case 'stock':
      return {
        title: 'Inventory',
        head: ['Item', 'Department', 'Stock', 'Unit', 'Minimum', 'Rate', 'Value'],
        rows: db.stock.map((s) => [s.item, s.cat, s.qty, s.unit, s.min, s.rate, s.qty * s.rate])
      };

    case 'staff':
      return {
        title: 'Staff attendance',
        head: ['Name', 'Role', 'Shift', 'Salary', 'Attendance'],
        rows: db.staff.map((s) => [s.name, s.role, s.shift, s.salary, ATTENDANCE[db.att[s.id]] || ''])
      };

    case 'online':
      return {
        title: 'Online food orders',
        head: ['Platform', 'Order ID', 'Time', 'Items', 'Order value', 'Net payout', 'Status'],
        rows: db.online.map((o) => [o.plat, o.oid, o.time, o.items, o.amount, o.payout, o.status])
      };

    case 'daily':
    default:
      return {
        title: 'Daily report',
        head: ['Time', 'Room', 'Customer', 'Phone', 'Vehicle', 'Type', 'Mode', 'Narration', 'Credit', 'Debit'],
        rows: db.entries.map((e) => [
          e.time, e.room || '', e.guest || '', e.phone || '', e.vehicle || '', e.type, e.mode, e.narration || '',
          e.dc === 'credit' ? e.amount : '',
          e.dc === 'debit' ? e.amount : ''
        ])
      };
  }
}
