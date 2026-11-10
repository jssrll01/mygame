import { useState } from 'react';
import { listCases, getCase, prosecutorDecide, takeDefense, waiveCounsel, scheduleHearing, ruleOnEvidence,
  deliverVerdict, fileAppeal, decideAppeal, listOrgs } from '../../services/justice';
import { namesFor } from '../../services/wsClient';
import { useAsync, useAction, Card, Empty, Loading, ErrorBox, Badge, Modal, Field, Confirm, statusTone, label, fmt } from '../../components/ws/kit';
import { roleHelper } from '../../components/ws/roles';

const CAP = [0, 30, 90, 365, 1095, 3650];

function CaseDetail({ id, status, notify, onClose, onChanged }) {
  const d = useAsync(() => getCase(id), [id]);
  const prisons = useAsync(() => listOrgs(['prison']), []);
  const [busy, run] = useAction(notify, async () => { await d.reload(); onChanged(); });
  const [charge, setCharge] = useState({ text: '', severity: 2 });
  const [reason, setReason] = useState('');
  const [hearing, setHearing] = useState({ kind: 'arraignment', when: '' });
  const [verdict, setVerdict] = useState({ v: 'guilty', days: 10, prison: '' });
  const [grounds, setGrounds] = useState('');
  const [appealNote, setAppealNote] = useState('');
  const [confirm, setConfirm] = useState(null);
  const court = roleHelper(status, ['court']);
  const pros = roleHelper(status, ['prosecution']);

  if (d.loading && !d.data) return <Modal title="Case" onClose={onClose}><Loading /></Modal>;
  if (d.error && !d.data) return <Modal title="Case" onClose={onClose}><ErrorBox error={d.error} onRetry={d.reload} /></Modal>;
  const { c, hearings, events, appeal, evidence } = d.data;
  const me = status.user_id;
  const isDefendant = c.defendant_id === me;
  const isJudge = court.has('judge', 'chief_judge');
  const presiding = isJudge && c.judge_id === me;
  const trialDue = hearings.some((h) => h.kind === 'trial' && h.status === 'scheduled' && new Date(h.scheduled_at) <= new Date());
  const counsel = c.defense_attorney_id || c.counsel_waived;

  return (
    <Modal title={c.case_number} onClose={onClose}>
      <p><b>{c.charge}</b> <Badge tone={statusTone(c.status)}>{c.status}</Badge>{c.verdict && <Badge tone={c.verdict === 'guilty' ? 'red' : 'green'}>{label(c.verdict)}</Badge>}{c.overturned && <Badge tone="green">overturned</Badge>}</p>
      <p className="ws-sub">Severity {c.severity}/5 · counsel: {c.defense_attorney_id ? 'attorney assigned' : c.counsel_waived ? 'waived' : 'none yet'}{c.sentence_days ? ' · sentence ' + c.sentence_days + ' game days' : ''}</p>

      {c.status === 'prosecutor_review' && pros.has('prosecutor', 'chief_prosecutor') && !isDefendant && (
        <Card title="Prosecutor review">
          <Field label="Charge"><input value={charge.text} onChange={(e) => setCharge({ ...charge, text: e.target.value })} /></Field>
          <Field label="Severity (1-5; higher needs more evidence)"><select value={charge.severity} onChange={(e) => setCharge({ ...charge, severity: Number(e.target.value) })}>{[1, 2, 3, 4, 5].map((s) => <option key={s}>{s}</option>)}</select></Field>
          <button className="ws-btn" disabled={busy} onClick={() => run(() => prosecutorDecide(id, true, charge.text, charge.severity), 'Charges filed')}>File charges</button>
          <Field label="Or decline — reason (10+ characters)"><input value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
          <button className="ws-btn ghost" disabled={busy} onClick={() => run(() => prosecutorDecide(id, false, reason, 1), 'Declined — suspect released')}>Decline to prosecute</button>
        </Card>)}

      {c.status === 'filed' && !c.defense_attorney_id && court.has('defense_attorney') && !isDefendant && (
        <button className="ws-btn" disabled={busy} onClick={() => run(() => takeDefense(id), 'You are now defence counsel')}>Take this defence</button>)}
      {c.status === 'filed' && isDefendant && !counsel && (
        <button className="ws-btn ghost" disabled={busy} onClick={() => setConfirm('waive')}>Waive counsel (represent myself)</button>)}

      <Card title="Hearings">
        {!hearings.length && <Empty text="None scheduled." />}
        {hearings.map((h) => <div className="ws-row" key={h.id}><b>{label(h.kind)} · {fmt(h.scheduled_at)}</b><Badge tone={statusTone(h.status)}>{h.status}</Badge></div>)}
        {c.status === 'filed' && isJudge && !isDefendant && (
          <form onSubmit={(e) => { e.preventDefault(); run(() => scheduleHearing(id, hearing.kind, new Date(hearing.when).toISOString()), 'Hearing scheduled'); }}>
            <Field label="Type"><select value={hearing.kind} onChange={(e) => setHearing({ ...hearing, kind: e.target.value })}><option value="arraignment">Arraignment</option><option value="trial">Trial</option></select></Field>
            <Field label="When (your local time, 10+ minutes ahead)"><input type="datetime-local" required value={hearing.when} onChange={(e) => setHearing({ ...hearing, when: e.target.value })} /></Field>
            <button className="ws-btn" disabled={busy}>Schedule</button>
          </form>)}
      </Card>

      <Card title={'Evidence (' + evidence.length + ')'}>
        {!evidence.length && <Empty text="No evidence visible." />}
        {evidence.map((e) => (
          <div className="ws-row" key={e.id}>
            <div className="main"><b>{label(e.kind)}</b><span className="meta">{e.description}</span></div>
            <div className="ws-actions">
              <Badge>rel. {e.reliability}</Badge>
              {!e.lawfully_obtained && <Badge tone="red">no warrant</Badge>}
              <Badge tone={statusTone(e.status)}>{e.status}</Badge>
              {presiding && c.status === 'filed' && (<>
                <button className="ws-btn ok sm" disabled={busy || !e.lawfully_obtained} onClick={() => run(() => ruleOnEvidence(e.id, true), 'Evidence admitted')}>Admit</button>
                <button className="ws-btn danger sm" disabled={busy} onClick={() => run(() => ruleOnEvidence(e.id, false), 'Evidence excluded')}>Exclude</button></>)}
            </div>
          </div>))}
      </Card>

      {presiding && c.status === 'filed' && (
        <Card title="Verdict">
          {!trialDue && <p className="ws-sub">A trial hearing must be scheduled and its time reached first.</p>}
          <Field label="Verdict"><select value={verdict.v} onChange={(e) => setVerdict({ ...verdict, v: e.target.value })}><option value="guilty">Guilty</option><option value="not_guilty">Not guilty</option></select></Field>
          {verdict.v === 'guilty' && (<>
            <Field label={'Sentence in game days (max ' + CAP[c.severity] + ')'}><input type="number" min="1" max={CAP[c.severity]} value={verdict.days} onChange={(e) => setVerdict({ ...verdict, days: Number(e.target.value) })} /></Field>
            <Field label="Prison"><select value={verdict.prison} onChange={(e) => setVerdict({ ...verdict, prison: e.target.value })}><option value="">Select…</option>{(prisons.data || []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field></>)}
          <button className="ws-btn danger" disabled={busy || !trialDue || (verdict.v === 'guilty' && !verdict.prison)} onClick={() => setConfirm('verdict')}>Deliver verdict</button>
        </Card>)}

      {c.status === 'verdict' && c.verdict === 'guilty' && (isDefendant || c.defense_attorney_id === me) && (
        <Card title="Appeal (within 7 days of verdict)">
          <Field label="Grounds (30+ characters)"><textarea value={grounds} onChange={(e) => setGrounds(e.target.value)} /></Field>
          <button className="ws-btn" disabled={busy || grounds.trim().length < 30} onClick={() => run(() => fileAppeal(id, grounds), 'Appeal filed')}>File appeal</button>
        </Card>)}
      {appeal && (
        <Card title="Appeal"><p className="ws-pre">{appeal.grounds}</p><Badge tone={statusTone(appeal.status)}>{appeal.status}</Badge>{appeal.decision_note && <p className="ws-sub">{appeal.decision_note}</p>}
          {appeal.status === 'filed' && isJudge && c.judge_id !== me && !isDefendant && (<>
            <Field label="Written reasons (20+ characters)"><textarea value={appealNote} onChange={(e) => setAppealNote(e.target.value)} /></Field>
            <div className="ws-actions">
              <button className="ws-btn ok" disabled={busy || appealNote.trim().length < 20} onClick={() => run(() => decideAppeal(appeal.id, true, appealNote), 'Conviction overturned')}>Grant appeal</button>
              <button className="ws-btn danger" disabled={busy || appealNote.trim().length < 20} onClick={() => run(() => decideAppeal(appeal.id, false, appealNote), 'Appeal denied')}>Deny appeal</button>
            </div></>)}
        </Card>)}

      <Card title="Timeline"><div className="ws-timeline">{events.map((e) => <div key={e.id}><b>{label(e.event)}</b> · {fmt(e.created_at)}{e.detail ? ' · ' + e.detail : ''}</div>)}</div></Card>

      {confirm === 'waive' && <Confirm title="Waive counsel?" message="You will face trial without a defence attorney." confirmLabel="Waive" danger onCancel={() => setConfirm(null)} onConfirm={async () => { setConfirm(null); await run(() => waiveCounsel(id), 'Counsel waived'); }} />}
      {confirm === 'verdict' && <Confirm title="Deliver verdict?" message="This is final for the trial stage and notifies the defendant." confirmLabel="Deliver" danger onCancel={() => setConfirm(null)}
        onConfirm={async () => { setConfirm(null); await run(() => deliverVerdict(id, verdict.v, verdict.days, verdict.prison), 'Verdict delivered'); }} />}
    </Modal>);
}

export default function CourtPanel({ status, notify, reload }) {
  const q = useAsync(async () => {
    const rows = await listCases();
    return { rows, names: await namesFor(rows.map((r) => r.defendant_id)) };
  }, []);
  const [sel, setSel] = useState(null);
  const [filter, setFilter] = useState('all');
  const rows = (q.data?.rows || []).filter((r) => filter === 'all' || r.status === filter);

  return (
    <Card title="Court docket" right={
      <select value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter">
        {['all', 'prosecutor_review', 'filed', 'verdict', 'appealed', 'closed', 'dismissed'].map((s) => <option key={s} value={s}>{label(s)}</option>)}
      </select>}>
      {q.loading && !q.data && <Loading />}
      <ErrorBox error={q.error} onRetry={q.reload} />
      {q.data && !rows.length && <Empty text="No cases." />}
      {rows.map((c) => (
        <div className="ws-row" key={c.id}>
          <div className="main"><b>{c.case_number} · {c.charge}</b><span className="meta">Defendant: {q.data.names[c.defendant_id]}</span></div>
          <div className="ws-actions"><Badge tone={statusTone(c.status)}>{c.status}</Badge><button className="ws-btn ghost sm" onClick={() => setSel(c.id)}>Open</button></div>
        </div>))}
      {sel && <CaseDetail id={sel} status={status} notify={notify} onClose={() => setSel(null)} onChanged={async () => { await q.reload(); await reload(); }} />}
    </Card>);
}
