export const KIND = { storm: 'Storm', weather: 'Weather alert', wildfire: 'Wildfire', volcano: 'Volcano', commodity: 'Commodity price' };

export function ago(time) {
  const hours = Math.round((Date.now() - new Date(time)) / 3600000);
  if (Number.isNaN(hours)) return '';
  if (hours < 1) return 'in the last hour';
  if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  const days = Math.round(hours / 24);
  return `${days} ${days === 1 ? 'day' : 'days'} ago`;
}

export function Skeleton({ width = '100%', height = 14, style }) {
  return <div className="skeleton" style={{ width, height, ...style }} />;
}

export function SkeletonRows({ count = 3 }) {
  return (
    <div aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <div className="card" key={i}>
          <Skeleton width={90} height={10} />
          <Skeleton width="55%" height={16} style={{ margin: '10px 0' }} />
          <Skeleton width="85%" height={11} />
        </div>
      ))}
    </div>
  );
}

export function Chain({ steps, direction }) {
  return (
    <ol className={`timeline chain ${direction || ''}`}>
      {steps.map((step) => <li key={step}>{step}</li>)}
    </ol>
  );
}

export function Tabs({ tabs, active, onChange }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((tab) => (
        <button key={tab.id} role="tab" aria-selected={active === tab.id} className={active === tab.id ? 'active' : ''} onClick={() => onChange(tab.id)}>
          {tab.label}
        </button>
      ))}
    </div>
  );
}
