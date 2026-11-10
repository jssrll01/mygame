import { useCallback, useEffect, useRef, useState } from 'react';
import '../../styles/ws.css';
import { searchPlayers } from '../../services/justice';

export function useAsync(fn, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const alive = useRef(true);
  const run = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await fn();
      if (alive.current) setState({ data, loading: false, error: null });
    } catch (e) {
      if (alive.current) setState({ data: null, loading: false, error: e.message || String(e) });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => { alive.current = true; run(); return () => { alive.current = false; }; }, [run]);
  return { ...state, reload: run };
}

export function useNotice() {
  const [n, setN] = useState(null);
  const timer = useRef(null);
  const notify = useCallback((msg, err = false) => {
    setN({ msg, err });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setN(null), 3500);
  }, []);
  const node = n ? <div className={'ws-toast' + (n.err ? ' err' : '')} role="status">{n.msg}</div> : null;
  return [node, notify];
}

export function useAction(notify, reload) {
  const [busy, setBusy] = useState(false);
  const run = useCallback(async (fn, okMsg) => {
    if (busy) return false;
    setBusy(true);
    try {
      await fn();
      if (okMsg) notify(okMsg);
      if (reload) await reload();
      return true;
    } catch (e) {
      notify(e.message || 'Action failed', true);
      return false;
    } finally { setBusy(false); }
  }, [busy, notify, reload]);
  return [busy, run];
}

export const Loading = ({ text = 'Loading…' }) => <div className="ws-loading">{text}</div>;
export const Empty = ({ text }) => <div className="ws-empty">{text}</div>;
export const ErrorBox = ({ error, onRetry }) => error ? (
  <div className="ws-error">{error} {onRetry && <button className="ws-btn ghost sm" onClick={onRetry}>Retry</button>}</div>) : null;

export const Card = ({ title, right, children }) => (
  <section className="ws-card">
    {(title || right) && <div className="ws-head" style={{ marginBottom: 8 }}><h3 style={{ margin: 0 }}>{title}</h3>{right}</div>}
    {children}
  </section>);

export const Stat = ({ label, value }) => (
  <div className="ws-card ws-stat" style={{ marginBottom: 0 }}><b>{value}</b><span>{label}</span></div>);

export const Badge = ({ tone = '', children }) => <span className={'ws-badge ' + tone}>{children}</span>;

export const Tabs = ({ tabs, value, onChange }) => (
  <div className="ws-tabs" role="tablist">
    {tabs.map((t) => (
      <button key={t.id} role="tab" aria-selected={value === t.id} className={'ws-tab' + (value === t.id ? ' on' : '')}
        onClick={() => onChange(t.id)}>{t.label}</button>))}
  </div>);

export const Field = ({ label, children }) => <label className="ws-field">{label}{children}</label>;

export function Modal({ title, onClose, children }) {
  useEffect(() => {
    const h = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="ws-modal-bg" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="ws-modal" role="dialog" aria-modal="true">
        <div className="ws-head" style={{ marginBottom: 8 }}>
          <h2 style={{ margin: 0 }}>{title}</h2>
          <button className="ws-btn ghost sm" onClick={onClose}>Close</button>
        </div>
        {children}
      </div>
    </div>);
}

export function Confirm({ title, message, confirmLabel = 'Confirm', danger, onConfirm, onCancel }) {
  return (
    <Modal title={title} onClose={onCancel}>
      <p className="ws-sub" style={{ fontSize: 14 }}>{message}</p>
      <div className="ws-actions">
        <button className={'ws-btn ' + (danger ? 'danger' : '')} onClick={onConfirm}>{confirmLabel}</button>
        <button className="ws-btn ghost" onClick={onCancel}>Cancel</button>
      </div>
    </Modal>);
}

export function PlayerPicker({ value, onChange }) {
  const [q, setQ] = useState('');
  const [list, setList] = useState([]);
  useEffect(() => {
    if (q.trim().length < 2) { setList([]); return undefined; }
    const t = setTimeout(async () => { try { setList((await searchPlayers(q)) || []); } catch { setList([]); } }, 300);
    return () => clearTimeout(t);
  }, [q]);
  return (
    <div>
      {value ? (
        <div className="ws-row" style={{ border: 0, padding: 0 }}>
          <span>Selected: <b>{value.name}</b></span>
          <button type="button" className="ws-btn ghost sm" onClick={() => onChange(null)}>Clear</button>
        </div>) : (
        <>
          <input placeholder="Search player name…" value={q} onChange={(e) => setQ(e.target.value)}
            style={{ width: '100%', background: '#0B1220', border: '1px solid #29364A', color: '#F8FAFC', borderRadius: 8, padding: 9 }} />
          {list.map((p) => (
            <button type="button" key={p.id} className="ws-btn ghost sm" style={{ margin: '6px 6px 0 0' }}
              onClick={() => { onChange({ id: p.id, name: p.display_name || p.username }); setQ(''); setList([]); }}>
              {p.display_name || p.username}
            </button>))}
        </>)}
    </div>);
}

export const fmt = (d) => d ? new Date(d).toLocaleString() : '—';
export const timeLeft = (d) => {
  const ms = new Date(d) - Date.now();
  if (ms <= 0) return 'now';
  const m = Math.floor(ms / 60000);
  return m >= 1440 ? Math.floor(m / 1440) + 'd ' + Math.floor((m % 1440) / 60) + 'h' : m >= 60 ? Math.floor(m / 60) + 'h ' + (m % 60) + 'm' : m + 'm';
};
export const statusTone = (s) => ({ active: 'green', granted: 'green', open: 'blue', filed: 'blue', held: 'amber', requested: 'amber',
  pending: 'amber', verdict: 'amber', appealed: 'amber', denied: 'red', expired: 'red', dismissed: 'red', failed: 'red',
  suspended: 'red', completed: 'green', serving: 'amber', excluded: 'red', admitted: 'green' }[s] || '');
export const label = (s) => String(s || '').replace(/_/g, ' ');

export const Level = ({ n }) => (
  <span className={'ws-level' + (n >= 4 ? ' hot' : '')} title={'Level ' + n + '/5'}>
    {[1, 2, 3, 4, 5].map((i) => <i key={i} className={i <= n ? 'on' : ''} />)}
  </span>);
