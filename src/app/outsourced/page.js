'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/AuthGuard';
import { ExternalLink, ShoppingCart, Loader2 } from 'lucide-react';

export default function OutsourcedProductsPage() {
  const { employeeId, branchId } = useAuth();
  const [formData, setFormData] = useState({
    shop_name: '',
    part_number: '',
    brand: '',
    cost_price: '',
    selling_price: '',
    quantity: 1,
    payment_method: 'Cash'
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setSuccess(false);

    try {
      const qty = parseInt(formData.quantity);
      const cost = parseFloat(formData.cost_price);
      const price = parseFloat(formData.selling_price);

      // 1. Create a dummy product for record keeping
      const { data: prodData, error: prodErr } = await supabase.from('product').insert([{
        NAME: `${formData.part_number} (Outsourced)`,
        BRAND: formData.brand,
        PRICE: price,
        COST_PRICE: cost,
        PRODUCT_CODE: `OUT-${Date.now()}`,
        STATUS: 'inactive',
        CATEGORY_ID: null,
        UOM: 'pcs',
        REORDER_LEVEL: 0,
        ON_HAND: 0,
        BRANCH_ID: branchId === 'ALL' ? 1 : branchId
      }]).select().single();

      if (prodErr) throw prodErr;

      // 2. Create actual transaction for this sale
      const grandTotal = price * qty;
      const { data: transData, error: transErr } = await supabase.from('transaction').insert([{
        SUBTOTAL: grandTotal,
        TAX_AMOUNT: 0,
        GRAND_TOTAL: grandTotal,
        DISCOUNT_AMOUNT: 0,
        ADJUSTED_TOTAL: grandTotal,
        PAYMENT_METHOD: formData.payment_method,
        CASH_AMOUNT: formData.payment_method === 'Cash' ? grandTotal : 0,
        MPESA_AMOUNT: formData.payment_method === 'M-Pesa' ? grandTotal : 0,
        CASH_TENDERED: grandTotal,
        IS_CREDIT: false,
        EMPLOYEE_ID: employeeId,
        BRANCH_ID: branchId === 'ALL' ? 1 : branchId
      }]).select().single();

      if (transErr) throw transErr;

      // 3. Create transaction details
      const { error: detErr } = await supabase.from('transaction_details').insert([{
        TRANS_ID: transData.TRANS_ID,
        PRODUCT_ID: prodData.PRODUCT_ID,
        QTY: qty,
        UNIT_PRICE: price,
        SUBTOTAL: grandTotal,
        BRANCH_ID: branchId === 'ALL' ? 1 : branchId
      }]);

      if (detErr) throw detErr;

      // 4. Log in outsourced_sales table
      const { error: outErr } = await supabase.from('outsourced_sales').insert([{
        shop_name: formData.shop_name,
        part_number: formData.part_number,
        brand: formData.brand,
        cost_price: cost,
        selling_price: price,
        quantity: qty,
        transaction_id: transData.TRANS_ID,
        created_by: employeeId
      }]);

      if (outErr) throw outErr;

      setSuccess(true);
      setFormData({
        shop_name: '',
        part_number: '',
        brand: '',
        cost_price: '',
        selling_price: '',
        quantity: 1,
        payment_method: 'Cash'
      });
      
      // Auto dismiss success message
      setTimeout(() => setSuccess(false), 3000);

    } catch (err) {
      console.error(err);
      alert('Failed to log outsourced sale: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-fade-in" style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
        <div style={{ padding: '0.75rem', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '12px', color: '#3b82f6' }}>
          <ExternalLink size={24} />
        </div>
        <div>
          <h2 className="heading-1" style={{ margin: 0 }}>Outsourced Products</h2>
          <p style={{ color: 'var(--muted-foreground)', marginTop: '0.25rem' }}>Log sales for products outsourced from other shops.</p>
        </div>
      </div>

      <div className="glass" style={{ padding: '2rem' }}>
        {success && (
          <div style={{ padding: '1rem', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '8px', marginBottom: '1.5rem', fontWeight: 500 }}>
            Outsourced sale logged successfully! The transaction has been recorded.
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--muted-foreground)' }}>Shop Outsourced From *</label>
              <input type="text" className="input" required value={formData.shop_name} onChange={e => setFormData({...formData, shop_name: e.target.value})} placeholder="e.g. AutoTech Spares" />
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--muted-foreground)' }}>Part Number / Description *</label>
              <input type="text" className="input" required value={formData.part_number} onChange={e => setFormData({...formData, part_number: e.target.value})} placeholder="e.g. 89467-42020" />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--muted-foreground)' }}>Brand</label>
              <input type="text" className="input" value={formData.brand} onChange={e => setFormData({...formData, brand: e.target.value})} placeholder="e.g. Toyota" />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--muted-foreground)' }}>Quantity *</label>
              <input type="number" className="input" required min="1" value={formData.quantity} onChange={e => setFormData({...formData, quantity: e.target.value})} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--muted-foreground)' }}>Cost Price (Ksh) *</label>
              <input type="number" className="input" required step="0.01" min="0" value={formData.cost_price} onChange={e => setFormData({...formData, cost_price: e.target.value})} placeholder="How much we bought it for" />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--muted-foreground)' }}>Selling Price (Ksh) *</label>
              <input type="number" className="input" required step="0.01" min="0" value={formData.selling_price} onChange={e => setFormData({...formData, selling_price: e.target.value})} placeholder="How much we sold it for" />
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1.5rem', marginTop: '0.5rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem' }}>Payment Details</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--muted-foreground)' }}>Payment Method</label>
                <select className="input" value={formData.payment_method} onChange={e => setFormData({...formData, payment_method: e.target.value})}>
                  <option value="Cash">Cash</option>
                  <option value="M-Pesa">M-Pesa</option>
                  <option value="Card">Card</option>
                </select>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--muted-foreground)' }}>Total Amount</label>
                <div className="input" style={{ background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', fontWeight: 600, color: 'var(--primary)' }}>
                  Ksh {((parseFloat(formData.selling_price) || 0) * (parseInt(formData.quantity) || 0)).toLocaleString()}
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
            <button type="submit" className="btn btn-primary" disabled={loading} style={{ padding: '0.875rem 2.5rem', fontSize: '1rem' }}>
              {loading ? <Loader2 size={20} className="animate-spin" /> : <ShoppingCart size={20} />}
              {loading ? 'Processing...' : 'Complete Outsourced Sale'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
