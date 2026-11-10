import { useState } from 'react';
import Field from '../components/Field';
import Pill from '../components/Pill';
import Sheet from '../components/Sheet';
import { money } from '../lib/format';
import { REQUEST_EXTRAS, REQUEST_STATUS, requestType } from '../lib/requests';
import { useHotel } from '../store/HotelContext';

const NEXT = [
  ['IN_PROGRESS', 'In progress'],
  ['DONE', 'Completed'],
  ...(REQUEST_EXTRAS ? [['REJECTED', 'Rejected']] : [])
];

/** Full detail of one guest request, with the status change and remark. */
export default function RequestSheet({ id }) {
  const { db, actions } = useHotel();
  const r = db.requests.find((x) => x.id === id);

  const [status, setStatus] = useState(r?.status === 'SENT' ? 'IN_PROGRESS' : 'DONE');
  const [remark, setRemark] = useState('');
  const [price, setPrice] = useState('');
  const [busy, setBusy] = useState(false);

  if (!r) return null;
  const type = requestType(r.key, r.label);
  const st = REQUEST_STATUS[r.expired ? 'EXPIRED' : r.status] || REQUEST_STATUS.SENT;
  const locked = r.expired || r.status === 'DONE' || r.status === 'REJECTED';
  const needsRemark = status === 'REJECTED';
  const showPrice = REQUEST_EXTRAS && type.chargeable && status === 'DONE';

  const save = async () => {
    if (needsRemark && !remark.trim()) return;
    setBusy(true);
    const ok = await actions.updateRequest(r.id, { status, remark: remark.trim(), price: showPrice ? price : undefined });
    if (!ok) setBusy(false);
  };

  return (
    <Sheet
      title={`${type.icon} ${type.label}`}
      footer={!locked && (
        <button className="btn p" disabled={busy || (needsRemark && !remark.trim())} onClick={save}>
          {busy ? 'Saving…' : `Save as ${REQUEST_STATUS[status].label.toLowerCase()}`}
        </button>
      )}
    >
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
        <Pill tone={st.tone}>{st.label}</Pill>
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>
          Sent {r.time}{r.date && r.date !== db.date ? ` · ${r.date}` : ''} via guest app
        </span>
      </div>

      <table>
        <tbody>
          <tr><td>Room</td><td className="rt num">{r.room ?? '—'}</td></tr>
          <tr><td>Guest</td><td className="rt">{r.guest || '—'}</td></tr>
          <tr>
            <td>Phone</td>
            <td className="rt">{r.phone ? <a href={`tel:${r.phone}`}>{r.phone}</a> : '—'}</td>
          </tr>
          <tr>
            <td>Guest status</td>
            <td className="rt">
              {r.stayActive ? `In-house${r.checkOut ? ` · out ${r.checkOut}` : ''}` : 'Checked out'}
            </td>
          </tr>
          {r.handledBy && <tr><td>Handled by</td><td className="rt">{r.handledByName || 'Staff'}</td></tr>}
        </tbody>
      </table>

      <div style={{ background: 'var(--bg)', borderRadius: 11, padding: '11px 12px', margin: '12px 0', fontSize: 13.5 }}>
        <div style={{ fontSize: 11.5, color: 'var(--muted)', marginBottom: 3 }}>Guest note</div>
        {r.note ? `“${r.note}”` : <span style={{ color: 'var(--muted)' }}>No note added</span>}
      </div>
      {type.hint && <p style={{ fontSize: 12, color: 'var(--muted)', margin: '0 0 12px' }}>{type.hint}</p>}

      {r.remark && (
        <div style={{ background: 'var(--wash)', borderRadius: 11, padding: '11px 12px', marginBottom: 12, fontSize: 13 }}>
          <div style={{ fontSize: 11.5, color: 'var(--muted)', marginBottom: 3 }}>Staff remark</div>
          {r.remark}
          {r.price > 0 && <div style={{ marginTop: 4 }}>Charged: <b>{money(r.price)}</b></div>}
        </div>
      )}

      {r.expired && (
        <div style={{ background: 'var(--ow)', color: '#A55A00', borderRadius: 11, padding: '11px 12px', fontSize: 12.5 }}>
          The guest has checked out, so this request has expired and cannot be updated.
        </div>
      )}

      {!locked && (
        <>
          <Field as="select" label="Update status" value={status} onChange={(e) => setStatus(e.target.value)}>
            {NEXT.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Field>

          {REQUEST_EXTRAS && (
            <>
              <div className="chips" style={{ flexWrap: 'wrap' }}>
                {(type.remarks[status] || []).map((t) => (
                  <button key={t} type="button" onClick={() => setRemark(t)}>{t}</button>
                ))}
              </div>

              <Field
                as="textarea" rows={3}
                label={needsRemark ? 'Reason for rejecting (required)' : 'Remark for the guest (optional)'}
                value={remark} onChange={(e) => setRemark(e.target.value)}
                placeholder="Type a message the guest will see"
              />
            </>
          )}

          {showPrice && (
            <Field label="Charge to room (₹, leave empty if free)" type="number" value={price}
              onChange={(e) => setPrice(e.target.value)} />
          )}
        </>
      )}
      <div style={{ height: 10 }} />
    </Sheet>
  );
}
