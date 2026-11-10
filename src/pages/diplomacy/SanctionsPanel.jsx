import { useState } from 'react';
import { listSanctions, listCountries, listAid, imposeSanction, liftSanction, sendAid } from '../../services/diplomacy';
import { listOutbreaks } from '../../services/research';
import { useAsync, useAction, Card, Empty, Loading, ErrorBox, Badge, Level, Modal, Field, statusTone, label, timeLeft, fmt } from '../../components/ws/kit';
import { money } from '../../components/ws/gameUtil';

function Impose({ member, countries, notify, onClose, onDone }) {
  const [f, setF] = useState({ target: '', kind: 'trade', severity: 2, hours: 24, reason: '' });
  const [busy, run] = useAction(notify);
  return (
    <Modal title="Impose sanction" onClose={onClose}>
      <form onSubmit={async (e) => {
        e.preventDefault();
        if (await run(() => imposeSanction({ ...f, imposer: member.country_id, target: Number(f.target), severity: Number(f.severity), hours: Number(f.hours) }), 'Sanction imposed')) { await onDone(); onClose(); }
      }}>
        <Field label="Target country"><select required value={f.target} onChange={(e) => setF({ ...f, target: e.target.value })}>
          <option value="">Choose…</option>{countries.filter((c) => c.id !== member.country_id).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
        <Field label="Type"><select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>{['trade', 'financial', 'travel', 'arms'].map((k) => <option key={k} value={k}>{label(k)}</option>)}</select></Field>
        <Field label="Severity (1-5)"><select value={f.severity} onChange={(e) => setF({ ...f, severity: e.target.value })}>{[1, 2, 3, 4, 5].map((n) => <option key={n}>{n}</option>)}</select></Field>
        <Field label="Duration (hours, 1-168)"><input type="number" min="1" max="168" value={f.hours} onChange={(e) => setF({ ...f, hours: e.target.value })} /></Field>
        <Field label="Reason (10+ characters)"><textarea required minLength={10} maxLength={1000} value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} /></Field>
        <p className="ws-sub">Sanctions damage relations and cut trade. You cannot sanction an ally.</p>
        <button className="ws-btn danger" disabled={busy || !f.target}>Impose</button>
      </form>
    </Modal>);
}

function Aid({ member, countries, outbreaks, notify, onClose, onDone }) {
  const [f, setF] = useState({ to: '', kind: 'medical', amount: 1000, outbreak: '', note: '' });
  const [busy, run] = useAction(notify);
  const obs = outbreaks.filter((o) => String(o.country_id) === String(f.to));
  return (
    <Modal title="Send humanitarian aid" onClose={onClose}>
      <form onSubmit={async (e) => {
        e.preventDefault();
        if (await run(() => sendAid({ ...f, from: member.country_id, to: Number(f.to), amount: Number(f.amount), outbreak: f.kind === 'medical' ? f.outbreak : '' }), 'Aid sent')) { await onDone(); onClose(); }
      }}>
        <Field label="Receiving country"><select required value={f.to} onChange={(e) => setF({ ...f, to: e.target.value, outbreak: '' })}>
          <option value="">Choose…</option>{countries.filter((c) => c.id !== member.country_id).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
        <Field label="Type"><select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>{['medical', 'food', 'shelter', 'funds'].map((k) => <option key={k} value={k}>{label(k)}</option>)}</select></Field>
        {f.kind === 'medical' && !!obs.length && (
          <Field label="Target an outbreak (optional)"><select value={f.outbreak} onChange={(e) => setF({ ...f, outbreak: e.target.value })}>
            <option value="">None</option>{obs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></Field>)}
        <Field label={'Amount (min 100, ministry budget ' + money(member.budget) + ')'}><input type="number" min="100" required value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></Field>
        <Field label="Note"><input maxLength={500} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></Field>
        <p className="ws-sub">Aid improves relations. Medical aid aimed at an outbreak boosts its response.</p>
        <button className="ws-btn" disabled={busy || !f.to}>Send aid</button>
      </form>
    </Modal>);
}

export default function SanctionsPanel({ member, notify }) {
  const q = useAsync(async () => {
    const [rows, countries, aid, outbreaks] = await Promise.all([listSanctions(), listCountries(), listAid(), listOutbreaks()]);
    return { rows, countries, aid, outbreaks, cn: Object.fromEntries(countries.map((c) => [c.id, c.name])) };
  }, []);
  const [busy, run] = useAction(notify, q.reload);
  const [modal, setModal] = useState(null);
  const my = member.country_id;
  const isMin = member.role === 'foreign_minister';

  return (
    <>
      <Card title="Sanctions" right={isMin && <button className="ws-btn sm" onClick={() => setModal('sanction')}>Impose sanction</button>}>
        {q.loading && !q.data && <Loading />}
        <ErrorBox error={q.error} onRetry={q.reload} />
        {q.data && !q.data.rows.length && <Empty text="No sanctions on record." />}
        {q.data?.rows.map((s) => (
          <div className="ws-row" key={s.id}>
            <div className="main"><b>{q.data.cn[s.imposing_country_id]} → {q.data.cn[s.target_country_id]}</b>
              <span className="meta">{label(s.kind)} · {s.status === 'active' ? 'ends in ' + timeLeft(s.ends_at) : s.status}</span>
              <span className="meta">{s.reason}</span></div>
            <div className="ws-actions"><Level n={s.severity} /><Badge tone={statusTone(s.status)}>{s.status}</Badge>
              {isMin && s.status === 'active' && s.imposing_country_id === my && (
                <button className="ws-btn ghost sm" disabled={busy} onClick={() => run(() => liftSanction(s.id), 'Sanction lifted')}>Lift</button>)}</div>
          </div>))}
      </Card>
      <Card title="Humanitarian aid" right={isMin && <button className="ws-btn sm" onClick={() => setModal('aid')}>Send aid</button>}>
        {q.data && !q.data.aid.length && <Empty text="No aid sent yet." />}
        {q.data?.aid.map((a) => (
          <div className="ws-row" key={a.id}>
            <div className="main"><b>{q.data.cn[a.from_country_id]} → {q.data.cn[a.to_country_id]}</b>
              <span className="meta">{label(a.kind)} · {money(a.amount)} · {fmt(a.sent_at)}{a.note ? ' · ' + a.note : ''}</span></div>
          </div>))}
      </Card>
      {modal === 'sanction' && q.data && <Impose member={member} countries={q.data.countries} notify={notify} onClose={() => setModal(null)} onDone={q.reload} />}
      {modal === 'aid' && q.data && <Aid member={member} countries={q.data.countries} outbreaks={q.data.outbreaks} notify={notify} onClose={() => setModal(null)} onDone={q.reload} />}
    </>);
}
