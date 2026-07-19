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
  const [filterStatus, setFilterStatus] = useState('Active'); // Active, Reversed, All
  const [sortConfig, setSortConfig] = useState({ key: 'CREATED_AT', direction: 'desc' });
  
  // Print State
  const [printData, setPrintData] = useState(null);
  
  // Modal State
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  
  // Reversal State
  const [reversalModalOpen, setReversalModalOpen] = useState(false);
  const [reversalReason, setReversalReason] = useState('');
  const [reversing, setReversing] = useState(false);
  
  // Settlement State
  const [settleModalOpen, setSettleModalOpen] = useState(false);
  const [transactionToSettle, setTransactionToSettle] = useState(null);
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [cashAmount, setCashAmount] = useState('');
  const [mpesaAmount, setMpesaAmount] = useState('');
  const [mpesaReceipt, setMpesaReceipt] = useState('');
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;
  
  const { role, employeeId, branchId } = useAuth();

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
          transaction_details(*, product(NAME, BRAND, PRODUCT_CODE, MODEL))
        `)
        .order('TRANS_ID', { ascending: false });

      if (role === 'employee' && employeeId) {
        query = query.eq('EMPLOYEE_ID', employeeId);
      }
      
      if (branchId && branchId !== 'ALL') {
        query = query.eq('BRANCH_ID', branchId);
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
                  (t.SERIAL_NUMBER && t.SERIAL_NUMBER.toString().includes(sId)) ||
                  (t.TRANS_ID && formatTransId(t.SERIAL_NUMBER || t.TRANS_ID).toLowerCase().includes(sId));
    }
    
    if (searchDate) {
      const d = new Date(t.CREATED_AT);
      const tDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      matchesDate = tDate === searchDate;
    }

    let matchesStatus = true;
    if (filterStatus === 'Active') {
      matchesStatus = t.status !== 'Reversed';
    } else if (filterStatus === 'Reversed') {
      matchesStatus = t.status === 'Reversed';
    }

    return matchesId && matchesDate && matchesStatus;
  });

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
    setCurrentPage(1);
  };

  const sortedTransactions = [...filteredTransactions].sort((a, b) => {
    let valA, valB;
    if (sortConfig.key === 'customer') {
      valA = (a.customer || a.credit_customer) ? `${(a.customer || a.credit_customer).FIRST_NAME} ${(a.customer || a.credit_customer).LAST_NAME}` : (a.CREDIT_TERMS && a.CREDIT_TERMS.includes('|') ? a.CREDIT_TERMS.split('|')[1].trim() : 'Walk-in');
      valB = (b.customer || b.credit_customer) ? `${(b.customer || b.credit_customer).FIRST_NAME} ${(b.customer || b.credit_customer).LAST_NAME}` : (b.CREDIT_TERMS && b.CREDIT_TERMS.includes('|') ? b.CREDIT_TERMS.split('|')[1].trim() : 'Walk-in');
    } else if (sortConfig.key === 'total') {
      valA = a.ADJUSTED_TOTAL || a.GRAND_TOTAL || 0;
      valB = b.ADJUSTED_TOTAL || b.GRAND_TOTAL || 0;
    } else if (sortConfig.key === 'items') {
      valA = a.transaction_details?.reduce((acc, d) => acc + d.QTY, 0) || 0;
      valB = b.transaction_details?.reduce((acc, d) => acc + d.QTY, 0) || 0;
    } else if (sortConfig.key === 'CREATED_AT') {
      valA = new Date(a.CREATED_AT).getTime();
      valB = new Date(b.CREATED_AT).getTime();
    } else {
      valA = a[sortConfig.key];
      valB = b[sortConfig.key];
    }
    
    if (typeof valA === 'string') valA = valA.toLowerCase();
    if (typeof valB === 'string') valB = valB.toLowerCase();

    if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
    if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  // Pagination Logic
  useEffect(() => {
    setCurrentPage(1);
  }, [searchId, searchDate]);

  const totalPages = Math.ceil(sortedTransactions.length / itemsPerPage);
  const currentItems = sortedTransactions.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handlePrint = (trans) => {
    const cartItems = trans.transaction_details?.map(d => ({
      PRODUCT_ID: d.PRODUCT_ID,
      NAME: d.product?.NAME || 'Unknown Part',
      BRAND: d.product?.BRAND,
      MODEL: d.product?.MODEL,
      PRODUCT_CODE: d.product?.PRODUCT_CODE,
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
    setMpesaReceipt('');
    setSettleModalOpen(true);
  };

  const handleSettleSubmit = async (e) => {
    e.preventDefault();
    if (!transactionToSettle) return;

    const currentCash = transactionToSettle.CASH_AMOUNT || 0;
    const currentMpesa = transactionToSettle.MPESA_AMOUNT || 0;

    let payingCash = 0;
    let payingMpesa = 0;
    
    if (paymentMode === 'Cash') payingCash = Number(cashAmount) || 0;
    else if (paymentMode === 'M-Pesa') payingMpesa = Number(mpesaAmount) || 0;
    else if (paymentMode === 'Hybrid') {
      payingCash = Number(cashAmount) || 0;
      payingMpesa = Number(mpesaAmount) || 0;
    }

    const totalPayingNow = payingCash + payingMpesa;
    const totalAmount = transactionToSettle.ADJUSTED_TOTAL || transactionToSettle.GRAND_TOTAL;
    const amountDue = totalAmount - (currentCash + currentMpesa);

    if (totalPayingNow === 0) {
      alert('Please enter a payment amount.');
      return;
    }

    if (totalPayingNow > amountDue + 1) {
      alert(`Payment amount (Ksh ${totalPayingNow}) exceeds the amount due (Ksh ${amountDue}).`);
      return;
    }

    const isFullySettled = Math.abs(totalPayingNow - amountDue) <= 1;
    const newCash = currentCash + payingCash;
    const newMpesa = currentMpesa + payingMpesa;

    let determinedPaymentMethod = 'Hybrid';
    if (newCash > 0 && newMpesa === 0) determinedPaymentMethod = 'Cash';
    if (newMpesa > 0 && newCash === 0) determinedPaymentMethod = 'M-Pesa';

    const { error } = await supabase.from('transaction').update({
      PAYMENT_METHOD: determinedPaymentMethod,
      CASH_AMOUNT: newCash,
      MPESA_AMOUNT: newMpesa,
      HYBRID_PAYMENT: (newCash > 0 && newMpesa > 0),
      IS_SETTLED: isFullySettled,
      CASH_TENDERED: totalAmount,
      RECEIPT_NUMBER: ((paymentMode === 'M-Pesa' && payingMpesa > 0) || (paymentMode === 'Hybrid' && payingMpesa > 0)) ? mpesaReceipt : null
    }).eq('TRANS_ID', transactionToSettle.TRANS_ID);

    if (error) {
      alert('Error settling transaction: ' + error.message);
    } else {
      setSettleModalOpen(false);
      setTransactionToSettle(null);
      // Quickly update local state to avoid full refetch
      setTransactions(prev => prev.map(t => {
        if (t.TRANS_ID === transactionToSettle.TRANS_ID) {
          return { ...t, PAYMENT_METHOD: paymentMode, CASH_AMOUNT: finalCash, MPESA_AMOUNT: finalMpesa, HYBRID_PAYMENT: isHybrid, IS_SETTLED: true, CASH_TENDERED: totalDue, RECEIPT_NUMBER: (paymentMode === 'M-Pesa' || (paymentMode === 'Hybrid' && finalMpesa > 0)) ? mpesaReceipt : null };
        }
        return t;
      }));
    }
  };

  const handleReverse = async (e) => {
    e.preventDefault();
    if (!reversalReason.trim()) return alert("A reason is required to reverse a transaction.");
    
    setReversing(true);
    const { error } = await supabase.rpc('reverse_transaction', {
      p_trans_id: selectedTransaction.TRANS_ID,
      p_reason: reversalReason.trim(),
      p_user: employeeId || 'Admin' // Adjust based on your user tracking
    });

    if (error) {
      alert('Error reversing transaction: ' + error.message);
      setReversing(false);
      return;
    }

    // Update local state to mark as reversed
    setTransactions(prev => prev.map(t => t.TRANS_ID === selectedTransaction.TRANS_ID ? { ...t, status: 'Reversed', reversal_reason: reversalReason } : t));
    
    // Log action
    await supabase.from('system_logs').insert([{
      ACTION: 'Reversed Transaction',
      DETAILS: `Reversed TRX-${formatTransId(selectedTransaction.SERIAL_NUMBER || selectedTransaction.TRANS_ID)}. Reason: ${reversalReason}`,
      SEVERITY: 'warning',
      EMPLOYEE_ID: employeeId || null
    }]);

    setReversalModalOpen(false);
    setReversalReason('');
    setSelectedTransaction(null);
    setReversing(false);
    alert('Transaction successfully reversed and stock restored.');
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

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: '1 1 200px' }}>
          <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--muted-foreground)' }}>Sort by:</span>
          <select 
            className="input" 
            style={{ background: 'var(--card)', padding: '0.5rem 2rem 0.5rem 1rem', minWidth: '180px' }}
            value={`${sortConfig.key}-${sortConfig.direction}`}
            onChange={(e) => {
              const [key, direction] = e.target.value.split('-');
              setSortConfig({ key, direction });
              setCurrentPage(1);
            }}
          >
            <option value="CREATED_AT-desc">Date (Newest First)</option>
            <option value="CREATED_AT-asc">Date (Oldest First)</option>
            <option value="TRANS_ID-desc">Transaction ID (Highest)</option>
            <option value="TRANS_ID-asc">Transaction ID (Lowest)</option>
            <option value="total-desc">Amount (High to Low)</option>
            <option value="total-asc">Amount (Low to High)</option>
            <option value="customer-asc">Customer (A-Z)</option>
            <option value="customer-desc">Customer (Z-A)</option>
            <option value="items-desc">Items (Most)</option>
            <option value="items-asc">Items (Least)</option>
          </select>
        </div>

        {(searchId || searchDate || filterStatus !== 'Active') && (
          <button className="btn btn-secondary" onClick={() => { setSearchId(''); setSearchDate(''); setFilterStatus('Active'); }}>
            Clear Filters
          </button>
        )}

        <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem', background: 'var(--card)', padding: '0.25rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
          {['Active', 'Reversed', 'All'].map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: 'calc(var(--radius) - 2px)',
                background: filterStatus === s ? 'var(--primary)' : 'transparent',
                color: filterStatus === s ? 'white' : 'var(--muted-foreground)',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 500,
                fontSize: '0.875rem',
                transition: 'all 0.2s'
              }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="glass table-wrapper">
        <table className="table">
          <thead>
            <tr>
              <th onClick={() => handleSort('TRANS_ID')} style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}>Transaction ID {sortConfig.key === 'TRANS_ID' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
              <th onClick={() => handleSort('CREATED_AT')} style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}>Date & Time {sortConfig.key === 'CREATED_AT' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
              <th onClick={() => handleSort('customer')} style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}>Customer {sortConfig.key === 'customer' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
              <th onClick={() => handleSort('items')} style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}>Items {sortConfig.key === 'items' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
              <th onClick={() => handleSort('PAYMENT_METHOD')} style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}>Payment Info {sortConfig.key === 'PAYMENT_METHOD' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
              <th onClick={() => handleSort('total')} style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}>Total (Ksh) {sortConfig.key === 'total' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
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
                    <span className={`badge ${trans.status === 'Reversed' ? 'badge-secondary' : 'badge-warning'}`} style={{ opacity: trans.status === 'Reversed' ? 0.6 : 1, textDecoration: trans.status === 'Reversed' ? 'line-through' : 'none' }}>TRX-{formatTransId(trans.SERIAL_NUMBER || trans.TRANS_ID)}</span>
                    {trans.status === 'Reversed' && <span className="badge badge-destructive" style={{ marginLeft: '0.5rem', background: '#ef4444', color: 'white' }}>Reversed</span>}
                    {trans.IS_CREDIT && trans.status !== 'Reversed' && !trans.IS_SETTLED && <span className="badge badge-destructive" style={{ marginLeft: '0.5rem' }}>Credit</span>}
                    {trans.CREDIT_TERMS && trans.CREDIT_TERMS.startsWith('INV-') && trans.status !== 'Reversed' && !trans.IS_SETTLED && (
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
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', alignItems: 'center' }}>
                      <select 
                        className="input" 
                        style={{ 
                          padding: '0.4rem 2rem 0.4rem 1rem', 
                          fontSize: '0.85rem', 
                          fontWeight: 500,
                          height: 'auto', 
                          minWidth: '130px', 
                          background: 'var(--card)',
                          color: 'var(--foreground)',
                          border: '1px solid var(--border)',
                          borderRadius: 'calc(var(--radius) - 2px)',
                          cursor: 'pointer',
                          appearance: 'none',
                          backgroundImage: 'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23a1a1aa%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")',
                          backgroundRepeat: 'no-repeat',
                          backgroundPosition: 'right 0.7rem top 50%',
                          backgroundSize: '0.65rem auto',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                          transition: 'all 0.2s ease',
                          outline: 'none'
                        }}
                        onFocus={(e) => e.target.style.borderColor = 'var(--primary)'}
                        onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
                        onChange={(e) => {
                          const val = e.target.value;
                          e.target.value = ""; // Reset after action
                          if (val === 'print') handlePrint(trans);
                          if (val === 'settle') openSettleModal(trans);
                          if (val === 'reverse') {
                            setSelectedTransaction(trans);
                            setReversalModalOpen(true);
                          }
                        }}
                      >
                        <option value="">Actions...</option>
                        <option value="print">Print Receipt</option>
                        {(!trans.IS_SETTLED && trans.PAYMENT_METHOD === 'Pending Payment' && trans.status !== 'Reversed' && role !== 'employee') && (
                          <option value="settle">Settle Payment</option>
                        )}
                        {(trans.status !== 'Reversed' && role !== 'employee') && (
                          <option value="reverse">Reverse Transaction</option>
                        )}
                      </select>
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
                <div style={{ color: 'var(--muted-foreground)', fontSize: '0.875rem', marginBottom: '0.25rem' }}>Amount Due</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#10b981' }}>
                  Ksh { ((transactionToSettle.ADJUSTED_TOTAL || transactionToSettle.GRAND_TOTAL) - ((transactionToSettle.CASH_AMOUNT || 0) + (transactionToSettle.MPESA_AMOUNT || 0))).toLocaleString() }
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

              {paymentMode === 'M-Pesa' && (
                <div>
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: 'var(--muted-foreground)', marginBottom: '0.5rem' }}>Amount Paying</label>
                    <input type="number" className="input" value={mpesaAmount} onChange={e => setMpesaAmount(e.target.value)} required />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: 'var(--muted-foreground)', marginBottom: '0.5rem' }}>M-Pesa Transaction Code</label>
                    <input type="text" className="input" placeholder="e.g. QWE123RTYA" style={{ border: '2px solid #25D366' }} value={mpesaReceipt} onChange={(e) => setMpesaReceipt(e.target.value.toUpperCase())} minLength={10} maxLength={10} pattern="[A-Z0-9]{10}" title="M-Pesa code must be exactly 10 characters" />
                  </div>
                </div>
              )}
              
              {paymentMode === 'Cash' && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: 'var(--muted-foreground)', marginBottom: '0.5rem' }}>Amount Paying</label>
                  <input type="number" className="input" value={cashAmount} onChange={e => setCashAmount(e.target.value)} required />
                </div>
              )}

              {paymentMode === 'Hybrid' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
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
                  {Number(mpesaAmount) > 0 && (
                    <div>
                      <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: 'var(--muted-foreground)', marginBottom: '0.5rem' }}>M-Pesa Transaction Code</label>
                      <input type="text" className="input" placeholder="e.g. QWE123RTYA" style={{ border: '2px solid #25D366' }} value={mpesaReceipt} onChange={(e) => setMpesaReceipt(e.target.value.toUpperCase())} minLength={10} maxLength={10} pattern="[A-Z0-9]{10}" title="M-Pesa code must be exactly 10 characters" />
                    </div>
                  )}
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
                <div style={{ fontSize: '0.875rem', color: 'var(--muted-foreground)', marginTop: '0.25rem' }}>TRX-{formatTransId(selectedTransaction.SERIAL_NUMBER || selectedTransaction.TRANS_ID)}   {new Date(selectedTransaction.CREATED_AT).toLocaleString()}</div>
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
                      <td style={{ padding: '1rem 0', fontWeight: 500, whiteSpace: 'pre-line' }}>{formatItemName(detail.product)}</td>
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

              {selectedTransaction.status === 'Reversed' && (
                <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: 'var(--radius)' }}>
                  <h4 style={{ color: '#ef4444', margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <X size={16} /> Transaction Reversed
                  </h4>
                  <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--muted-foreground)' }}><strong>Reason:</strong> {selectedTransaction.reversal_reason}</p>
                </div>
              )}

              {/* Admin Actions */}
              {role !== 'employee' && selectedTransaction.status !== 'Reversed' && (
                <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
                  <button 
                    className="btn" 
                    style={{ background: '#ef4444', color: 'white', padding: '0.5rem 1rem' }}
                    onClick={() => setReversalModalOpen(true)}
                  >
                    Reverse Transaction
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

    {/* Reversal Confirmation Modal */}
      {reversalModalOpen && createPortal(
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999999, padding: '1rem' }}>
          <div className="glass" style={{ width: '100%', maxWidth: '400px', background: 'var(--background)' }}>
            <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border)' }}>
              <h3 className="heading-2" style={{ margin: 0, color: '#ef4444' }}>Confirm Reversal</h3>
            </div>
            <form onSubmit={handleReverse} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <p style={{ margin: 0, color: 'var(--muted-foreground)', fontSize: '0.875rem' }}>
                Are you sure you want to reverse this transaction? This action will permanently restore the stock to inventory and void the transaction record.
              </p>
              
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.5rem' }}>Reason for Reversal *</label>
                <textarea 
                  className="input" 
                  rows="3" 
                  placeholder="e.g. Customer returned items, entered by mistake..."
                  value={reversalReason}
                  onChange={e => setReversalReason(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => { setReversalModalOpen(false); setReversalReason(''); }}>Cancel</button>
                <button type="submit" className="btn" style={{ flex: 1, background: '#ef4444', color: 'white' }} disabled={reversing}>
                  {reversing ? 'Processing...' : 'Confirm Reversal'}
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

export default function TransactionsPage() {
  return (
    <Suspense fallback={<div style={{ padding: '2rem', textAlign: 'center' }}>Loading transactions...</div>}>
      <TransactionsContent />
    </Suspense>
  );
}
