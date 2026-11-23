import { Fragment, useEffect, useMemo, useState } from 'react';
import Field, { Row2 } from '../components/Field';
import { Kpi, KpiGrid } from '../components/Kpi';
import Pill from '../components/Pill';
import Sheet from '../components/Sheet';
import {
  MARKS, markLabel, monthCells, monthOf, monthRange, monthTitle, shiftMonth
} from '../lib/attendance';
import { bookingToday } from '../lib/bookings';
import { fmtDate, money } from '../lib/format';
import { useHotel } from '../store/HotelContext';

const TONE = Object.fromEntries(MARKS.map((m) => [m.code, m.tone]));
const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

/* ------------------------------------------------- calendar history of one person */

function StaffHistory({ staff, today }) {
  const { actions, attVersion } = useHotel();
  const [ym, setYm] = useState(monthOf(today));
  const [marks, setMarks] = useState({});                  // date -> P | A | L
  const [state, setState] = useState('loading');           // loading | ok | error

  useEffect(() => {
    let live = true;
    setState('loading');
    const [from, to] = monthRange(ym);
    actions.fetchAttendance(from, to, staff.id)
      .then((rows) => {
        if (!live) return;
        setMarks(Object.fromEntries(rows.filter((r) => String(r.staffId) === String(staff.id)).map((r) => [r.date, r.mark])));
        setState('ok');
      })
      .catch(() => live && setState('error'));
    return () => { live = false; };
  }, [ym, staff.id, attVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  const days = monthCells(ym).filter(Boolean);
  const count = (c) => days.filter((d) => marks[d] === c).length;
  const marked = count('P') + count('A') + count('L');
  const pct = marked ? Math.round((count('P') / marked) * 100) : 0;
  const pastDays = days.filter((d) => d <= today).length;

  return (
    <div className="att-hist">
      <div className="att-head">
        <button type="button" className="btn sm nav" aria-label="Previous month" onClick={() => setYm(shiftMonth(ym, -1))}>&#8249;</button>
        <b>{monthTitle(ym)}</b>
        <button type="button" className="btn sm nav" aria-label="Next month" disabled={ym >= monthOf(today)} onClick={() => setYm(shiftMonth(ym, 1))}>&#8250;</button>
        {ym !== monthOf(today) && <button type="button" className="btn sm" onClick={() => setYm(monthOf(today))}>This month</button>}
      </div>

      <div className="att-stats">
        <span className="p"><b>{count('P')}</b> Present</span>
        <span className="a"><b>{count('A')}</b> Absent</span>
        <span className="l"><b>{count('L')}</b> Leave</span>
        <span className="n"><b>{Math.max(0, pastDays - marked)}</b> Not marked</span>
        <span className="pct"><b>{pct}%</b> attendance</span>
      </div>

      {state === 'error' ? (
        <div className="bk-alert">Attendance history could not be loaded. Check the server connection and try again.</div>
      ) : (
        <div className={`att-cal${state === 'loading' ? ' loading' : ''}`}>
          {WEEKDAYS.map((d) => <i key={d} className="dow">{d}</i>)}
          {monthCells(ym).map((d, i) => {
            if (!d) return <i key={`e${i}`} />;
            const m = marks[d] || '';
            const future = d > today;
            return (
              <div key={d} className={`day ${m ? `m-${m}` : ''}${future ? ' future' : ''}${d === today ? ' now' : ''}`}
                title={`${fmtDate(d)} — ${future ? 'upcoming' : markLabel(m)}`}>
                <span>{Number(d.slice(8))}</span>
                <em>{m}</em>
              </div>
            );
          })}
        </div>
      )}
      <div className="att-legend">
        <span><i className="m-P" />Present</span><span><i className="m-A" />Absent</span>
        <span><i className="m-L" />Leave</span><span><i className="m-none" />Not marked</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------- mark attendance panel */

function MarkAttendance({ staff, today }) {
  const { db, actions, isAdmin, attVersion } = useHotel();
  const [date, setDate] = useState(today);
  const [past, setPast] = useState({});                    // marks for a date other than the open day
  const [busy, setBusy] = useState(false);
  const isToday = date === today;

  useEffect(() => {
    if (isToday) return undefined;
    let live = true;
    actions.fetchAttendance(date, date).then((rows) => {
      if (live) setPast(Object.fromEntries(rows.map((r) => [String(r.staffId), r.mark])));
    }).catch(() => live && setPast({}));
    return () => { live = false; };
  }, [date, isToday, attVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  const view = isToday ? db.att : past;
  const mark = async (id, code) => {
    if (view[id] === code) return;
    const ok = await actions.setAttendance(id, code, date);
    if (ok && !isToday) setPast((p) => ({ ...p, [id]: code }));
  };
  const markAll = async (code) => {
    setBusy(true);
    await Promise.all(staff.filter((s) => view[s.id] !== code).map((s) => mark(s.id, code)));
    setBusy(false);
  };
  const done = staff.filter((s) => view[s.id]).length;

  return (
    <div className="att-mark">
      <div className="att-mark-top">
        {isAdmin ? (
          <Field label="Attendance date" type="date" value={date} max={today} onChange={(e) => e.target.value && setDate(e.target.value > today ? today : e.target.value)} />
        ) : (
          <div className="f"><label>Attendance date</label><div className="att-fixed">{fmtDate(today)} <Pill tone="g">Open day</Pill></div></div>
        )}
        <div className="att-bulk">
          <button type="button" className="btn sm" disabled={busy || !staff.length} onClick={() => markAll('P')}>Mark all present</button>
          {!isToday && <button type="button" className="btn sm" onClick={() => setDate(today)}>Back to today</button>}
        </div>
      </div>
      <p className="att-note">
        {isAdmin
          ? 'Pick any past date to add or correct attendance.'
          : 'Managers can mark attendance for the current open day only.'}{' '}
        <b>{done}</b> of {staff.length} marked for {fmtDate(date)}.
      </p>

      {staff.length ? staff.map((s) => (
        <div key={s.id} className="att-row">
          <i className="av">{s.name.slice(0, 1).toUpperCase()}</i>
          <div className="who"><b>{s.name}</b><span>{s.role} · {s.shift}</span></div>
          <div className="seg" role="group" aria-label={`Attendance for ${s.name}`}>
            {MARKS.map((m) => (
              <button key={m.code} type="button" className={`${view[s.id] === m.code ? `on m-${m.code}` : ''}`}
                aria-pressed={view[s.id] === m.code} onClick={() => mark(s.id, m.code)}>{m.label}</button>
            ))}
          </div>
        </div>
      )) : <p className="att-note">Add a staff member first.</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ the page */

export function StaffSheet() {
  const { db, actions, openSheet, isAdmin } = useHotel();
  const today = bookingToday(db);
  const staff = db.staff;
  const [markOpen, setMarkOpen] = useState(true);
  const [openId, setOpenId] = useState(null);
  const [q, setQ] = useState('');

  const counts = useMemo(() => {
    const c = (code) => staff.filter((s) => db.att[s.id] === code).length;
    return { P: c('P'), A: c('A'), L: c('L') };
  }, [staff, db.att]);
  const term = q.trim().toLowerCase();
  const shown = staff.filter((s) => !term || `${s.name} ${s.role} ${s.phone}`.toLowerCase().includes(term));

  const remove = (s) => {
    if (window.confirm(`Delete ${s.name} from the staff list? Their past attendance stays on record.`)) {
      if (openId === s.id) setOpenId(null);
      actions.deleteStaff(s.id);
    }
  };

  return (
    <Sheet title="Staff & attendance" footer={<button className="btn p" onClick={() => openSheet('addStaff')}>+ Add staff</button>}>
      <KpiGrid>
        <Kpi icon="calendar" tone="blue" value={staff.length} label="Total staff" />
        <Kpi icon="check" tone="green" value={counts.P} label="Present today" />
        <Kpi icon="up" tone="red" value={counts.A} label="Absent today" />
        <Kpi icon="wallet" tone="orange" value={counts.L} label="On leave" note={`${staff.length - counts.P - counts.A - counts.L} not marked`} />
      </KpiGrid>

      {/* ---- mark attendance: opens and closes ---- */}
      <div className="att-acc">
        <button type="button" className="att-acc-head" aria-expanded={markOpen} onClick={() => setMarkOpen((o) => !o)}>
          <span>✅ Mark attendance</span>
          <span className="chev" aria-hidden="true">{markOpen ? '▴' : '▾'}</span>
        </button>
        {markOpen && <MarkAttendance staff={staff} today={today} />}
      </div>

      {/* ---- staff list with per-person history ---- */}
      <div className="rpt-label" style={{ marginTop: 18 }}>All staff · {staff.length}</div>
      <Field label="Search" placeholder="Name, role or phone" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="rpt-wrap bk-table">
        <table className="rpt">
          <thead>
            <tr><th>Staff</th><th>Phone</th><th className="rt">Salary</th><th>Today</th><th className="rt">Actions</th></tr>
          </thead>
          <tbody>
            {shown.length ? shown.map((s) => {
              const open = openId === s.id;
              const m = db.att[s.id];
              return (
                <Fragment key={s.id}>
                  <tr className={open ? 'sel' : ''}>
                    <td className="guest"><b>{s.name}</b><span>{s.role} · {s.shift} shift</span></td>
                    <td>{s.phone ? <a href={`tel:${s.phone}`}>{s.phone}</a> : '—'}</td>
                    <td className="rt num amt">{money(s.salary)}<span className="sub">per month</span></td>
                    <td>{m ? <Pill tone={TONE[m]}>{markLabel(m)}</Pill> : <Pill tone="n">Not marked</Pill>}</td>
                    <td className="rt acts">
                      <button className="btn sm" aria-expanded={open} onClick={() => setOpenId(open ? null : s.id)}>
                        Attendance history {open ? '▴' : '▾'}
                      </button>
                      <button className="btn sm" onClick={() => openSheet('editStaff', { id: s.id })}>Edit</button>
                      {isAdmin && <button className="btn sm del" onClick={() => remove(s)}>Delete</button>}
                    </td>
                  </tr>
                  {open && (
                    <tr className="hist-row"><td colSpan={5}><StaffHistory staff={s} today={today} /></td></tr>
                  )}
                </Fragment>
              );
            }) : (
              <tr><td colSpan={5} className="empty">{staff.length ? 'No staff matches your search.' : 'No staff added yet.'}</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {!isAdmin && <p style={{ fontSize: 11.5, color: 'var(--muted)', margin: '8px 0 0' }}>Only an admin can delete a staff member.</p>}
    </Sheet>
  );
}

/* ----------------------------------------------------------- add / edit staff */

const ROLES = ['Manager', 'Front desk', 'Housekeeping', 'Kitchen', 'Waiter', 'Security', 'Maintenance', 'Other'];
const SHIFTS = ['Morning', 'Evening', 'Night', 'General'];

function StaffForm({ title, initial, submitLabel, onSubmit }) {
  const [form, setForm] = useState(initial);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  return (
    <Sheet title={title} footer={<button className="btn p" onClick={() => onSubmit(form)}>{submitLabel}</button>}>
      <Field label="Full name" value={form.name} onChange={set('name')} />
      <Row2>
        <Field as="select" label="Role" value={form.role} onChange={set('role')}>
          {[...new Set([...ROLES, form.role].filter(Boolean))].map((r) => <option key={r}>{r}</option>)}
        </Field>
        <Field as="select" label="Shift" value={form.shift} onChange={set('shift')}>
          {[...new Set([...SHIFTS, form.shift].filter(Boolean))].map((r) => <option key={r}>{r}</option>)}
        </Field>
      </Row2>
      <Row2>
        <Field label="Phone" type="tel" value={form.phone} onChange={set('phone')} />
        <Field label="Monthly salary (₹)" type="number" value={form.salary} onChange={set('salary')} />
      </Row2>
    </Sheet>
  );
}

export function AddStaffSheet() {
  const { actions } = useHotel();
  return (
    <StaffForm
      title="Add staff" submitLabel="Save staff" onSubmit={actions.addStaff}
      initial={{ name: '', role: 'Housekeeping', shift: 'Morning', phone: '', salary: '' }}
    />
  );
}

export function EditStaffSheet({ id }) {
  const { db, actions } = useHotel();
  const s = db.staff.find((x) => x.id === id);
  if (!s) return null;
  return (
    <StaffForm
      title={`Edit — ${s.name}`} submitLabel="Save changes" onSubmit={(form) => actions.updateStaff(id, form)}
      initial={{ name: s.name, role: s.role, shift: s.shift, phone: s.phone, salary: String(s.salary) }}
    />
  );
}
