import { useMemo, useState } from 'react';
import { foodImg } from '../assets';
import Card from '../components/Card';
import Field, { Row2 } from '../components/Field';
import { Kpi, KpiGrid } from '../components/Kpi';
import ListRow from '../components/ListRow';
import Pill from '../components/Pill';
import Stepper from '../components/Stepper';
import { money } from '../lib/format';
import { printSlip } from '../lib/print';
import { useHotel } from '../store/HotelContext';

const GST_RATE = 0.05;

export default function FoodScreen() {
  const { db, openSheet, actions } = useHotel();

  const [cart, setCart] = useState([]);
  const [menuCat, setMenuCat] = useState('All');
  const [table, setTable] = useState('');
  const [mode, setMode] = useState('Cash');

  const MENU = db.menu;
  const cats = useMemo(() => ['All', ...new Set(MENU.map((m) => m.c))], [MENU]);
  const list = MENU.filter((m) => menuCat === 'All' || m.c === menuCat);

  const sub = cart.reduce((s, c) => s + c.p * c.q, 0);
  const gst = Math.round(sub * GST_RATE);

  const addToCart = (item) =>
    setCart((prev) => {
      const found = prev.find((c) => c.n === item.n);
      return found
        ? prev.map((c) => (c.n === item.n ? { ...c, q: c.q + 1 } : c))
        : [...prev, { id: item.id, n: item.n, p: item.p, q: 1 }];
    });

  const changeQty = (index, delta) =>
    setCart((prev) =>
      prev
        .map((c, i) => (i === index ? { ...c, q: c.q + delta } : c))
        .filter((c) => c.q > 0)
    );

  const settle = async () => {
    if (!cart.length) return;
    const who = table || 'Walk-in';
    const ok = await actions.settleBill(cart, who, mode);
    if (!ok) return;
    printSlip({ title: 'TAX INVOICE', who, items: cart, withTax: true });
    setCart([]);
    setTable('');
  };

  const onlineSale = db.online.reduce((s, o) => s + o.amount, 0);
  const running = db.online.filter((o) => o.status !== 'Delivered').length;

  return (
    <>
      <KpiGrid>
        <Kpi value={money(onlineSale)} label="Online food sale" />
        <Kpi value={running} label="Orders running" />
      </KpiGrid>

      <Card title="Online orders">
        {db.online.map((o) => (
          <ListRow key={o.id} title={`${o.plat} · ${o.oid}`} sub={o.items}
            right={
              <div style={{ textAlign: 'right' }}>
                <div className="num" style={{ color: 'var(--ink)' }}>{money(o.amount)}</div>
                <Pill tone={o.status === 'Delivered' ? 'g' : o.status === 'Preparing' ? 'o' : 'b'}>
                  {o.status}
                </Pill>
              </div>
            }
          />
        ))}
        <ListRow>
          <button className="btn sm" onClick={() => openSheet('onlineOrder')}>Add online order</button>
        </ListRow>
      </Card>

      <Card title="Kitchen queue">
        {db.kots.length ? db.kots.map((k) => (
          <ListRow
            key={k.id}
            title={`Room ${k.room}`}
            sub={k.items.map((i) => `${i.q}× ${i.n}`).join(', ')}
            right={<Pill tone={k.status === 'Served' ? 'g' : 'o'}>{k.status}</Pill>}
          />
        )) : (
          <ListRow><span style={{ color: 'var(--muted)' }}>Kitchen queue is clear.</span></ListRow>
        )}
      </Card>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '16px 0 10px' }}>
        <h3 style={{ margin: 0 }}>Restaurant billing</h3>
        <button className="btn sm" onClick={() => openSheet('addMenuItem')}>+ Add food item</button>
      </div>

      <div className="chips">
        {cats.map((c) => (
          <button key={c} className={menuCat === c ? 'on' : ''} onClick={() => setMenuCat(c)}>{c}</button>
        ))}
      </div>

      <div className="menu">
        {list.map((m) => (
          <button key={m.n} className="mcard" onClick={() => addToCart(m)}>
            <img src={m.img || foodImg(m.n)} alt={m.n} />
            <div className="mb">
              <div className="mn">{m.n}</div>
              <div className="mp">{money(m.p)}</div>
            </div>
          </button>
        ))}
      </div>

      {cart.length > 0 && (
        <Card
          title="Current bill"
          style={{ marginTop: 14 }}
          action={<button className="btn sm" onClick={() => setCart([])}>Clear</button>}
          body
        >
          {cart.map((c, i) => (
            <div key={c.n} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <div style={{ flex: 1 }}>
                <b style={{ color: 'var(--ink)', fontSize: 13.5 }}>{c.n}</b>
                <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>{money(c.p)} each</div>
              </div>
              <Stepper
                value={c.q}
                onDecrease={() => changeQty(i, -1)}
                onIncrease={() => changeQty(i, 1)}
              />
              <span className="num" style={{ width: 62, textAlign: 'right', color: 'var(--ink)' }}>
                {money(c.p * c.q)}
              </span>
            </div>
          ))}

          <table>
            <tbody>
              <tr><td>Subtotal</td><td className="rt num">{money(sub)}</td></tr>
              <tr><td>CGST 2.5% + SGST 2.5%</td><td className="rt num">{money(gst)}</td></tr>
              <tr>
                <td><b>Total</b></td>
                <td className="rt num" style={{ fontSize: 16, color: 'var(--ink)' }}>{money(sub + gst)}</td>
              </tr>
            </tbody>
          </table>

          <div style={{ marginTop: 12 }}>
            <Row2>
              <Field
                label="Table / room" placeholder="Table 4"
                value={table} onChange={(e) => setTable(e.target.value)}
              />
              <Field as="select" label="Mode" value={mode} onChange={(e) => setMode(e.target.value)}>
                {['Cash', 'UPI', 'Card', 'Room charge'].map((m) => <option key={m}>{m}</option>)}
              </Field>
            </Row2>
          </div>

          <button className="btn p" onClick={settle}>Settle &amp; print bill</button>
        </Card>
      )}
    </>
  );
}
