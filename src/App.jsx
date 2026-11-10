import { Navigate, Route, Routes } from 'react-router-dom';
import { isSupabaseConfigured } from './config/supabase';
import { NAV_ITEMS } from './config/navigation';
import { useAuth } from './context/AuthContext';
import { useProfile } from './context/ProfileContext';
import AuthPage from './pages/auth/AuthPage';
import ProfessionSelect from './pages/onboarding/ProfessionSelect';
import MainLayout from './layouts/MainLayout';
import CommandCenter from './pages/dashboard/CommandCenter';
import Settings from './pages/settings/Settings';
import World from './pages/world/World';
import Banking from './pages/banking/Banking';
import ModulePlaceholder from './components/ModulePlaceholder';
import JusticePage from './pages/justice/JusticePage';
import IntelligencePage from './pages/intelligence/IntelligencePage';
import ResearchPage from './pages/research/ResearchPage';
import DiplomacyPage from './pages/diplomacy/DiplomacyPage';
import Government from './pages/government/Government';
import Military from './pages/military/Military';
import Crime from './pages/crime/Crime';
import Markets from './pages/markets/Markets';
import Business from './pages/business/Business';
import WorldEngineAdmin from './pages/admin/WorldEngineAdmin';

// paths that have a real page; everything else falls back to the placeholder
const REAL_PAGES = {
  '/world': <World />,
  '/banking': <Banking />,
  '/justice': <JusticePage />,
  '/intelligence': <IntelligencePage />,
  '/research': <ResearchPage />,
  '/diplomacy': <DiplomacyPage />,
  '/government': <Government />,
  '/military': <Military />,
  '/underworld': <Crime />,
  '/markets': <Markets />,
  '/business': <Business />,
};

export default function App() {
  const { user, loading, signOut } = useAuth();
  const { profile, loading: profileLoading, error } = useProfile();

  if (!isSupabaseConfigured) {
    return (
      <div className="center-screen">
        Supabase is not configured. Put your project URL and anon key in .env, then restart.
      </div>
    );
  }
  if (loading) return <div className="center-screen">Loading...</div>;
  if (!user) return <AuthPage />;
  if (profileLoading) return <div className="center-screen">Loading profile...</div>;

  if (!profile) {
    return (
      <div className="center-screen">
        <div>
          <p>Could not load your profile.</p>
          {error && <p className="msg msg-error">{error}</p>}
          <p>Check that the SQL migration was run in Supabase.</p>
          <button className="btn btn-primary" onClick={signOut}>Log out</button>
        </div>
      </div>
    );
  }

  if (!profile.profession_id) return <ProfessionSelect />;

  return (
    <Routes>
      <Route element={<MainLayout />}>
        <Route index element={<CommandCenter />} />
        <Route path="settings" element={<Settings />} />
        <Route path="admin" element={<WorldEngineAdmin />} />
        {NAV_ITEMS.filter((i) => i.phase !== undefined).map((i) => (
          <Route
            key={i.path}
            path={i.path.slice(1)}
            element={REAL_PAGES[i.path] || <ModulePlaceholder label={i.label} phase={i.phase} />}
          />
        ))}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
