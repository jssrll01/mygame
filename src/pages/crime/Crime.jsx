import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../config/supabase';
import { useProfile } from '../../context/ProfileContext';

const newKey = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Date.now() + '-' + Math.random().toString(16).slice(2);
const num = (n, d = 0) =>
  Number(n).toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
const minsTo = (iso) => Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 60000));
const KINDS = {
  courier: { name: 'Courier run', per: 500, mins: 20, note: 'Low risk, modest reward' },
  racket: { name: 'Protection racket', per: 1000, mins: 40, note: 'Medium risk and reward' },
  heist: { name: 'Vault heist', per: 2000, mins: 60, note: 'High risk, high reward' }
};
const EMPTY = { board: [], roster: [], invites: [], ops: [], ledger: [], infl: [], cities: [] };

export default function Crime() {
  const { profile, refresh } = useProfile();
  const cid = profile.country_id;
  const [tab, setTab] = useState('syndicate');
  const [d, setD] = useState(EMPTY);
  const [f, setF] = useState({});
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [, setTick] = useState(0);

  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const g = (k) => (f[k] === undefined ? '' : f[k]);

  const load = useCallback(async () => {
    if (!cid) return;
    const q = await Promise.all([
      supabase.from('syndicate_board').select('*').order('reputation', { ascending: false }),
      supabase.from('syndicate_roster').select('*').order('rank_level', { ascending: false }),
      supabase.from('my_invites').select('*'),
      supabase.from('syndicate_ops').select('*').order('started_at', { ascending: false }).limit(15),
      supabase.from('syndicate_ledger').select('*').order('id', { ascending: false }).limit(15),
      supabase.from('influence_board').select('*'),
      supabase.from('cities').select('id,name').eq('country_id', cid).order('name')
    ]);
    const err = q.find((x) => x.error);
    if (err) setMsg({ type: 'error', text: err.error.message });
    setD({
      board: q[0].data || [], roster: q[1].data || [], invites: q[2].data || [], ops: q[3].data || [],
      ledger: q[4].data || [], infl: q[5].data || [], cities: q[6].data || []
    });
  }, [cid]);

  useEffect(() => {
    let alive = true;
    const run = async () => {
      await supabase.rpc('resolve_syndicate_ops');
      if (alive) await load();
    };
    run();
    const t = setInterval(() => { setTick((n) => n + 1); run(); }, 30000);
    return () => { alive = false; clearInterval(t); };
  }, [load]);

  async function call(name, args, okText, reset) {
    if (busy) return;
    setBusy(true);
    setMsg(null);
    const { error } = await supabase.rpc(name, args);
    setBusy(false);
    if (error) { setMsg({ type: 'error', text: error.message }); await load(); return; }
    setMsg({ type: 'ok', text: okText });
    if (reset) reset();
    await load();
    await refresh();
  }

  if (!cid) {
    return (
      <div>
        <h2>Criminal Underworld</h2>
        <p className="muted">Choose a country on the World page first.</p>
      </div>
    );
  }

  const mine = d.board.find((s) => s.is_mine);
  const myRank = d.roster.find((r) => r.user_id === profile.id)?.rank_level || 0;
  const opKind = g('ok') || 'courier';
  const k = KINDS[opKind];
  const crew = Number(g('crew')) || 0;
  const cityId = Number(g('city')) || d.cities[0]?.id || 0;
  const rivalMax = d.infl.filter((x) => x.city_id === cityId && !x.is_mine).reduce((m, x) => Math.max(m, x.influence), 0);
  const myInfl = d.infl.find((x) => x.city_id === cityId && x.is_mine)?.influence || 0;
  const citiesWithInfl = d.cities.filter((c) => d.infl.some((x) => x.city_id === c.id));
  const tabs = [['syndicate', 'Syndicate'], ['ops', 'Operations'], ['territory', 'Territory'], ['rivals', 'Rivals']];

  const rivals = (
    <div className="panel wide">
      <h3>Syndicates in your country</h3>
      {d.board.length === 0 && <p className="muted">No syndicates exist yet.</p>}
      {d.board.map((s) => (
        <div className="li" key={s.id}>
          <span><strong>{s.name}</strong>{s.is_mine ? ' (yours)' : ''}<br />
            <span className="muted small">{s.members} members · influence {s.influence}</span></span>
          <span className="tag">rep {s.reputation}</span>
        </div>
      ))}
    </div>
  );

  return (
    <div>
      <h2>Criminal Underworld</h2>
      <p className="muted small">Shadow Network is a fictional, abstract game system. Nothing here models real-world methods.</p>
      {msg && <div className={'msg ' + (msg.type === 'error' ? 'msg-error' : 'msg-ok')}>{msg.text}</div>}

      {!mine ? (
        <>
          <div className="panel wide">
            <h3>Found a syndicate</h3>
            <p className="muted small">Costs 5,000 of your national currency in cash. You become the Boss.</p>
            <div className="row">
              <input maxLength={30} placeholder="Syndicate name" value={g('sn')} onChange={(e) => set('sn', e.target.value)} />
              <button className="btn btn-primary" disabled={busy}
                onClick={() => call('create_syndicate', { p_name: g('sn'), p_key: newKey() }, 'Syndicate founded.', () => set('sn', ''))}>
                Found
              </button>
            </div>
          </div>
          <div className="panel wide">
            <h3>Invitations</h3>
            {d.invites.length === 0 && <p className="muted">No invitations. A syndicate Underboss or Boss must invite you by username.</p>}
            {d.invites.map((i) => (
              <div className="li" key={i.id}>
                <span><strong>{i.syndicate_name}</strong><br /><span className="muted small">invited by {i.invited_by_name || 'unknown'}</span></span>
                <span className="row" style={{ margin: 0 }}>
                  <button className="btn btn-primary" disabled={busy}
                    onClick={() => call('accept_invite', { p_invite: i.id }, 'You joined the syndicate.')}>Accept</button>
                  <button className="btn btn-dark" disabled={busy}
                    onClick={() => call('decline_invite', { p_invite: i.id }, 'Invitation declined.')}>Decline</button>
                </span>
              </div>
            ))}
          </div>
          {rivals}
        </>
      ) : (
        <>
          <div className="chips">
            {tabs.map(([key, l]) => (
              <button key={key} className={'chip' + (tab === key ? ' on' : '')} onClick={() => setTab(key)}>{l}</button>
            ))}
          </div>

          {tab === 'syndicate' && (
            <>
              <div className="panel wide">
                <h3>{mine.name}</h3>
                <div className="cards">
                  <div className="card"><span className="muted">Treasury</span><strong>{num(mine.treasury)} credits</strong></div>
                  <div className="card"><span className="muted">Heat</span><strong>{mine.heat}/100</strong></div>
                  <div className="card"><span className="muted">Reputation</span><strong>{mine.reputation}</strong></div>
                  <div className="card"><span className="muted">Members</span><strong>{mine.members}</strong></div>
                </div>
                <p className="muted small">Heat lowers success odds and fades by 1 point every 10 minutes. Law enforcement investigations arrive in Phase 10.</p>
                <div className="row">
                  <input type="number" min="0" step="0.01" placeholder="Contribute cash (your currency)"
                    value={g('fund')} onChange={(e) => set('fund', e.target.value)} />
                  <button className="btn btn-primary" disabled={busy}
                    onClick={() => call('fund_syndicate', { p_amount: Number(g('fund')), p_key: newKey() }, 'Contribution received.', () => set('fund', ''))}>
                    Contribute
                  </button>
                </div>
              </div>

              <div className="panel wide">
                <h3>Members</h3>
                {d.roster.map((m) => {
                  const below = m.rank_level < myRank && myRank >= 4;
                  return (
                    <div className="li" key={m.user_id}>
                      <span>{m.username} · {m.rank_name}</span>
                      {below && (
                        <span className="row" style={{ margin: 0 }}>
                          {m.rank_level + 1 < myRank && (
                            <button className="btn btn-dark" disabled={busy}
                              onClick={() => call('set_member_rank', { p_user: m.user_id, p_rank: m.rank_level + 1 }, 'Promoted.')}>Promote</button>
                          )}
                          {m.rank_level > 1 && (
                            <button className="btn btn-dark" disabled={busy}
                              onClick={() => call('set_member_rank', { p_user: m.user_id, p_rank: m.rank_level - 1 }, 'Demoted.')}>Demote</button>
                          )}
                          <button className="btn btn-dark" disabled={busy}
                            onClick={() => window.confirm('Remove ' + m.username + '?') && call('kick_member', { p_user: m.user_id }, 'Member removed.')}>Remove</button>
                        </span>
                      )}
                      {myRank === 5 && m.user_id !== profile.id && (
                        <button className="btn btn-dark" disabled={busy}
                          onClick={() => window.confirm('Make ' + m.username + ' the Boss?') && call('transfer_leadership', { p_user: m.user_id }, 'Leadership transferred.')}>
                          Make boss
                        </button>
                      )}
                    </div>
                  );
                })}
                {myRank >= 4 && (
                  <div className="row">
                    <input placeholder="Invite citizen by username" value={g('inv')} onChange={(e) => set('inv', e.target.value)} />
                    <button className="btn btn-primary" disabled={busy}
                      onClick={() => call('invite_member', { p_username: g('inv') }, 'Invitation sent.', () => set('inv', ''))}>
                      Invite
                    </button>
                  </div>
                )}
                {myRank === 5 && (
                  <>
                    <h3>Pay a member from the treasury</h3>
                    <div className="row">
                      <select value={g('pu') || d.roster[0]?.user_id || ''} onChange={(e) => set('pu', e.target.value)}>
                        {d.roster.map((m) => <option key={m.user_id} value={m.user_id}>{m.username}</option>)}
                      </select>
                      <input type="number" min="0" step="0.01" placeholder="Credits" value={g('pa')} onChange={(e) => set('pa', e.target.value)} />
                      <button className="btn btn-primary" disabled={busy}
                        onClick={() => call('syndicate_payout', { p_user: g('pu') || d.roster[0]?.user_id, p_amount: Number(g('pa')), p_key: newKey() }, 'Payout sent.', () => set('pa', ''))}>
                        Pay
                      </button>
                    </div>
                  </>
                )}
                <div className="row">
                  {myRank < 5 ? (
                    <button className="btn btn-dark" disabled={busy}
                      onClick={() => window.confirm('Leave the syndicate?') && call('leave_syndicate', {}, 'You left the syndicate.')}>
                      Leave syndicate
                    </button>
                  ) : (
                    <button className="btn btn-dark" disabled={busy}
                      onClick={() => window.confirm('Disband the syndicate permanently?') && call('disband_syndicate', {}, 'Syndicate disbanded.')}>
                      Disband syndicate
                    </button>
                  )}
                </div>
              </div>

              {myRank >= 3 && (
                <div className="panel wide">
                  <h3>Treasury ledger</h3>
                  {d.ledger.length === 0 && <p className="muted">No entries yet.</p>}
                  <div className="tablewrap">
                    <table className="table">
                      <thead><tr><th>Time</th><th>Type</th><th>Amount</th><th>Note</th></tr></thead>
                      <tbody>
                        {d.ledger.map((t) => (
                          <tr key={t.id}>
                            <td>{new Date(t.created_at).toLocaleString()}</td>
                            <td>{t.kind}</td>
                            <td className={t.direction === 'credit' ? 'pos' : 'neg'}>
                              {t.direction === 'credit' ? '+' : '-'}{num(t.amount, 2)}
                            </td>
                            <td className="muted">{t.memo}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}

          {tab === 'ops' && (
            <>
              <div className="panel wide">
                <h3>Launch a venture</h3>
                {myRank < 3 ? (
                  <p className="muted">Captain rank or higher is required.</p>
                ) : (
                  <>
                    <p className="muted small">
                      Abstract fictional ventures. Crew expenses are paid up front from the treasury. Odds depend on heat, crew size, member count, territory and national stability. Max 2 active.
                    </p>
                    <div className="row">
                      <select value={opKind} onChange={(e) => set('ok', e.target.value)}>
                        {Object.entries(KINDS).map(([key, v]) => <option key={key} value={key}>{v.name}</option>)}
                      </select>
                      <input type="number" min="1" max="20" placeholder="Crew (1-20)" value={g('crew')} onChange={(e) => set('crew', e.target.value)} />
                    </div>
                    <p className="muted small">
                      {k.note} · {num(k.per)} credits per crew · {k.mins} min{crew > 0 ? ' · total ' + num(k.per * crew) + ' credits' : ''}
                    </p>
                    <button className="btn btn-primary" disabled={busy}
                      onClick={() => call('launch_syndicate_op', { p_kind: opKind, p_crew: crew }, 'Venture launched.', () => set('crew', ''))}>
                      Launch
                    </button>
                  </>
                )}
              </div>
              <h3>Operations</h3>
              {d.ops.length === 0 && <p className="muted">No operations yet.</p>}
              {d.ops.map((o) => (
                <div className="panel wide" key={o.id}>
                  <div className="row" style={{ justifyContent: 'space-between', margin: 0 }}>
                    <strong>{KINDS[o.kind]?.name} · crew {o.crew}</strong>
                    <span className="tag">{o.status === 'active' ? 'active' : o.outcome}</span>
                  </div>
                  <p className="muted small">{new Date(o.started_at).toLocaleString()} · cost {num(o.cost)} credits</p>
                  <p className="small">{o.status === 'active' ? 'Resolves in about ' + minsTo(o.resolve_at) + ' min.' : o.report}</p>
                </div>
              ))}
            </>
          )}

          {tab === 'territory' && (
            <>
              <div className="panel wide">
                <h3>Expand influence</h3>
                {myRank < 3 ? (
                  <p className="muted">Captain rank or higher is required.</p>
                ) : (
                  <>
                    <p className="muted small">
                      Each purchase adds +5 influence in a city of your home country. Cost: 2,000 credits plus 150 per point of the strongest rival there. Influence improves venture odds. Each purchase adds 2 heat.
                    </p>
                    <div className="row">
                      <select value={cityId} onChange={(e) => set('city', e.target.value)}>
                        {d.cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                      <button className="btn btn-primary" disabled={busy || !cityId}
                        onClick={() => call('expand_influence', { p_city: cityId }, 'Influence expanded.')}>
                        Expand ({num(2000 + 150 * rivalMax)} credits)
                      </button>
                    </div>
                    <p className="muted small">Your influence there: {myInfl}/100 · strongest rival: {rivalMax}</p>
                  </>
                )}
              </div>
              <div className="panel wide">
                <h3>Control map</h3>
                {citiesWithInfl.length === 0 && <p className="muted">No syndicate has influence in any city yet.</p>}
                {citiesWithInfl.map((c) => {
                  const rows = d.infl.filter((x) => x.city_id === c.id).sort((a, b) => b.influence - a.influence);
                  return (
                    <div className="li" key={c.id}>
                      <span><strong>{c.name}</strong></span>
                      <span className="muted small">
                        {rows.map((x) => x.syndicate_name + ' ' + x.influence).join(' · ')}
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {tab === 'rivals' && rivals}
        </>
      )}
    </div>
  );
}
