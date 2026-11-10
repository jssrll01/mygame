import { useProfile } from '../../context/ProfileContext';

export default function CommandCenter() {
  const { profile } = useProfile();
  const stats = [
    ['Profession', profile.professions?.name ?? 'None'],
    ['Career level', profile.career_level],
    ['Experience', profile.experience],
    ['Reputation', profile.reputation],
    ['Influence', profile.influence],
    ['Wealth', Number(profile.wealth).toLocaleString(undefined, { minimumFractionDigits: 2 })],
    ['Employment', profile.employment_status.replace('_', ' ')],
    ['Joined', new Date(profile.created_at).toLocaleDateString()]
  ];

  return (
    <div>
      <h2>Welcome, {profile.display_name}</h2>
      <p className="muted">
        Nationality: {profile.nationality || 'Not set (Phase 2 adds countries)'}
      </p>
      <div className="cards">
        {stats.map(([k, v]) => (
          <div className="card" key={k}>
            <span className="muted">{k}</span>
            <strong>{v}</strong>
          </div>
        ))}
      </div>
      <div className="panel">
        <h3>Status</h3>
        <p className="muted">
          Phase 1 (foundation) is active: accounts, profiles and professions. Wealth shows 0 until
          wallets and banking arrive in Phase 3. Other modules are marked as not implemented.
        </p>
      </div>
    </div>
  );
}
