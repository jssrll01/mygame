export const ROLES = {
  police: ['police_officer', 'detective', 'investigator', 'police_chief'],
  prosecution: ['prosecutor', 'chief_prosecutor'],
  court: ['judge', 'chief_judge', 'defense_attorney'],
  prison: ['corrections_officer', 'prison_admin'],
  intel_agency: ['analyst', 'intel_officer', 'director'],
};
export const HEAD_ROLES = ['police_chief', 'chief_prosecutor', 'chief_judge', 'director'];
export const ENTRY_ROLE = { police: 'police_officer', court: 'defense_attorney', prison: 'corrections_officer', intel_agency: 'analyst' };
export const KIND_LABEL = { police: 'Police', prosecution: 'Prosecution', court: 'Courts', prison: 'Prisons', intel_agency: 'Intelligence' };
export const CLASS_LABEL = ['Unclassified', 'Restricted', 'Confidential', 'Secret', 'Top Secret'];
export const CLASS_TONE = ['', 'blue', 'amber', 'red', 'red'];

export function roleHelper(status, kinds) {
  const mine = (status?.memberships || []).filter((m) => m.status === 'active' && (!kinds || kinds.includes(m.kind)));
  const has = (...roles) => !status?.imprisoned && mine.some((m) => roles.includes(m.role));
  const orgsFor = (...roles) => mine.filter((m) => roles.includes(m.role));
  return { mine, has, orgsFor };
}
