import { useEffect, useState } from 'react';
import { supabase } from '../../config/supabase';
import { useProfile } from '../../context/ProfileContext';

const fmt = (n) => Number(n).toLocaleString();
const money = (n) => '$' + (Number(n) / 1e9).toLocaleString(undefined, { maximumFractionDigits: 1 }) + 'B';

export default function World() {
  const { profile, refresh } = useProfile();
  const [countries, setCountries] = useState([]);
  const [cities, setCities] = useState([]);
  const [regions, setRegions] = useState([]);
  const [events, setEvents] = useState([]);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    async function load() {
      const [c, ci, r, e] = await Promise.all([
        supabase.from('countries').select('*').order('name'),
        supabase.from('cities').select('*'),
        supabase.from('regions').select('*'),
        supabase.from('world_events').select('*, countries(name)').order('created_at', { ascending: false }).limit(20)
      ]);
      const err = c.error || ci.error || r.error || e.error;
      if (err) setError(err.message);
      setCountries(c.data || []);
      setCities(ci.data || []);
      setRegions(r.data || []);
      setEvents(e.data || []);
      if (c.data?.length) {
        setSelected(c.data.find((x) => x.id === profile.country_id) || c.data[0]);
      }
    }
    load();
  }, [profile.country_id]);

  async function becomeCitizen() {
    setBusy(true);
    setError('');
    const { error: err } = await supabase.rpc('select_country', { p_code: selected.code });
    setBusy(false);
    if (err) { setError(err.message); return; }
    await refresh();
  }

  if (!selected) return <p className="muted">{error || 'Loading world...'}</p>;

  const stats = [
    ['Government', selected.government_type],
    ['Population', fmt(selected.population)],
    ['GDP', money(selected.gdp)],
    ['Treasury', money(selected.treasury)],
    ['Currency', selected.currency_code],
    ['Inflation', selected.inflation_rate + '%'],
    ['Unemployment', selected.unemployment_rate + '%'],
    ['Growth', selected.growth_rate + '%'],
    ['Stability', selected.stability + '/100'],
    ['Approval', selected.approval + '%'],
    ['Military', selected.military_strength],
    ['Industry', selected.industrial_capacity],
    ['Research', selected.research_capacity],
    ['Reputation', selected.reputation]
  ];
  const myCities = cities.filter((c) => c.country_id === selected.id);
  const myRegions = regions.filter((r) => r.country_id === selected.id);

  return (
    <div>
      <h2>World</h2>
      {error && <div className="msg msg-error">{error}</div>}

      <div className="panel wide">
        <svg viewBox="0 0 360 180" className="worldmap">
          <rect width="360" height="180" fill="#0B1220" />
          {[30, 60, 90, 120, 150].map((y) => <line key={y} x1="0" x2="360" y1={y} y2={y} stroke="#29364A" strokeWidth="0.3" />)}
          {[60, 120, 180, 240, 300].map((x) => <line key={x} y1="0" y2="180" x1={x} x2={x} stroke="#29364A" strokeWidth="0.3" />)}
          {cities.map((c) => (
            <circle
              key={c.id}
              cx={Number(c.lng) + 180}
              cy={90 - Number(c.lat)}
              r={c.is_capital ? 3 : 1.8}
              fill={c.country_id === selected.id ? '#2563EB' : '#94A3B8'}
              onClick={() => setSelected(countries.find((x) => x.id === c.country_id))}
            />
          ))}
        </svg>
        <p className="muted small">Simplified city map. Tap a dot to open its country. Real borders are not implemented yet.</p>
      </div>

      <div className="chips">
        {countries.map((c) => (
          <button key={c.id} className={'chip' + (c.id === selected.id ? ' on' : '')} onClick={() => setSelected(c)}>
            {c.flag} {c.name}
          </button>
        ))}
      </div>

      <div className="panel wide">
        <h3>{selected.flag} {selected.name}</h3>
        {profile.country_id === selected.id && <p className="muted">You are a citizen.</p>}
        {!profile.country_id && (
          <button className="btn btn-primary" onClick={becomeCitizen} disabled={busy}>
            {busy ? 'Saving...' : 'Become a citizen of ' + selected.name}
          </button>
        )}
        <div className="cards">
          {stats.map(([k, v]) => (
            <div className="card" key={k}><span className="muted">{k}</span><strong>{v}</strong></div>
          ))}
        </div>
        <p className="muted">Resources: {selected.resources.join(', ')}</p>
        <p className="muted">Regions: {myRegions.map((r) => r.name).join(', ') || 'none'}</p>
        <p className="muted">
          Cities: {myCities.map((c) => c.name + (c.is_capital ? ' (capital)' : '') + ' ' + fmt(c.population)).join(' · ')}
        </p>
      </div>

      <div className="panel wide">
        <h3>World events</h3>
        {events.length === 0 && <p className="muted">No events yet.</p>}
        {events.map((e) => (
          <div key={e.id} className={'event ' + e.severity}>
            <strong>{e.title}</strong>
            <span className="muted small">{e.countries?.name || 'Global'} · {new Date(e.created_at).toLocaleString()}</span>
            <span>{e.description}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
