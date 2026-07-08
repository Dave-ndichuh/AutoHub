'use client';

import { useState, Suspense } from 'react';
import { Plus, Edit, Trash2, Search, X, Image as ImageIcon } from 'lucide-react';
import { UploadButton } from '@/utils/uploadthing';
import { useSearchParams, useRouter } from 'next/navigation';
import { useProducts } from '@/hooks/useProducts';

function ProductsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const filterParam = searchParams.get('filter');

  const {
    products,
    categories,
    suppliers,
    loading,
    error,
    saveProduct: saveProductHook,
    deleteProduct: deleteProductHook
  } = useProducts();

  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    PRODUCT_CODE: '', NAME: '', DESCRIPTION: '', ON_HAND: '', PRICE: '', CATEGORY_ID: '', SUPPLIER_ID: '',
    STATUS: 'active', UOM: 'pcs', REORDER_THRESHOLD: 5, COST_PRICE: '', BARCODE: '', IMAGE_URL: '', TAX_RATE: 16.0, BRAND: '', MODEL: '', WEIGHT: ''
  });

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this product?')) return;
    
    const productToDelete = products.find(p => p.id === id);
    const { success, error: deleteError, archived } = await deleteProductHook(id, { name: productToDelete?.name, productCode: productToDelete?.productCode });
    
    if (!success) {
      alert(`Error deleting product: ${deleteError}`);
    } else if (archived) {
      alert('This product has existing transactions and cannot be permanently deleted. It has been archived (set to inactive) instead.');
    }
  };

  const openModal = (product = null) => {
    if (product) {
      setEditingId(product.id);
      setFormData({
        PRODUCT_CODE: product.productCode,
        NAME: product.name,
        DESCRIPTION: product.description,
        ON_HAND: product.onHand,
        PRICE: product.price,
        CATEGORY_ID: product.categoryId,
        SUPPLIER_ID: product.supplierId,
        STATUS: product.status,
        UOM: product.uom,
        REORDER_THRESHOLD: product.reorderThreshold,
        COST_PRICE: product.costPrice,
        BARCODE: product.barcode,
        IMAGE_URL: product.imageUrl,
        TAX_RATE: product.taxRate,
        BRAND: product.brand,
        MODEL: product.model,
        WEIGHT: product.weight
      });
    } else {
      setEditingId(null);
      setFormData({ 
        PRODUCT_CODE: '', NAME: '', DESCRIPTION: '', ON_HAND: '', PRICE: '', CATEGORY_ID: '', SUPPLIER_ID: '',
        STATUS: 'active', UOM: 'pcs', REORDER_THRESHOLD: 5, COST_PRICE: '', BARCODE: '', IMAGE_URL: '', TAX_RATE: 16.0, BRAND: '', MODEL: '', WEIGHT: ''
      });
    }
    setShowModal(true);
  };

  const saveProduct = async (e) => {
    e.preventDefault();
    const { success, error: saveError } = await saveProductHook(editingId, formData);
    
    if (!success) {
      alert(`Error saving product: ${saveError}`);
      return;
    }
    
    setShowModal(false);
  };

  const filteredProducts = products.filter(p => {
    const term = searchTerm.toLowerCase();
    const matchesSearch = 
      p.name?.toLowerCase().includes(term) || 
      p.productCode?.toLowerCase().includes(term) ||
      p.brand?.toLowerCase().includes(term) ||
      p.model?.toLowerCase().includes(term) ||
      p.barcode?.toLowerCase().includes(term);
    if (filterParam === 'low-stock') {
      return matchesSearch && p.onHand <= p.reorderThreshold;
    }
    return matchesSearch;
  });

  return (
    <>
      <div className="animate-fade-in">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div style={{ position: 'relative', flex: '1 1 300px', maxWidth: '100%' }}>
          <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted-foreground)' }} />
          <input 
            type="text" 
            placeholder="Search products..." 
            className="input" 
            style={{ paddingLeft: '2.5rem' }}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        {filterParam === 'low-stock' && (
          <div style={{ padding: '0.5rem 1rem', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.2)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
             Showing Low Stock Items
             <button onClick={() => router.push('/products')} style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', display: 'flex', padding: 0 }}><X size={16}/></button>
          </div>
        )}

        <button className="btn btn-primary" onClick={() => openModal()}>
          <Plus size={18} />
          Add Product
        </button>
      </div>

      <div className="glass table-wrapper">
        <table className="table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Name</th>
              <th>Category</th>
              <th>Stock</th>
              <th>Status</th>
              <th>Price (Ksh)</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', padding: '2rem' }}>Loading products...</td>
              </tr>
            ) : filteredProducts.length === 0 ? (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', padding: '2rem' }}>No products found.</td>
              </tr>
            ) : (
              filteredProducts.map((product) => (
                <tr key={product.id}>
                  <td><span className="badge badge-warning">{product.productCode}</span></td>
                  <td style={{ fontWeight: 500 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      {product.imageUrl ? (
                        <img src={product.imageUrl} alt={product.name} style={{ width: '40px', height: '40px', borderRadius: '8px', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <ImageIcon size={20} className="text-muted" />
                        </div>
                      )}
                      <div>
                        <div>{product.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', fontWeight: 'normal', marginTop: '0.125rem' }}>
                          {product.brand && <span>{product.brand}</span>}
                          {product.brand && product.model && <span> • </span>}
                          {product.model && <span>{product.model}</span>}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="text-muted">{product.categoryName || 'N/A'}</td>
                  <td>
                    <span className={`badge ${product.onHand <= product.reorderThreshold ? 'badge-warning' : 'badge-success'}`}>
                      {product.onHand} {product.uom}
                    </span>
                    {product.onHand <= product.reorderThreshold && <span style={{ display: 'block', fontSize: '0.75rem', color: '#f59e0b', marginTop: '0.25rem' }}>Low Stock!</span>}
                  </td>
                  <td>
                    <span className={`badge ${product.status === 'inactive' ? 'badge-destructive' : 'badge-success'}`}>
                      {product.status}
                    </span>
                  </td>
                  <td style={{ fontWeight: 600 }}>
                    {product.price?.toLocaleString()}
                    <div style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', fontWeight: 'normal' }}>
                      Cost: {product.costPrice?.toLocaleString()}
                    </div>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                      <button className="btn btn-secondary" style={{ padding: '0.5rem' }} title="Edit" onClick={() => openModal(product)}>
                        <Edit size={16} />
                      </button>
                      <button className="btn btn-destructive" style={{ padding: '0.5rem' }} title="Delete" onClick={() => handleDelete(product.id)}>
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
      </div>

      {/* Modal Overlay */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '2rem' }}>
          <div className="glass" style={{ width: '100%', maxWidth: '800px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', background: 'var(--background)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.5rem', borderBottom: '1px solid var(--border)' }}>
              <h3 className="heading-2" style={{ margin: 0 }}>{editingId ? 'Edit Product' : 'Add Product'}</h3>
              <button onClick={() => setShowModal(false)}><X size={20} className="text-muted" /></button>
            </div>
            
            <form onSubmit={saveProduct} style={{ padding: '1.5rem', overflowY: 'auto', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                {/* Basic Info */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <h4 style={{ fontWeight: 600, color: 'var(--primary)', marginBottom: '-0.5rem' }}>Basic Info</h4>
                  
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: 'var(--muted-foreground)', marginBottom: '0.25rem' }}>Product Code / SKU</label>
                    <input type="text" className="input" placeholder="e.g. BRK-001" value={formData.PRODUCT_CODE} onChange={e => setFormData({...formData, PRODUCT_CODE: e.target.value})} required />
                  </div>
                  
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: 'var(--muted-foreground)', marginBottom: '0.25rem' }}>Product Name</label>
                    <input type="text" className="input" placeholder="e.g. Ceramic Brake Pads" value={formData.NAME} onChange={e => setFormData({...formData, NAME: e.target.value})} required />
                  </div>
                  
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: 'var(--muted-foreground)', marginBottom: '0.25rem' }}>Brand</label>
                    <input type="text" className="input" placeholder="e.g. Bosch" value={formData.BRAND} onChange={e => setFormData({...formData, BRAND: e.target.value})} />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: 'var(--muted-foreground)', marginBottom: '0.25rem' }}>Model / Application</label>
                    <input type="text" className="input" placeholder="e.g. Toyota Hilux 2020+" value={formData.MODEL} onChange={e => setFormData({...formData, MODEL: e.target.value})} />
                  </div>
                  
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: 'var(--muted-foreground)', marginBottom: '0.25rem' }}>Barcode (Optional)</label>
                    <input type="text" className="input" placeholder="Scan or type barcode" value={formData.BARCODE} onChange={e => setFormData({...formData, BARCODE: e.target.value})} />
                  </div>
                  
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: 'var(--muted-foreground)', marginBottom: '0.25rem' }}>Category</label>
                      <select className="input" value={formData.CATEGORY_ID} onChange={e => setFormData({...formData, CATEGORY_ID: parseInt(e.target.value) || ''})} required style={{ background: 'var(--card)' }}>
                        <option value="" disabled>Select Category</option>
                        {categories.map(c => <option key={c.CATEGORY_ID} value={c.CATEGORY_ID}>{c.CNAME}</option>)}
                      </select>
                    </div>
                    
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: 'var(--muted-foreground)', marginBottom: '0.25rem' }}>Supplier</label>
                      <select className="input" value={formData.SUPPLIER_ID} onChange={e => setFormData({...formData, SUPPLIER_ID: parseInt(e.target.value) || ''})} required style={{ background: 'var(--card)' }}>
                        <option value="" disabled>Select Supplier</option>
                        {suppliers.map(s => <option key={s.SUPPLIER_ID} value={s.SUPPLIER_ID}>{s.COMPANY_NAME}</option>)}
                      </select>
                    </div>
                  </div>
                  
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: 'var(--muted-foreground)', marginBottom: '0.25rem' }}>Description</label>
                    <textarea className="input" placeholder="Product details..." rows={3} value={formData.DESCRIPTION} onChange={e => setFormData({...formData, DESCRIPTION: e.target.value})} style={{ resize: 'vertical' }} />
                  </div>
                </div>

                {/* Inventory & Pricing */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <h4 style={{ fontWeight: 600, color: 'var(--primary)', marginBottom: '-0.5rem' }}>Inventory & Pricing</h4>
                  
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: 'var(--muted-foreground)', marginBottom: '0.25rem' }}>Current Stock</label>
                      <input type="number" min="0" className="input" placeholder="0" value={formData.ON_HAND} onChange={e => setFormData({...formData, ON_HAND: e.target.value === '' ? '' : Number(e.target.value)})} required />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: 'var(--muted-foreground)', marginBottom: '0.25rem' }}>Unit of Measure</label>
                      <input type="text" className="input" placeholder="e.g. pcs, liters" value={formData.UOM} onChange={e => setFormData({...formData, UOM: e.target.value})} />
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: 'var(--muted-foreground)', marginBottom: '0.25rem' }}>Reorder Threshold</label>
                      <input type="number" className="input" placeholder="e.g. 5" value={formData.REORDER_THRESHOLD} onChange={e => setFormData({...formData, REORDER_THRESHOLD: parseInt(e.target.value) || 0})} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: 'var(--muted-foreground)', marginBottom: '0.25rem' }}>Weight/Dims (Optional)</label>
                      <input type="text" className="input" placeholder="e.g. 2kg" value={formData.WEIGHT} onChange={e => setFormData({...formData, WEIGHT: e.target.value})} />
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: 'var(--muted-foreground)', marginBottom: '0.25rem' }}>Cost Price (Ksh)</label>
                      <input type="number" min="0" className="input" placeholder="0" value={formData.COST_PRICE} onChange={e => setFormData({...formData, COST_PRICE: e.target.value === '' ? '' : Number(e.target.value)})} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: 'var(--muted-foreground)', marginBottom: '0.25rem' }}>Selling Price (Ksh)</label>
                      <input type="number" min="0" className="input" placeholder="0" value={formData.PRICE} onChange={e => setFormData({...formData, PRICE: e.target.value === '' ? '' : Number(e.target.value)})} required />
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: 'var(--muted-foreground)', marginBottom: '0.25rem' }}>Tax Rate (%)</label>
                      <input type="number" className="input" placeholder="16.0" value={formData.TAX_RATE} onChange={e => setFormData({...formData, TAX_RATE: parseFloat(e.target.value) || 0})} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: 'var(--muted-foreground)', marginBottom: '0.25rem' }}>Status</label>
                      <select className="input" value={formData.STATUS} onChange={e => setFormData({...formData, STATUS: e.target.value})} style={{ background: 'var(--card)' }}>
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ marginTop: '1rem', padding: '1rem', border: '1px dashed var(--border)', borderRadius: 'var(--radius)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                    <h5 style={{ fontWeight: 500, margin: 0 }}>Product Image</h5>
                    {formData.IMAGE_URL && <img src={formData.IMAGE_URL} alt="Preview" style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '8px' }} />}
                    <UploadButton
                      endpoint="imageUploader"
                      onClientUploadComplete={(res) => {
                        if (res && res[0]) {
                          setFormData({...formData, IMAGE_URL: res[0].url});
                        }
                      }}
                      onUploadError={(error) => {
                        alert(`ERROR! ${error.message}`);
                      }}
                    />
                  </div>

                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
                <button type="button" className="btn btn-secondary" style={{ marginRight: '1rem' }} onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ padding: '0.75rem 2.5rem' }}>Save Product</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

export default function ProductsPage() {
  return (
    <Suspense fallback={<div style={{ padding: '2rem', textAlign: 'center' }}>Loading products...</div>}>
      <ProductsContent />
    </Suspense>
  );
}
