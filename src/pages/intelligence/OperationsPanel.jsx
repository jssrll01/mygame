import { useState } from 'react';
import { listOperations, listCountries, launchOperation, cancelOperation } from '../../services/intelligence';
import { useAsync, useAction, Card, Empty, Loading, ErrorBox, Badge, Modal, Field, Confirm, statusTone, label, timeLeft } from '../../components/ws/kit';
import { CLASS_LABEL, CLASS_TONE } from '../../components/ws/roles';

const KINDS = ['analysis', 'surveillance', 'counterintelligence', 'liaison', 'assessment'];

function Launch({ member, countries, notify, onClose, onDone }) {
  const [f, setF] = useState({ codename: '', kind: 'analysis', objective: '', country: '', classification: 2, minutes: 60 });
  const [busy, run] = useAction(notify);
  const chance = Math.min(95, Math.max(10, 45 + 8 * member.clearance - 4 * Number(f.classification)));
  return (
    <Modal title="Launch operation" onClose={onClose}>
      <form onSubmit={async (e) => {
        e.preventDefault();
        const ok = await run(() => launchOperation({ ...f, agency: member.org_id, classification: Number(f.classification), minutes: Number(f.minutes) }), 'Operation launched');
        if (ok) { onDone(); onClose(); }
      }}>
        <Field label="Codename"><input required minLength={3} maxLength={40} value={f.codename} onChange={(e) => setF({ ...f, codename: e.target.value })} /></Field>
        <Field label="Type"><select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>{KINDS.map((k) => <option key={k} value={k}>{label(k)}</option>)}</select></Field>
        <Field label="Target country (optional)"><select value={f.country} onChange={(e) => setF({ ...f, country: e.target.value })}><option value="">—</option>{countries.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
        <Field label="Classification"><select value={f.classification} onChange={(e) => setF({ ...f, classification: e.target.value })}>{CLASS_LABEL.map((c, i) => <option key={c} value={i} disabled={i > member.clearance}>{c}</option>)}</select></Field>
        <Field label="Duration (minutes, 15-1440)"><input type="number" min="15" max="1440" value={f.minutes} onChange={(e) => setF({ ...f, minutes: e.target.value })} /></Field>
        <Field label="Objective (10+ characters)"><textarea required minLength={10} maxLength={1000} value={f.objective} onChange={(e) => setF({ ...f, objective: e.target.value })} /></Field>
        <p className="ws-sub">Estimated success chance: {chance}%. Outcomes are resolved by the server when time is up, even if you are offline.</p>
        <button className="ws-btn" disabled={busy}>Launch</button>
      </form>
    </Modal>);
}

export default function OperationsPanel({ status, member, notify }) {
  const q = useAsync(async () => {
    const [rows, countries] = await Promise.all([listOperations(member.org_id), listCountries()]);
    return { rows, countries };
  }, [member.org_id]);
  const [busy, run] = useAction(notify, q.reload);
  const [launching, setLaunching] = useState(false);
  const [cancel, setCancel] = useState(null);
  const can = ['intel_officer', 'director'].includes(member.role) && member.clearance >= 2 && !status.imprisoned;

  return (
    <Card title="Operations" right={can && <button className="ws-btn sm" onClick={() => setLaunching(true)}>Launch operation</button>}>
      {q.loading && !q.data && <Loading />}
      <ErrorBox error={q.error} onRetry={q.reload} />
      {q.data && !q.data.rows.length && <Empty text="No operations at your clearance level." />}
      {q.data?.rows.map((o) => (
        <div className="ws-row" key={o.id}>
          <div className="main"><b>{o.codename}</b>
            <span className="meta">{label(o.kind)} · {o.status === 'active' ? 'ends in ' + timeLeft(o.ends_at) + ' · ' + o.success_chance + '% est.' : o.outcome}</span></div>
          <div className="ws-actions"><Badge tone={CLASS_TONE[o.classification]}>{CLASS_LABEL[o.classification]}</Badge>
            <Badge tone={statusTone(o.status)}>{o.status}</Badge>
            {o.status === 'active' && (o.lead_id === status.user_id || member.role === 'director') && (
              <button className="ws-btn ghost sm" disabled={busy} onClick={() => setCancel(o)}>Cancel</button>)}</div>
        </div>))}
      {launching && q.data && <Launch member={member} countries={q.data.countries} notify={notify} onClose={() => setLaunching(false)} onDone={q.reload} />}
      {cancel && <Confirm title="Cancel operation?" message={'Cancel ' + cancel.codename + '? It will be marked cancelled with no result.'} confirmLabel="Cancel operation" danger
        onCancel={() => setCancel(null)} onConfirm={async () => { const o = cancel; setCancel(null); await run(() => cancelOperation(o.id), 'Operation cancelled'); }} />}
    </Card>);
}
