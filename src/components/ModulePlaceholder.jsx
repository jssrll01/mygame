export default function ModulePlaceholder({ label, phase }) {
  return (
    <div className="panel">
      <h2>{label}</h2>
      <p className="muted">
        NOT IMPLEMENTED YET.{' '}
        {phase ? `This module is scheduled for Phase ${phase}.` : 'This module is not yet scheduled.'}
      </p>
    </div>
  );
}
