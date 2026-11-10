import { useState } from 'react';
import { listTechs, listCountryTechs, listProjects, listFacilities, buildFacility, upgradeFacility, startResearch, cancelResearch } from '../../services/research';
import { useAsync, useAction, Card, Empty, Loading, ErrorBox, Badge, Modal, Field, label } from '../../components/ws/kit';
import { money } from '../../components/ws/gameUtil';
import Bar from '../../components/ws/Bar';

function BuildModal({ member, notify, onClose, onDone }) {
  const [name, setName] = useState('');
  const [busy, run] = useAction(notify);
  return (
    <Modal title="Build research facility" onClose={onClose}>
      <form onSubmit={async (e) => { e.preventDefault(); if (await run(() => buildFacility(member.org_id, name), 'Facility built')) { await onDone(); onClose(); } }}>
        <Field label="Facility name (3-60 characters)"><input required minLength={3} maxLength={60} value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <p className="ws-sub">Costs 5,000 from the institute budget. Each facility adds research speed.</p>
        <button className="ws-btn" disabled={busy}>Build</button>
      </form>
    </Modal>);
}

export default function TechPanel({ status, member, notify, reload }) {
  const q = useAsync(async () => {
    const [techs, done, projects, facilities] = await Promise.all([
      listTechs(), listCountryTechs(member.country_id), listProjects(member.country_id), listFacilities(member.org_id)]);
    const doneIds = new Set(done.map((d) => d.tech_id));
    return { techs, doneIds, doneCodes: new Set(techs.filter((t) => doneIds.has(t.id)).map((t) => t.code)), projects, facilities };
  }, [member.org_id]);
  const after = async () => { await q.reload(); await reload(); };
  const [busy, run] = useAction(notify, after);
  const [building, setBuilding] = useState(false);
  const canResearch = ['scientist', 'researcher', 'institute_director'].includes(member.role);
  const isHead = member.is_head || member.role === 'institute_director';

  if (q.loading && !q.data) return <Card title="Research"><Loading /></Card>;
  if (q.error && !q.data) return <Card title="Research"><ErrorBox error={q.error} onRetry={q.reload} /></Card>;
  const d = q.data;
  const fields = [...new Set(d.techs.map((t) => t.field))];

  return (
    <>
      <Card title={'Facilities · budget ' + money(member.budget)}
        right={isHead && d.facilities.length < 3 && <button className="ws-btn sm" onClick={() => setBuilding(true)}>Build facility</button>}>
        {!d.facilities.length && <Empty text="No facilities yet. Build one before starting research." />}
        {d.facilities.map((f) => (
          <div className="ws-row" key={f.id}>
            <div className="main"><b>{f.name}</b><span className="meta">Level {f.level} of 5</span></div>
            {isHead && f.level < 5 && (
              <button className="ws-btn ghost sm" disabled={busy}
                onClick={() => run(() => upgradeFacility(f.id), 'Facility upgraded')}>Upgrade ({money(5000 * (f.level + 1))})</button>)}
          </div>))}
      </Card>

      <Card title="Active projects (your country)">
        {!d.projects.length && <Empty text="No research in progress." />}
        {d.projects.map((p) => {
          const pct = (Number(p.points_done) / p.points_required) * 100;
          return (
            <div className="ws-row" key={p.id}>
              <div className="main"><b>{p.rd_techs?.name}</b>
                <span className="meta">{Number(p.points_done).toFixed(0)} / {p.points_required} points · {pct.toFixed(0)}%</span>
                <Bar pct={pct} /></div>
              {(p.lead_id === status.user_id || isHead) && (
                <button className="ws-btn ghost sm" disabled={busy} onClick={() => run(() => cancelResearch(p.id), 'Project cancelled')}>Cancel</button>)}
            </div>);
        })}
      </Card>

      {fields.map((fld) => (
        <Card key={fld} title={label(fld)}>
          {d.techs.filter((t) => t.field === fld).map((t) => {
            const researched = d.doneIds.has(t.id);
            const proj = d.projects.find((p) => p.tech_id === t.id);
            const locked = t.prerequisite_code && !d.doneCodes.has(t.prerequisite_code);
            return (
              <div className="ws-row" key={t.id}>
                <div className="main"><b>{t.code} · {t.name}</b>
                  <span className="meta">{t.description} · tier {t.tier} · cost {money(t.cost)} · {t.points_required} points</span></div>
                <div className="ws-actions">
                  {researched && <Badge tone="green">researched</Badge>}
                  {!researched && proj && <Badge tone="amber">in progress</Badge>}
                  {!researched && !proj && locked && <Badge>needs {t.prerequisite_code}</Badge>}
                  {!researched && !proj && !locked && canResearch && (
                    <button className="ws-btn sm" disabled={busy || !d.facilities.length || Number(member.budget) < Number(t.cost)}
                      onClick={() => run(() => startResearch(member.org_id, t.id), 'Research started')}>Start</button>)}
                </div>
              </div>);
          })}
        </Card>))}
      {!canResearch && <p className="ws-sub">Only researchers, scientists and the director can start projects. Lab researchers add research speed.</p>}
      {building && <BuildModal member={member} notify={notify} onClose={() => setBuilding(false)} onDone={after} />}
    </>);
}
