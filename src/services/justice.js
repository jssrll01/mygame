import { supabase, unwrap, rpc } from './wsClient';

export const getMyStatus = () => rpc('my_justice_status');
export const searchPlayers = (q) => rpc('search_players', { p_query: q });

export async function listOrgs(kinds) {
  let q = supabase.from('justice_orgs').select('id, kind, name, head_id, reputation, country_id').order('name');
  if (kinds) q = q.in('kind', kinds);
  return unwrap(await q);
}
export async function listMembers(orgId) {
  return unwrap(await supabase.from('service_members').select('id, user_id, role, clearance, status, joined_at')
    .eq('org_id', orgId).neq('status', 'left').order('joined_at'));
}
export const applyToService = (orgId, role) => rpc('apply_to_service', { p_org: orgId, p_role: role });
export const leaveService = () => rpc('leave_service');
export const manageMember = (id, role, clearance, status) =>
  rpc('manage_member', { p_member: id, p_role: role, p_clearance: clearance, p_status: status });

export async function listInvestigations() {
  return unwrap(await supabase.from('investigations').select('*').order('last_activity_at', { ascending: false }).limit(100));
}
export async function getInvestigation(id) {
  const [inv, evidence, warrants, arrests, events] = await Promise.all([
    supabase.from('investigations').select('*').eq('id', id).single(),
    supabase.from('evidence').select('*').eq('investigation_id', id).order('created_at'),
    supabase.from('warrants').select('*').eq('investigation_id', id).order('requested_at'),
    supabase.from('arrests').select('*').eq('investigation_id', id).order('arrested_at'),
    supabase.from('case_events').select('*').eq('subject_type', 'investigation').eq('subject_id', id).order('created_at'),
  ]);
  return { inv: unwrap(inv), evidence: unwrap(evidence), warrants: unwrap(warrants), arrests: unwrap(arrests), events: unwrap(events) };
}
export const openInvestigation = (o) => rpc('open_investigation',
  { p_org: o.org, p_title: o.title, p_summary: o.summary || '', p_subject: o.subject || null, p_priority: o.priority || 3 });
export const setInvestigationStatus = (id, status) => rpc('set_investigation_status', { p_inv: id, p_status: status });
export const addEvidence = (inv, kind, description) => rpc('add_evidence', { p_inv: inv, p_kind: kind, p_description: description });
export const requestWarrant = (inv, kind, justification) => rpc('request_warrant', { p_inv: inv, p_kind: kind, p_justification: justification });
export const decideWarrant = (id, grant, note) => rpc('decide_warrant', { p_warrant: id, p_grant: grant, p_note: note || '' });
export const executeArrest = (warrant) => rpc('execute_arrest', { p_warrant: warrant });
export const referCase = (arrest) => rpc('refer_case', { p_arrest: arrest });

export async function listWarrants() {
  return unwrap(await supabase.from('warrants').select('*').order('requested_at', { ascending: false }).limit(100));
}
export async function listCases() {
  return unwrap(await supabase.from('court_cases').select('*').order('created_at', { ascending: false }).limit(100));
}
export async function getCase(id) {
  const [c, hearings, events, appeal] = await Promise.all([
    supabase.from('court_cases').select('*').eq('id', id).single(),
    supabase.from('court_hearings').select('*').eq('case_id', id).order('scheduled_at'),
    supabase.from('case_events').select('*').eq('subject_type', 'case').eq('subject_id', id).order('created_at'),
    supabase.from('appeals').select('*').eq('case_id', id).maybeSingle(),
  ]);
  const cs = unwrap(c);
  const ev = await supabase.from('evidence').select('*').eq('investigation_id', cs.investigation_id).order('created_at');
  return { c: cs, hearings: unwrap(hearings), events: unwrap(events), appeal: unwrap(appeal), evidence: ev.error ? [] : ev.data };
}
export const prosecutorDecide = (id, file, charge, severity) =>
  rpc('prosecutor_decide', { p_case: id, p_file: file, p_charge: charge, p_severity: severity || 1 });
export const takeDefense = (id) => rpc('take_defense', { p_case: id });
export const waiveCounsel = (id) => rpc('waive_counsel', { p_case: id });
export const scheduleHearing = (id, kind, whenIso) => rpc('schedule_hearing', { p_case: id, p_kind: kind, p_when: whenIso });
export const ruleOnEvidence = (id, admit) => rpc('rule_on_evidence', { p_evidence: id, p_admit: admit });
export const deliverVerdict = (id, verdict, days, prison) =>
  rpc('deliver_verdict', { p_case: id, p_verdict: verdict, p_sentence_days: days || null, p_prison: prison || null });
export const fileAppeal = (id, grounds) => rpc('file_appeal', { p_case: id, p_grounds: grounds });
export const decideAppeal = (id, grant, note) => rpc('decide_appeal', { p_appeal: id, p_grant: grant, p_note: note });

export async function listInmates() {
  return unwrap(await supabase.from('prison_inmates').select('*').order('release_at'));
}
export async function listConvictions() {
  return unwrap(await supabase.from('conviction_records').select('*').order('convicted_at', { ascending: false }).limit(50));
}
export const enrollRehab = () => rpc('enroll_rehab');
export const prisonReview = (id, action, note) => rpc('prison_review', { p_inmate: id, p_action: action, p_note: note || '' });
