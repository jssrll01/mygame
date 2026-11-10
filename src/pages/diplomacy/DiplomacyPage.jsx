import { useState } from 'react';
import { getMyDiplomacy, listCountries, listRelations, listDipMembers, applyToDiplomaticService, leaveDiplomaticService,
  manageDipMember, adminAppointDiplomat, adminFundMinistry } from '../../services/diplomacy';
import { searchPlayers } from '../../services/justice';
import { namesFor } from '../../services/wsClient';
import { useAsync, useAction, useNotice, Loading, ErrorBox, Tabs, Badge, Card, Empty, Confirm, Field, statusTone, label } from '../../components/ws/kit';
import { DIP_ROLES, REL_TONE, money } from '../../components/ws/gameUtil';
import TreatiesPanel from './TreatiesPanel';
import EmbassiesPanel from './EmbassiesPanel';
import SanctionsPanel from './SanctionsPanel';
import TalksPanel from './TalksPanel';

function Relations({ member }) {
  const q = useAsync(listCountries, []);
  const [pick, setPick] = useState('');
  const country = Number(pick || member?.country_id || q.data?.[0]?.id || 0);
  const rel = useAsync(async () => (country ? listRelations(country) : []), [country]);
  const cn = Object.fromEntries((q.data || []).map((c) => [c.id, c.name]));
  return (
    <Card title="Relations">
      {q.loading && !q.data && <Loading />}
      <ErrorBox error={q.error || rel.error} onRetry={rel.reload} />
      {q.data && (
        <Field label="Country"><select value={country} onChange={(e) => setPick(e.target.value)}>
          {q.data.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>)}
      {rel.data && !rel.data.length && <Empty text="No relations recorded." />}
      {rel.data?.map((r) => {
        const other = r.country_a === country ? r.country_b : r.country_a;
        return (
          <div className="ws-row" key={r.country_a + '-' + r.country_b}>
            <div className="main"><b>{cn[other]}</b><span className="meta">score {r.score} · trade index {Number(r.trade_index).toFixed(1)}</span></div>
            <Badge tone={REL_TONE[r.status]}>{label(r.status)}</Badge>
          </div>);
      })}
    </Card>);
}

function Apply({ status, reload, notify }) {
  const q = useAsync(listCountries, []);
  const [country, setCountry] = useState('');
  const [busy, run] = useAction(notify, reload);
  const pending = status.memberships.find((m) => m.status !== 'active');
  return (
    <Card title="Join a diplomatic service">
      <p className="ws-sub">Recruits start as diplomats. The foreign minister grants ambassador and negotiator roles.</p>
      {pending && <p><Badge tone={statusTone(pending.status)}>{pending.status}</Badge> {pending.country_name}</p>}
      {q.loading && <Loading />}
      {q.data && (
        <>
          <Field label="Country"><select value={country} onChange={(e) => setCountry(e.target.value)}>
            <option value="">Choose…</option>{q.data.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
          <button className="ws-btn" disabled={busy || !country || !!pending}
            onClick={() => run(() => applyToDiplomaticService(Number(country)), 'Application sent')}>Apply as diplomat</button>
        </>)}
    </Card>);
}

function PersonRow({ m, name, isAdmin, selfId, notify, reload }) {
  const [role, setRole] = useState(m.role);
  const [st, setSt] = useState(m.status === 'pending' ? 'active' : m.status);
  const [busy, run] = useAction(notify, reload);
  const roles = DIP_ROLES.filter((r) => isAdmin || r !== 'foreign_minister');
  const locked = m.user_id === selfId || (m.role === 'foreign_minister' && !isAdmin);
  return (
    <div className="ws-row">
      <div className="main"><b>{name}</b><span className="meta">{label(m.role)} · <Badge tone={statusTone(m.status)}>{m.status}</Badge></span></div>
      <div className="ws-actions">
        <select disabled={locked} value={role} onChange={(e) => setRole(e.target.value)}>
          {(roles.includes(role) ? roles : [role, ...roles]).map((r) => <option key={r} value={r}>{label(r)}</option>)}</select>
        <select disabled={locked} value={st} onChange={(e) => setSt(e.target.value)}>{['active', 'suspended', 'left'].map((s) => <option key={s}>{s}</option>)}</select>
        <button className="ws-btn sm" disabled={busy || locked} onClick={() => run(() => manageDipMember(m.id, role, st), 'Member updated')}>Save</button>
      </div>
    </div>);
}

function People({ member, status, notify }) {
  const q = useAsync(async () => {
    const rows = await listDipMembers(member.country_id);
    return { rows, names: await namesFor(rows.map((r) => r.user_id)) };
  }, [member.country_id]);
  return (
    <Card title="Foreign ministry staff">
      {q.loading && !q.data && <Loading />}
      <ErrorBox error={q.error} onRetry={q.reload} />
      {q.data && !q.data.rows.length && <Empty text="No staff." />}
      {q.data?.rows.map((m) => <PersonRow key={m.id} m={m} name={q.data.names[m.user_id]} isAdmin={status.is_admin} selfId={status.user_id} notify={notify} reload={q.reload} />)}
      <p className="ws-sub">Only an administrator can appoint a foreign minister. Approve applicants by saving them as active.</p>
    </Card>);
}

function Admin({ notify }) {
  const q = useAsync(listCountries, []);
  const [busy, run] = useAction(notify);
  const [ap, setAp] = useState({ country: '', role: 'foreign_minister', user: '', head: true, query: '' });
  const [fund, setFund] = useState({ country: '', amount: '10000' });
  const [found, setFound] = useState([]);
  if (!q.data) return <Loading />;
  const sel = (v, fn) => <select value={v} onChange={(e) => fn(e.target.value)}><option value="">Country…</option>{q.data.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>;
  return (
    <>
      <Card title="Appoint a diplomat">
        <Field label="Country">{sel(ap.country, (v) => setAp({ ...ap, country: v }))}</Field>
        <Field label="Role"><select value={ap.role} onChange={(e) => setAp({ ...ap, role: e.target.value })}>{DIP_ROLES.map((r) => <option key={r} value={r}>{label(r)}</option>)}</select></Field>
        <Field label="Find player"><input value={ap.query} onChange={(e) => setAp({ ...ap, query: e.target.value })} placeholder="username (2+ letters)" /></Field>
        <button className="ws-btn ghost sm" disabled={busy || ap.query.length < 2} onClick={() => run(async () => setFound(await searchPlayers(ap.query)), 'Search done')}>Search</button>
        {!!found.length && <Field label="Player"><select value={ap.user} onChange={(e) => setAp({ ...ap, user: e.target.value })}>
          <option value="">Choose…</option>{found.map((p) => <option key={p.id} value={p.id}>{p.display_name || p.username}</option>)}</select></Field>}
        <label className="ws-sub"><input type="checkbox" checked={ap.head} onChange={(e) => setAp({ ...ap, head: e.target.checked })} /> Make head of the foreign ministry</label>
        <div><button className="ws-btn" disabled={busy || !ap.country || !ap.user}
          onClick={() => run(() => adminAppointDiplomat(Number(ap.country), ap.user, ap.role, ap.head), 'Diplomat appointed')}>Appoint</button></div>
      </Card>
      <Card title="Fund a foreign ministry">
        <Field label="Country">{sel(fund.country, (v) => setFund({ ...fund, country: v }))}</Field>
        <Field label="Amount"><input type="number" min="1" value={fund.amount} onChange={(e) => setFund({ ...fund, amount: e.target.value })} /></Field>
        <button className="ws-btn" disabled={busy || !fund.country} onClick={() => run(() => adminFundMinistry(Number(fund.country), Number(fund.amount)), 'Ministry funded')}>Fund</button>
      </Card>
    </>);
}

export default function DiplomacyPage() {
  const [tab, setTab] = useState('relations');
  const [toast, notify] = useNotice();
  const st = useAsync(getMyDiplomacy, []);
  const [leaving, setLeaving] = useState(false);
  const [busy, run] = useAction(notify, st.reload);

  if (st.loading && !st.data) return <div className="ws-page"><Loading text="Opening diplomatic channels…" /></div>;
  if (st.error && !st.data) return <div className="ws-page"><ErrorBox error={st.error} onRetry={st.reload} /></div>;
  const status = st.data;
  const member = status.memberships.find((m) => m.status === 'active');
  const tabs = [{ id: 'relations', label: 'Relations' }];
  if (member) tabs.push({ id: 'treaties', label: 'Treaties' }, { id: 'talks', label: 'Negotiations' }, { id: 'sanctions', label: 'Sanctions & Aid' }, { id: 'embassies', label: 'Embassies' });
  if (member && (member.is_head || status.is_admin)) tabs.push({ id: 'people', label: 'Staff' });
  if (status.is_admin) tabs.push({ id: 'admin', label: 'Admin' });
  tabs.push({ id: 'join', label: member ? 'Service' : 'Join' });
  const cur = tabs.some((t) => t.id === tab) ? tab : 'relations';

  return (
    <div className="ws-page">
      <div className="ws-head">
        <div><h1>Diplomacy</h1>
          <p className="ws-sub">{member ? member.country_name + ' · ' + label(member.role) + ' · ministry budget ' + money(member.budget) : 'Join a foreign ministry to act for a country.'}</p></div>
      </div>
      <Tabs tabs={tabs} value={cur} onChange={setTab} />
      {cur === 'relations' && <Relations member={member} />}
      {cur === 'treaties' && member && <TreatiesPanel member={member} notify={notify} />}
      {cur === 'talks' && member && <TalksPanel member={member} notify={notify} />}
      {cur === 'sanctions' && member && <SanctionsPanel member={member} notify={notify} />}
      {cur === 'embassies' && member && <EmbassiesPanel member={member} notify={notify} />}
      {cur === 'people' && member && <People member={member} status={status} notify={notify} />}
      {cur === 'admin' && status.is_admin && <Admin notify={notify} />}
      {cur === 'join' && (member
        ? <Card title="Your post"><p>{member.country_name} · {label(member.role)}</p>
            <button className="ws-btn ghost" disabled={busy} onClick={() => setLeaving(true)}>Leave diplomatic service</button></Card>
        : <Apply status={status} reload={st.reload} notify={notify} />)}
      {leaving && <Confirm title="Leave diplomatic service?" message="You lose your post immediately." confirmLabel="Leave" danger onCancel={() => setLeaving(false)}
        onConfirm={async () => { setLeaving(false); await run(leaveDiplomaticService, 'You left the service'); }} />}
      {toast}
    </div>);
}
