'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { Search, Plus, Minus, Trash2, CreditCard, Loader2, ShoppingCart, Smartphone, ArrowLeft, Tag, Layers, User as UserIcon, Calendar, X, ChevronDown, ShoppingBag, Image as ImageIcon } from 'lucide-react';
import Receipt from '@/components/Receipt';
import { useAuth } from '@/components/AuthGuard';
import { logAction } from '@/lib/logger';

const categoryGradients = [
  'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', // Blue
  'linear-gradient(135deg, #10b981 0%, #059669 100%)', // Emerald
  'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', // Amber
  'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)', // Violet
  'linear-gradient(135deg, #ec4899 0%, #db2777 100%)', // Pink
  'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)', // Cyan
  'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', // Red
  'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', // Indigo
];

const getCategoryGradient = (name) => {
  if (!name) return categoryGradients[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return categoryGradients[Math.abs(hash) % categoryGradients.length];
};

export default function POSPage() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [customers, setCustomers] = useState([]);
  
  const [selectedCategory, setSelectedCategory] = useState(null); // null means show categories
  const [searchTerm, setSearchTerm] = useState('');
  
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(true);
  const [checkingOut, setCheckingOut] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);
  
  // Payment State
  const [paymentMethod, setPaymentMethod] = useState('Cash'); // Cash, M-Pesa, Hybrid, Credit
  const [mpesaReceipt, setMpesaReceipt] = useState('');
  
  // Hybrid State
  const [hybridCash, setHybridCash] = useState('');
  const [hybridMpesa, setHybridMpesa] = useState('');
  
  // Credit State
  const [creditCustomerId, setCreditCustomerId] = useState('');
  const [creditDueDate, setCreditDueDate] = useState('');
  const [creditTerms, setCreditTerms] = useState('');
  
  // Adjustments
  const [discountAmount, setDiscountAmount] = useState(''); // positive is discount, negative is surcharge
  
  const [lastTransaction, setLastTransaction] = useState(null);
  const [printData, setPrintData] = useState(null);
  const { employeeId } = useAuth();
  
  const [isMobile, setIsMobile] = useState(false);

  // Auto-trigger print when printData is fully rendered
  useEffect(() => {
    if (printData) {
      const timer = setTimeout(() => {
        window.print();
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [printData]);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 1024);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setFetchError(null);
    const [prodRes, catRes, custRes] = await Promise.all([
      supabase.from('product').select('*'),
      supabase.from('category').select('*').order('CNAME', { ascending: true }),
      supabase.from('customer').select('*')
    ]);
    
    if (prodRes.error || catRes.error || custRes.error) {
      const errorMessage = prodRes.error?.message || catRes.error?.message || custRes.error?.message || 'Unable to load POS data';
      console.error('POS fetch error:', prodRes.error || catRes.error || custRes.error);
      setFetchError(errorMessage);
    }

    if (prodRes.data) setProducts(prodRes.data);
    if (catRes.data) setCategories(catRes.data);
    if (custRes.data) setCustomers(custRes.data);
    
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const getFilteredProducts = () => {
    let filtered = products;
    if (selectedCategory) {
      const matchingCategoryIds = categories
        .filter(c => c.CNAME?.trim().toLowerCase() === selectedCategory.CNAME?.trim().toLowerCase())
        .map(c => String(c.CATEGORY_ID));
      filtered = filtered.filter(p => matchingCategoryIds.includes(String(p.CATEGORY_ID)));
    }
    if (searchTerm) {
      filtered = filtered.filter(p => 
        p.NAME?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.PRODUCT_CODE?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    return filtered;
  };

  const renderPOSContent = () => {
    if (loading) {
      return <p>Loading catalog...</p>;
    }

    if (fetchError) {
      return (
        <div style={{ padding: '1rem', color: 'var(--destructive)' }}>
          Unable to load POS items: {fetchError}
        </div>
      );
    }

    if (!selectedCategory && !searchTerm) {
      if (categories.length === 0) {
        return (
          <div style={{ padding: '1.5rem', color: 'var(--muted-foreground)' }}>
            No categories available. Add categories in Products to start selling.
          </div>
        );
      }

      const uniqueCategories = [];
      const seenNames = new Set();
      categories.forEach(cat => {
        const name = cat.CNAME?.trim().toLowerCase();
        if (name && !seenNames.has(name)) {
          seenNames.add(name);
          uniqueCategories.push(cat);
        }
      });

      return (
        <div className="grid-cards" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
          {uniqueCategories.map(cat => {
            const matchingCategoryIds = categories
              .filter(c => c.CNAME?.trim().toLowerCase() === cat.CNAME?.trim().toLowerCase())
              .map(c => String(c.CATEGORY_ID));
            const categoryProducts = products.filter(p => matchingCategoryIds.includes(String(p.CATEGORY_ID)));
            const itemCount = categoryProducts.reduce((sum, p) => sum + (Number(p.ON_HAND) || 0), 0);

            return (
              <motion.button
                whileHover={{ scale: 1.02, y: -4 }}
                whileTap={{ scale: 0.98 }}
                key={cat.CATEGORY_ID}
                style={{ 
                  padding: '2rem 1.5rem', 
                  textAlign: 'center', 
                  background: getCategoryGradient(cat.CNAME),
                  borderRadius: '16px',
                  color: 'white',
                  border: 'none',
                  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'center',
                  minHeight: '140px',
                  position: 'relative',
                  overflow: 'hidden',
                  cursor: 'pointer'
                }}
                onClick={() => setSelectedCategory(cat)}
              >
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(255,255,255,0.1), transparent)', pointerEvents: 'none' }} />
                
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, letterSpacing: '0.025em', textShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>
                  {cat.CNAME}
                </h3>
                
                <div style={{ 
                  marginTop: '0.75rem', 
                  background: 'rgba(0,0,0,0.2)', 
                  padding: '0.25rem 0.75rem', 
                  borderRadius: '99px', 
                  fontSize: '0.75rem', 
                  fontWeight: 600,
                  backdropFilter: 'blur(4px)',
                  border: '1px solid rgba(255,255,255,0.1)'
                }}>
                  {itemCount} items
                </div>
              </motion.button>
            );
          })}
        </div>
      );
    }

    return (
      <div>
        {selectedCategory && !searchTerm && (
          <h3 className="heading-2" style={{ marginBottom: '1.5rem', color: 'var(--primary)' }}>
            {selectedCategory.CNAME}
          </h3>
        )}
        <div className="grid-cards" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
          {getFilteredProducts().map(product => (
            <button
              key={product.PRODUCT_ID}
              className="glass"
              style={{
                padding: '1.25rem',
                textAlign: 'left',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
                transition: 'transform 0.1s',
                opacity: product.ON_HAND <= 0 ? 0.5 : 1,
                cursor: product.ON_HAND <= 0 ? 'not-allowed' : 'pointer'
              }}
              onClick={() => product.ON_HAND > 0 ? addToCart(product) : alert('This product is out of stock!')}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                <span className="badge badge-warning">{product.PRODUCT_CODE}</span>
                <span className={product.ON_HAND <= 0 ? "text-destructive font-bold" : "text-muted"} style={{ fontSize: '0.875rem' }}>
                  {product.ON_HAND <= 0 ? 'Out of Stock' : `Stock: ${product.ON_HAND}`}
                </span>
              </div>
              
              <div style={{ width: '100%', height: '120px', borderRadius: '8px', overflow: 'hidden', background: 'rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.5rem' }}>
                {product.IMAGE_URL ? (
                  <img src={product.IMAGE_URL} alt={product.NAME} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                ) : (
                  <ImageIcon size={32} style={{ opacity: 0.1 }} />
                )}
              </div>

              <div style={{ flex: 1 }}>
                <h4 style={{ fontWeight: 600, color: 'var(--foreground)', marginBottom: '0.25rem', lineHeight: '1.4' }}>{product.NAME}</h4>
                {(product.BRAND || product.MODEL) && (
                  <p style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>
                    {product.BRAND} {product.MODEL}
                  </p>
                )}
              </div>
              <p style={{ color: 'var(--primary)', fontWeight: 700, marginTop: 'auto' }}>Ksh. {product.PRICE?.toLocaleString()}</p>
            </button>
          ))}
          {getFilteredProducts().length === 0 && (
            <div style={{ padding: '1rem', color: 'var(--muted-foreground)' }}>
              No products found. Try a different search or select another category.
            </div>
          )}
        </div>
      </div>
    );
  };

  const addToCart = (product) => {
    setCart(prev => {
      const existing = prev.find(item => item.PRODUCT_ID === product.PRODUCT_ID);
      if (existing) {
        if (existing.quantity >= product.ON_HAND) return prev;
        return prev.map(item => item.PRODUCT_ID === product.PRODUCT_ID ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const updateQuantity = (id, delta) => {
    setCart(prev => prev.map(item => {
      if (item.PRODUCT_ID === id) {
        const newQuantity = item.quantity + delta;
        if (newQuantity <= 0) return null;
        if (newQuantity > item.ON_HAND) return item;
        return { ...item, quantity: newQuantity };
      }
      return item;
    }).filter(Boolean));
  };

  const removeFromCart = (id) => setCart(prev => prev.filter(item => item.PRODUCT_ID !== id));

  // Calculations
  const subtotal = cart.reduce((acc, item) => acc + (item.PRICE * item.quantity), 0);
  const totalBeforeDiscount = subtotal;
  const grandTotal = Math.max(0, totalBeforeDiscount + (Number(discountAmount) || 0));

  // Validate Hybrid Math
  const isHybridValid = () => {
    const cash = Number(hybridCash) || 0;
    const mpesa = Number(hybridMpesa) || 0;
    return Math.abs((cash + mpesa) - grandTotal) < 0.01;
  };

  const checkout = async () => {
    if (cart.length === 0) return;
    
    if (paymentMethod === 'Hybrid' && !isHybridValid()) {
      alert(`Hybrid payments must equal exactly Ksh. ${grandTotal.toLocaleString()}`);
      return;
    }

    if (paymentMethod === 'Credit') {
      if (!creditCustomerId) {
        alert("Please select a customer for this Credit Sale.");
        return;
      }
      if (!creditDueDate) {
        alert("Please select a Due Date for this Credit Sale.");
        return;
      }
    }

    setCheckingOut(true);

    try {
      // Setup payload based on method
      let cashAmt = 0;
      let mpesaAmt = 0;
      let isCredit = false;

      if (paymentMethod === 'Cash') cashAmt = grandTotal;
      if (paymentMethod === 'M-Pesa') mpesaAmt = grandTotal;
      if (paymentMethod === 'Hybrid') {
        cashAmt = Number(hybridCash) || 0;
        mpesaAmt = Number(hybridMpesa) || 0;
      }
      if (paymentMethod === 'Credit') {
        isCredit = true;
      }

      // Create Transaction
      const { data: transData, error: transErr } = await supabase.from('transaction').insert([{
        SUBTOTAL: subtotal,
        TAX_AMOUNT: 0,
        GRAND_TOTAL: totalBeforeDiscount,
        DISCOUNT_AMOUNT: -(Number(discountAmount) || 0),
        ADJUSTED_TOTAL: grandTotal,
        
        PAYMENT_METHOD: paymentMethod,
        CASH_AMOUNT: cashAmt,
        MPESA_AMOUNT: mpesaAmt,
        HYBRID_PAYMENT: paymentMethod === 'Hybrid',
        
        IS_CREDIT: isCredit,
        CREDIT_CUSTOMER_ID: isCredit ? parseInt(creditCustomerId) : null,
        CREDIT_DUE_DATE: isCredit ? creditDueDate : null,
        CREDIT_TERMS: isCredit ? creditTerms : null,
        
        CASH_TENDERED: isCredit ? 0 : grandTotal,
        EMPLOYEE_ID: employeeId
      }]).select().single();

      if (transErr) throw transErr;

      // Create Details
      const details = cart.map(item => ({
        TRANS_ID: transData.TRANS_ID,
        PRODUCT_ID: item.PRODUCT_ID,
        QTY: item.quantity,
        UNIT_PRICE: item.PRICE,
        SUBTOTAL: item.PRICE * item.quantity
      }));

      const { error: detErr } = await supabase.from('transaction_details').insert(details);
      if (detErr) throw detErr;

      await logAction({
        action: 'Completed Sale',
        details: `Transaction #${transData.TRANS_ID} completed via ${paymentMethod} for Ksh. ${grandTotal.toLocaleString()}`,
        severity: 'info',
        employeeId: employeeId
      });

      alert(`Success! Transaction #${transData.TRANS_ID} completed.`);
      
      setLastTransaction(transData);
      
      // Decouple the printed data from the active cart state
      setPrintData({
        transaction: transData,
        cart: [...cart],
        subtotal: subtotal,
        grandTotal: grandTotal
      });

      // Reset Active POS
      setCart([]);
      setLastTransaction(null);
      setMpesaReceipt('');
      setHybridCash('');
      setHybridMpesa('');
      setCreditCustomerId('');
      setCreditDueDate('');
      setCreditTerms('');
      setDiscountAmount('');
      setSelectedCategory(null);
      setIsMobileCartOpen(false);

      fetchData();
    } catch (err) {
      alert('Error during checkout: ' + err.message);
    } finally {
      setCheckingOut(false);
    }
  };

  return (
    <div className="animate-fade-in pos-wrapper">
      
      {/* Left Area: Categories or Products */}
      <motion.div 
        className="left-panel"
        animate={isMobile ? { 
          scale: isMobileCartOpen ? 0.95 : 1,
          opacity: isMobileCartOpen ? 0.5 : 1,
          y: isMobileCartOpen ? -10 : 0
        } : { scale: 1, opacity: 1, y: 0 }}
        transition={{ type: "spring", bounce: 0, duration: 0.4 }}
        style={{ transformOrigin: 'top' }}
      >
        
        {/* Header Bar */}
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          {selectedCategory ? (
            <button className="btn btn-secondary" onClick={() => setSelectedCategory(null)} style={{ padding: '0.5rem 1rem' }}>
              <ArrowLeft size={18} /> Back to Categories
            </button>
          ) : (
            <div style={{ padding: '0.5rem 1rem', background: 'var(--primary)', color: 'var(--primary-foreground)', borderRadius: 'var(--radius)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Layers size={18} /> Select a Category
            </div>
          )}

          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted-foreground)' }} />
            <input 
              type="text" 
              placeholder="Search parts by name or code..." 
              className="input" 
              style={{ paddingLeft: '2.5rem', background: 'var(--card)' }}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Content Grid */}
        <div className="left-content">
          {renderPOSContent()}
        </div>
      </motion.div>

      {/* Right Area: Cart Panel */}
      <AnimatePresence>
        {(!isMobile || isMobileCartOpen) && (
          <motion.div 
            className="glass cart-panel" 
            style={{ display: 'flex', flexDirection: 'column' }}
            initial={isMobile ? { y: "100%" } : false}
            animate={isMobile ? { y: 0 } : false}
            exit={isMobile ? { y: "100%" } : false}
            transition={{ type: "spring", damping: 25, stiffness: 200, mass: 0.8 }}
          >
            {/* Mobile Close Button */}
            <div className="mobile-close-btn" onClick={() => setIsMobileCartOpen(false)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--foreground)' }}>
                <ChevronDown size={24} /> 
                <span style={{ fontWeight: 600, fontSize: '1.1rem' }}>Back to Catalog</span>
              </div>
              <span style={{ fontWeight: 700, fontSize: '1.2rem', color: 'var(--foreground)' }}>Cart</span>
            </div>
            <style jsx>{`
          .pos-wrapper {
            display: flex;
            gap: 2rem;
            height: calc(100vh - 120px);
            position: relative;
          }
          .left-panel {
            flex: 1;
            display: flex;
            flex-direction: column;
            gap: 1.5rem;
            overflow: hidden;
            min-width: 0;
          }
          .left-content {
            flex: 1;
            overflow-y: auto;
            padding-right: 0.5rem;
          }
          .cart-panel { 
            flex: 0 0 450px; 
            max-width: 100%; 
            overflow: hidden;
          }
          .mobile-close-btn { display: none; }
          .mobile-cart-fab { display: none; }
          
          @media (max-width: 1024px) { 
            .pos-wrapper {
              display: block; /* Switch off flex to allow absolute positioning of drawer */
            }
            .left-panel {
              height: calc(100vh - 120px);
              padding-bottom: 80px; /* Space for FAB */
            }
            .cart-panel { 
              position: fixed;
              top: 0;
              left: 0;
              right: 0;
              bottom: 0;
              width: 100vw; 
              height: 100vh;
              background: var(--background); /* Solid to cover catalog */
              border-radius: 24px 24px 0 0; /* Rounded top corners like a nice app drawer */
              z-index: 9999;
              box-shadow: 0 -10px 40px rgba(0,0,0,0.3);
              border: 1px solid var(--border);
            }
            .mobile-close-btn {
              display: flex;
              align-items: center;
              justify-content: space-between;
              padding: 1rem 1.5rem;
              background: rgba(15, 23, 42, 0.8);
              backdrop-filter: blur(12px);
              -webkit-backdrop-filter: blur(12px);
              border-bottom: 1px solid var(--border);
              cursor: pointer;
              border-radius: 24px 24px 0 0;
              position: sticky;
              top: 0;
              z-index: 10;
            }
            .mobile-close-btn:active {
              background: rgba(15, 23, 42, 0.95);
            }
            .mobile-cart-fab {
              display: flex;
              position: fixed;
              bottom: 1.5rem;
              left: 1.5rem;
              right: 1.5rem;
              background: var(--primary);
              color: white;
              padding: 1rem 1.5rem;
              border-radius: 99px;
              box-shadow: 0 10px 25px rgba(59, 130, 246, 0.5);
              align-items: center;
              justify-content: space-between;
              z-index: 90;
              cursor: pointer;
              transition: transform 0.2s;
            }
            .mobile-cart-fab:active {
              transform: scale(0.98);
            }
          }
        `}</style>
        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border)' }}>
          <h2 className="heading-2" style={{ margin: 0 }}>Current Sale</h2>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
          {cart.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--muted-foreground)' }}>
              <ShoppingCart size={48} style={{ marginBottom: '1rem', opacity: 0.2 }} />
              <p>Cart is empty</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {cart.map(item => (
                <div key={item.PRODUCT_ID} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: 'var(--radius)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ flex: 1, paddingRight: '1rem' }}>
                    <h5 style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: '0.25rem', lineHeight: '1.3' }}>{item.NAME}</h5>
                    <p className="text-muted" style={{ fontSize: '0.875rem', fontWeight: 500 }}>Ksh. {item.PRICE.toLocaleString()}</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <button className="btn btn-secondary" style={{ padding: '0.4rem' }} onClick={() => updateQuantity(item.PRODUCT_ID, -1)}>
                      <Minus size={14} />
                    </button>
                    <span style={{ width: '28px', textAlign: 'center', fontWeight: 600 }}>{item.quantity}</span>
                    <button className="btn btn-secondary" style={{ padding: '0.4rem' }} onClick={() => updateQuantity(item.PRODUCT_ID, 1)}>
                      <Plus size={14} />
                    </button>
                    <button className="btn btn-destructive" style={{ padding: '0.4rem', marginLeft: '0.5rem' }} onClick={() => removeFromCart(item.PRODUCT_ID)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ padding: '1.5rem', background: 'rgba(0,0,0,0.2)', borderTop: '1px solid var(--border)' }}>
          
          {/* Adjustments Section */}
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', alignItems: 'center' }}>
            <Tag size={16} className="text-muted" />
            <span style={{ fontSize: '0.875rem', color: 'var(--muted-foreground)', fontWeight: 500 }}>Adjust Price:</span>
            
            <div style={{ display: 'flex', alignItems: 'center', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
              <button 
                className="btn btn-secondary" 
                style={{ padding: '0 0.875rem', height: '36px', border: 'none', borderRight: '1px solid var(--border)', borderRadius: 0 }}
                onClick={() => setDiscountAmount(prev => (Number(prev) || 0) - 100)}
              >
                <Minus size={16} />
              </button>
              <input 
                type="number" 
                className="input" 
                style={{ padding: '0.25rem 0.5rem', height: '36px', width: '90px', border: 'none', borderRadius: 0, textAlign: 'center', background: 'transparent', fontWeight: 600 }} 
                value={discountAmount} 
                onChange={(e) => setDiscountAmount(e.target.value)} 
                placeholder="0"
              />
              <button 
                className="btn btn-secondary" 
                style={{ padding: '0 0.875rem', height: '36px', border: 'none', borderLeft: '1px solid var(--border)', borderRadius: 0 }}
                onClick={() => setDiscountAmount(prev => (Number(prev) || 0) + 100)}
              >
                <Plus size={16} />
              </button>
            </div>
            
            <span style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', flex: 1, textAlign: 'right' }}>
              *negative = discount
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '1rem' }}>
            <span className="text-muted">Subtotal</span>
            <span style={{ fontWeight: 500 }}>Ksh. {subtotal.toLocaleString()}</span>
          </div>
          {Number(discountAmount) !== 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '1rem', color: Number(discountAmount) < 0 ? '#10b981' : '#ef4444', fontWeight: 500 }}>
              <span>{Number(discountAmount) < 0 ? 'Discount' : 'Surcharge'}</span>
              <span>{Number(discountAmount) < 0 ? '-' : '+'} Ksh. {Math.abs(Number(discountAmount)).toLocaleString()}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px dashed rgba(255,255,255,0.15)', fontSize: '1.75rem', fontWeight: 800, color: 'var(--primary)', letterSpacing: '-0.02em' }}>
            <span>Total</span>
            <span>Ksh. {grandTotal.toLocaleString()}</span>
          </div>
          
          {/* Payment Method Selector */}
          <div className="btn-group-mobile" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
            <button className={`btn ${paymentMethod === 'Cash' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setPaymentMethod('Cash')} style={{ padding: '0.75rem' }}>Cash</button>
            <button className={`btn ${paymentMethod === 'M-Pesa' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setPaymentMethod('M-Pesa')} style={{ padding: '0.75rem', backgroundColor: paymentMethod === 'M-Pesa' ? '#25D366' : '', color: paymentMethod === 'M-Pesa' ? '#fff' : '' }}>M-Pesa</button>
            <button className={`btn ${paymentMethod === 'Hybrid' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setPaymentMethod('Hybrid')} style={{ padding: '0.75rem' }}>Hybrid</button>
            <button className={`btn ${paymentMethod === 'Credit' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setPaymentMethod('Credit')} style={{ padding: '0.75rem', backgroundColor: paymentMethod === 'Credit' ? '#f59e0b' : '', color: paymentMethod === 'Credit' ? '#fff' : '' }}>Credit Sale</button>
          </div>

          {/* Conditional Inputs based on Method */}
          {paymentMethod === 'M-Pesa' && (
            <input type="text" className="input" placeholder="M-Pesa Transaction Code" style={{ marginBottom: '1.25rem', border: '2px solid #25D366', padding: '0.75rem' }} value={mpesaReceipt} onChange={(e) => setMpesaReceipt(e.target.value)} />
          )}

          {paymentMethod === 'Hybrid' && (
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.25rem' }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', display: 'block', marginBottom: '0.25rem' }}>Cash Amount</label>
                <input type="number" className="input" placeholder="0" style={{ padding: '0.75rem' }} value={hybridCash} onChange={e => setHybridCash(e.target.value)} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', display: 'block', marginBottom: '0.25rem' }}>M-Pesa Amount</label>
                <input type="number" className="input" placeholder="0" style={{ border: '2px solid #25D366', padding: '0.75rem' }} value={hybridMpesa} onChange={e => setHybridMpesa(e.target.value)} />
              </div>
            </div>
          )}

          {paymentMethod === 'Credit' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.25rem' }}>
              <select className="input" style={{ padding: '0.75rem' }} value={creditCustomerId} onChange={e => setCreditCustomerId(e.target.value)}>
                <option value="" disabled>Select Customer...</option>
                {customers.map(c => <option key={c.CUST_ID} value={c.CUST_ID}>{c.FIRST_NAME} {c.LAST_NAME}</option>)}
              </select>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', display: 'block', marginBottom: '0.25rem' }}>Due Date</label>
                  <input type="date" className="input" style={{ padding: '0.75rem' }} value={creditDueDate} onChange={e => setCreditDueDate(e.target.value)} />
                </div>
              </div>
              <input type="text" className="input" style={{ padding: '0.75rem' }} placeholder="Terms / Notes..." value={creditTerms} onChange={e => setCreditTerms(e.target.value)} />
            </div>
          )}

          {(paymentMethod === 'Hybrid' && Number(hybridMpesa) > 0) && (
            <input type="text" className="input" placeholder="M-Pesa Transaction Code" style={{ marginBottom: '1.25rem', border: '2px solid #25D366', padding: '0.75rem' }} value={mpesaReceipt} onChange={(e) => setMpesaReceipt(e.target.value)} />
          )}

          <button 
            className="btn btn-primary" 
            style={{ 
              width: '100%', 
              padding: '1.125rem', 
              fontSize: '1.125rem', 
              fontWeight: 700,
              backgroundColor: paymentMethod === 'M-Pesa' ? '#25D366' : paymentMethod === 'Credit' ? '#f59e0b' : 'var(--primary)',
              transition: 'background-color 0.2s, transform 0.1s',
              color: '#fff'
            }}
            disabled={cart.length === 0 || checkingOut}
            onClick={checkout}
          >
            {checkingOut ? <Loader2 size={20} className="animate-spin" /> : 
             paymentMethod === 'M-Pesa' ? <Smartphone size={20} /> : 
             paymentMethod === 'Credit' ? <Calendar size={20} /> : <CreditCard size={20} />}
            {checkingOut ? 'Processing...' : paymentMethod === 'Credit' ? 'Log Credit Sale' : `Pay Ksh. ${grandTotal.toLocaleString()}`}
          </button>
        </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Bottom Bar (Mobile Only) */}
      <AnimatePresence>
        {isMobile && !isMobileCartOpen && cart.length > 0 && (
          <motion.div 
            className="mobile-cart-fab animate-fade-in" 
            onClick={() => setIsMobileCartOpen(true)}
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ShoppingBag size={18} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                <span style={{ fontWeight: 600, fontSize: '1.125rem', lineHeight: '1.2' }}>View Cart</span>
                <span style={{ fontSize: '0.875rem', opacity: 0.9 }}>{cart.reduce((sum, item) => sum + item.quantity, 0)} items</span>
              </div>
            </div>
            <div style={{ fontWeight: 700, fontSize: '1.25rem', letterSpacing: '0.025em' }}>
              Ksh. {grandTotal.toLocaleString()}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hidden Thermal Receipt */}
      {printData && (
        <Receipt 
          transaction={printData.transaction} 
          cart={printData.cart} 
          subtotal={printData.subtotal} 
          grandTotal={printData.grandTotal} 
        />
      )}
    </div>
  );
}
