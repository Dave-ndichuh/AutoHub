'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/AuthGuard';
import { ShieldAlert, Info, AlertTriangle, Search, Clock, User, FileText } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function LogsPage() {
  const { role } = useAuth();
  const router = useRouter();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (role === 'employee') {
      router.push('/pos');
      return;
    }

    const fetchLogs = async () => {
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
    };

    if (role === 'admin') {
      fetchLogs();
    }
  }, [role, router]);

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
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 className="heading-2" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <FileText size={28} className="text-primary" />
          System Audit Logs
        </h1>
        <div style={{ position: 'relative', width: '300px' }}>
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
  );
}
