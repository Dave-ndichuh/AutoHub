'use client';

import { useEffect, useState, Suspense } from 'react';
import { supabase } from '@/lib/supabase';
import { Search, Printer, Calendar, X, Eye } from 'lucide-react';
import Receipt from '@/components/Receipt';
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
      matchesId = t.TRANS_ID?.toString() === searchId || t.TRANS_ID?.toString().includes(searchId);
    }
    
    if (searchDate) {
      const d = new Date(t.CREATED_AT);
      const tDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      matchesDate = tDate === searchDate;
    }

    return matchesId && matchesDate;
  });

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
            ) : filteredTransactions.length === 0 ? (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', padding: '2rem' }}>No transactions match the filters.</td>
              </tr>
            ) : (
              filteredTransactions.map((trans) => (
                <tr key={trans.TRANS_ID}>
                  <td>
                    <span className="badge badge-warning">TRX-{trans.TRANS_ID}</span>
                    {trans.IS_CREDIT && <span className="badge badge-destructive" style={{ marginLeft: '0.5rem' }}>Credit</span>}
                  </td>
                  <td className="text-muted">
                    {new Date(trans.CREATED_AT).toLocaleDateString()} <br/>
                    <small>{new Date(trans.CREATED_AT).toLocaleTimeString()}</small>
                  </td>
                  <td>
                    {(trans.customer || trans.credit_customer) ? `${(trans.customer || trans.credit_customer).FIRST_NAME} ${(trans.customer || trans.credit_customer).LAST_NAME}` : 'Walk-in'}
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
                  <td style={{ textAlign: 'right' }}>
                    <button className="btn btn-secondary" style={{ padding: '0.5rem' }} title="Print Invoice" onClick={() => handlePrint(trans)}>
                      <Printer size={16} /> Print
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

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
                <div style={{ fontSize: '0.875rem', color: 'var(--muted-foreground)', marginTop: '0.25rem' }}>TRX-{selectedTransaction.TRANS_ID} • {new Date(selectedTransaction.CREATED_AT).toLocaleString()}</div>
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
                      <td style={{ padding: '1rem 0', fontWeight: 500 }}>{detail.product?.NAME || 'Unknown Part'}</td>
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
