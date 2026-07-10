'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Plus, Edit, Trash2, Search, X, Wrench, Calendar, Settings, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/components/AuthGuard';

export default function ServicesPage() {
  const [services, setServices] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [products, setProducts] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [originalStatus, setOriginalStatus] = useState('');
  const [formData, setFormData] = useState({
    SERVICE_CODE: '', CUSTOMER_ID: '', EMPLOYEE_ID: '', SERVICE_TYPE: '', DESCRIPTION: '', 
    DATE_SCHEDULED: '', STATUS: 'Scheduled', PRICE: 0, DURATION: '', NOTES: ''
  });

  // Parts / Details State
  const [serviceDetails, setServiceDetails] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [qtyToAdd, setQtyToAdd] = useState(1);
  const { user, role, employeeId } = useAuth();

  const pendingAssignments = services.filter(s => s.EMPLOYEE_ID === employeeId && s.STATUS === 'Pending Assignment');

  const updateServiceStatus = async (id, status) => {
    const { error } = await supabase.from('service').update({ STATUS: status }).eq('SERVICE_ID', id);
    if (!error) fetchServices();
    else alert('Error updating status: ' + error.message);
  };

  const fetchServices = async () => {
    setLoading(true);
    
    let query = supabase.from('service')
      .select(`*, customer(FIRST_NAME, LAST_NAME), employee(FIRST_NAME, LAST_NAME), service_details(DETAIL_ID, PRODUCT_ID, QTY, UNIT_PRICE, SUBTOTAL, product(NAME, BRAND, PRODUCT_CODE, MODEL))`)
      .order('SERVICE_ID', { ascending: false });

    if (role === 'employee' && employeeId) {
      query = query.eq('EMPLOYEE_ID', employeeId);
    }

    // Fetch base data
    const [srvRes, custRes, empRes, prodRes] = await Promise.all([
      query,
      supabase.from('customer').select('*'),
      supabase.from('employee').select('*'),
      supabase.from('product').select('*').gt('ON_HAND', 0)
    ]);

    if (srvRes.data) setServices(srvRes.data);
    if (custRes.data) setCustomers(custRes.data);
    if (empRes.data) setEmployees(empRes.data);
    if (prodRes.data) setProducts(prodRes.data);

    setLoading(false);
  };

  useEffect(() => {
    if (role !== undefined) {
      fetchServices();
    }
  }, [role, employeeId]);

  const openModal = (service = null) => {
    if (service) {
      setEditingId(service.SERVICE_ID);
      setOriginalStatus(service.STATUS || 'Scheduled');
      setFormData({
        SERVICE_CODE: service.SERVICE_CODE || '',
        CUSTOMER_ID: service.CUSTOMER_ID || '',
        EMPLOYEE_ID: service.EMPLOYEE_ID || '',
        SERVICE_TYPE: service.SERVICE_TYPE || '',
        DESCRIPTION: service.DESCRIPTION || '',
        DATE_SCHEDULED: service.DATE_SCHEDULED ? service.DATE_SCHEDULED.split('T')[0] : '',
        STATUS: service.STATUS || 'Scheduled',
        PRICE: service.PRICE || 0,
        DURATION: service.DURATION || '',
        NOTES: service.NOTES || ''
      });
      setServiceDetails(service.service_details || []);
    } else {
      setEditingId(null);
      setOriginalStatus('');
      setFormData({ 
        SERVICE_CODE: `SRV-${Math.floor(Math.random() * 10000)}`, 
        CUSTOMER_ID: '', EMPLOYEE_ID: '', SERVICE_TYPE: '', DESCRIPTION: '', 
        DATE_SCHEDULED: new Date().toISOString().split('T')[0], 
        STATUS: 'Pending Assignment', PRICE: 0, DURATION: '', NOTES: ''
      });
      setServiceDetails([]);
    }
    setShowModal(true);
  };

  const saveService = async (e) => {
    e.preventDefault();
    const payload = { ...formData };
    if (payload.STATUS === 'Completed' && !payload.DATE_COMPLETED) {
      payload.DATE_COMPLETED = new Date().toISOString();
    }
    
    let errorMsg = null;
    let newServiceId = editingId;

    if (editingId) {
      const { error } = await supabase.from('service').update(payload).eq('SERVICE_ID', editingId);
      if (error) errorMsg = error.message;
    } else {
      const { data, error } = await supabase.from('service').insert([payload]).select().single();
      if (error) errorMsg = error.message;
      if (data) newServiceId = data.SERVICE_ID;
    }
    
    if (errorMsg) {
      alert(`Database Error: ${errorMsg}`);
      return;
    }

    // Generate transaction if status changed to Completed
    if (payload.STATUS === 'Completed' && originalStatus !== 'Completed' && editingId) {
      const laborPrice = Number(payload.PRICE) || 0;
      const partsTotal = serviceDetails.reduce((sum, d) => sum + Number(d.SUBTOTAL), 0);
      const grandTotal = laborPrice + partsTotal;

      const { data: transData, error: transErr } = await supabase.from('transaction').insert([{
        SUBTOTAL: grandTotal,
        TAX_AMOUNT: 0,
        GRAND_TOTAL: grandTotal,
        DISCOUNT_AMOUNT: 0,
        ADJUSTED_TOTAL: grandTotal,
        PAYMENT_METHOD: 'Pending Payment',
        CASH_AMOUNT: 0,
        MPESA_AMOUNT: 0,
        HYBRID_PAYMENT: false,
        IS_CREDIT: false,
        IS_SETTLED: false,
        CASH_TENDERED: 0,
        EMPLOYEE_ID: payload.EMPLOYEE_ID || employeeId
      }]).select().single();

      if (!transErr && transData) {
        const details = serviceDetails.map(item => ({
          TRANS_ID: transData.TRANS_ID,
          PRODUCT_ID: item.PRODUCT_ID,
          QTY: item.QTY,
          UNIT_PRICE: item.UNIT_PRICE,
          SUBTOTAL: item.SUBTOTAL
        }));
        if (details.length > 0) {
          await supabase.from('transaction_details').insert(details);
        }
        
        // Stock is deducted automatically via database trigger when transaction_details are inserted.
      }
    }
    
    setShowModal(false);
    fetchServices();
  };

  const handleDelete = async (id) => {
    if (confirm('Are you sure you want to delete this service ticket?')) {
      await supabase.from('service').delete().eq('SERVICE_ID', id);
      fetchServices();
    }
  };

  const addPartToService = async () => {
    if (!editingId) {
      alert("Please save the service ticket first before adding parts.");
      return;
    }
    if (!selectedProduct || qtyToAdd <= 0) return;

    const prod = products.find(p => p.PRODUCT_ID === parseInt(selectedProduct));
    if (!prod) return;

    const subtotal = prod.PRICE * qtyToAdd;

    const { error } = await supabase.from('service_details').insert([{
      SERVICE_ID: editingId,
      PRODUCT_ID: prod.PRODUCT_ID,
      QTY: qtyToAdd,
      UNIT_PRICE: prod.PRICE,
      SUBTOTAL: subtotal
    }]);

    if (error) {
      alert(`Failed to add part: ${error.message}`);
    } else {
      const { data } = await supabase.from('service_details').select('*, product(NAME, BRAND, PRODUCT_CODE, MODEL)').eq('SERVICE_ID', editingId);
      if (data) setServiceDetails(data);
      setSelectedProduct('');
      setQtyToAdd(1);
    }
  };

  const removePart = async (detailId) => {
    if (confirm('Remove this part from the ticket?')) {
      await supabase.from('service_details').delete().eq('DETAIL_ID', detailId);
      if (editingId) {
        const { data } = await supabase.from('service_details').select('*, product(NAME, BRAND, PRODUCT_CODE, MODEL)').eq('SERVICE_ID', editingId);
        if (data) setServiceDetails(data);
      }
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Pending Assignment': return 'badge-secondary';
      case 'Scheduled': return 'badge-warning';
      case 'In Progress': return 'badge-primary';
      case 'Completed': return 'badge-success';
      case 'Completed & Paid': return 'badge-success';
      case 'Declined': return 'badge-destructive';
      case 'Cancelled': return 'badge-destructive';
      default: return 'badge-secondary';
    }
  };

  const filteredServices = services.filter(s => 
    s.SERVICE_CODE?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.customer?.FIRST_NAME?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.employee?.FIRST_NAME?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="animate-fade-in">
      {role === 'employee' && pendingAssignments.length > 0 && (
        <div className="glass" style={{ borderLeft: '4px solid #f59e0b', padding: '1.5rem', marginBottom: '2rem' }}>
          <h3 className="heading-2" style={{ margin: 0, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertTriangle size={20} /> You have {pendingAssignments.length} new service assignment(s)
          </h3>
          <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {pendingAssignments.map(s => (
              <div key={s.SERVICE_ID} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: 'var(--radius)' }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{s.SERVICE_CODE} - {s.SERVICE_TYPE}</div>
                  <div className="text-muted" style={{ fontSize: '0.875rem' }}>Customer: {s.customer?.FIRST_NAME} {s.customer?.LAST_NAME} | Scheduled: {new Date(s.DATE_SCHEDULED).toLocaleDateString()}</div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button className="btn btn-secondary" style={{ borderColor: '#ef4444', color: '#ef4444' }} onClick={() => updateServiceStatus(s.SERVICE_ID, 'Declined')}>Decline</button>
                  <button className="btn btn-primary" onClick={() => updateServiceStatus(s.SERVICE_ID, 'Scheduled')}>Accept</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div style={{ position: 'relative', width: '300px' }}>
          <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted-foreground)' }} />
          <input 
            type="text" 
            placeholder="Search tickets, customers..." 
            className="input" 
            style={{ paddingLeft: '2.5rem' }}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button className="btn btn-primary" onClick={() => openModal()}>
          <Plus size={18} />
          New Service
        </button>
      </div>

      <div className="glass table-wrapper">
        <table className="table">
          <thead>
            <tr>
              <th>Ticket #</th>
              <th>Customer</th>
              <th>Assigned To</th>
              <th>Service Type</th>
              <th>Scheduled</th>
              <th>Status</th>
              <th>Labor Price</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="8" style={{ textAlign: 'center', padding: '2rem' }}>Loading services...</td>
              </tr>
            ) : filteredServices.length === 0 ? (
              <tr>
                <td colSpan="8" style={{ textAlign: 'center', padding: '2rem' }}>No service tickets found.</td>
              </tr>
            ) : (
              filteredServices.map((srv) => (
                <tr key={srv.SERVICE_ID}>
                  <td><span className="badge badge-warning">{srv.SERVICE_CODE}</span></td>
                  <td style={{ fontWeight: 500 }}>{srv.customer?.FIRST_NAME} {srv.customer?.LAST_NAME}</td>
                  <td className="text-muted">{srv.employee?.FIRST_NAME} {srv.employee?.LAST_NAME}</td>
                  <td>{srv.SERVICE_TYPE}</td>
                  <td className="text-muted">{srv.DATE_SCHEDULED ? new Date(srv.DATE_SCHEDULED).toLocaleDateString() : 'N/A'}</td>
                  <td>
                    <span className={`badge ${getStatusColor(srv.STATUS)}`}>
                      {srv.STATUS}
                    </span>
                  </td>
                  <td style={{ fontWeight: 600 }}>Ksh. {srv.PRICE?.toLocaleString()}</td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                      <button className="btn btn-secondary" style={{ padding: '0.5rem' }} title="Edit" onClick={() => openModal(srv)}>
                        <Edit size={16} />
                      </button>
                      <button className="btn btn-destructive" style={{ padding: '0.5rem' }} title="Delete" onClick={() => handleDelete(srv.SERVICE_ID)}>
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

      {showModal && (
        <div style={{ 
          position: 'fixed', 
          inset: 0, 
          background: 'rgba(0,0,0,0.6)', 
          backdropFilter: 'blur(4px)', 
          display: 'flex', 
          alignItems: role === 'employee' ? 'center' : 'flex-start', 
          justifyContent: 'center', 
          zIndex: 9999, 
          padding: role === 'employee' ? '1rem' : '5rem 2rem 2rem 2rem', 
          overflowY: 'auto' 
        }}>
          
          {role === 'employee' ? (
            // EMPLOYEE SIMPLIFIED OVERLAY
            <div className="glass" style={{ width: '100%', maxWidth: '550px', display: 'flex', flexDirection: 'column', background: 'var(--background)', borderRadius: '16px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)' }}>
                <h3 className="heading-2" style={{ margin: 0, fontSize: '1.25rem' }}>Service Assignment</h3>
                <button onClick={() => setShowModal(false)}><X size={20} className="text-muted" /></button>
              </div>
              
              <div style={{ padding: '1.5rem', flex: 1, display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div style={{ padding: '0.75rem 1rem', background: 'var(--card)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                  <div style={{ fontWeight: 600, color: 'var(--primary)', marginBottom: '0.25rem' }}>{formData.SERVICE_CODE} - {formData.SERVICE_TYPE}</div>
                  <div className="text-muted" style={{ fontSize: '0.875rem' }}>
                    {formData.DESCRIPTION || 'No description provided.'}
                  </div>
                </div>

                <form id="employeeServiceForm" onSubmit={saveService}>
                  <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: 'var(--muted-foreground)', marginBottom: '0.25rem' }}>Update Status</label>
                      <select className="input" value={formData.STATUS} onChange={e => setFormData({...formData, STATUS: e.target.value})} style={{ background: 'var(--card)' }}>
                        <option value="Scheduled">Scheduled</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Completed">Completed</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: 'var(--muted-foreground)', marginBottom: '0.25rem' }}>Service Notes / Mechanic Log</label>
                    <textarea className="input" rows={2} value={formData.NOTES} onChange={e => setFormData({...formData, NOTES: e.target.value})} style={{ resize: 'none' }} />
                  </div>
                </form>

                {/* Parts Section for Employees */}
                {editingId && (
                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
                    <h4 style={{ fontWeight: 600, color: 'var(--primary)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1rem' }}>
                      <Settings size={16} /> Parts Used
                    </h4>
                    
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', marginBottom: '0.75rem' }}>
                      <div style={{ flex: 2 }}>
                        <select className="input" value={selectedProduct} onChange={e => setSelectedProduct(e.target.value)} style={{ background: 'var(--card)' }}>
                          <option value="" disabled>Select a part from inventory...</option>
                          {products.map(p => <option key={p.PRODUCT_ID} value={p.PRODUCT_ID}>{p.NAME} ({p.ON_HAND} in stock)</option>)}
                        </select>
                      </div>
                      <div style={{ flex: 1 }}>
                        <input type="number" className="input" min="1" placeholder="Qty" value={qtyToAdd} onChange={e => setQtyToAdd(parseInt(e.target.value) || 1)} />
                      </div>
                      <button type="button" className="btn btn-secondary" onClick={addPartToService}>
                        <Plus size={16} /> Add
                      </button>
                    </div>

                    <div style={{ maxHeight: '120px', overflowY: 'auto' }}>
                      <table className="table" style={{ fontSize: '0.875rem', marginTop: '0' }}>
                        <tbody>
                          {serviceDetails.length === 0 ? (
                            <tr><td colSpan="3" style={{ textAlign: 'center', color: 'var(--muted-foreground)', padding: '0.5rem' }}>No parts added yet.</td></tr>
                          ) : (
                            serviceDetails.map(detail => (
                              <tr key={detail.DETAIL_ID}>
                                <td style={{ padding: '0.5rem' }}>{detail.product?.NAME}</td>
                                <td style={{ padding: '0.5rem' }}>Qty: {detail.QTY}</td>
                                <td style={{ textAlign: 'right', padding: '0.5rem' }}>
                                  <button type="button" onClick={() => removePart(detail.DETAIL_ID)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}>
                                    <X size={14} />
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '1rem 1.5rem', borderTop: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)', borderBottomLeftRadius: '16px', borderBottomRightRadius: '16px' }}>
                <button type="button" className="btn btn-secondary" style={{ marginRight: '1rem' }} onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" form="employeeServiceForm" className="btn btn-primary" style={{ padding: '0.5rem 2rem' }}>Save Updates</button>
              </div>
            </div>
          ) : (
            // ADMIN FULL MODAL
            <div className="glass" style={{ width: '100%', maxWidth: '900px', display: 'flex', flexDirection: 'column', background: 'var(--background)', marginBottom: '4rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.5rem', borderBottom: '1px solid var(--border)' }}>
                <h3 className="heading-2" style={{ margin: 0 }}>{editingId ? 'Edit Service Ticket' : 'Create Service Ticket'}</h3>
                <button onClick={() => setShowModal(false)}><X size={20} className="text-muted" /></button>
              </div>
              
              <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                
                <form id="serviceForm" onSubmit={saveService} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                  
                  {/* Left Column - Details */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <h4 style={{ fontWeight: 600, color: 'var(--primary)', marginBottom: '-0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Wrench size={18} /> Service Info
                    </h4>
                    
                    <div style={{ display: 'flex', gap: '1rem' }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: 'var(--muted-foreground)', marginBottom: '0.25rem' }}>Ticket Code</label>
                        <input type="text" className="input" value={formData.SERVICE_CODE} onChange={e => setFormData({...formData, SERVICE_CODE: e.target.value})} required />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: 'var(--muted-foreground)', marginBottom: '0.25rem' }}>Service Type</label>
                        <input type="text" className="input" placeholder="e.g. Oil Change" value={formData.SERVICE_TYPE} onChange={e => setFormData({...formData, SERVICE_TYPE: e.target.value})} required />
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '1rem' }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: 'var(--muted-foreground)', marginBottom: '0.25rem' }}>Customer</label>
                        <select className="input" value={formData.CUSTOMER_ID} onChange={e => setFormData({...formData, CUSTOMER_ID: parseInt(e.target.value) || ''})} required style={{ background: 'var(--card)' }}>
                          <option value="" disabled>Select Customer</option>
                          {customers.map(c => <option key={c.CUST_ID} value={c.CUST_ID}>{c.FIRST_NAME} {c.LAST_NAME}</option>)}
                        </select>
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: 'var(--muted-foreground)', marginBottom: '0.25rem' }}>Assigned Employee</label>
                        <select className="input" value={formData.EMPLOYEE_ID} onChange={e => setFormData({...formData, EMPLOYEE_ID: parseInt(e.target.value) || ''})} required style={{ background: 'var(--card)' }}>
                          <option value="" disabled>Select Employee</option>
                          {employees.map(e => <option key={e.EMPLOYEE_ID} value={e.EMPLOYEE_ID}>{e.FIRST_NAME} {e.LAST_NAME}</option>)}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: 'var(--muted-foreground)', marginBottom: '0.25rem' }}>Service Description / Issue</label>
                      <textarea className="input" rows={3} value={formData.DESCRIPTION} onChange={e => setFormData({...formData, DESCRIPTION: e.target.value})} style={{ resize: 'vertical' }} />
                    </div>
                  </div>

                  {/* Right Column - Status & Billing */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <h4 style={{ fontWeight: 600, color: 'var(--primary)', marginBottom: '-0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Calendar size={18} /> Schedule & Billing
                    </h4>
                    
                    <div style={{ display: 'flex', gap: '1rem' }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: 'var(--muted-foreground)', marginBottom: '0.25rem' }}>Scheduled Date</label>
                        <input type="date" className="input" value={formData.DATE_SCHEDULED} onChange={e => setFormData({...formData, DATE_SCHEDULED: e.target.value})} required />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: 'var(--muted-foreground)', marginBottom: '0.25rem' }}>Estimated Duration</label>
                        <input type="text" className="input" placeholder="e.g. 2 Hours" value={formData.DURATION} onChange={e => setFormData({...formData, DURATION: e.target.value})} />
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '1rem' }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: 'var(--muted-foreground)', marginBottom: '0.25rem' }}>Status</label>
                        <select className="input" value={formData.STATUS} onChange={e => setFormData({...formData, STATUS: e.target.value})} style={{ background: 'var(--card)' }}>
                          <option value="Pending Assignment">Pending Assignment</option>
                          <option value="Scheduled">Scheduled</option>
                          <option value="In Progress">In Progress</option>
                          <option value="Completed">Completed</option>
                          <option value="Declined">Declined</option>
                          <option value="Cancelled">Cancelled</option>
                        </select>
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: 'var(--muted-foreground)', marginBottom: '0.25rem' }}>Labor Price (Ksh)</label>
                        <input type="number" className="input" value={formData.PRICE} onChange={e => setFormData({...formData, PRICE: parseFloat(e.target.value) || 0})} required />
                      </div>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: 'var(--muted-foreground)', marginBottom: '0.25rem' }}>Internal Notes</label>
                      <textarea className="input" rows={2} value={formData.NOTES} onChange={e => setFormData({...formData, NOTES: e.target.value})} style={{ resize: 'vertical' }} />
                    </div>
                  </div>

                </form>

                {/* Parts Usage Section (Only visible if Editing an existing service) */}
                {editingId && (
                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1.5rem', marginTop: '0.5rem' }}>
                    <h4 style={{ fontWeight: 600, color: 'var(--primary)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Settings size={18} /> Parts & Materials Consumed
                    </h4>
                    
                    <div className="glass" style={{ padding: '1rem', marginBottom: '1rem', display: 'flex', gap: '1rem', alignItems: 'flex-end' }}>
                      <div style={{ flex: 2 }}>
                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: 'var(--muted-foreground)', marginBottom: '0.25rem' }}>Search Inventory Part</label>
                        <select className="input" value={selectedProduct} onChange={e => setSelectedProduct(e.target.value)} style={{ background: 'var(--card)' }}>
                          <option value="" disabled>Select a part...</option>
                          {products.map(p => <option key={p.PRODUCT_ID} value={p.PRODUCT_ID}>{p.NAME} - Ksh {p.PRICE} ({p.ON_HAND} in stock)</option>)}
                        </select>
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: 'var(--muted-foreground)', marginBottom: '0.25rem' }}>Qty</label>
                        <input type="number" className="input" min="1" value={qtyToAdd} onChange={e => setQtyToAdd(parseInt(e.target.value) || 1)} />
                      </div>
                      <button type="button" className="btn btn-secondary" onClick={addPartToService}>
                        <Plus size={16} /> Add Part
                      </button>
                    </div>

                    <table className="table" style={{ fontSize: '0.875rem' }}>
                      <thead>
                        <tr>
                          <th>Part Name</th>
                          <th>Qty</th>
                          <th>Unit Price</th>
                          <th>Subtotal</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {serviceDetails.length === 0 ? (
                          <tr><td colSpan="5" style={{ textAlign: 'center', color: 'var(--muted-foreground)' }}>No parts added to this ticket yet.</td></tr>
                        ) : (
                          serviceDetails.map(detail => (
                            <tr key={detail.DETAIL_ID}>
                              <td>{detail.product?.NAME}</td>
                              <td>{detail.QTY}</td>
                              <td>Ksh {detail.UNIT_PRICE}</td>
                              <td style={{ fontWeight: 600 }}>Ksh {detail.SUBTOTAL}</td>
                              <td>
                                <button type="button" onClick={() => removePart(detail.DETAIL_ID)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}>
                                  <X size={16} />
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                    
                    {serviceDetails.length > 0 && (
                      <div style={{ textAlign: 'right', marginTop: '1rem', fontWeight: 600, fontSize: '1.125rem' }}>
                        Parts Total: Ksh {serviceDetails.reduce((sum, d) => sum + Number(d.SUBTOTAL), 0).toLocaleString()}
                      </div>
                    )}
                  </div>
                )}

                {!editingId && (
                  <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.05)', borderRadius: 'var(--radius)', color: 'var(--muted-foreground)', fontSize: '0.875rem', textAlign: 'center' }}>
                    Save this service ticket first to unlock the "Parts & Materials Consumed" section.
                  </div>
                )}
                
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '1.5rem', borderTop: '1px solid var(--border)' }}>
                <button type="button" className="btn btn-secondary" style={{ marginRight: '1rem' }} onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" form="serviceForm" className="btn btn-primary" style={{ padding: '0.75rem 2.5rem' }}>Save Ticket</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
