'use client';

import { useEffect, useState, Suspense } from 'react';
import { supabase } from '@/lib/supabase';
import { Search, Printer, Calendar, X, Eye, CheckCircle } from 'lucide-react';
import Receipt from '@/components/Receipt';
import { formatTransId, formatItemName } from '@/utils/formatters';
import { useAuth } from '@/components/AuthGuard';
import { useSearchParams } from 'next/navigation';
import { createPortal } from 'react-dom';

function TransactionsContent() {
  const searchParams = useSearchParams();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [searchId, setSearchId] = useState(searchParams.get('searchId') || '');
  const [searchDate, setSearchDate] = useState('');
  
  // Print State
  const [printData, setPrintData] = useState(null);
  
  // Modal State
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  
  // Settlement State
  const [settleModalOpen, setSettleModalOpen] = useState(false);
  const [transactionToSettle, setTransactionToSettle] = useState(null);
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [cashAmount, setCashAmount] = useState('');
  const [mpesaAmount, setMpesaAmount] = useState('');
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;
  
  const { role, employeeId } = useAuth();

  // Auto-trigger print when printData is fully rendered
  useEffect(() => {
    if (printData) {
      const timer = setTimeout(() => {
        window.print();
      }, 200); // Wait for React DOM and CSS to apply
      return () => clearTimeout(timer);
    }
  }, [printData]);

  useEffect(() => {
    const fetchTransactions = async () => {
      let query = supabase
        .from('transaction')
        .select(`
          *,
          customer!transaction_CUST_ID_fkey(FIRST_NAME, LAST_NAME),
          credit_customer:customer!transaction_CREDIT_CUSTOMER_ID_fkey(FIRST_NAME, LAST_NAME),
          transaction_details(*, product(NAME))
        `)
        .order('TRANS_ID', { ascending: false });

      if (role === 'employee' && employeeId) {
        query = query.eq('EMPLOYEE_ID', employeeId);
      }
      
      const { data, error } = await query;

      if (error) {
        console.error('Transactions fetch error:', error);
      } else if (data) {
        setTransactions(data);
      }
      setLoading(false);
    };
    fetchTransactions();
  }, [role, employeeId]);

  const filteredTransactions = transactions.filter(t => {
    let matchesId = true;
    let matchesDate = true;

    if (searchId) {
      const sId = searchId.toLowerCase();
      matchesId = t.TRANS_ID?.toString().toLowerCase().includes(sId) || 
                  (t.TRANS_ID && formatTransId(t.TRANS_ID).toLowerCase().includes(sId));
    }
    
    if (searchDate) {
      const d = new Date(t.CREATED_AT);
      const tDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      matchesDate = tDate === searchDate;
    }

    return matchesId && matchesDate;
  });

  // Pagination Logic
  useEffect(() => {
    setCurrentPage(1);
  }, [searchId, searchDate]);

  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);
  const currentItems = filteredTransactions.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handlePrint = (trans) => {
    const cartItems = trans.transaction_details?.map(d => ({
      PRODUCT_ID: d.PRODUCT_ID,
      NAME: d.product?.NAME || 'Unknown Part',
      PRICE: d.UNIT_PRICE,
      quantity: d.QTY
    })) || [];

    setPrintData({
      transaction: trans,
      cart: cartItems,
      subtotal: trans.SUBTOTAL,
      vat: trans.TAX_AMOUNT,
      grandTotal: trans.GRAND_TOTAL
    });
  };

  const openSettleModal = (trans) => {
    setTransactionToSettle(trans);
    setPaymentMode('Cash');
    setCashAmount(trans.ADJUSTED_TOTAL || trans.GRAND_TOTAL);
    setMpesaAmount(0);
    setSettleModalOpen(true);
  };

  const handleSettleSubmit = async (e) => {
    e.preventDefault();
    if (!transactionToSettle) return;

    let finalCash = 0;
    let finalMpesa = 0;
    let isHybrid = false;

    const totalDue = transactionToSettle.ADJUSTED_TOTAL || transactionToSettle.GRAND_TOTAL;

    if (paymentMode === 'Cash') finalCash = totalDue;
    else if (paymentMode === 'M-Pesa') finalMpesa = totalDue;
    else if (paymentMode === 'Hybrid') {
      finalCash = Number(cashAmount);
      finalMpesa = Number(mpesaAmount);
      isHybrid = true;
      if (finalCash + finalMpesa !== totalDue) {
        alert(`Hybrid amounts (Ksh ${finalCash + finalMpesa}) must equal the total due (Ksh ${totalDue}).`);
        return;
      }
    }

    const { error } = await supabase.from('transaction').update({
      PAYMENT_METHOD: paymentMode,
      CASH_AMOUNT: finalCash,
      MPESA_AMOUNT: finalMpesa,
      HYBRID_PAYMENT: isHybrid,
      IS_SETTLED: true,
      CASH_TENDERED: totalDue
    }).eq('TRANS_ID', transactionToSettle.TRANS_ID);

    if (error) {
      alert('Error settling transaction: ' + error.message);
    } else {
      setSettleModalOpen(false);
      setTransactionToSettle(null);
      // Quickly update local state to avoid full refetch
      setTransactions(prev => prev.map(t => {
        if (t.TRANS_ID === transactionToSettle.TRANS_ID) {
          return { ...t, PAYMENT_METHOD: paymentMode, CASH_AMOUNT: finalCash, MPESA_AMOUNT: finalMpesa, HYBRID_PAYMENT: isHybrid, IS_SETTLED: true, CASH_TENDERED: totalDue };
        }
        return t;
      }));
    }
  };

  return (
    <div className="animate-fade-in">
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', marginBottom: '2rem' }}>
        
        {/* ID Filter */}
        <div style={{ position: 'relative', flex: '1 1 250px', maxWidth: '100%' }}>
          <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted-foreground)' }} />
          <input 
            type="text" 
            placeholder="Search Exact ID..." 
            className="input" 
            style={{ paddingLeft: '2.5rem' }}
            value={searchId}
            onChange={(e) => setSearchId(e.target.value)}
          />
        </div>

        {/* Date Filter */}
        <div style={{ position: 'relative', flex: '1 1 250px', maxWidth: '100%' }}>
          <Calendar size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted-foreground)' }} />
          <input 
            type="date" 
            className="input" 
            style={{ paddingLeft: '2.5rem' }}
            value={searchDate}
            onChange={(e) => setSearchDate(e.target.value)}
          />
        </div>

        {(searchId || searchDate) && (
          <button className="btn btn-secondary" onClick={() => { setSearchId(''); setSearchDate(''); }}>
            Clear Filters
          </button>
        )}
      </div>

      <div className="glass table-wrapper">
        <table className="table">
          <thead>
            <tr>
              <th>Transaction ID</th>
              <th>Date & Time</th>
              <th>Customer</th>
              <th>Items</th>
              <th>Payment Info</th>
              <th>Total (Ksh)</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', padding: '2rem' }}>Loading transactions...</td>
              </tr>
            ) : currentItems.length === 0 ? (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', padding: '2rem' }}>No transactions match the filters.</td>
              </tr>
            ) : (
              currentItems.map((trans) => (
                <tr key={trans.TRANS_ID}>
                  <td>
                    <span className="badge badge-warning">TRX-{formatTransId(trans.TRANS_ID)}</span>
                    {trans.IS_CREDIT && <span className="badge badge-destructive" style={{ marginLeft: '0.5rem' }}>Credit</span>}
                    {trans.CREDIT_TERMS && trans.CREDIT_TERMS.startsWith('INV-') && (
                      <span className="badge badge-primary" style={{ marginLeft: '0.5rem', background: 'var(--primary)', color: 'white' }}>{trans.CREDIT_TERMS.split('|')[0].trim()}</span>
                    )}
                  </td>
                  <td className="text-muted">
                    {new Date(trans.CREATED_AT).toLocaleDateString()} <br/>
                    <small>{new Date(trans.CREATED_AT).toLocaleTimeString()}</small>
                  </td>
                  <td>
                    {(trans.customer || trans.credit_customer) ? 
                      `${(trans.customer || trans.credit_customer).FIRST_NAME} ${(trans.customer || trans.credit_customer).LAST_NAME}` : 
                      (trans.CREDIT_TERMS && trans.CREDIT_TERMS.startsWith('INV-') && trans.CREDIT_TERMS.includes('|') ? 
                        trans.CREDIT_TERMS.split('|')[1].trim() : 
                        'Walk-in')
                    }
                  </td>
                  <td>
                    <button 
                      className="badge badge-success"
                      style={{ border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', transition: 'transform 0.1s' }}
                      onClick={() => setSelectedTransaction(trans)}
                      onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                      onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                      title="View Items"
                    >
                      {trans.transaction_details?.reduce((acc, d) => acc + d.QTY, 0) || 0} items
                      <Eye size={12} />
                    </button>
                  </td>
                  <td className="text-muted">
                    {trans.PAYMENT_METHOD}
                    {trans.HYBRID_PAYMENT && <div style={{ fontSize: '0.75rem' }}>Cash: {trans.CASH_AMOUNT} | M-Pesa: {trans.MPESA_AMOUNT}</div>}
                  </td>
                  <td style={{ fontWeight: 600, color: 'var(--primary)' }}>
                    Ksh {trans.ADJUSTED_TOTAL ? trans.ADJUSTED_TOTAL.toLocaleString() : trans.GRAND_TOTAL?.toLocaleString()}
                    {Number(trans.DISCOUNT_AMOUNT) !== 0 && (
                      <div style={{ fontSize: '0.75rem', color: Number(trans.DISCOUNT_AMOUNT) > 0 ? '#10b981' : '#ef4444', fontWeight: 'normal' }}>
                        {Number(trans.DISCOUNT_AMOUNT) > 0 ? 'Discounted' : 'Surcharged'}
                      </div>
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                      {(!trans.IS_SETTLED && trans.PAYMENT_METHOD === 'Pending Payment') && role !== 'employee' && (
                        <button className="btn btn-primary" style={{ padding: '0.5rem', background: '#10b981' }} title="Settle Payment" onClick={() => openSettleModal(trans)}>
                          <Printer size={16} style={{ display: 'none' }} /> {/* Just for spacing consistency if needed, actually use Check icon */}
                          <CheckCircle size={16} /> Settle
                        </button>
                      )}
                      <button className="btn btn-secondary" style={{ padding: '0.5rem' }} title="Print Invoice" onClick={() => handlePrint(trans)}>
                        <Printer size={16} /> Print
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.5rem', borderTop: '1px solid var(--border)' }}>
            <button 
              className="btn btn-secondary" 
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              Previous
            </button>
            <span className="text-muted" style={{ fontWeight: 500, fontSize: '0.875rem' }}>
              Page {currentPage} of {totalPages}
            </span>
            <button 
              className="btn btn-secondary" 
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Settlement Modal */}
      {settleModalOpen && transactionToSettle && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '1rem' }}>
          <div className="glass" style={{ width: '100%', maxWidth: '400px', background: 'var(--background)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.5rem', borderBottom: '1px solid var(--border)' }}>
              <h3 className="heading-2" style={{ margin: 0 }}>Settle Transaction</h3>
              <button onClick={() => setSettleModalOpen(false)}><X size={20} className="text-muted" /></button>
            </div>
            
            <form onSubmit={handleSettleSubmit} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{ textAlign: 'center', padding: '1rem', background: 'rgba(16, 185, 129, 0.1)', borderRadius: 'var(--radius)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                <div style={{ color: 'var(--muted-foreground)', fontSize: '0.875rem', marginBottom: '0.25rem' }}>Total Amount Due</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#10b981' }}>
                  Ksh { (transactionToSettle.ADJUSTED_TOTAL || transactionToSettle.GRAND_TOTAL).toLocaleString() }
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: 'var(--muted-foreground)', marginBottom: '0.5rem' }}>Payment Mode</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
                  {['Cash', 'M-Pesa', 'Hybrid'].map(mode => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setPaymentMode(mode)}
                      style={{
                        padding: '0.5rem',
                        borderRadius: 'var(--radius)',
                        border: `1px solid ${paymentMode === mode ? 'var(--primary)' : 'var(--border)'}`,
                        background: paymentMode === mode ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                        color: paymentMode === mode ? 'var(--primary)' : 'var(--foreground)',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        fontWeight: 500
                      }}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              {paymentMode === 'Hybrid' && (
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.25rem', color: 'var(--muted-foreground)' }}>Cash Amount</label>
                    <input type="number" className="input" min="0" value={cashAmount} onChange={e => setCashAmount(e.target.value)} required />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.25rem', color: 'var(--muted-foreground)' }}>M-Pesa Amount</label>
                    <input type="number" className="input" min="0" value={mpesaAmount} onChange={e => setMpesaAmount(e.target.value)} required />
                  </div>
                </div>
              )}

              <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '0.75rem', marginTop: '0.5rem' }}>
                Confirm Payment
              </button>
            </form>
          </div>
        </div>
      )}

    {printData && (
        <Receipt 
          transaction={printData.transaction} 
          cart={printData.cart} 
          subtotal={printData.subtotal} 
          vat={printData.vat} 
          grandTotal={printData.transaction.ADJUSTED_TOTAL || printData.grandTotal} 
        />
      )}

      {/* Transaction Details Modal */}
      {selectedTransaction && createPortal(
        <div 
          onClick={() => setSelectedTransaction(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, padding: '2rem' }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="glass" 
            style={{ width: '100%', maxWidth: '600px', maxHeight: '80vh', display: 'flex', flexDirection: 'column', background: 'var(--background)' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.5rem', borderBottom: '1px solid var(--border)' }}>
              <div>
                <h3 className="heading-2" style={{ margin: 0 }}>Transaction Details</h3>
                <div style={{ fontSize: '0.875rem', color: 'var(--muted-foreground)', marginTop: '0.25rem' }}>TRX-{formatTransId(selectedTransaction.TRANS_ID)}   {new Date(selectedTransaction.CREATED_AT).toLocaleString()}</div>
              </div>
              <button onClick={() => setSelectedTransaction(null)} style={{ background: 'transparent', border: 'none', color: 'var(--muted-foreground)', cursor: 'pointer', display: 'flex' }}><X size={20} /></button>
            </div>
            
            <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1 }}>
              <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                    <th style={{ paddingBottom: '0.75rem', color: 'var(--muted-foreground)', fontWeight: 500 }}>Item Name</th>
                    <th style={{ paddingBottom: '0.75rem', color: 'var(--muted-foreground)', fontWeight: 500, textAlign: 'center' }}>Qty</th>
                    <th style={{ paddingBottom: '0.75rem', color: 'var(--muted-foreground)', fontWeight: 500, textAlign: 'right' }}>Unit Price</th>
                    <th style={{ paddingBottom: '0.75rem', color: 'var(--muted-foreground)', fontWeight: 500, textAlign: 'right' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedTransaction.transaction_details?.map((detail, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '1rem 0', fontWeight: 500 }}>{formatItemName(detail.product)}</td>
                      <td style={{ padding: '1rem 0', textAlign: 'center' }}>{detail.QTY}</td>
                      <td style={{ padding: '1rem 0', textAlign: 'right' }}>Ksh {Number(detail.UNIT_PRICE).toLocaleString()}</td>
                      <td style={{ padding: '1rem 0', textAlign: 'right', fontWeight: 600 }}>Ksh {(Number(detail.QTY) * Number(detail.UNIT_PRICE)).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', width: '250px', color: 'var(--muted-foreground)' }}>
                  <span>Subtotal:</span>
                  <span>Ksh {Number(selectedTransaction.SUBTOTAL).toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', width: '250px', color: 'var(--muted-foreground)' }}>
                  <span>VAT ({selectedTransaction.TAX_RATE}%):</span>
                  <span>Ksh {Number(selectedTransaction.TAX_AMOUNT).toLocaleString()}</span>
                </div>
                {Number(selectedTransaction.DISCOUNT_AMOUNT) !== 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', width: '250px', color: Number(selectedTransaction.DISCOUNT_AMOUNT) > 0 ? '#10b981' : '#ef4444' }}>
                    <span>{Number(selectedTransaction.DISCOUNT_AMOUNT) > 0 ? 'Discount:' : 'Surcharge:'}</span>
                    <span>Ksh {Math.abs(Number(selectedTransaction.DISCOUNT_AMOUNT)).toLocaleString()}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', width: '250px', fontSize: '1.25rem', fontWeight: 700, color: 'var(--primary)', marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border)' }}>
                  <span>Total:</span>
                  <span>Ksh {(selectedTransaction.ADJUSTED_TOTAL || selectedTransaction.GRAND_TOTAL).toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
}

export default function TransactionsPage() {
  return (
    <Suspense fallback={<div style={{ padding: '2rem', textAlign: 'center' }}>Loading transactions...</div>}>
      <TransactionsContent />
    </Suspense>
  );
}
