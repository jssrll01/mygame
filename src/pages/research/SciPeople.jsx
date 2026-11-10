import { useState } from 'react';
import { listScienceMembers, manageScienceMember } from '../../services/research';
import { namesFor } from '../../services/wsClient';
import { useAsync, useAction, Card, Empty, Loading, ErrorBox, Badge, statusTone, label } from '../../components/ws/kit';
import { SCI_ROLES, SCI_HEADS } from '../../components/ws/gameUtil';

function Row({ m, name, org, isAdmin, selfId, notify, reload }) {
  const [role, setRole] = useState(m.role);
  const [st, setSt] = useState(m.status === 'pending' ? 'active' : m.status);
  const [busy, run] = useAction(notify, reload);
  const roles = SCI_ROLES[org.kind].filter((r) => isAdmin || !SCI_HEADS.includes(r));
  const locked = m.user_id === selfId || (SCI_HEADS.includes(m.role) && !isAdmin);
  return (
    <div className="ws-row">
      <div className="main"><b>{name}</b><span className="meta">{label(m.role)} · <Badge tone={statusTone(m.status)}>{m.status}</Badge></span></div>
      <div className="ws-actions">
        <select disabled={locked} value={role} onChange={(e) => setRole(e.target.value)}>
          {(roles.includes(role) ? roles : [role, ...roles]).map((r) => <option key={r} value={r}>{label(r)}</option>)}
        </select>
        <select disabled={locked} value={st} onChange={(e) => setSt(e.target.value)}>
          {['active', 'suspended', 'left'].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <button className="ws-btn sm" disabled={busy || locked}
          onClick={() => run(() => manageScienceMember(m.id, role, st), 'Member updated')}>Save</button>
      </div>
    </div>);
}

export default function SciPeople({ org, status, notify }) {
  const q = useAsync(async () => {
    const rows = await listScienceMembers(org.id);
    return { rows, names: await namesFor(rows.map((r) => r.user_id)) };
  }, [org.id]);
  return (
    <Card title="Personnel">
      {q.loading && !q.data && <Loading />}
      <ErrorBox error={q.error} onRetry={q.reload} />
      {q.data && !q.data.rows.length && <Empty text="No members yet." />}
      {q.data?.rows.map((m) => (
        <Row key={m.id} m={m} name={q.data.names[m.user_id]} org={org} isAdmin={status.is_admin}
          selfId={status.user_id} notify={notify} reload={q.reload} />))}
      <p className="ws-sub">Head roles can only be appointed by an administrator. Pending applicants are approved by saving them as active.</p>
    </Card>);
}
