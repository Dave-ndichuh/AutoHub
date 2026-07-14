'use client';

import { useState, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

const BRANCHES = [
  { id: 1, name: 'Jobea Local' },
  { id: 2, name: 'Jobea Ex-Japan' },
];

export default function BranchSelect({ 
  value, 
  onChange, 
  disabled = false, 
  topbarBranch,
  required = true 
}) {
  const [touched, setTouched] = useState(false);
  const showError = required && touched && !value;

  // Auto-select if topbar is set to a specific branch
  useEffect(() => {
    if (topbarBranch !== 'ALL' && !value && !disabled) {
      onChange(topbarBranch);
    }
  }, [topbarBranch, value, disabled, onChange]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <label style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--muted-foreground)' }}>
        Branch Assignment {required && <span style={{ color: '#ef4444' }}>*</span>}
      </label>
      
      <div style={{ position: 'relative' }}>
        <select
          value={value || ''}
          onChange={(e) => onChange(Number(e.target.value))}
          onBlur={() => setTouched(true)}
          disabled={disabled}
          required={required}
          className={`input ${showError ? 'error' : ''}`}
          style={{ 
            width: '100%', 
            appearance: 'none', 
            background: 'var(--card)', 
            borderColor: showError ? '#ef4444' : 'var(--border)',
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.6 : 1
          }}
        >
          <option value="" disabled>Select Branch</option>
          {BRANCHES.map(branch => (
            <option key={branch.id} value={branch.id}>
              {branch.name}
            </option>
          ))}
        </select>
        <ChevronDown size={18} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted-foreground)', pointerEvents: 'none' }} />
      </div>

      {showError && (
        <p style={{ fontSize: '0.75rem', color: '#ef4444', margin: 0 }}>Please select a branch to continue</p>
      )}
      
      {!disabled && (
        <p style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', margin: 0 }}>
          This cannot be changed after creation.
        </p>
      )}
      {disabled && (
        <p style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', margin: 0 }}>
          Branch is locked. Contact Admin to transfer.
        </p>
      )}
    </div>
  );
}
