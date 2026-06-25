import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

export default function Receipt({ transaction, cart, subtotal, vat, grandTotal }) {
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!transaction || !mounted) return null;

  // Extract dynamic metadata
  const trxDate = transaction.CREATED_AT ? new Date(transaction.CREATED_AT) : new Date();
  const dateStr = trxDate.toLocaleDateString();
  const timeStr = trxDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const cashierId = transaction.EMPLOYEE_ID ? `EMP-${transaction.EMPLOYEE_ID}` : 'Admin';
  
  const paymentMethod = transaction.PAYMENT_METHOD || 'Cash';
  const cashAmt = Number(transaction.CASH_AMOUNT) || 0;
  const mpesaAmt = Number(transaction.MPESA_AMOUNT) || 0;
  
  // NOTE: DISCOUNT_AMOUNT in DB is negative for surcharge, positive for discount
  const discountAmt = Number(transaction.DISCOUNT_AMOUNT) || 0;
  
  const isCredit = transaction.IS_CREDIT;
  const creditDueDate = transaction.CREDIT_DUE_DATE;

  const receiptContent = (
    <div className="receipt-print-area">
      {/* 1. Brand & Header Block */}
      <div className="receipt-header">
        <h2 className="receipt-store-name">Jobea Auto Spares</h2>
        <p className="receipt-store-meta">Maziwa road</p>
        <p className="receipt-store-meta">Po. Box 1936, Kakamega</p>
        <p className="receipt-store-meta">Tel: 0725599999</p>
      </div>

      <div className="receipt-divider" />

      {/* 2. Metadata Block */}
      <div className="receipt-meta">
        <div className="meta-row">
          <span>Receipt #:</span>
          <span className="meta-val">TRX-{transaction.TRANS_ID}</span>
        </div>
        <div className="meta-row">
          <span>Date:</span>
          <span className="meta-val">{dateStr} {timeStr}</span>
        </div>
        <div className="meta-row">
          <span>Cashier:</span>
          <span className="meta-val">{cashierId}</span>
        </div>
        <div className="meta-row">
          <span>Payment:</span>
          <span className="meta-val">{paymentMethod}</span>
        </div>
        {isCredit && creditDueDate && (
          <div className="meta-row">
            <span>Due Date:</span>
            <span className="meta-val">{new Date(creditDueDate).toLocaleDateString()}</span>
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
          {cart.map((item, idx) => (
            <tr key={idx} className="item-row">
              <td className="col-item">{item.NAME}</td>
              <td className="col-qty">{item.quantity}</td>
              <td className="col-total">{(item.PRICE * item.quantity).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="receipt-divider" />

      {/* 4. Totals Block */}
      <div className="receipt-totals">
        <div className="total-row">
          <span>Subtotal</span>
          <span>{subtotal.toLocaleString()}</span>
        </div>

        {discountAmt !== 0 && (
          <div className="total-row">
            <span>{discountAmt > 0 ? 'Discount' : 'Surcharge'}</span>
            <span>{discountAmt > 0 ? '-' : '+'} {Math.abs(discountAmt).toLocaleString()}</span>
          </div>
        )}

        {vat > 0 && (
          <div className="total-row">
            <span>VAT</span>
            <span>{vat.toLocaleString()}</span>
          </div>
        )}

        <div className="total-row grand-total">
          <span>TOTAL</span>
          <span>Ksh {grandTotal.toLocaleString()}</span>
        </div>
      </div>

      {/* Optional Split Payment Details */}
      {paymentMethod === 'Hybrid' && (
        <div className="receipt-hybrid">
          <div className="receipt-divider" />
          <div className="meta-row">
            <span>Paid via Cash:</span>
            <span>{cashAmt.toLocaleString()}</span>
          </div>
          <div className="meta-row">
            <span>Paid via M-Pesa:</span>
            <span>{mpesaAmt.toLocaleString()}</span>
          </div>
        </div>
      )}

      {/* 5. Footer Block */}
      <div className="receipt-footer">
        <p>Thank you for your business!</p>
        <p>NB Goods once sold Will not be re-accepted</p>
        <p>No warranty!</p>
      </div>

      <style jsx global>{`
        /* SCREEN PREVIEW - Hides receipt unless actively debugging */
        .receipt-print-area {
          display: none; 
        }

        /* PRINT STYLES - Thermal specific constraints */
        @media print {
          @page {
            margin: 0;
            size: auto;
          }

          /* Completely hide the main application to prevent blank pages */
          body > *:not(.receipt-print-area) {
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
            margin: 0 auto;
            padding: 2mm 4mm;
            background: #ffffff !important;
            color: #000000 !important;
            font-family: 'Inter', 'Helvetica Neue', Helvetica, Arial, sans-serif;
            font-size: 11pt;
            line-height: 1.3;
            box-sizing: border-box;
          }

          /* Header */
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

          /* Dividers */
          .receipt-divider {
            border-top: 1px dashed #000;
            margin: 3mm 0;
            width: 100%;
          }

          /* Metadata */
          .receipt-meta {
            font-size: 9pt;
            margin-bottom: 3mm;
          }
          .meta-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 1mm;
          }
          .meta-val {
            font-weight: 600;
            text-align: right;
          }

          /* Items Table */
          .receipt-items {
            width: 100%;
            border-collapse: collapse;
            font-size: 10pt;
            margin-bottom: 2mm;
          }
          .receipt-items th {
            text-align: left;
            font-weight: 600;
            border-bottom: 1px dashed #000;
            padding-bottom: 1.5mm;
          }
          .receipt-items td {
            padding: 1.5mm 0;
            vertical-align: top;
          }
          .item-row {
            page-break-inside: avoid;
          }
          .col-item {
            width: 60%;
            padding-right: 2mm;
            word-wrap: break-word;
            overflow-wrap: break-word;
          }
          .col-qty {
            width: 15%;
            text-align: center;
          }
          .col-total {
            width: 25%;
            text-align: right;
            font-weight: 600;
          }

          /* Totals */
          .receipt-totals {
            page-break-inside: avoid;
            margin-top: 2mm;
          }
          .total-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 1mm;
            font-size: 10pt;
          }
          .grand-total {
            font-size: 14pt;
            font-weight: 800;
            margin-top: 2mm;
            padding-top: 2mm;
            border-top: 2px solid #000; /* Solid line for explicit emphasis */
          }

          /* Hybrid */
          .receipt-hybrid {
            page-break-inside: avoid;
            font-size: 9pt;
            margin-top: 2mm;
          }

          /* Footer */
          .receipt-footer {
            text-align: center;
            font-size: 9pt;
            margin-top: 6mm;
            page-break-inside: avoid;
          }
          .receipt-footer p {
            margin: 0 0 1mm 0;
          }
          .receipt-signature {
            margin-top: 2mm !important;
            font-weight: 600;
            font-size: 8pt;
          }
      `}</style>
    </div>
  );

  return createPortal(receiptContent, document.body);
}
