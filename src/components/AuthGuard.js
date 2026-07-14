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

  useEffect(() => {
    const checkAuth = async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setUser(null);
        setRole(null);
        setEmployeeId(null);
        setBranchId(null);
        if (pathname !== '/login' && pathname !== '/employee-login' && pathname !== '/') {
          router.push('/login');
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

  if (loading) {
    return <div style={{ minHeight: '100vh', background: 'var(--background)' }} />;
  }

  if (!authorized && pathname !== '/login' && pathname !== '/employee-login' && pathname !== '/') return null;

  return (
    <AuthContext.Provider value={{ user, role, employeeId, branchId, setBranchId, loading }}>
      {children}
    </AuthContext.Provider>
  );
}
