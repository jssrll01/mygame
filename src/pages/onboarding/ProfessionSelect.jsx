import { useEffect, useState } from 'react';
import { supabase } from '../../config/supabase';
import { useProfile } from '../../context/ProfileContext';

export default function ProfessionSelect() {
  const { refresh } = useProfile();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    supabase
      .from('professions')
      .select('code, name, category, description')
      .eq('is_starter', true)
      .order('category')
      .then(({ data, error: err }) => {
        if (err) setError(err.message);
        else setList(data || []);
        setLoading(false);
      });
  }, []);

  async function confirm() {
    if (!selected) return;
    setBusy(true);
    setError('');
    const { error: err } = await supabase.rpc('select_starting_profession', { p_code: selected.code });
    if (err) {
      setError(err.message);
      setBusy(false);
      return;
    }
    await refresh();
  }

  return (
    <div className="onboard">
      <h1>Choose your starting career</h1>
      <p className="muted">
        This is your entry point into the world. Higher positions are earned through experience,
        qualifications, elections or appointments.
      </p>

      {loading && <p className="muted">Loading professions...</p>}
      {error && <div className="msg msg-error">{error}</div>}

      <div className="prof-grid">
        {list.map((p) => (
          <button
            key={p.code}
            type="button"
            className={'prof-card' + (selected?.code === p.code ? ' selected' : '')}
            onClick={() => setSelected(p)}
          >
            <span className="tag">{p.category}</span>
            <strong>{p.name}</strong>
            <span className="muted">{p.description}</span>
          </button>
        ))}
      </div>

      {selected && (
        <div className="confirm-bar">
          <span>Start as <strong>{selected.name}</strong>?</span>
          <button className="btn btn-primary" onClick={confirm} disabled={busy}>
            {busy ? 'Saving...' : 'Confirm'}
          </button>
        </div>
      )}
    </div>
  );
}
