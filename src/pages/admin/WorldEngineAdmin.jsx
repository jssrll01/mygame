import { useCallback, useEffect, useState } from 'react';
import { isEngineAdmin, listJobs, listRuns, runJobNow } from '../../services/engine';
import '../../styles/engine.css';

export default function WorldEngineAdmin() {
  const [allowed, setAllowed] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [runs, setRuns] = useState([]);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    try {
      const [j, r] = await Promise.all([listJobs(), listRuns()]);
      setJobs(j);
      setRuns(r);
    } catch (err) {
      setMsg(err.message);
    }
  }, []);

  useEffect(() => {
    isEngineAdmin().then((ok) => {
      setAllowed(ok);
      if (ok) load();
    });
  }, [load]);

  async function run(job) {
    if (!window.confirm(`Run "${job.job_key}" now? This changes live world state.`)) return;
    setBusy(job.job_key);
    try {
      const res = await runJobNow(job.job_key);
      setMsg(`${job.job_key}: ${res}`);
      await load();
    } catch (err) {
      setMsg(err.message);
    } finally {
      setBusy('');
    }
  }

  if (allowed === null) return <div className="eng-msg">Checking access…</div>;
  if (!allowed) return <div className="eng-msg eng-down">Administrator access required.</div>;

  return (
    <div className="eng-wrap">
      {msg && <div className="eng-msg">{msg}</div>}
      <div className="eng-card">
        <h3 className="eng-h">Engine Jobs</h3>
        <div className="eng-table-scroll">
          <table className="eng-table">
            <thead><tr><th>Job</th><th>Every</th><th>Status</th><th>Last finished</th><th></th></tr></thead>
            <tbody>
              {jobs.map((j) => (
                <tr key={j.job_key}>
                  <td>{j.job_key}<div className="eng-muted">{j.description}</div></td>
                  <td>{Math.round(j.interval_seconds / 60)} min</td>
                  <td>
                    {j.implemented
                      ? <span className={`eng-badge ${j.last_status || ''}`}>{j.last_status || 'never run'}</span>
                      : <span className="eng-badge">not implemented</span>}
                    {j.last_error && <div className="eng-down eng-muted">{j.last_error}</div>}
                  </td>
                  <td>{j.last_finished_at ? new Date(j.last_finished_at).toLocaleString() : '-'}</td>
                  <td>
                    <button className="eng-btn" disabled={!j.implemented || busy === j.job_key} onClick={() => run(j)}>
                      {busy === j.job_key ? 'Running…' : 'Run now'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="eng-card">
        <h3 className="eng-h">Recent Runs</h3>
        <div className="eng-table-scroll">
          <table className="eng-table">
            <thead><tr><th>Job</th><th>Status</th><th>Rows</th><th>Started</th></tr></thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id}>
                  <td>{r.job_key}</td>
                  <td><span className={`eng-badge ${r.status}`}>{r.status}</span></td>
                  <td>{r.rows_affected}</td>
                  <td>{new Date(r.started_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
