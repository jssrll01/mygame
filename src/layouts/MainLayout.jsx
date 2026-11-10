import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { ChevronLeft, ChevronRight, LogOut, Menu, Shield, User, X } from 'lucide-react';
import { NAV_ITEMS } from '../config/navigation';
import { useAuth } from '../context/AuthContext';
import { useProfile } from '../context/ProfileContext';

export default function MainLayout() {
  const { signOut } = useAuth();
  const { profile } = useProfile();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="app">
      {mobileOpen && <div className="backdrop" onClick={() => setMobileOpen(false)} />}

      <aside className={'sidebar' + (collapsed ? ' collapsed' : '') + (mobileOpen ? ' open' : '')}>
        <div className="sidebar-head">
          <Shield size={24} />
          <span className="label brand">WARSTATE</span>
          <button className="icon-btn mobile-only" onClick={() => setMobileOpen(false)} aria-label="Close menu">
            <X size={20} />
          </button>
        </div>
        <nav className="nav">
          {NAV_ITEMS.map(({ path, label, icon: Icon }) => (
            <NavLink
              key={path}
              to={path}
              end={path === '/'}
              onClick={() => setMobileOpen(false)}
              title={label}
            >
              <Icon size={20} />
              <span className="label">{label}</span>
            </NavLink>
          ))}
        </nav>
        <button className="collapse-btn desktop-only" onClick={() => setCollapsed(!collapsed)}>
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </aside>

      <div className="main">
        <header className="topbar">
          <button className="icon-btn mobile-only" onClick={() => setMobileOpen(true)} aria-label="Open menu">
            <Menu size={22} />
          </button>
          <div className="spacer" />
          <div className="profile-menu">
            <button className="profile-btn" onClick={() => setMenuOpen(!menuOpen)}>
              <User size={18} />
              <span className="profile-text">
                {profile.display_name}
                <small>{profile.professions?.name}</small>
              </span>
            </button>
            {menuOpen && (
              <div className="dropdown">
                <NavLink to="/settings" onClick={() => setMenuOpen(false)}>Settings</NavLink>
                <button onClick={signOut}><LogOut size={16} /> Log out</button>
              </div>
            )}
          </div>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
