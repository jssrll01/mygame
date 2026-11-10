import { useState } from 'react';
import { listNegotiations, listCountries, listNegMessages, openNegotiation, postNegotiationMessage, closeNegotiation } from '../../services/diplomacy';
import { namesFor } from '../../services/wsClient';
import { useAsync, useAction, Card, Empty, Loading, ErrorBox, Badge, Modal, Field, statusTone, fmt } from '../../components/ws/kit';

function Open({ member, countries, notify, onClose, onDone }) {
  const [f, setF] = useState({ withC: '', topic: '' });
  const [busy, run] = useAction(notify);
  return (
    <Modal title="Open negotiation" onClose={onClose}>
      <form onSubmit={async (e) => { e.preventDefault(); if (await run(() => openNegotiation(member.country_id, Number(f.withC), f.topic), 'Negotiation opened')) { await onDone(); onClose(); } }}>
        <Field label="Negotiate with"><select required value={f.withC} onChange={(e) => setF({ ...f, withC: e.target.value })}>
          <option value="">Choose…</option>{countries.filter((c) => c.id !== member.country_id).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
        <Field label="Topic"><input required minLength={3} maxLength={140} value={f.topic} onChange={(e) => setF({ ...f, topic: e.target.value })} /></Field>
        <button className="ws-btn" disabled={busy || !f.withC}>Open</button>
      </form>
    </Modal>);
}

function Thread({ n, cn, member, notify, onBack, reloadList }) {
  const q = useAsync(async () => {
    const rows = await listNegMessages(n.id);
    return { rows, names: await namesFor(rows.map((r) => r.author_id)) };
  }, [n.id]);
  const [body, setBody] = useState('');
  const [busy, run] = useAction(notify, async () => { setBody(''); await q.reload(); });
  const [busy2, run2] = useAction(notify, async () => { await reloadList(); onBack(); });
  const canClose = ['foreign_minister', 'international_negotiator'].includes(member.role);
  return (
    <Card title={n.topic + ' · ' + cn[n.country_a] + ' / ' + cn[n.country_b]}
      right={<button className="ws-btn ghost sm" onClick={onBack}>Back</button>}>
      <p><Badge tone={statusTone(n.status)}>{n.status}</Badge></p>
      {q.loading && !q.data && <Loading />}
      <ErrorBox error={q.error} onRetry={q.reload} />
      {q.data && !q.data.rows.length && <Empty text="No messages yet." />}
      {q.data?.rows.map((m) => (
        <div className="ws-row" key={m.id}><div className="main"><b>{q.data.names[m.author_id]}</b><span className="meta">{fmt(m.created_at)}</span><span className="ws-pre">{m.body}</span></div></div>))}
      {n.status === 'open' && (
        <>
          <Field label="Message"><textarea maxLength={2000} value={body} onChange={(e) => setBody(e.target.value)} /></Field>
          <div className="ws-actions">
            <button className="ws-btn sm" disabled={busy || !body.trim()} onClick={() => run(() => postNegotiationMessage(n.id, body), 'Message sent')}>Send</button>
            <button className="ws-btn ghost sm" onClick={q.reload}>Refresh</button>
            {canClose && <button className="ws-btn sm" disabled={busy2} onClick={() => run2(() => closeNegotiation(n.id, 'concluded'), 'Concluded')}>Conclude</button>}
            {canClose && <button className="ws-btn danger sm" disabled={busy2} onClick={() => run2(() => closeNegotiation(n.id, 'failed'), 'Marked failed')}>Fail</button>}
          </div>
        </>)}
    </Card>);
}

export default function TalksPanel({ member, notify }) {
  const q = useAsync(async () => {
    const [rows, countries] = await Promise.all([listNegotiations(), listCountries()]);
    return { rows, countries, cn: Object.fromEntries(countries.map((c) => [c.id, c.name])) };
  }, []);
  const [sel, setSel] = useState(null);
  const [opening, setOpening] = useState(false);
  const canOpen = ['foreign_minister', 'ambassador', 'international_negotiator'].includes(member.role);
  if (sel && q.data) return <Thread n={sel} cn={q.data.cn} member={member} notify={notify} onBack={() => setSel(null)} reloadList={q.reload} />;
  return (
    <Card title="Negotiations (private to the two delegations)" right={canOpen && <button className="ws-btn sm" onClick={() => setOpening(true)}>Open negotiation</button>}>
      {q.loading && !q.data && <Loading />}
      <ErrorBox error={q.error} onRetry={q.reload} />
      {q.data && !q.data.rows.length && <Empty text="No negotiations." />}
      {q.data?.rows.map((n) => (
        <div className="ws-row" key={n.id}>
          <div className="main"><b>{n.topic}</b><span className="meta">{q.data.cn[n.country_a]} / {q.data.cn[n.country_b]} · {fmt(n.opened_at)}</span></div>
          <div className="ws-actions"><Badge tone={statusTone(n.status)}>{n.status}</Badge><button className="ws-btn ghost sm" onClick={() => setSel(n)}>Open</button></div>
        </div>))}
      {opening && q.data && <Open member={member} countries={q.data.countries} notify={notify} onClose={() => setOpening(false)} onDone={q.reload} />}
    </Card>);
}
