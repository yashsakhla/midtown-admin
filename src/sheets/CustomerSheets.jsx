import { useEffect, useMemo, useState } from 'react';
import Card from '../components/Card';
import DocumentFields, { emptyDoc } from '../components/DocumentFields';
import Field, { Row2 } from '../components/Field';
import ListRow from '../components/ListRow';
import Pill from '../components/Pill';
import Sheet from '../components/Sheet';
import { maskDoc } from '../lib/customers';
import { fmtDate, money } from '../lib/format';
import { PAYMENT_MODES } from '../lib/selectors';
import { useHotel } from '../store/HotelContext';

/* ------------------------------------------------------- customer list page */

export function CustomersSheet() {
  const { db, openSheet } = useHotel();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all');

  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    return db.customers
      .filter((c) => !t || c.name.toLowerCase().includes(t) || c.phone.includes(t))
      .filter((c) => filter === 'all' || (filter === 'repeat' ? c.visits > 1 : filter === 'dues' ? c.credit > 0 : !c.hasDoc))
      .sort((a, b) => String(b.lastVisit).localeCompare(String(a.lastVisit)));
  }, [db.customers, q, filter]);

  const repeat = db.customers.filter((c) => c.visits > 1).length;
  const noDoc = db.customers.filter((c) => !c.hasDoc).length;
  const owing = db.customers.filter((c) => c.credit > 0);
  const receivable = owing.reduce((s, c) => s + c.credit, 0);

  return (
    <Sheet title={`Customers · ${db.customers.length}`}>
      <Field label="Search" placeholder="Name or phone" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="chips" style={{ flexWrap: 'wrap', marginBottom: 10 }}>
        {[['all', `All ${db.customers.length}`], ['repeat', `Repeat guests ${repeat}`], ['dues', `Credit due ${owing.length}`], ['nodoc', `No document ${noDoc}`]].map(([k, l]) => (
          <button key={k} type="button" className={filter === k ? 'on' : ''} onClick={() => setFilter(k)}>{l}</button>
        ))}
      </div>

      {receivable > 0 && (
        <div style={{ background: '#FDF2F1', color: 'var(--red)', borderRadius: 11, padding: '10px 12px', fontSize: 13, marginBottom: 10 }}>
          <b>{money(receivable)}</b> to receive from {owing.length} customer{owing.length === 1 ? '' : 's'} on credit
        </div>
      )}

      <Card>
        {rows.length ? rows.map((c) => (
          <ListRow key={c.id} onClick={() => openSheet('customer', { id: c.id })}>
            <div className="t">
              <b>{c.name || 'Unnamed'}</b>
              <span>{c.phone} · {c.visits} visit{c.visits === 1 ? '' : 's'}{c.lastVisit ? ` · last ${fmtDate(c.lastVisit)}` : ''}</span>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="num" style={{ color: 'var(--ink)' }}>{money(c.spend)}</div>
              <div style={{ fontSize: 11.5, margin: '2px 0 4px', fontWeight: 600, color: c.credit > 0 ? 'var(--red)' : 'var(--muted)' }}>
                {c.credit > 0 ? `Due ${money(c.credit)}` : 'No dues'}
              </div>
              {c.hasDoc ? <Pill tone="g">ID on file</Pill> : <Pill tone="o">No ID</Pill>}
            </div>
          </ListRow>
        )) : (
          <ListRow><span style={{ color: 'var(--muted)' }}>No customers found.</span></ListRow>
        )}
      </Card>
      <p style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 10 }}>
        A customer is created automatically at their first check-in. Returning guests are matched by phone number, so their ID is not asked again.
      </p>
    </Sheet>
  );
}

/* -------------------------------------------------------- customer profile */

export function CustomerSheet({ id }) {
  const { db, actions } = useHotel();
  const listed = db.customers.find((c) => c.id === id);
  const [full, setFull] = useState(null);
  const [doc, setDoc] = useState(emptyDoc());
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [credit, setCredit] = useState(null);          // 'CHARGE' | 'PAYMENT' while the form is open
  const [cf, setCf] = useState({ amount: '', mode: 'Cash', narration: '' });

  const refresh = () => actions.loadCustomer(id).then((c) => c && setFull(c));
  useEffect(() => { refresh(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const c = full || listed;
  if (!c) return null;

  const save = async () => {
    setBusy(true);
    const ok = await actions.uploadCustomerDoc(id, doc);
    setBusy(false);
    if (ok) { setDoc(emptyDoc()); setAdding(false); refresh(); }
  };

  const saveCredit = async () => {
    setBusy(true);
    const ok = await actions.customerCredit(id, credit, cf);
    setBusy(false);
    if (ok) { setCredit(null); setCf({ amount: '', mode: 'Cash', narration: '' }); refresh(); }
  };

  return (
    <Sheet title={c.name || 'Customer'}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
        <Pill tone={c.visits > 1 ? 'b' : 'n'}>{c.visits > 1 ? 'Repeat guest' : 'New guest'}</Pill>
        {c.hasDoc ? <Pill tone="g">ID on file</Pill> : <Pill tone="o">No ID on file</Pill>}
      </div>

      <table>
        <tbody>
          <tr><td>Phone</td><td className="rt num">{c.phone ? <a href={`tel:${c.phone}`}>{c.phone}</a> : '—'}</td></tr>
          {c.email && <tr><td>Email</td><td className="rt">{c.email}</td></tr>}
          <tr><td>Visits</td><td className="rt num">{c.visits}</td></tr>
          <tr><td>Total spent</td><td className="rt num">{money(c.spend)}</td></tr>
          <tr><td>First visit</td><td className="rt num">{fmtDate(c.firstVisit)}</td></tr>
          <tr><td>Last visit</td><td className="rt num">{fmtDate(c.lastVisit)}</td></tr>
        </tbody>
      </table>

      <h3 style={{ margin: '16px 0 8px', fontSize: 14 }}>Credit (udhaar)</h3>
      <div style={{ background: c.credit > 0 ? '#FDF2F1' : 'var(--bg)', borderRadius: 11, padding: '10px 12px', marginBottom: 8 }}>
        <div style={{ fontSize: 12, color: 'var(--muted)' }}>{c.credit > 0 ? 'This customer owes us' : 'No credit due'}</div>
        <div className="num" style={{ fontSize: 20, color: c.credit > 0 ? 'var(--red)' : 'var(--ink)' }}>{money(c.credit)}</div>
      </div>
      <div className="chips" style={{ flexWrap: 'wrap' }}>
        <button type="button" className={credit === 'CHARGE' ? 'on' : ''} onClick={() => setCredit(credit === 'CHARGE' ? null : 'CHARGE')}>Give on credit</button>
        <button type="button" className={credit === 'PAYMENT' ? 'on' : ''} disabled={!(c.credit > 0)} onClick={() => { setCredit(credit === 'PAYMENT' ? null : 'PAYMENT'); setCf((f) => ({ ...f, amount: String(c.credit) })); }}>Receive payment</button>
      </div>
      {credit && (
        <div style={{ margin: '8px 0' }}>
          <Row2>
            <Field label={credit === 'CHARGE' ? 'Credit amount' : 'Amount received'} type="number" value={cf.amount} onChange={(e) => setCf((f) => ({ ...f, amount: e.target.value }))} />
            {credit === 'PAYMENT' && (
              <Field as="select" label="Mode" value={cf.mode} onChange={(e) => setCf((f) => ({ ...f, mode: e.target.value }))}>
                {PAYMENT_MODES.map((m) => <option key={m}>{m}</option>)}
              </Field>
            )}
          </Row2>
          <Field label="Narration" placeholder={credit === 'CHARGE' ? 'Room dues, dinner…' : 'Part payment…'} value={cf.narration} onChange={(e) => setCf((f) => ({ ...f, narration: e.target.value }))} />
          <button type="button" className="btn p" disabled={busy} onClick={saveCredit}>{credit === 'CHARGE' ? 'Add to customer due' : 'Record payment'}</button>
        </div>
      )}
      {c.ledger.length > 0 && c.ledger.map((l) => (
        <ListRow
          key={l.id}
          title={l.kind === 'PAYMENT' ? `Paid back${l.mode ? ` · ${l.mode}` : ''}` : 'Credit given'}
          sub={`${fmtDate(l.date)}${l.narration ? ` · ${l.narration}` : ''}`}
          right={<span className="num" style={{ color: l.kind === 'PAYMENT' ? 'var(--green)' : 'var(--red)' }}>{l.kind === 'PAYMENT' ? '\u2212' : '+'}{money(l.amount)}</span>}
        />
      ))}

      <h3 style={{ margin: '16px 0 8px', fontSize: 14 }}>Documents</h3>
      {c.documents.length ? c.documents.map((d) => (
        <ListRow
          key={d.id}
          title={`${d.type}${d.number ? ` · ${maskDoc(d.number)}` : ''}`}
          sub={d.at ? `Added ${fmtDate(d.at)}` : d.name}
          right={d.url ? <a href={d.url} target="_blank" rel="noreferrer">View</a> : null}
        />
      )) : <p style={{ fontSize: 12.5, color: 'var(--muted)', margin: '0 0 8px' }}>No document uploaded yet.</p>}

      {adding ? (
        <>
          <DocumentFields value={doc} onChange={setDoc} />
          <button className="btn p" disabled={busy || !doc.file} onClick={save}>{busy ? 'Saving…' : 'Save document'}</button>
        </>
      ) : (
        <button className="btn sm" onClick={() => setAdding(true)}>{c.hasDoc ? 'Add / replace document' : 'Add document'}</button>
      )}

      <h3 style={{ margin: '18px 0 8px', fontSize: 14 }}>Stay history</h3>
      {c.stays.length ? c.stays.map((s) => (
        <ListRow key={s.id}>
          <div className="t">
            <b>Room {s.room}{s.roomType ? ` · ${s.roomType}` : ''}</b>
            <span>{fmtDate(s.checkIn)} → {fmtDate(s.checkOut)} · {s.nights} night{s.nights === 1 ? '' : 's'} · {s.guests} guest{s.guests === 1 ? '' : 's'}</span>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="num" style={{ color: 'var(--ink)' }}>{money(s.amount)}</div>
            {s.balance > 0 ? <Pill tone="r">Due {money(s.balance)}</Pill> : <Pill tone="g">{s.status || 'Paid'}</Pill>}
          </div>
        </ListRow>
      )) : <p style={{ fontSize: 12.5, color: 'var(--muted)' }}>No stays recorded yet.</p>}

      {c.payments.length > 0 && (
        <>
          <h3 style={{ margin: '18px 0 8px', fontSize: 14 }}>Payments</h3>
          {c.payments.map((p) => (
            <ListRow
              key={p.id}
              title={`${p.type || 'Payment'} · ${p.mode}`}
              sub={`${fmtDate(p.date)}${p.narration ? ` · ${p.narration}` : ''}`}
              right={<span className="num" style={{ color: p.dc === 'credit' ? 'var(--green)' : 'var(--red)' }}>{p.dc === 'debit' ? '\u2212' : ''}{money(p.amount)}</span>}
            />
          ))}
        </>
      )}
      <div style={{ height: 14 }} />
    </Sheet>
  );
}
