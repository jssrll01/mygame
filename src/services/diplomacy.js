import { supabase, unwrap, rpc } from './wsClient';

export const getMyDiplomacy = () => rpc('my_diplomacy_status');
export async function listCountries() {
  return unwrap(await supabase.from('countries').select('id, name').order('name'));
}
export async function listRelations(country) {
  return unwrap(await supabase.from('dip_relations').select('*')
    .or('country_a.eq.' + country + ',country_b.eq.' + country).order('score', { ascending: false }));
}
export async function listDipMembers(country) {
  return unwrap(await supabase.from('dip_members').select('id, user_id, role, status, joined_at')
    .eq('country_id', country).neq('status', 'left').order('joined_at'));
}
export async function listTreaties() {
  return unwrap(await supabase.from('dip_treaties').select('*, dip_treaty_parties(country_id, response)')
    .order('created_at', { ascending: false }).limit(60));
}
export async function listEmbassies() {
  return unwrap(await supabase.from('dip_embassies').select('*').order('opened_at', { ascending: false }).limit(100));
}
export async function listSanctions() {
  return unwrap(await supabase.from('dip_sanctions').select('*').order('imposed_at', { ascending: false }).limit(60));
}
export async function listNegotiations() {
  return unwrap(await supabase.from('dip_negotiations').select('*').order('opened_at', { ascending: false }).limit(50));
}
export async function listNegMessages(id) {
  return unwrap(await supabase.from('dip_negotiation_messages').select('*').eq('negotiation_id', id).order('created_at').limit(200));
}
export async function listAid() {
  return unwrap(await supabase.from('dip_aid').select('*').order('sent_at', { ascending: false }).limit(30));
}
export async function listIntlOrgs() {
  return unwrap(await supabase.from('dip_intl_orgs').select('*').order('name'));
}
export async function listIntlMembers() {
  return unwrap(await supabase.from('dip_intl_members').select('org_id, country_id'));
}

export const applyToDiplomaticService = (country) => rpc('apply_to_diplomatic_service', { p_country: country, p_role: 'diplomat' });
export const leaveDiplomaticService = () => rpc('leave_diplomatic_service');
export const manageDipMember = (id, role, status) => rpc('manage_dip_member', { p_member: id, p_role: role, p_status: status });
export const adminAppointDiplomat = (country, user, role, head) =>
  rpc('admin_appoint_diplomat', { p_country: country, p_user: user, p_role: role, p_make_head: !!head });
export const adminFundMinistry = (country, amount) => rpc('admin_fund_ministry', { p_country: country, p_amount: amount });
export const openEmbassy = (sending, host) => rpc('open_embassy', { p_sending: sending, p_host: host, p_ambassador: null });
export const closeEmbassy = (id) => rpc('close_embassy', { p_embassy: id });
export const proposeTreaty = (o) => rpc('propose_treaty',
  { p_kind: o.kind, p_title: o.title, p_terms: o.terms, p_proposer: o.proposer, p_parties: o.parties });
export const respondTreaty = (id, country, accept) => rpc('respond_treaty', { p_treaty: id, p_country: country, p_accept: accept });
export const withdrawTreaty = (id, country) => rpc('withdraw_treaty', { p_treaty: id, p_country: country });
export const imposeSanction = (o) => rpc('impose_sanction', {
  p_imposer: o.imposer, p_target: o.target, p_kind: o.kind, p_severity: o.severity, p_reason: o.reason, p_hours: o.hours });
export const liftSanction = (id) => rpc('lift_sanction', { p_id: id });
export const openNegotiation = (from, withC, topic) => rpc('open_negotiation', { p_from: from, p_with: withC, p_topic: topic });
export const postNegotiationMessage = (id, body) => rpc('post_negotiation_message', { p_neg: id, p_body: body });
export const closeNegotiation = (id, outcome) => rpc('close_negotiation', { p_neg: id, p_outcome: outcome });
export const sendAid = (o) => rpc('send_aid', {
  p_from: o.from, p_to: o.to, p_kind: o.kind, p_amount: o.amount, p_outbreak: o.outbreak || null, p_note: o.note || '' });
export const joinIntlOrg = (org, country) => rpc('join_intl_org', { p_org: org, p_country: country });
export const leaveIntlOrg = (org, country) => rpc('leave_intl_org', { p_org: org, p_country: country });
