import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../config/supabase';
import { useProfile } from '../../context/ProfileContext';

const newKey = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Date.now() + '-' + Math.random().toString(16).slice(2);
const num = (n, d = 0) =>
  Number(n).toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
const pretty = (s) => String(s).replace(/_/g, ' ');
const minsTo = (iso) => Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 60000));

const EMPTY = {
  svc: null, branches: [], ranks: [], forces: [], equip: [], types: [], techs: [], ctech: [],
  fund: null, roster: [], ops: [], stats: [], countries: [], cur: []
};

export default function Military() {
  const { profile, refresh } = useProfile();
  const [tab, setTab] = useState('service');
  const [d, setD] = useState(EMPTY);
  const [f, setF] = useState({});
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [, setTick] = useState(0);

  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const g = (k) => (f[k] === undefined ? '' : f[k]);

  const load = useCallback(async () => {
    const q = await Promise.all([
      supabase.from('military_service').select('*').maybeSingle(),
      supabase.from('branches').select('*').order('code'),
      supabase.from('ranks').select('*').order('level'),
      supabase.from('country_forces').select('*'),
      supabase.from('country_equipment').select('*'),
      supabase.from('equipment_types').select('*').order('cost_base'),
      supabase.from('techs').select('*').order('cost_base'),
      supabase.from('country_tech').select('*'),
      supabase.from('military_fund').select('*').maybeSingle(),
      supabase.from('military_roster').select('*').order('rank_level', { ascending: false }),
      supabase.from('operation_reports').select('*').order('started_at', { ascending: false }).limit(20),
      supabase.from('military_stats').select('*').order('wins', { ascending: false }),
      supabase.from('countries').select('id,name,flag').order('name'),
      supabase.from('currencies').select('code,base_value,country_id')
    ]);
    const err = q.find((x) => x.error);
    if (err) setMsg({ type: 'error', text: err.error.message });
    setD({
      svc: q[0].data, branches: q[1].data || [], ranks: q[2].data || [], forces: q[3].data || [],
      equip: q[4].data || [], types: q[5].data || [], techs: q[6].data || [], ctech: q[7].data || [],
      fund: q[8].data, roster: q[9].data || [], ops: q[10].data || [], stats: q[11].data || [],
      countries: q[12].data || [], cur: q[13].data || []
    });
  }, []);

  useEffect(() => {
    let alive = true;
    const run = async () => {
      await supabase.rpc('resolve_operations');
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

  if (!profile.country_id) {
    return (
      <div>
        <h2>Military</h2>
        <p className="muted">Choose a country on the World page first.</p>
      </div>
    );
  }

  const svc = d.svc;
  const rank = svc?.rank_level || 0;
  const rankName = (l) => d.ranks.find((r) => r.level === l)?.name || '';
  const nextRank = d.ranks.find((r) => r.level === rank + 1);
  const homeCur = d.cur.find((c) => c.country_id === profile.country_id);
  const rate = Number(homeCur?.base_value || 1);
  const owned = (code) => Number(d.equip.find((x) => x.equipment_code === code)?.quantity || 0);
  const trainCd = svc?.last_training_at ? minsTo(new Date(new Date(svc.last_training_at).getTime() + 30 * 60000).toISOString()) : 0;
  const isDone = (ct) => new Date(ct.finish_at).getTime() <= Date.now();
  const techBonus = d.ctech.filter(isDone).reduce((s, ct) => s + Number(d.techs.find((t) => t.code === ct.tech_code)?.bonus_pct || 0), 0);
  const targets = d.countries.filter((c) => c.id !== profile.country_id);
  const tgt = Number(g('tgt')) || targets[0]?.id;
  const opBranch = g('ob') || d.branches[0]?.code || '';
  const opKind = g('ok') || 'exercise';

  const tabs = [['service', 'Service'], ['forces', 'Forces'], ['research', 'Research'], ['ops', 'Operations'], ['stats', 'Statistics']];

  return (
    <div>
      <h2>Military</h2>
      {msg && <div className={'msg ' + (msg.type === 'error' ? 'msg-error' : 'msg-ok')}>{msg.text}</div>}

      <div className="chips">
        {tabs.map(([k, l]) => (
          <button key={k} className={'chip' + (tab === k ? ' on' : '')} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>

      {tab === 'service' && (
        <>
          {!svc ? (
            <div className="panel wide">
              <h3>Enlist</h3>
              <p className="muted small">Pick a branch. You start as a Recruit and earn rank by training. Rank 5 unlocks force management, rank 6 research, rank 7 raids.</p>
              <div className="row">
                <select value={g('eb') || d.branches[0]?.code || ''} onChange={(e) => set('eb', e.target.value)}>
                  {d.branches.map((b) => <option key={b.code} value={b.code}>{b.name}</option>)}
                </select>
                <button className="btn btn-primary" disabled={busy}
                  onClick={() => call('enlist', { p_branch: g('eb') || d.branches[0]?.code }, 'You have enlisted.')}>
                  Enlist
                </button>
              </div>
              <p className="muted small">{d.branches.find((b) => b.code === (g('eb') || d.branches[0]?.code))?.description}</p>
            </div>
          ) : (
            <div className="panel wide">
              <h3>{rankName(rank)}</h3>
              <div className="cards">
                <div className="card"><span className="muted">Branch</span><strong>{pretty(svc.branch)}</strong></div>
                <div className="card"><span className="muted">Rank</span><strong>{rank} · {rankName(rank)}</strong></div>
                <div className="card"><span className="muted">Experience</span><strong>{num(svc.xp)} XP</strong></div>
              </div>
              <p className="muted small">
                {nextRank ? num(nextRank.min_xp - svc.xp) + ' XP to ' + nextRank.name : 'Highest rank reached.'}
              </p>
              <div className="row">
                <button className="btn btn-primary" disabled={busy || trainCd > 0}
                  onClick={() => call('train', {}, 'Training complete: +100 XP.')}>
                  {trainCd > 0 ? 'Train again in ' + trainCd + ' min' : 'Train (+100 XP)'}
                </button>
                <button className="btn btn-dark" disabled={busy}
                  onClick={() => window.confirm('Leave service? You lose your rank and XP.') && call('leave_service', {}, 'You left service.')}>
                  Leave service
                </button>
              </div>
            </div>
          )}
          <div className="panel wide">
            <h3>National roster</h3>
            {d.roster.length === 0 && <p className="muted">No one from your country has enlisted yet.</p>}
            {d.roster.map((r) => (
              <div className="li" key={r.user_id}>
                <span>{r.username} · {r.rank_name}</span>
                <span className="muted small">{pretty(r.branch)} · {num(r.xp)} XP</span>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === 'forces' && (
        <>
          <div className="panel wide">
            <h3>Defense fund</h3>
            <p className="muted small">
              Balance: {d.fund ? num(d.fund.balance) : '0'} credits. Any citizen can donate. Officers (rank 5+) spend it on personnel, equipment and supplies; rank 6+ on research.
            </p>
            <div className="row">
              <input type="number" min="0" step="0.01" placeholder={'Donation in ' + (homeCur?.code || 'cash')}
                value={g('don')} onChange={(e) => set('don', e.target.value)} />
              <button className="btn btn-primary" disabled={busy}
                onClick={() => call('donate_defense', { p_amount: Number(g('don')), p_key: newKey() }, 'Donation received.', () => set('don', ''))}>
                Donate
              </button>
            </div>
            {Number(g('don')) > 0 && <p className="muted small">Adds about {num(Number(g('don')) * rate, 2)} credits.</p>}
          </div>

          {d.branches.map((b) => {
            const fr = d.forces.find((x) => x.branch === b.code);
            if (!fr) return null;
            const eqs = d.types.filter((t) => t.branch === b.code);
            const ep = eqs.reduce((s, t) => s + Number(t.power) * owned(t.code), 0);
            const power = (fr.personnel * Number(fr.readiness)) / 100 + ep;
            return (
              <div className="panel wide" key={b.code}>
                <h3>{b.name}</h3>
                <div className="cards">
                  <div className="card"><span className="muted">Personnel</span><strong>{num(fr.personnel)}</strong></div>
                  <div className="card"><span className="muted">Readiness</span><strong>{num(fr.readiness, 1)}%</strong></div>
                  <div className="card"><span className="muted">Supplies</span><strong>{num(fr.supplies)}</strong></div>
                  <div className="card"><span className="muted">Power estimate</span><strong>{num(power)}</strong></div>
                </div>
                {eqs.map((t) => (
                  <div className="li" key={t.code}>
                    <span>
                      <strong>{t.name}</strong> × {owned(t.code)}<br />
                      <span className="muted small">power {num(t.power)} · cost {num(t.cost_base)}</span>
                    </span>
                    {rank >= 5 && (
                      <span className="row" style={{ margin: 0 }}>
                        <input type="number" min="1" max="100" placeholder="Qty" style={{ maxWidth: 80 }}
                          value={g('e_' + t.code)} onChange={(e) => set('e_' + t.code, e.target.value)} />
                        <button className="btn btn-primary" disabled={busy}
                          onClick={() => call('buy_equipment', { p_code: t.code, p_qty: Number(g('e_' + t.code)) }, 'Equipment purchased.', () => set('e_' + t.code, ''))}>
                          Buy
                        </button>
                      </span>
                    )}
                  </div>
                ))}
                {rank >= 5 && (
                  <>
                    <div className="row">
                      <input type="number" min="1" max="5000" placeholder="Recruits (100 each)"
                        value={g('r_' + b.code)} onChange={(e) => set('r_' + b.code, e.target.value)} />
                      <button className="btn btn-primary" disabled={busy}
                        onClick={() => call('recruit_personnel', { p_branch: b.code, p_qty: Number(g('r_' + b.code)) }, 'Recruits enlisted.', () => set('r_' + b.code, ''))}>
                        Recruit
                      </button>
                    </div>
                    <div className="row">
                      <input type="number" min="1" placeholder="Supplies (2 each)"
                        value={g('s_' + b.code)} onChange={(e) => set('s_' + b.code, e.target.value)} />
                      <button className="btn btn-dark" disabled={busy}
                        onClick={() => call('resupply', { p_branch: b.code, p_qty: Number(g('s_' + b.code)) }, 'Supplies delivered.', () => set('s_' + b.code, ''))}>
                        Resupply
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
          <p className="muted small">New recruits start at 30% readiness, which lowers the branch average until they train.</p>
        </>
      )}

      {tab === 'research' && (
        <div className="panel wide">
          <h3>Military research</h3>
          <p className="muted small">Completed projects add +{num(techBonus, 1)}% to your combat power. One project at a time. Rank 6 (Captain) required to start.</p>
          {d.techs.map((t) => {
            const ct = d.ctech.find((x) => x.tech_code === t.code);
            const done = ct && isDone(ct);
            const running = ct && !done;
            const reqOk = !t.requires || d.ctech.some((x) => x.tech_code === t.requires && isDone(x));
            return (
              <div className="li" key={t.code}>
                <span>
                  <strong>{t.name}</strong> <span className="tag">+{num(t.bonus_pct, 0)}%</span><br />
                  <span className="muted small">
                    {t.description} · cost {num(t.cost_base)} · {t.minutes} min{t.requires ? ' · needs ' + t.requires : ''}
                  </span>
                </span>
                {done && <span className="pos">Complete</span>}
                {running && <span className="muted">{minsTo(ct.finish_at)} min left</span>}
                {!ct && (
                  <button className="btn btn-primary" disabled={busy || rank < 6 || !reqOk}
                    onClick={() => call('start_research', { p_tech: t.code }, 'Research started.')}>
                    {reqOk ? 'Start' : 'Locked'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {tab === 'ops' && (
        <>
          <div className="panel wide">
            <h3>Launch operation</h3>
            {rank < 5 ? (
              <p className="muted">Reach rank 5 (Lieutenant) to run exercises, rank 7 (Major) for raids.</p>
            ) : (
              <>
                <p className="muted small">
                  Exercises (15 min) raise readiness. Raids (30 min) are fictional strikes on another country, resolved on the server with a seeded roll. Committed personnel are away until the operation ends.
                </p>
                <div className="row">
                  <select value={opKind} onChange={(e) => set('ok', e.target.value)}>
                    <option value="exercise">Exercise</option>
                    <option value="raid" disabled={rank < 7}>Raid (rank 7+)</option>
                  </select>
                  <select value={opBranch} onChange={(e) => set('ob', e.target.value)}>
                    {d.branches.map((b) => <option key={b.code} value={b.code}>{b.name}</option>)}
                  </select>
                </div>
                {opKind === 'raid' && (
                  <div className="row">
                    <select value={tgt || ''} onChange={(e) => set('tgt', e.target.value)}>
                      {targets.map((c) => <option key={c.id} value={c.id}>{c.flag} {c.name}</option>)}
                    </select>
                  </div>
                )}
                <div className="row">
                  <input type="number" min="50" placeholder="Personnel to commit (min 50)"
                    value={g('op')} onChange={(e) => set('op', e.target.value)} />
                  <button className="btn btn-primary" disabled={busy}
                    onClick={() => call('launch_operation', { p_branch: opBranch, p_kind: opKind, p_target: opKind === 'raid' ? tgt : null, p_personnel: Number(g('op')) }, 'Operation launched.', () => set('op', ''))}>
                    Launch
                  </button>
                </div>
                <p className="muted small">Costs supplies: 10% of committed personnel for exercises, 20% for raids. Max 3 active operations.</p>
              </>
            )}
          </div>

          <h3>Operations and battle reports</h3>
          {d.ops.length === 0 && <p className="muted">No operations involving your country yet.</p>}
          {d.ops.map((o) => {
            const ours = o.country_id === profile.country_id;
            const label = o.status === 'active' ? 'active'
              : o.outcome === 'completed' ? 'completed'
              : ours ? o.outcome : (o.outcome === 'victory' ? 'defeat' : 'victory');
            return (
              <div className="panel wide" key={o.id}>
                <div className="row" style={{ justifyContent: 'space-between', margin: 0 }}>
                  <strong>
                    {o.att_flag} {o.att_name}{o.kind === 'raid' ? ' → ' + o.tgt_flag + ' ' + o.tgt_name : ' · exercise'}
                  </strong>
                  <span className="tag">{label}</span>
                </div>
                <p className="muted small">
                  {pretty(o.branch)} · {num(o.personnel)} personnel · {new Date(o.started_at).toLocaleString()}
                </p>
                {o.status === 'active'
                  ? <p className="small">Resolves in about {minsTo(o.resolve_at)} min.</p>
                  : <p className="small">{o.report}</p>}
              </div>
            );
          })}
        </>
      )}

      {tab === 'stats' && (
        <div className="panel wide">
          <h3>Military statistics</h3>
          <div className="tablewrap">
            <table className="table">
              <thead><tr><th>Country</th><th>Raid wins</th><th>Raid losses</th><th>Members</th></tr></thead>
              <tbody>
                {d.stats.map((s) => (
                  <tr key={s.country_id}>
                    <td>{s.flag} {s.name}</td><td>{s.wins}</td><td>{s.losses}</td><td>{s.members}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted small">Other countries' force levels are hidden. Intelligence reports arrive in a later phase.</p>
        </div>
      )}
    </div>
  );
}
