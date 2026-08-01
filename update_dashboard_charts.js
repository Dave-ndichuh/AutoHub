const fs = require('fs');

let code = fs.readFileSync('src/app/dashboard/page.js', 'utf8');

// Normalize line endings
code = code.replace(/\r\n/g, '\n');

const metricsAssignTarget = `        // Calculations
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

const metricsAssignReplacement = `        // Calculations
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
        }`;
        
code = code.replace(metricsAssignTarget, metricsAssignReplacement);

const topPTarget = `const topP = Object.values(productSales).sort((a, b) => b.qty - a.qty)[0] || { name: 'N/A', units: 0 };`;
code = code.replace(topPTarget, "");

const transQueryTarget = `        // Fetch transactions for this month WITH details for profit math (ONLY IF NOT ALL TIME, TO SAVE BANDWIDTH)
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

const transQueryReplacement = `        // For the trend chart, we only ever need the LAST 7 DAYS.
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

code = code.replace(transQueryTarget, transQueryReplacement);

const forEachTarget = `            // Payment Methods
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
            }`;
code = code.replace(forEachTarget, `            // Payment methods and top product are now handled by RPC.`);

fs.writeFileSync('src/app/dashboard/page.js', code);
console.log('Done replacing charts logic!');
