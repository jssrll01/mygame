import { useState } from 'react';
import { getMyStatus, listOrgs, applyToService, leaveService } from '../../services/justice';
import { listThreatLevels } from '../../services/intelligence';
import { useAsync, useAction, useNotice, Level, Loading, ErrorBox, Tabs, Badge, Card, Empty, Confirm, statusTone, label, fmt } from '../../components/ws/kit';
import { CLASS_LABEL } from '../../components/ws/roles';
import { Members } from '../justice/ServicePanel';
import ReportsPanel from './ReportsPanel';
import ThreatsPanel from './ThreatsPanel';
import OperationsPanel from './OperationsPanel';

function ThreatBoard() {
  const q = useAsync(listThreatLevels, []);
  return (
    <Card title="National threat levels (public)">
      {q.loading && !q.data && <Loading />}
      <ErrorBox error={q.error} onRetry={q.reload} />
      {q.data && !q.data.length && <Empty text="No countries yet." />}
      {q.data?.map((t) => (
        <div className="ws-row" key={t.country_id}>
          <div className="main"><b>{t.countries?.name || t.country_id.slice(0, 8)}</b><span className="meta">{t.reason} · {fmt(t.updated_at)}</span></div>
          <Level n={t.level} />
        </div>))}
    </Card>);
}

function Apply({ status, reload, notify }) {
  const q = useAsync(async () => (await listOrgs(['intel_agency'])), []);
  const [busy, run] = useAction(notify, reload);
  const pending = status.memberships.find((m) => m.kind === 'intel_agency' && m.status !== 'active');
  const other = status.memberships.some((m) => m.kind !== 'intel_agency' && m.status !== 'left');
  return (
    <Card title="Join an intelligence agency">
      <p className="ws-sub">Recruits start as analysts. Directors grant higher roles and clearances; a Top Secret clearance is level 4.</p>
      {pending && <p><Badge tone={statusTone(pending.status)}>{pending.status}</Badge> {pending.org_name}</p>}
      {other && <p className="ws-sub">Leave your current justice service before applying.</p>}
      {q.loading && <Loading />}
      {(q.data || []).map((a) => (
        <div className="ws-row" key={a.id}>
          <div className="main"><b>{a.name}</b><span className="meta">reputation {a.reputation}</span></div>
          <button className="ws-btn sm" disabled={busy || !!pending || other || status.imprisoned}
            onClick={() => run(() => applyToService(a.id, 'analyst'), 'Application sent')}>Apply as analyst</button>
        </div>))}
    </Card>);
}

export default function IntelligencePage() {
  const [tab, setTab] = useState('board');
  const [toast, notify] = useNotice();
  const st = useAsync(getMyStatus, []);
  const [leaving, setLeaving] = useState(false);
  const [busy, run] = useAction(notify, st.reload);

  if (st.loading && !st.data) return <div className="ws-page"><Loading text="Connecting to secure network…" /></div>;
  if (st.error && !st.data) return <div className="ws-page"><ErrorBox error={st.error} onRetry={st.reload} /></div>;
  const status = st.data;
  const member = status.memberships.find((m) => m.kind === 'intel_agency' && m.status === 'active');
  const ctx = { status, member, reload: st.reload, notify };
  const tabs = [{ id: 'board', label: 'Threat Board' }];
  if (member) tabs.push({ id: 'reports', label: 'Reports' }, { id: 'threats', label: 'Assessments' }, { id: 'ops', label: 'Operations' });
  if (member && (member.is_head || status.is_admin)) tabs.push({ id: 'people', label: 'Personnel' });
  tabs.push({ id: 'join', label: member ? 'Service' : 'Join' });

  return (
    <div className="ws-page">
      <div className="ws-head">
        <div><h1>Intelligence</h1>
          <p className="ws-sub">{member ? member.org_name + ' · ' + label(member.role) + ' · clearance ' + member.clearance + ' (' + CLASS_LABEL[member.clearance] + ')' : 'Classified material is visible only to cleared agency members.'}</p></div>
        {status.imprisoned && <Badge tone="red">In custody</Badge>}
      </div>
      <Tabs tabs={tabs} value={tabs.some((t) => t.id === tab) ? tab : 'board'} onChange={setTab} />
      {tab === 'board' && <ThreatBoard />}
      {tab === 'reports' && member && <ReportsPanel {...ctx} />}
      {tab === 'threats' && member && <ThreatsPanel {...ctx} />}
      {tab === 'ops' && member && <OperationsPanel {...ctx} />}
      {tab === 'people' && member && <Members org={{ id: member.org_id, kind: 'intel_agency', name: member.org_name }} status={status} notify={notify} reload={st.reload} />}
      {tab === 'join' && (member
        ? <Card title="Your service"><p>{member.org_name} · {label(member.role)}</p>
            <button className="ws-btn ghost" disabled={busy} onClick={() => setLeaving(true)}>Leave agency</button></Card>
        : <Apply status={status} reload={st.reload} notify={notify} />)}
      {leaving && <Confirm title="Leave agency?" message="You lose your clearance immediately." confirmLabel="Leave" danger onCancel={() => setLeaving(false)}
        onConfirm={async () => { setLeaving(false); await run(leaveService, 'You left the agency'); }} />}
      {toast}
    </div>);
}
