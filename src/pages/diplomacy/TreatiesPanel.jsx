import { useState } from 'react';
import { listTreaties, listCountries, proposeTreaty, respondTreaty, withdrawTreaty } from '../../services/diplomacy';
import { useAsync, useAction, Card, Empty, Loading, ErrorBox, Badge, Modal, Field, statusTone, label, timeLeft } from '../../components/ws/kit';

const KINDS = ['alliance', 'trade_agreement', 'non_aggression', 'ceasefire', 'peace_agreement'];

function Propose({ member, countries, notify, onClose, onDone }) {
  const [f, setF] = useState({ kind: 'trade_agreement', title: '', terms: '', parties: [] });
  const [busy, run] = useAction(notify);
  const toggle = (id) => setF((s) => ({ ...s, parties: s.parties.includes(id) ? s.parties.filter((x) => x !== id) : [...s.parties, id] }));
  return (
    <Modal title="Propose treaty" onClose={onClose}>
      <form onSubmit={async (e) => {
        e.preventDefault();
        if (await run(() => proposeTreaty({ ...f, proposer: member.country_id }), 'Treaty proposed')) { await onDone(); onClose(); }
      }}>
        <Field label="Type"><select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>{KINDS.map((k) => <option key={k} value={k}>{label(k)}</option>)}</select></Field>
        <Field label="Title"><input required minLength={3} maxLength={140} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
        <Field label="Terms (10+ characters)"><textarea required minLength={10} maxLength={4000} value={f.terms} onChange={(e) => setF({ ...f, terms: e.target.value })} /></Field>
        <Field label={'Invite countries (' + f.parties.length + ' selected, max 8)'}>
          <div style={{ maxHeight: 160, overflowY: 'auto' }}>
            {countries.filter((c) => c.id !== member.country_id).map((c) => (
              <label key={c.id} style={{ display: 'block' }}><input type="checkbox" checked={f.parties.includes(c.id)} onChange={() => toggle(c.id)} /> {c.name}</label>))}
          </div>
        </Field>
        <p className="ws-sub">Alliances need relations of 20+. Ceasefires and peace deals need strained relations (-10 or lower). Sanctions block alliances and trade deals.</p>
        <button className="ws-btn" disabled={busy || !f.parties.length}>Propose</button>
      </form>
    </Modal>);
}

export default function TreatiesPanel({ member, notify }) {
  const q = useAsync(async () => {
    const [rows, countries] = await Promise.all([listTreaties(), listCountries()]);
    return { rows, countries, cn: Object.fromEntries(countries.map((c) => [c.id, c.name])) };
  }, []);
  const [busy, run] = useAction(notify, q.reload);
  const [proposing, setProposing] = useState(false);
  const my = member.country_id;
  const canPropose = ['foreign_minister', 'ambassador', 'international_negotiator'].includes(member.role);
  const canRespond = ['foreign_minister', 'ambassador'].includes(member.role);
  const isMin = member.role === 'foreign_minister';

  return (
    <Card title="Treaties" right={canPropose && <button className="ws-btn sm" onClick={() => setProposing(true)}>Propose treaty</button>}>
      {q.loading && !q.data && <Loading />}
      <ErrorBox error={q.error} onRetry={q.reload} />
      {q.data && !q.data.rows.length && <Empty text="No treaties yet." />}
      {q.data?.rows.map((t) => {
        const parties = t.dip_treaty_parties || [];
        const mine = parties.find((p) => p.country_id === my);
        return (
          <div className="ws-row" key={t.id} style={{ flexWrap: 'wrap' }}>
            <div className="main"><b>{t.title}</b>
              <span className="meta">{label(t.kind)} · {t.ref}{t.status === 'proposed' ? ' · offer ends in ' + timeLeft(t.offer_expires_at) : ''}{t.status === 'active' && t.ends_at ? ' · ends in ' + timeLeft(t.ends_at) : ''}</span>
              <span className="meta">{parties.map((p) => q.data.cn[p.country_id] + (p.response === 'accepted' ? ' ✓' : p.response === 'declined' ? ' ✗' : ' …')).join(' · ')}</span>
              <span className="meta">{t.terms}</span></div>
            <div className="ws-actions"><Badge tone={statusTone(t.status)}>{t.status}</Badge>
              {t.status === 'proposed' && mine?.response === 'pending' && canRespond && (
                <>
                  <button className="ws-btn sm" disabled={busy} onClick={() => run(() => respondTreaty(t.id, my, true), 'Treaty accepted')}>Accept</button>
                  <button className="ws-btn danger sm" disabled={busy} onClick={() => run(() => respondTreaty(t.id, my, false), 'Treaty declined')}>Decline</button>
                </>)}
              {isMin && mine && ((t.status === 'proposed' && t.proposer_country_id === my) || t.status === 'active') && (
                <button className="ws-btn ghost sm" disabled={busy} onClick={() => run(() => withdrawTreaty(t.id, my), 'Withdrawn')}>Withdraw</button>)}
            </div>
          </div>);
      })}
      {proposing && q.data && <Propose member={member} countries={q.data.countries} notify={notify} onClose={() => setProposing(false)} onDone={q.reload} />}
    </Card>);
}
