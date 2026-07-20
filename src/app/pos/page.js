'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { Search, Plus, Minus, Trash2, CreditCard, Loader2, ShoppingCart, Smartphone, ArrowLeft, Tag, Layers, User as UserIcon, Calendar, X, ChevronDown, ShoppingBag, Image as ImageIcon, FileText, Printer } from 'lucide-react';
import Receipt from '@/components/Receipt';
import InvoicePrint from '@/components/InvoicePrint';
import ThermalInvoice from '@/components/ThermalInvoice';
import { useAuth } from '@/components/AuthGuard';
import { logAction } from '@/lib/logger';
import { formatItemName } from '@/utils/formatters';

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
  const [customerOutstandingCredit, setCustomerOutstandingCredit] = useState(null);
  
  // Adjustments (Moved to item-level)
  
  // New Customer State
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ FIRST_NAME: '', LAST_NAME: '', PHONE_NUMBER: '', EMAIL: '', ADDRESS: '' });
  const [savingCustomer, setSavingCustomer] = useState(false);

  const [lastTransaction, setLastTransaction] = useState(null);
  const [printData, setPrintData] = useState(null);
  const [printInvoiceData, setPrintInvoiceData] = useState(null);
  const [printFormat, setPrintFormat] = useState('THERMAL'); // 'THERMAL' or 'A4'
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [quoteData, setQuoteData] = useState(null);
  const { employeeId, branchId } = useAuth();
  
  const [isMobile, setIsMobile] = useState(false);

  // Auto-trigger print when printData or printInvoiceData is fully rendered
  useEffect(() => {
    if (printData || printInvoiceData) {
      if (printInvoiceData) {
        document.body.classList.add('printing-invoice');
      }
      
      const timer = setTimeout(() => {
        window.print();
      }, 500);
      
      return () => {
        clearTimeout(timer);
        document.body.classList.remove('printing-invoice');
      };
    }
  }, [printData, printInvoiceData]);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 1024);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (paymentMethod !== 'Credit' && paymentMethod !== 'Invoice') {
      setCustomerOutstandingCredit(null);
      return;
    }
    
    if (creditCustomerId && creditCustomerId !== 'new') {
      const fetchCredit = async () => {
        const { data, error } = await supabase
          .from('transaction')
          .select('ADJUSTED_TOTAL, GRAND_TOTAL, CASH_AMOUNT, MPESA_AMOUNT')
          .eq('CREDIT_CUSTOMER_ID', creditCustomerId)
          .eq('IS_CREDIT', true)
          .eq('IS_SETTLED', false);
          
        if (!error && data) {
          let total = 0;
          data.forEach(sale => {
            const saleTotal = sale.ADJUSTED_TOTAL || sale.GRAND_TOTAL;
            const salePaid = (sale.CASH_AMOUNT || 0) + (sale.MPESA_AMOUNT || 0);
            total += (saleTotal - salePaid);
          });
          setCustomerOutstandingCredit(total);
        }
      };
      fetchCredit();
    } else {
      setCustomerOutstandingCredit(null);
    }
  }, [creditCustomerId, paymentMethod]);

  const fetchData = async () => {
    setLoading(true);
    setFetchError(null);
    
    try {
      let allProducts = [];
      let page = 0;
      const limit = 1000;
      let hasMore = true;

      while (hasMore) {
        let prodQuery = supabase.from('product').select('*').range(page * limit, (page + 1) * limit - 1);
        if (branchId && branchId !== 'ALL') {
          prodQuery = prodQuery.eq('BRANCH_ID', branchId);
        }
        
        const { data, error } = await prodQuery;
        if (error) throw error;
        
        if (data && data.length > 0) {
          allProducts = [...allProducts, ...data];
          if (data.length < limit) {
            hasMore = false;
          } else {
            page++;
          }
        } else {
          hasMore = false;
        }
      }

      const [catRes, custRes] = await Promise.all([
        supabase.from('category').select('*').order('CNAME', { ascending: true }),
        supabase.from('customer').select('*')
      ]);
      
      if (catRes.error) throw catRes.error;
      if (custRes.error) throw custRes.error;

      setProducts(allProducts);
      if (catRes.data) setCategories(catRes.data);
      if (custRes.data) setCustomers(custRes.data);
      
    } catch (error) {
      console.error('POS fetch error:', error);
      setFetchError(error.message || 'Unable to load POS data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Global Barcode Scanner Listener
  useEffect(() => {
    let barcodeBuffer = '';
    let lastKeyTime = Date.now();

    const handleKeyDown = (e) => {
      const currentTime = Date.now();
      
      // If typing is too slow (manual typing usually > 50ms per key), reset the buffer
      if (currentTime - lastKeyTime > 50) {
        barcodeBuffer = '';
      }
      lastKeyTime = currentTime;

      if (e.key === 'Enter') {
        if (barcodeBuffer.length > 3) {
          e.preventDefault(); // Prevent form submissions if focused on an input
          // Look for product by BARCODE or PRODUCT_CODE
          const scannedProduct = products.find(
            p => p.BARCODE === barcodeBuffer || p.PRODUCT_CODE === barcodeBuffer
          );
          
          if (scannedProduct) {
            addToCart(scannedProduct);
            // Optionally clear search term in case the scanner typed into the search box
            setSearchTerm('');
          } else {
            console.warn(`Barcode ${barcodeBuffer} not found in inventory.`);
          }
        }
        barcodeBuffer = '';
      } else if (e.key.length === 1) {
        // Append printable characters to buffer
        barcodeBuffer += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [products]);

  const getFilteredProducts = () => {
    let filtered = products;
    if (selectedCategory) {
      const matchingCategoryIds = categories
        .filter(c => c.CNAME?.trim().toLowerCase() === selectedCategory.CNAME?.trim().toLowerCase())
        .map(c => String(c.CATEGORY_ID));
      filtered = filtered.filter(p => matchingCategoryIds.includes(String(p.CATEGORY_ID)));
    }
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(p => 
        p.NAME?.toLowerCase().includes(term) ||
        p.PRODUCT_CODE?.toLowerCase().includes(term) ||
        p.BRAND?.toLowerCase().includes(term) ||
        p.MODEL?.toLowerCase().includes(term) ||
        p.BARCODE?.toLowerCase().includes(term)
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
              <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', gap: '0.5rem' }}>
                <span className="badge badge-warning" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }} title={product.PRODUCT_CODE}>{product.PRODUCT_CODE}</span>
                <span className={product.ON_HAND <= 0 ? "text-destructive font-bold" : "text-muted"} style={{ fontSize: '0.875rem', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {product.ON_HAND <= 0 ? 'Out of Stock' : `Stock: ${product.ON_HAND}`}
                </span>
              </div>
              
              <div style={{ width: '100%', height: '120px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.5rem' }}>
                {product.IMAGE_URL ? (
                  <img src={product.IMAGE_URL} alt={product.NAME} className="image-hover-zoom" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: '4px' }} />
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
      return [...prev, { ...product, quantity: 1, adjustment: 0, adjustmentInput: '' }];
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

  const updateItemAdjustmentInput = (id, val) => {
    setCart(prev => prev.map(item => item.PRODUCT_ID === id ? { ...item, adjustmentInput: val } : item));
  };

  const applyAdjustment = (id, isAdd) => {
    setCart(prev => prev.map(item => {
      if (item.PRODUCT_ID === id) {
        const val = Number(item.adjustmentInput) || 0;
        const currentAdj = Number(item.adjustment) || 0;
        return { 
          ...item, 
          adjustment: isAdd ? currentAdj + val : currentAdj - val,
          adjustmentInput: '' // clear after applying
        };
      }
      return item;
    }));
  };

  const removeFromCart = (id) => setCart(prev => prev.filter(item => item.PRODUCT_ID !== id));

  const handleSaveCustomer = async (e) => {
    e.preventDefault(); // Prevent form submission if triggered inside a form
    if (!newCustomer.FIRST_NAME || !newCustomer.LAST_NAME) {
      alert("First and Last name are required.");
      return;
    }
    setSavingCustomer(true);
    try {
      const { data, error } = await supabase.from('customer').insert([newCustomer]).select().single();
      if (error) throw error;
      setCustomers([...customers, data]);
      setCreditCustomerId(String(data.CUST_ID));
      setShowAddCustomer(false);
      setNewCustomer({ FIRST_NAME: '', LAST_NAME: '', PHONE_NUMBER: '', EMAIL: '', ADDRESS: '' });
    } catch (error) {
      alert("Failed to save customer: " + error.message);
    } finally {
      setSavingCustomer(false);
    }
  };

  // Calculations
  const subtotal = cart.reduce((acc, item) => acc + ((item.PRICE + (Number(item.adjustment) || 0)) * item.quantity), 0);
  const grandTotal = subtotal;

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

    if (paymentMethod === 'Credit' || paymentMethod === 'Invoice') {
      if (!creditCustomerId) {
        alert(`Please select a customer for this ${paymentMethod === 'Credit' ? 'Credit Sale' : 'Invoice'}.`);
        return;
      }
      if (paymentMethod === 'Credit' && !creditDueDate) {
        alert("Please select a Due Date for this Credit Sale.");
        return;
      }
    }

    let creditAccount = null;
    if (paymentMethod === 'Credit') {
      const { data: accData, error: accErr } = await supabase
        .from('credit_accounts')
        .select('*')
        .eq('customer_id', creditCustomerId)
        .single();
        
      if (accErr && accErr.code !== 'PGRST116') {
         alert('Error checking credit account: ' + accErr.message);
         return;
      }
      creditAccount = accData;
      
      if (!creditAccount) {
         alert('Customer does not have a credit account. Please onboard them in the Credit Docket first.');
         return;
      }
      if (creditAccount.status !== 'active') {
         alert(`Customer credit account is ${creditAccount.status}.`);
         return;
      }
      if (Number(creditAccount.current_balance) + grandTotal > Number(creditAccount.credit_limit)) {
         alert(`Credit limit exceeded! Current Balance: Ksh. ${creditAccount.current_balance}, Limit: Ksh. ${creditAccount.credit_limit}. Sale is Ksh. ${grandTotal}.`);
         return;
      }
    }

    setCheckingOut(true);

    try {
      if (paymentMethod === 'Invoice') {
        const selectedCustomer = customers.find(c => c.CUST_ID === parseInt(creditCustomerId));
        
        const { data: invData, error: invError } = await supabase.from('invoice').insert([{
          CUSTOMER_NAME: selectedCustomer ? `${selectedCustomer.FIRST_NAME} ${selectedCustomer.LAST_NAME}` : 'Walk-in',
          CUSTOMER_PHONE: selectedCustomer?.PHONE || '',
          CUSTOMER_ADDRESS: selectedCustomer?.ADDRESS || '',
          CUSTOMER_EMAIL: selectedCustomer?.EMAIL || '',
          NOTES: creditTerms || 'Generated from POS',
          SUBTOTAL: grandTotal,
          TAX_AMOUNT: 0,
          GRAND_TOTAL: grandTotal,
          STATUS: 'Pending',
          EMPLOYEE_ID: employeeId,
          BRANCH_ID: branchId === 'ALL' ? 1 : branchId
        }]).select().single();

        if (invError) throw invError;

        const details = cart.map(item => {
          const effectivePrice = item.PRICE + (Number(item.adjustment) || 0);
          return {
            INVOICE_ID: invData.INVOICE_ID,
            PRODUCT_ID: item.PRODUCT_ID,
            DESCRIPTION: formatItemName(item),
            QTY: item.quantity,
            UNIT_PRICE: effectivePrice,
            TOTAL_PRICE: effectivePrice * item.quantity
          };
        });

        await supabase.from('invoice_details').insert(details);

        await logAction({
          action: 'Created POS Invoice',
          details: `Invoice #${invData.INVOICE_ID} created via POS for Ksh. ${subtotal.toLocaleString()}`,
          severity: 'info',
          employeeId: employeeId
        });

        alert(`Success! Invoice #${invData.INVOICE_ID} created.`);
        
        setPrintInvoiceData({
          ...invData,
          invoice_details: details
        });

        setCart([]);
        setIsMobileCartOpen(false);
        setCreditCustomerId('');
        setShowAddCustomer(false);
        setCreditTerms('');
        setPaymentMethod('Cash');
        return;
      }

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
        SUBTOTAL: grandTotal,
        TAX_AMOUNT: 0,
        GRAND_TOTAL: grandTotal,
        DISCOUNT_AMOUNT: 0, // Baked into unit prices
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
        EMPLOYEE_ID: employeeId,
        BRANCH_ID: branchId === 'ALL' ? 1 : branchId
      }]).select().single();

      if (transErr) throw transErr;

      const details = cart.map(item => {
        const effectivePrice = item.PRICE + (Number(item.adjustment) || 0);
        return {
          TRANS_ID: transData.TRANS_ID,
          PRODUCT_ID: item.PRODUCT_ID,
          QTY: item.quantity,
          UNIT_PRICE: effectivePrice,
          SUBTOTAL: effectivePrice * item.quantity,
          BRANCH_ID: branchId === 'ALL' ? 1 : branchId
        };
      });

      const { error: detErr } = await supabase.from('transaction_details').insert(details);
      if (detErr) throw detErr;

      if (paymentMethod === 'Credit' && creditAccount) {
        const newBalance = Number(creditAccount.current_balance) + grandTotal;
        await supabase.from('credit_accounts').update({ current_balance: newBalance, updated_at: new Date().toISOString() }).eq('id', creditAccount.id);
        
        await supabase.from('credit_transactions').insert([{
           account_id: creditAccount.id,
           type: 'debit',
           amount: grandTotal,
           created_by: employeeId,
           reference_type: 'sale',
           reference_id: transData.TRANS_ID,
           notes: `Credit Sale #${transData.TRANS_ID.substring(0,8).toUpperCase()}`
        }]);
      }

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
      setShowAddCustomer(false);
      setCreditDueDate('');
      setCreditTerms('');
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
            className="cart-panel" 
            style={{ display: 'flex', flexDirection: 'column', background: '#ffffff', color: '#0f172a', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
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
            <style jsx global>{`
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
            @keyframes marquee {
              0% { transform: translateX(10%); }
              100% { transform: translateX(-100%); }
            }
            .marquee-container {
              overflow: hidden;
              white-space: nowrap;
              position: relative;
            }
            .marquee-content {
              display: inline-block;
              white-space: nowrap;
              padding-right: 10px;
            }
            .marquee-container:hover .marquee-content {
              animation: marquee 5s linear infinite;
            }
            .adj-btn-add {
              height: 18px;
              width: 100%;
              display: flex;
              align-items: center;
              justify-content: center;
              background: #ecfdf5;
              border: none;
              border-bottom: 1px solid #a7f3d0;
              cursor: pointer;
              font-size: 9px;
              color: #059669;
              font-weight: 700;
              text-transform: uppercase;
              transition: all 0.2s;
            }
            .adj-btn-add:hover {
              background: #d1fae5;
              color: #047857;
            }
            .adj-btn-deduct {
              height: 18px;
              width: 100%;
              display: flex;
              align-items: center;
              justify-content: center;
              background: #fef2f2;
              border: none;
              border-top: 1px solid #fecaca;
              cursor: pointer;
              font-size: 9px;
              color: #dc2626;
              font-weight: 700;
              text-transform: uppercase;
              transition: all 0.2s;
            }
            .adj-btn-deduct:hover {
              background: #fee2e2;
              color: #b91c1c;
            }
          }
        `}</style>
        <div style={{ padding: '1.25rem 1.5rem', background: '#0f172a', borderTopLeftRadius: '16px', borderTopRightRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 className="heading-2" style={{ margin: 0, color: '#ffffff' }}>Cart</h2>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {cart.length > 0 && (
              <>
                <button 
                  className="btn" 
                  style={{ padding: '0.4rem 1rem', fontSize: '0.875rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.375rem', background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.4)', borderRadius: '999px', transition: 'all 0.2s' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(59, 130, 246, 0.25)'; e.currentTarget.style.borderColor = '#60a5fa'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(59, 130, 246, 0.15)'; e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.4)'; }}
                  onClick={() => {
                    const quoteData = {
                      IS_QUOTE: true,
                      CREATED_AT: new Date().toISOString(),
                      CUSTOMER_NAME: paymentMethod === 'Credit' || paymentMethod === 'Invoice' ? (customers.find(c => c.CUST_ID === parseInt(creditCustomerId))?.FIRST_NAME || newCustomer.FIRST_NAME || 'Walk-in') : 'Walk-in',
                      SUBTOTAL: subtotal,
                      GRAND_TOTAL: grandTotal,
                      invoice_details: cart.map(item => {
                        const effectivePrice = item.PRICE + (Number(item.adjustment) || 0);
                        return {
                          DESCRIPTION: formatItemName(item),
                          QTY: item.quantity,
                          TOTAL_PRICE: (effectivePrice * (1 - (item.discount_percent || 0) / 100)) * item.quantity
                        };
                      })
                    };
                    setQuoteData(quoteData);
                    setShowQuoteModal(true);
                  }}
                >
                  <FileText size={16} /> Quote
                </button>
                <button 
                  className="btn" 
                  style={{ padding: '0.4rem 1rem', fontSize: '0.875rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.375rem', background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.4)', borderRadius: '999px', transition: 'all 0.2s' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.25)'; e.currentTarget.style.borderColor = '#f87171'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)'; e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.4)'; }}
                  onClick={() => setCart([])}
                >
                  <Trash2 size={16} /> Clear
                </button>
              </>
            )}
          </div>
        </div>

        <div className="cart-items-scroll" style={{ flex: '1 1 150px', minHeight: '150px', overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column' }}>
          {cart.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8' }}>
              <ShoppingCart size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
              <p>Cart is empty</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {cart.map(item => (
                <div key={item.PRODUCT_ID} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius)', border: '1px solid #e2e8f0', gap: '0.5rem' }}>
                  <div className="marquee-container" style={{ flex: 1, minWidth: '80px', fontWeight: 600, fontSize: '0.875rem' }} title={item.NAME}>
                    <div className={item.NAME.length > 20 ? "marquee-content" : ""} style={{ textOverflow: 'ellipsis', overflow: 'hidden' }}>{item.NAME}</div>
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.875rem', color: '#0f172a', whiteSpace: 'nowrap' }}>
                      Ksh. {(item.PRICE + (Number(item.adjustment) || 0)).toLocaleString()}
                    </span>

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '4px', overflow: 'hidden', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                      <button 
                        type="button"
                        onClick={() => applyAdjustment(item.PRODUCT_ID, true)}
                        style={{ height: '18px', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#ecfdf5', border: 'none', borderBottom: '1px solid #a7f3d0', cursor: 'pointer', fontSize: '9px', color: '#059669', fontWeight: 700, textTransform: 'uppercase', transition: 'all 0.2s' }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = '#d1fae5'; e.currentTarget.style.color = '#047857'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = '#ecfdf5'; e.currentTarget.style.color = '#059669'; }}
                      >add</button>
                      <input 
                        type="number" 
                        value={item.adjustmentInput || ''} 
                        onChange={(e) => updateItemAdjustmentInput(item.PRODUCT_ID, e.target.value)}
                        placeholder="0"
                        style={{ width: '50px', padding: '2px 0', border: 'none', textAlign: 'center', fontSize: '0.85rem', fontWeight: 600, color: '#334155', outline: 'none' }}
                      />
                      <button 
                        type="button"
                        onClick={() => applyAdjustment(item.PRODUCT_ID, false)}
                        style={{ height: '18px', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fef2f2', border: 'none', borderTop: '1px solid #fecaca', cursor: 'pointer', fontSize: '9px', color: '#dc2626', fontWeight: 700, textTransform: 'uppercase', transition: 'all 0.2s' }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = '#fee2e2'; e.currentTarget.style.color = '#b91c1c'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = '#fef2f2'; e.currentTarget.style.color = '#dc2626'; }}
                      >deduct</button>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <button className="btn btn-secondary" style={{ padding: '0', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => updateQuantity(item.PRODUCT_ID, -1)}>
                      <Minus size={12} />
                    </button>
                    <span style={{ width: '20px', textAlign: 'center', fontWeight: 600, fontSize: '0.875rem' }}>{item.quantity}</span>
                    <button className="btn btn-secondary" style={{ padding: '0', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => updateQuantity(item.PRODUCT_ID, 1)}>
                      <Plus size={12} />
                    </button>
                    <button className="btn btn-destructive" style={{ padding: '0', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: '0.25rem' }} onClick={() => removeFromCart(item.PRODUCT_ID)}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="payment-section-scroll" style={{ flex: '0 1 auto', overflowY: 'auto', padding: '1.5rem', background: '#f8fafc', borderTop: '1px solid #e2e8f0', borderBottomLeftRadius: '16px', borderBottomRightRadius: '16px', display: 'flex', flexDirection: 'column' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '1rem' }}>
            <span style={{ color: '#64748b' }}>Subtotal</span>
            <span style={{ fontWeight: 500 }}>Ksh. {subtotal.toLocaleString()}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px dashed #cbd5e1', fontSize: '1.75rem', fontWeight: 800, color: '#2563eb', letterSpacing: '-0.02em' }}>
            <span>Total</span>
            <span>Ksh. {grandTotal.toLocaleString()}</span>
          </div>
          
          {/* Payment Method Selector */}
          <div className="btn-group-mobile" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '0.5rem', marginBottom: '1.25rem' }}>
            <button className={`btn ${paymentMethod === 'Cash' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setPaymentMethod('Cash')} style={{ padding: '0.75rem' }}>Cash</button>
            <button className={`btn ${paymentMethod === 'M-Pesa' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setPaymentMethod('M-Pesa')} style={{ padding: '0.75rem', backgroundColor: paymentMethod === 'M-Pesa' ? '#25D366' : '', color: paymentMethod === 'M-Pesa' ? '#fff' : '' }}>M-Pesa</button>
            <button className={`btn ${paymentMethod === 'Hybrid' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setPaymentMethod('Hybrid')} style={{ padding: '0.75rem' }}>Hybrid</button>
            <button className={`btn ${paymentMethod === 'Credit' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setPaymentMethod('Credit')} style={{ padding: '0.75rem', backgroundColor: paymentMethod === 'Credit' ? '#f59e0b' : '', color: paymentMethod === 'Credit' ? '#fff' : '' }}>Credit</button>
            <button className={`btn ${paymentMethod === 'Invoice' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setPaymentMethod('Invoice')} style={{ padding: '0.75rem', backgroundColor: paymentMethod === 'Invoice' ? '#8b5cf6' : '', color: paymentMethod === 'Invoice' ? '#fff' : '' }}>Invoice</button>
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

          {(paymentMethod === 'Credit' || paymentMethod === 'Invoice') && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.25rem' }}>
              <select 
                className="input" 
                style={{ padding: '0.75rem' }} 
                value={showAddCustomer ? 'new' : creditCustomerId} 
                onChange={e => {
                  if (e.target.value === 'new') {
                    setShowAddCustomer(true);
                    setCreditCustomerId('');
                  } else {
                    setShowAddCustomer(false);
                    setCreditCustomerId(e.target.value);
                  }
                }}
              >
                <option value="" disabled>Select Customer...</option>
                <option value="new" style={{ fontWeight: 600, color: 'var(--primary)' }}>+ Add New Customer...</option>
                {customers.map(c => <option key={c.CUST_ID} value={c.CUST_ID}>{c.FIRST_NAME} {c.LAST_NAME}</option>)}
              </select>

              {customerOutstandingCredit !== null && customerOutstandingCredit > 0 && (
                <div style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', padding: '0.75rem 1rem', borderRadius: '8px', color: '#b45309', fontSize: '0.875rem', display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                  <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: '2px', color: '#f59e0b' }} />
                  <div>
                    <strong>Outstanding Balance: Ksh {customerOutstandingCredit.toLocaleString()}</strong><br/>
                    This customer currently has unpaid credit. Approving this transaction will bring their total debt to Ksh {(customerOutstandingCredit + grandTotal).toLocaleString()}.
                  </div>
                </div>
              )}

              {showAddCustomer && (
                <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.05)', borderRadius: 'var(--radius)', display: 'flex', flexDirection: 'column', gap: '0.75rem', border: '1px solid var(--border)' }}>
                  <h5 style={{ margin: 0, fontSize: '0.875rem', color: 'var(--primary)' }}>New Customer Details</h5>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input type="text" className="input" placeholder="First Name *" value={newCustomer.FIRST_NAME} onChange={e => setNewCustomer({...newCustomer, FIRST_NAME: e.target.value})} style={{ flex: 1, padding: '0.5rem' }} />
                    <input type="text" className="input" placeholder="Last Name *" value={newCustomer.LAST_NAME} onChange={e => setNewCustomer({...newCustomer, LAST_NAME: e.target.value})} style={{ flex: 1, padding: '0.5rem' }} />
                  </div>
                  <input type="text" className="input" placeholder="Phone Number" value={newCustomer.PHONE_NUMBER} onChange={e => setNewCustomer({...newCustomer, PHONE_NUMBER: e.target.value})} style={{ padding: '0.5rem' }} />
                  <button className="btn btn-secondary" onClick={handleSaveCustomer} disabled={savingCustomer} style={{ padding: '0.5rem', background: 'var(--primary)', color: 'white', border: 'none' }}>
                    {savingCustomer ? 'Saving...' : 'Save & Select Customer'}
                  </button>
                  <button className="btn" onClick={() => setShowAddCustomer(false)} style={{ padding: '0.25rem', background: 'transparent', color: 'var(--muted-foreground)', fontSize: '0.8rem', border: 'none' }}>
                    Cancel
                  </button>
                </div>
              )}
              
              {paymentMethod === 'Credit' && !showAddCustomer && (
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', display: 'block', marginBottom: '0.25rem' }}>Due Date</label>
                    <input type="date" className="input" style={{ padding: '0.75rem' }} value={creditDueDate} onChange={e => setCreditDueDate(e.target.value)} />
                  </div>
                </div>
              )}
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
              padding: '0.875rem 1rem', 
              fontSize: '1rem', 
              fontWeight: 600,
              borderRadius: '12px',
              backgroundColor: paymentMethod === 'M-Pesa' ? '#25D366' : paymentMethod === 'Credit' ? '#f59e0b' : paymentMethod === 'Invoice' ? '#8b5cf6' : 'var(--primary)',
              transition: 'all 0.2s ease',
              color: '#fff'
            }}
            disabled={cart.length === 0 || checkingOut}
            onClick={checkout}
          >
            {checkingOut ? <Loader2 size={20} className="animate-spin" /> : 
             paymentMethod === 'M-Pesa' ? <Smartphone size={20} /> : 
             paymentMethod === 'Credit' ? <Calendar size={20} /> : 
             paymentMethod === 'Invoice' ? <FileText size={20} /> : <CreditCard size={20} />}
            {checkingOut ? 'Processing...' : paymentMethod === 'Credit' ? 'Log Credit Sale' : paymentMethod === 'Invoice' ? 'Generate & Print Invoice' : `Pay Ksh. ${grandTotal.toLocaleString()}`}
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

      <AnimatePresence>
        {showQuoteModal && quoteData && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
          >
            <motion.div 
              id="quote-modal-content"
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              style={{ background: '#ffffff', color: '#0f172a', borderRadius: '1rem', width: '100%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', border: '1px solid #e2e8f0' }}
            >
              <div style={{ padding: '1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: '#ffffff', zIndex: 10 }}>
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#0f172a' }}>
                  <FileText size={20} color="#2563eb" /> Quotation Preview
                </h3>
                <button className="btn" style={{ background: 'transparent', padding: '0.5rem', color: '#64748b' }} onClick={() => setShowQuoteModal(false)}>
                  <X size={20} />
                </button>
              </div>
              
              <div style={{ padding: '1.5rem' }}>
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                  <h2 style={{ margin: '0 0 0.5rem 0', color: '#2563eb', fontSize: '1.5rem' }}>Jobea Auto Spares</h2>
                  <p style={{ margin: 0, color: '#64748b', fontSize: '0.875rem' }}>{new Date(quoteData.CREATED_AT).toLocaleString()}</p>
                  <p style={{ margin: '0.5rem 0 0 0', fontWeight: 500, color: '#0f172a' }}>Customer: {quoteData.CUSTOMER_NAME}</p>
                </div>
                
                <div style={{ borderTop: '1px dashed #cbd5e1', borderBottom: '1px dashed #cbd5e1', padding: '1rem 0', marginBottom: '1.5rem' }}>
                  {quoteData.invoice_details.map((item, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem', fontSize: '0.9rem' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, color: '#0f172a' }}>{item.DESCRIPTION}</div>
                        <div style={{ color: '#64748b', fontSize: '0.8rem' }}>Qty: {item.QTY}</div>
                      </div>
                      <div style={{ fontWeight: 700, paddingLeft: '1rem', color: '#0f172a' }}>
                        Ksh {item.TOTAL_PRICE.toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '1.25rem', fontWeight: 700, color: '#2563eb' }}>
                  <span>Total Estimate:</span>
                  <span>Ksh {quoteData.GRAND_TOTAL.toLocaleString()}</span>
                </div>
                
                <p style={{ textAlign: 'center', color: '#64748b', fontSize: '0.875rem', marginTop: '2rem', fontStyle: 'italic' }}>
                  This is a standalone quotation. Prices are subject to regular review.
                </p>
              </div>
              
              <div style={{ padding: '1.5rem', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', gap: '1rem' }} className="no-print">
                <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowQuoteModal(false)}>
                  Close
                </button>
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => { 
                  // Trigger print synchronously to avoid mobile WebView crashes.
                  window.print();
                }}>
                  <Printer size={18} style={{ marginRight: '0.5rem' }} /> Print Quote
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Synchronous Print Portal for Quote */}
      {showQuoteModal && quoteData && typeof document !== 'undefined' && createPortal(
        <div id="print-invoice-area">
          {printFormat === 'A4' ? (
            <InvoicePrint invoice={quoteData} items={quoteData.invoice_details} isQuote={true} />
          ) : (
            <ThermalInvoice invoice={quoteData} items={quoteData.invoice_details} isQuote={true} />
          )}
        </div>,
        document.body
      )}

      {/* Print Area Overlay */}
      {(printData || printInvoiceData) && typeof document !== 'undefined' && createPortal(
        <div id="print-invoice-area" style={{ position: 'fixed', inset: 0, background: 'white', zIndex: 99999, overflowY: 'auto' }}>
          <div className="print-action-bar" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', padding: '1rem', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', position: 'sticky', top: 0, zIndex: 10 }}>
            
            {printInvoiceData && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'white', padding: '0.25rem 0.5rem', borderRadius: '0.5rem', border: '1px solid var(--border)' }}>
                <label style={{ fontSize: '0.875rem', fontWeight: 500, color: '#64748b' }}>Format:</label>
                <select className="input" style={{ border: 'none', padding: '0.25rem 2rem 0.25rem 0.5rem', height: 'auto', background: 'transparent', color: '#0f172a' }} value={printFormat} onChange={e => setPrintFormat(e.target.value)}>
                  <option value="THERMAL" style={{ color: '#0f172a' }}>Thermal Roll (80mm)</option>
                  <option value="A4" style={{ color: '#0f172a' }}>Standard Sheet (A4)</option>
                </select>
              </div>
            )}

            <button className="btn btn-secondary" onClick={() => { setPrintData(null); setPrintInvoiceData(null); document.body.classList.remove('printing-invoice'); }}>
              <X size={18} /> Close Preview
            </button>
            <button className="btn btn-primary" onClick={() => window.print()}>
              <Printer size={18} /> Print Again
            </button>
          </div>
          
          <style jsx global>{`
            @media print {
              .print-action-bar { display: none !important; }
            }
          `}</style>

          <div style={{ display: 'flex', justifyContent: 'center', padding: (printInvoiceData && printFormat === 'A4') ? '2rem' : '0' }}>
            {printData && (
              <Receipt 
                transaction={printData.transaction} 
                cart={printData.cart} 
                subtotal={printData.subtotal} 
                grandTotal={printData.grandTotal} 
              />
            )}

            {printInvoiceData && printFormat === 'THERMAL' && (
              <ThermalInvoice invoice={printInvoiceData} items={printInvoiceData.invoice_details} isQuote={printInvoiceData.IS_QUOTE} />
            )}

            {printInvoiceData && printFormat === 'A4' && (
              <div style={{ width: '100%', maxWidth: '210mm', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)' }}>
                <InvoicePrint invoice={printInvoiceData} items={printInvoiceData.invoice_details} isQuote={printInvoiceData.IS_QUOTE} />
              </div>
            )}
          </div>
        </div>
      , document.body)}

    </div>
  );
}
