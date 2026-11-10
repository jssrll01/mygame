import { supabase, unwrap, rpc } from './wsClient';

export const getMyScience = () => rpc('my_science_status');
export async function listCountries() {
  return unwrap(await supabase.from('countries').select('id, name').order('name'));
}
export async function listScienceOrgs(kinds) {
  let q = supabase.from('science_orgs').select('id, kind, name, head_id, reputation, budget, country_id').order('name');
  if (kinds) q = q.in('kind', kinds);
  return unwrap(await q);
}
export async function listScienceMembers(orgId) {
  return unwrap(await supabase.from('science_members').select('id, user_id, role, status, joined_at')
    .eq('org_id', orgId).neq('status', 'left').order('joined_at'));
}
export async function listTechs() {
  return unwrap(await supabase.from('rd_techs').select('*').order('field').order('tier'));
}
export async function listCountryTechs(country) {
  return unwrap(await supabase.from('rd_country_techs').select('tech_id').eq('country_id', country));
}
export async function listProjects(country) {
  return unwrap(await supabase.from('rd_projects').select('*, rd_techs(code, name)')
    .eq('country_id', country).eq('status', 'active').order('started_at'));
}
export async function listFacilities(orgId) {
  return unwrap(await supabase.from('rd_facilities').select('*').eq('org_id', orgId).order('built_at'));
}
export async function listHealthCountries() {
  return unwrap(await supabase.from('health_country')
    .select('country_id, health_index, quarantine_level, quarantine_set_at, countries(name)').order('health_index'));
}
export async function listOutbreaks(country) {
  let q = supabase.from('health_outbreaks').select('*, countries(name)').eq('status', 'active').order('severity', { ascending: false });
  if (country) q = q.eq('country_id', country);
  return unwrap(await q);
}
export async function listAlerts(country) {
  return unwrap(await supabase.from('health_alerts').select('*').eq('country_id', country)
    .eq('status', 'active').order('created_at', { ascending: false }).limit(20));
}
export async function listHospitals(country) {
  return unwrap(await supabase.from('health_hospitals').select('*').eq('country_id', country).order('name'));
}
export async function listCountermeasures(ids) {
  if (!ids.length) return [];
  return unwrap(await supabase.from('health_countermeasures').select('*').in('outbreak_id', ids).in('status', ['developing', 'ready']));
}

export const applyToScienceOrg = (org, role) => rpc('apply_to_science_org', { p_org: org, p_role: role });
export const leaveScienceOrg = () => rpc('leave_science_org');
export const manageScienceMember = (id, role, status) => rpc('manage_science_member', { p_member: id, p_role: role, p_status: status });
export const adminAppointScience = (org, user, role, head) =>
  rpc('admin_appoint_science', { p_org: org, p_user: user, p_role: role, p_make_head: !!head });
export const adminFundScienceOrg = (org, amount) => rpc('admin_fund_science_org', { p_org: org, p_amount: amount });
export const buildFacility = (org, name) => rpc('build_facility', { p_org: org, p_name: name });
export const upgradeFacility = (id) => rpc('upgrade_facility', { p_facility: id });
export const startResearch = (org, tech) => rpc('start_research', { p_org: org, p_tech: tech });
export const cancelResearch = (id) => rpc('cancel_research', { p_project: id });
export const restockHospital = (id, spend) => rpc('restock_hospital', { p_hospital: id, p_spend: spend });
export const respondToOutbreak = (outbreak, org, spend) => rpc('respond_to_outbreak', { p_outbreak: outbreak, p_org: org, p_spend: spend });
export const developCountermeasure = (outbreak, org, kind) => rpc('develop_countermeasure', { p_outbreak: outbreak, p_org: org, p_kind: kind });
export const issueHealthAlert = (country, outbreak, level, message) =>
  rpc('issue_health_alert', { p_country: country, p_outbreak: outbreak || null, p_level: level, p_message: message });
export const clearHealthAlert = (id) => rpc('clear_health_alert', { p_alert: id });
export const setQuarantine = (country, level) => rpc('set_quarantine', { p_country: country, p_level: level });
export const adminTriggerOutbreak = (country, name, severity) =>
  rpc('admin_trigger_outbreak', { p_country: country, p_name: name, p_severity: severity });
