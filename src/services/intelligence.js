import { supabase, unwrap, rpc } from './wsClient';

export async function listAgencies() {
  return unwrap(await supabase.from('justice_orgs').select('id, name, head_id, reputation, country_id').eq('kind', 'intel_agency').order('name'));
}
export async function listCountries() {
  return unwrap(await supabase.from('countries').select('id, name').order('name'));
}
export async function listThreatLevels() {
  return unwrap(await supabase.from('national_threat_levels').select('country_id, level, reason, updated_at, countries(name)').order('level', { ascending: false }));
}
export async function listReports(agencyId) {
  let q = supabase.from('intel_reports').select('*').order('created_at', { ascending: false }).limit(100);
  if (agencyId) q = q.eq('agency_id', agencyId);
  return unwrap(await q);
}
export async function listAssessments() {
  return unwrap(await supabase.from('threat_assessments').select('*').order('created_at', { ascending: false }).limit(100));
}
export async function listOperations(agencyId) {
  return unwrap(await supabase.from('intel_operations').select('*').eq('agency_id', agencyId).order('started_at', { ascending: false }).limit(100));
}
export const createReport = (o) => rpc('create_intel_report', {
  p_agency: o.agency, p_title: o.title, p_body: o.body, p_category: o.category,
  p_classification: o.classification, p_target_country: o.country || null });
export const shareReport = (report, agency) => rpc('share_report', { p_report: report, p_to_agency: agency });
export const retractReport = (id) => rpc('retract_report', { p_report: id });
export const issueAssessment = (o) => rpc('issue_threat_assessment', {
  p_agency: o.agency, p_country: o.country, p_subject: o.subject, p_category: o.category, p_level: o.level,
  p_rationale: o.rationale, p_classification: o.classification, p_valid_hours: o.hours });
export const withdrawAssessment = (id) => rpc('withdraw_assessment', { p_id: id });
export const launchOperation = (o) => rpc('launch_operation', {
  p_agency: o.agency, p_codename: o.codename, p_kind: o.kind, p_objective: o.objective,
  p_target_country: o.country || null, p_classification: o.classification, p_duration_minutes: o.minutes });
export const cancelOperation = (id) => rpc('cancel_operation', { p_id: id });
