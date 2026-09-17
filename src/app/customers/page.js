'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Plus, Edit, Trash2, Search, X } from 'lucide-react';

export default function CustomersPage() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    FIRST_NAME: '', LAST_NAME: '', PHONE_NUMBER: '', EMAIL: '', ADDRESS: '', CITY: '',
    COMPANY_NAME: '', NOTES: '', CUSTOMER_TYPE: 'Retail', LOYALTY_STATUS: 'Standard',
    PREFERRED_CONTACT: 'Phone', TAX_ID: '', SECONDARY_PHONE: ''
  });

  const fetchCustomers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('customer')
      .select('*')
      .order('FIRST_NAME', { ascending: true });

    if (!error && data) {
      setCustomers(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this customer?')) return;
    await supabase.from('customer').delete().eq('CUST_ID', id);
    fetchCustomers();
  };

  const openModal = (customer = null) => {
    if (customer) {
      setEditingId(customer.CUST_ID);
      setFormData({
        FIRST_NAME: customer.FIRST_NAME || '',
        LAST_NAME: customer.LAST_NAME || '',
        PHONE_NUMBER: customer.PHONE_NUMBER || '',
        EMAIL: customer.EMAIL || '',
        ADDRESS: customer.ADDRESS || '',
        CITY: customer.CITY || '',
        COMPANY_NAME: customer.COMPANY_NAME || '',
        NOTES: customer.NOTES || '',
        CUSTOMER_TYPE: customer.CUSTOMER_TYPE || 'Retail',
        LOYALTY_STATUS: customer.LOYALTY_STATUS || 'Standard',
        PREFERRED_CONTACT: customer.PREFERRED_CONTACT || 'Phone',
        TAX_ID: customer.TAX_ID || '',
        SECONDARY_PHONE: customer.SECONDARY_PHONE || '',
        credit_limit: customer.credit_limit || 0
      });
    } else {
      setEditingId(null);
      setFormData({ 
        FIRST_NAME: '', LAST_NAME: '', PHONE_NUMBER: '', EMAIL: '', ADDRESS: '', CITY: '',
        COMPANY_NAME: '', NOTES: '', CUSTOMER_TYPE: 'Retail', LOYALTY_STATUS: 'Standard',
        PREFERRED_CONTACT: 'Phone', TAX_ID: '', SECONDARY_PHONE: '', credit_limit: 0
      });
    }
    setShowModal(true);
  };

  const saveCustomer = async (e) => {
    e.preventDefault();
    let savedCustomerId = editingId;
    
    if (editingId) {
      await supabase.from('customer').update(formData).eq('CUST_ID', editingId);
    } else {
      const { data } = await supabase.from('customer').insert([formData]).select().single();
      if (data) savedCustomerId = data.CUST_ID;
    }
    
    // Sync to credit_accounts if credit_limit > 0 or they already have an account
    if (savedCustomerId) {
      const { data: existingAccounts } = await supabase.from('credit_accounts').select('id').eq('customer_id', savedCustomerId);
      if (existingAccounts && existingAccounts.length > 0) {
        // Update existing credit account's limit
        await supabase.from('credit_accounts').update({ credit_limit: parseFloat(formData.credit_limit) || 0 }).eq('id', existingAccounts[0].id);
      } else if (parseFloat(formData.credit_limit) > 0) {
        // Create new credit account
        await supabase.from('credit_accounts').insert([{
          customer_id: savedCustomerId,
          credit_limit: parseFloat(formData.credit_limit) || 0,
          status: 'active',
          branch_id: '1'
        }]);
      }
    }

    setShowModal(false);
    fetchCustomers();
  };

  const filteredCustomers = customers.filter(c => 
    c.FIRST_NAME?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.LAST_NAME?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.PHONE_NUMBER?.includes(searchTerm)
  );

  return (
    <div className="animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div style={{ position: 'relative', width: '300px' }}>
          <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted-foreground)' }} />
          <input 
            type="text" 
            placeholder="Search customers..." 
            className="input" 
            style={{ paddingLeft: '2.5rem' }}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button className="btn btn-primary" onClick={() => openModal()}>
          <Plus size={18} />
          Add Customer
        </button>
      </div>

      <div className="glass table-wrapper">
        <table className="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Customer</th>
              <th>Contact Info</th>
              <th>Type / Status</th>
              <th>City</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '2rem' }}>Loading customers...</td>
              </tr>
            ) : filteredCustomers.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '2rem' }}>No customers found.</td>
              </tr>
            ) : (
              filteredCustomers.map((customer) => (
                <tr key={customer.CUST_ID}>
                  <td><span className="badge badge-warning">C-{customer.CUST_ID}</span></td>
                  <td>
                    <div style={{ fontWeight: 600, color: 'var(--foreground)' }}>{customer.FIRST_NAME} {customer.LAST_NAME}</div>
                    {customer.COMPANY_NAME && <div style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>{customer.COMPANY_NAME}</div>}
                  </td>
                  <td>
                    <div style={{ fontSize: '0.875rem' }}>{customer.PHONE_NUMBER}</div>
                    {customer.EMAIL && <div style={{ fontSize: '0.75rem', color: 'var(--primary)' }}>{customer.EMAIL}</div>}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <span className={`badge ${customer.CUSTOMER_TYPE === 'Wholesale' ? 'badge-warning' : 'badge-success'}`}>
                        {customer.CUSTOMER_TYPE || 'Retail'}
                      </span>
                      {customer.LOYALTY_STATUS === 'Premium' && (
                        <span className="badge badge-primary" style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                          Premium
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="text-muted">{customer.CITY || 'N/A'}</td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                      <button className="btn btn-secondary" style={{ padding: '0.5rem' }} title="Edit" onClick={() => openModal(customer)}>
                        <Edit size={16} />
                      </button>
                      <button className="btn btn-destructive" style={{ padding: '0.5rem' }} title="Delete" onClick={() => handleDelete(customer.CUST_ID)}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Overlay */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '2rem' }}>
          <div className="glass" style={{ width: '100%', maxWidth: '800px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', background: 'var(--background)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.5rem', borderBottom: '1px solid var(--border)' }}>
              <h3 className="heading-2" style={{ margin: 0 }}>{editingId ? 'Edit Customer' : 'Add Customer'}</h3>
              <button onClick={() => setShowModal(false)}><X size={20} className="text-muted" /></button>
            </div>
            
            <form onSubmit={saveCustomer} style={{ padding: '1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                {/* Personal & Contact Info */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <h4 style={{ fontWeight: 600, color: 'var(--primary)' }}>Personal & Contact</h4>
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <input type="text" className="input" placeholder="First Name" value={formData.FIRST_NAME} onChange={e => setFormData({...formData, FIRST_NAME: e.target.value})} required />
                    <input type="text" className="input" placeholder="Last Name" value={formData.LAST_NAME} onChange={e => setFormData({...formData, LAST_NAME: e.target.value})} required />
                  </div>
                  <input type="email" className="input" placeholder="Email Address" value={formData.EMAIL} onChange={e => setFormData({...formData, EMAIL: e.target.value})} />
                  
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <input type="tel" className="input" placeholder="Primary Phone" value={formData.PHONE_NUMBER} onChange={e => setFormData({...formData, PHONE_NUMBER: e.target.value})} required />
                    <input type="tel" className="input" placeholder="Secondary Phone" value={formData.SECONDARY_PHONE} onChange={e => setFormData({...formData, SECONDARY_PHONE: e.target.value})} />
                  </div>

                  <select className="input" value={formData.PREFERRED_CONTACT} onChange={e => setFormData({...formData, PREFERRED_CONTACT: e.target.value})} style={{ background: 'var(--card)' }}>
                    <option value="Phone">Prefers Phone</option>
                    <option value="Email">Prefers Email</option>
                    <option value="SMS">Prefers SMS</option>
                  </select>

                  <h4 style={{ fontWeight: 600, color: 'var(--primary)', marginTop: '0.5rem' }}>Location</h4>
                  <input type="text" className="input" placeholder="Street Address" value={formData.ADDRESS} onChange={e => setFormData({...formData, ADDRESS: e.target.value})} />
                  <input type="text" className="input" placeholder="City" value={formData.CITY} onChange={e => setFormData({...formData, CITY: e.target.value})} />
                </div>

                {/* Business & CRM Info */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <h4 style={{ fontWeight: 600, color: 'var(--primary)' }}>Business & CRM</h4>
                  
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <select className="input" value={formData.CUSTOMER_TYPE} onChange={e => setFormData({...formData, CUSTOMER_TYPE: e.target.value})} style={{ background: 'var(--card)' }}>
                      <option value="Retail">Retail</option>
                      <option value="Wholesale">Wholesale</option>
                      <option value="B2B">B2B</option>
                    </select>
                    <select className="input" value={formData.LOYALTY_STATUS} onChange={e => setFormData({...formData, LOYALTY_STATUS: e.target.value})} style={{ background: 'var(--card)' }}>
                      <option value="Standard">Standard</option>
                      <option value="Premium">Premium</option>
                      <option value="VIP">VIP</option>
                    </select>
                  </div>

                  <input type="text" className="input" placeholder="Company Name" value={formData.COMPANY_NAME} onChange={e => setFormData({...formData, COMPANY_NAME: e.target.value})} />
                  <input type="text" className="input" placeholder="Tax ID / Business ID" value={formData.TAX_ID} onChange={e => setFormData({...formData, TAX_ID: e.target.value})} />
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <label style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--muted-foreground)' }}>Credit Limit (Ksh)</label>
                    <input type="number" step="0.01" className="input" placeholder="0.00" value={formData.credit_limit} onChange={e => setFormData({...formData, credit_limit: e.target.value})} />
                  </div>
                  
                  <textarea className="input" placeholder="Notes or Internal Comments..." rows={4} value={formData.NOTES} onChange={e => setFormData({...formData, NOTES: e.target.value})} style={{ resize: 'vertical', flex: 1 }} />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
                <button type="button" className="btn btn-secondary" style={{ marginRight: '1rem' }} onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ padding: '0.75rem 2.5rem' }}>Save Customer</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
