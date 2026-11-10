import { useState } from 'react';
import { listWarrants, decideWarrant, executeArrest } from '../../services/justice';
import { namesFor } from '../../services/wsClient';
import { useAsync, useAction, Card, Empty, Loading, ErrorBox, Badge, Modal, Field, Confirm, statusTone, label, fmt, timeLeft } from '../../components/ws/kit';
import { roleHelper } from '../../components/ws/roles';

export default function WarrantsPanel({ status, notify }) {
  const q = useAsync(async () => {
    const rows = await listWarrants();
    return { rows, names: await namesFor(rows.map((r) => r.target_user_id)) };
  }, []);
  const [busy, run] = useAction(notify, q.reload);
  const [deciding, setDeciding] = useState(null);
  const [note, setNote] = useState('');
  const [arrest, setArrest] = useState(null);
  const court = roleHelper(status, ['court']);
  const police = roleHelper(status, ['police']);
  const isJudge = court.has('judge', 'chief_judge');
  const canArrest = police.has('police_officer', 'detective', 'investigator', 'police_chief');

  return (
    <Card title="Warrants">
      {q.loading && !q.data && <Loading />}
      <ErrorBox error={q.error} onRetry={q.reload} />
      {q.data && !q.data.rows.length && <Empty text="No warrants." />}
      {q.data?.rows.map((w) => (
        <div className="ws-row" key={w.id}>
          <div className="main"><b>{label(w.kind)} · {q.data.names[w.target_user_id]}</b>
            <span className="meta">{w.status === 'requested' || w.status === 'granted' ? 'expires in ' + timeLeft(w.expires_at) : fmt(w.decided_at || w.requested_at)}</span>
            {isJudge && w.status === 'requested' && <span className="meta">{w.justification}</span>}</div>
          <div className="ws-actions">
            <Badge tone={statusTone(w.status)}>{w.status}</Badge>
            {isJudge && w.status === 'requested' && (<>
              <button className="ws-btn ok sm" disabled={busy} onClick={() => run(() => decideWarrant(w.id, true, ''), 'Warrant granted')}>Grant</button>
              <button className="ws-btn danger sm" disabled={busy} onClick={() => { setNote(''); setDeciding(w); }}>Deny</button></>)}
            {canArrest && w.kind === 'arrest' && w.status === 'granted' && (
              <button className="ws-btn danger sm" disabled={busy} onClick={() => setArrest(w)}>Execute arrest</button>)}
          </div>
        </div>))}
      {deciding && (
        <Modal title="Deny warrant" onClose={() => setDeciding(null)}>
          <Field label="Reason (10+ characters)"><textarea value={note} onChange={(e) => setNote(e.target.value)} /></Field>
          <button className="ws-btn danger" disabled={busy || note.trim().length < 10}
            onClick={async () => { const w = deciding; setDeciding(null); await run(() => decideWarrant(w.id, false, note), 'Warrant denied'); }}>Deny</button>
        </Modal>)}
      {arrest && (
        <Confirm title="Execute arrest?" message="The suspect will be held. Charges must be filed within 48 hours or they are released." danger confirmLabel="Arrest"
          onCancel={() => setArrest(null)} onConfirm={async () => { const w = arrest; setArrest(null); await run(() => executeArrest(w.id), 'Suspect arrested'); }} />)}
    </Card>);
}
