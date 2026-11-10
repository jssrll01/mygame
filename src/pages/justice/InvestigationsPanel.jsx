import { useState } from 'react';
import { listInvestigations, getInvestigation, openInvestigation, setInvestigationStatus, addEvidence,
  requestWarrant, executeArrest, referCase } from '../../services/justice';
import { namesFor } from '../../services/wsClient';
import { useAsync, useAction, Card, Empty, Loading, ErrorBox, Badge, Modal, Confirm, Field, PlayerPicker,
  statusTone, label, fmt, timeLeft } from '../../components/ws/kit';
import { roleHelper } from '../../components/ws/roles';

const EVIDENCE_KINDS = ['testimony', 'document', 'surveillance', 'physical_item', 'digital_trace', 'financial_record'];
const DETECTIVE = ['detective', 'investigator', 'police_chief'];
const OFFICER = ['police_officer', ...DETECTIVE];

function Detail({ id, status, notify, onClose, onChanged }) {
  const d = useAsync(() => getInvestigation(id), [id]);
  const [busy, run] = useAction(notify, async () => { await d.reload(); onChanged(); });
  const [confirm, setConfirm] = useState(null);
  const [ev, setEv] = useState({ kind: 'testimony', description: '' });
  const [wr, setWr] = useState({ kind: 'search', justification: '' });
  const { has } = roleHelper(status, ['police']);

  if (d.loading && !d.data) return <Modal title="Investigation" onClose={onClose}><Loading /></Modal>;
  if (d.error && !d.data) return <Modal title="Investigation" onClose={onClose}><ErrorBox error={d.error} onRetry={d.reload} /></Modal>;
  const { inv, evidence, warrants, arrests, events } = d.data;
  const open = ['open', 'active'].includes(inv.status);
  const lawful = evidence.filter((e) => e.lawfully_obtained && e.status !== 'excluded');
  const strength = lawful.reduce((a, e) => a + e.reliability, 0);
  const canLead = (inv.lead_id === status.user_id || has('police_chief')) && has(...DETECTIVE) && !['closed', 'referred'].includes(inv.status);

  return (
    <Modal title={inv.case_number} onClose={onClose}>
      <p><b>{inv.title}</b> <Badge tone={statusTone(inv.status)}>{inv.status}</Badge></p>
      {inv.summary && <p className="ws-pre ws-sub">{inv.summary}</p>}
      <p className="ws-sub">Lawful evidence strength: <b style={{ color: '#F8FAFC' }}>{strength}</b> (arrest warrants need 100+ from 2+ items)</p>

      {canLead && (
        <div className="ws-actions" style={{ marginBottom: 12 }}>
          {inv.status === 'suspended' && <button className="ws-btn sm" disabled={busy} onClick={() => run(() => setInvestigationStatus(id, 'active'), 'Reopened')}>Resume</button>}
          {open && <button className="ws-btn ghost sm" disabled={busy} onClick={() => run(() => setInvestigationStatus(id, 'suspended'), 'Suspended')}>Suspend</button>}
          <button className="ws-btn danger sm" disabled={busy} onClick={() => setConfirm({ t: 'close' })}>Close case</button>
        </div>)}

      <Card title={'Evidence (' + evidence.length + ')'}>
        {!evidence.length && <Empty text="No evidence logged." />}
        {evidence.map((e) => (
          <div className="ws-row" key={e.id}>
            <div className="main"><b>{label(e.kind)}</b><span className="meta">{e.description}</span></div>
            <div className="ws-actions">
              <Badge>rel. {e.reliability}</Badge>
              {!e.lawfully_obtained && <Badge tone="red">no warrant</Badge>}
              <Badge tone={statusTone(e.status)}>{e.status}</Badge>
            </div>
          </div>))}
        {open && has(...OFFICER) && (
          <form onSubmit={(e) => { e.preventDefault(); run(() => addEvidence(id, ev.kind, ev.description), 'Evidence logged').then((ok) => ok && setEv({ ...ev, description: '' })); }}>
            <Field label="Evidence type">
              <select value={ev.kind} onChange={(e) => setEv({ ...ev, kind: e.target.value })}>
                {EVIDENCE_KINDS.map((k) => <option key={k} value={k}>{label(k)}</option>)}
              </select>
            </Field>
            <Field label="Description"><textarea required minLength={3} value={ev.description} onChange={(e) => setEv({ ...ev, description: e.target.value })} /></Field>
            <p className="ws-sub">Physical, digital and financial evidence is inadmissible unless a matching warrant is granted first.</p>
            <button className="ws-btn" disabled={busy}>Log evidence</button>
          </form>)}
      </Card>

      <Card title={'Warrants (' + warrants.length + ')'}>
        {!warrants.length && <Empty text="No warrants requested." />}
        {warrants.map((w) => (
          <div className="ws-row" key={w.id}>
            <div className="main"><b>{label(w.kind)} warrant</b>
              <span className="meta">{w.status === 'granted' ? 'expires in ' + timeLeft(w.expires_at) : fmt(w.requested_at)}{w.decision_note ? ' · ' + w.decision_note : ''}</span></div>
            <div className="ws-actions">
              <Badge tone={statusTone(w.status)}>{w.status}</Badge>
              {w.kind === 'arrest' && w.status === 'granted' && has(...OFFICER) && (
                <button className="ws-btn danger sm" disabled={busy} onClick={() => setConfirm({ t: 'arrest', id: w.id })}>Execute arrest</button>)}
            </div>
          </div>))}
        {open && has(...DETECTIVE) && inv.subject_user_id && (
          <form onSubmit={(e) => { e.preventDefault(); run(() => requestWarrant(id, wr.kind, wr.justification), 'Warrant requested — awaiting a judge').then((ok) => ok && setWr({ ...wr, justification: '' })); }}>
            <Field label="Warrant type">
              <select value={wr.kind} onChange={(e) => setWr({ ...wr, kind: e.target.value })}>
                <option value="search">Search</option><option value="financial_review">Financial review</option><option value="arrest">Arrest</option>
              </select>
            </Field>
            <Field label="Justification (30+ characters)"><textarea required minLength={30} value={wr.justification} onChange={(e) => setWr({ ...wr, justification: e.target.value })} /></Field>
            <button className="ws-btn" disabled={busy}>Request warrant</button>
          </form>)}
      </Card>

      <Card title={'Arrests (' + arrests.length + ')'}>
        {!arrests.length && <Empty text="No arrests." />}
        {arrests.map((a) => (
          <div className="ws-row" key={a.id}>
            <div className="main"><b>Suspect in custody</b>
              <span className="meta">{a.status === 'held' ? 'charges due within ' + timeLeft(a.custody_expires_at) : fmt(a.arrested_at)}</span></div>
            <div className="ws-actions">
              <Badge tone={statusTone(a.status)}>{a.status}</Badge>
              {a.status === 'held' && has(...DETECTIVE) && (
                <button className="ws-btn sm" disabled={busy} onClick={() => run(() => referCase(a.id), 'Referred to the prosecutor')}>Refer to prosecutor</button>)}
            </div>
          </div>))}
      </Card>

      <Card title="Timeline">
        <div className="ws-timeline">{events.map((e) => <div key={e.id}><b>{label(e.event)}</b> · {fmt(e.created_at)}{e.detail ? ' · ' + e.detail : ''}</div>)}</div>
      </Card>

      {confirm?.t === 'close' && (
        <Confirm title="Close this case?" message="Closing releases anyone still held under this investigation." danger confirmLabel="Close case"
          onCancel={() => setConfirm(null)} onConfirm={async () => { setConfirm(null); await run(() => setInvestigationStatus(id, 'closed'), 'Case closed'); }} />)}
      {confirm?.t === 'arrest' && (
        <Confirm title="Execute arrest?" message="The suspect will be held. Charges must be filed within 48 hours or they are released." danger confirmLabel="Arrest"
          onCancel={() => setConfirm(null)} onConfirm={async () => { const wid = confirm.id; setConfirm(null); await run(() => executeArrest(wid), 'Suspect arrested'); }} />)}
    </Modal>);
}

function NewInvestigation({ orgs, notify, onClose, onDone }) {
  const [f, setF] = useState({ org: orgs[0]?.org_id, title: '', summary: '', priority: 3 });
  const [subject, setSubject] = useState(null);
  const [busy, run] = useAction(notify);
  return (
    <Modal title="Open investigation" onClose={onClose}>
      <form onSubmit={async (e) => { e.preventDefault(); if (await run(() => openInvestigation({ ...f, subject: subject?.id, priority: Number(f.priority) }), 'Investigation opened')) { onDone(); onClose(); } }}>
        <Field label="Department"><select value={f.org} onChange={(e) => setF({ ...f, org: e.target.value })}>{orgs.map((o) => <option key={o.org_id} value={o.org_id}>{o.org_name}</option>)}</select></Field>
        <Field label="Title"><input required minLength={3} maxLength={140} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
        <Field label="Summary"><textarea maxLength={4000} value={f.summary} onChange={(e) => setF({ ...f, summary: e.target.value })} /></Field>
        <Field label="Person of interest (optional — being named is not an accusation)"><PlayerPicker value={subject} onChange={setSubject} /></Field>
        <Field label="Priority"><select value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value })}>{[1, 2, 3, 4, 5].map((p) => <option key={p}>{p}</option>)}</select></Field>
        <button className="ws-btn" disabled={busy}>Open investigation</button>
      </form>
    </Modal>);
}

export default function InvestigationsPanel({ status, notify }) {
  const list = useAsync(async () => {
    const rows = await listInvestigations();
    return { rows, names: await namesFor(rows.map((r) => r.subject_user_id)) };
  }, []);
  const [sel, setSel] = useState(null);
  const [creating, setCreating] = useState(false);
  const { orgsFor } = roleHelper(status, ['police']);
  const myOrgs = orgsFor(...DETECTIVE);

  return (
    <>
      <Card title="Case files" right={myOrgs.length > 0 && <button className="ws-btn sm" onClick={() => setCreating(true)}>New investigation</button>}>
        {list.loading && !list.data && <Loading />}
        <ErrorBox error={list.error} onRetry={list.reload} />
        {list.data && !list.data.rows.length && <Empty text="No investigations visible to you." />}
        {list.data?.rows.map((i) => (
          <div className="ws-row" key={i.id}>
            <div className="main"><b>{i.case_number} · {i.title}</b>
              <span className="meta">{i.subject_user_id ? 'Person of interest: ' + list.data.names[i.subject_user_id] + ' · ' : ''}priority {i.priority} · active {fmt(i.last_activity_at)}</span></div>
            <div className="ws-actions"><Badge tone={statusTone(i.status)}>{i.status}</Badge>
              <button className="ws-btn ghost sm" onClick={() => setSel(i.id)}>Open</button></div>
          </div>))}
      </Card>
      {sel && <Detail id={sel} status={status} notify={notify} onClose={() => setSel(null)} onChanged={list.reload} />}
      {creating && <NewInvestigation orgs={myOrgs} notify={notify} onClose={() => setCreating(false)} onDone={list.reload} />}
    </>);
}
