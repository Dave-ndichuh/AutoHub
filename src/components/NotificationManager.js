'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { AlertTriangle, Info, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';

export default function NotificationManager({ children }) {
  const router = useRouter();
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    const checkCreditDueDates = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: unsettledCredits, error } = await supabase
        .from('transaction')
        .select(`
          TRANS_ID,
          CREDIT_DUE_DATE,
          ADJUSTED_TOTAL,
          GRAND_TOTAL,
          credit_customer:customer!transaction_CREDIT_CUSTOMER_ID_fkey(FIRST_NAME, LAST_NAME)
        `)
        .eq('IS_CREDIT', true)
        .eq('IS_SETTLED', false)
        .not('CREDIT_DUE_DATE', 'is', null);

      if (error || !unsettledCredits) return;

      const newNotifications = [];
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      unsettledCredits.forEach(sale => {
        const dueDate = new Date(sale.CREDIT_DUE_DATE);
        dueDate.setHours(0, 0, 0, 0);

        const diffTime = dueDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        const amount = sale.ADJUSTED_TOTAL || sale.GRAND_TOTAL;
        const customerName = sale.credit_customer ? `${sale.credit_customer.FIRST_NAME} ${sale.credit_customer.LAST_NAME}` : 'Unknown Customer';

        if (diffDays < 0) {
          newNotifications.push({
            id: `overdue-${sale.TRANS_ID}`,
            transId: sale.TRANS_ID,
            type: 'danger',
            title: 'Credit Overdue!',
            message: `${customerName} is overdue on Ksh ${amount.toLocaleString()} (Due: ${dueDate.toLocaleDateString()})`
          });
        } else if (diffDays === 0) {
          newNotifications.push({
            id: `due-today-${sale.TRANS_ID}`,
            transId: sale.TRANS_ID,
            type: 'warning',
            title: 'Credit Due Today',
            message: `${customerName} owes Ksh ${amount.toLocaleString()} today.`
          });
        } else if (diffDays <= 3 && diffDays > 0) {
          newNotifications.push({
            id: `upcoming-${sale.TRANS_ID}`,
            transId: sale.TRANS_ID,
            type: 'info',
            title: 'Upcoming Credit Due',
            message: `${customerName} owes Ksh ${amount.toLocaleString()} in ${diffDays} days.`
          });
        }
      });

      setNotifications(newNotifications);
    };

    checkCreditDueDates();
    
    // Periodically recheck every hour
    const interval = setInterval(checkCreditDueDates, 1000 * 60 * 60);
    return () => clearInterval(interval);
  }, []);

  const dismiss = (id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  return (
    <>
      {children}
      <div style={{ position: 'fixed', top: '1.5rem', right: '1.5rem', zIndex: 9999, display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: '350px', width: '100%', pointerEvents: 'none' }}>
        <AnimatePresence>
          {notifications.map(notif => (
              <motion.div
              key={notif.id}
              initial={{ opacity: 0, x: 50, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
              className="glass"
              onClick={() => {
                router.push(`/transactions?searchId=${notif.transId}`);
                dismiss(notif.id);
              }}
              whileHover={{ scale: 1.02 }}
              style={{
                padding: '1rem',
                borderLeft: `4px solid ${notif.type === 'danger' ? '#ef4444' : notif.type === 'warning' ? '#f59e0b' : '#3b82f6'}`,
                display: 'flex',
                gap: '1rem',
                alignItems: 'flex-start',
                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
                pointerEvents: 'auto',
                background: 'var(--card)',
                cursor: 'pointer'
              }}
            >
              <div style={{ color: notif.type === 'danger' ? '#ef4444' : notif.type === 'warning' ? '#f59e0b' : '#3b82f6', marginTop: '0.125rem' }}>
                {notif.type === 'info' ? <Info size={20} /> : <AlertTriangle size={20} />}
              </div>
              <div style={{ flex: 1 }}>
                <h4 style={{ margin: '0 0 0.25rem 0', fontWeight: 600, fontSize: '0.95rem', color: 'var(--foreground)' }}>{notif.title}</h4>
                <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--muted-foreground)', lineHeight: '1.4' }}>{notif.message}</p>
              </div>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  dismiss(notif.id);
                }} 
                style={{ background: 'transparent', border: 'none', color: 'var(--muted-foreground)', cursor: 'pointer', padding: '0.25rem', display: 'flex' }}
              >
                <X size={16} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </>
  );
}
