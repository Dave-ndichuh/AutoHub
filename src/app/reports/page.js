'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { BarChart3, TrendingUp, AlertCircle, PackageSearch, Download, DollarSign, Calendar, RefreshCcw } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell } from 'recharts';
import { formatItemName } from '@/utils/formatters';

export default function ReportsPage() {
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
    const { data: transData } = await supabase
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

    // 2. Fetch All Products (for dead stock and total stock value)
    const { data: prodData } = await supabase
      .from('product')
      .select(`*, category(CNAME)`);

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

    // Top 10 Products by Revenue
    const sortedProducts = Object.values(productStats)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

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
    setDeadStock(dead.slice(0, 10)); // Limit to top 10 worst offenders
    setCategoryData(cData);
    
    setLoading(false);
  };

  useEffect(() => {
    fetchAnalytics();
  }, [startDate, endDate]);

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
        <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--muted-foreground)' }}>Calculating financial data...</div>
      ) : (
        <>
          {/* Metrics Cards */}
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
            <div className="glass" style={{ padding: '1.25rem', borderLeft: '3px solid #8b5cf6' }}>
              <div style={{ fontSize: '0.875rem', color: 'var(--muted-foreground)' }}>Profit Margin</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#8b5cf6' }}>{metrics.profitMargin.toFixed(1)}%</div>
            </div>
            <div className="glass" style={{ padding: '1.25rem' }}>
              <div style={{ fontSize: '0.875rem', color: 'var(--muted-foreground)' }}>Transactions</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{metrics.transactionCount}</div>
            </div>
            <div className="glass" style={{ padding: '1.25rem' }}>
              <div style={{ fontSize: '0.875rem', color: 'var(--muted-foreground)' }}>Avg. Transaction</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>Ksh {metrics.atv.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
            </div>
            <div className="glass" style={{ padding: '1.25rem', borderLeft: '3px solid #f59e0b' }}>
              <div style={{ fontSize: '0.875rem', color: 'var(--muted-foreground)' }}>Stock Value Risk</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f59e0b' }}>Ksh {(metrics.stockValue/1000).toFixed(1)}k</div>
            </div>
          </div>

          {/* Visual Analytics */}
          <div className="glass" style={{ padding: '1.5rem' }}>
            <h3 className="heading-2" style={{ fontSize: '1.125rem', marginBottom: '1.5rem' }}>Revenue by Category (Top 10)</h3>
            <div className="chart-container" style={{ height: '300px' }}>
              {categoryData.length === 0 ? (
                <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted-foreground)' }}>No Data</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                  <BarChart data={categoryData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                    <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={11} tick={{ fill: 'var(--muted-foreground)' }} />
                    <YAxis stroke="var(--muted-foreground)" fontSize={11} tickFormatter={(value) => `${value / 1000}k`} />
                    <RechartsTooltip 
                      contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px' }}
                      formatter={(value) => [`Ksh ${value.toLocaleString()}`, 'Revenue']}
                    />
                    <Bar dataKey="Revenue" fill="var(--primary)" radius={[4, 4, 0, 0]}>
                      {categoryData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={index % 2 === 0 ? 'var(--primary)' : '#8b5cf6'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="tables-grid">
            {/* Top 10 Performing Products */}
            <div className="glass" style={{ flex: 1, padding: '1.5rem', overflowX: 'auto' }}>
              <h3 className="heading-2" style={{ fontSize: '1.25rem', marginBottom: '1.5rem' }}>Top 10 Products (Revenue)</h3>
              <div className="table-wrapper">
                <table className="table">
                <thead>
                  <tr>
                    <th>Product Name</th>
                    <th>Category</th>
                    <th style={{ textAlign: 'right' }}>Units</th>
                    <th style={{ textAlign: 'right' }}>Revenue</th>
                    <th style={{ textAlign: 'right' }}>Profit</th>
                  </tr>
                </thead>
                <tbody>
                  {topProducts.length === 0 ? (
                    <tr><td colSpan="5" style={{ textAlign: 'center' }}>No sales data for this period.</td></tr>
                  ) : topProducts.map((p, idx) => (
                    <tr key={idx}>
                      <td style={{ fontWeight: 500, whiteSpace: 'pre-line' }}>{p.name}</td>
                      <td className="text-muted" style={{ fontSize: '0.875rem' }}>{p.category}</td>
                      <td style={{ textAlign: 'right' }}><span className="badge badge-primary">{p.qty}</span></td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>Ksh {p.revenue.toLocaleString()}</td>
                      <td style={{ textAlign: 'right', color: '#10b981', fontWeight: 600 }}>Ksh {p.profit.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>

            {/* Worst Performing Products (Dead Stock) */}
            <div className="glass" style={{ flex: 1, padding: '1.5rem', overflowX: 'auto' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
                <AlertCircle size={20} color="#ef4444" />
                <h3 className="heading-2" style={{ fontSize: '1.25rem', margin: 0, color: '#ef4444' }}>Dead Stock (0 Sales, &gt;10 Stock)</h3>
              </div>
              <div className="table-wrapper" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                <table className="table" style={{ position: 'relative' }}>
                <thead style={{ position: 'sticky', top: 0, background: 'var(--card)', zIndex: 1 }}>
                  <tr>
                    <th>Product Name</th>
                    <th>Category</th>
                    <th style={{ textAlign: 'right' }}>In Stock</th>
                    <th style={{ textAlign: 'right' }}>Capital Tied</th>
                  </tr>
                </thead>
                <tbody>
                  {deadStock.length === 0 ? (
                    <tr><td colSpan="4" style={{ textAlign: 'center' }}>No dead stock detected!</td></tr>
                  ) : deadStock.map((p, idx) => {
                    const capital = p.ON_HAND * p.COST_PRICE;
                    return (
                      <tr key={idx}>
                        <td style={{ fontWeight: 500, whiteSpace: 'pre-line' }}>{formatItemName(p)}</td>
                        <td className="text-muted" style={{ fontSize: '0.875rem' }}>{p.category?.CNAME || 'N/A'}</td>
                        <td style={{ textAlign: 'right' }}>
                          <span className="badge badge-destructive">{p.ON_HAND}</span>
                        </td>
                        <td style={{ textAlign: 'right', color: '#f59e0b', fontWeight: 600 }}>Ksh {capital.toLocaleString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
            </div>
          </div>

        </>
      )}

    </div>
  );
}
