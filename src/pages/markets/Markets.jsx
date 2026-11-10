import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../config/supabase';
import { useProfile } from '../../context/ProfileContext';

const newKey = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Date.now() + '-' + Math.random().toString(16).slice(2);
const num = (n, d = 2) =>
  Number(n).toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });

function Spark({ points }) {
  if (points.length < 2) return <span className="muted small">No history</span>;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const d = points
    .map((p, i) => ((i / (points.length - 1)) * 100) + ',' + (27 - ((p - min) / span) * 25))
    .join(' ');
  const up = points[points.length - 1] >= points[0];
  return (
    <svg viewBox="0 0 100 28" className="spark" preserveAspectRatio="none">
      <polyline points={d} fill="none" stroke={up ? '#16A34A' : '#DC2626'} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export default function Markets() {
  const { profile, refresh } = useProfile();
  const [tab, setTab] = useState('commodities');
  const [currencies, setCurrencies] = useState([]);
  const [commodities, setCommodities] = useState([]);
  const [history, setHistory] = useState({});
  const [holdings, setHoldings] = useState({});
  const [gems, setGems] = useState([]);
  const [wallets, setWallets] = useState([]);
  const [cur, setCur] = useState('');
  const [qty, setQty] = useState({});
  const [listPx, setListPx] = useState({});
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [c, cm, h, ho, g, w] = await Promise.all([
      supabase.from('currencies').select('code,name,base_value,country_id').order('code'),
      supabase.from('commodities').select('*').order('code'),
      supabase.from('commodity_price_history').select('commodity_code,price').order('id', { ascending: false }).limit(400),
      supabase.from('commodity_holdings').select('*'),
      supabase.from('gemstone_market').select('*').order('est_value_base', { ascending: false }),
      supabase.from('wallets').select('*')
    ]);
    const err = c.error || cm.error || h.error || ho.error || g.error || w.error;
    if (err) setMsg({ type: 'error', text: err.message });
    setCurrencies(c.data || []);
    setCommodities(cm.data || []);
    const hm = {};
    (h.data || []).forEach((r) => { (hm[r.commodity_code] = hm[r.commodity_code] || []).push(Number(r.price)); });
    Object.keys(hm).forEach((k) => { hm[k] = hm[k].reverse().slice(-40); });
    setHistory(hm);
    const hold = {};
    (ho.data || []).forEach((r) => { hold[r.commodity_code] = Number(r.quantity); });
    setHoldings(hold);
    setGems(g.data || []);
    setWallets(w.data || []);
  }, []);

  useEffect(() => { load(); }, [load]);

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

  const homeCur = currencies.find((c) => c.country_id === profile.country_id)?.code;
  const payCur = cur || homeCur || currencies[0]?.code || '';
  const rate = Number(currencies.find((c) => c.code === payCur)?.base_value || 1);
  const cash = wallets.find((w) => w.currency_code === payCur)?.balance || 0;
  const market = gems.filter((g) => g.owner_id !== profile.id && (g.owner_id === null || g.listed));
  const mine = gems.filter((g) => g.owner_id === profile.id);
  const label = (s) => s.replace(/_/g, ' ');

  return (
    <div>
      <h2>Financial Markets</h2>
      {msg && <div className={'msg ' + (msg.type === 'error' ? 'msg-error' : 'msg-ok')}>{msg.text}</div>}

      <div className="panel wide">
        <div className="row">
          <span className="muted">Pay / receive in</span>
          <select value={payCur} onChange={(e) => setCur(e.target.value)}>
            {currencies.map((c) => <option key={c.code} value={c.code}>{c.code} · {c.name}</option>)}
          </select>
        </div>
        <p className="muted small">Cash available: {num(cash)} {payCur}. Fund your wallet in Banking.</p>
      </div>

      <div className="chips">
        <button className={'chip' + (tab === 'commodities' ? ' on' : '')} onClick={() => setTab('commodities')}>Metals</button>
        <button className={'chip' + (tab === 'gems' ? ' on' : '')} onClick={() => setTab('gems')}>Gemstones</button>
        <button className={'chip' + (tab === 'mine' ? ' on' : '')} onClick={() => setTab('mine')}>My assets</button>
      </div>

      {tab === 'commodities' && commodities.map((c) => {
        const pts = history[c.code] || [];
        const change = pts.length > 1 ? ((pts[pts.length - 1] - pts[0]) / pts[0]) * 100 : 0;
        const q = qty[c.code] || '';
        return (
          <div className="panel wide" key={c.code}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0 }}>{c.name}</h3>
              <strong>{num(Number(c.price) / rate)} {payCur} / {c.unit}</strong>
            </div>
            <p className={'small ' + (change >= 0 ? 'pos' : 'neg')}>
              {change >= 0 ? '+' : ''}{num(change)}% over shown history · volume {num(c.volume_24h, 0)}
            </p>
            <Spark points={pts} />
            <p className="muted small">You hold: {num(holdings[c.code] || 0, 4)} {c.unit}</p>
            <div className="row">
              <input type="number" min="0" step="0.0001" placeholder={'Quantity (' + c.unit + ')'} value={q}
                onChange={(e) => setQty({ ...qty, [c.code]: e.target.value })} />
              <button className="btn btn-primary" disabled={busy}
                onClick={() => call('trade_commodity', { p_code: c.code, p_side: 'buy', p_qty: Number(q), p_currency: payCur, p_key: newKey() }, 'Buy order filled.', () => setQty({ ...qty, [c.code]: '' }))}>
                Buy
              </button>
              <button className="btn btn-dark" disabled={busy}
                onClick={() => call('trade_commodity', { p_code: c.code, p_side: 'sell', p_qty: Number(q), p_currency: payCur, p_key: newKey() }, 'Sell order filled.', () => setQty({ ...qty, [c.code]: '' }))}>
                Sell
              </button>
            </div>
          </div>
        );
      })}
      {tab === 'commodities' && (
        <p className="muted small">
          Large orders move the price and fill slightly worse than the quote. A 1% fee applies. The server sets the final price.
        </p>
      )}

      {tab === 'gems' && (
        <>
          {market.length === 0 && <p className="muted">No stones for sale right now.</p>}
          {market.map((g) => (
            <div className="panel wide" key={g.id}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <h3 style={{ margin: 0, textTransform: 'capitalize' }}>{g.carats} ct {label(g.stone_type)}</h3>
                <span className="tag">{g.rarity}</span>
              </div>
              <p className="muted small">
                {g.quality} quality · color {g.color_grade} · clarity {g.clarity} · {g.cut} cut ·{' '}
                {g.certified ? 'certified' : 'uncertified'} · {g.owner_id ? 'player listing' : 'market vault'}
              </p>
              <p className="small">Estimated value: {num(Number(g.est_value_base) / rate)} {payCur}</p>
              <div className="row">
                <strong>Ask: {num(Number(g.ask_base) / rate)} {payCur}</strong>
                <button className="btn btn-primary" disabled={busy}
                  onClick={() => call('buy_gemstone', { p_gem: g.id, p_currency: payCur, p_max_base: Number(g.ask_base), p_key: newKey() }, 'Gemstone purchased.')}>
                  Buy (+1% fee)
                </button>
              </div>
            </div>
          ))}
        </>
      )}

      {tab === 'mine' && (
        <>
          <div className="panel wide">
            <h3>Metal holdings</h3>
            {commodities.every((c) => !holdings[c.code]) && <p className="muted">No metals yet.</p>}
            <div className="cards">
              {commodities.filter((c) => holdings[c.code] > 0).map((c) => (
                <div className="card" key={c.code}>
                  <span className="muted">{c.name}</span>
                  <strong>{num(holdings[c.code], 4)} {c.unit}</strong>
                  <span className="muted small">worth about {num((holdings[c.code] * Number(c.price)) / rate)} {payCur}</span>
                </div>
              ))}
            </div>
          </div>
          <h3>Gemstone vault</h3>
          {mine.length === 0 && <p className="muted">You own no gemstones.</p>}
          {mine.map((g) => (
            <div className="panel wide" key={g.id}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <h3 style={{ margin: 0, textTransform: 'capitalize' }}>{g.carats} ct {label(g.stone_type)}</h3>
                <span className="tag">{g.rarity}</span>
              </div>
              <p className="muted small">
                {g.quality} · {g.color_grade} · {g.clarity} · {g.cut} · {g.storage_location}
              </p>
              <p className="small">
                Estimated value: {num(Number(g.est_value_base) / rate)} {payCur}
                {g.listed && ' · listed at ' + num(Number(g.list_price_base) / rate) + ' ' + payCur}
              </p>
              <div className="row">
                <button className="btn btn-dark" disabled={busy}
                  onClick={() => call('sell_gemstone_to_market', { p_gem: g.id, p_currency: payCur, p_key: newKey() }, 'Sold to the market.')}>
                  Sell to market ({num((Number(g.est_value_base) * 0.85) / rate)} {payCur})
                </button>
              </div>
              <div className="row">
                {g.listed ? (
                  <button className="btn btn-dark" disabled={busy}
                    onClick={() => call('delist_gemstone', { p_gem: g.id }, 'Listing removed.')}>
                    Remove listing
                  </button>
                ) : (
                  <>
                    <input type="number" min="0" step="0.01" placeholder={'Ask price in ' + payCur}
                      value={listPx[g.id] || ''} onChange={(e) => setListPx({ ...listPx, [g.id]: e.target.value })} />
                    <button className="btn btn-primary" disabled={busy}
                      onClick={() => call('list_gemstone', { p_gem: g.id, p_price_base: Number((Number(listPx[g.id] || 0) * rate).toFixed(4)) }, 'Stone listed for sale.')}>
                      List for sale
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
