import { useState } from 'react';
import { listOutbreaks, listAlerts, listHospitals, listHealthCountries, listCountermeasures, restockHospital, respondToOutbreak,
  developCountermeasure, issueHealthAlert, clearHealthAlert, setQuarantine } from '../../services/research';
import { useAsync, useAction, Card, Empty, Loading, ErrorBox, Badge, Level, Modal, Field, label, fmt } from '../../components/ws/kit';
import { money } from '../../components/ws/gameUtil';
import AmountModal from '../../components/ws/AmountModal';
import Bar from '../../components/ws/Bar';

const COST = { treatment: 4000, vaccine: 12000 };
const NEEDS = { treatment: 'HLT-1', vaccine: 'HLT-2' };

function AlertModal({ country, outbreaks, notify, onClose, onDone }) {
  const [f, setF] = useState({ level: 3, message: '', outbreak: '' });
  const [busy, run] = useAction(notify);
  return (
    <Modal title="Issue public health alert" onClose={onClose}>
      <form onSubmit={async (e) => {
        e.preventDefault();
        if (await run(() => issueHealthAlert(country, f.outbreak || null, Number(f.level), f.message), 'Alert issued')) { await onDone(); onClose(); }
      }}>
        <Field label="Level (1-5)"><select value={f.level} onChange={(e) => setF({ ...f, level: e.target.value })}>{[1, 2, 3, 4, 5].map((n) => <option key={n}>{n}</option>)}</select></Field>
        <Field label="Outbreak (optional)"><select value={f.outbreak} onChange={(e) => setF({ ...f, outbreak: e.target.value })}>
          <option value="">General alert</option>{outbreaks.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></Field>
        <Field label="Message"><textarea required minLength={5} maxLength={500} value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} /></Field>
        <button className="ws-btn" disabled={busy}>Issue</button>
      </form>
    </Modal>);
}

export default function HealthPanel({ status, member, notify, reload }) {
  const c = member.country_id;
  const q = useAsync(async () => {
    const [outbreaks, alerts, hospitals, hcs] = await Promise.all([listOutbreaks(c), listAlerts(c), listHospitals(c), listHealthCountries()]);
    const cms = await listCountermeasures(outbreaks.map((o) => o.id));
    return { outbreaks, alerts, hospitals, cms, hc: hcs.find((h) => h.country_id === c) };
  }, [c, member.org_id]);
  const after = async () => { await q.reload(); await reload(); };
  const [busy, run] = useAction(notify, after);
  const [modal, setModal] = useState(null);
  const [ql, setQl] = useState(null);
  const role = member.role;
  const isAgency = member.kind === 'public_health_agency';
  const canRespond = ['doctor', 'medical_admin', 'public_health_officer', 'agency_director'].includes(role);
  const canDevelop = ['scientist', 'researcher', 'institute_director', 'public_health_officer', 'agency_director'].includes(role) && member.kind !== 'hospital';
  const canAlert = isAgency && ['public_health_officer', 'agency_director'].includes(role);
  const canRestock = member.kind === 'hospital' && ['doctor', 'medical_admin'].includes(role);

  if (q.loading && !q.data) return <Card title="Health response"><Loading /></Card>;
  if (q.error && !q.data) return <Card title="Health response"><ErrorBox error={q.error} onRetry={q.reload} /></Card>;
  const d = q.data;
  const qlevel = ql ?? d.hc?.quarantine_level ?? 0;

  return (
    <>
      <Card title={'National health · budget ' + money(member.budget)}>
        <p>Health index <b>{Number(d.hc?.health_index ?? 0).toFixed(1)}</b> / 100</p>
        <Bar pct={d.hc?.health_index} />
        <p className="ws-sub">Quarantine level {d.hc?.quarantine_level ?? 0} of 3{d.hc?.quarantine_set_at ? ' · set ' + fmt(d.hc.quarantine_set_at) : ''}</p>
        {isAgency && role === 'agency_director' && (
          <div className="ws-actions">
            <select value={qlevel} onChange={(e) => setQl(Number(e.target.value))}>{[0, 1, 2, 3].map((n) => <option key={n} value={n}>Level {n}</option>)}</select>
            <button className="ws-btn sm" disabled={busy} onClick={() => run(() => setQuarantine(c, qlevel), 'Quarantine policy set')}>Set quarantine</button>
          </div>)}
      </Card>

      <Card title="Outbreaks in your country">
        {!d.outbreaks.length && <Empty text="No active outbreaks." />}
        {d.outbreaks.map((o) => {
          const mine = d.cms.filter((x) => x.outbreak_id === o.id);
          return (
            <div className="ws-row" key={o.id} style={{ flexWrap: 'wrap' }}>
              <div className="main"><b>{o.name}</b>
                <span className="meta">{Number(o.infected_pct).toFixed(2)}% infected · response {Number(o.response_points).toFixed(0)}/500 · {o.ref}</span>
                {mine.map((x) => (
                  <span className="meta" key={x.id}>{label(x.kind)}: {x.status === 'ready' ? 'ready (' + Math.round(x.effectiveness * 100) + '% effective)'
                    : Math.round((Number(x.points_done) / x.points_required) * 100) + '% developed'}</span>))}</div>
              <div className="ws-actions"><Level n={o.severity} />
                {canRespond && <button className="ws-btn sm" disabled={busy} onClick={() => setModal({ type: 'respond', o })}>Fund response</button>}
                {canDevelop && ['treatment', 'vaccine'].filter((k) => !mine.some((x) => x.kind === k)).map((k) => (
                  <button key={k} className="ws-btn ghost sm" disabled={busy}
                    onClick={() => run(() => developCountermeasure(o.id, member.org_id, k), label(k) + ' programme started')}>
                    {label(k)} ({money(COST[k])}, needs {NEEDS[k]})</button>))}
              </div>
            </div>);
        })}
      </Card>

      <Card title="Hospitals">
        {!d.hospitals.length && <Empty text="No hospitals." />}
        {d.hospitals.map((h) => (
          <div className="ws-row" key={h.id}>
            <div className="main"><b>{h.name}</b><span className="meta">{h.beds} beds · supplies {Number(h.supplies).toFixed(0)}%</span><Bar pct={h.supplies} /></div>
            {canRestock && h.org_id === member.org_id && <button className="ws-btn sm" disabled={busy} onClick={() => setModal({ type: 'restock', h })}>Restock</button>}
          </div>))}
      </Card>

      <Card title="Public health alerts" right={canAlert && <button className="ws-btn sm" onClick={() => setModal({ type: 'alert' })}>Issue alert</button>}>
        {!d.alerts.length && <Empty text="No active alerts." />}
        {d.alerts.map((a) => (
          <div className="ws-row" key={a.id}>
            <div className="main"><b>{a.message}</b><span className="meta">{fmt(a.created_at)}</span></div>
            <div className="ws-actions"><Level n={a.level} />
              {canAlert && <button className="ws-btn ghost sm" disabled={busy} onClick={() => run(() => clearHealthAlert(a.id), 'Alert cleared')}>Clear</button>}</div>
          </div>))}
      </Card>

      {modal?.type === 'respond' && <AmountModal title={'Fund response: ' + modal.o.name} min={500} def={1000} notify={notify} onDone={after} onClose={() => setModal(null)}
        hint="Spent from your organisation budget. Response points slow the outbreak." onSubmit={(n) => respondToOutbreak(modal.o.id, member.org_id, n)} />}
      {modal?.type === 'restock' && <AmountModal title={'Restock ' + modal.h.name} min={100} def={500} notify={notify} onDone={after} onClose={() => setModal(null)}
        hint="Every 500 spent adds 1% supplies." onSubmit={(n) => restockHospital(modal.h.id, n)} />}
      {modal?.type === 'alert' && <AlertModal country={c} outbreaks={d.outbreaks} notify={notify} onDone={after} onClose={() => setModal(null)} />}
    </>);
}
