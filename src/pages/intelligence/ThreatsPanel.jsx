import { useState } from 'react';
import { listAssessments, listCountries, issueAssessment, withdrawAssessment } from '../../services/intelligence';
import { useAsync, useAction, Card, Empty, Loading, ErrorBox, Badge, Level, Modal, Field, statusTone, label, timeLeft } from '../../components/ws/kit';
import { CLASS_LABEL, CLASS_TONE } from '../../components/ws/roles';

const CATS = ['military', 'cyber', 'economic', 'civil_unrest', 'health', 'espionage'];

function Issue({ member, countries, notify, onClose, onDone }) {
  const [f, setF] = useState({ country: countries[0]?.id || '', subject: '', category: 'military', level: 3, rationale: '', classification: Math.min(1, member.clearance), hours: 24 });
  const [busy, run] = useAction(notify);
  return (
    <Modal title="Issue threat assessment" onClose={onClose}>
      <form onSubmit={async (e) => {
        e.preventDefault();
        const ok = await run(() => issueAssessment({ ...f, agency: member.org_id, level: Number(f.level), classification: Number(f.classification), hours: Number(f.hours) }), 'Assessment issued');
        if (ok) { onDone(); onClose(); }
      }}>
        <Field label="Country"><select value={f.country} onChange={(e) => setF({ ...f, country: e.target.value })}>{countries.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
        <Field label="Subject"><input required minLength={3} maxLength={140} value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} /></Field>
        <Field label="Category"><select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{CATS.map((c) => <option key={c} value={c}>{label(c)}</option>)}</select></Field>
        <Field label="Threat level (1 low – 5 severe)"><select value={f.level} onChange={(e) => setF({ ...f, level: e.target.value })}>{[1, 2, 3, 4, 5].map((n) => <option key={n}>{n}</option>)}</select></Field>
        <Field label="Classification"><select value={f.classification} onChange={(e) => setF({ ...f, classification: e.target.value })}>{CLASS_LABEL.map((c, i) => <option key={c} value={i} disabled={i > member.clearance}>{c}</option>)}</select></Field>
        <Field label="Valid for (hours, 1-168)"><input type="number" min="1" max="168" value={f.hours} onChange={(e) => setF({ ...f, hours: e.target.value })} /></Field>
        <Field label="Rationale"><textarea required minLength={10} maxLength={4000} value={f.rationale} onChange={(e) => setF({ ...f, rationale: e.target.value })} /></Field>
        <p className="ws-sub">The highest active assessment sets that country's public threat level.</p>
        <button className="ws-btn" disabled={busy}>Issue</button>
      </form>
    </Modal>);
}

export default function ThreatsPanel({ status, member, notify }) {
  const q = useAsync(async () => {
    const [rows, countries] = await Promise.all([listAssessments(), listCountries()]);
    return { rows, countries, cn: Object.fromEntries(countries.map((c) => [c.id, c.name])) };
  }, []);
  const [busy, run] = useAction(notify, q.reload);
  const [issuing, setIssuing] = useState(false);
  const canIssue = ['intel_officer', 'director'].includes(member.role) && !status.imprisoned;

  return (
    <Card title="Threat assessments" right={canIssue && <button className="ws-btn sm" onClick={() => setIssuing(true)}>Issue assessment</button>}>
      {q.loading && !q.data && <Loading />}
      <ErrorBox error={q.error} onRetry={q.reload} />
      {q.data && !q.data.rows.length && <Empty text="No assessments at your clearance level." />}
      {q.data?.rows.map((a) => (
        <div className="ws-row" key={a.id}>
          <div className="main"><b>{q.data.cn[a.country_id]} — {a.subject}</b>
            <span className="meta">{label(a.category)} · {a.status === 'active' ? 'valid ' + timeLeft(a.valid_until) : a.status}</span>
            <span className="meta">{a.rationale}</span></div>
          <div className="ws-actions"><Level n={a.threat_level} /><Badge tone={CLASS_TONE[a.classification]}>{CLASS_LABEL[a.classification]}</Badge>
            <Badge tone={statusTone(a.status)}>{a.status}</Badge>
            {a.status === 'active' && (a.issued_by === status.user_id || member.role === 'director') && (
              <button className="ws-btn ghost sm" disabled={busy} onClick={() => run(() => withdrawAssessment(a.id), 'Assessment withdrawn')}>Withdraw</button>)}</div>
        </div>))}
      {issuing && q.data && <Issue member={member} countries={q.data.countries} notify={notify} onClose={() => setIssuing(false)} onDone={q.reload} />}
    </Card>);
}
