import { useState } from 'react';
import { useAction, Modal, Field } from './kit';

export default function AmountModal({ title, hint, min = 1, def, confirmLabel = 'Confirm', onSubmit, onClose, onDone, notify }) {
  const [amt, setAmt] = useState(def || min);
  const [busy, run] = useAction(notify);
  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={async (e) => {
        e.preventDefault();
        if (await run(() => onSubmit(Number(amt)), 'Done')) { if (onDone) await onDone(); onClose(); }
      }}>
        <Field label={'Amount (min ' + min + ')'}>
          <input type="number" min={min} step="1" required value={amt} onChange={(e) => setAmt(e.target.value)} />
        </Field>
        {hint && <p className="ws-sub">{hint}</p>}
        <button className="ws-btn" disabled={busy}>{confirmLabel}</button>
      </form>
    </Modal>);
}
