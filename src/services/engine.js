import * as cfg from '../config/supabase';

const supabase = cfg.supabase || cfg.default;

export async function getPrices() {
  const { data, error } = await supabase
    .from('engine_price_state')
    .select('symbol,asset_class,price,anchor_price,updated_at')
    .order('symbol');
  if (error) throw error;
  return data || [];
}

export async function getPriceHistory(symbol, limit = 96) {
  const { data, error } = await supabase
    .from('engine_price_history')
    .select('price,recorded_at')
    .eq('symbol', symbol)
    .order('recorded_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data || []).reverse();
}

export async function getEvents(limit = 15) {
  const { data, error } = await supabase
    .from('engine_world_events')
    .select('id,kind,title,severity,symbols,multiplier,status,starts_at,ends_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

export function subscribeEvents(callback) {
  const channel = supabase
    .channel('engine-events')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'engine_world_events' }, callback)
    .subscribe();
  return () => supabase.removeChannel(channel);
}

export async function isEngineAdmin() {
  const { data, error } = await supabase.rpc('engine_is_admin');
  return !error && data === true;
}

export async function listJobs() {
  const { data, error } = await supabase.from('engine_jobs').select('*').order('job_key');
  if (error) throw error;
  return data || [];
}

export async function listRuns(limit = 25) {
  const { data, error } = await supabase
    .from('engine_job_runs')
    .select('id,job_key,status,rows_affected,error,started_at,finished_at')
    .order('started_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

export async function runJobNow(jobKey) {
  const { data, error } = await supabase.rpc('engine_admin_run', { p_job: jobKey });
  if (error) throw error;
  return data;
}
