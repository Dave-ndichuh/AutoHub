import React from 'react';
import { AlertTriangle, Info, TrendingUp, TrendingDown, ArrowRight } from 'lucide-react';

export default function InsightCard({ title, value, context, status = 'neutral', className = '', onClick }) {
  
  const getStatusConfig = () => {
    switch (status) {
      case 'danger': return { color: '#ef4444', icon: <AlertTriangle size={16} /> };
      case 'warning': return { color: '#f59e0b', icon: <AlertTriangle size={16} /> };
      case 'success': return { color: '#10b981', icon: <TrendingUp size={16} /> };
      case 'neutral': 
      default: return { color: 'var(--primary)', icon: <Info size={16} /> };
    }
  };

  const config = getStatusConfig();

  return (
    <div 
      className={`glass insight-card card-lift ${(status === 'danger' || status === 'warning') ? 'animate-pulse-subtle' : ''} ${className}`} 
      style={{ 
        padding: '1.25rem', 
        borderLeft: `3px solid ${config.color}`,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        height: '100%',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'transform 0.2s',
      }}
      onClick={onClick}
      onMouseEnter={(e) => { if (onClick) e.currentTarget.style.transform = 'scale(1.02)'; }}
      onMouseLeave={(e) => { if (onClick) e.currentTarget.style.transform = 'scale(1)'; }}
    >
      <div style={{ fontSize: '0.8125rem', color: 'var(--muted-foreground)', marginBottom: '0.5rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {title}
      </div>
      
      <div style={{ fontSize: '1.25rem', fontWeight: 700, color: status !== 'neutral' ? config.color : 'var(--foreground)', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
        {value}
        {status !== 'neutral' && config.icon}
      </div>

      {context && (
        <div style={{ fontSize: '0.875rem', color: 'var(--muted-foreground)' }}>
          {context}
        </div>
      )}
      {onClick && (
        <div style={{ marginTop: '0.75rem', fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          View Details <ArrowRight size={14} />
        </div>
      )}
    </div>
  );
}
