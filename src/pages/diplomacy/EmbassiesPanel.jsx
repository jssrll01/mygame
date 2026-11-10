import { useState } from 'react';
import { listEmbassies, listCountries, listIntlOrgs, listIntlMembers, openEmbassy, closeEmbassy, joinIntlOrg, leaveIntlOrg } from '../../services/diplomacy';
import { useAsync, useAction, Card, Empty, Loading, ErrorBox, Badge, Modal, Field, statusTone, label, fmt } from '../../components/ws/kit';

function Open({ member, countries, notify, onClose, onDone }) {
  const [host, setHost] = useState('');
  const [busy, run] = useAction(notify);
  return (
    <Modal title="Open embassy" onClose={onClose}>
      <form onSubmit={async (e) => { e.preventDefault(); if (await run(() => openEmbassy(member.country_id, Number(host)), 'Embassy opened')) { await onDone(); onClose(); } }}>
        <Field label="Host country"><select required value={host} onChange={(e) => setHost(e.target.value)}>
          <option value="">Choose…</option>{countries.filter((c) => c.id !== member.country_id).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
        <p className="ws-sub">Opening an embassy improves relations slightly. It is blocked by hostile relations (-70 or lower) or travel sanctions.</p>
        <button className="ws-btn" disabled={busy || !host}>Open</button>
      </form>
    </Modal>);
}

export default function EmbassiesPanel({ member, notify }) {
  const q = useAsync(async () => {
    const [emb, countries, orgs, mem] = await Promise.all([listEmbassies(), listCountries(), listIntlOrgs(), listIntlMembers()]);
    return { emb, countries, orgs, mem, cn: Object.fromEntries(countries.map((c) => [c.id, c.name])) };
  }, []);
  const [busy, run] = useAction(notify, q.reload);
  const [opening, setOpening] = useState(false);
  const my = member.country_id;
  const isMin = member.role === 'foreign_minister';

  return (
    <>
      <Card title="Embassies" right={isMin && <button className="ws-btn sm" onClick={() => setOpening(true)}>Open embassy</button>}>
        {q.loading && !q.data && <Loading />}
        <ErrorBox error={q.error} onRetry={q.reload} />
        {q.data && !q.data.emb.filter((e) => e.sending_country_id === my || e.host_country_id === my).length && <Empty text="No embassies yet." />}
        {q.data?.emb.filter((e) => e.sending_country_id === my || e.host_country_id === my).map((e) => (
          <div className="ws-row" key={e.id}>
            <div className="main"><b>{q.data.cn[e.sending_country_id]} → {q.data.cn[e.host_country_id]}</b><span className="meta">opened {fmt(e.opened_at)}</span></div>
            <div className="ws-actions"><Badge tone={statusTone(e.status)}>{e.status}</Badge>
              {isMin && e.status === 'open' && e.sending_country_id === my && (
                <button className="ws-btn ghost sm" disabled={busy} onClick={() => run(() => closeEmbassy(e.id), 'Embassy closed')}>Close</button>)}</div>
          </div>))}
      </Card>
      <Card title="International organisations">
        {q.data?.orgs.map((o) => {
          const members = q.data.mem.filter((m) => m.org_id === o.id);
          const joined = members.some((m) => m.country_id === my);
          return (
            <div className="ws-row" key={o.id}>
              <div className="main"><b>{o.name}</b><span className="meta">{label(o.kind)} · {members.length} members · {o.description}</span></div>
              {isMin && (joined
                ? <button className="ws-btn ghost sm" disabled={busy} onClick={() => run(() => leaveIntlOrg(o.id, my), 'Left organisation')}>Leave</button>
                : <button className="ws-btn sm" disabled={busy} onClick={() => run(() => joinIntlOrg(o.id, my), 'Joined organisation')}>Join</button>)}
            </div>);
        })}
      </Card>
      {opening && q.data && <Open member={member} countries={q.data.countries} notify={notify} onClose={() => setOpening(false)} onDone={q.reload} />}
    </>);
}
