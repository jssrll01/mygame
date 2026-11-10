import { useState } from 'react';
import { listReports, listCountries, listAgencies, createReport, shareReport, retractReport } from '../../services/intelligence';
import { namesFor } from '../../services/wsClient';
import { useAsync, useAction, Card, Empty, Loading, ErrorBox, Badge, Modal, Field, statusTone, label, fmt } from '../../components/ws/kit';
import { CLASS_LABEL, CLASS_TONE } from '../../components/ws/roles';

const CATS = ['reconnaissance', 'threat_assessment', 'counterintelligence', 'liaison', 'analysis'];

function Viewer({ r, member, names, agencies, notify, onClose, onChanged }) {
  const [busy, run] = useAction(notify, onChanged);
  const [to, setTo] = useState('');
  const canAct = r.author_id === member.user_id || member.role === 'director';
  return (
    <Modal title={r.title} onClose={onClose}>
      <p><Badge tone={CLASS_TONE[r.classification]}>{CLASS_LABEL[r.classification]}</Badge> <Badge>{label(r.category)}</Badge> <Badge tone={statusTone(r.status)}>{r.status}</Badge></p>
      <p className="ws-sub">By {names[r.author_id]} · {fmt(r.created_at)}</p>
      <p className="ws-pre">{r.body}</p>
      {canAct && (
        <div className="ws-actions" style={{ marginTop: 12 }}>
          <select value={to} onChange={(e) => setTo(e.target.value)} aria-label="Share with agency">
            <option value="">Share with agency…</option>
            {agencies.filter((a) => a.id !== r.agency_id).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <button className="ws-btn sm" disabled={busy || !to} onClick={() => run(() => shareReport(r.id, to), 'Report shared')}>Share</button>
          {r.status === 'published' && <button className="ws-btn danger sm" disabled={busy} onClick={() => run(() => retractReport(r.id), 'Report retracted')}>Retract</button>}
        </div>)}
    </Modal>);
}

function Compose({ member, notify, onClose, onDone }) {
  const countries = useAsync(listCountries, []);
  const [f, setF] = useState({ title: '', body: '', category: 'analysis', classification: Math.min(1, member.clearance), country: '' });
  const [busy, run] = useAction(notify);
  return (
    <Modal title="New report" onClose={onClose}>
      <form onSubmit={async (e) => { e.preventDefault(); if (await run(() => createReport({ ...f, agency: member.org_id, classification: Number(f.classification) }), 'Report filed')) { onDone(); onClose(); } }}>
        <Field label="Title"><input required minLength={3} maxLength={140} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
        <Field label="Category"><select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{CATS.map((c) => <option key={c} value={c}>{label(c)}</option>)}</select></Field>
        <Field label="Classification"><select value={f.classification} onChange={(e) => setF({ ...f, classification: e.target.value })}>
          {CLASS_LABEL.map((c, i) => <option key={c} value={i} disabled={i > member.clearance}>{c}</option>)}</select></Field>
        <Field label="Target country (optional)"><select value={f.country} onChange={(e) => setF({ ...f, country: e.target.value })}><option value="">—</option>{(countries.data || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
        <Field label="Body"><textarea required maxLength={8000} style={{ minHeight: 160 }} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} /></Field>
        <p className="ws-sub">Keep reports fictional and in-game. Never include real-world operational detail.</p>
        <button className="ws-btn" disabled={busy}>File report</button>
      </form>
    </Modal>);
}

export default function ReportsPanel({ status, member, notify }) {
  const q = useAsync(async () => {
    const [rows, agencies] = await Promise.all([listReports(), listAgencies()]);
    return { rows, agencies, names: await namesFor(rows.map((r) => r.author_id)) };
  }, []);
  const [sel, setSel] = useState(null);
  const [composing, setComposing] = useState(false);
  const m = { ...member, user_id: status.user_id };

  return (
    <Card title="Intelligence reports" right={<button className="ws-btn sm" disabled={status.imprisoned} onClick={() => setComposing(true)}>New report</button>}>
      {q.loading && !q.data && <Loading />}
      <ErrorBox error={q.error} onRetry={q.reload} />
      {q.data && !q.data.rows.length && <Empty text="No reports at your clearance level." />}
      {q.data?.rows.map((r) => (
        <div className="ws-row" key={r.id}>
          <div className="main"><b>{r.title}</b><span className="meta">{label(r.category)} · {q.data.names[r.author_id]} · {fmt(r.created_at)}</span></div>
          <div className="ws-actions"><Badge tone={CLASS_TONE[r.classification]}>{CLASS_LABEL[r.classification]}</Badge>
            {r.status === 'retracted' && <Badge tone="red">retracted</Badge>}
            <button className="ws-btn ghost sm" onClick={() => setSel(r)}>Read</button></div>
        </div>))}
      {sel && <Viewer r={sel} member={m} names={q.data.names} agencies={q.data.agencies} notify={notify} onClose={() => setSel(null)} onChanged={async () => { setSel(null); await q.reload(); }} />}
      {composing && <Compose member={m} notify={notify} onClose={() => setComposing(false)} onDone={q.reload} />}
    </Card>);
}
