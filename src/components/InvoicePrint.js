'use client';

import React from 'react';

const InvoicePrint = React.forwardRef(({ invoice, items }, ref) => {
  if (!invoice) return null;

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const options = { year: 'numeric', month: 'long', day: '2-digit' };
    return new Date(dateString).toLocaleDateString('en-US', options);
  };

  return (
    <div 
      ref={ref} 
      style={{
        padding: '2rem',
        background: 'white',
        color: '#1a1a1a',
        fontFamily: '"Inter", "Roboto", "Helvetica Neue", Arial, sans-serif',
        width: '100%',
        maxWidth: '800px',
        margin: '0 auto',
        boxSizing: 'border-box',
        position: 'relative',
        WebkitPrintColorAdjust: 'exact',
        printColorAdjust: 'exact'
      }}
    >
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '40px' }}>
        <h1 style={{ 
          fontSize: '64px', 
          fontWeight: 900, 
          color: '#243c64', 
          margin: 0, 
          letterSpacing: '2px',
          textTransform: 'uppercase'
        }}>
          INVOICE
        </h1>
      </div>

      {/* Invoice Details */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '30px' }}>
        <div>
          <p style={{ fontWeight: 600, color: '#4a5568', margin: '0 0 10px 0', fontSize: '14px' }}>Invoice To :</p>
          <h3 style={{ fontSize: '20px', fontWeight: 700, color: '#243c64', margin: '0 0 8px 0' }}>
            {invoice.CUSTOMER_NAME || 'Walk-in Customer'}
          </h3>
          <p style={{ margin: '0 0 4px 0', fontSize: '14px', fontWeight: 600 }}>{invoice.CUSTOMER_PHONE}</p>
          <p style={{ margin: 0, fontSize: '14px', color: '#4a5568', maxWidth: '250px' }}>
            {invoice.CUSTOMER_ADDRESS}
          </p>
        </div>
        <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          <p style={{ fontWeight: 600, color: '#4a5568', margin: '0 0 8px 0', fontSize: '14px' }}>Invoice Date :</p>
          <p style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#243c64' }}>
            {formatDate(invoice.CREATED_AT)}
          </p>
        </div>
      </div>

      {/* Table */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '40px' }}>
        <thead>
          <tr>
            <th style={{ 
              background: '#243c64', 
              color: 'white', 
              padding: '12px 16px', 
              textAlign: 'left',
              fontWeight: 600,
              fontSize: '14px',
              borderTopLeftRadius: '6px'
            }}>
              DESCRIPTION
            </th>
            <th style={{ 
              background: '#243c64', 
              color: 'white', 
              padding: '12px 16px', 
              textAlign: 'center',
              fontWeight: 600,
              fontSize: '14px'
            }}>
              QTY
            </th>
            <th style={{ 
              background: '#243c64', 
              color: 'white', 
              padding: '12px 16px', 
              textAlign: 'right',
              fontWeight: 600,
              fontSize: '14px',
              borderTopRightRadius: '6px'
            }}>
              TOTAL
            </th>
          </tr>
        </thead>
        <tbody>
          {items && items.map((item, idx) => (
            <tr key={idx}>
              <td style={{ 
                padding: '16px', 
                borderBottom: '1px solid #243c64',
                fontWeight: 600,
                color: '#243c64',
                fontSize: '14px'
              }}>
                {item.DESCRIPTION}
              </td>
              <td style={{ 
                padding: '16px', 
                borderBottom: '1px solid #243c64',
                textAlign: 'center',
                fontWeight: 600,
                color: '#243c64',
                fontSize: '14px'
              }}>
                {item.QTY}
              </td>
              <td style={{ 
                padding: '16px', 
                borderBottom: '1px solid #243c64',
                textAlign: 'right',
                fontWeight: 600,
                color: '#243c64',
                fontSize: '14px'
              }}>
                Ksh {item.TOTAL_PRICE?.toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals & Footer Info */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        
        {/* Left Side: Terms and Contact */}
        <div style={{ width: '50%' }}>
          <div style={{ marginBottom: '30px' }}>
            <h4 style={{ fontWeight: 600, color: '#243c64', margin: '0 0 8px 0', fontSize: '14px' }}>Terms & Conditions</h4>
            <p style={{ margin: 0, fontSize: '13px', color: '#4a5568', lineHeight: '1.5' }}>
              All invoices are due upon receipt unless otherwise specified. 
              Returns are accepted within 7 days with original receipt and 
              packaging. Electrical parts are non-returnable.
            </p>
          </div>

          <div>
            <p style={{ fontWeight: 600, color: '#243c64', margin: '0 0 4px 0', fontSize: '14px' }}>Phone Number :</p>
            <p style={{ margin: '0 0 16px 0', fontSize: '14px', color: '#4a5568' }}>0725599999</p>
            
            <p style={{ fontWeight: 600, color: '#243c64', margin: '0 0 4px 0', fontSize: '14px' }}>Address :</p>
            <p style={{ margin: 0, fontSize: '14px', color: '#4a5568' }}>Po. Box 1936, Kakamega</p>
          </div>
        </div>

        {/* Right Side: Totals and Signature */}
        <div style={{ width: '40%' }}>
          <div style={{ marginBottom: '40px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 16px' }}>
              <span style={{ fontWeight: 600, color: '#243c64', fontSize: '14px' }}>Sub-total :</span>
              <span style={{ fontWeight: 700, color: '#243c64', fontSize: '14px' }}>Ksh {invoice.SUBTOTAL?.toLocaleString()}</span>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 16px', borderBottom: '1px solid #243c64', marginBottom: '12px' }}>
              <span style={{ fontWeight: 600, color: '#243c64', fontSize: '14px' }}>Tax :</span>
              <span style={{ fontWeight: 700, color: '#243c64', fontSize: '14px' }}>Ksh {invoice.TAX_AMOUNT?.toLocaleString()}</span>
            </div>

            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              padding: '12px 16px',
              background: '#243c64',
              color: 'white',
              borderRadius: '6px'
            }}>
              <span style={{ fontWeight: 600, fontSize: '16px' }}>Total :</span>
              <span style={{ fontWeight: 700, fontSize: '16px' }}>Ksh {invoice.GRAND_TOTAL?.toLocaleString()}</span>
            </div>
          </div>

          <div style={{ textAlign: 'center', marginTop: '60px' }}>
            <div style={{ 
              borderBottom: '1px solid #4a5568', 
              width: '100%', 
              height: '40px',
              marginBottom: '8px',
              position: 'relative'
            }}>
              {/* Optional Signature image can go here */}
            </div>
            <p style={{ margin: 0, fontWeight: 600, color: '#243c64', fontSize: '14px' }}>Administrator</p>
          </div>
        </div>

      </div>
    </div>
  );
});

InvoicePrint.displayName = 'InvoicePrint';

export default InvoicePrint;
