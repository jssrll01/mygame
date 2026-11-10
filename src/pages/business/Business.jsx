import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../config/supabase';
import { useProfile } from '../../context/ProfileContext';

const newKey = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Date.now() + '-' + Math.random().toString(16).slice(2);
const num = (n, d = 2) =>
  Number(n).toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
const INDUSTRIES = ['mining', 'agriculture', 'forestry', 'energy', 'manufacturing'];

export default function Business() {
  const { profile, refresh } = useProfile();
  const [tab, setTab] = useState('mine');
  const [data, setData] = useState({ biz: [], staff: [], inv: [], runs: [], jobs: [], offers: [], items: [], recipes: [], cur: [] });
  const [ledger, setLedger] = useState([]);
  const [sel, setSel] = useState('');
  const [f, setF] = useState({});
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [, setTick] = useState(0);

  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const g = (k) => (f[k] === undefined ? '' : f[k]);

  const load = useCallback(async () => {
    const [b, s, i, r, j, o, it, rc, c] = await Promise.all([
      supabase.from('businesses').select('*').order('created_at'),
      supabase.from('business_staff').select('*').order('hired_at'),
      supabase.from('business_inventory').select('*'),
      supabase.from('production_runs').select('*').eq('collected', false).order('finish_at'),
      supabase.from('job_board').select('*'),
      supabase.from('offer_board').select('*').order('created_at', { ascending: false }),
      supabase.from('items').select('*').order('code'),
      supabase.from('recipes').select('*').order('code'),
      supabase.from('currencies').select('code,base_value')
    ]);
    const err = b.error || s.error || i.error || r.error || j.error || o.error || it.error || rc.error || c.error;
    if (err) setMsg({ type: 'error', text: err.message });
    setData({
      biz: b.data || [], staff: s.data || [], inv: i.data || [], runs: r.data || [],
      jobs: j.data || [], offers: o.data || [], items: it.data || [], recipes: rc.data || [], cur: c.data || []
    });
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data: list } = await supabase.from('businesses').select('id');
      for (const x of list || []) {
        await supabase.rpc('process_payroll', { p_business: x.id });
        await supabase.rpc('collect_production', { p_business: x.id });
      }
      if (alive) await load();
    })();
    const t = setInterval(() => setTick((n) => n + 1), 20000);
    return () => { alive = false; clearInterval(t); };
  }, [load]);

  const mine = data.biz.filter((x) => x.owner_id === profile.id);
  const b = data.biz.find((x) => x.id === sel) || data.biz[0];
  const isOwner = !!b && b.owner_id === profile.id;
  const bid = b?.id;

  useEffect(() => {
    if (!bid || !isOwner) { setLedger([]); return; }
    supabase.from('business_ledger').select('*').eq('business_id', bid).order('id', { ascending: false }).limit(15)
      .then((r) => setLedger(r.data || []));
  }, [bid, isOwner, data.biz]);

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

  const rate = Number(data.cur.find((c) => c.code === b?.currency_code)?.base_value || 1);
  const itemName = (code) => data.items.find((x) => x.code === code)?.name || code;
  const bInv = data.inv.filter((x) => x.business_id === bid && Number(x.quantity) > 0);
  const bRuns = data.runs.filter((x) => x.business_id === bid);
  const bStaff = data.staff.filter((x) => x.business_id === bid);
  const bJobs = data.jobs.filter((x) => x.business_id === bid);
  const bOffers = data.offers.filter((x) => x.seller_business === bid);
  const recipes = data.recipes.filter((x) => x.industry === b?.industry);
  const minutesLeft = (r) => Math.max(0, Math.ceil((new Date(r.finish_at).getTime() - Date.now()) / 60000));
  const anyReady = bRuns.some((r) => minutesLeft(r) === 0);
  const myIds = mine.map((x) => x.id);
  const myJobs = data.staff.filter((x) => x.user_id === profile.id);
  const openJobs = data.jobs.filter((x) => !myIds.includes(x.business_id));
  const openOffers = data.offers.filter((x) => !myIds.includes(x.seller_business));
  const buyer = g('buyer') || mine[0]?.id || '';
  const marketItem = g('mi') || data.items[0]?.code || '';
  const itemPx = Number(data.items.find((x) => x.code === marketItem)?.price || 0) / rate;

  return (
    <div>
      <h2>Business</h2>
      {msg && <div className={'msg ' + (msg.type === 'error' ? 'msg-error' : 'msg-ok')}>{msg.text}</div>}

      <div className="chips">
        <button className={'chip' + (tab === 'mine' ? ' on' : '')} onClick={() => setTab('mine')}>My companies</button>
        <button className={'chip' + (tab === 'jobs' ? ' on' : '')} onClick={() => setTab('jobs')}>Job board</button>
        <button className={'chip' + (tab === 'contracts' ? ' on' : '')} onClick={() => setTab('contracts')}>Contracts</button>
      </div>

      {tab === 'mine' && (
        <>
          <div className="panel wide">
            <h3>Register a company</h3>
            <p className="muted small">Costs 1,000 of your national currency in cash. Maximum 5 companies. You need cash first (Banking).</p>
            <div className="row">
              <input placeholder="Company name" maxLength={40} value={g('name')} onChange={(e) => set('name', e.target.value)} />
              <select value={g('ind') || 'mining'} onChange={(e) => set('ind', e.target.value)}>
                {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>
            <button className="btn btn-primary" disabled={busy}
              onClick={() => call('create_business', { p_name: g('name'), p_industry: g('ind') || 'mining', p_key: newKey() }, 'Company registered.', () => set('name', ''))}>
              Register
            </button>
          </div>

          {data.biz.length > 0 && (
            <div className="chips">
              {data.biz.map((x) => (
                <button key={x.id} className={'chip' + (x.id === bid ? ' on' : '')} onClick={() => setSel(x.id)}>
                  {x.name}{x.owner_id !== profile.id ? ' (employee)' : ''}
                </button>
              ))}
            </div>
          )}

          {myJobs.length > 0 && (
            <div className="panel wide">
              <h3>My employment</h3>
              {myJobs.map((e) => (
                <div className="li" key={e.id}>
                  <span>{data.biz.find((x) => x.id === e.business_id)?.name || 'Company'} · {e.title} · {num(e.salary)} / hour</span>
                  <button className="btn btn-dark" disabled={busy}
                    onClick={() => window.confirm('Quit this job?') && call('quit_job', { p_employee: e.id }, 'You quit.')}>
                    Quit
                  </button>
                </div>
              ))}
            </div>
          )}

          {b && (
            <>
              <div className="panel wide">
                <h3>{b.name}</h3>
                <p className="muted small">{b.industry} · {b.currency_code} · {isOwner ? 'owner' : 'employee'}</p>
                <div className="cards">
                  <div className="card"><span className="muted">Treasury</span><strong>{num(b.treasury)} {b.currency_code}</strong></div>
                  <div className="card"><span className="muted">Active runs</span><strong>{bRuns.length}</strong></div>
                  {isOwner && <div className="card"><span className="muted">Staff</span><strong>{bStaff.length}</strong></div>}
                </div>
                {isOwner && (
                  <>
                    <div className="row">
                      <input type="number" min="0" step="0.01" placeholder="Amount" value={g('fund')} onChange={(e) => set('fund', e.target.value)} />
                      <button className="btn btn-primary" disabled={busy}
                        onClick={() => call('fund_business', { p_business: b.id, p_amount: Number(g('fund')), p_key: newKey() }, 'Company funded.', () => set('fund', ''))}>
                        Fund from wallet
                      </button>
                      <button className="btn btn-dark" disabled={busy}
                        onClick={() => call('draw_from_business', { p_business: b.id, p_amount: Number(g('fund')), p_key: newKey() }, 'Withdrawn to wallet.', () => set('fund', ''))}>
                        Withdraw to wallet
                      </button>
                    </div>
                    <p className="muted small">Salaries are paid hourly from the treasury. Without enough funds, that payment is skipped.</p>
                  </>
                )}
              </div>

              <div className="panel wide">
                <h3>Inventory</h3>
                {bInv.length === 0 && <p className="muted">Empty.</p>}
                <div className="cards">
                  {bInv.map((x) => (
                    <div className="card" key={x.item_code}>
                      <span className="muted">{itemName(x.item_code)}</span>
                      <strong>{num(x.quantity)}</strong>
                    </div>
                  ))}
                </div>
              </div>

              <div className="panel wide">
                <h3>Production</h3>
                {recipes.map((r) => (
                  <div className="li" key={r.code}>
                    <span>
                      <strong>{r.name}</strong><br />
                      <span className="muted small">
                        {r.input_item ? 'Needs ' + num(r.input_qty, 0) + ' ' + itemName(r.input_item) : 'No inputs'} · makes {num(r.output_qty, 0)} {itemName(r.output_item)} · {r.minutes} min · cost {num(Number(r.cost_base) / rate)} {b.currency_code}
                      </span>
                    </span>
                    <button className="btn btn-primary" disabled={busy}
                      onClick={() => call('start_production', { p_business: b.id, p_recipe: r.code }, 'Production started.')}>
                      Start
                    </button>
                  </div>
                ))}
                {bRuns.length > 0 && <h3>Running</h3>}
                {bRuns.map((r) => (
                  <div className="li" key={r.id}>
                    <span>{data.recipes.find((x) => x.code === r.recipe_code)?.name}</span>
                    <span className="muted">{minutesLeft(r) === 0 ? 'ready' : minutesLeft(r) + ' min left'}</span>
                  </div>
                ))}
                {anyReady && (
                  <button className="btn btn-primary" disabled={busy}
                    onClick={() => call('collect_production', { p_business: b.id }, 'Finished goods collected.')}>
                    Collect finished runs
                  </button>
                )}
                <p className="muted small">Slots = 2 + number of employees. Runs also finish while you are offline.</p>
              </div>

              {isOwner && (
                <>
                  <div className="panel wide">
                    <h3>Supplier market</h3>
                    <p className="muted small">Buy raw materials or sell output. 2% fee, and large orders move the price.</p>
                    <div className="row">
                      <select value={marketItem} onChange={(e) => set('mi', e.target.value)}>
                        {data.items.map((x) => <option key={x.code} value={x.code}>{x.name}</option>)}
                      </select>
                      <input type="number" min="0" step="0.01" placeholder="Quantity" value={g('mq')} onChange={(e) => set('mq', e.target.value)} />
                    </div>
                    <p className="small">Price now: about {num(itemPx)} {b.currency_code} each</p>
                    <div className="row">
                      <button className="btn btn-primary" disabled={busy}
                        onClick={() => call('buy_item', { p_business: b.id, p_item: marketItem, p_qty: Number(g('mq')), p_key: newKey() }, 'Bought.', () => set('mq', ''))}>
                        Buy
                      </button>
                      <button className="btn btn-dark" disabled={busy}
                        onClick={() => call('sell_item', { p_business: b.id, p_item: marketItem, p_qty: Number(g('mq')), p_key: newKey() }, 'Sold.', () => set('mq', ''))}>
                        Sell
                      </button>
                    </div>
                  </div>

                  <div className="panel wide">
                    <h3>Staff</h3>
                    {bStaff.length === 0 && <p className="muted">No employees.</p>}
                    {bStaff.map((e) => (
                      <div className="li" key={e.id}>
                        <span>{e.username} · {e.title} · {num(e.salary)} / hour</span>
                        <button className="btn btn-dark" disabled={busy}
                          onClick={() => window.confirm('Fire ' + e.username + '?') && call('fire_employee', { p_employee: e.id }, 'Employee removed.')}>
                          Fire
                        </button>
                      </div>
                    ))}
                    <h3>Open positions</h3>
                    {bJobs.map((j) => (
                      <div className="li" key={j.id}>
                        <span>{j.title} · {num(j.salary)} / hour</span>
                        <button className="btn btn-dark" disabled={busy}
                          onClick={() => call('cancel_job', { p_job: j.id }, 'Position removed.')}>
                          Remove
                        </button>
                      </div>
                    ))}
                    <div className="row">
                      <input placeholder="Job title" maxLength={40} value={g('jt')} onChange={(e) => set('jt', e.target.value)} />
                      <input type="number" min="0" step="0.01" placeholder="Salary per hour" value={g('js')} onChange={(e) => set('js', e.target.value)} />
                    </div>
                    <button className="btn btn-primary" disabled={busy}
                      onClick={() => call('post_job', { p_business: b.id, p_title: g('jt'), p_salary: Number(g('js')) }, 'Position posted.', () => { set('jt', ''); set('js', ''); })}>
                      Post position
                    </button>
                  </div>

                  <div className="panel wide">
                    <h3>Contract offers</h3>
                    <p className="muted small">Goods are held in escrow while an offer is listed. Another player's company can buy it (1% fee, same currency only).</p>
                    {bOffers.map((o) => (
                      <div className="li" key={o.id}>
                        <span>{num(o.quantity)} {o.item_name} @ {num(o.unit_price)} {o.currency_code}</span>
                        <button className="btn btn-dark" disabled={busy}
                          onClick={() => call('cancel_offer', { p_offer: o.id }, 'Offer cancelled, goods returned.')}>
                          Cancel
                        </button>
                      </div>
                    ))}
                    <div className="row">
                      <select value={g('oi') || bInv[0]?.item_code || ''} onChange={(e) => set('oi', e.target.value)}>
                        {bInv.map((x) => <option key={x.item_code} value={x.item_code}>{itemName(x.item_code)} ({num(x.quantity)})</option>)}
                      </select>
                      <input type="number" min="0" step="0.01" placeholder="Quantity" value={g('oq')} onChange={(e) => set('oq', e.target.value)} />
                      <input type="number" min="0" step="0.01" placeholder="Price per unit" value={g('op')} onChange={(e) => set('op', e.target.value)} />
                    </div>
                    <button className="btn btn-primary" disabled={busy || bInv.length === 0}
                      onClick={() => call('create_offer', { p_business: b.id, p_item: g('oi') || bInv[0]?.item_code, p_qty: Number(g('oq')), p_unit_price: Number(g('op')) }, 'Offer listed.', () => { set('oq', ''); set('op', ''); })}>
                      List offer
                    </button>
                  </div>

                  <div className="panel wide">
                    <h3>Company ledger</h3>
                    {ledger.length === 0 && <p className="muted">No entries yet.</p>}
                    <div className="tablewrap">
                      <table className="table">
                        <thead><tr><th>Time</th><th>Type</th><th>Amount</th><th>Note</th></tr></thead>
                        <tbody>
                          {ledger.map((t) => (
                            <tr key={t.id}>
                              <td>{new Date(t.created_at).toLocaleString()}</td>
                              <td>{t.kind}</td>
                              <td className={t.direction === 'credit' ? 'pos' : 'neg'}>
                                {t.direction === 'credit' ? '+' : '-'}{num(t.amount)}
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
            </>
          )}
        </>
      )}

      {tab === 'jobs' && (
        <div className="panel wide">
          <h3>Open positions</h3>
          <p className="muted small">You can hold up to 3 jobs. Pay arrives in your cash wallet every hour while the company can afford it.</p>
          {openJobs.length === 0 && <p className="muted">No open positions.</p>}
          {openJobs.map((j) => (
            <div className="li" key={j.id}>
              <span>
                <strong>{j.title}</strong> at {j.business_name}<br />
                <span className="muted small">{j.industry} · owner {j.owner_name} · {num(j.salary)} {j.currency_code} / hour</span>
              </span>
              <button className="btn btn-primary" disabled={busy}
                onClick={() => call('take_job', { p_job: j.id }, 'You are hired.')}>
                Take job
              </button>
            </div>
          ))}
        </div>
      )}

      {tab === 'contracts' && (
        <div className="panel wide">
          <h3>Contract offers from other companies</h3>
          {mine.length === 0 ? (
            <p className="muted">Register a company to buy contracts.</p>
          ) : (
            <div className="row">
              <span className="muted">Buy with</span>
              <select value={buyer} onChange={(e) => set('buyer', e.target.value)}>
                {mine.map((x) => <option key={x.id} value={x.id}>{x.name} ({x.currency_code})</option>)}
              </select>
            </div>
          )}
          {openOffers.length === 0 && <p className="muted">No offers right now.</p>}
          {openOffers.map((o) => (
            <div className="li" key={o.id}>
              <span>
                <strong>{num(o.quantity)} {o.item_name}</strong> from {o.business_name}<br />
                <span className="muted small">{num(o.unit_price)} {o.currency_code} each · total {num(o.quantity * o.unit_price)} (+1% fee)</span>
              </span>
              <button className="btn btn-primary" disabled={busy || !buyer}
                onClick={() => call('accept_offer', { p_offer: o.id, p_buyer_business: buyer, p_key: newKey() }, 'Contract completed.')}>
                Buy
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
