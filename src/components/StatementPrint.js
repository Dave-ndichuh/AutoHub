import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

export default function StatementPrint({ account, transactions }) {
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!account || !mounted) return null;

  const dateStr = new Date().toLocaleDateString();
  const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const printContent = (
    <div className="statement-print-area">
      <div className="statement-header">
        <div className="company-details">
          <h2 className="company-name">Jobea Auto Spares</h2>
          <p>Maziwa road</p>
          <p>Po. Box 1936, Kakamega</p>
          <p>Tel: 0725599999</p>
        </div>
        <div className="statement-title">
          <h2>STATEMENT OF ACCOUNT</h2>
          <p><strong>Date:</strong> {dateStr} {timeStr}</p>
        </div>
      </div>

      <div className="customer-details">
        <div>
          <p><strong>Customer Name:</strong> {account.customer?.FIRST_NAME} {account.customer?.LAST_NAME}</p>
          {account.customer?.PHONE && <p><strong>Phone:</strong> {account.customer?.PHONE}</p>}
        </div>
        <div className="account-summary">
          <p><strong>Credit Limit:</strong> Ksh. {Number(account.credit_limit).toLocaleString()}</p>
          <p><strong>Current Debt:</strong> Ksh. {Number(account.current_balance).toLocaleString()}</p>
          <p><strong>Available Credit:</strong> Ksh. {Math.max(0, account.credit_limit - account.current_balance).toLocaleString()}</p>
        </div>
      </div>

      <table className="statement-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Description</th>
            <th style={{ textAlign: 'right' }}>Debit</th>
            <th style={{ textAlign: 'right' }}>Credit</th>
            <th style={{ textAlign: 'right' }}>Balance</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((tr, idx) => (
            <React.Fragment key={idx}>
              <tr>
                <td style={{ verticalAlign: 'top' }}>{new Date(tr.dateStr).toLocaleDateString()}</td>
                <td style={{ verticalAlign: 'top' }}>
                  {tr.description}
                  {tr.items && tr.items.length > 0 && (
                    <div style={{ marginTop: '2mm', fontSize: '9pt', color: '#4b5563' }}>
                      <strong>Items included:</strong>
                      <ul style={{ margin: '1mm 0 0 0', paddingLeft: '4mm' }}>
                        {tr.items.map((item, i) => (
                          <li key={i}>
                            {item.QTY}x {item.product?.NAME} {item.product?.BRAND ? `(${item.product.BRAND})` : ''} @ Ksh. {Number(item.UNIT_PRICE).toLocaleString()}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </td>
                <td style={{ textAlign: 'right', verticalAlign: 'top' }}>{tr.debit ? `Ksh. ${Number(tr.debit).toLocaleString()}` : '-'}</td>
                <td style={{ textAlign: 'right', verticalAlign: 'top' }}>{tr.credit ? `Ksh. ${Number(tr.credit).toLocaleString()}` : '-'}</td>
                <td style={{ textAlign: 'right', verticalAlign: 'top' }}><strong>Ksh. {tr.balance.toLocaleString()}</strong></td>
              </tr>
            </React.Fragment>
          ))}
        </tbody>
      </table>

      <div className="statement-footer">
        <p>This is a computer-generated document. No signature is required.</p>
        <p>Thank you for your business!</p>
      </div>

      <style jsx global>{`
        .statement-print-area {
          display: none;
        }

        @media print {
          @page {
            margin: 10mm;
            size: A4 portrait;
          }

          body > *:not(.statement-print-area) {
            display: none !important;
          }

          html, body {
            background-color: #ffffff !important;
            color: #000000 !important;
            margin: 0;
            padding: 0;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          .statement-print-area {
            display: block !important;
            width: 100%;
            font-family: 'Inter', 'Helvetica Neue', Helvetica, Arial, sans-serif;
            font-size: 10pt;
            color: #000;
          }

          .statement-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 2px solid #000;
            padding-bottom: 5mm;
            margin-bottom: 5mm;
          }

          .company-name {
            font-size: 18pt;
            font-weight: 800;
            margin: 0 0 2mm 0;
            text-transform: uppercase;
          }

          .company-details p, .statement-title p {
            margin: 0 0 1mm 0;
          }

          .statement-title h2 {
            font-size: 16pt;
            margin: 0 0 2mm 0;
            text-align: right;
            text-decoration: underline;
          }
          .statement-title p {
            text-align: right;
          }

          .customer-details {
            display: flex;
            justify-content: space-between;
            margin-bottom: 5mm;
            padding: 3mm;
            background: #f9fafb !important;
            border: 1px solid #e5e7eb;
            border-radius: 4px;
          }

          .customer-details p {
            margin: 0 0 2mm 0;
          }

          .account-summary {
            text-align: right;
          }

          .statement-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 5mm;
          }

          .statement-table th {
            background-color: #f3f4f6 !important;
            padding: 2mm;
            text-align: left;
            border-bottom: 2px solid #000;
            font-weight: bold;
          }

          .statement-table td {
            padding: 2mm;
            border-bottom: 1px solid #e5e7eb;
          }

          .statement-footer {
            text-align: center;
            margin-top: 10mm;
            font-size: 9pt;
            color: #4b5563 !important;
            border-top: 1px dashed #d1d5db;
            padding-top: 5mm;
          }
        }
      `}</style>
    </div>
  );

  return createPortal(printContent, document.body);
}
