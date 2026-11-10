import { useState } from 'react';
import { getMyStatus } from '../../services/justice';
import { useAsync, useNotice, Loading, ErrorBox, Tabs, Badge } from '../../components/ws/kit';
import ServicePanel from './ServicePanel';
import InvestigationsPanel from './InvestigationsPanel';
import WarrantsPanel from './WarrantsPanel';
import CourtPanel from './CourtPanel';
import PrisonPanel from './PrisonPanel';

const TABS = [
  { id: 'service', label: 'My Service' },
  { id: 'investigations', label: 'Investigations' },
  { id: 'warrants', label: 'Warrants & Arrests' },
  { id: 'courts', label: 'Courts' },
  { id: 'prisons', label: 'Prisons' },
];

export default function JusticePage() {
  const [tab, setTab] = useState('service');
  const [toast, notify] = useNotice();
  const st = useAsync(getMyStatus, []);

  if (st.loading && !st.data) return <div className="ws-page"><Loading text="Loading justice system…" /></div>;
  if (st.error && !st.data) return <div className="ws-page"><ErrorBox error={st.error} onRetry={st.reload} /></div>;
  const status = st.data;
  const ctx = { status, reload: st.reload, notify };

  return (
    <div className="ws-page">
      <div className="ws-head">
        <div>
          <h1>Security &amp; Justice</h1>
          <p className="ws-sub">Police, prosecution, courts and prisons. Every action is validated on the server.</p>
        </div>
        <div>
          {status.imprisoned && <Badge tone="red">In custody</Badge>}
          {status.is_admin && <Badge tone="blue">Admin</Badge>}
        </div>
      </div>
      {status.imprisoned && (
        <div className="ws-banner">
          You are serving a sentence. While imprisoned you cannot act in any service, but you can enrol in rehabilitation
          and file an appeal from the Courts tab.
        </div>)}
      <Tabs tabs={TABS} value={tab} onChange={setTab} />
      {tab === 'service' && <ServicePanel {...ctx} />}
      {tab === 'investigations' && <InvestigationsPanel {...ctx} />}
      {tab === 'warrants' && <WarrantsPanel {...ctx} />}
      {tab === 'courts' && <CourtPanel {...ctx} />}
      {tab === 'prisons' && <PrisonPanel {...ctx} />}
      {toast}
    </div>);
}
