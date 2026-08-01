const fs = require('fs');

let code = fs.readFileSync('src/app/dashboard/page.js', 'utf8');

// Normalize line endings
code = code.replace(/\r\n/g, '\n');

const fetchStartTarget = `      const sevenDaysAgo = new Date(today);
      sevenDaysAgo.setDate(today.getDate() - 6); // Last 7 days including today
      
      try {
        // Fetch metrics via RPC first
        const { data: rpcMetrics } = await supabase.rpc('get_dashboard_metrics', {
          start_date: startDate,
          end_date: endDate,
          p_branch_id: branchId === 'ALL' ? null : branchId
        });

        // Fetch all products for stock value & low stock
        let prodQuery = supabase.from('product').select('PRODUCT_ID, NAME, ON_HAND, COST_PRICE');
        if (branchId && branchId !== 'ALL') {
          prodQuery = prodQuery.eq('BRANCH_ID', branchId);
        }
        const { data: products } = await prodQuery;
        
        // Fetch Credit Ledger Data
        let acctQuery = supabase.from('credit_accounts').select('current_balance');
        if (branchId && branchId !== 'ALL') {
          acctQuery = acctQuery.eq('branch_id', branchId);
        }
        const { data: accounts } = await acctQuery;
        
        let arTotal = 0;
        if (accounts) accounts.forEach(a => arTotal += Number(a.current_balance));

        let ctQuery = supabase.from('credit_transactions').select('type, amount, reference_type');
        if (startDate) ctQuery = ctQuery.gte('date', startDate);
        if (endDate) ctQuery = ctQuery.lte('date', endDate);
        if (branchId && branchId !== 'ALL') {
          ctQuery = ctQuery.eq('branch_id', branchId);
        }
        const { data: creditTrans } = await ctQuery;
        let creditSalesMonth = 0;
        let creditPaymentsMonth = 0;
        if (creditTrans) {
           creditTrans.forEach(ct => {
             if (ct.type === 'debit') {
               if (ct.reference_type === 'adjustment') {
                 creditPaymentsMonth -= Number(ct.amount); // Refund of payment reduces total payments received
               } else {
                 creditSalesMonth += Number(ct.amount); // Normal debt/sale increases
               }
             } else if (ct.type === 'credit') {
               if (ct.reference_type === 'adjustment') {
                 creditSalesMonth -= Number(ct.amount); // Reversal of sale reduces total credit sales
               } else {
                 creditPaymentsMonth += Number(ct.amount); // Normal payment
               }
             }
           });
        }

        let stockVal = 0;
        let lowStock = 0;
        let outOfStock = 0;
        if (products) {
          products.forEach(p => {
            const onHand = Number(p.ON_HAND) || 0;
            const cost = Number(p.COST_PRICE) || 0;
            if (onHand > 0) stockVal += (onHand * cost);
            if (onHand <= 5 && onHand > 0) lowStock++;
            if (onHand <= 0) outOfStock++;
          });
        }

        // For the trend chart, we only ever need the LAST 7 DAYS.
        let currentMonthTrans = [];
        let trendQuery = supabase
          .from('transaction')
          .select('CREATED_AT, ADJUSTED_TOTAL, GRAND_TOTAL, status')
          .gte('CREATED_AT', sevenDaysAgo.toISOString())
          .or('IS_CREDIT.eq.false,IS_SETTLED.eq.true')
          .order('CREATED_AT', { ascending: true });
          
        if (branchId && branchId !== 'ALL') trendQuery = trendQuery.eq('BRANCH_ID', branchId);
        
        const { data: trendDataRaw } = await trendQuery;
        currentMonthTrans = trendDataRaw || [];`;


const fetchReplacement = `      const sevenDaysAgo = new Date(today);
      sevenDaysAgo.setDate(today.getDate() - 6); // Last 7 days including today
      
      try {
        let trendQuery = supabase
          .from('transaction')
          .select('CREATED_AT, ADJUSTED_TOTAL, GRAND_TOTAL, status')
          .gte('CREATED_AT', sevenDaysAgo.toISOString())
          .or('IS_CREDIT.eq.false,IS_SETTLED.eq.true')
          .order('CREATED_AT', { ascending: true });
          
        if (branchId && branchId !== 'ALL') trendQuery = trendQuery.eq('BRANCH_ID', branchId);

        const branchParam = branchId === 'ALL' ? null : branchId;

        // Concurrent fetching with Promise.all
        const [
          { data: rpcMetrics },
          { data: invMetrics },
          { data: creditMetrics },
          { data: trendDataRaw }
        ] = await Promise.all([
          supabase.rpc('get_dashboard_metrics', { start_date: startDate, end_date: endDate, p_branch_id: branchParam }),
          supabase.rpc('get_inventory_metrics', { p_branch_id: branchParam }),
          supabase.rpc('get_credit_metrics', { start_date: startDate, end_date: endDate, p_branch_id: branchParam }),
          trendQuery
        ]);

        let currentMonthTrans = trendDataRaw || [];
        
        let stockVal = Number(invMetrics?.stockValue) || 0;
        let lowStock = Number(invMetrics?.lowStockCount) || 0;
        let outOfStock = Number(invMetrics?.outOfStockCount) || 0;
        
        let arTotal = Number(creditMetrics?.arTotal) || 0;
        let creditSalesMonth = Number(creditMetrics?.creditSalesMonth) || 0;
        let creditPaymentsMonth = Number(creditMetrics?.creditPaymentsMonth) || 0;`;

code = code.replace(fetchStartTarget, fetchReplacement);

if (code.includes(fetchStartTarget)) {
  console.log("Failed to replace fetch data block.");
} else if (code.includes(fetchReplacement)) {
  console.log("Replaced fetch data block.");
} else {
  console.log("Could not find target or replacement.");
}

fs.writeFileSync('src/app/dashboard/page.js', code);
