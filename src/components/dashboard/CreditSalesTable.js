'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { AlertTriangle, CheckCircle, ExternalLink, X, DollarSign, RefreshCw, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import { logAction } from '@/lib/logger';
import { formatTransId } from '@/utils/formatters';
import { useAuth } from '@/components/AuthGuard';

export default function CreditSalesTable() {
  const router = useRouter();
  const [creditSales, setCreditSales] = useState([]);
  const [loading, setLoading] = useState(true);

  const { branchId } = useAuth();
  // Settlement Modal State
  const [settlingSale, setSettlingSale] = useState(null);
  const [settlementMode, setSettlementMode] = useState('Cash');
  const [cashAmount, setCashAmount] = useState('');
  const [mpesaAmount, setMpesaAmount] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const fetchCreditSales = async () => {
    setLoading(true);
    let query = supabase
      .from('transaction')
      .select(`
        TRANS_ID,
        SERIAL_NUMBER,
        CREATED_AT,
        ADJUSTED_TOTAL,
        GRAND_TOTAL,
        CREDIT_DUE_DATE,
        CREDIT_TERMS,
        IS_SETTLED,
        CASH_AMOUNT,
        MPESA_AMOUNT,
        credit_customer:customer!transaction_CREDIT_CUSTOMER_ID_fkey(FIRST_NAME, LAST_NAME)
      `)
      .eq('IS_CREDIT', true)
      .eq('IS_SETTLED', false)
      .order('CREDIT_DUE_DATE', { ascending: true });

    if (branchId && branchId !== 'ALL') {
      query = query.eq('BRANCH_ID', branchId);
    }

    const { data, error } = await query;

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
          details: `Transaction #TRX-${formatTransId(settlingSale.SERIAL_NUMBER || transId)} was returned. Items added back to stock and amounts zeroed out.`,
          severity: 'warning'
        });

      } else {
        // Partial or Full Settlement
        const currentCash = settlingSale.CASH_AMOUNT || 0;
        const currentMpesa = settlingSale.MPESA_AMOUNT || 0;
        
        const payingCash = parseFloat(cashAmount) || 0;
        const payingMpesa = parseFloat(mpesaAmount) || 0;
        
        const totalPayingNow = payingCash + payingMpesa;
        const amountDue = (settlingSale.ADJUSTED_TOTAL || settlingSale.GRAND_TOTAL) - (currentCash + currentMpesa);
        
        if (totalPayingNow === 0 && settlementMode !== 'Return') {
          throw new Error('Please enter a payment amount.');
        }
        
        if (totalPayingNow > amountDue + 1) { // 1 Ksh tolerance
          throw new Error(`Payment amount (Ksh ${totalPayingNow}) exceeds the amount due (Ksh ${amountDue}).`);
        }

        const isFullySettled = Math.abs(totalPayingNow - amountDue) <= 1;

        const newCash = currentCash + payingCash;
        const newMpesa = currentMpesa + payingMpesa;
        
        let determinedPaymentMethod = 'Hybrid';
        if (newCash > 0 && newMpesa === 0) determinedPaymentMethod = 'Cash';
        if (newMpesa > 0 && newCash === 0) determinedPaymentMethod = 'M-Pesa';

        const updateData = {
          IS_SETTLED: isFullySettled,
          PAYMENT_METHOD: determinedPaymentMethod,
          CASH_AMOUNT: newCash,
          MPESA_AMOUNT: newMpesa
        };

        const { error } = await supabase
          .from('transaction')
          .update(updateData)
          .eq('TRANS_ID', transId);

        if (error) throw error;
        
        await logAction({
          action: isFullySettled ? 'Settled Credit Sale' : 'Partial Credit Payment',
          details: `Transaction #TRX-${formatTransId(settlingSale.SERIAL_NUMBER || transId)} received Ksh ${totalPayingNow} via ${determinedPaymentMethod}. ${isFullySettled ? 'Fully Settled.' : 'Remaining due: Ksh ' + (amountDue - totalPayingNow)}`,
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
            const totalAmount = sale.ADJUSTED_TOTAL || sale.GRAND_TOTAL;
            const amountPaid = (sale.CASH_AMOUNT || 0) + (sale.MPESA_AMOUNT || 0);
            const amountDue = totalAmount - amountPaid;
            
            const customerName = sale.credit_customer ? `${sale.credit_customer.FIRST_NAME} ${sale.credit_customer.LAST_NAME}` : 'Unknown';
            return (
              <tr key={sale.TRANS_ID} className="table-row-interactive">
                <td>
                  <button 
                    className="badge badge-warning" 
                    style={{ border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.25rem 0.5rem', transition: 'transform 0.1s' }}
                    onClick={() => router.push(`/transactions?searchId=${sale.TRANS_ID}`)}
                    onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                    onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                    title="View Transaction Details"
                  >
                   <span className="font-medium">TRX-{formatTransId(sale.SERIAL_NUMBER || sale.TRANS_ID)}</span>
                    <ExternalLink size={12} />
                  </button>
                </td>
                <td style={{ fontWeight: 600 }}>{customerName}</td>
                <td className="text-muted">{new Date(sale.CREATED_AT).toLocaleDateString()}</td>
                <td style={{ fontWeight: 500 }}>{sale.CREDIT_DUE_DATE ? new Date(sale.CREDIT_DUE_DATE).toLocaleDateString() : 'N/A'}</td>
                <td>{getStatusBadge(sale.CREDIT_DUE_DATE)}</td>
                <td>
                  <div style={{ fontWeight: 800, color: 'var(--primary)', fontSize: '1.1rem' }}>Ksh {amountDue.toLocaleString()}</div>
                  {amountPaid > 0 && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>Paid: Ksh {amountPaid.toLocaleString()}</div>
                  )}
                </td>
                <td style={{ textAlign: 'right' }}>
                  <button 
                    className="btn btn-primary" 
                    style={{ padding: '0.5rem 1rem', background: '#10b981', color: '#fff', border: 'none', transition: 'transform 0.1s' }}
                    onClick={() => openSettlementModal(sale)}
                    onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                    onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                  >
                    {amountPaid > 0 ? 'Make Payment' : 'Mark Settled'}
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
              Transaction <strong>TRX-{formatTransId(settlingSale.SERIAL_NUMBER || settlingSale.TRANS_ID)}</strong>.
              Total invoice: Ksh {(settlingSale.ADJUSTED_TOTAL || settlingSale.GRAND_TOTAL).toLocaleString()}.<br/>
              Amount Due: 
              <span style={{ color: 'var(--primary)', fontWeight: 700, marginLeft: '0.25rem', fontSize: '1.1rem' }}>
                Ksh {((settlingSale.ADJUSTED_TOTAL || settlingSale.GRAND_TOTAL) - ((settlingSale.CASH_AMOUNT || 0) + (settlingSale.MPESA_AMOUNT || 0))).toLocaleString()}
              </span>
            </p>

            <form onSubmit={confirmSettlement} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.5rem', color: 'var(--foreground)' }}>Action / Payment Method</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  {['Cash', 'M-Pesa', 'Hybrid', 'Return'].map(mode => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => {
                        setSettlementMode(mode);
                        if (mode === 'Cash') {
                          setCashAmount(((settlingSale.ADJUSTED_TOTAL || settlingSale.GRAND_TOTAL) - ((settlingSale.CASH_AMOUNT || 0) + (settlingSale.MPESA_AMOUNT || 0))).toString());
                          setMpesaAmount('');
                        } else if (mode === 'M-Pesa') {
                          setMpesaAmount(((settlingSale.ADJUSTED_TOTAL || settlingSale.GRAND_TOTAL) - ((settlingSale.CASH_AMOUNT || 0) + (settlingSale.MPESA_AMOUNT || 0))).toString());
                          setCashAmount('');
                        } else {
                          setCashAmount('');
                          setMpesaAmount('');
                        }
                      }}
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

              {settlementMode !== 'Return' && (
                <div style={{ display: 'flex', gap: '1rem', background: 'rgba(0,0,0,0.02)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  <div style={{ flex: 1, opacity: settlementMode === 'M-Pesa' ? 0.5 : 1 }}>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.5rem' }}>Cash Paid</label>
                    <input type="number" className="input" value={cashAmount} onChange={e => setCashAmount(e.target.value)} min="0" step="0.01" disabled={settlementMode === 'M-Pesa'} placeholder="0" />
                  </div>
                  <div style={{ flex: 1, opacity: settlementMode === 'Cash' ? 0.5 : 1 }}>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.5rem' }}>M-Pesa Paid</label>
                    <input type="number" className="input" value={mpesaAmount} onChange={e => setMpesaAmount(e.target.value)} min="0" step="0.01" disabled={settlementMode === 'Cash'} placeholder="0" />
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
