import { useState } from 'react';
import { supabase } from '../../config/supabase';
import { useProfile } from '../../context/ProfileContext';

export default function Settings() {
  const { profile, refresh } = useProfile();
  const [displayName, setDisplayName] = useState(profile.display_name);
  const [nationality, setNationality] = useState(profile.nationality || '');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  async function save(e) {
    e.preventDefault();
    setMsg(null);
    const name = displayName.trim();
    if (name.length < 1 || name.length > 40) {
      setMsg({ type: 'error', text: 'Display name must be 1-40 characters.' });
      return;
    }
    setBusy(true);
    const { error } = await supabase
      .from('profiles')
      .update({ display_name: name, nationality: nationality.trim() || null })
      .eq('id', profile.id);
    setBusy(false);
    if (error) {
      setMsg({ type: 'error', text: error.message });
      return;
    }
    await refresh();
    setMsg({ type: 'ok', text: 'Profile saved.' });
  }

  return (
    <form className="panel form" onSubmit={save}>
      <h2>Settings</h2>
      <label>
        Username (cannot be changed)
        <input value={profile.username} disabled />
      </label>
      <label>
        Display name
        <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={40} />
      </label>
      <label>
        Nationality
        <input value={nationality} onChange={(e) => setNationality(e.target.value)} maxLength={60} />
      </label>
      {msg && <div className={'msg ' + (msg.type === 'error' ? 'msg-error' : 'msg-ok')}>{msg.text}</div>}
      <button className="btn btn-primary" type="submit" disabled={busy}>
        {busy ? 'Saving...' : 'Save changes'}
      </button>
    </form>
  );
}
