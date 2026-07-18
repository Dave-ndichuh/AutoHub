import AnimatedNumber from './AnimatedNumber';

export default function MetricCard({ title, icon, value, prefix = '', suffix = '', decimals = 0, subline, accentColor = 'var(--primary)', className = '' }) {
  return (
    <div 
      className={`glass metric-card card-lift ${className}`} 
      style={{ 
        padding: '1.5rem', 
        borderTop: `4px solid ${accentColor}`,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        height: '100%'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--muted-foreground)', marginBottom: '1rem' }}>
        {icon && <span style={{ color: accentColor, display: 'flex' }}>{icon}</span>}
        <span style={{ fontWeight: 600, fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{title}</span>
      </div>
      
      <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--foreground)', lineHeight: 1.1, marginBottom: '0.5rem' }}>
        <AnimatedNumber value={value} prefix={prefix} suffix={suffix} decimals={decimals} />
      </div>
      
      {subline && (
        <div style={{ fontSize: '0.875rem', color: 'var(--muted-foreground)', fontWeight: 500 }}>
          {subline}
        </div>
      )}
    </div>
  );
}
