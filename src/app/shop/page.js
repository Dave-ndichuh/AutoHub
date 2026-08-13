'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Search, ShoppingCart, X, Plus, Minus, MessageCircle, Palette, ShieldCheck, Truck, ArrowRight, Filter } from 'lucide-react';
import { getStoreCatalog, getCategories } from '@/actions/storefront';
import { useTheme } from '@/context/ThemeContext';

export default function ShopPage() {
  const { theme, changeTheme } = useTheme();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [activeCategory, setActiveCategory] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState('images-first');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;
  
  const [cart, setCart] = useState([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const categoryData = await getCategories();
      const productData = await getStoreCatalog();
      if (categoryData) setCategories(categoryData);
      if (productData) setProducts(productData);
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  const addToCart = (product) => {
    setCart(prev => {
      const existing = prev.find(item => item.PRODUCT_ID === product.PRODUCT_ID);
      if (existing) {
        return prev.map(item => item.PRODUCT_ID === product.PRODUCT_ID 
          ? { ...item, cartQty: item.cartQty + 1 } 
          : item
        );
      }
      return [...prev, { ...product, cartQty: 1 }];
    });
    setIsCartOpen(true);
  };

  const updateCartQty = (productId, delta) => {
    setCart(prev => {
      return prev.map(item => {
        if (item.PRODUCT_ID === productId) {
          const newQty = Math.max(1, item.cartQty + delta);
          return { ...item, cartQty: newQty };
        }
        return item;
      });
    });
  };

  const removeFromCart = (productId) => {
    setCart(prev => prev.filter(item => item.PRODUCT_ID !== productId));
  };

  const cartTotal = cart.reduce((sum, item) => sum + (Number(item.PRICE) * item.cartQty), 0);
  const cartCount = cart.reduce((sum, item) => sum + item.cartQty, 0);

  const handleCheckout = () => {
    const agentNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '254725599999';
    let messageText = `*Hello Jobea Auto Spares!*\nI would like to inquire about the following items from the store:\n\n`;
    
    cart.forEach((item, index) => {
      messageText += `${index + 1}. *${item.NAME}*`;
      if (item.BRAND) messageText += ` (${item.BRAND})`;
      messageText += `\n   Qty: ${item.cartQty} x Ksh ${Number(item.PRICE).toLocaleString()}`;
      if (item.IMAGE_URL) messageText += `\n   See what I need ➡️ ${item.IMAGE_URL}`;
      messageText += `\n\n`;
    });
    
    messageText += `*Total Estimate:* Ksh ${cartTotal.toLocaleString()}\n\n`;
    messageText += `_Is this price negotiable? Let me know your best offer and availability._`;

    const whatsappUrl = `https://wa.me/${agentNumber}?text=${encodeURIComponent(messageText)}`;
    window.open(whatsappUrl, '_blank');
  };

  const filteredProducts = products.filter(p => {
    const matchesCat = activeCategory === 'ALL' || p.CATEGORY_ID === activeCategory;
    const matchesSearch = p.NAME?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          p.DESCRIPTION?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  // Effect to handle category/search change and reset page
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, activeCategory, sortOption]);

  // Apply sorting and pagination
  const sortedProducts = [...filteredProducts].sort((a, b) => {
    if (sortOption === 'price-asc') return Number(a.PRICE) - Number(b.PRICE);
    if (sortOption === 'price-desc') return Number(b.PRICE) - Number(a.PRICE);
    if (sortOption === 'name-asc') return a.NAME.localeCompare(b.NAME);
    if (sortOption === 'name-desc') return b.NAME.localeCompare(a.NAME);
    // 'images-first' or default: products with images come first
    if (a.IMAGE_URL && !b.IMAGE_URL) return -1;
    if (!a.IMAGE_URL && b.IMAGE_URL) return 1;
    return a.NAME.localeCompare(b.NAME);
  });

  const totalPages = Math.ceil(sortedProducts.length / itemsPerPage);
  const paginatedProducts = sortedProducts.slice(
    (currentPage - 1) * itemsPerPage, 
    currentPage * itemsPerPage
  );

  // Extract featured products for the hero carousel (first 5 with images)
  const heroCarouselProducts = products.filter(p => p.IMAGE_URL).slice(0, 5);
  const carouselItems = [...heroCarouselProducts, ...heroCarouselProducts]; // Duplicate for seamless scroll

  return (
    <div style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', background: 'var(--deep)', padding: '0 1rem' }}>
      <div style={{ display: 'flex', flexDirection: 'column', width: '100%', maxWidth: '1600px', height: '100vh', background: 'var(--background)', overflow: 'hidden', borderLeft: '1px solid var(--border)', borderRight: '1px solid var(--border)', boxShadow: '0 0 40px rgba(0,0,0,0.5)', position: 'relative' }}>
      <style dangerouslySetInnerHTML={{__html: `
        .bc-card {
          position: relative;
          border: 1px solid var(--border);
          border-radius: 12px;
          overflow: hidden;
          background: var(--card);
          transition: all 0.3s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          aspect-ratio: 1 / 1;
        }
        .bc-card:hover {
          border-color: var(--primary);
        }
        .bc-card .product-img {
          transition: transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
          width: 80%;
          height: 80%;
          object-fit: contain;
        }
        .bc-card:hover .product-img {
          transform: scale(1.1);
        }
        .bc-pill {
          position: absolute;
          bottom: 1.5rem;
          left: 50%;
          transform: translateX(-50%);
          background: var(--card);
          border: 1px solid var(--border);
          padding: 0.5rem 1rem;
          border-radius: 99px;
          display: flex;
          align-items: center;
          gap: 0.75rem;
          box-shadow: 0 10px 30px rgba(0,0,0,0.3);
          backdrop-filter: blur(8px);
          white-space: nowrap;
          transition: all 0.3s ease;
          width: 85%;
        }
        .bc-card:hover .bc-pill {
          background: var(--primary);
          border-color: var(--primary);
          color: white;
        }
        .bc-card:hover .pill-price {
          background: rgba(255,255,255,0.2) !important;
          color: white !important;
        }
        .pill-title-container {
          flex: 1;
          overflow: hidden;
          white-space: nowrap;
          -webkit-mask-image: linear-gradient(to right, black 85%, transparent 100%);
          mask-image: linear-gradient(to right, black 85%, transparent 100%);
        }
        .pill-title-track {
          display: inline-block;
          white-space: nowrap;
        }
        .bc-card:hover .pill-title-track {
          animation: scroll-title 8s linear infinite;
        }
        @keyframes scroll-title {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .pill-title {
          font-weight: 600;
          font-size: 0.875rem;
          display: inline-block;
        }
        .pill-price {
          background: rgba(255,255,255,0.1);
          padding: 0.25rem 0.5rem;
          border-radius: 99px;
          font-size: 0.875rem;
          font-weight: 700;
          transition: all 0.3s ease;
        }
        
        /* Hide Scrollbar */
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        
        /* Hero Carousel Animation */
        @keyframes scroll-carousel {
          0% { transform: translateX(0); }
          100% { transform: translateX(calc(-50% - 1rem)); } 
        }
        .hero-carousel-container {
          display: flex;
          overflow: hidden;
          width: 100%;
          padding: 2rem 0;
          position: relative;
        }
        .hero-carousel-container:hover .hero-carousel-track {
          animation-play-state: paused;
        }
        .hero-carousel-track {
          display: flex;
          gap: 2rem;
          width: max-content;
          animation: scroll-carousel 40s linear infinite;
        }
        
        /* Marquee Animation */
        @keyframes scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .marquee-container {
          display: flex;
          overflow: hidden;
          background: rgba(255,255,255,0.03);
          border-top: 1px solid var(--border);
          border-bottom: 1px solid var(--border);
          padding: 1rem 0;
          white-space: nowrap;
        }
        .marquee-content {
          display: flex;
          animation: scroll 30s linear infinite;
        }
        .marquee-item {
          font-size: 1.5rem;
          font-weight: 800;
          text-transform: uppercase;
          margin: 0 2rem;
          color: transparent;
          -webkit-text-stroke: 1px var(--muted-foreground);
        }
        
        /* Layout Grid */
        .shop-layout {
          display: block;
          padding: 2rem;
          width: 100%;
        }
        @media (max-width: 768px) {
          .shop-layout {
            grid-template-columns: 1fr;
          }
          .sidebar {
            display: none;
          }
        }
      `}} />

      {/* Modern Header */}
      <div style={{ position: 'sticky', top: '1rem', zIndex: 40, padding: '0 1rem', width: '100%' }}>
        <header style={{ background: 'var(--hf-bg)', border: '1px solid var(--hf-border)', borderRadius: '16px', padding: '1rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 10px 30px rgba(0,0,0,0.15)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <img src="/logo.png" alt="Jobea Logo" style={{ height: '40px', objectFit: 'contain' }} />
          <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--hf-text)' }}>
            Jobea Autospares
          </h1>
        </div>

        {/* Inline Trust Badges */}
        <div className="hidden lg:flex" style={{ display: 'flex', flex: 1, flexDirection: 'row', justifyContent: 'space-evenly', alignItems: 'center', padding: '0 2rem', fontSize: '0.875rem', color: 'var(--hf-muted)' }}>
          <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '0.5rem' }}>
            <ShieldCheck size={18} className="text-primary" /> <span style={{ fontWeight: 600 }}>Genuine Parts</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '0.5rem' }}>
            <MessageCircle size={18} className="text-primary" /> <span style={{ fontWeight: 600 }}>WhatsApp Checkout</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '0.5rem' }}>
            <Truck size={18} className="text-primary" /> <span style={{ fontWeight: 600 }}>Fast Delivery</span>
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
          
          {/* Categories / Filter Button */}
          <button 
            onClick={() => setIsFilterOpen(true)}
            className="btn"
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderRadius: '8px', padding: '0.5rem 1rem', background: 'transparent', border: '1px solid var(--hf-border)', color: 'var(--hf-text)', cursor: 'pointer' }}
          >
            <Filter size={18} />
            <span style={{ fontWeight: 600 }}>Categories & Filters</span>
          </button>

          {/* Search Bar */}
          <div className="hidden md:flex" style={{ position: 'relative' }}>
            <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--hf-muted)' }} />
            <input 
              type="text" 
              placeholder="Search parts..." 
              className="input" 
              style={{ paddingLeft: '2.5rem', width: '300px', background: 'transparent', border: '1px solid var(--hf-border)', borderRadius: '8px', color: 'var(--hf-text)' }}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          
          {/* Theme Switcher from Dashboard */}
          <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center', background: 'rgba(0,0,0,0.05)', padding: '0.25rem', borderRadius: '99px', border: '1px solid var(--hf-border)' }}>
            <Palette size={14} style={{ margin: '0 0.25rem', color: 'var(--hf-muted)' }} />
            {['midnight', 'ocean', 'forest', 'sunset'].map(t => (
              <button 
                key={t}
                onClick={() => changeTheme(t)}
                style={{ 
                  width: '20px', height: '20px', borderRadius: '50%', cursor: 'pointer',
                  background: t === 'midnight' ? '#0f172a' : t === 'ocean' ? '#083344' : t === 'forest' ? '#022c22' : '#2e1065',
                  border: theme === t ? `2px solid ${t === 'midnight' ? '#3b82f6' : t === 'ocean' ? '#06b6d4' : t === 'forest' ? '#10b981' : '#f97316'}` : '1px solid rgba(0,0,0,0.1)'
                }}
                title={t}
              />
            ))}
          </div>

          <button 
            style={{ position: 'relative', background: 'transparent', border: 'none', color: 'var(--hf-text)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
            onClick={() => setIsCartOpen(true)}
          >
            <ShoppingCart size={24} />
            {cartCount > 0 && (
              <span style={{ position: 'absolute', top: '-8px', right: '-8px', background: 'var(--primary)', color: 'white', borderRadius: '50%', width: '20px', height: '20px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                {cartCount}
              </span>
            )}
          </button>
        </div>
      </header>
      </div>

      {/* Scrollable Main Content Area */}
      <div className="no-scrollbar" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', paddingTop: '80px' }}>

        {/* Hero Section Carousel */}
      {!loading && heroCarouselProducts.length > 0 && searchQuery === '' && activeCategory === 'ALL' && (
        <div className="hero-carousel-container" style={{ padding: '0 2rem', flexShrink: 0 }}>
          <div className="hero-carousel-track">
            {carouselItems.map((product, idx) => (
              <div 
                key={`${product.PRODUCT_ID}-${idx}`} 
                className="bc-card" 
                style={{ width: '400px', height: '400px', flexShrink: 0 }} 
                onClick={() => addToCart(product)}
              >
                 <img className="product-img" src={product.IMAGE_URL} alt={product.NAME} style={{ width: '70%', height: '70%', objectFit: 'contain' }} />
                 <div className="bc-pill" style={{ width: '85%' }}>
                    <div className="pill-title-container">
                      <div className="pill-title-track">
                        <span className="pill-title" style={{ paddingRight: '3rem' }}>{product.NAME}</span>
                        <span className="pill-title" style={{ paddingRight: '3rem' }}>{product.NAME}</span>
                      </div>
                    </div>
                    <span className="pill-price">Ksh {Number(product.PRICE).toLocaleString()}</span>
                 </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Marquee Banner */}
      <div className="marquee-container" style={{ flexShrink: 0 }}>
        <div className="marquee-content">
          {[...Array(6)].map((_, i) => (
            <div key={i} style={{ display: 'flex' }}>
              <span className="marquee-item">GENUINE AUTO SPARES</span>
              <span className="marquee-item" style={{ WebkitTextStroke: '0', color: 'var(--primary)' }}>⚡</span>
              <span className="marquee-item">NATIONWIDE DELIVERY</span>
              <span className="marquee-item" style={{ WebkitTextStroke: '0', color: 'var(--primary)' }}>⚡</span>
            </div>
          ))}
        </div>
      </div>

      {/* Main Layout (Grid Only) */}
      <main className="shop-layout">
        
        {/* Product Grid */}
        <section>

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
              <div className="animate-fade-in text-muted">Loading catalog...</div>
            </div>
          ) : (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
                {paginatedProducts.map(product => (
                  <div key={product.PRODUCT_ID} className="bc-card" onClick={() => addToCart(product)}>
                    {product.IMAGE_URL ? (
                      <img loading="lazy" className="product-img" src={product.IMAGE_URL} alt={product.NAME} onError={(e) => { e.target.style.display = 'none'; }} />
                    ) : (
                      <div className="product-img" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted-foreground)' }}>No Image</div>
                    )}
                    
                    {/* Floating Pill Overlay */}
                    <div className="bc-pill">
                      <div className="pill-title-container">
                        <div className="pill-title-track">
                          <span className="pill-title" style={{ paddingRight: '3rem' }}>{product.NAME}</span>
                          <span className="pill-title" style={{ paddingRight: '3rem' }}>{product.NAME}</span>
                        </div>
                      </div>
                      <span className="pill-price">Ksh {Number(product.PRICE).toLocaleString()}</span>
                    </div>
                    
                    {/* Add to Cart Hover Icon */}
                    <div className="add-icon" style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '50%', padding: '0.5rem', opacity: 0.8 }}>
                      <Plus size={16} />
                    </div>
                  </div>
                ))}
                
                {paginatedProducts.length === 0 && (
                  <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '4rem', color: 'var(--muted-foreground)', border: '1px dashed var(--border)', borderRadius: '12px' }}>
                    No products found matching your criteria.
                  </div>
                )}
              </div>
              
              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', marginTop: '2rem', paddingBottom: '2rem' }}>
                  <button 
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="btn btn-secondary"
                    style={{ padding: '0.5rem 1rem', borderRadius: '8px', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', opacity: currentPage === 1 ? 0.5 : 1 }}
                  >
                    Previous
                  </button>
                  
                  <span style={{ fontWeight: 600, color: 'var(--foreground)' }}>
                    Page {currentPage} of {totalPages}
                  </span>

                  <button 
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="btn btn-secondary"
                    style={{ padding: '0.5rem 1rem', borderRadius: '8px', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', opacity: currentPage === totalPages ? 0.5 : 1 }}
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          )}
        </section>
      </main>
      </div> {/* End Scrollable Area */}

      {/* Locked Footer */}
      <div style={{ padding: '0 1rem 1rem 1rem', width: '100%', flexShrink: 0, zIndex: 40 }}>
      <footer style={{ padding: '1.5rem 2rem', background: 'var(--hf-bg)', border: '1px solid var(--hf-border)', borderRadius: '16px', boxShadow: '0 -4px 30px rgba(0,0,0,0.1)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          
          <div style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
            <div>
              <h3 style={{ fontSize: '1.125rem', fontWeight: 700, margin: 0, color: 'var(--hf-text)' }}>Jobea Autospares</h3>
            </div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', gap: '1.5rem', fontSize: '0.875rem' }}>
              <li><Link href="/about" style={{ color: 'var(--hf-muted)', textDecoration: 'none' }}>About Us</Link></li>
              <li><Link href="/contact" style={{ color: 'var(--hf-muted)', textDecoration: 'none' }}>Contact Us</Link></li>
              <li><span style={{ color: 'var(--hf-muted)' }}>Tel: 0725599999</span></li>
            </ul>
          </div>
          
          <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', color: 'var(--hf-muted)', fontSize: '0.875rem' }}>
            <span>&copy; {new Date().getFullYear()} Jobea Autospares</span>
          </div>
          
        </div>
      </footer>
      </div>

      {/* Filter Drawer Overlay */}
      {isFilterOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex' }}>
          <div 
            style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
            onClick={() => setIsFilterOpen(false)}
          />
          
          <div className="glass" style={{ position: 'relative', width: '350px', height: '100%', display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--border)', animation: 'slide-in-left 0.3s ease-out' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.5rem', borderBottom: '1px solid var(--border)' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Filter size={20} />
                Filters
              </h2>
              <button onClick={() => setIsFilterOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--foreground)', cursor: 'pointer' }}>
                <X size={24} />
              </button>
            </div>
            
            <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
              {/* Sort By */}
              <h3 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--foreground)' }}>Sort By</h3>
              <select 
                className="input" 
                style={{ width: '100%', padding: '0.75rem', background: 'var(--background)', border: '1px solid var(--border)', borderRadius: '8px', cursor: 'pointer', marginBottom: '2.5rem' }}
                value={sortOption}
                onChange={(e) => {
                  setSortOption(e.target.value);
                  setIsFilterOpen(false);
                }}
              >
                <option value="images-first" style={{ background: 'var(--card)' }}>Recommended</option>
                <option value="price-asc" style={{ background: 'var(--card)' }}>Price: Low to High</option>
                <option value="price-desc" style={{ background: 'var(--card)' }}>Price: High to Low</option>
                <option value="name-asc" style={{ background: 'var(--card)' }}>Name: A-Z</option>
                <option value="name-desc" style={{ background: 'var(--card)' }}>Name: Z-A</option>
              </select>

              {/* Categories */}
              <h3 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--foreground)' }}>Categories</h3>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <li>
                  <button 
                    onClick={() => {
                      setActiveCategory('ALL');
                      setIsFilterOpen(false);
                    }}
                    style={{ background: activeCategory === 'ALL' ? 'var(--primary)' : 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px', width: '100%', textAlign: 'left', padding: '0.75rem 1rem', color: activeCategory === 'ALL' ? 'white' : 'var(--foreground)', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}
                  >
                    All Products
                  </button>
                </li>
                {categories.map(cat => (
                  <li key={cat.CATEGORY_ID}>
                    <button 
                      onClick={() => {
                        setActiveCategory(cat.CATEGORY_ID);
                        setIsFilterOpen(false);
                      }}
                      style={{ background: activeCategory === cat.CATEGORY_ID ? 'var(--primary)' : 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px', width: '100%', textAlign: 'left', padding: '0.75rem 1rem', color: activeCategory === cat.CATEGORY_ID ? 'white' : 'var(--foreground)', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}
                    >
                      {cat.CNAME}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Cart Drawer Overlay */}
      {isCartOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }} onClick={() => setIsCartOpen(false)} />
          
          <div className="glass" style={{ width: '100%', maxWidth: '400px', height: '100vh', position: 'relative', display: 'flex', flexDirection: 'column', borderLeft: '1px solid var(--border)', background: 'var(--background)', animation: 'fadeIn 0.3s ease-out' }}>
            
            <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 className="heading-2" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ShoppingCart size={24} className="text-primary" /> Your Cart
              </h2>
              <button onClick={() => setIsCartOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--muted-foreground)', cursor: 'pointer' }}>
                <X size={24} />
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {cart.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--muted-foreground)', marginTop: '2rem' }}>
                  Your cart is empty.
                </div>
              ) : (
                cart.map(item => (
                  <div key={item.PRODUCT_ID} style={{ display: 'flex', gap: '1rem', background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border)' }}>
                    <div style={{ width: '60px', height: '60px', borderRadius: '8px', background: 'rgba(0,0,0,0.2)', position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
                      {item.IMAGE_URL && <img src={item.IMAGE_URL} alt={item.NAME} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '4px' }} />}
                    </div>
                    
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontWeight: 600 }}>{item.NAME}</span>
                        <button onClick={() => removeFromCart(item.PRODUCT_ID)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--destructive)' }}>
                          <X size={16} />
                        </button>
                      </div>
                      <span style={{ color: 'var(--primary)', fontWeight: 600 }}>Ksh {Number(item.PRICE).toLocaleString()}</span>
                      
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: 'auto', paddingTop: '0.5rem' }}>
                        <button onClick={() => updateCartQty(item.PRODUCT_ID, -1)} style={{ cursor: 'pointer', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '4px', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--foreground)' }}>
                          <Minus size={14} />
                        </button>
                        <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>{item.cartQty}</span>
                        <button onClick={() => updateCartQty(item.PRODUCT_ID, 1)} style={{ cursor: 'pointer', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '4px', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--foreground)' }}>
                          <Plus size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {cart.length > 0 && (
              <div style={{ padding: '1.5rem', borderTop: '1px solid var(--border)', background: 'rgba(0,0,0,0.2)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem', fontSize: '1.25rem', fontWeight: 700 }}>
                  <span>Total</span>
                  <span style={{ color: 'var(--primary)' }}>Ksh {cartTotal.toLocaleString()}</span>
                </div>
                
                <button 
                  className="btn btn-primary" 
                  style={{ width: '100%', padding: '1rem', fontSize: '1.125rem', display: 'flex', justifyContent: 'center', gap: '0.5rem', background: '#25D366', cursor: 'pointer' }}
                  onClick={handleCheckout}
                >
                  <MessageCircle size={20} />
                  Checkout via WhatsApp
                </button>
                <p style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--muted-foreground)', marginTop: '0.75rem' }}>
                  You will be routed to an online agent to finalize negotiation and payment.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
      </div> {/* End unified container */}
    </div>
  );
}
