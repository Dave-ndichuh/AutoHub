'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { TrendingUp, DollarSign, Activity, ShoppingCart, PackageOpen, Tag, BarChart3, AlertTriangle } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import MetricCard from '@/components/dashboard/MetricCard';
import InsightCard from '@/components/dashboard/InsightCard';
import CreditSalesTable from '@/components/dashboard/CreditSalesTable';

export default function Dashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  // Metrics
  const [metrics, setMetrics] = useState({
    totalSales: 0,
    grossProfit: 0,
    profitMargin: 0,
    transactionCount: 0,
    atv: 0,
    stockValue: 0,
    lowStockCount: 0,
    topProduct: { name: 'N/A', units: 0 }
  });

  // Chart Data
  const [salesTrend, setSalesTrend] = useState([]);
  const [paymentData, setPaymentData] = useState([]);

  useEffect(() => {
    const fetchDashboardData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }

      setLoading(true);

      // Date ranges
      const today = new Date();
      const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
      const sevenDaysAgo = new Date(today);
      sevenDaysAgo.setDate(today.getDate() - 6); // Last 7 days including today
      
      try {
        // Fetch all products for stock value & low stock
        const { data: products } = await supabase.from('product').select('PRODUCT_ID, NAME, ON_HAND, COST_PRICE');
        
        let stockVal = 0;
        let lowStock = 0;
        if (products) {
          products.forEach(p => {
            const onHand = Number(p.ON_HAND) || 0;
            const cost = Number(p.COST_PRICE) || 0;
            if (onHand > 0) stockVal += (onHand * cost);
            if (onHand <= 5) lowStock++;
          });
        }

        // Fetch transactions for this month WITH details for profit math
        const { data: currentMonthTrans } = await supabase
          .from('transaction')
          .select(`
            *,
            transaction_details (
              PRODUCT_ID,
              QTY,
              UNIT_PRICE,
              product (NAME, COST_PRICE)
            )
          `)
          .gte('CREATED_AT', firstDayOfMonth)
          .or('IS_CREDIT.eq.false,IS_SETTLED.eq.true')
          .order('CREATED_AT', { ascending: true }); // Ascending helps with trend chart

        let tSales = 0;
        let tCost = 0;
        let tCount = 0;
        const productSales = {};
        
        // For Payment Breakdown Pie Chart
        let cashTotal = 0;
        let mpesaTotal = 0;
        let creditTotal = 0;

        // For Sales Trend Line Chart (Last 7 Days)
        const trendMap = {};
        for(let i=0; i<7; i++) {
          const d = new Date(sevenDaysAgo);
          d.setDate(d.getDate() + i);
          const yyyy = d.getFullYear();
          const mm = String(d.getMonth() + 1).padStart(2, '0');
          const dd = String(d.getDate()).padStart(2, '0');
          trendMap[`${yyyy}-${mm}-${dd}`] = 0;
        }

        if (currentMonthTrans) {
          currentMonthTrans.forEach(t => {
            tCount++;
            const saleTotal = Number(t.ADJUSTED_TOTAL) || Number(t.GRAND_TOTAL) || 0;
            tSales += saleTotal;

            // Trend Chart
            const tD = new Date(t.CREATED_AT);
            const tDate = `${tD.getFullYear()}-${String(tD.getMonth() + 1).padStart(2, '0')}-${String(tD.getDate()).padStart(2, '0')}`;
            
            if (trendMap[tDate] !== undefined) {
              trendMap[tDate] += saleTotal;
            }

            // Payment Methods
            if (t.PAYMENT_METHOD === 'Cash') cashTotal += saleTotal;
            else if (t.PAYMENT_METHOD === 'M-Pesa') mpesaTotal += saleTotal;
            else if (t.PAYMENT_METHOD === 'Credit') creditTotal += saleTotal;
            else if (t.PAYMENT_METHOD === 'Hybrid') {
              cashTotal += Number(t.CASH_AMOUNT) || 0;
              mpesaTotal += Number(t.MPESA_AMOUNT) || 0;
            }

            // Details for COGS & Top Product
            if (t.transaction_details) {
              t.transaction_details.forEach(d => {
                const cost = Number(d.product?.COST_PRICE) || 0;
                const qty = Number(d.QTY) || 0;
                tCost += (cost * qty);

                if (!productSales[d.PRODUCT_ID]) {
                  productSales[d.PRODUCT_ID] = { name: d.product?.NAME || 'Unknown Part', qty: 0 };
                }
                productSales[d.PRODUCT_ID].qty += qty;
              });
            }
          });
        }

        // Calculations
        const grossProfit = tSales - tCost;
        const profitMargin = tSales > 0 ? (grossProfit / tSales) * 100 : 0;
        const atv = tCount > 0 ? tSales / tCount : 0;

        const topP = Object.values(productSales).sort((a, b) => b.qty - a.qty)[0] || { name: 'N/A', units: 0 };

        // Formatting Chart Data
        const trendData = Object.keys(trendMap).sort().map(date => {
          const [, month, day] = date.split('-');
          return { name: `${day}/${month}`, Sales: trendMap[date] };
        });

        const payData = [
          { name: 'Cash', value: cashTotal, color: '#3b82f6' },
          { name: 'M-Pesa', value: mpesaTotal, color: '#25D366' },
          { name: 'Credit', value: creditTotal, color: '#f59e0b' }
        ].filter(d => d.value > 0);

        setMetrics({
          totalSales: tSales,
          grossProfit,
          profitMargin,
          transactionCount: tCount,
          atv,
          stockValue: stockVal,
          lowStockCount: lowStock,
          topProduct: topP
        });
        setSalesTrend(trendData);
        setPaymentData(payData);

      } catch (error) {
        console.error('Error fetching dashboard stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [router]);

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>Loading advanced analytics...</div>;
  }

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      <style jsx global>{`
        .dashboard-grid {
          display: grid;
          grid-template-columns: repeat(12, 1fr);
          gap: 1.5rem;
        }
        .col-3 { grid-column: span 3 / span 3; }
        .col-4 { grid-column: span 4 / span 4; }
        .col-8 { grid-column: span 8 / span 8; }
        .col-12 { grid-column: span 12 / span 12; }

        @media (max-width: 1024px) {
          .dashboard-grid {
            grid-template-columns: repeat(6, 1fr);
          }
          .col-3 { grid-column: span 3 / span 3; }
          .col-4 { grid-column: span 6 / span 6; }
          .col-8 { grid-column: span 6 / span 6; }
        }

        @media (max-width: 640px) {
          .dashboard-grid {
            grid-template-columns: 1fr;
          }
          .col-3, .col-4, .col-8, .col-12 { 
            grid-column: span 1 / span 1; 
          }
        }
      `}</style>

      {/* Row 1: Executive KPIs */}
      <div>
        <h2 className="heading-2" style={{ marginBottom: '1rem', fontSize: '1.25rem', color: 'var(--foreground)' }}>Executive Dashboard</h2>
        <div className="dashboard-grid">
          <div className="col-3">
            <MetricCard 
              title="Total Sales" 
              icon={<TrendingUp size={18} />} 
              value={`Ksh ${metrics.totalSales.toLocaleString()}`} 
              subline="This month's revenue"
              accentColor="#3b82f6"
            />
          </div>
          <div className="col-3">
            <MetricCard 
              title="Gross Profit" 
              icon={<DollarSign size={18} />} 
              value={`Ksh ${metrics.grossProfit.toLocaleString()}`} 
              subline="Before operating expenses"
              accentColor="#10b981"
            />
          </div>
          <div className="col-3">
            <MetricCard 
              title="Profit Margin" 
              icon={<Activity size={18} />} 
              value={`${metrics.profitMargin.toFixed(1)}%`} 
              subline="Average yield per sale"
              accentColor="#8b5cf6"
            />
          </div>
          <div className="col-3">
            <MetricCard 
              title="Transactions" 
              icon={<ShoppingCart size={18} />} 
              value={metrics.transactionCount.toLocaleString()} 
              subline="Total closed orders"
              accentColor="#f59e0b"
            />
          </div>
        </div>
      </div>

      {/* Row 2: Operational Insights */}
      <div>
        <h2 className="heading-2" style={{ marginBottom: '1rem', fontSize: '1.25rem', color: 'var(--foreground)' }}>Operational Insights</h2>
        <div className="dashboard-grid">
          <div className="col-3">
            <InsightCard 
              title="Low Stock Items"
              value={metrics.lowStockCount.toLocaleString()}
              context="Items with ≤ 5 units left"
              status={metrics.lowStockCount > 0 ? 'danger' : 'success'}
              onClick={() => router.push('/products?filter=low-stock')}
            />
          </div>
          <div className="col-3">
            <InsightCard 
              title="Top Selling Product"
              value={metrics.topProduct.name}
              context={`${metrics.topProduct.qty} units sold this month`}
              status="neutral"
            />
          </div>
          <div className="col-3">
            <InsightCard 
              title="Avg. Transaction Value"
              value={`Ksh ${metrics.atv.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
              context="Average order size"
              status="neutral"
            />
          </div>
          <div className="col-3">
            <InsightCard 
              title="Stock Value at Risk"
              value={`Ksh ${metrics.stockValue.toLocaleString()}`}
              context="Total inventory valuation"
              status="warning"
            />
          </div>
        </div>
      </div>

      {/* Row 3: Visual Charts */}
      <div>
        <h2 className="heading-2" style={{ marginBottom: '1rem', fontSize: '1.25rem', color: 'var(--foreground)' }}>Performance Trends</h2>
        <div className="dashboard-grid" style={{ minHeight: '350px' }}>
          
          <div className="col-8 glass" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', color: 'var(--muted-foreground)' }}>
              <BarChart3 size={18} className="text-primary" /> 
              <h3 style={{ fontSize: '1rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Sales Trend (Last 7 Days)</h3>
            </div>
            <div className="chart-container" style={{ flex: 1 }}>
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <LineChart data={salesTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} dy={10} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={12} tickFormatter={(value) => `${value / 1000}k`} tickLine={false} axisLine={false} dx={-10} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                    itemStyle={{ color: 'var(--foreground)', fontWeight: 600 }}
                    formatter={(value) => [`Ksh ${value.toLocaleString()}`, 'Sales']}
                    cursor={{ stroke: 'var(--muted-foreground)', strokeWidth: 1, strokeDasharray: '4 4' }}
                  />
                  <Line type="monotone" dataKey="Sales" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, fill: '#3b82f6', strokeWidth: 2, stroke: 'var(--background)' }} activeDot={{ r: 6, strokeWidth: 0 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="col-4 glass" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', color: 'var(--muted-foreground)' }}>
              <Tag size={18} className="text-primary" /> 
              <h3 style={{ fontSize: '1rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Revenue by Payment</h3>
            </div>
            <div className="chart-container" style={{ flex: 1 }}>
              {paymentData.length === 0 ? (
                <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted-foreground)' }}>No Data</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                  <PieChart>
                    <Pie
                      data={paymentData}
                      cx="50%"
                      cy="45%"
                      innerRadius={65}
                      outerRadius={85}
                      paddingAngle={5}
                      dataKey="value"
                      stroke="none"
                    >
                      {paymentData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value) => `Ksh ${value.toLocaleString()}`}
                      contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                      itemStyle={{ color: 'var(--foreground)', fontWeight: 600 }}
                    />
                    <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Row 4: Active Credit Sales */}
      <div>
        <h2 className="heading-2" style={{ marginBottom: '1rem', fontSize: '1.25rem', color: 'var(--foreground)' }}>Outstanding Credit Sales</h2>
        <CreditSalesTable />
      </div>

    </div>
  );
}
