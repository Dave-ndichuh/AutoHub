'use client';

import { useEffect, useState, use } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/AuthGuard';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CreditCard, Printer, Plus, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import StatementPrint from '@/components/StatementPrint';
import { formatTransId } from '@/utils/formatters';

export default function CustomerLedgerPage({ params }) {
  const unwrappedParams = use(params);
  const customerId = unwrappedParams.customer_id;
  
  const [account, setAccount] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const { employeeId, branchId } = useAuth();
  const router = useRouter();

  // Modal state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('M-Pesa');
  const [paymentRef, setPaymentRef] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [processing, setProcessing] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [selectedSaleItems, setSelectedSaleItems] = useState(null);

  useEffect(() => {
    if (isPrinting) {
      const timer = setTimeout(() => {
        window.print();
        setIsPrinting(false);
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [isPrinting]);

  useEffect(() => {
    fetchLedger();
  }, [customerId]);

  const fetchLedger = async () => {
    try {
      setLoading(true);
      // Fetch account + customer
      const { data: accData, error: accErr } = await supabase
        .from('credit_accounts')
        .select(`
          *,
          customer:customer_id (*)
        `)
        .eq('customer_id', customerId)
        .single();

      if (accErr) throw accErr;
      setAccount(accData);

      // Fetch transactions (sales & payments combined)
      // Sales are in `transaction` table, Payments are in `credit_transactions` table.
      // We will fetch both and merge them, sorting by date.
      
      const { data: creditTrans, error: ctErr } = await supabase
        .from('credit_transactions')
        .select(`
          id, type, amount, date, reference_type, reference_id, notes,
          allocations:credit_allocations(sale_id, allocated_amount)
        `)
        .eq('account_id', accData.id);
        
      if (ctErr) throw ctErr;

      // We only want credit sales from `transaction`
      const { data: salesTrans, error: stErr } = await supabase
        .from('transaction')
        .select(`
          TRANS_ID, SERIAL_NUMBER, CREATED_AT, ADJUSTED_TOTAL, GRAND_TOTAL, RECEIPT_NUMBER, IS_SETTLED, CASH_AMOUNT, MPESA_AMOUNT, status,
          transaction_details (
            QTY, UNIT_PRICE, product (NAME, BRAND, MODEL)
          )
        `)
        .eq('CREDIT_CUSTOMER_ID', customerId)
        .eq('IS_CREDIT', true);
        
      if (stErr) throw stErr;

      // Format them into a unified ledger timeline
      const unifiedLedger = [];

      creditTrans.forEach(ct => {
        unifiedLedger.push({
          id: ct.id,
          date: new Date(ct.date).getTime(),
          dateStr: ct.date,
          description: ct.type === 'b/f' ? 'Balance Brought Forward' : `Payment - ${ct.notes}`,
          debit: ct.type === 'b/f' ? ct.amount : null, // Assuming B/F is a debt. If it's just a starting balance, depends on sign. Let's treat B/F as debit (adding debt).
          credit: ct.type === 'credit' ? ct.amount : null,
          allocations: ct.allocations
        });
      });

      salesTrans.forEach(st => {
        const total = Number(st.ADJUSTED_TOTAL || st.GRAND_TOTAL);
        const paid = Number(st.CASH_AMOUNT || 0) + Number(st.MPESA_AMOUNT || 0);
        unifiedLedger.push({
          id: st.TRANS_ID,
          date: new Date(st.CREATED_AT).getTime(),
          dateStr: st.CREATED_AT,
          description: `Credit Sale TRX-${formatTransId(st.SERIAL_NUMBER || st.TRANS_ID)}`,
          debit: total, // Adding to debt
          credit: null,
          settled: st.IS_SETTLED,
          paid: paid,
          status: st.status,
          items: st.transaction_details
        });
      });

      // Sort by date ascending
      unifiedLedger.sort((a, b) => a.date - b.date);

      // Calculate running balance
      let runningBalance = 0;
      unifiedLedger.forEach(entry => {
        if (entry.debit) runningBalance += Number(entry.debit);
        if (entry.credit) runningBalance -= Number(entry.credit);
        entry.balance = runningBalance;
      });

      // Reverse to show newest first
      setTransactions(unifiedLedger.reverse());

    } catch (err) {
      console.error('Error fetching ledger:', err);
      alert('Failed to load customer ledger.');
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = async (e) => {
    e.preventDefault();
    if (!paymentAmount || isNaN(paymentAmount) || paymentAmount <= 0) {
      alert('Please enter a valid amount.');
      return;
    }
    
    setProcessing(true);
    try {
      const res = await fetch('/api/credits/payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: customerId,
          amount: parseFloat(paymentAmount),
          payment_method: paymentMethod,
          reference_no: paymentRef,
          notes: paymentNotes,
          employee_id: employeeId
        })
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      alert(`Payment of Ksh. ${paymentAmount} recorded successfully!`);
      setShowPaymentModal(false);
      setPaymentAmount('');
      setPaymentRef('');
      setPaymentNotes('');
      fetchLedger(); // Refresh
      
    } catch (err) {
      alert('Payment failed: ' + err.message);
    } finally {
      setProcessing(false);
    }
  };

  if (loading) return <div style={{ padding: '2rem' }}>Loading Ledger...</div>;
  if (!account) return <div style={{ padding: '2rem' }}>Account not found.</div>;

  const available = account.credit_limit - account.current_balance;

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', flexShrink: 0 }}>
        <button className="btn btn-secondary" onClick={() => router.push('/credits')} style={{ padding: '0.5rem' }}>
          <ArrowLeft size={18} />
        </button>
        <h1 className="heading-1" style={{ margin: 0 }}>
          {account.customer?.FIRST_NAME} {account.customer?.LAST_NAME}'s Ledger
        </h1>
      </div>

      {/* KPI Cards */}
      <div className="grid-cards" style={{ marginBottom: '1.5rem', flexShrink: 0, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        <div className="glass" style={{ padding: '1.25rem', borderLeft: '4px solid var(--muted)' }}>
          <p className="text-muted" style={{ fontWeight: 600 }}>Credit Limit</p>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 700 }}>Ksh. {Number(account.credit_limit).toLocaleString()}</h2>
        </div>
        <div className="glass" style={{ padding: '1.5rem', borderLeft: '4px solid var(--destructive)' }}>
          <p className="text-muted" style={{ fontWeight: 600 }}>Current Debt</p>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--destructive)' }}>Ksh. {Number(account.current_balance).toLocaleString()}</h2>
        </div>
        <div className="glass" style={{ padding: '1.5rem', borderLeft: '4px solid var(--primary)' }}>
          <p className="text-muted" style={{ fontWeight: 600 }}>Available Credit</p>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--primary)' }}>Ksh. {Math.max(0, available).toLocaleString()}</h2>
        </div>
      </div>

      {/* Action Bar */}
      <div className="glass" style={{ padding: '1rem', marginBottom: '1.5rem', display: 'flex', gap: '1rem', flexShrink: 0 }}>
        <button className="btn btn-primary" onClick={() => setShowPaymentModal(true)}>
          <CreditCard size={18} /> Record Payment
        </button>
        <button className="btn btn-secondary" onClick={() => router.push('/pos')}>
          <Plus size={18} /> New Credit Sale
        </button>
        <button className="btn btn-secondary" onClick={() => setIsPrinting(true)}>
          <Printer size={18} /> Print Statement
        </button>
      </div>

      {/* Ledger Table */}
      <div className="table-wrapper glass" style={{ flex: 1, overflowY: 'auto', border: '1px solid var(--border)', minHeight: 0 }}>
        <table className="table" style={{ margin: 0 }}>
          <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
            <tr>
              <th style={{ background: 'var(--background)' }}>Date</th>
              <th style={{ background: 'var(--background)' }}>Description</th>
              <th style={{ background: 'var(--background)' }}>Status</th>
              <th style={{ textAlign: 'right', background: 'var(--background)' }}>Debit (Increase)</th>
              <th style={{ textAlign: 'right', background: 'var(--background)' }}>Credit (Payment)</th>
              <th style={{ textAlign: 'right', background: 'var(--background)' }}>Balance</th>
            </tr>
          </thead>
          <tbody>
            {transactions.length === 0 ? (
              <tr><td colSpan="5" style={{ textAlign: 'center', padding: '2rem' }}>No transactions found.</td></tr>
            ) : (
              transactions.map((tr, index) => (
                <tr key={`${tr.id}-${index}`}>
                  <td>{new Date(tr.dateStr).toLocaleDateString()} {new Date(tr.dateStr).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</td>
                  <td>
                    <div style={{ fontWeight: 500 }}>
                      {tr.description.startsWith('Credit Sale') ? (
                        <button 
                          style={{ background: 'none', border: 'none', padding: 0, color: 'var(--primary)', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline', fontSize: 'inherit' }}
                          onClick={() => setSelectedSaleItems(tr)}
                        >
                          {tr.description}
                        </button>
                      ) : (
                        tr.description
                      )}
                    </div>
                    {tr.debit && (
                      <div style={{ fontSize: '0.8rem', color: tr.settled ? 'var(--primary)' : 'var(--destructive)' }}>
                        {tr.settled ? 'Settled' : `Pending (Paid: Ksh ${tr.paid?.toLocaleString() || 0})`}
                      </div>
                    )}
                    {tr.allocations?.length > 0 && (
                      <div style={{ fontSize: '0.8rem', color: 'var(--muted-foreground)', marginTop: '0.25rem' }}>
                        Allocated to {tr.allocations.length} invoice(s)
                      </div>
                    )}
                  </td>
                  <td>
                    {tr.status === 'Reversed' ? (
                      <span className="badge badge-destructive" style={{ fontSize: '0.75rem' }}>Reversed</span>
                    ) : tr.debit ? (
                      <span className="badge badge-warning" style={{ fontSize: '0.75rem' }}>Debt</span>
                    ) : (
                      <span className="badge badge-success" style={{ fontSize: '0.75rem' }}>Payment</span>
                    )}
                  </td>
                  <td style={{ textAlign: 'right', color: 'var(--destructive)', fontWeight: 600, textDecoration: tr.status === 'Reversed' ? 'line-through' : 'none' }}>
                    {tr.debit ? `Ksh. ${Number(tr.debit).toLocaleString()}` : '-'}
                  </td>
                  <td style={{ textAlign: 'right', color: 'var(--primary)', fontWeight: 600 }}>
                    {tr.credit ? `Ksh. ${Number(tr.credit).toLocaleString()}` : '-'}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 700 }}>
                    Ksh. {tr.balance.toLocaleString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Payment Modal */}
      <AnimatePresence>
        {showPaymentModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed', inset: 0, zIndex: 100,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)'
            }}
            onClick={() => setShowPaymentModal(false)}
          >
            <motion.div 
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="glass"
              style={{
                background: 'var(--background)',
                padding: '2rem', width: '100%', maxWidth: '450px',
                borderRadius: '16px', border: '1px solid var(--border)'
              }}
              onClick={e => e.stopPropagation()}
            >
              <h2 className="heading-2" style={{ marginBottom: '1.5rem' }}>Record Payment</h2>
              
              <form onSubmit={handlePayment} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label className="text-muted" style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>Amount (Ksh)</label>
                  <input 
                    type="number" 
                    required 
                    min="1"
                    max={account.current_balance}
                    step="0.01"
                    className="input" 
                    value={paymentAmount}
                    onChange={e => setPaymentAmount(e.target.value)}
                    autoFocus
                  />
                  <p style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', marginTop: '0.25rem' }}>
                    Max: Ksh. {Number(account.current_balance).toLocaleString()}
                  </p>
                </div>

                <div>
                  <label className="text-muted" style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>Payment Method</label>
                  <select className="input" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
                    <option>M-Pesa</option>
                    <option>Cash</option>
                    <option>Bank Transfer</option>
                  </select>
                </div>

                <div>
                  <label className="text-muted" style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>Reference No (Optional)</label>
                  <input 
                    type="text" 
                    className="input" 
                    value={paymentRef}
                    onChange={e => setPaymentRef(e.target.value)}
                    placeholder="e.g. QKT1234..."
                  />
                </div>
                
                <div>
                  <label className="text-muted" style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>Notes (Optional)</label>
                  <input 
                    type="text" 
                    className="input" 
                    value={paymentNotes}
                    onChange={e => setPaymentNotes(e.target.value)}
                  />
                </div>

                <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                  <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowPaymentModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={processing}>
                    {processing ? 'Processing...' : 'Save Payment'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* View Items Modal */}
      <AnimatePresence>
        {selectedSaleItems && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed', inset: 0, zIndex: 100,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)'
            }}
            onClick={() => setSelectedSaleItems(null)}
          >
            <motion.div 
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="glass"
              style={{
                background: 'var(--background)',
                padding: '2rem', width: '100%', maxWidth: '600px', maxHeight: '80vh',
                borderRadius: '16px', border: '1px solid var(--border)',
                display: 'flex', flexDirection: 'column'
              }}
              onClick={e => e.stopPropagation()}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '1rem' }}>
                <h2 className="heading-2" style={{ margin: 0 }}>{selectedSaleItems.description}</h2>
                <button onClick={() => setSelectedSaleItems(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>
                  <X size={20} className="text-muted" />
                </button>
              </div>
              
              <div style={{ overflowY: 'auto', flex: 1 }}>
                {selectedSaleItems.items && selectedSaleItems.items.length > 0 ? (
                  <table className="table" style={{ width: '100%' }}>
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th style={{ textAlign: 'center' }}>Qty</th>
                        <th style={{ textAlign: 'right' }}>Price</th>
                        <th style={{ textAlign: 'right' }}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedSaleItems.items.map((item, i) => (
                        <tr key={i}>
                          <td>{item.product?.NAME} {item.product?.BRAND ? `(${item.product.BRAND})` : ''}</td>
                          <td style={{ textAlign: 'center' }}>{item.QTY}</td>
                          <td style={{ textAlign: 'right' }}>Ksh. {Number(item.UNIT_PRICE).toLocaleString()}</td>
                          <td style={{ textAlign: 'right', fontWeight: 600 }}>Ksh. {(Number(item.QTY) * Number(item.UNIT_PRICE)).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted-foreground)' }}>
                    No item details available for this transaction.
                  </div>
                )}
              </div>
              
              <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
                <button className="btn btn-primary" onClick={() => setSelectedSaleItems(null)}>
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {isPrinting && <StatementPrint account={account} transactions={transactions} />}

    </div>
  );
}
