import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../config/supabase';
import { useProfile } from '../../context/ProfileContext';

const num = (n, d = 0) =>
  Number(n).toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
const big = (n) => {
  const v = Number(n);
  if (Math.abs(v) >= 1e9) return num(v / 1e9, 2) + 'B';
  if (Math.abs(v) >= 1e6) return num(v / 1e6, 2) + 'M';
  return num(v);
};
const minsTo = (iso) => Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 60000));
const left = (iso) => {
  const m = minsTo(iso);
  if (m >= 1440) return Math.floor(m / 1440) + 'd ' + Math.floor((m % 1440) / 60) + 'h';
  if (m >= 60) return Math.floor(m / 60) + 'h ' + (m % 60) + 'm';
  return m + ' min';
};
const OFFICES = {
  head: 'Head of State',
  finance: 'Finance Minister',
  defense: 'Defense Minister',
  health: 'Health Minister'
};
const EMPTY = { countries: [], policy: [], offices: [], parties: [], elections: [], cands: [], laws: [], ledger: [] };

export default function Government() {
  const { profile, refresh } = useProfile();
  const cid = profile.country_id;
  const [tab, setTab] = useState('overview');
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
      supabase.from('countries').select('id,name,flag,treasury,approval,stability,gdp,currency_code').order('name'),
      supabase.from('country_policy').select('*'),
      supabase.from('office_board').select('*'),
      supabase.from('party_board').select('*').order('members', { ascending: false }),
      supabase.from('election_board').select('*').order('created_at', { ascending: false }).limit(5),
      supabase.from('candidate_board').select('*'),
      supabase.from('law_board').select('*').order('created_at', { ascending: false }).limit(15),
      supabase.from('treasury_ledger').select('*').eq('country_id', cid).order('id', { ascending: false }).limit(15)
    ]);
    const err = q.find((x) => x.error);
    if (err) setMsg({ type: 'error', text: err.error.message });
    setD({
      countries: q[0].data || [], policy: q[1].data || [], offices: q[2].data || [], parties: q[3].data || [],
      elections: q[4].data || [], cands: q[5].data || [], laws: q[6].data || [], ledger: q[7].data || []
    });
  }, [cid]);

  useEffect(() => {
    let alive = true;
    const run = async () => {
      await supabase.rpc('resolve_government');
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
        <h2>Government</h2>
        <p className="muted">Choose a country on the World page first.</p>
      </div>
    );
  }

  const me = d.countries.find((c) => c.id === cid);
  const pol = d.policy.find((p) => p.country_id === cid);
  const myOffices = d.offices.filter((o) => o.country_id === cid);
  const myOffice = myOffices.find((o) => o.holder_id === profile.id)?.office || null;
  const head = myOffices.find((o) => o.office === 'head');
  const heads = d.offices.filter((o) => o.office === 'head');
  const cd = (iso) => (iso ? minsTo(new Date(new Date(iso).getTime() + 60 * 60000).toISOString()) : 0);
  const taxCd = cd(pol?.last_tax_change_at);
  const svcCd = cd(pol?.last_services_at);
  const unit = me ? Math.ceil(Number(me.gdp) * 0.0002) : 0;
  const active = d.elections.find((e) => e.status !== 'closed');
  const last = d.elections.find((e) => e.status === 'closed');
  const candsOf = (id) => d.cands.filter((c) => c.election_id === id);
  const imCandidate = !!active && candsOf(active.id).some((c) => c.user_id === profile.id);
  const myParty = d.parties.find((p) => p.is_member);
  const openLaws = d.laws.filter((l) => l.status === 'voting');
  const pastLaws = d.laws.filter((l) => l.status !== 'voting');
  const lawKind = g('lk') || 'resolution';
  const tabs = [['overview', 'Overview'], ['elections', 'Elections'], ['parties', 'Parties'], ['laws', 'Laws']];

  return (
    <div>
      <h2>Government</h2>
      {msg && <div className={'msg ' + (msg.type === 'error' ? 'msg-error' : 'msg-ok')}>{msg.text}</div>}

      <div className="chips">
        {tabs.map(([k, l]) => (
          <button key={k} className={'chip' + (tab === k ? ' on' : '')} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>

      {tab === 'overview' && (
        <>
          <div className="panel wide">
            <h3>{me?.flag} {me?.name}</h3>
            <div className="cards">
              <div className="card"><span className="muted">Treasury</span><strong>{big(me?.treasury || 0)} credits</strong></div>
              <div className="card"><span className="muted">Income tax</span><strong>{num(pol?.income_tax ?? 0, 1)}%</strong></div>
              <div className="card"><span className="muted">Approval</span><strong>{me?.approval}%</strong></div>
              <div className="card"><span className="muted">Stability</span><strong>{me?.stability}/100</strong></div>
            </div>
            <p className="muted small">Income tax is withheld from salaries and paid into the national treasury. Credits are the shared base unit.</p>
          </div>

          <div className="panel wide">
            <h3>Government</h3>
            {myOffices.length === 0 && <p className="muted">No one holds office. Call an election on the Elections tab.</p>}
            {myOffices.map((o) => (
              <div className="li" key={o.office}>
                <span><strong>{OFFICES[o.office]}</strong> · {o.holder_name}</span>
                <span className="muted small">term ends in {left(o.term_end)}</span>
              </div>
            ))}
            <h3>Heads of state worldwide</h3>
            {heads.length === 0 && <p className="muted">No country has a head of state yet.</p>}
            {heads.map((o) => {
              const c = d.countries.find((x) => x.id === o.country_id);
              return (
                <div className="li" key={o.country_id}>
                  <span>{c?.flag} {c?.name}</span>
                  <span className="muted small">{o.holder_name}</span>
                </div>
              );
            })}
          </div>

          {myOffice && (
            <div className="panel wide">
              <h3>Executive powers · {OFFICES[myOffice]}</h3>
              {(myOffice === 'head' || myOffice === 'finance') && (
                <>
                  <p className="muted small">Raising tax lowers approval, cutting it raises approval. One change per hour. Rates go from 0 to 40 in steps of 0.5.</p>
                  <div className="row">
                    <input type="number" min="0" max="40" step="0.5"
                      placeholder={'New income tax % (now ' + num(pol?.income_tax ?? 0, 1) + ')'}
                      value={g('tax')} onChange={(e) => set('tax', e.target.value)} />
                    <button className="btn btn-primary" disabled={busy || taxCd > 0}
                      onClick={() => call('set_income_tax', { p_rate: Number(g('tax')) }, 'Tax rate updated.', () => set('tax', ''))}>
                      {taxCd > 0 ? 'Available in ' + taxCd + ' min' : 'Set tax rate'}
                    </button>
                  </div>
                </>
              )}

              <h3>National budget</h3>
              <p className="muted small">
                Defense moves treasury credits into the defense fund. Public services cost about {big(unit)} credits per step (up to 3 steps, +1 approval each), once per hour.
              </p>
              <div className="row">
                <select value={g('bt') || 'defense'} onChange={(e) => set('bt', e.target.value)}>
                  <option value="defense">Defense fund</option>
                  <option value="services">Public services</option>
                </select>
                <input type="number" min="0" step="0.01" placeholder="Amount in credits"
                  value={g('ba')} onChange={(e) => set('ba', e.target.value)} />
              </div>
              <button className="btn btn-primary" disabled={busy || ((g('bt') || 'defense') === 'services' && svcCd > 0)}
                onClick={() => call('allocate_budget', { p_target: g('bt') || 'defense', p_amount: Number(g('ba')) }, 'Budget allocated.', () => set('ba', ''))}>
                {(g('bt') || 'defense') === 'services' && svcCd > 0 ? 'Services available in ' + svcCd + ' min' : 'Allocate'}
              </button>

              {myOffice === 'head' && (
                <>
                  <h3>Appointments</h3>
                  {['finance', 'defense', 'health'].map((k) => {
                    const o = myOffices.find((x) => x.office === k);
                    return (
                      <div className="li" key={k}>
                        <span>{OFFICES[k]}: {o ? o.holder_name : <span className="muted">vacant</span>}</span>
                        {o && (
                          <button className="btn btn-dark" disabled={busy}
                            onClick={() => call('dismiss_minister', { p_office: k }, 'Minister dismissed.')}>
                            Dismiss
                          </button>
                        )}
                      </div>
                    );
                  })}
                  <div className="row">
                    <select value={g('mo') || 'finance'} onChange={(e) => set('mo', e.target.value)}>
                      <option value="finance">Finance Minister</option>
                      <option value="defense">Defense Minister</option>
                      <option value="health">Health Minister</option>
                    </select>
                    <input placeholder="Citizen username" value={g('mu')} onChange={(e) => set('mu', e.target.value)} />
                    <button className="btn btn-primary" disabled={busy}
                      onClick={() => call('appoint_minister', { p_office: g('mo') || 'finance', p_username: g('mu') }, 'Minister appointed.', () => set('mu', ''))}>
                      Appoint
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

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
        </>
      )}

      {tab === 'elections' && (
        <>
          <div className="panel wide">
            <h3>Head of state</h3>
            {head ? (
              <p>{head.holder_name} · term ends in {left(head.term_end)}</p>
            ) : (
              <p className="muted">The office is vacant.</p>
            )}
            {!head && !active && (
              <button className="btn btn-primary" disabled={busy}
                onClick={() => call('start_election', {}, 'Election called. Registration is open for 30 minutes.')}>
                Call an election
              </button>
            )}
            <p className="muted small">
              Registration lasts 30 min, then voting 30 min. The winner serves 7 days and can appoint ministers. Votes stay secret until the count.
            </p>
          </div>

          {active && (
            <div className="panel wide">
              <h3>Current election · {active.status}</h3>
              <p className="small">
                {active.status === 'registration'
                  ? 'Registration closes in ' + minsTo(active.reg_end) + ' min.'
                  : 'Voting closes in ' + minsTo(active.vote_end) + ' min.'}
              </p>
              {candsOf(active.id).length === 0 && <p className="muted">No candidates yet.</p>}
              {candsOf(active.id).map((c) => (
                <div className="li" key={c.id}>
                  <span>
                    <strong>{c.username}</strong>{c.party_name ? ' · ' + c.party_name : ''}<br />
                    <span className="muted small">{c.platform || 'No platform statement'}</span>
                  </span>
                  {active.status === 'voting' && !active.i_voted && (
                    <button className="btn btn-primary" disabled={busy}
                      onClick={() => call('cast_vote', { p_candidate: c.id }, 'Vote cast.')}>
                      Vote
                    </button>
                  )}
                </div>
              ))}
              {active.status === 'voting' && active.i_voted && <p className="pos small">You have voted.</p>}
              {active.status === 'registration' && !imCandidate && (
                <>
                  <div className="row">
                    <input maxLength={200} placeholder="Platform statement (optional)"
                      value={g('pl')} onChange={(e) => set('pl', e.target.value)} />
                  </div>
                  <button className="btn btn-primary" disabled={busy}
                    onClick={() => call('register_candidate', { p_platform: g('pl') }, 'You are a candidate.', () => set('pl', ''))}>
                    Run for office
                  </button>
                </>
              )}
              {imCandidate && active.status === 'registration' && <p className="pos small">You are registered as a candidate.</p>}
            </div>
          )}

          {last && (
            <div className="panel wide">
              <h3>Last result</h3>
              <p className="small">
                {last.winner_name ? last.winner_name + ' won with ' + last.total_votes + ' total votes cast.' : 'No winner: nobody voted or nobody ran.'}
              </p>
              {candsOf(last.id).map((c) => (
                <div className="li" key={c.id}>
                  <span>{c.username}{c.party_name ? ' · ' + c.party_name : ''}</span>
                  <span className="muted">{c.votes ?? 0} votes</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'parties' && (
        <>
          {!myParty && (
            <div className="panel wide">
              <h3>Found a party</h3>
              <div className="row">
                <input maxLength={30} placeholder="Party name" value={g('pn')} onChange={(e) => set('pn', e.target.value)} />
                <button className="btn btn-primary" disabled={busy}
                  onClick={() => call('create_party', { p_name: g('pn') }, 'Party founded.', () => set('pn', ''))}>
                  Create
                </button>
              </div>
            </div>
          )}
          <div className="panel wide">
            <h3>Parties in your country</h3>
            {d.parties.length === 0 && <p className="muted">No parties yet.</p>}
            {d.parties.map((p) => (
              <div className="li" key={p.id}>
                <span>
                  <strong>{p.name}</strong>{p.is_member ? ' (yours)' : ''}<br />
                  <span className="muted small">leader {p.leader_name} · {p.members} members</span>
                </span>
                {!myParty && (
                  <button className="btn btn-primary" disabled={busy}
                    onClick={() => call('join_party', { p_party: p.id }, 'You joined the party.')}>
                    Join
                  </button>
                )}
              </div>
            ))}
            {myParty && (
              <div className="row">
                {myParty.leader_id === profile.id ? (
                  <button className="btn btn-dark" disabled={busy}
                    onClick={() => window.confirm('Disband your party?') && call('disband_party', {}, 'Party disbanded.')}>
                    Disband party
                  </button>
                ) : (
                  <button className="btn btn-dark" disabled={busy}
                    onClick={() => call('leave_party', {}, 'You left the party.')}>
                    Leave party
                  </button>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {tab === 'laws' && (
        <>
          {myOffice && (
            <div className="panel wide">
              <h3>Propose a law</h3>
              <p className="muted small">Citizens vote for 30 minutes. It passes if yes votes beat no votes. A tax law sets the income tax rate when enacted.</p>
              <div className="row">
                <select value={lawKind} onChange={(e) => set('lk', e.target.value)}>
                  <option value="resolution">National resolution</option>
                  <option value="tax_rate">Income tax rate</option>
                </select>
                {lawKind === 'tax_rate' && (
                  <input type="number" min="0" max="40" step="0.5" placeholder="Tax %"
                    value={g('lv')} onChange={(e) => set('lv', e.target.value)} />
                )}
              </div>
              <div className="row">
                <input maxLength={80} placeholder="Title" value={g('lt')} onChange={(e) => set('lt', e.target.value)} />
              </div>
              <div className="row">
                <input maxLength={500} placeholder="Description (optional)" value={g('lb')} onChange={(e) => set('lb', e.target.value)} />
              </div>
              <button className="btn btn-primary" disabled={busy}
                onClick={() => call('propose_law', { p_kind: lawKind, p_title: g('lt'), p_body: g('lb'), p_value: lawKind === 'tax_rate' ? Number(g('lv')) : null }, 'Law proposed.', () => { set('lt', ''); set('lb', ''); set('lv', ''); })}>
                Propose
              </button>
            </div>
          )}

          <div className="panel wide">
            <h3>Open votes</h3>
            {openLaws.length === 0 && <p className="muted">No laws are being voted on.</p>}
            {openLaws.map((l) => (
              <div className="li" key={l.id}>
                <span>
                  <strong>{l.title}</strong>{l.kind === 'tax_rate' ? ' · tax ' + num(l.value, 1) + '%' : ''}<br />
                  <span className="muted small">
                    {l.body || 'No description'} · by {l.proposer_name || 'unknown'} · {minsTo(l.closes_at)} min left · yes {l.yes_votes} / no {l.no_votes}
                  </span>
                </span>
                {l.my_vote === null && minsTo(l.closes_at) > 0 ? (
                  <span className="row" style={{ margin: 0 }}>
                    <button className="btn btn-primary" disabled={busy}
                      onClick={() => call('vote_law', { p_law: l.id, p_yes: true }, 'Vote recorded.')}>Yes</button>
                    <button className="btn btn-dark" disabled={busy}
                      onClick={() => call('vote_law', { p_law: l.id, p_yes: false }, 'Vote recorded.')}>No</button>
                  </span>
                ) : (
                  <span className="muted small">{l.my_vote === null ? 'closing' : 'you voted ' + (l.my_vote ? 'yes' : 'no')}</span>
                )}
              </div>
            ))}
          </div>

          <div className="panel wide">
            <h3>Law history</h3>
            {pastLaws.length === 0 && <p className="muted">Nothing yet.</p>}
            {pastLaws.map((l) => (
              <div className="li" key={l.id}>
                <span><strong>{l.title}</strong><br /><span className="muted small">yes {l.yes_votes} / no {l.no_votes}</span></span>
                <span className="tag">{l.status}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
