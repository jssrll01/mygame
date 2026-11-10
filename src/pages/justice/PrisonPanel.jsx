import { listInmates, listConvictions, enrollRehab, prisonReview } from '../../services/justice';
import { namesFor } from '../../services/wsClient';
import { useAsync, useAction, Card, Empty, Loading, ErrorBox, Badge, Stat, statusTone, label, fmt, timeLeft } from '../../components/ws/kit';
import { roleHelper } from '../../components/ws/roles';

export default function PrisonPanel({ status, reload, notify }) {
  const q = useAsync(async () => {
    const [inmates, convictions] = await Promise.all([listInmates(), listConvictions()]);
    return { inmates, convictions, names: await namesFor([...inmates.map((i) => i.user_id), ...convictions.map((c) => c.user_id)]) };
  }, []);
  const [busy, run] = useAction(notify, async () => { await q.reload(); await reload(); });
  const prison = roleHelper(status, ['prison']);
  const staff = prison.has('corrections_officer', 'prison_admin');
  const admin = prison.has('prison_admin');
  const mine = status.inmate;
  const serving = (q.data?.inmates || []).filter((i) => i.status === 'serving' && i.user_id !== status.user_id);

  return (
    <>
      {mine && (
        <Card title="Your sentence">
          <div className="ws-grid">
            <Stat label="Time remaining" value={timeLeft(mine.release_at)} />
            <Stat label="Conduct" value={mine.conduct_score} />
            <Stat label="Rehab" value={Number(mine.rehab_progress).toFixed(0) + '%'} />
          </div>
          <p className="ws-sub">One game day lasts 10 real minutes. Rehabilitation (60%+) and good conduct can qualify you for parole after serving half.</p>
          <button className="ws-btn" disabled={busy || mine.rehab_enrolled} onClick={() => run(enrollRehab, 'Enrolled in rehabilitation')}>
            {mine.rehab_enrolled ? 'Enrolled in rehabilitation' : 'Enrol in rehabilitation'}</button>
        </Card>)}

      {staff && (
        <Card title="Inmates in custody">
          {q.loading && !q.data && <Loading />}
          {q.data && !serving.length && <Empty text="No inmates." />}
          {serving.map((i) => (
            <div className="ws-row" key={i.id}>
              <div className="main"><b>{q.data.names[i.user_id]}</b>
                <span className="meta">releases in {timeLeft(i.release_at)} · conduct {i.conduct_score} · rehab {Number(i.rehab_progress).toFixed(0)}%</span></div>
              <div className="ws-actions">
                <button className="ws-btn ghost sm" disabled={busy} onClick={() => run(() => prisonReview(i.id, 'commend'), 'Commended')}>Commend</button>
                <button className="ws-btn ghost sm" disabled={busy} onClick={() => { const n = window.prompt('Reason for sanction (10+ characters)'); if (n) run(() => prisonReview(i.id, 'sanction', n), 'Sanction recorded'); }}>Sanction</button>
                {admin && <button className="ws-btn ok sm" disabled={busy} onClick={() => run(() => prisonReview(i.id, 'parole'), 'Parole granted')}>Parole</button>}
              </div>
            </div>))}
        </Card>)}

      <Card title="Public conviction record">
        {q.loading && !q.data && <Loading />}
        <ErrorBox error={q.error} onRetry={q.reload} />
        {q.data && !q.data.convictions.length && <Empty text="No convictions on record." />}
        {q.data?.convictions.map((c) => (
          <div className="ws-row" key={c.id}>
            <div className="main"><b>{q.data.names[c.user_id]} — {c.offense}</b><span className="meta">{c.sentence_days} game days · {fmt(c.convicted_at)}</span></div>
            <Badge tone={c.status === 'overturned' ? 'green' : 'red'}>{label(c.status)}</Badge>
          </div>))}
      </Card>
    </>);
}
