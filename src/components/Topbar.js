'use client';

import { usePathname } from 'next/navigation';
import { User, Palette, Menu, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/context/ThemeContext';

import { useAuth } from '@/components/AuthGuard';

export default function Topbar() {
  const pathname = usePathname();
  const { theme, changeTheme } = useTheme();
  const { user } = useAuth();
  const userEmail = user?.email || '';

  // Hide topbar on login pages
  if (pathname === '/login' || pathname === '/employee-login') return null;

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
        <style jsx>{`
          .mobile-menu-btn { display: none !important; }
          .topbar-right { display: flex; align-items: center; gap: 1.5rem; }
          .theme-switcher-container { display: flex; align-items: center; gap: 0.5rem; background: var(--card); padding: 0.5rem; border-radius: 99px; border: 1px solid var(--border); }
          .user-badge { display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 1rem; background: var(--card); border-radius: 99px; border: 1px solid var(--border); }
          .online-badge { display: block; }
          .theme-icon { display: block; }
          .title-text { margin: 0; color: var(--foreground); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 300px; }
          
          @media (max-width: 1024px) { 
            .mobile-menu-btn { display: flex !important; } 
          }
          @media (max-width: 768px) {
            .topbar-right { gap: 0.5rem; }
            .online-badge { display: none !important; }
            .user-badge span { display: none; } /* Hide the email text, keep the icon */
            .user-badge { padding: 0.5rem; border-radius: 50%; width: 36px; height: 36px; justify-content: center; }
          }
          @media (max-width: 480px) {
            .theme-icon { display: none !important; }
            .theme-switcher-container { padding: 0.35rem; }
            .title-text { font-size: 1.25rem; max-width: 110px; }
          }
        `}</style>

        <h1 className="heading-2 title-text">
          {getTitle()}
        </h1>
      </div>
      
      <div className="topbar-right">
        
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
