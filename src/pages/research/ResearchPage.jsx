import { useState } from 'react';
import { getMyScience, listScienceOrgs, listCountries, listHealthCountries, listOutbreaks, applyToScienceOrg, leaveScienceOrg,
  adminAppointScience, adminFundScienceOrg, adminTriggerOutbreak } from '../../services/research';
import { searchPlayers } from '../../services/justice';
import { useAsync, useAction, useNotice, Level, Loading, ErrorBox, Tabs, Badge, Card, Empty, Confirm, Field, statusTone, label, fmt } from '../../components/ws/kit';
import { SCI_ROLES, SCI_APPLY, KIND_LABEL, money } from '../../components/ws/gameUtil';
import TechPanel from './TechPanel';
import HealthPanel from './HealthPanel';
import SciPeople from './SciPeople';

function Board() {
  const q = useAsync(async () => {
    const [hc, ob] = await Promise.all([listHealthCountries(), listOutbreaks()]);
    return { hc, ob };
  }, []);
  return (
    <>
      <Card title="Active outbreaks (fictional simulation)">
        {q.loading && !q.data && <Loading />}
        <ErrorBox error={q.error} onRetry={q.reload} />
        {q.data && !q.data.ob.length && <Empty text="No active outbreaks." />}
        {q.data?.ob.map((o) => (
          <div className="ws-row" key={o.id}>
            <div className="main"><b>{o.name} · {o.countries?.name}</b>
              <span className="meta">{Number(o.infected_pct).toFixed(2)}% infected · started {fmt(o.started_at)}</span></div>
            <Level n={o.severity} />
          </div>))}
      </Card>
      <Card title="National health index">
        {q.data && !q.data.hc.length && <Empty text="No countries yet." />}
        {q.data?.hc.map((h) => (
          <div className="ws-row" key={h.country_id}>
            <div className="main"><b>{h.countries?.name}</b><span className="meta">Quarantine level {h.quarantine_level}</span></div>
            <Badge tone={h.health_index >= 70 ? 'green' : h.health_index >= 40 ? 'amber' : 'red'}>{Number(h.health_index).toFixed(1)}</Badge>
          </div>))}
      </Card>
    </>);
}

function Apply({ status, reload, notify }) {
  const q = useAsync(async () => {
    const [orgs, countries] = await Promise.all([listScienceOrgs(), listCountries()]);
    return { orgs, countries };
  }, []);
  const [country, setCountry] = useState('');
  const [busy, run] = useAction(notify, reload);
  const pending = status.memberships.find((m) => m.status !== 'active');
  return (
    <Card title="Join a research or health institution">
      <p className="ws-sub">Recruits start as lab researchers, doctors or public health officers. Directors grant higher roles.</p>
      {pending && <p><Badge tone={statusTone(pending.status)}>{pending.status}</Badge> {pending.org_name}</p>}
      {q.loading && !q.data && <Loading />}
      <ErrorBox error={q.error} onRetry={q.reload} />
      {q.data && (
        <>
          <Field label="Country"><select value={country} onChange={(e) => setCountry(e.target.value)}>
            <option value="">Choose…</option>{q.data.countries.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
          {country && q.data.orgs.filter((o) => String(o.country_id) === country).map((o) => (
            <div className="ws-row" key={o.id}>
              <div className="main"><b>{o.name}</b><span className="meta">{KIND_LABEL[o.kind]} · reputation {o.reputation}</span></div>
              <button className="ws-btn sm" disabled={busy || !!pending}
                onClick={() => run(() => applyToScienceOrg(o.id, SCI_APPLY[o.kind]), 'Application sent')}>Apply as {label(SCI_APPLY[o.kind])}</button>
            </div>))}
        </>)}
    </Card>);
}

function Admin({ notify }) {
  const q = useAsync(async () => {
    const [orgs, countries] = await Promise.all([listScienceOrgs(), listCountries()]);
    return { orgs, countries };
  }, []);
  const [busy, run] = useAction(notify, q.reload);
  const [fund, setFund] = useState({ country: '', org: '', amount: '10000' });
  const [ob, setOb] = useState({ country: '', name: '', sev: 2 });
  const [ap, setAp] = useState({ country: '', org: '', role: '', user: '', head: false, query: '' });
  const [found, setFound] = useState([]);
  if (!q.data) return <Loading />;
  const orgsIn = (c) => q.data.orgs.filter((o) => String(o.country_id) === String(c));
  const apOrg = q.data.orgs.find((o) => o.id === ap.org);
  const countrySel = (v, fn) => (
    <select value={v} onChange={(e) => fn(e.target.value)}><option value="">Country…</option>
      {q.data.countries.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>);
  return (
    <>
      <Card title="Fund an organisation">
        <Field label="Country">{countrySel(fund.country, (v) => setFund({ ...fund, country: v, org: '' }))}</Field>
        <Field label="Organisation"><select value={fund.org} onChange={(e) => setFund({ ...fund, org: e.target.value })}>
          <option value="">Choose…</option>{orgsIn(fund.country).map((o) => <option key={o.id} value={o.id}>{o.name} ({money(o.budget)})</option>)}</select></Field>
        <Field label="Amount"><input type="number" min="1" value={fund.amount} onChange={(e) => setFund({ ...fund, amount: e.target.value })} /></Field>
        <button className="ws-btn" disabled={busy || !fund.org} onClick={() => run(() => adminFundScienceOrg(fund.org, Number(fund.amount)), 'Organisation funded')}>Fund</button>
      </Card>
      <Card title="Appoint a member">
        <Field label="Country">{countrySel(ap.country, (v) => setAp({ ...ap, country: v, org: '', role: '' }))}</Field>
        <Field label="Organisation"><select value={ap.org} onChange={(e) => setAp({ ...ap, org: e.target.value, role: '' })}>
          <option value="">Choose…</option>{orgsIn(ap.country).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></Field>
        {apOrg && <Field label="Role"><select value={ap.role} onChange={(e) => setAp({ ...ap, role: e.target.value })}>
          <option value="">Choose…</option>{SCI_ROLES[apOrg.kind].map((r) => <option key={r} value={r}>{label(r)}</option>)}</select></Field>}
        <Field label="Find player"><input value={ap.query} onChange={(e) => setAp({ ...ap, query: e.target.value })} placeholder="username (2+ letters)" /></Field>
        <button className="ws-btn ghost sm" disabled={busy || ap.query.length < 2} onClick={() => run(async () => setFound(await searchPlayers(ap.query)), 'Search done')}>Search</button>
        {!!found.length && <Field label="Player"><select value={ap.user} onChange={(e) => setAp({ ...ap, user: e.target.value })}>
          <option value="">Choose…</option>{found.map((p) => <option key={p.id} value={p.id}>{p.display_name || p.username}</option>)}</select></Field>}
        <label className="ws-sub"><input type="checkbox" checked={ap.head} onChange={(e) => setAp({ ...ap, head: e.target.checked })} /> Make head of organisation</label>
        <div><button className="ws-btn" disabled={busy || !ap.org || !ap.role || !ap.user}
          onClick={() => run(() => adminAppointScience(ap.org, ap.user, ap.role, ap.head), 'Member appointed')}>Appoint</button></div>
      </Card>
      <Card title="Trigger an outbreak (fictional)">
        <Field label="Country">{countrySel(ob.country, (v) => setOb({ ...ob, country: v }))}</Field>
        <Field label="Name"><input minLength={3} value={ob.name} onChange={(e) => setOb({ ...ob, name: e.target.value })} /></Field>
        <Field label="Severity (1-5)"><select value={ob.sev} onChange={(e) => setOb({ ...ob, sev: e.target.value })}>{[1, 2, 3, 4, 5].map((n) => <option key={n}>{n}</option>)}</select></Field>
        <button className="ws-btn danger" disabled={busy || !ob.country || ob.name.length < 3}
          onClick={() => run(() => adminTriggerOutbreak(Number(ob.country), ob.name, Number(ob.sev)), 'Outbreak started')}>Trigger</button>
      </Card>
    </>);
}

export default function ResearchPage() {
  const [tab, setTab] = useState('board');
  const [toast, notify] = useNotice();
  const st = useAsync(getMyScience, []);
  const [leaving, setLeaving] = useState(false);
  const [busy, run] = useAction(notify, st.reload);

  if (st.loading && !st.data) return <div className="ws-page"><Loading text="Loading research network…" /></div>;
  if (st.error && !st.data) return <div className="ws-page"><ErrorBox error={st.error} onRetry={st.reload} /></div>;
  const status = st.data;
  const member = status.memberships.find((m) => m.status === 'active');
  const ctx = { status, member, reload: st.reload, notify };
  const tabs = [{ id: 'board', label: 'Health Board' }];
  if (member?.kind === 'research_institute') tabs.push({ id: 'tech', label: 'Research' });
  if (member) tabs.push({ id: 'health', label: 'Health Response' });
  if (member && (member.is_head || status.is_admin)) tabs.push({ id: 'people', label: 'Personnel' });
  if (status.is_admin) tabs.push({ id: 'admin', label: 'Admin' });
  tabs.push({ id: 'join', label: member ? 'Service' : 'Join' });
  const cur = tabs.some((t) => t.id === tab) ? tab : 'board';

  return (
    <div className="ws-page">
      <div className="ws-head">
        <div><h1>Research &amp; Health</h1>
          <p className="ws-sub">{member ? member.org_name + ' · ' + label(member.role) + ' · budget ' + money(member.budget) : 'Join an institute, hospital or health agency to take part.'}</p></div>
      </div>
      <Tabs tabs={tabs} value={cur} onChange={setTab} />
      {cur === 'board' && <Board />}
      {cur === 'tech' && member && <TechPanel {...ctx} />}
      {cur === 'health' && member && <HealthPanel {...ctx} />}
      {cur === 'people' && member && <SciPeople org={{ id: member.org_id, kind: member.kind, name: member.org_name }} status={status} notify={notify} />}
      {cur === 'admin' && status.is_admin && <Admin notify={notify} />}
      {cur === 'join' && (member
        ? <Card title="Your service"><p>{member.org_name} · {label(member.role)}</p>
            <button className="ws-btn ghost" disabled={busy} onClick={() => setLeaving(true)}>Leave institution</button></Card>
        : <Apply status={status} reload={st.reload} notify={notify} />)}
      {leaving && <Confirm title="Leave institution?" message="You must cancel your projects first." confirmLabel="Leave" danger onCancel={() => setLeaving(false)}
        onConfirm={async () => { setLeaving(false); await run(leaveScienceOrg, 'You left the institution'); }} />}
      {toast}
    </div>);
}
