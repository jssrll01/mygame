export const money = (n) => Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 });
export const SCI_ROLES = {
  research_institute: ['lab_researcher', 'researcher', 'scientist', 'institute_director'],
  hospital: ['doctor', 'medical_admin'],
  public_health_agency: ['public_health_officer', 'agency_director'],
};
export const SCI_HEADS = ['institute_director', 'agency_director', 'medical_admin'];
export const SCI_APPLY = { research_institute: 'lab_researcher', hospital: 'doctor', public_health_agency: 'public_health_officer' };
export const KIND_LABEL = { research_institute: 'Research institute', hospital: 'Hospital', public_health_agency: 'Public health agency' };
export const DIP_ROLES = ['diplomat', 'foreign_affairs_officer', 'trade_representative', 'international_negotiator', 'ambassador', 'foreign_minister'];
export const REL_TONE = { strong_ally: 'green', friendly: 'green', neutral: undefined, tense: 'amber', hostile: 'red' };
