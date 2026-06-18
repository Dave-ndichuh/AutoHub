'use client';

import { useState, useEffect } from 'react';
import { X, Download, Share } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function InstallPrompt() {
  const [isMobile, setIsMobile] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    // Check if user dismissed previously
    if (localStorage.getItem('hasDismissedInstallPrompt')) return;

    // Check if mobile device
    const checkMobile = () => window.innerWidth < 768;
    setIsMobile(checkMobile());
    
    const handleResize = () => setIsMobile(checkMobile());
    window.addEventListener('resize', handleResize);

    // Detect iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIosDevice);

    // Detect if already installed (standalone mode)
    const checkStandalone = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    setIsStandalone(checkStandalone());

    if (checkStandalone()) return;

    // Listen for Chrome install prompt
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      if (checkMobile()) setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // For iOS, if mobile and not standalone, show prompt after a short delay
    if (isIosDevice && checkMobile() && !checkStandalone()) {
      setTimeout(() => setShowPrompt(true), 2000);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowPrompt(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('hasDismissedInstallPrompt', 'true');
  };

  if (!isMobile || isStandalone || !showPrompt) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        style={{
          position: 'fixed',
          bottom: '2rem',
          left: '1rem',
          right: '1rem',
          background: 'var(--card)',
          backdropFilter: 'blur(16px)',
          border: '1px solid var(--primary)',
          borderRadius: '16px',
          padding: '1.25rem',
          boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem'
        }}
      >
        <button 
          onClick={handleDismiss}
          style={{ position: 'absolute', top: '0.75rem', right: '0.75rem', color: 'var(--muted-foreground)', cursor: 'pointer', display: 'flex', background: 'transparent', border: 'none' }}
        >
          <X size={18} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', paddingRight: '1rem' }}>
          <img src="/logo.png" alt="App Icon" style={{ width: '48px', height: '48px', borderRadius: '12px', objectFit: 'cover', background: '#fff' }} />
          <div>
            <h4 style={{ margin: '0 0 0.25rem 0', fontWeight: 600, color: 'var(--foreground)' }}>Install Jobea POS</h4>
            <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--muted-foreground)' }}>Add to home screen for faster access.</p>
          </div>
        </div>

        {isIOS ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(59, 130, 246, 0.1)', padding: '0.75rem', borderRadius: '8px', color: 'var(--primary)', fontSize: '0.875rem' }}>
            <Share size={18} />
            <span>Tap <b>Share</b> below and select <b>Add to Home Screen</b>.</span>
          </div>
        ) : deferredPrompt ? (
          <button 
            onClick={handleInstallClick}
            className="btn btn-primary"
            style={{ width: '100%', padding: '0.75rem', fontWeight: 600 }}
          >
            <Download size={18} />
            Install App Now
          </button>
        ) : null}

      </motion.div>
    </AnimatePresence>
  );
}
