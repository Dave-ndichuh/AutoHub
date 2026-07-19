'use client';

import { usePathname } from 'next/navigation';
import { User, Palette, Menu, RefreshCw, Clock, Settings2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/context/ThemeContext';
import { useBranch } from '@/context/BranchContext';
import { useAuth } from '@/components/AuthGuard';

export default function Topbar() {
  const pathname = usePathname();
  const { theme, changeTheme } = useTheme();
  const { currentBranch, setBranch } = useBranch();
  const { user, role, branchId, setBranchId } = useAuth();
  const userEmail = user?.email || '';

  // Clock State
  const [currentTime, setCurrentTime] = useState(null);
  const [timeFormat, setTimeFormat] = useState('12h');
  const [dateFormat, setDateFormat] = useState('long');
  const [showTimeSettings, setShowTimeSettings] = useState(false);

  useEffect(() => {
    // Load preferences
    const savedTimeFormat = localStorage.getItem('timeFormat') || '12h';
    const savedDateFormat = localStorage.getItem('dateFormat') || 'long';
    setTimeFormat(savedTimeFormat);
    setDateFormat(savedDateFormat);

    setCurrentTime(new Date());

    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleTimeFormatChange = (val) => {
    setTimeFormat(val);
    localStorage.setItem('timeFormat', val);
  };

  const handleDateFormatChange = (val) => {
    setDateFormat(val);
    localStorage.setItem('dateFormat', val);
  };

  const formatTime = () => {
    if (!currentTime) return '';
    return currentTime.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: timeFormat === '12h'
    });
  };

  const formatDate = () => {
    if (!currentTime) return '';
    return dateFormat === 'short' 
      ? currentTime.toLocaleDateString('en-GB') // DD/MM/YYYY
      : currentTime.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Hide topbar on login pages and landing page, and shop
  if (pathname === '/login' || pathname === '/employee-login' || pathname === '/' || pathname?.startsWith('/shop') || pathname === '/about' || pathname === '/contact') return null;

  // Format the title based on the path
  const getTitle = () => {
    if (pathname === '/') return 'Overview';
    return pathname.charAt(1).toUpperCase() + pathname.slice(2);
  };

  const toggleSidebar = () => {
    document.body.classList.toggle('sidebar-open');
  };

  return (
    <header className="topbar">
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        {/* Hamburger Menu (visible only on small screens) */}
        <button 
          onClick={toggleSidebar}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.5rem', color: 'var(--foreground)' }}
          className="mobile-menu-btn"
        >
          <Menu size={20} />
        </button>


        <h1 className="heading-2 title-text">
          {getTitle()}
        </h1>
      </div>
      
      <div className="topbar-right">
        
        {/* Date & Time Display */}
        {currentTime && (
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.25rem 0.5rem', gap: '0.75rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted-foreground)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                {formatDate()}
              </span>
              <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--foreground)', fontVariantNumeric: 'tabular-nums' }}>
                {formatTime()}
              </span>
            </div>
            
            <button 
              onClick={() => setShowTimeSettings(!showTimeSettings)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: '4px', padding: '0.25rem', color: 'var(--muted-foreground)', cursor: 'pointer', transition: 'all 0.2s' }}
              onMouseEnter={(e) => e.currentTarget.style.color = 'var(--primary)'}
              onMouseLeave={(e) => e.currentTarget.style.color = 'var(--muted-foreground)'}
            >
              <Settings2 size={14} />
            </button>

            {showTimeSettings && (
              <div style={{ position: 'absolute', top: 'calc(100% + 0.5rem)', right: 0, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px', padding: '1rem', boxShadow: '0 10px 25px rgba(0,0,0,0.5)', zIndex: 50, minWidth: '200px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted-foreground)', marginBottom: '0.5rem' }}>Time Format</label>
                  <select className="input" style={{ width: '100%', padding: '0.5rem' }} value={timeFormat} onChange={(e) => handleTimeFormatChange(e.target.value)}>
                    <option value="12h">12-Hour (AM/PM)</option>
                    <option value="24h">24-Hour</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted-foreground)', marginBottom: '0.5rem' }}>Date Format</label>
                  <select className="input" style={{ width: '100%', padding: '0.5rem' }} value={dateFormat} onChange={(e) => handleDateFormatChange(e.target.value)}>
                    <option value="long">Long (Fri, Oct 20, 2023)</option>
                    <option value="short">Short (20/10/2023)</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Refresh Button */}
        <button 
          onClick={() => window.location.reload()}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '50%', width: '36px', height: '36px', color: 'var(--foreground)', cursor: 'pointer', transition: 'all 0.2s', flexShrink: 0 }}
          title="Refresh App"
          onMouseEnter={(e) => e.currentTarget.style.transform = 'rotate(15deg)'}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'rotate(0deg)'}
        >
          <RefreshCw size={16} />
        </button>

        {/* Branch Switcher for Admins */}
        {role === 'admin' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--card)', padding: '0.25rem 0.5rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
            <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--muted-foreground)' }}>Data Branch:</span>
            <select 
              value={branchId} 
              onChange={(e) => {
                const val = e.target.value;
                setBranchId(val === 'ALL' ? 'ALL' : Number(val));
                if (val === '1') setBranch('local');
                else if (val === '2') setBranch('ex-japan');
                else setBranch(null);
              }}
              style={{ background: 'transparent', border: 'none', color: 'var(--foreground)', fontSize: '0.875rem', fontWeight: 600, outline: 'none', cursor: 'pointer' }}
            >
              <option value="ALL" style={{ background: 'var(--card)', color: 'var(--foreground)' }}>All Branches</option>
              <option value="1" style={{ background: 'var(--card)', color: 'var(--foreground)' }}>Jobea Local</option>
              <option value="2" style={{ background: 'var(--card)', color: 'var(--foreground)' }}>Jobea Ex-Japan</option>
            </select>
          </div>
        )}

        {/* Branch Persistence Indicator Badge */}
        {currentBranch && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.25rem 0.75rem',
            borderRadius: '9999px',
            background: 'rgba(167, 139, 250, 0.1)',
            border: '1px solid rgba(167, 139, 250, 0.3)',
            boxShadow: '0 0 10px rgba(167, 139, 250, 0.2)',
          }}>
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: '#a78bfa',
              boxShadow: '0 0 8px #a78bfa',
            }} />
            <span style={{
              fontSize: '0.875rem',
              fontWeight: 600,
              color: '#d8b4fe',
            }}>
              Jobea {currentBranch === 'local' ? 'Local' : 'Ex-Japan'}
            </span>
          </div>
        )}

        {/* Theme Switcher */}
        <div className="theme-switcher-container">
          <div className="theme-icon">
            <Palette size={16} className="text-muted" style={{ marginLeft: '0.25rem' }} />
          </div>
          <div style={{ display: 'flex', gap: '0.25rem' }}>
            <button 
              onClick={() => changeTheme('midnight')}
              style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#0f172a', border: theme === 'midnight' ? '2px solid #3b82f6' : '1px solid rgba(255,255,255,0.2)', cursor: 'pointer' }}
              title="Midnight Theme"
            />
            <button 
              onClick={() => changeTheme('ocean')}
              style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#083344', border: theme === 'ocean' ? '2px solid #06b6d4' : '1px solid rgba(255,255,255,0.2)', cursor: 'pointer' }}
              title="Ocean Theme"
            />
            <button 
              onClick={() => changeTheme('forest')}
              style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#022c22', border: theme === 'forest' ? '2px solid #10b981' : '1px solid rgba(255,255,255,0.2)', cursor: 'pointer' }}
              title="Forest Theme"
            />
            <button 
              onClick={() => changeTheme('sunset')}
              style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#2e1065', border: theme === 'sunset' ? '2px solid #f97316' : '1px solid rgba(255,255,255,0.2)', cursor: 'pointer' }}
              title="Sunset Theme"
            />
          </div>
        </div>

        <div className="badge badge-success online-badge">Online</div>
        <div className="user-badge">
          <User size={16} className="text-muted" style={{ flexShrink: 0 }} />
          <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>{userEmail || 'Admin'}</span>
        </div>
      </div>
    </header>
  );
}
