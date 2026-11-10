import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../config/supabase';
import { useProfile } from '../../context/ProfileContext';

const newKey = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Date.now() + '-' + Math.random().toString(16).slice(2);
const money = (n) =>
  Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function Banking() {
  const { profile, refresh } = useProfile();
  const [currencies, setCurrencies] = useState([]);
  const [wallets, setWallets] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [txs, setTxs] = useState([]);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  const [openCur, setOpenCur] = useState('');
  const [openType, setOpenType] = useState('checking');
  const [moveAcct, setMoveAcct] = useState('');
  const [moveAmt, setMoveAmt] = useState('');
  const [trAcct, setTrAcct] = useState('');
  const [trUser, setTrUser] = useState('');
  const [trAmt, setTrAmt] = useState('');
  const [trMemo, setTrMemo] = useState('');
  const [exFrom, setExFrom] = useState('');
  const [exTo, setExTo] = useState('');
  const [exAmt, setExAmt] = useState('');

  const load = useCallback(async () => {
    const [c, w, a, t] = await Promise.all([
      supabase.from('currencies').select('*').order('code'),
      supabase.from('wallets').select('*').order('currency_code'),
      supabase.from('bank_accounts').select('*').order('created_at'),
      supabase.from('transactions').select('*').order('id', { ascending: false }).limit(30)
    ]);
    const err = c.error || w.error || a.error || t.error;
    if (err) setMsg({ type: 'error', text: err.message });
    setCurrencies(c.data || []);
    setWallets(w.data || []);
    setAccounts(a.data || []);
    setTxs(t.data || []);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function call(name, args, okText, reset) {
    if (busy) return;
    setBusy(true);
    setMsg(null);
    const { error } = await supabase.rpc(name, args);
    setBusy(false);
    if (error) { setMsg({ type: 'error', text: error.message }); return; }
    setMsg({ type: 'ok', text: okText });
    if (reset) reset();
    await load();
    await refresh();
  }

  const cur0 = currencies[0]?.code || '';
  const homeCur = currencies.find((c) => c.country_id === profile.country_id)?.code;
  const acctId = (v) => v || accounts[0]?.id;
  const rateOf = (code) => Number(currencies.find((c) => c.code === code)?.base_value || 0);
  const fFrom = exFrom || homeCur || cur0;
  const fTo = exTo || currencies.find((c) => c.code !== fFrom)?.code || '';
  const quote =
    exAmt && rateOf(fTo) ? (Number(exAmt) * rateOf(fFrom) / rateOf(fTo)) * 0.99 : 0;

  return (
    <div>
      <h2>Banking</h2>
      {msg && <div className={'msg ' + (msg.type === 'error' ? 'msg-error' : 'msg-ok')}>{msg.text}</div>}

      {!profile.starter_funds_claimed && (
        <div className="panel wide">
          <h3>Starting funds</h3>
          {profile.country_id ? (
            <button className="btn btn-primary" disabled={busy}
              onClick={() => call('claim_starting_funds', {}, 'Starting funds added to your wallet.')}>
              Claim 10,000 in your national currency
            </button>
          ) : (
            <p className="muted">Choose a country on the World page first.</p>
          )}
        </div>
      )}

      <div className="panel wide">
        <h3>Cash wallets</h3>
        {wallets.length === 0 && <p className="muted">No cash yet.</p>}
        <div className="cards">
          {wallets.map((w) => (
            <div className="card" key={w.id}>
              <span className="muted">{w.currency_code}</span>
              <strong>{money(w.balance)}</strong>
            </div>
          ))}
        </div>
      </div>

      <div className="panel wide">
        <h3>Bank accounts</h3>
        {accounts.length === 0 && <p className="muted">No accounts yet. Open one below.</p>}
        <div className="cards">
          {accounts.map((a) => (
            <div className="card" key={a.id}>
              <span className="muted">{a.currency_code} {a.account_type}</span>
              <strong>{money(a.balance)}</strong>
              <span className="muted small">{a.account_number} · {a.status}</span>
            </div>
          ))}
        </div>
        <div className="row">
          <select value={openCur || homeCur || cur0} onChange={(e) => setOpenCur(e.target.value)}>
            {currencies.map((c) => <option key={c.code} value={c.code}>{c.code} · {c.name}</option>)}
          </select>
          <select value={openType} onChange={(e) => setOpenType(e.target.value)}>
            <option value="checking">Checking</option>
            <option value="savings">Savings</option>
          </select>
          <button className="btn btn-primary" disabled={busy}
            onClick={() => call('open_bank_account', { p_currency: openCur || homeCur || cur0, p_type: openType }, 'Account opened.')}>
            Open account
          </button>
        </div>
      </div>

      {accounts.length > 0 && (
        <>
          <div className="panel wide">
            <h3>Deposit / withdraw</h3>
            <div className="row">
              <select value={acctId(moveAcct)} onChange={(e) => setMoveAcct(e.target.value)}>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.currency_code} {a.account_type}</option>)}
              </select>
              <input type="number" min="0" step="0.01" placeholder="Amount" value={moveAmt}
                onChange={(e) => setMoveAmt(e.target.value)} />
            </div>
            <div className="row">
              <button className="btn btn-primary" disabled={busy}
                onClick={() => call('deposit', { p_account: acctId(moveAcct), p_amount: Number(moveAmt), p_key: newKey() }, 'Deposit complete.', () => setMoveAmt(''))}>
                Deposit cash
              </button>
              <button className="btn btn-dark" disabled={busy}
                onClick={() => call('withdraw', { p_account: acctId(moveAcct), p_amount: Number(moveAmt), p_key: newKey() }, 'Withdrawal complete.', () => setMoveAmt(''))}>
                Withdraw to cash
              </button>
            </div>
          </div>

          <div className="panel wide">
            <h3>Transfer to a player</h3>
            <p className="muted small">The recipient needs an active account in the same currency.</p>
            <div className="row">
              <select value={acctId(trAcct)} onChange={(e) => setTrAcct(e.target.value)}>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.currency_code} {a.account_type} ({money(a.balance)})</option>)}
              </select>
              <input placeholder="Recipient username" value={trUser} onChange={(e) => setTrUser(e.target.value)} />
            </div>
            <div className="row">
              <input type="number" min="0" step="0.01" placeholder="Amount" value={trAmt} onChange={(e) => setTrAmt(e.target.value)} />
              <input placeholder="Memo (optional)" maxLength={100} value={trMemo} onChange={(e) => setTrMemo(e.target.value)} />
            </div>
            <button className="btn btn-primary" disabled={busy}
              onClick={() => call('transfer_funds', { p_from_account: acctId(trAcct), p_to_username: trUser, p_amount: Number(trAmt), p_key: newKey(), p_memo: trMemo }, 'Transfer sent.', () => { setTrAmt(''); setTrMemo(''); })}>
              Send transfer
            </button>
          </div>
        </>
      )}

      <div className="panel wide">
        <h3>Currency exchange (cash wallets, 1% fee)</h3>
        <div className="row">
          <select value={fFrom} onChange={(e) => setExFrom(e.target.value)}>
            {currencies.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
          </select>
          <span className="muted">to</span>
          <select value={fTo} onChange={(e) => setExTo(e.target.value)}>
            {currencies.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
          </select>
        </div>
        <div className="row">
          <input type="number" min="0" step="0.01" placeholder="Amount to sell" value={exAmt} onChange={(e) => setExAmt(e.target.value)} />
        </div>
        {quote > 0 && <p className="muted small">You receive about {money(quote)} {fTo}. The server calculates the final amount.</p>}
        <button className="btn btn-primary" disabled={busy}
          onClick={() => call('exchange_currency', { p_from: fFrom, p_to: fTo, p_amount: Number(exAmt), p_key: newKey() }, 'Exchange complete.', () => setExAmt(''))}>
          Exchange
        </button>
      </div>

      <div className="panel wide">
        <h3>Transaction ledger</h3>
        {txs.length === 0 && <p className="muted">No transactions yet.</p>}
        <div className="tablewrap">
          <table className="table">
            <thead><tr><th>Time</th><th>Type</th><th>Amount</th><th>Note</th></tr></thead>
            <tbody>
              {txs.map((t) => (
                <tr key={t.id}>
                  <td>{new Date(t.created_at).toLocaleString()}</td>
                  <td>{t.kind}</td>
                  <td className={t.direction === 'credit' ? 'pos' : t.direction === 'debit' ? 'neg' : ''}>
                    {t.direction === 'credit' ? '+' : t.direction === 'debit' ? '-' : ''}{money(t.amount)} {t.currency_code}
                  </td>
                  <td className="muted">{[t.counterparty, t.memo].filter(Boolean).join(' · ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
