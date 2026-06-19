'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/AuthGuard';
import { Plus, Search, FileText, Printer, CheckCircle, XCircle, ChevronDown, Trash2 } from 'lucide-react';
import InvoicePrint from '@/components/InvoicePrint';
import { logAction } from '@/lib/logger';
import { createPortal } from 'react-dom';

export default function InvoicesPage() {
  const { role, employeeId } = useAuth();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Create Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [products, setProducts] = useState([]);
  const [newInvoice, setNewInvoice] = useState({
    CUSTOMER_NAME: '',
    CUSTOMER_PHONE: '',
    CUSTOMER_ADDRESS: '',
    CUSTOMER_EMAIL: '',
    NOTES: ''
  });
  const [invoiceItems, setInvoiceItems] = useState([]);
  const [productSearch, setProductSearch] = useState('');
  const [saving, setSaving] = useState(false);

  // Print
  const [printInvoice, setPrintInvoice] = useState(null);
  const [printItems, setPrintItems] = useState([]);
  const printRef = useRef(null);

  useEffect(() => {
    fetchInvoices();
    fetchProducts();
  }, [role, employeeId]);

  useEffect(() => {
    if (printInvoice) {
      const timer = setTimeout(() => {
        window.print();
        setPrintInvoice(null);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [printInvoice]);

  const fetchInvoices = async () => {
    setLoading(true);
    let query = supabase.from('invoice').select(`*, invoice_details(*)`).order('INVOICE_ID', { ascending: false });
    const { data, error } = await query;
    if (data) setInvoices(data);
    setLoading(false);
  };

  const fetchProducts = async () => {
    const { data } = await supabase.from('product').select('*').eq('STATUS', 'active');
    if (data) setProducts(data);
  };

  const addItem = (product) => {
    const existing = invoiceItems.find(i => i.PRODUCT_ID === product.PRODUCT_ID);
    if (existing) {
      setInvoiceItems(invoiceItems.map(i => i.PRODUCT_ID === product.PRODUCT_ID ? { ...i, QTY: i.QTY + 1, TOTAL_PRICE: (i.QTY + 1) * i.UNIT_PRICE } : i));
    } else {
      setInvoiceItems([...invoiceItems, {
        PRODUCT_ID: product.PRODUCT_ID,
        DESCRIPTION: product.NAME,
        QTY: 1,
        UNIT_PRICE: product.PRICE,
        TOTAL_PRICE: product.PRICE
      }]);
    }
    setProductSearch('');
  };

  const removeItem = (productId) => {
    setInvoiceItems(invoiceItems.filter(i => i.PRODUCT_ID !== productId));
  };

  const updateItemQty = (productId, qty) => {
    if (qty < 1) return;
    setInvoiceItems(invoiceItems.map(i => i.PRODUCT_ID === productId ? { ...i, QTY: qty, TOTAL_PRICE: qty * i.UNIT_PRICE } : i));
  };

  const calculateTotals = () => {
    const subtotal = invoiceItems.reduce((acc, i) => acc + i.TOTAL_PRICE, 0);
    const tax = subtotal * 0.16; // 16% VAT
    const grandTotal = subtotal + tax;
    return { subtotal, tax, grandTotal };
  };

  const saveInvoice = async () => {
    if (!newInvoice.CUSTOMER_NAME) return alert("Customer name is required");
    if (invoiceItems.length === 0) return alert("Add at least one item to the invoice");

    setSaving(true);
    const { subtotal, tax, grandTotal } = calculateTotals();

    const { data: invData, error: invError } = await supabase.from('invoice').insert([{
      CUSTOMER_NAME: newInvoice.CUSTOMER_NAME,
      CUSTOMER_PHONE: newInvoice.CUSTOMER_PHONE,
      CUSTOMER_ADDRESS: newInvoice.CUSTOMER_ADDRESS,
      CUSTOMER_EMAIL: newInvoice.CUSTOMER_EMAIL,
      NOTES: newInvoice.NOTES,
      SUBTOTAL: subtotal,
      TAX_AMOUNT: tax,
      GRAND_TOTAL: grandTotal,
      STATUS: 'Pending',
      EMPLOYEE_ID: employeeId
    }]).select().single();

    if (invError) {
      alert("Failed to save invoice: " + invError.message);
      setSaving(false);
      return;
    }

    const itemsToInsert = invoiceItems.map(i => ({
      INVOICE_ID: invData.INVOICE_ID,
      PRODUCT_ID: i.PRODUCT_ID,
      DESCRIPTION: i.DESCRIPTION,
      QTY: i.QTY,
      UNIT_PRICE: i.UNIT_PRICE,
      TOTAL_PRICE: i.TOTAL_PRICE
    }));

    await supabase.from('invoice_details').insert(itemsToInsert);

    await logAction({
      action: 'Created Invoice',
      details: `Created Invoice #${invData.INVOICE_ID} for ${newInvoice.CUSTOMER_NAME}. Total: Ksh ${grandTotal.toLocaleString()}`,
      severity: 'info',
      employeeId: employeeId
    });

    setSaving(false);
    setShowCreateModal(false);
    setNewInvoice({ CUSTOMER_NAME: '', CUSTOMER_PHONE: '', CUSTOMER_ADDRESS: '', CUSTOMER_EMAIL: '', NOTES: '' });
    setInvoiceItems([]);
    fetchInvoices();
  };

  const markAsPaid = async (invoiceId) => {
    if (!confirm("Mark this invoice as Paid? This will deduct the stock for these items and generate a POS transaction.")) return;
    
    // Fetch full invoice details
    const { data: inv } = await supabase.from('invoice').select('*, invoice_details(*)').eq('INVOICE_ID', invoiceId).single();
    if (!inv) return;

    // 1. Check stock availability first
    for (let item of inv.invoice_details) {
      const { data: pData } = await supabase.from('product').select('ON_HAND, NAME').eq('PRODUCT_ID', item.PRODUCT_ID).single();
      if (pData && pData.ON_HAND < item.QTY) {
        alert(`Insufficient stock for ${pData.NAME}. Available: ${pData.ON_HAND}, Required: ${item.QTY}`);
        return;
      }
    }

    // 2. Deduct Stock
    for (let item of inv.invoice_details) {
      const { data: pData } = await supabase.from('product').select('ON_HAND').eq('PRODUCT_ID', item.PRODUCT_ID).single();
      if (pData) {
        await supabase.from('product').update({ ON_HAND: pData.ON_HAND - item.QTY }).eq('PRODUCT_ID', item.PRODUCT_ID);
      }
    }

    // 3. Create Transaction
    const { data: tData, error: tErr } = await supabase.from('transaction').insert([{
      EMPLOYEE_ID: employeeId || inv.EMPLOYEE_ID,
      SUBTOTAL: inv.SUBTOTAL,
      TAX_AMOUNT: inv.TAX_AMOUNT,
      GRAND_TOTAL: inv.GRAND_TOTAL,
      PAYMENT_METHOD: 'Invoice Settlement',
      IS_CREDIT: false,
      IS_SETTLED: true
    }]).select().single();

    if (tErr) {
       alert("Failed to create transaction: " + tErr.message);
       return;
    }

    // Create Transaction Details
    const tItems = inv.invoice_details.map(i => ({
      TRANS_ID: tData.TRANS_ID,
      PRODUCT_ID: i.PRODUCT_ID,
      QTY: i.QTY,
      UNIT_PRICE: i.UNIT_PRICE
    }));
    await supabase.from('transaction_details').insert(tItems);

    // 4. Update Invoice Status
    await supabase.from('invoice').update({ STATUS: 'Paid' }).eq('INVOICE_ID', invoiceId);

    await logAction({
      action: 'Paid Invoice',
      details: `Invoice #${invoiceId} marked as Paid. Transaction #${tData.TRANS_ID} generated and stock deducted.`,
      severity: 'info',
      employeeId: employeeId
    });

    fetchInvoices();
    alert("Invoice paid and stock deducted successfully.");
  };

  const handlePrint = (inv) => {
    setPrintInvoice(inv);
    setPrintItems(inv.invoice_details || []);
  };

  const filteredInvoices = invoices.filter(i => 
    i.CUSTOMER_NAME?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    i.INVOICE_ID?.toString().includes(searchTerm)
  );

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Hide main UI when printing */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #print-invoice-area, #print-invoice-area * {
            visibility: visible;
          }
          #print-invoice-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
        }
      `}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 className="heading-2" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <FileText size={28} className="text-primary" />
          Invoices
        </h1>
        
        <div style={{ display: 'flex', gap: '1rem' }}>
          <div style={{ position: 'relative', width: '300px' }}>
            <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted-foreground)' }} />
            <input 
              type="text" 
              placeholder="Search by customer or ID..." 
              className="input" 
              style={{ paddingLeft: '2.5rem' }}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
            <Plus size={18} /> New Invoice
          </button>
        </div>
      </div>

      <div className="glass table-wrapper">
        <table className="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Date</th>
              <th>Customer</th>
              <th>Total Amount</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="6" style={{ textAlign: 'center', padding: '2rem' }}>Loading invoices...</td></tr>
            ) : filteredInvoices.length === 0 ? (
              <tr><td colSpan="6" style={{ textAlign: 'center', padding: '2rem' }}>No invoices found.</td></tr>
            ) : filteredInvoices.map((inv) => (
              <tr key={inv.INVOICE_ID}>
                <td><span className="badge badge-primary">INV-{inv.INVOICE_ID}</span></td>
                <td>{new Date(inv.CREATED_AT).toLocaleDateString()}</td>
                <td style={{ fontWeight: 600 }}>{inv.CUSTOMER_NAME}</td>
                <td style={{ fontWeight: 600 }}>Ksh {inv.GRAND_TOTAL?.toLocaleString()}</td>
                <td>
                  <span className={`badge ${inv.STATUS === 'Paid' ? 'badge-success' : inv.STATUS === 'Pending' ? 'badge-warning' : 'badge-destructive'}`}>
                    {inv.STATUS}
                  </span>
                </td>
                <td style={{ textAlign: 'right' }}>
                  <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                    {inv.STATUS === 'Pending' && (
                      <button className="btn btn-success" style={{ padding: '0.5rem', background: '#10b981', color: 'white' }} title="Mark as Paid" onClick={() => markAsPaid(inv.INVOICE_ID)}>
                        <CheckCircle size={16} />
                      </button>
                    )}
                    <button className="btn btn-secondary" style={{ padding: '0.5rem' }} title="Print Invoice" onClick={() => handlePrint(inv)}>
                      <Printer size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreateModal && typeof document !== 'undefined' && createPortal(
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '2rem' }}>
          <div className="glass" style={{ width: '100%', maxWidth: '900px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', background: 'var(--background)' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.5rem', borderBottom: '1px solid var(--border)' }}>
              <h3 className="heading-2" style={{ margin: 0 }}>Create New Invoice</h3>
              <button onClick={() => setShowCreateModal(false)}><XCircle size={24} className="text-muted" /></button>
            </div>
            
            <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1, display: 'flex', gap: '2rem' }}>
              {/* Left Side: Details */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <h4 style={{ fontWeight: 600, color: 'var(--primary)' }}>Customer Details</h4>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.25rem', color: 'var(--muted-foreground)' }}>Customer Name</label>
                  <input type="text" className="input" placeholder="Avery Davis" value={newInvoice.CUSTOMER_NAME} onChange={e => setNewInvoice({...newInvoice, CUSTOMER_NAME: e.target.value})} required />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.25rem', color: 'var(--muted-foreground)' }}>Phone Number</label>
                  <input type="text" className="input" placeholder="123-456-7890" value={newInvoice.CUSTOMER_PHONE} onChange={e => setNewInvoice({...newInvoice, CUSTOMER_PHONE: e.target.value})} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.25rem', color: 'var(--muted-foreground)' }}>Address</label>
                  <textarea className="input" placeholder="123 Anywhere St., Any City" value={newInvoice.CUSTOMER_ADDRESS} onChange={e => setNewInvoice({...newInvoice, CUSTOMER_ADDRESS: e.target.value})} rows={2} style={{ resize: 'none' }}/>
                </div>
              </div>

              {/* Right Side: Items */}
              <div style={{ flex: 1.5, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <h4 style={{ fontWeight: 600, color: 'var(--primary)' }}>Invoice Items</h4>
                
                {/* Search Product */}
                <div style={{ position: 'relative' }}>
                  <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted-foreground)' }} />
                  <input 
                    type="text" 
                    placeholder="Search product to add..." 
                    className="input" 
                    style={{ paddingLeft: '2.5rem' }}
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                  />
                  {productSearch && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', maxHeight: '200px', overflowY: 'auto', zIndex: 10, marginTop: '4px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}>
                      {products.filter(p => p.NAME.toLowerCase().includes(productSearch.toLowerCase()) || p.PRODUCT_CODE.toLowerCase().includes(productSearch.toLowerCase())).slice(0, 10).map(p => (
                        <div key={p.PRODUCT_ID} style={{ padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', borderBottom: '1px solid var(--border)' }} onClick={() => addItem(p)} className="hover-bg">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <div style={{ width: '40px', height: '40px', borderRadius: '6px', background: 'var(--background)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              {p.IMAGE_URL ? (
                                <img src={p.IMAGE_URL} alt={p.NAME} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                              ) : (
                                <span style={{ opacity: 0.2 }}>📦</span>
                              )}
                            </div>
                            <span style={{ fontWeight: 500 }}>{p.NAME}</span>
                          </div>
                          <span className="text-muted">Ksh {p.PRICE?.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Items Table */}
                <div style={{ flex: 1, border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ background: 'var(--card)', borderBottom: '1px solid var(--border)' }}>
                      <tr>
                        <th style={{ padding: '0.5rem', textAlign: 'left', fontSize: '0.875rem' }}>Item</th>
                        <th style={{ padding: '0.5rem', textAlign: 'center', fontSize: '0.875rem' }}>Qty</th>
                        <th style={{ padding: '0.5rem', textAlign: 'right', fontSize: '0.875rem' }}>Total</th>
                        <th style={{ padding: '0.5rem' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoiceItems.map(item => (
                        <tr key={item.PRODUCT_ID} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '0.5rem', fontSize: '0.875rem' }}>{item.DESCRIPTION}</td>
                          <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                            <input type="number" min="1" value={item.QTY} onChange={(e) => updateItemQty(item.PRODUCT_ID, parseInt(e.target.value) || 1)} style={{ width: '50px', padding: '0.25rem', textAlign: 'center', background: 'var(--background)', color: 'var(--foreground)', border: '1px solid var(--border)', borderRadius: '4px' }} />
                          </td>
                          <td style={{ padding: '0.5rem', textAlign: 'right', fontSize: '0.875rem', fontWeight: 600 }}>Ksh {item.TOTAL_PRICE?.toLocaleString()}</td>
                          <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                            <button onClick={() => removeItem(item.PRODUCT_ID)} style={{ color: 'var(--destructive)', background: 'transparent', border: 'none', cursor: 'pointer' }}><Trash2 size={16}/></button>
                          </td>
                        </tr>
                      ))}
                      {invoiceItems.length === 0 && (
                        <tr><td colSpan="4" style={{ textAlign: 'center', padding: '2rem', color: 'var(--muted-foreground)' }}>No items added yet.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Totals */}
                <div style={{ background: 'var(--card)', padding: '1rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', color: 'var(--muted-foreground)' }}>
                    <span>Subtotal:</span>
                    <span>Ksh {calculateTotals().subtotal.toLocaleString()}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', color: 'var(--muted-foreground)' }}>
                    <span>Tax (16%):</span>
                    <span>Ksh {calculateTotals().tax.toLocaleString()}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '0.5rem', borderTop: '1px dashed var(--border)', fontWeight: 700, fontSize: '1.125rem', color: 'var(--primary)' }}>
                    <span>Grand Total:</span>
                    <span>Ksh {calculateTotals().grandTotal.toLocaleString()}</span>
                  </div>
                </div>

              </div>
            </div>

            <div style={{ padding: '1.5rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
              <button className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveInvoice} disabled={saving}>
                {saving ? 'Saving...' : 'Save Invoice'}
              </button>
            </div>

          </div>
        </div>
      , document.body)}

      {/* Print Area Container */}
      <div id="print-invoice-area" style={{ display: printInvoice ? 'block' : 'none' }}>
        <InvoicePrint ref={printRef} invoice={printInvoice} items={printItems} />
      </div>

    </div>
  );
}
