'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { AlertTriangle, CheckCircle, ExternalLink, X, DollarSign, RefreshCw, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import { logAction } from '@/lib/logger';

export default function CreditSalesTable() {
  const router = useRouter();
  const [creditSales, setCreditSales] = useState([]);
  const [loading, setLoading] = useState(true);

  // Settlement Modal State
  const [settlingSale, setSettlingSale] = useState(null);
  const [settlementMode, setSettlementMode] = useState('Cash');
  const [cashAmount, setCashAmount] = useState('');
  const [mpesaAmount, setMpesaAmount] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

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

  const openSettlementModal = (sale) => {
    setSettlingSale(sale);
    setSettlementMode('Cash');
    setCashAmount('');
    setMpesaAmount('');
  };

  const confirmSettlement = async (e) => {
    e.preventDefault();
    if (!settlingSale) return;
    setIsProcessing(true);

    try {
      const transId = settlingSale.TRANS_ID;

      if (settlementMode === 'Return') {
        // 1. Fetch transaction details to restore stock
        const { data: details, error: detailsError } = await supabase
          .from('transaction_details')
          .select('PRODUCT_ID, QTY')
          .eq('TRANS_ID', transId);

        if (detailsError) throw detailsError;

        // 2. Restore stock for each item
        if (details && details.length > 0) {
          for (const item of details) {
            // First fetch current ON_HAND
            const { data: product } = await supabase
              .from('product')
              .select('ON_HAND')
              .eq('PRODUCT_ID', item.PRODUCT_ID)
              .single();

            if (product) {
              const newQty = (product.ON_HAND || 0) + item.QTY;
              await supabase
                .from('product')
                .update({ ON_HAND: newQty })
                .eq('PRODUCT_ID', item.PRODUCT_ID);
            }
          }
        }

        // 3. Mark transaction as returned and zero out totals so it doesn't affect profit
        const { error } = await supabase
          .from('transaction')
          .update({ 
            IS_SETTLED: true, 
            PAYMENT_METHOD: 'Returned',
            ADJUSTED_TOTAL: 0,
            GRAND_TOTAL: 0,
            CASH_AMOUNT: 0,
            MPESA_AMOUNT: 0
          })
          .eq('TRANS_ID', transId);

        if (error) throw error;
        
        await logAction({
          action: 'Returned Credit Sale',
          details: `Transaction #TRX-${transId} was returned. Items added back to stock and amounts zeroed out.`,
          severity: 'warning'
        });

      } else {
        // Normal settlement (Cash, M-Pesa, Hybrid)
        let updateData = {
          IS_SETTLED: true,
          PAYMENT_METHOD: settlementMode
        };

        if (settlementMode === 'Hybrid') {
          updateData.CASH_AMOUNT = parseFloat(cashAmount) || 0;
          updateData.MPESA_AMOUNT = parseFloat(mpesaAmount) || 0;
          
          // Verify hybrid totals match
          const totalPaid = updateData.CASH_AMOUNT + updateData.MPESA_AMOUNT;
          const due = settlingSale.ADJUSTED_TOTAL || settlingSale.GRAND_TOTAL;
          if (Math.abs(totalPaid - due) > 1) { // 1 Ksh tolerance
            throw new Error(`Hybrid payment total (Ksh ${totalPaid}) must equal the amount due (Ksh ${due})`);
          }
        }

        const { error } = await supabase
          .from('transaction')
          .update(updateData)
          .eq('TRANS_ID', transId);

        if (error) throw error;
        
        await logAction({
          action: 'Settled Credit Sale',
          details: `Transaction #TRX-${transId} was settled via ${settlementMode}.`,
          severity: 'info'
        });
      }

      setSettlingSale(null);
      fetchCreditSales();

    } catch (err) {
      alert('Failed to settle credit sale: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
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
                    onClick={() => openSettlementModal(sale)}
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

      {/* Settlement Modal */}
      {settlingSale && createPortal(
        <div 
          onClick={() => setSettlingSale(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, padding: '2rem' }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="glass animate-fade-in" 
            style={{ width: '100%', maxWidth: '450px', background: 'var(--background)', padding: '2rem', borderRadius: '16px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 className="heading-2" style={{ margin: 0, fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <DollarSign size={20} color="#10b981" /> 
                Settle Credit
              </h3>
              <button onClick={() => setSettlingSale(null)} style={{ color: 'var(--muted-foreground)', cursor: 'pointer', background: 'transparent', border: 'none' }}>
                <X size={20} />
              </button>
            </div>

            <p style={{ color: 'var(--muted-foreground)', fontSize: '0.95rem', marginBottom: '1.5rem' }}>
              You are about to clear the debt for <strong>TRX-{settlingSale.TRANS_ID}</strong> amounting to 
              <span style={{ color: 'var(--primary)', fontWeight: 700, marginLeft: '0.25rem' }}>
                Ksh {(settlingSale.ADJUSTED_TOTAL || settlingSale.GRAND_TOTAL).toLocaleString()}
              </span>.
            </p>

            <form onSubmit={confirmSettlement} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.5rem', color: 'var(--foreground)' }}>Mode of Resolution</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  {['Cash', 'M-Pesa', 'Hybrid', 'Return'].map(mode => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setSettlementMode(mode)}
                      style={{
                        padding: '0.75rem',
                        borderRadius: '8px',
                        border: `1px solid ${settlementMode === mode ? (mode === 'Return' ? '#ef4444' : 'var(--primary)') : 'var(--border)'}`,
                        background: settlementMode === mode ? (mode === 'Return' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(59, 130, 246, 0.1)') : 'transparent',
                        color: settlementMode === mode ? (mode === 'Return' ? '#ef4444' : 'var(--primary)') : 'var(--muted-foreground)',
                        fontWeight: settlementMode === mode ? 600 : 400,
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              {settlementMode === 'Hybrid' && (
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.5rem' }}>Cash (Ksh)</label>
                    <input type="number" className="input" value={cashAmount} onChange={e => setCashAmount(e.target.value)} required min="0" step="0.01" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.5rem' }}>M-Pesa (Ksh)</label>
                    <input type="number" className="input" value={mpesaAmount} onChange={e => setMpesaAmount(e.target.value)} required min="0" step="0.01" />
                  </div>
                </div>
              )}

              {settlementMode === 'Return' && (
                <div style={{ padding: '1rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '8px', color: '#ef4444', fontSize: '0.875rem', display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                  <RefreshCw size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <strong>Warning: Return Action</strong><br/>
                    This will mark the transaction as returned. The financial totals will be zeroed out, and <b>all stock quantities will be automatically returned to your inventory.</b>
                  </div>
                </div>
              )}

              <div style={{ marginTop: '0.5rem', display: 'flex', gap: '1rem' }}>
                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setSettlingSale(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1, background: settlementMode === 'Return' ? '#ef4444' : '#10b981' }} disabled={isProcessing}>
                  {isProcessing ? <Loader2 size={18} className="animate-spin" /> : 'Confirm'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
}
