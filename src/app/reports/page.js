'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { BarChart3, TrendingUp, AlertCircle, PackageSearch, Download, DollarSign, Calendar, RefreshCcw, Phone, CreditCard, FileText } from 'lucide-react';
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
                      const ca = creditAccounts.find(c => c.customer_id === selectedCreditCustomerId);
                      const cust = ca?.customer;
                      return cust ? (
                        <div style={{ fontSize: '1rem', color: 'var(--muted-foreground)' }}>
                          Account: <strong style={{ color: 'var(--foreground)' }}>{cust.FIRST_NAME} {cust.LAST_NAME}</strong>
                        </div>
                      ) : (
                        <div style={{ fontSize: '0.875rem', color: 'var(--muted-foreground)' }}>
                          Select an account to view outstanding balances and today&apos;s activity.
                        </div>
                      );
                    })()}
                  </div>
                  
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <select 
                      className="input" 
                      style={{ minWidth: '250px' }}
                      value={selectedCreditCustomerId}
                      onChange={(e) => setSelectedCreditCustomerId(e.target.value)}
                    >
                      <option value="">-- Select Account --</option>
                      {creditAccounts.map(ca => {
                        const cust = ca.customer;
                        const name = cust ? `${cust.FIRST_NAME || ''} ${cust.LAST_NAME || ''}`.trim() : 'Unknown';
                        return (
                          <option key={ca.customer_id} value={ca.customer_id}>{name} (Owes Ksh {ca.current_balance?.toLocaleString()})</option>
                        );
                      })}
                    </select>
                    
                    {(() => {
                      const ca = creditAccounts.find(c => c.customer_id === selectedCreditCustomerId);
                      if (!ca) return null;
                      const cust = ca.customer;
                      if (!cust) return null;
                      
                      const record = dailyCreditSales.find(c => c.customerId === selectedCreditCustomerId);

                      const name = `${cust.FIRST_NAME || ''} ${cust.LAST_NAME || ''}`.trim();
                      const hr = new Date().getHours();
                      const greeting = hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening';
                      
                      let msg = `*${greeting} ${name},*\n\nThis is Jobea Auto Spares. This is a polite reminder that your current outstanding credit balance is *Ksh ${ca.current_balance?.toLocaleString()}*.\n\n`;
                      
                      if (record && record.items.length > 0) {
                        msg += `As part of this balance, here is a summary of your credit purchases today:\n`;
                        record.items.forEach((item, i) => {
                          msg += `${i+1}. *${item.name}*\n   ${item.qty} units @ Ksh ${item.price.toLocaleString()} = Ksh ${item.total.toLocaleString()}\n`;
                        });
                        msg += `\n`;
                      }
                      
                      msg += `Please let us know when you plan to clear your outstanding debt. Thank you!`;
                      
                      const waUrl = cust.PHONE_NUMBER ? `https://wa.me/${cust.PHONE_NUMBER.replace(/\+/g,'')}?text=${encodeURIComponent(msg)}` : null;

                      return (
                        <a 
                          href={waUrl || '#'} 
                          target={waUrl ? "_blank" : "_self"}
                          onClick={e => { if (!waUrl) { e.preventDefault(); alert('Customer has no phone number on record.'); } }}
                          className="btn" 
                          style={{ 
                            background: waUrl ? '#25D366' : 'var(--card)', 
                            color: waUrl ? 'white' : 'var(--muted-foreground)', 
                            textDecoration: 'none'
                          }}
                        >
                          <Phone size={18} /> Send WhatsApp Reminder
                        </a>
                      );
                    })()}
                  </div>
                </div>

                {/* Selected Record Details */}
                {selectedCreditCustomerId ? (() => {
                  const ca = creditAccounts.find(c => c.customer_id === selectedCreditCustomerId);
                  if (!ca) return null;
                  const record = dailyCreditSales.find(c => c.customerId === selectedCreditCustomerId);
                  
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
                      
                      {record && record.items.length > 0 ? (
                        <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1.5rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
                          <h4 style={{ margin: '0 0 1rem 0', fontSize: '1.125rem' }}>Purchases Today</h4>
                          <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                              <tr>
                                <th style={{ padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.02)', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Product</th>
                                <th style={{ padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.02)', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>Units</th>
                                <th style={{ padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.02)', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>Price</th>
                                <th style={{ padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.02)', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>Total</th>
                              </tr>
                            </thead>
                            <tbody>
                              {record.items.map((it, i) => (
                                <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                  <td style={{ padding: '1rem', fontWeight: 500 }}>{it.name}</td>
                                  <td style={{ padding: '1rem', textAlign: 'right' }}>{it.qty}</td>
                                  <td style={{ padding: '1rem', textAlign: 'right' }}>Ksh {it.price.toLocaleString()}</td>
                                  <td style={{ padding: '1rem', textAlign: 'right', color: 'var(--primary)', fontWeight: 600 }}>Ksh {it.total.toLocaleString()}</td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot>
                              <tr>
                                <td colSpan="3" style={{ padding: '1.5rem 1rem 0', textAlign: 'right', color: 'var(--muted-foreground)' }}>Added to Debt Today:</td>
                                <td style={{ padding: '1.5rem 1rem 0', textAlign: 'right', fontWeight: 'bold', color: 'var(--warning)', fontSize: '1.125rem' }}>+ Ksh {record.totalCredit.toLocaleString()}</td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      ) : (
                        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--muted-foreground)', background: 'rgba(255,255,255,0.01)', borderRadius: '8px', border: '1px dashed var(--border)' }}>
                          <FileText size={32} style={{ opacity: 0.2, margin: '0 auto 1rem' }} />
                          <div style={{ fontSize: '1rem' }}>No Credit Purchases Today</div>
                        </div>
                      )}
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
    </div>
  );
}
