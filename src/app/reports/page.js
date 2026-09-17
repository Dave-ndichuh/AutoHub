'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { BarChart3, TrendingUp, AlertCircle, PackageSearch, Download, DollarSign, Calendar, RefreshCcw, Phone, CreditCard, FileText, Search, ChevronDown, X } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell } from 'recharts';
import { formatItemName } from '@/utils/formatters';
import { useAuth } from '@/components/AuthGuard';

export default function ReportsPage() {
  const { branchId } = useAuth();
  const [loading, setLoading] = useState(true);
  
  // Custom Date Range
  const [periodPreset, setPeriodPreset] = useState('This Month'); // Today, Last 7 Days, This Month, Last Month, Custom
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [metrics, setMetrics] = useState({
    totalSales: 0,
    grossProfit: 0,
    profitMargin: 0,
    transactionCount: 0,
    atv: 0,
    stockValue: 0
  });
  
  const [topProducts, setTopProducts] = useState([]);
  const [deadStock, setDeadStock] = useState([]);
  const [categoryData, setCategoryData] = useState([]);
  const [rawTransactions, setRawTransactions] = useState([]);
  
  const [selectedCreditCustomerId, setSelectedCreditCustomerId] = useState('');
  const [dailyCreditSales, setDailyCreditSales] = useState([]);
  const [creditAccounts, setCreditAccounts] = useState([]);
  const [selectedCustomerHistory, setSelectedCustomerHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [creditSearchTerm, setCreditSearchTerm] = useState('');
  const [isCreditDropdownOpen, setIsCreditDropdownOpen] = useState(false);
  const [selectedProductForModal, setSelectedProductForModal] = useState(null);
  const [loadingProductDetails, setLoadingProductDetails] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsCreditDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);


  const fetchAndShowProduct = async (productId) => {
    if (!productId) return;
    setSelectedProductForModal({ loading: true });
    setLoadingProductDetails(true);
    const { data } = await supabase
      .from('product')
      .select('*')
      .eq('PRODUCT_ID', productId)
      .single();
      
    if (data) {
      setSelectedProductForModal(data);
    } else {
      setSelectedProductForModal(null);
    }
    setLoadingProductDetails(false);
  };

  // Handle Preset changes
  useEffect(() => {
    const today = new Date();
    let start = new Date();
    let end = new Date();
    
    if (periodPreset === 'Today') {
      // already today
    } else if (periodPreset === 'Last 7 Days') {
      start.setDate(today.getDate() - 6);
    } else if (periodPreset === 'This Month') {
      start = new Date(today.getFullYear(), today.getMonth(), 1);
    } else if (periodPreset === 'Last Month') {
      start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      end = new Date(today.getFullYear(), today.getMonth(), 0);
    } else if (periodPreset === 'Custom') {
      return; // Do nothing, let user select
    }

    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);
  }, [periodPreset]);

  const fetchAnalytics = async () => {
    if (!startDate || !endDate) return;
    setLoading(true);
    
    // Convert local bounds to UTC for accurate Supabase querying
    const startDateTime = new Date(`${startDate}T00:00:00`).toISOString();
    const endDateTime = new Date(`${endDate}T23:59:59.999`).toISOString();

    // 1. Fetch Transactions
    let transQuery = supabase
      .from('transaction')
      .select(`
        *,
        transaction_details (
          PRODUCT_ID,
          QTY,
          UNIT_PRICE,
          product (NAME, BRAND, PRODUCT_CODE, COST_PRICE, CATEGORY_ID, ON_HAND, category(CNAME))
        )
      `)
      .gte('CREATED_AT', startDateTime)
      .lte('CREATED_AT', endDateTime)
      .or('IS_CREDIT.eq.false,IS_SETTLED.eq.true');

    if (branchId && branchId !== 'ALL') {
      transQuery = transQuery.eq('BRANCH_ID', branchId);
    }

    const { data: transData } = await transQuery;

    // 2. Fetch All Products (for dead stock and total stock value)
    let prodQuery = supabase
      .from('product')
      .select(`*, category(CNAME)`);

    if (branchId && branchId !== 'ALL') {
      prodQuery = prodQuery.eq('BRANCH_ID', branchId);
    }
    
    const { data: prodData } = await prodQuery;

    let tSales = 0;
    let tCost = 0;
    let tCount = 0;
    
    const productStats = {}; // { ID: { name, category, qty, revenue, profit } }
    const catStats = {}; // { categoryName: revenue }
    
    // Process All Products mapping
    const allProductsMap = {};
    let totalStockVal = 0;

    if (prodData) {
      prodData.forEach(p => {
        allProductsMap[p.PRODUCT_ID] = p;
        totalStockVal += (Number(p.ON_HAND) || 0) * (Number(p.COST_PRICE) || 0);
      });
    }

    if (transData) {
      setRawTransactions(transData);
      transData.forEach(t => {
        // Locally filter out reversed transactions to prevent DB crashes if column is missing
        if (t.status === 'Reversed') return;

        // Skip purely voided or 0-value returns that shouldn't inflate counts
        const grandTotal = Number(t.ADJUSTED_TOTAL) || Number(t.GRAND_TOTAL) || 0;
        if (grandTotal === 0 && (t.PAYMENT_METHOD === 'Returned' || t.PAYMENT_METHOD === 'Void')) return;

        tCount++;
        const saleTotal = grandTotal;
        tSales += saleTotal;

        if (t.transaction_details) {
          t.transaction_details.forEach(d => {
            const cost = Number(d.product?.COST_PRICE) || 0;
            const price = Number(d.UNIT_PRICE) || 0;
            const qty = Number(d.QTY) || 0;
            const rev = price * qty;
            const prof = (price - cost) * qty;
            
            tCost += (cost * qty);

            const pId = d.PRODUCT_ID;
            const cName = d.product?.category?.CNAME || 'Uncategorized';

            if (!productStats[pId]) {
              productStats[pId] = { 
                name: formatItemName(d.product), 
                category: cName,
                qty: 0, revenue: 0, profit: 0 
              };
            }
            productStats[pId].qty += qty;
            productStats[pId].revenue += rev;
            productStats[pId].profit += prof;

            if (!catStats[cName]) catStats[cName] = 0;
            catStats[cName] += rev;
          });
        }
      });
    }

    const grossProfit = tSales - tCost;
    const profitMargin = tSales > 0 ? (grossProfit / tSales) * 100 : 0;
    const atv = tCount > 0 ? tSales / tCount : 0;

    // Top Products by Revenue
    const sortedProducts = Object.values(productStats)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 50);

    // Dead Stock (0 sales, ON_HAND > 10)
    const dead = [];
    if (prodData) {
      prodData.forEach(p => {
        if (p.ON_HAND > 10 && !productStats[p.PRODUCT_ID]) {
          dead.push(p);
        }
      });
    }
    // Sort dead stock by Highest Value (ON_HAND * COST_PRICE)
    dead.sort((a, b) => (b.ON_HAND * b.COST_PRICE) - (a.ON_HAND * a.COST_PRICE));

    // Category Chart Data
    const cData = Object.keys(catStats).map(k => ({
      name: k,
      Revenue: catStats[k]
    })).sort((a, b) => b.Revenue - a.Revenue).slice(0, 10); // Top 10 categories

    setMetrics({ 
      totalSales: tSales, 
      grossProfit, 
      profitMargin, 
      transactionCount: tCount,
      atv,
      stockValue: totalStockVal
    });
    setTopProducts(sortedProducts);
    setDeadStock(dead.slice(0, 50)); // Limit to top 50 worst offenders
    setCategoryData(cData);
    
    setLoading(false);
  };

  const fetchDailyCreditSales = async () => {
    // Fetch today's credit transactions
    const todayStr = new Date().toISOString().split('T')[0];
    const startDateTime = new Date(`${todayStr}T00:00:00`).toISOString();
    const endDateTime = new Date(`${todayStr}T23:59:59.999`).toISOString();

    let query = supabase
      .from('transaction')
      .select(`
        *,
        customer (FIRST_NAME, LAST_NAME, PHONE_NUMBER),
        transaction_details (
          QTY,
          UNIT_PRICE,
          product (NAME, BRAND)
        )
      `)
      .eq('IS_CREDIT', true)
      .gte('CREATED_AT', startDateTime)
      .lte('CREATED_AT', endDateTime);
      
    if (branchId && branchId !== 'ALL') {
      query = query.eq('BRANCH_ID', branchId);
    }

    const { data } = await query;
    if (data) {
      // Group by customer
      const grouped = {};
      data.forEach(t => {
        const custId = t.CREDIT_CUSTOMER_ID;
        if (!custId) return;
        if (!grouped[custId]) {
          grouped[custId] = {
            customerId: custId,
            customer: t.customer,
            totalCredit: 0,
            items: []
          };
        }
        grouped[custId].totalCredit += (Number(t.ADJUSTED_TOTAL) || Number(t.GRAND_TOTAL) || 0);
        
        t.transaction_details?.forEach(d => {
          grouped[custId].items.push({
            name: formatItemName(d.product),
            price: d.UNIT_PRICE,
            qty: d.QTY,
            total: (d.UNIT_PRICE * d.QTY)
          });
        });
      });
      setDailyCreditSales(Object.values(grouped));
    }
  };

  const fetchCreditAccounts = async () => {
    let query = supabase.from('credit_accounts').select(`
      customer_id,
      current_balance,
      credit_limit,
      customer:customer_id (FIRST_NAME, LAST_NAME, PHONE_NUMBER)
    `).gt('current_balance', 0).order('current_balance', { ascending: false });
    if (branchId && branchId !== 'ALL') {
      query = query.eq('branch_id', branchId);
    }
    const { data } = await query;
    if (data) setCreditAccounts(data);
  };

  useEffect(() => {
    fetchAnalytics();
    fetchDailyCreditSales();
    fetchCreditAccounts();
  }, [startDate, endDate, branchId]);

  useEffect(() => {
    const fetchHistory = async () => {
      if (!selectedCreditCustomerId) {
        setSelectedCustomerHistory([]);
        return;
      }
      setLoadingHistory(true);
      const { data } = await supabase
        .from('transaction')
        .select(`
          CREATED_AT,
          transaction_details (
            QTY,
            UNIT_PRICE,
            PRODUCT_ID,
            product (NAME)
          )
        `)
        .eq('IS_CREDIT', true)
        .eq('CREDIT_CUSTOMER_ID', selectedCreditCustomerId)
        .order('CREATED_AT', { ascending: false })
        .limit(20);
        
      if (data) {
        const items = [];
        data.forEach(t => {
          t.transaction_details?.forEach(d => {
            items.push({
              date: t.CREATED_AT,
              productId: d.PRODUCT_ID,
              name: formatItemName(d.product),
              qty: d.QTY,
              price: d.UNIT_PRICE,
              total: d.QTY * d.UNIT_PRICE
            });
          });
        });
        setSelectedCustomerHistory(items);
      }
      setLoadingHistory(false);
    };
    fetchHistory();
  }, [selectedCreditCustomerId]);

  const exportCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += `Report Period: ${startDate} to ${endDate}\n\n`;
    
    csvContent += "Metric,Value\n";
    csvContent += `Total Sales (Ksh),${metrics.totalSales.toFixed(2)}\n`;
    csvContent += `Gross Profit (Ksh),${metrics.grossProfit.toFixed(2)}\n`;
    csvContent += `Profit Margin (%),${metrics.profitMargin.toFixed(2)}%\n`;
    csvContent += `Total Transactions,${metrics.transactionCount}\n\n`;
    
    csvContent += "Top 10 Products\n";
    csvContent += "Name,Category,Units Sold,Revenue,Profit\n";
    topProducts.forEach(p => {
      csvContent += `${p.name},${p.category},${p.qty},${p.revenue},${p.profit}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Advanced_Report_${startDate}_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 className="heading-2" style={{ margin: 0 }}>Reports & Analytics</h1>
        
        {/* Custom Period Filters */}
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', background: 'var(--card)', padding: '0.5rem 1rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
          <Calendar size={18} className="text-muted" />
          
          <select className="input" style={{ width: '150px', background: 'rgba(0,0,0,0.2)' }} value={periodPreset} onChange={e => setPeriodPreset(e.target.value)}>
            <option>Today</option>
            <option>Last 7 Days</option>
            <option>This Month</option>
            <option>Last Month</option>
            <option>Custom</option>
          </select>

          {periodPreset === 'Custom' && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>From:</span>
                <input type="date" className="input" style={{ padding: '0.25rem 0.5rem', height: 'auto', background: 'rgba(0,0,0,0.2)' }} value={startDate} onChange={e => setStartDate(e.target.value)} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>To:</span>
                <input type="date" className="input" style={{ padding: '0.25rem 0.5rem', height: 'auto', background: 'rgba(0,0,0,0.2)' }} value={endDate} onChange={e => setEndDate(e.target.value)} />
              </div>
            </>
          )}

          <button className="btn btn-secondary" onClick={fetchAnalytics} title="Refresh">
            <RefreshCcw size={16} />
          </button>
          
          <button className="btn btn-secondary" onClick={fetchAnalytics} title="Refresh">
            <RefreshCcw size={16} />
          </button>
          
          <button className="btn btn-primary" style={{ padding: '0.5rem 1rem', whiteSpace: 'nowrap' }} onClick={exportCSV}>
            <Download size={16} /> <span className="hide-on-mobile">Export</span>
          </button>
          <style jsx>{`
            @media (max-width: 640px) {
              .hide-on-mobile { display: none; }
            }
          `}</style>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--muted-foreground)' }}>Calculating data...</div>
      ) : (
        <>              {/* Metrics Cards */}
              <div className="reports-grid" style={{ display: 'grid', gap: '1rem' }}>
                <style jsx>{`
                  .reports-grid { grid-template-columns: repeat(6, 1fr); }
                  .tables-grid { display: flex; gap: 2rem; }
                  @media (max-width: 1024px) {
                    .reports-grid { grid-template-columns: repeat(3, 1fr); }
                    .tables-grid { flex-direction: column; }
                  }
                  @media (max-width: 640px) {
                    .reports-grid { grid-template-columns: 1fr; }
                  }
                `}</style>
                <div className="glass" style={{ padding: '1.25rem', borderLeft: '3px solid var(--primary)' }}>
                  <div style={{ fontSize: '0.875rem', color: 'var(--muted-foreground)' }}>Total Sales</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>Ksh {(metrics.totalSales/1000).toFixed(1)}k</div>
                </div>
                <div className="glass" style={{ padding: '1.25rem', borderLeft: '3px solid #10b981' }}>
                  <div style={{ fontSize: '0.875rem', color: 'var(--muted-foreground)' }}>Gross Profit</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#10b981' }}>Ksh {(metrics.grossProfit/1000).toFixed(1)}k</div>
                </div>
                <div className="glass" style={{ padding: '1.25rem', borderLeft: '3px solid #f59e0b' }}>
                  <div style={{ fontSize: '0.875rem', color: 'var(--muted-foreground)' }}>Profit Margin</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{metrics.profitMargin.toFixed(1)}%</div>
                </div>
                <div className="glass" style={{ padding: '1.25rem', borderLeft: '3px solid #8b5cf6' }}>
                  <div style={{ fontSize: '0.875rem', color: 'var(--muted-foreground)' }}>Transactions</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{metrics.transactionCount}</div>
                </div>
                <div className="glass" style={{ padding: '1.25rem', borderLeft: '3px solid #ec4899' }}>
                  <div style={{ fontSize: '0.875rem', color: 'var(--muted-foreground)' }}>Avg Trans Value</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>Ksh {(metrics.atv/1000).toFixed(1)}k</div>
                </div>
                <div className="glass" style={{ padding: '1.25rem', borderLeft: '3px solid #6366f1' }}>
                  <div style={{ fontSize: '0.875rem', color: 'var(--muted-foreground)' }}>Est. Stock Value</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#6366f1' }}>Ksh {(metrics.stockValue/1000).toFixed(1)}k</div>
                </div>
              </div>

              {/* Active Credit Accounts Card */}
              <div className="glass" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                      <CreditCard size={24} className="text-warning" /> Active Credit Accounts
                    </h3>
                    {(() => {
                      const ca = creditAccounts.find(c => String(c.customer_id) === String(selectedCreditCustomerId));
                      const cust = ca?.customer;
                      return cust ? (
                        <div style={{ fontSize: '1rem', color: 'var(--muted-foreground)' }}>
                          Account: <strong style={{ color: 'var(--foreground)' }}>{cust.FIRST_NAME} {cust.LAST_NAME}</strong>
                        </div>
                      ) : (
                        <div style={{ fontSize: '0.875rem', color: 'var(--muted-foreground)' }}>
                          Select an account to view their credit history and outstanding balances.
                        </div>
                      );
                    })()}
                  </div>
                  
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', width: '100%', maxWidth: '450px', justifyContent: 'flex-end' }}>
                    <div ref={dropdownRef} style={{ position: 'relative', flex: 1, zIndex: 50 }}>
                      <div 
                        className="input" 
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', background: 'var(--card)' }}
                        onClick={() => setIsCreditDropdownOpen(!isCreditDropdownOpen)}
                      >
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {selectedCreditCustomerId ? (() => {
                            const ca = creditAccounts.find(c => String(c.customer_id) === String(selectedCreditCustomerId));
                            return ca?.customer ? `${ca.customer.FIRST_NAME} ${ca.customer.LAST_NAME} (Owes Ksh ${ca.current_balance?.toLocaleString()})` : '-- Select Account --';
                          })() : '-- Select Account --'}
                        </span>
                        <ChevronDown size={16} style={{ color: 'var(--muted-foreground)', marginLeft: '0.5rem', flexShrink: 0 }} />
                      </div>
                      
                      {isCreditDropdownOpen && (
                        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '4px', background: '#1e293b', border: '1px solid var(--border)', borderRadius: '8px', boxShadow: '0 10px 30px rgba(0,0,0,0.8)', overflow: 'hidden', zIndex: 100 }}>
                          <div style={{ padding: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                            <div style={{ position: 'relative' }}>
                              <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted-foreground)' }} />
                              <input 
                                autoFocus
                                type="text" 
                                placeholder="Search customer..." 
                                className="input" 
                                style={{ width: '100%', paddingLeft: '32px', height: '36px', fontSize: '0.875rem' }}
                                value={creditSearchTerm}
                                onChange={(e) => setCreditSearchTerm(e.target.value)}
                              />
                            </div>
                          </div>
                          <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
                            <div 
                              style={{ padding: '0.75rem 1rem', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.02)', fontSize: '0.875rem', color: selectedCreditCustomerId === '' ? 'var(--primary)' : 'var(--muted-foreground)' }}
                              onClick={() => { setSelectedCreditCustomerId(''); setIsCreditDropdownOpen(false); setCreditSearchTerm(''); }}
                            >
                              -- Clear Selection --
                            </div>
                            {creditAccounts.filter(ca => {
                              if (!creditSearchTerm) return true;
                              const cust = ca.customer;
                              const name = cust ? `${cust.FIRST_NAME || ''} ${cust.LAST_NAME || ''}`.toLowerCase() : 'unknown';
                              return name.includes(creditSearchTerm.toLowerCase());
                            }).map(ca => {
                              const cust = ca.customer;
                              const name = cust ? `${cust.FIRST_NAME || ''} ${cust.LAST_NAME || ''}`.trim() : 'Unknown';
                              const isSelected = String(ca.customer_id) === String(selectedCreditCustomerId);
                              return (
                                <div 
                                  key={ca.customer_id}
                                  style={{ padding: '0.75rem 1rem', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.02)', fontSize: '0.875rem', background: isSelected ? 'rgba(255,255,255,0.05)' : 'transparent' }}
                                  onClick={() => { setSelectedCreditCustomerId(ca.customer_id); setIsCreditDropdownOpen(false); setCreditSearchTerm(''); }}
                                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                                  onMouseLeave={(e) => e.currentTarget.style.background = isSelected ? 'rgba(255,255,255,0.05)' : 'transparent'}
                                >
                                  <div style={{ fontWeight: isSelected ? 600 : 400, color: isSelected ? 'var(--primary)' : 'var(--foreground)' }}>{name}</div>
                                  <div style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', marginTop: '0.25rem' }}>Owes Ksh {ca.current_balance?.toLocaleString()}</div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {(() => {
                      if (!selectedCreditCustomerId) return null;
                      const ca = creditAccounts.find(c => String(c.customer_id) === String(selectedCreditCustomerId));
                      if (!ca) return null;
                      const cust = ca.customer;
                      if (!cust) return null;

                      const name = `${cust.FIRST_NAME || ''} ${cust.LAST_NAME || ''}`.trim();
                      const hr = new Date().getHours();
                      const greeting = hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening';
                      
                      let msg = `*${greeting} ${name},*\n\nThis is Jobea Auto Spares. This is a polite reminder that your current outstanding credit balance is *Ksh ${ca.current_balance?.toLocaleString()}*.\n\n`;
                      
                      if (selectedCustomerHistory && selectedCustomerHistory.length > 0) {
                        msg += `Here is a summary of your recent unpaid credit purchases:\n`;
                        // only include up to 10 in message so it's not too huge
                        selectedCustomerHistory.slice(0, 10).forEach((item, i) => {
                          msg += `${i+1}. *${item.name}*\n   ${item.qty} units @ Ksh ${item.price.toLocaleString()} = Ksh ${item.total.toLocaleString()}\n`;
                        });
                        msg += `\n`;
                      }
                      
                      msg += `Please let us know when you plan to clear your outstanding debt. Thank you!`;
                      
                      let formattedPhone = cust.PHONE_NUMBER ? cust.PHONE_NUMBER.replace(/\D/g, '') : '';
                      if (formattedPhone.startsWith('0')) {
                        formattedPhone = '254' + formattedPhone.substring(1);
                      }
                      const waUrl = formattedPhone ? `https://wa.me/${formattedPhone}?text=${encodeURIComponent(msg)}` : null;

                      return (
                        <a 
                          href={waUrl || '#'} 
                          target={waUrl ? "_blank" : "_self"}
                          onClick={e => { if (!waUrl) { e.preventDefault(); alert('Customer has no phone number on record.'); } }}
                          className="btn btn-primary" 
                          style={{ 
                            background: waUrl ? '#25D366' : 'var(--card)', 
                            color: waUrl ? 'white' : 'var(--muted-foreground)', 
                            textDecoration: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem'
                          }}
                        >
                          <Phone size={18} /> Send WhatsApp
                        </a>
                      );
                    })()}
                  </div>
                </div>

                {/* Selected Record Details */}
                {selectedCreditCustomerId ? (() => {
                  const ca = creditAccounts.find(c => String(c.customer_id) === String(selectedCreditCustomerId));
                  if (!ca) return null;
                  
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                        <div style={{ flex: 1, background: 'rgba(220,38,38,0.1)', padding: '1.5rem', borderRadius: '8px', border: '1px solid rgba(220,38,38,0.2)' }}>
                          <div style={{ fontSize: '0.875rem', color: 'var(--muted-foreground)', marginBottom: '0.5rem' }}>Total Outstanding Debt</div>
                          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#ef4444' }}>Ksh {ca.current_balance?.toLocaleString() || 0}</div>
                        </div>
                        <div style={{ flex: 1, background: 'rgba(255,255,255,0.02)', padding: '1.5rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
                          <div style={{ fontSize: '0.875rem', color: 'var(--muted-foreground)', marginBottom: '0.5rem' }}>Credit Limit</div>
                          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--foreground)' }}>Ksh {ca.credit_limit?.toLocaleString() || 0}</div>
                        </div>
                      </div>
                      
                      <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1.5rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
                        <h4 style={{ margin: '0 0 1rem 0', fontSize: '1.125rem' }}>Recent Credit Purchases</h4>
                        
                        {loadingHistory ? (
                          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted-foreground)' }}>Loading history...</div>
                        ) : selectedCustomerHistory && selectedCustomerHistory.length > 0 ? (
                          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                            <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                              <thead>
                                <tr>
                                  <th style={{ padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.02)', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Date</th>
                                  <th style={{ padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.02)', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Product</th>
                                  <th style={{ padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.02)', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>Units</th>
                                  <th style={{ padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.02)', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>Price</th>
                                  <th style={{ padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.02)', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>Total</th>
                                </tr>
                              </thead>
                              <tbody>
                                {selectedCustomerHistory.map((it, i) => (
                                  <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                    <td style={{ padding: '1rem', color: 'var(--muted-foreground)', fontSize: '0.875rem' }}>{new Date(it.date).toLocaleDateString()}</td>
                                    <td style={{ padding: '1rem', fontWeight: 500 }}>
                                      <span 
                                        onClick={() => fetchAndShowProduct(it.productId)}
                                        style={{ color: 'var(--primary)', textDecoration: 'underline', cursor: 'pointer' }}
                                      >
                                        {it.name}
                                      </span>
                                    </td>
                                    <td style={{ padding: '1rem', textAlign: 'right' }}>{it.qty}</td>
                                    <td style={{ padding: '1rem', textAlign: 'right' }}>Ksh {it.price.toLocaleString()}</td>
                                    <td style={{ padding: '1rem', textAlign: 'right', color: 'var(--primary)', fontWeight: 600 }}>Ksh {it.total.toLocaleString()}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--muted-foreground)' }}>
                            No recent credit purchases found.
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })() : (
                  <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--muted-foreground)', background: 'rgba(255,255,255,0.01)', borderRadius: '8px', border: '1px dashed var(--border)' }}>
                    <FileText size={48} style={{ opacity: 0.2, margin: '0 auto 1rem' }} />
                    <div style={{ fontSize: '1.125rem', marginBottom: '0.5rem' }}>No Account Selected</div>
                    <div style={{ fontSize: '0.875rem' }}>Please select an active credit account from the dropdown above.</div>
                  </div>
                )}

              </div>
              {/* Data Tables */}
              <div className="tables-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                {/* Top Products */}
                <div className="glass" style={{ display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <TrendingUp className="text-success" size={24} />
                    <h3 style={{ margin: 0, fontSize: '1.125rem' }}>Top Movers (Revenue)</h3>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '1rem', maxHeight: '400px', overflowY: 'auto' }}>
                    {topProducts.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--muted-foreground)' }}>No data for this period.</div>
                    ) : topProducts.map((p, idx) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', transition: 'background 0.2s' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                          <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(16,185,129,0.1)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>{idx + 1}</div>
                          <div>
                            <div style={{ fontWeight: 600 }}>{p.name}</div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--muted-foreground)' }}>{p.qty} units sold</div>
                          </div>
                        </div>
                        <div style={{ fontWeight: 'bold', color: 'var(--success)' }}>Ksh {p.revenue.toLocaleString()}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Dead Stock */}
                <div className="glass" style={{ display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <AlertCircle className="text-destructive" size={24} />
                    <h3 style={{ margin: 0, fontSize: '1.125rem' }}>Dead Stock Risk</h3>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '1rem', maxHeight: '400px', overflowY: 'auto' }}>
                    {deadStock.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--muted-foreground)' }}>No dead stock detected!</div>
                    ) : deadStock.map((p, idx) => {
                      const capital = p.ON_HAND * p.COST_PRICE;
                      return (
                        <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', background: 'rgba(220,38,38,0.05)', borderLeft: '3px solid #dc2626', borderRadius: '4px' }}>
                          <div>
                            <div style={{ fontWeight: 600 }}>{formatItemName(p)}</div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--muted-foreground)' }}>{p.category?.CNAME || 'Uncategorized'} &bull; {p.ON_HAND} in stock</div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>Capital Tied</div>
                            <div style={{ fontWeight: 'bold', color: '#dc2626' }}>Ksh {capital.toLocaleString()}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
              
        </>
      )}
      {/* Product Details Modal */}
      {selectedProductForModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', backdropFilter: 'blur(4px)' }}>
          <div style={{ background: 'var(--card)', padding: '2rem', borderRadius: '16px', width: '100%', maxWidth: '500px', border: '1px solid var(--border)', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
            {selectedProductForModal.loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', padding: '2rem' }}>
                <div style={{ width: '32px', height: '32px', border: '3px solid var(--border)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                <span style={{ color: 'var(--muted-foreground)' }}>Loading details...</span>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--foreground)', margin: 0 }}>
                    {selectedProductForModal.NAME}
                  </h3>
                  <button onClick={() => setSelectedProductForModal(null)} style={{ background: 'transparent', border: 'none', color: 'var(--muted-foreground)', cursor: 'pointer' }}>
                    <X size={24} />
                  </button>
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                  <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '8px' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', marginBottom: '0.25rem' }}>Part Number</div>
                    <div style={{ fontWeight: 500 }}>{selectedProductForModal.PART_NUMBER || 'N/A'}</div>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '8px' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', marginBottom: '0.25rem' }}>Category</div>
                    <div style={{ fontWeight: 500 }}>{selectedProductForModal.CATEGORY || 'N/A'}</div>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '8px' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', marginBottom: '0.25rem' }}>Current Stock</div>
                    <div style={{ fontWeight: 600, color: selectedProductForModal.ON_HAND > 0 ? 'var(--primary)' : '#ef4444' }}>
                      {selectedProductForModal.ON_HAND} units
                    </div>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '8px' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', marginBottom: '0.25rem' }}>Selling Price</div>
                    <div style={{ fontWeight: 600 }}>Ksh {selectedProductForModal.PRICE?.toLocaleString()}</div>
                  </div>
                </div>
                
                {selectedProductForModal.DESCRIPTION && (
                  <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', marginBottom: '0.25rem' }}>Description</div>
                    <div style={{ fontSize: '0.875rem' }}>{selectedProductForModal.DESCRIPTION}</div>
                  </div>
                )}
                
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button className="btn btn-secondary" onClick={() => setSelectedProductForModal(null)}>
                    Close
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Trigger hot reload
