export default function Bar({ pct }) {
  const w = Math.max(0, Math.min(100, Number(pct) || 0));
  return (
    <div style={{ height: 6, borderRadius: 3, background: '#29364A', marginTop: 6 }}>
      <div style={{ height: 6, borderRadius: 3, width: w + '%', background: '#2563EB' }} />
    </div>);
}
