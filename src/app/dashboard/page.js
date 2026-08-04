'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { TrendingUp, DollarSign, Activity, ShoppingCart, PackageOpen, Tag, BarChart3, AlertTriangle, Wallet, Calendar, CheckCircle2 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import MetricCard from '@/components/dashboard/MetricCard';
import InsightCard from '@/components/dashboard/InsightCard';
import CreditSalesTable from '@/components/dashboard/CreditSalesTable';
import AnimatedNumber from '@/components/dashboard/AnimatedNumber';
import { useAuth } from '@/components/AuthGuard';

export default function Dashboard() {
  const router = useRouter();
  const { branchId, user } = useAuth();
  const [loading, setLoading] = useState(true);

  const [timeFilter, setTimeFilter] = useState('this_month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [showNewMonthPrompt, setShowNewMonthPrompt] = useState(false);
  const [renewing, setRenewing] = useState(false);

  // Animation Orchestrator State
  const [animationTriggers, setAnimationTriggers] = useState([0, 0, 0, 0]);

  // Metrics
  const [metrics, setMetrics] = useState({
    totalSales: 0,
    grossProfit: 0,
    profitMargin: 0,
    transactionCount: 0,
    atv: 0,
    stockValue: 0,
    lowStockCount: 0,
    outOfStockCount: 0,
    topProduct: { name: 'N/A', units: 0 },
    arTotal: 0,
    creditSalesMonth: 0,
    creditPaymentsMonth: 0
  });

  // Chart Data
  const [salesTrend, setSalesTrend] = useState([]);
  const [paymentData, setPaymentData] = useState([]);


  useEffect(() => {
    const checkRenewal = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      
      const today = new Date();
      const currentMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
      
      const { data: empData } = await supabase.from('employee').select('last_dashboard_renewal_month').eq('EMAIL', session.user.email).maybeSingle();
      
      if (empData) {
        if (empData.last_dashboard_renewal_month !== currentMonthStr) {
          setShowNewMonthPrompt(true);
          setTimeFilter('previous_month');
        } else {
          setShowNewMonthPrompt(false);
        }
      }
    };
    checkRenewal();
  }, []);

  const handleRenewDashboard = async () => {
    setRenewing(true);
    const today = new Date();
    const currentMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      await supabase.from('employee').update({ last_dashboard_renewal_month: currentMonthStr }).eq('EMAIL', session.user.email);
    }
    
    setShowNewMonthPrompt(false);
    setTimeFilter('this_month');
    setRenewing(false);
  };

  useEffect(() => {
    const fetchDashboardData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        return;
      }

      setLoading(true);

      // Date ranges
      let startDate = null;
      let endDate = null;
      const today = new Date();
      
      if (timeFilter === 'this_month') {
        startDate = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
      } else if (timeFilter === 'previous_month') {
        startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1).toISOString();
        endDate = new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59, 999).toISOString();
      } else if (timeFilter === 'custom') {
        if (customStart) startDate = new Date(customStart).toISOString();
        if (customEnd) endDate = new Date(customEnd + 'T23:59:59.999Z').toISOString();
      } else if (timeFilter === 'all_time') {
        startDate = new Date('2000-01-01T00:00:00.000Z').toISOString();
        endDate = new Date().toISOString();
      }
      
      try {
        let trendQuery = supabase
          .from('transaction')
          .select('CREATED_AT, ADJUSTED_TOTAL, GRAND_TOTAL, status')
          .or('IS_CREDIT.eq.false,IS_SETTLED.eq.true')
          .order('CREATED_AT', { ascending: true });
          
        if (startDate) trendQuery = trendQuery.gte('CREATED_AT', startDate);
        if (endDate) trendQuery = trendQuery.lte('CREATED_AT', endDate);
        if (branchId && branchId !== 'ALL') trendQuery = trendQuery.eq('BRANCH_ID', branchId);

        const branchParam = branchId === 'ALL' ? null : branchId;

        // Concurrent fetching with Promise.all
        // Catch individual errors so one failure doesn't break everything
        const [
          rpcMetricsRes,
          invMetricsRes,
          trendDataRawRes,
          creditAccountsRes,
          creditTransRes
        ] = await Promise.all([
          supabase.rpc('get_dashboard_metrics', { start_date: startDate, end_date: endDate, p_branch_id: branchParam }),
          supabase.rpc('get_inventory_metrics', { p_branch_id: branchParam, start_date: startDate, end_date: endDate })
            .then(res => res.error ? supabase.rpc('get_inventory_metrics', { p_branch_id: branchParam }) : res),
          trendQuery,
          branchParam 
            ? supabase.from('credit_accounts').select('current_balance').eq('branch_id', branchParam)
            : supabase.from('credit_accounts').select('current_balance'),
          (branchParam 
            ? supabase.from('credit_transactions').select('type, amount, date').eq('branch_id', branchParam)
            : supabase.from('credit_transactions').select('type, amount, date'))
            .gte('date', startDate || '2000-01-01T00:00:00.000Z')
            .lte('date', endDate || new Date().toISOString())
        ]);

        const rpcMetrics = rpcMetricsRes?.data;
        const invMetrics = invMetricsRes?.data;
        const trendDataRaw = trendDataRawRes?.data;
        
        let currentMonthTrans = trendDataRaw || [];
        
        let stockVal = Number(invMetrics?.stockValue) || 0;
        let lowStock = Number(invMetrics?.lowStockCount) || 0;
        let outOfStock = Number(invMetrics?.outOfStockCount) || 0;
        
        let arTotal = 0;
        let creditSalesMonth = 0;
        let creditPaymentsMonth = 0;
        
        if (creditAccountsRes?.data) {
          arTotal = creditAccountsRes.data.reduce((sum, acc) => sum + (Number(acc.current_balance) || 0), 0);
        }
        
        if (creditTransRes?.data) {
          creditTransRes.data.forEach(t => {
             // Assuming 'debit' or 'sale' adds to AR (Credit Sales), and 'credit' or 'payment' reduces AR
             if (t.type === 'debit') creditSalesMonth += Number(t.amount) || 0;
             if (t.type === 'credit') creditPaymentsMonth += Number(t.amount) || 0;
          });
        }

        let tSales = 0;
        let tCost = 0;
        let tCount = 0;
        const productSales = {};
        
        // For Payment Breakdown Pie Chart
        let cashTotal = 0;
        let mpesaTotal = 0;
        let creditTotal = 0;

        // For Sales Trend Line Chart (Dynamic period)
        const trendMap = {};

        if (currentMonthTrans) {
          currentMonthTrans.forEach(t => {
            // Locally filter out reversed transactions to prevent DB crashes if column is missing
            if (t.status === 'Reversed') return;

            // Skip purely voided or 0-value returns that shouldn't inflate count
            const saleTotal = Number(t.ADJUSTED_TOTAL) || Number(t.GRAND_TOTAL) || 0;
            tCount++;
            tSales += saleTotal;

            // Trend Chart
            const tD = new Date(t.CREATED_AT);
            const tDate = `${tD.getFullYear()}-${String(tD.getMonth() + 1).padStart(2, '0')}-${String(tD.getDate()).padStart(2, '0')}`;
            
            if (trendMap[tDate] === undefined) {
                trendMap[tDate] = 0;
            }
            trendMap[tDate] += saleTotal;

            // Payment methods and top product are now handled by RPC.
          });
        }

        // Calculations
        let grossProfit = tSales - tCost;
        let profitMargin = tSales > 0 ? (grossProfit / tSales) * 100 : 0;
        let atv = tCount > 0 ? tSales / tCount : 0;
        
        let topP = { name: 'N/A', units: 0 };
        
        // Override with RPC metrics if available
        if (rpcMetrics) {
          tSales = Number(rpcMetrics.totalSales) || 0;
          grossProfit = Number(rpcMetrics.grossProfit) || 0;
          profitMargin = Number(rpcMetrics.profitMargin) || 0;
          tCount = Number(rpcMetrics.transactionCount) || 0;
          atv = Number(rpcMetrics.atv) || 0;
          
          cashTotal = Number(rpcMetrics.cashTotal) || 0;
          mpesaTotal = Number(rpcMetrics.mpesaTotal) || 0;
          creditTotal = Number(rpcMetrics.creditTotal) || 0;
          topP = { name: rpcMetrics.topProductName || 'N/A', qty: Number(rpcMetrics.topProductQty) || 0 };
        }

        

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
          outOfStockCount: outOfStock,
          topProduct: topP,
          arTotal,
          creditSalesMonth,
          creditPaymentsMonth
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
  }, [router, branchId, timeFilter, customStart, customEnd]);

  // Orchestrator for Animated Numbers
  useEffect(() => {
    let isMounted = true;
    
    // The sequences defined by the user
    const sequences = [
      [0, 1, 2, 3], // Left to right
      [3, 2, 1, 0], // Right to left
      [0, 3, 1, 2]  // Outside in
    ];

    const runOrchestrator = async () => {
      // First, wait 30 seconds before running the loop
      await new Promise(r => setTimeout(r, 30000));
      
      while (isMounted) {
        const seq = sequences[Math.floor(Math.random() * sequences.length)];
        
        for (let i = 0; i < seq.length; i++) {
          if (!isMounted) break;
          const targetIndex = seq[i];
          
          setAnimationTriggers(prev => {
            const next = [...prev];
            next[targetIndex] += 1;
            return next;
          });
          
          // Wait 1.5 seconds between triggering each number (gives them time to count smoothly)
          await new Promise(r => setTimeout(r, 1500));
        }

        if (!isMounted) break;
        // Wait 30 seconds after the sequence finishes
        await new Promise(r => setTimeout(r, 30000));
      }
    };

    runOrchestrator();

    return () => {
      isMounted = false;
    };
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem', flexWrap: 'wrap', gap: '1.5rem', width: '100%' }}>
        <div className="skeleton-shimmer glass" style={{ height: '120px', width: '22%', borderRadius: '12px' }}></div>
        <div className="skeleton-shimmer glass" style={{ height: '120px', width: '22%', borderRadius: '12px' }}></div>
        <div className="skeleton-shimmer glass" style={{ height: '120px', width: '22%', borderRadius: '12px' }}></div>
        <div className="skeleton-shimmer glass" style={{ height: '120px', width: '22%', borderRadius: '12px' }}></div>
      </div>
    );
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

        .five-col-grid {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 1.5rem;
        }

        @media (max-width: 1280px) {
          .five-col-grid {
            grid-template-columns: repeat(3, 1fr);
          }
        }

        @media (max-width: 768px) {
          .five-col-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 640px) {
          .five-col-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      {/* New Month Prompt */}
      {showNewMonthPrompt && (
        <div className="animate-fade-in stagger-1" style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', borderRadius: '12px', padding: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <AlertTriangle size={24} color="#ef4444" />
            <div>
              <h3 style={{ margin: 0, color: '#ef4444', fontWeight: 600, fontSize: '1.1rem' }}>A new month has started!</h3>
              <p style={{ margin: 0, color: 'var(--muted-foreground)', fontSize: '0.875rem', marginTop: '0.25rem' }}>You are currently viewing last month&apos;s data. Renew your dashboard to track current month metrics.</p>
            </div>
          </div>
          <button className="btn btn-primary" onClick={handleRenewDashboard} disabled={renewing} style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer' }}>
            {renewing ? 'Renewing...' : 'Renew Dashboard'}
          </button>
        </div>
      )}

      {/* Filter Row */}
      <div className="stagger-1" style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Calendar size={18} className="text-muted" />
          <select className="input" value={timeFilter} onChange={(e) => setTimeFilter(e.target.value)} style={{ width: '200px', padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
            <option value="this_month">This Month</option>
            <option value="previous_month">Previous Month</option>
            <option value="all_time">All Time</option>
            <option value="custom">Custom Period</option>
          </select>
        </div>
        
        {timeFilter === 'custom' && (
          <div className="animate-fade-in" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input type="date" className="input" style={{ padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--border)' }} value={customStart} onChange={(e) => setCustomStart(e.target.value)} />
            <span className="text-muted">to</span>
            <input type="date" className="input" style={{ padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--border)' }} value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} />
          </div>
        )}
      </div>

      {/* Row 1: Executive KPIs */}
      <div>
        <h2 className="heading-2 stagger-1" style={{ marginBottom: '1rem', fontSize: '1.25rem', color: 'var(--foreground)' }}>Executive Dashboard</h2>
        <div className="dashboard-grid">
          <div className="col-3 stagger-1">
            <MetricCard 
              title="Total Sales" 
              icon={<TrendingUp size={18} />} 
              value={metrics.totalSales} 
              prefix="Ksh "
              decimals={0}
              trigger={animationTriggers[0]}
              subline="This month's revenue"
              accentColor="#3b82f6"
            />
          </div>
          <div className="col-3 stagger-2">
            <MetricCard 
              title="Gross Profit" 
              icon={<DollarSign size={18} />} 
              value={metrics.grossProfit} 
              prefix="Ksh "
              decimals={0}
              trigger={animationTriggers[1]}
              subline="Before operating expenses"
              accentColor="#10b981"
            />
          </div>
          <div className="col-3 stagger-3">
            <MetricCard 
              title="Profit Margin" 
              icon={<Activity size={18} />} 
              value={metrics.profitMargin} 
              suffix="%"
              decimals={1}
              trigger={animationTriggers[2]}
              subline="Average yield per sale"
              accentColor="#8b5cf6"
            />
          </div>
          <div className="col-3 stagger-4">
            <MetricCard 
              title="Transactions" 
              icon={<ShoppingCart size={18} />} 
              value={metrics.transactionCount} 
              decimals={0}
              trigger={animationTriggers[3]}
              subline="Total closed orders"
              accentColor="#f59e0b"
            />
          </div>
        </div>
      </div>

      {/* Row 1.5: Credit Performance */}
      <div>
        <h2 className="heading-2 stagger-2" style={{ marginBottom: '1rem', fontSize: '1.25rem', color: 'var(--foreground)' }}>Credit Performance</h2>
        <div className="dashboard-grid">
          <div className="col-4 stagger-1">
            <MetricCard 
              title="Accounts Receivable" 
              icon={<Wallet size={18} />} 
              value={metrics.arTotal || 0} 
              prefix="Ksh "
              decimals={0}
              trigger={animationTriggers[0]}
              subline="Total outstanding customer debt"
              accentColor="#ef4444"
            />
          </div>
          <div className="col-4 stagger-2">
            <MetricCard 
              title="Credit Sales (MTD)" 
              icon={<TrendingUp size={18} />} 
              value={metrics.creditSalesMonth || 0} 
              prefix="Ksh "
              decimals={0}
              trigger={animationTriggers[1]}
              subline="New credit issued this month"
              accentColor="#f59e0b"
            />
          </div>
          <div className="col-4 stagger-3">
            <MetricCard 
              title="Payments Received (MTD)" 
              icon={<DollarSign size={18} />} 
              value={metrics.creditPaymentsMonth || 0} 
              prefix="Ksh "
              decimals={0}
              trigger={animationTriggers[2]}
              subline="Debt recovered this month"
              accentColor="#10b981"
            />
          </div>
        </div>
      </div>

      {/* Row 2: Operational Insights */}
      <div>
        <h2 className="heading-2 stagger-2" style={{ marginBottom: '1rem', fontSize: '1.25rem', color: 'var(--foreground)' }}>Operational Insights</h2>
        
        <div className="five-col-grid">
          <div className="stagger-1">
            <InsightCard 
              title="Low Stock Items"
              value={<AnimatedNumber value={metrics.lowStockCount} />}
              context="Items with ≤ 5 units left"
              status={metrics.lowStockCount > 0 ? 'warning' : 'success'}
              onClick={() => router.push('/products?filter=low-stock')}
            />
          </div>
          <div className="stagger-2">
            <InsightCard 
              title="Out of Stock Items"
              value={<AnimatedNumber value={metrics.outOfStockCount} />}
              context="Items with 0 units left"
              status={metrics.outOfStockCount > 0 ? 'danger' : 'success'}
              onClick={() => router.push('/products?filter=out-of-stock')}
            />
          </div>
          <div className="stagger-3">
            <InsightCard 
              title="Stock Value at Risk"
              value={<AnimatedNumber value={metrics.stockValue} prefix="Ksh " decimals={0} />}
              context="Total inventory valuation"
              status="warning"
            />
          </div>
          <div className="stagger-4">
            <InsightCard 
              title="Top Selling Product"
              value={metrics.topProduct.name}
              context={`${metrics.topProduct.qty} units sold this month`}
              status="neutral"
            />
          </div>
          <div className="stagger-4">
            <InsightCard 
              title="Avg. Transaction Value"
              value={<AnimatedNumber value={metrics.atv} prefix="Ksh " decimals={0} />}
              context="Average order size"
              status="neutral"
            />
          </div>
        </div>
      </div>

      {/* Row 3: Visual Charts */}
      <div>
        <h2 className="heading-2 stagger-3" style={{ marginBottom: '1rem', fontSize: '1.25rem', color: 'var(--foreground)' }}>Performance Trends</h2>
        <div className="dashboard-grid" style={{ minHeight: '350px' }}>
          
          <div className="col-8 glass stagger-3 card-lift" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', color: 'var(--muted-foreground)' }}>
              <BarChart3 size={18} className="text-primary" /> 
              <h3 style={{ fontSize: '1rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {timeFilter === 'all_time' ? 'Sales Trend (All Time)' : 
                 timeFilter === 'this_month' ? 'Sales Trend (This Month)' : 
                 timeFilter === 'previous_month' ? 'Sales Trend (Previous Month)' : 'Sales Trend (Custom Period)'}
              </h3>
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

          <div className="col-4 glass stagger-4 card-lift" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
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
      <div className="stagger-4">
        <h2 className="heading-2" style={{ marginBottom: '1rem', fontSize: '1.25rem', color: 'var(--foreground)' }}>Outstanding Credit Sales</h2>
        <CreditSalesTable />
      </div>

    </div>
  );
}
