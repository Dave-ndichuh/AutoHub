'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/AuthGuard';
import { ShieldAlert, Info, AlertTriangle, Search, Clock, User, FileText, Trash2, X, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function LogsPage() {
  const { role, user } = useAuth();
  const router = useRouter();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Clear Logs State
  const [showClearModal, setShowClearModal] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [clearing, setClearing] = useState(false);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('system_logs')
      .select(`
        *,
        employee ( FIRST_NAME, LAST_NAME )
      `)
      .order('CREATED_AT', { ascending: false })
      .limit(100);

    if (!error && data) {
      setLogs(data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (role === 'employee') {
      router.push('/pos');
      return;
    }

    if (role === 'admin') {
      fetchLogs();
    }
  }, [role, router, fetchLogs]);

  const handleClearLogs = async (e) => {
    e.preventDefault();
    setClearing(true);
    
    // Verify admin password
    const { error } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: adminPassword
    });

    if (error) {
      alert('Incorrect password. Logs were not cleared.');
      setClearing(false);
      return;
    }

    // Password verified, clear logs (delete all where LOG_ID is not null)
    const { error: clearError } = await supabase.from('system_logs').delete().not('LOG_ID', 'is', null);
    
    if (clearError) {
      alert('Error clearing logs: ' + clearError.message);
    } else {
      // Add a log entry for this action
      await supabase.from('system_logs').insert([{
        USER_ID: user.id,
        USER_EMAIL: user.email,
        ACTION: 'Cleared System Logs',
        DETAILS: 'Admin successfully verified password and cleared all system logs.',
        SEVERITY: 'warning'
      }]);
      
      setShowClearModal(false);
      setAdminPassword('');
      fetchLogs();
    }
    setClearing(false);
  };

  const filteredLogs = logs.filter(log => {
    const term = searchTerm.toLowerCase();
    const employeeName = log.employee ? `${log.employee.FIRST_NAME} ${log.employee.LAST_NAME}`.toLowerCase() : '';
    const email = (log.USER_EMAIL || '').toLowerCase();
    const action = (log.ACTION || '').toLowerCase();
    const details = (log.DETAILS || '').toLowerCase();

    return action.includes(term) || details.includes(term) || employeeName.includes(term) || email.includes(term);
  });

  const getSeverityIcon = (severity) => {
    switch (severity) {
      case 'danger': return <ShieldAlert size={18} color="#ef4444" />;
      case 'warning': return <AlertTriangle size={18} color="#f59e0b" />;
      default: return <Info size={18} color="#3b82f6" />;
    }
  };

  const getSeverityBadge = (severity) => {
    switch (severity) {
      case 'danger': return <span className="badge badge-destructive">Danger</span>;
      case 'warning': return <span className="badge badge-warning">Warning</span>;
      default: return <span className="badge badge-primary" style={{background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6'}}>Info</span>;
    }
  };

  if (role !== 'admin') return null;

  return (
    <>
      <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
          <h1 className="heading-2" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <FileText size={28} className="text-primary" />
            System Audit Logs
          </h1>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <div style={{ position: 'relative', width: '300px', maxWidth: '100%' }}>
              <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted-foreground)' }} />
              <input 
                type="text" 
                placeholder="Search logs, actions, or users..." 
                className="input" 
                style={{ paddingLeft: '2.5rem' }}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <button className="btn btn-destructive" onClick={() => setShowClearModal(true)}>
              <Trash2 size={18} />
              Clear Logs
            </button>
          </div>
        </div>

        <div className="glass table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Severity</th>
                <th>Action</th>
                <th>User</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="5" style={{ textAlign: 'center', padding: '2rem' }}>Loading system logs...</td></tr>
              ) : filteredLogs.length === 0 ? (
                <tr><td colSpan="5" style={{ textAlign: 'center', padding: '2rem' }}>No logs found matching your criteria.</td></tr>
              ) : filteredLogs.map((log) => (
                <tr key={log.LOG_ID}>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--muted-foreground)', fontSize: '0.875rem' }}>
                      <Clock size={14} />
                      {new Date(log.CREATED_AT).toLocaleString()}
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {getSeverityIcon(log.SEVERITY)}
                      {getSeverityBadge(log.SEVERITY)}
                    </div>
                  </td>
                  <td style={{ fontWeight: 600 }}>{log.ACTION}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <User size={14} className="text-muted" />
                      </div>
                      <div>
                        {log.employee ? (
                          <div style={{ fontWeight: 500 }}>{log.employee.FIRST_NAME} {log.employee.LAST_NAME}</div>
                        ) : (
                          <div style={{ fontWeight: 500 }}>Admin</div>
                        )}
                        {log.USER_EMAIL && <div style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>{log.USER_EMAIL}</div>}
                      </div>
                    </div>
                  </td>
                  <td style={{ maxWidth: '400px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    <span style={{ fontSize: '0.875rem', color: 'var(--muted-foreground)' }}>{log.DETAILS}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Clear Logs Modal */}
      {showClearModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '2rem' }}>
          <div className="glass animate-fade-in" style={{ width: '100%', maxWidth: '450px', background: 'var(--background)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.5rem', borderBottom: '1px solid var(--border)' }}>
              <h3 className="heading-2" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#ef4444' }}>
                <ShieldAlert size={24} />
                Clear System Logs
              </h3>
              <button onClick={() => { setShowClearModal(false); setAdminPassword(''); }} disabled={clearing}><X size={20} className="text-muted" /></button>
            </div>
            
            <form onSubmit={handleClearLogs} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{ padding: '1rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '8px', color: '#ef4444', fontSize: '0.875rem' }}>
                <strong>Warning:</strong> You are about to permanently delete all system audit logs. This action cannot be undone. Please enter your administrator password to confirm.
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: 'var(--muted-foreground)', marginBottom: '0.5rem' }}>Admin Password</label>
                <input 
                  type="password" 
                  className="input" 
                  placeholder="Enter your password" 
                  value={adminPassword} 
                  onChange={e => setAdminPassword(e.target.value)} 
                  required 
                  autoFocus
                  disabled={clearing}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', paddingTop: '0.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => { setShowClearModal(false); setAdminPassword(''); }} disabled={clearing}>Cancel</button>
                <button type="submit" className="btn btn-destructive" disabled={clearing || !adminPassword}>
                  {clearing ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
                  Confirm Clear Logs
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
