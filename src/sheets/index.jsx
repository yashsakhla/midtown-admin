import { useHotel } from '../store/HotelContext';
import {
  CloseDaySheet, EditEntrySheet, StartDaySheet, EntrySheet, EntryViewSheet,
  OpeningBalanceSheet, WorkingDateSheet
} from './EntrySheets';
import { EditGuestSheet, GuestsSheet } from './GuestSheets';
import {
  AddBookingSheet, BookingsSheet, BookingViewSheet, ExpensesSheet, ExportSheet,
  AddMenuItemSheet, AddStaffSheet, AddStockSheet, GstInvoiceSheet, InventorySheet, KotSheet, OnlineOrderSheet, StaffSheet
} from './OpsSheets';
import RequestSheet from './RequestSheet';
import { CheckOutSheet } from './CheckOutSheet';
import { CustomerSheet, CustomersSheet } from './CustomerSheets';
import { AddGuestSheet, AddRoomSheet, CheckInSheet, EditRoomSheet, MaintenanceSheet, RoomSheet, ShiftRoomSheet } from './RoomSheets';

const SHEETS = {
  room: RoomSheet,
  addRoom: AddRoomSheet,
  checkIn: CheckInSheet,
  checkOut: CheckOutSheet,
  shiftRoom: ShiftRoomSheet,
  addGuest: AddGuestSheet,
  editRoom: EditRoomSheet,
  maintenance: MaintenanceSheet,
  customers: CustomersSheet,
  customer: CustomerSheet,
  entry: EntrySheet,
  entryView: EntryViewSheet,
  editEntry: EditEntrySheet,
  openingBalance: OpeningBalanceSheet,
  closeDay: CloseDaySheet,
  startDay: StartDaySheet,
  workingDate: WorkingDateSheet,
  kot: KotSheet,
  onlineOrder: OnlineOrderSheet,
  bookings: BookingsSheet,
  booking: AddBookingSheet,
  bookingView: BookingViewSheet,
  inventory: InventorySheet,
  addStock: AddStockSheet,
  addStaff: AddStaffSheet,
  addMenuItem: AddMenuItemSheet,
  staff: StaffSheet,
  expenses: ExpensesSheet,
  invoice: GstInvoiceSheet,
  guests: GuestsSheet,
  editGuest: EditGuestSheet,
  export: ExportSheet,
  request: RequestSheet
};

/** Renders whichever sheet the store has open. */
export default function SheetHost() {
  const { sheet } = useHotel();
  if (!sheet) return null;

  const Component = SHEETS[sheet.type];
  if (!Component) return null;

  // Keying on type + props remounts the sheet so each one starts with fresh
  // form state rather than inheriting the previous sheet's values.
  return <Component key={`${sheet.type}:${JSON.stringify(sheet.props)}`} {...sheet.props} />;
}
