const fs = require('fs');

let code = fs.readFileSync('src/app/dashboard/page.js', 'utf8');

// Normalize line endings
code = code.replace(/\r\n/g, '\n');

// 1. Imports
code = code.replace(
  "import { TrendingUp, DollarSign, Activity, ShoppingCart, PackageOpen, Tag, BarChart3, AlertTriangle, Wallet } from 'lucide-react';",
  "import { TrendingUp, DollarSign, Activity, ShoppingCart, PackageOpen, Tag, BarChart3, AlertTriangle, Wallet, Calendar, CheckCircle2 } from 'lucide-react';"
);

// 2. State variables
code = code.replace(
  "  const router = useRouter();\n  const { branchId } = useAuth();\n  const [loading, setLoading] = useState(true);\n\n  // Animation Orchestrator State",
  "  const router = useRouter();\n  const { branchId, user } = useAuth();\n  const [loading, setLoading] = useState(true);\n\n  const [timeFilter, setTimeFilter] = useState('this_month');\n  const [customStart, setCustomStart] = useState('');\n  const [customEnd, setCustomEnd] = useState('');\n  const [showNewMonthPrompt, setShowNewMonthPrompt] = useState(false);\n  const [renewing, setRenewing] = useState(false);\n\n  // Animation Orchestrator State"
);

// 3. checkRenewal
const checkRenewalStr = `
  useEffect(() => {
    const checkRenewal = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      
      const today = new Date();
      const currentMonthStr = \`\${today.getFullYear()}-\${String(today.getMonth() + 1).padStart(2, '0')}\`;
      
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
    const currentMonthStr = \`\${today.getFullYear()}-\${String(today.getMonth() + 1).padStart(2, '0')}\`;
    
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      await supabase.from('employee').update({ last_dashboard_renewal_month: currentMonthStr }).eq('EMAIL', session.user.email);
    }
    
    setShowNewMonthPrompt(false);
    setTimeFilter('this_month');
    setRenewing(false);
  };

  useEffect(() => {
    const fetchDashboardData = async () => {`;

code = code.replace(
  "  useEffect(() => {\n    const fetchDashboardData = async () => {",
  checkRenewalStr
);

// 4. Date ranges
const fetchCodeTarget = `      // Date ranges
      const today = new Date();
      const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
      const sevenDaysAgo = new Date(today);
      sevenDaysAgo.setDate(today.getDate() - 6); // Last 7 days including today
      
      try {`;

const fetchCodeReplacement = `      // Date ranges
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
      }
      
      const sevenDaysAgo = new Date(today);
      sevenDaysAgo.setDate(today.getDate() - 6); // Last 7 days including today
      
      try {`;

code = code.replace(fetchCodeTarget, fetchCodeReplacement);

// 5. RPC call
const rpcCallReplacement = `        // Fetch metrics via RPC first
        const { data: rpcMetrics } = await supabase.rpc('get_dashboard_metrics', {
          start_date: startDate,
          end_date: endDate,
          p_branch_id: branchId === 'ALL' ? null : branchId
        });
`;

code = code.replace("      try {\n        // Fetch all products", "      try {\n" + rpcCallReplacement + "\n        // Fetch all products");

// 6. ctQuery
const ctQueryTarget = `        let ctQuery = supabase.from('credit_transactions').select('type, amount, reference_type');
        if (startDate) ctQuery = ctQuery.gte('date', startDate);
        if (endDate) ctQuery = ctQuery.lte('date', endDate);
        if (branchId && branchId !== 'ALL') {
          ctQuery = ctQuery.eq('branch_id', branchId);
        }`;
// Wait, the file currently has:
const ctQueryTargetOriginal = `        let ctQuery = supabase.from('credit_transactions').select('type, amount, reference_type').gte('date', firstDayOfMonth);
        if (branchId && branchId !== 'ALL') {
          ctQuery = ctQuery.eq('branch_id', branchId);
        }`;

const ctQueryReplacement = `        let ctQuery = supabase.from('credit_transactions').select('type, amount, reference_type');
        if (startDate) ctQuery = ctQuery.gte('date', startDate);
        if (endDate) ctQuery = ctQuery.lte('date', endDate);
        if (branchId && branchId !== 'ALL') {
          ctQuery = ctQuery.eq('branch_id', branchId);
        }`;

code = code.replace(ctQueryTargetOriginal, ctQueryReplacement);
// if it was partially modified in previous run:
code = code.replace(ctQueryTarget, ctQueryReplacement);

// 7. transQuery
const transQueryTarget = `        // Fetch transactions for this month WITH details for profit math
        let transQuery = supabase
          .from('transaction')
          .select(\`
            *,
            transaction_details (
              PRODUCT_ID,
              QTY,
              UNIT_PRICE,
              product (NAME, COST_PRICE)
            )
          \`)
          .gte('CREATED_AT', firstDayOfMonth)
          .or('IS_CREDIT.eq.false,IS_SETTLED.eq.true')
          .order('CREATED_AT', { ascending: true }); // Ascending helps with trend chart

        if (branchId && branchId !== 'ALL') {
          transQuery = transQuery.eq('BRANCH_ID', branchId);
        }

        const { data: currentMonthTrans } = await transQuery;`;

const transQueryReplacement = `        // Fetch transactions for this month WITH details for profit math (ONLY IF NOT ALL TIME, TO SAVE BANDWIDTH)
        let currentMonthTrans = [];
        if (timeFilter !== 'all_time') {
          let transQuery = supabase
            .from('transaction')
            .select(\`
              *,
              transaction_details (
                PRODUCT_ID,
                QTY,
                UNIT_PRICE,
                product (NAME, COST_PRICE)
              )
            \`)
            .or('IS_CREDIT.eq.false,IS_SETTLED.eq.true')
            .order('CREATED_AT', { ascending: true }); // Ascending helps with trend chart

          if (startDate) transQuery = transQuery.gte('CREATED_AT', startDate);
          if (endDate) transQuery = transQuery.lte('CREATED_AT', endDate);
          if (branchId && branchId !== 'ALL') transQuery = transQuery.eq('BRANCH_ID', branchId);

          const { data } = await transQuery;
          currentMonthTrans = data || [];
        }`;

code = code.replace(transQueryTarget, transQueryReplacement);

// 8. metricsAssign
const metricsAssignTarget = `        // Calculations
        const grossProfit = tSales - tCost;
        const profitMargin = tSales > 0 ? (grossProfit / tSales) * 100 : 0;
        const atv = tCount > 0 ? tSales / tCount : 0;`;

const metricsAssignReplacement = `        // Calculations
        let grossProfit = tSales - tCost;
        let profitMargin = tSales > 0 ? (grossProfit / tSales) * 100 : 0;
        let atv = tCount > 0 ? tSales / tCount : 0;
        
        // Override with RPC metrics if available
        if (rpcMetrics) {
          tSales = Number(rpcMetrics.totalSales) || 0;
          grossProfit = Number(rpcMetrics.grossProfit) || 0;
          profitMargin = Number(rpcMetrics.profitMargin) || 0;
          tCount = Number(rpcMetrics.transactionCount) || 0;
          atv = Number(rpcMetrics.atv) || 0;
        }`;
        
code = code.replace(metricsAssignTarget, metricsAssignReplacement);

// 9. UI headers
const uiHeaderTarget = `      {/* Row 1: Executive KPIs */}
      <div>
        <h2 className="heading-2 stagger-1" style={{ marginBottom: '1rem', fontSize: '1.25rem', color: 'var(--foreground)' }}>Executive Dashboard</h2>`;

const uiHeaderReplacement = `      {/* New Month Prompt */}
      {showNewMonthPrompt && (
        <div className="animate-fade-in stagger-1" style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', borderRadius: '12px', padding: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <AlertTriangle size={24} color="#ef4444" />
            <div>
              <h3 style={{ margin: 0, color: '#ef4444', fontWeight: 600, fontSize: '1.1rem' }}>A new month has started!</h3>
              <p style={{ margin: 0, color: 'var(--muted-foreground)', fontSize: '0.875rem', marginTop: '0.25rem' }}>You are currently viewing last month's data. Renew your dashboard to track current month metrics.</p>
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
        <h2 className="heading-2 stagger-1" style={{ marginBottom: '1rem', fontSize: '1.25rem', color: 'var(--foreground)' }}>Executive Dashboard</h2>`;

code = code.replace(uiHeaderTarget, uiHeaderReplacement);

fs.writeFileSync('src/app/dashboard/page.js', code);
console.log('Done!');
