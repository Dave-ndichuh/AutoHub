'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/AuthGuard';
import { useRouter } from 'next/navigation';
import { Wallet, Search, ArrowRight, User as UserIcon } from 'lucide-react';
import { motion } from 'framer-motion';

export default function CreditDocketPage() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('All'); // All, Active Debt, Over Limit, Blocked
  const router = useRouter();

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('credit_accounts')
        .select(`
          *,
          customer:customer_id (FIRST_NAME, LAST_NAME, PHONE_NUMBER)
        `)
        .order('current_balance', { ascending: false });

      if (error) throw error;
      setAccounts(data || []);
    } catch (err) {
      console.error('Error fetching credit accounts:', err);
      alert('Failed to load credit accounts.');
    } finally {
      setLoading(false);
    }
  };

  const filteredAccounts = accounts.filter(acc => {
    // Apply search
    const matchesSearch = 
      acc.customer?.FIRST_NAME?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      acc.customer?.LAST_NAME?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      acc.customer?.PHONE_NUMBER?.includes(searchTerm);
      
    if (!matchesSearch) return false;

    // Apply filter
    if (filter === 'Active Debt') return acc.current_balance > 0;
    if (filter === 'Over Limit') return acc.current_balance >= acc.credit_limit;
    if (filter === 'Blocked') return acc.status === 'blocked';
    
    return true; // All
  });

  const totalReceivables = accounts.reduce((sum, acc) => sum + Number(acc.current_balance), 0);
  const activeDebtCount = accounts.filter(acc => acc.current_balance > 0).length;

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexShrink: 0 }}>
        <h1 className="heading-1" style={{ display: 'flex', alignItems: 'center', gap: '1rem', margin: 0 }}>
          <Wallet size={36} color="var(--primary)" />
          Credit Docket
        </h1>
      </div>

      {/* Overview Cards */}
      <div className="grid-cards" style={{ marginBottom: '1.5rem', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', flexShrink: 0 }}>
        <div className="glass" style={{ padding: '1.5rem' }}>
          <p className="text-muted" style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Total Accounts Receivable</p>
          <h2 style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--primary)' }}>
            Ksh. {totalReceivables.toLocaleString()}
          </h2>
        </div>
        <div className="glass" style={{ padding: '1.5rem' }}>
          <p className="text-muted" style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Active Debt Accounts</p>
          <h2 style={{ fontSize: '2rem', fontWeight: 700 }}>
            {activeDebtCount}
          </h2>
        </div>
        <div className="glass" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
           <button 
             className="btn btn-primary" 
             style={{ width: '100%', padding: '1rem' }}
             onClick={() => alert("To add a new credit account, create a credit sale for a customer in the POS, or run the onboarding script.")}
           >
             + New Credit Customer
           </button>
        </div>
      </div>

      {/* Filters & Search */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap', flexShrink: 0 }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '300px' }}>
          <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted-foreground)' }} />
          <input 
            type="text" 
            placeholder="Search by name or phone..." 
            className="input" 
            style={{ paddingLeft: '2.5rem' }}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {['All', 'Active Debt', 'Over Limit', 'Blocked'].map(f => (
            <button 
              key={f}
              className={`btn ${filter === f ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setFilter(f)}
              style={{ padding: '0.5rem 1rem' }}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="table-wrapper glass" style={{ flex: 1, overflowY: 'auto', border: '1px solid var(--border)', minHeight: 0 }}>
        <table className="table" style={{ margin: 0 }}>
          <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
            <tr>
              <th style={{ background: 'var(--background)' }}>Customer</th>
              <th style={{ background: 'var(--background)' }}>Phone</th>
              <th style={{ background: 'var(--background)' }}>Credit Limit</th>
              <th style={{ background: 'var(--background)' }}>Current Debt</th>
              <th style={{ background: 'var(--background)' }}>Available Credit</th>
              <th style={{ background: 'var(--background)' }}>Status</th>
              <th style={{ background: 'var(--background)' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="7" style={{ textAlign: 'center', padding: '2rem' }}>Loading accounts...</td></tr>
            ) : filteredAccounts.length === 0 ? (
              <tr><td colSpan="7" style={{ textAlign: 'center', padding: '2rem' }}>No accounts found.</td></tr>
            ) : (
              filteredAccounts.map(acc => {
                const available = acc.credit_limit - acc.current_balance;
                const isOverLimit = available <= 0;
                return (
                  <motion.tr 
                    key={acc.id} 
                    className="table-row-interactive"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    <td style={{ fontWeight: 600 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <UserIcon size={16} className="text-muted" />
                        {acc.customer?.FIRST_NAME} {acc.customer?.LAST_NAME}
                      </div>
                    </td>
                    <td>{acc.customer?.PHONE_NUMBER || 'N/A'}</td>
                    <td>Ksh. {Number(acc.credit_limit).toLocaleString()}</td>
                    <td style={{ fontWeight: 700, color: acc.current_balance > 0 ? 'var(--destructive)' : 'inherit' }}>
                      Ksh. {Number(acc.current_balance).toLocaleString()}
                    </td>
                    <td style={{ color: isOverLimit ? 'var(--destructive)' : 'var(--primary)' }}>
                      Ksh. {Math.max(0, available).toLocaleString()}
                    </td>
                    <td>
                      <span className={`badge ${acc.status === 'blocked' ? 'badge-destructive' : acc.current_balance > 0 ? 'badge-warning' : 'badge-success'}`}>
                        {acc.status}
                      </span>
                    </td>
                    <td>
                      <button 
                        className="btn btn-secondary" 
                        style={{ padding: '0.25rem 0.75rem', fontSize: '0.875rem' }}
                        onClick={() => router.push(`/credits/${acc.customer_id}`)}
                      >
                        View Ledger <ArrowRight size={14} />
                      </button>
                    </td>
                  </motion.tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
