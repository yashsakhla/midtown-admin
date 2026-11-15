import { PageCtx } from '../components/Sheet';
import { CustomersSheet } from '../sheets/CustomerSheets';
import { GuestsSheet } from '../sheets/GuestSheets';
import {
  BookingsSheet, ExpensesSheet, ExportSheet, GstInvoiceSheet, InventorySheet, StaffSheet
} from '../sheets/OpsSheets';

const PAGES = {
  bookings: BookingsSheet,
  guests: GuestsSheet,
  customers: CustomersSheet,
  inventory: InventorySheet,
  staff: StaffSheet,
  expenses: ExpensesSheet,
  invoice: GstInvoiceSheet,
  export: ExportSheet
};

/** Full-page version of the back-office sections (same content and actions as the old popups). */
export default function PageScreen({ id }) {
  const Page = PAGES[id];
  return (
    <PageCtx.Provider value>
      <Page />
    </PageCtx.Provider>
  );
}
