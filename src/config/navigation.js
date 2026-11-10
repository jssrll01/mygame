import {
  LayoutDashboard, Globe, Landmark, Swords, Eye, Scale, Skull, TrendingUp,
  LineChart, Banknote, FlaskConical, HeartPulse, Handshake, Briefcase,
  Users, BarChart3, Settings
} from 'lucide-react';

export const NAV_ITEMS = [
  { path: '/', label: 'Command Center', icon: LayoutDashboard },
  { path: '/world', label: 'World', icon: Globe, phase: 2 },
  { path: '/government', label: 'Government', icon: Landmark, phase: 8 },
  { path: '/military', label: 'Military', icon: Swords, phase: 6 },
  { path: '/intelligence', label: 'Intelligence', icon: Eye, phase: 11 },
  { path: '/justice', label: 'Security & Justice', icon: Scale, phase: 10 },
  { path: '/underworld', label: 'Criminal Underworld', icon: Skull, phase: 9 },
  { path: '/economy', label: 'Economy', icon: TrendingUp, phase: 14 },
  { path: '/markets', label: 'Financial Markets', icon: LineChart, phase: 4 },
  { path: '/banking', label: 'Banking', icon: Banknote, phase: 3 },
  { path: '/research', label: 'Research & Development', icon: FlaskConical, phase: 12 },
  { path: '/health', label: 'Health & Biosecurity', icon: HeartPulse, phase: 12 },
  { path: '/diplomacy', label: 'Diplomacy', icon: Handshake, phase: 13 },
  { path: '/business', label: 'Business', icon: Briefcase, phase: 5 },
  { path: '/social', label: 'Social', icon: Users, phase: null },
  { path: '/statistics', label: 'Statistics', icon: BarChart3, phase: 14 },
  { path: '/settings', label: 'Settings', icon: Settings }
];
