import Card from '../components/Card';
import ListRow from '../components/ListRow';
import { money } from '../lib/format';
import {
  averageRoomRate, lowStock, occupancyPct, revPar, totalReceipt
} from '../lib/selectors';
import { useHotel } from '../store/HotelContext';

export default function MoreScreen() {
  const { db, openSheet } = useHotel();

  const present = db.staff.filter((s) => db.att[s.id] === 'P').length;
  const absent = db.staff.filter((s) => db.att[s.id] === 'A').length;
  const expenseTotal = db.expenses.reduce((s, e) => s + e.amount, 0);

  const menu = [
    ['Bookings (OTA)', `${db.bookings.length} today`, 'bookings'],
    ['Inventory', `${lowStock(db).length} below minimum`, 'inventory'],
    ['Staff attendance', `${present} present · ${absent} absent`, 'staff'],
    ['Expenses', `${money(expenseTotal)} today`, 'expenses'],
    ['GST invoice', 'Create a tax invoice', 'invoice'],
    ['Guest management', 'In-house stays, dates & folio', 'guests'],
    ['Export reports', 'Download as PDF or Excel', 'export']
  ];

  return (
    <>
      <Card>
        {menu.map(([title, sub, key]) => (
          <ListRow
            key={key}
            title={title}
            sub={sub}
            onClick={() => openSheet(key)}
            right={<span style={{ color: 'var(--muted)' }}>›</span>}
          />
        ))}
      </Card>

      <Card title="Today at a glance" body>
        <table>
          <tbody>
            <tr><td>Occupancy</td><td className="rt num">{occupancyPct(db)}%</td></tr>
            <tr><td>Average room rate</td><td className="rt num">{money(averageRoomRate(db))}</td></tr>
            <tr><td>RevPAR</td><td className="rt num">{money(revPar(db))}</td></tr>
            <tr><td>Total collection</td><td className="rt num">{money(totalReceipt(db))}</td></tr>
          </tbody>
        </table>
      </Card>

      <p style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'center', margin: '14px 0 0' }}>
        The Midtown Hotel · Manager app<br />
        Built by MACROPAGE — MR Tech Solutions Pvt. Ltd.
      </p>
    </>
  );
}
