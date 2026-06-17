'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { AlertTriangle, CheckCircle, ExternalLink } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function CreditSalesTable() {
  const router = useRouter();
  const [creditSales, setCreditSales] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchCreditSales = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('transaction')
      .select(`
        TRANS_ID,
        CREATED_AT,
        ADJUSTED_TOTAL,
        GRAND_TOTAL,
        CREDIT_DUE_DATE,
        CREDIT_TERMS,
        IS_SETTLED,
        credit_customer:customer!transaction_CREDIT_CUSTOMER_ID_fkey(FIRST_NAME, LAST_NAME)
      `)
      .eq('IS_CREDIT', true)
      .eq('IS_SETTLED', false)
      .order('CREDIT_DUE_DATE', { ascending: true });

    if (!error && data) {
      setCreditSales(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchCreditSales();
  }, []);

  const handleSettle = async (transId) => {
    if (!confirm('Mark this credit sale as fully paid/settled?')) return;
    
    const { error } = await supabase
      .from('transaction')
      .update({ IS_SETTLED: true })
      .eq('TRANS_ID', transId);
      
    if (error) {
      alert('Failed to settle credit sale: ' + error.message);
      return;
    }
    
    fetchCreditSales();
  };

  const getStatusBadge = (dueDateStr) => {
    if (!dueDateStr) return <span className="badge badge-secondary">No Date</span>;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = new Date(dueDateStr);
    dueDate.setHours(0, 0, 0, 0);

    const diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return <span className="badge badge-destructive">Overdue by {Math.abs(diffDays)}d</span>;
    if (diffDays === 0) return <span className="badge badge-warning" style={{ background: '#f59e0b', color: '#fff' }}>Due Today</span>;
    if (diffDays <= 3) return <span className="badge badge-warning">Due in {diffDays}d</span>;
    return <span className="badge badge-success">Due in {diffDays}d</span>;
  };

  if (loading) {
    return <div className="glass" style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted-foreground)' }}>Loading active credit...</div>;
  }

  if (creditSales.length === 0) {
    return (
      <div className="glass" style={{ padding: '3rem', textAlign: 'center', color: 'var(--muted-foreground)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
        <CheckCircle size={48} style={{ color: '#10b981', opacity: 0.5 }} />
        <p style={{ margin: 0, fontSize: '1.125rem', fontWeight: 500 }}>No active credit sales. All debts are settled!</p>
      </div>
    );
  }

  return (
    <div className="glass table-wrapper">
      <table className="table">
        <thead>
          <tr>
            <th>Trans ID</th>
            <th>Customer</th>
            <th>Sale Date</th>
            <th>Due Date</th>
            <th>Status</th>
            <th>Amount Due</th>
            <th style={{ textAlign: 'right' }}>Action</th>
          </tr>
        </thead>
        <tbody>
          {creditSales.map(sale => {
            const amount = sale.ADJUSTED_TOTAL || sale.GRAND_TOTAL;
            const customerName = sale.credit_customer ? `${sale.credit_customer.FIRST_NAME} ${sale.credit_customer.LAST_NAME}` : 'Unknown';
            return (
              <tr key={sale.TRANS_ID}>
                <td>
                  <button 
                    className="badge badge-warning" 
                    style={{ border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.25rem 0.5rem', transition: 'transform 0.1s' }}
                    onClick={() => router.push(`/transactions?searchId=${sale.TRANS_ID}`)}
                    onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                    onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                    title="View Transaction Details"
                  >
                    TRX-{sale.TRANS_ID}
                    <ExternalLink size={12} />
                  </button>
                </td>
                <td style={{ fontWeight: 600 }}>{customerName}</td>
                <td className="text-muted">{new Date(sale.CREATED_AT).toLocaleDateString()}</td>
                <td style={{ fontWeight: 500 }}>{sale.CREDIT_DUE_DATE ? new Date(sale.CREDIT_DUE_DATE).toLocaleDateString() : 'N/A'}</td>
                <td>{getStatusBadge(sale.CREDIT_DUE_DATE)}</td>
                <td style={{ fontWeight: 800, color: 'var(--primary)', fontSize: '1.1rem' }}>Ksh {amount.toLocaleString()}</td>
                <td style={{ textAlign: 'right' }}>
                  <button 
                    className="btn btn-primary" 
                    style={{ padding: '0.5rem 1rem', background: '#10b981', color: '#fff', border: 'none', transition: 'transform 0.1s' }}
                    onClick={() => handleSettle(sale.TRANS_ID)}
                    onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                    onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                  >
                    Mark Settled
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
