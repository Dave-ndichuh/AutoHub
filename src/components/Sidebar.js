'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  Users, 
  Package, 
  ShoppingCart, 
  Truck, 
  FileText, 
  Settings,
  LogOut,
  BarChart3,
  Wrench,
  ShieldAlert
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { useAuth } from '@/components/AuthGuard';

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { role } = useAuth();



  const handleLogout = async () => {
    await supabase.auth.signOut();
    document.body.classList.remove('sidebar-open');
    router.push('/login');
  };

  const closeSidebar = () => {
    document.body.classList.remove('sidebar-open');
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (document.body.classList.contains('sidebar-open')) {
        const sidebar = document.querySelector('.sidebar');
        const toggleBtn = document.querySelector('.mobile-menu-btn');
        if (
          sidebar && !sidebar.contains(e.target) && 
          (!toggleBtn || !toggleBtn.contains(e.target))
        ) {
          document.body.classList.remove('sidebar-open');
        }
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  let navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Point of Sale', path: '/pos', icon: ShoppingCart },
    { name: 'Products', path: '/products', icon: Package },
    { name: 'Customers', path: '/customers', icon: Users },
    { name: 'Suppliers', path: '/suppliers', icon: Truck },
    { name: 'Transactions', path: '/transactions', icon: FileText },
    { name: 'Services', path: '/services', icon: Wrench },
    { name: 'Reports', path: '/reports', icon: BarChart3 },
    { name: 'System Logs', path: '/logs', icon: ShieldAlert },
    { name: 'Employees', path: '/employees', icon: Users },
    { name: 'Settings', path: '/settings', icon: Settings },
  ];

  if (role === 'employee') {
    navItems = [
      { name: 'Point of Sale', path: '/pos', icon: ShoppingCart },
      { name: 'Customers', path: '/customers', icon: Users },
      { name: 'Transactions', path: '/transactions', icon: FileText },
      { name: 'Services', path: '/services', icon: Wrench },
    ];
  }

  // Hide sidebar on login pages
  if (pathname === '/login' || pathname === '/employee-login') return null;

  return (
    <aside className="sidebar glass-panel">
      <div className="sidebar-header" style={{ padding: '1.5rem', display: 'flex', justifyContent: 'center' }}>
        <img src="/logo.png" alt="Jobea Auto Logo" style={{ height: '48px', objectFit: 'contain', filter: 'drop-shadow(0 2px 4px rgba(16, 185, 129, 0.1))', opacity: 0.95, transition: 'all 0.3s ease' }} />
      </div>
      
      <nav className="sidebar-nav">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.path;
          return (
            <Link 
              key={item.path} 
              href={item.path}
              onClick={closeSidebar}
              className={`nav-item ${isActive ? 'active' : ''}`}
            >
              <Icon size={20} />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>

      <div style={{ padding: '1.5rem', borderTop: '1px solid var(--border)' }}>
        <button className="nav-item" onClick={handleLogout} style={{ width: '100%', justifyContent: 'flex-start', background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }}>
          <LogOut size={20} />
          <span>Logout</span>
        </button>
      </div>

      <div style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', color: 'var(--muted-foreground)', textAlign: 'center', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <span>&copy; {new Date().getFullYear()} Jobea Autos</span>
        <span>
          System by: <a href="https://machariandichu.vercel.app/" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: 500 }}>Nexus Solutions</a>
        </span>
      </div>
    </aside>
  );
}
