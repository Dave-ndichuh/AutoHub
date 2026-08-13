'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';

const AuthContext = createContext({ user: null, role: null, employeeId: null, branchId: null, setBranchId: () => {}, loading: true });

export const useAuth = () => useContext(AuthContext);

export default function AuthProvider({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [employeeId, setEmployeeId] = useState(null);
  const [branchId, setBranchId] = useState(null);
  const [showLogoutPrompt, setShowLogoutPrompt] = useState(false);
  const [countdown, setCountdown] = useState(60);

  useEffect(() => {
    const checkAuth = async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setUser(null);
        setRole(null);
        setEmployeeId(null);
        setBranchId(null);
        if (pathname !== '/login' && pathname !== '/employee-login' && pathname !== '/' && !pathname.startsWith('/shop') && pathname !== '/about' && pathname !== '/contact') {
          router.push('/');
        } else {
          setAuthorized(true);
        }
        setLoading(false);
        return;
      }

      setUser(user);

      const { data: empData, error: empError } = await supabase
        .from('employee')
        .select('EMAIL, EMPLOYEE_ID, BRANCH_ID')
        .ilike('EMAIL', user.email)
        .maybeSingle();

      const isEmployee = !!empData;
      const currentRole = isEmployee ? 'employee' : 'admin';
      setRole(currentRole);
      setEmployeeId(empData?.EMPLOYEE_ID || null);
      
      // Default to 'ALL' for admins, or the employee's specific branch for staff
      if (!branchId) {
        let initialBranchId = 'ALL';
        const storedBranch = typeof window !== 'undefined' ? localStorage.getItem('jobea_branch') : null;
        
        if (isEmployee) {
          initialBranchId = empData?.BRANCH_ID || (storedBranch === 'ex-japan' ? 2 : 1);
        } else if (storedBranch) {
          initialBranchId = storedBranch === 'local' ? 1 : (storedBranch === 'ex-japan' ? 2 : 'ALL');
        }
        
        setBranchId(initialBranchId);
      }

      if (isEmployee) {
        const allowedEmployeeRoutes = ['/pos', '/customers', '/transactions', '/services', '/invoices', '/login', '/employee-login'];
        if (!allowedEmployeeRoutes.includes(pathname)) {
          router.push('/pos');
          return;
        }
      }

      setAuthorized(true);
      setLoading(false);
    };

    checkAuth();

    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        setUser(null);
        setRole(null);
        setEmployeeId(null);
        setBranchId(null);
        router.push('/');
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [pathname, router, branchId]);

  useEffect(() => {
    let inactivityTimer;

    const resetTimer = () => {
      if (showLogoutPrompt) return; // Don't reset if prompt is active
      if (inactivityTimer) clearTimeout(inactivityTimer);
      
      if (user) {
        inactivityTimer = setTimeout(() => {
          setShowLogoutPrompt(true);
          setCountdown(60);
        }, 4 * 60 * 1000); // 4 minutes
      }
    };

    if (user) {
      const events = ['mousemove', 'keydown', 'mousedown', 'scroll', 'touchstart'];
      events.forEach((e) => window.addEventListener(e, resetTimer));
      resetTimer();

      return () => {
        if (inactivityTimer) clearTimeout(inactivityTimer);
        events.forEach((e) => window.removeEventListener(e, resetTimer));
      };
    }
  }, [user, showLogoutPrompt]);

  useEffect(() => {
    let interval;
    if (showLogoutPrompt && countdown > 0) {
      interval = setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    } else if (showLogoutPrompt && countdown === 0) {
      supabase.auth.signOut();
      setShowLogoutPrompt(false);
    }
    return () => clearInterval(interval);
  }, [showLogoutPrompt, countdown]);

  const handleStayLoggedIn = () => {
    setShowLogoutPrompt(false);
    setCountdown(60);
  };

  if (loading) {
    return <div style={{ minHeight: '100vh', background: 'var(--background)' }} />;
  }

  if (!authorized && pathname !== '/login' && pathname !== '/employee-login' && pathname !== '/' && !pathname.startsWith('/shop') && pathname !== '/about' && pathname !== '/contact') return null;

  return (
    <AuthContext.Provider value={{ user, role, employeeId, branchId, setBranchId, loading }}>
      {children}
      {showLogoutPrompt && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 9999
        }}>
          <div style={{
            background: 'var(--card-bg, white)', padding: '2rem', borderRadius: '8px',
            textAlign: 'center', color: 'var(--text-color, black)', maxWidth: '400px', width: '90%',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
          }}>
            <h2 style={{ marginBottom: '1rem', fontSize: '1.25rem', fontWeight: 'bold' }}>Are you still there?</h2>
            <p style={{ marginBottom: '1.5rem' }}>
              You have been inactive for a while. You will be automatically logged out in <strong>{countdown}</strong> seconds.
            </p>
            <button 
              onClick={handleStayLoggedIn}
              style={{
                background: '#3b82f6', color: 'white', border: 'none',
                padding: '0.75rem 1.5rem', borderRadius: '4px', cursor: 'pointer',
                fontWeight: 'bold', width: '100%', fontSize: '1rem'
              }}
            >
              I'm still here
            </button>
          </div>
        </div>
      )}
    </AuthContext.Provider>
  );
}
