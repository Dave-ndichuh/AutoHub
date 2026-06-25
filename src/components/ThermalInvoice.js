import React, { useEffect, useState } from 'react';

const ThermalInvoice = React.forwardRef(({ invoice, items }, ref) => {
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!invoice || !mounted) return null;

  const invoiceDate = invoice.CREATED_AT ? new Date(invoice.CREATED_AT) : new Date();
  const dateStr = invoiceDate.toLocaleDateString();
  const timeStr = invoiceDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="receipt-print-area" ref={ref}>
      {/* 1. Brand & Header Block */}
      <div className="receipt-header">
        <h2 className="receipt-store-name">Jobea Auto Spares</h2>
        <p className="receipt-store-meta">Maziwa road</p>
        <p className="receipt-store-meta">Po. Box 1936, Kakamega</p>
        <p className="receipt-store-meta">Tel: 0725599999</p>
        
        <h3 style={{ marginTop: '10px', fontSize: '14pt', borderBottom: '1px solid black', display: 'inline-block' }}>
          INVOICE
        </h3>
      </div>

      <div className="receipt-divider" />

      {/* 2. Metadata Block */}
      <div className="receipt-meta">
        <div className="meta-row">
          <span>Date:</span>
          <span className="meta-val">{dateStr} {timeStr}</span>
        </div>
        <div className="meta-row" style={{ marginTop: '5px' }}>
          <span>Customer:</span>
          <span className="meta-val">{invoice.CUSTOMER_NAME || 'Walk-in'}</span>
        </div>
        {invoice.CUSTOMER_PHONE && (
          <div className="meta-row">
            <span>Phone:</span>
            <span className="meta-val">{invoice.CUSTOMER_PHONE}</span>
          </div>
        )}
        {invoice.CUSTOMER_ADDRESS && (
          <div className="meta-row">
            <span>Address:</span>
            <span className="meta-val" style={{ textAlign: 'right', maxWidth: '120px' }}>{invoice.CUSTOMER_ADDRESS}</span>
          </div>
        )}
      </div>

      <div className="receipt-divider" />

      {/* 3. Items Block */}
      <table className="receipt-items">
        <thead>
          <tr>
            <th className="col-item">Item</th>
            <th className="col-qty">Qty</th>
            <th className="col-total">Total</th>
          </tr>
        </thead>
        <tbody>
          {items && items.map((item, idx) => (
            <tr key={idx} className="item-row">
              <td className="col-item">{item.DESCRIPTION}</td>
              <td className="col-qty">{item.QTY}</td>
              <td className="col-total">{item.TOTAL_PRICE?.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="receipt-divider" />

      {/* 4. Totals Block */}
      <div className="receipt-totals">
        <div className="total-row">
          <span>Subtotal</span>
          <span>{invoice.SUBTOTAL?.toLocaleString()}</span>
        </div>

        <div className="total-row grand-total">
          <span>TOTAL</span>
          <span>Ksh {invoice.GRAND_TOTAL?.toLocaleString()}</span>
        </div>
      </div>

      <div className="receipt-divider" />

      {/* 5. Footer Block */}
      <div className="receipt-footer">
        <p>Thank you for your business!</p>
        <p>This is a standalone invoice. Goods remain property of Jobea Auto Spares until settled.</p>
        <p style={{ marginTop: '5px', fontWeight: 'bold' }}>NB Goods once sold Will not be re-accepted</p>
        <p style={{ fontWeight: 'bold' }}>No warranty!</p>
      </div>

      <style jsx global>{`
        /* Reuse the same CSS pattern as Receipt.js for consistency */
        .receipt-print-area {
          display: none; 
        }

        @media print {
          @page {
            margin: 0;
            size: auto;
          }

          body > *:not(#print-invoice-area) {
            display: none !important;
          }
          
          body {
            background: #ffffff !important;
            margin: 0;
            padding: 0;
            color: #000000 !important;
          }
          
          .receipt-print-area {
            display: block !important;
            width: 80mm; 
            max-width: 100%;
            padding: 2mm 4mm;
            background: #ffffff !important;
            color: #000000 !important;
            font-family: 'Inter', 'Helvetica Neue', Helvetica, Arial, sans-serif;
            font-size: 11pt;
            line-height: 1.3;
            box-sizing: border-box;
          }

          .receipt-header {
            text-align: center;
            margin-bottom: 3mm;
          }
          .receipt-store-name {
            margin: 0 0 1mm 0;
            font-size: 14pt;
            font-weight: 800;
            letter-spacing: 0.5px;
            text-transform: uppercase;
            color: #000000 !important;
          }
          .receipt-store-meta {
            margin: 0;
            font-size: 9pt;
            color: #000000 !important;
          }

          .receipt-divider {
            border-top: 1px dashed #000;
            margin: 3mm 0;
            width: 100%;
          }

          .receipt-meta {
            margin-bottom: 3mm;
            font-size: 10pt;
          }
          .meta-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 0.5mm;
          }
          .meta-val {
            font-weight: 600;
          }

          .receipt-items {
            width: 100%;
            border-collapse: collapse;
            font-size: 10pt;
            margin-bottom: 3mm;
          }
          .receipt-items th {
            text-align: left;
            border-bottom: 1px dashed #000;
            padding-bottom: 1mm;
          }
          .col-item {
            width: 55%;
          }
          .col-qty {
            width: 15%;
            text-align: center;
          }
          .col-total {
            width: 30%;
            text-align: right;
          }
          .item-row td {
            padding: 1.5mm 0;
            vertical-align: top;
          }
          .col-qty, .col-total {
            text-align: right;
          }
          .item-row .col-qty {
            text-align: center;
          }

          .receipt-totals {
            margin-bottom: 3mm;
          }
          .total-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 1mm;
            font-size: 11pt;
          }
          .grand-total {
            font-weight: 800;
            font-size: 14pt;
            margin-top: 2mm;
            padding-top: 2mm;
            border-top: 1px dashed #000;
          }

          .receipt-footer {
            text-align: center;
            font-size: 9pt;
            margin-top: 4mm;
            margin-bottom: 10mm; 
          }
          .receipt-footer p {
            margin: 0 0 1mm 0;
          }
        }
      `}</style>
    </div>
  );
});

ThermalInvoice.displayName = 'ThermalInvoice';

export default ThermalInvoice;
