import * as cfg from '../config/supabase';

export const supabase = cfg.supabase || cfg.default;

export function unwrap(res) {
  if (res.error) throw new Error(res.error.message || 'Request failed');
  return res.data;
}

export async function rpc(name, args = {}) {
  return unwrap(await supabase.rpc(name, args));
}

export async function namesFor(ids) {
  const uniq = [...new Set((ids || []).filter(Boolean))];
  if (!uniq.length) return {};
  const { data } = await supabase.from('profiles').select('id, username, display_name').in('id', uniq);
  const map = {};
  (data || []).forEach((p) => { map[p.id] = p.display_name || p.username || p.id.slice(0, 8); });
  uniq.forEach((id) => { if (!map[id]) map[id] = id.slice(0, 8); });
  return map;
}
