import { useCallback, useEffect, useState } from 'react';
import { getPrices, getPriceHistory, getEvents, subscribeEvents } from '../../services/engine';
import '../../styles/engine.css';

const NAMES = { XAU: 'Gold', XAG: 'Silver', XPT: 'Platinum', XPD: 'Palladium', OIL: 'Crude Oil' };

function Sparkline({ points }) {
  if (!points || points.length < 2) return <div className="eng-muted">Not enough history yet.</div>;
  const values = points.map((p) => Number(p.price));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const w = 600;
  const h = 140;
  const path = values
    .map((v, i) => `${i === 0 ? 'M' : 'L'}${(i / (values.length - 1)) * w},${h - ((v - min) / span) * (h - 10) - 5}`)
    .join(' ');
  const up = values[values.length - 1] >= values[0];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height="140" preserveAspectRatio="none" role="img" aria-label="Price history">
      <path d={path} fill="none" stroke={up ? '#16A34A' : '#DC2626'} strokeWidth="2" />
    </svg>
  );
}

export default function LiveMarketBoard() {
  const [prices, setPrices] = useState([]);
  const [events, setEvents] = useState([]);
  const [selected, setSelected] = useState('XAU');
  const [history, setHistory] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const loadAll = useCallback(async () => {
    try {
      const [p, e] = await Promise.all([getPrices(), getEvents()]);
      setPrices(p);
      setEvents(e);
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to load market data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
    const timer = setInterval(loadAll, 60000); // display refresh only; server is authoritative
    const unsubscribe = subscribeEvents(() => loadAll());
    return () => {
      clearInterval(timer);
      unsubscribe();
    };
  }, [loadAll]);

  useEffect(() => {
    let alive = true;
    getPriceHistory(selected)
      .then((h) => alive && setHistory(h))
      .catch((err) => alive && setError(err.message));
    return () => {
      alive = false;
    };
  }, [selected, prices]);

  if (loading) return <div className="eng-msg">Loading market data…</div>;

  return (
    <div className="eng-wrap">
      {error && <div className="eng-msg eng-down">{error}</div>}
      <div className="eng-card">
        <h3 className="eng-h">Commodity &amp; Metals Board</h3>
        {prices.length === 0 ? (
          <div className="eng-muted">No market data. Apply the Phase 14 migration.</div>
        ) : (
          <div className="eng-grid">
            {prices.map((p) => {
              const diff = Number(p.price) - Number(p.anchor_price);
              return (
                <button key={p.symbol} className={`eng-tile ${selected === p.symbol ? 'sel' : ''}`} onClick={() => setSelected(p.symbol)}>
                  <div className="eng-sym">{NAMES[p.symbol] || p.symbol}</div>
                  <div className="eng-price">{Number(p.price).toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                  <div className={diff >= 0 ? 'eng-up' : 'eng-down'}>
                    {diff >= 0 ? '▲' : '▼'} {((diff / Number(p.anchor_price)) * 100).toFixed(2)}% vs baseline
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
      <div className="eng-card">
        <h3 className="eng-h">{NAMES[selected] || selected}: last {history.length} ticks</h3>
        <Sparkline points={history} />
      </div>
      <div className="eng-card">
        <h3 className="eng-h">Global Events</h3>
        {events.length === 0 ? (
          <div className="eng-muted">No events yet. The world is quiet.</div>
        ) : (
          <div className="eng-table-scroll">
            <table className="eng-table">
              <thead><tr><th>Event</th><th>Severity</th><th>Affects</th><th>Status</th><th>Ends</th></tr></thead>
              <tbody>
                {events.map((e) => (
                  <tr key={e.id}>
                    <td>{e.title}</td>
                    <td>{e.severity}/5</td>
                    <td>{(e.symbols || []).join(', ')}</td>
                    <td><span className={`eng-badge ${e.status}`}>{e.status}</span></td>
                    <td>{new Date(e.ends_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
