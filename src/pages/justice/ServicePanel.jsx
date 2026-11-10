import { useState } from 'react';
import { listOrgs, listMembers, applyToService, leaveService, manageMember } from '../../services/justice';
import { namesFor } from '../../services/wsClient';
import { useAsync, useAction, Card, Empty, Loading, ErrorBox, Badge, Confirm, statusTone, label } from '../../components/ws/kit';
import { ROLES, ENTRY_ROLE, KIND_LABEL, HEAD_ROLES } from '../../components/ws/roles';

function MemberRow({ m, kind, name, isAdmin, notify, reload }) {
  const [role, setRole] = useState(m.role);
  const [status, setStatus] = useState(m.status);
  const [clearance, setClearance] = useState(m.clearance);
  const [busy, run] = useAction(notify, reload);
  const roles = ROLES[kind].filter((r) => isAdmin || !HEAD_ROLES.includes(r) || r === m.role);
  return (
    <div className="ws-row">
      <div className="main"><b>{name}</b><span className="meta">since {new Date(m.joined_at).toLocaleDateString()}</span></div>
      <div className="ws-actions">
        <select value={role} onChange={(e) => setRole(e.target.value)} aria-label="Role">
          {roles.map((r) => <option key={r} value={r}>{label(r)}</option>)}
        </select>
        {kind === 'intel_agency' && (
          <select value={clearance} onChange={(e) => setClearance(Number(e.target.value))} aria-label="Clearance">
            {[0, 1, 2, 3, 4].map((c) => <option key={c} value={c}>Clearance {c}</option>)}
          </select>)}
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
          {['pending', 'active', 'suspended', 'left'].filter((s) => s !== 'pending' || m.status === 'pending')
            .map((s) => <option key={s} value={s} disabled={s === 'pending'}>{s}</option>)}
        </select>
        <button className="ws-btn sm" disabled={busy || status === 'pending'}
          onClick={() => run(() => manageMember(m.id, role, clearance, status), 'Member updated')}>Save</button>
      </div>
    </div>);
}

export function Members({ org, status, notify, reload }) {
  const mem = useAsync(async () => {
    const rows = await listMembers(org.id);
    return { rows, names: await namesFor(rows.map((r) => r.user_id)) };
  }, [org.id]);
  if (mem.loading && !mem.data) return <Loading />;
  return (
    <Card title={'Members — ' + org.name}>
      <ErrorBox error={mem.error} onRetry={mem.reload} />
      {mem.data && !mem.data.rows.length && <Empty text="No members yet." />}
      {mem.data?.rows.map((m) => (
        <MemberRow key={m.id + m.status + m.role} m={m} kind={org.kind} name={mem.data.names[m.user_id]}
          isAdmin={status.is_admin} notify={notify} reload={async () => { await mem.reload(); await reload(); }} />))}
    </Card>);
}

export default function ServicePanel({ status, reload, notify }) {
  const orgs = useAsync(() => listOrgs(['police', 'prosecution', 'court', 'prison']), []);
  const [busy, run] = useAction(notify, reload);
  const [leaving, setLeaving] = useState(false);
  const current = status.memberships.find((m) => ['pending', 'active', 'suspended'].includes(m.status));
  const headOrgs = (orgs.data || []).filter((o) => o.head_id === status.user_id || status.is_admin);

  return (
    <>
      <Card title="My service record">
        {!status.memberships.length && <Empty text="You are not part of any service. Apply below." />}
        {status.memberships.map((m) => (
          <div className="ws-row" key={m.id}>
            <div className="main"><b>{m.org_name}</b><span className="meta">{label(m.role)}{m.is_head ? ' · head' : ''}</span></div>
            <Badge tone={statusTone(m.status)}>{m.status}</Badge>
          </div>))}
        {current && <button className="ws-btn ghost sm" style={{ marginTop: 8 }} onClick={() => setLeaving(true)}>Leave service</button>}
      </Card>

      {!current && (
        <Card title="Apply to a service">
          <p className="ws-sub">Entry roles are open to everyone. Detective, investigator, prosecutor, judge and chief roles are appointment-only.</p>
          {orgs.loading && <Loading />}
          <ErrorBox error={orgs.error} onRetry={orgs.reload} />
          {(orgs.data || []).map((o) => (
            <div className="ws-row" key={o.id}>
              <div className="main"><b>{o.name}</b><span className="meta">{KIND_LABEL[o.kind]}</span></div>
              {ENTRY_ROLE[o.kind]
                ? <button className="ws-btn sm" disabled={busy || status.imprisoned}
                    onClick={() => run(() => applyToService(o.id, ENTRY_ROLE[o.kind]), 'Application sent')}>Apply as {label(ENTRY_ROLE[o.kind])}</button>
                : <Badge>Appointment only</Badge>}
            </div>))}
        </Card>)}

      {headOrgs.map((o) => <Members key={o.id} org={o} status={status} notify={notify} reload={reload} />)}
      {leaving && (
        <Confirm title="Leave service?" message="You will lose your role and rank in this organisation." confirmLabel="Leave" danger
          onCancel={() => setLeaving(false)}
          onConfirm={async () => { setLeaving(false); await run(leaveService, 'You left the service'); }} />)}
    </>);
}
