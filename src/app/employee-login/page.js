'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Loader2, ArrowLeft, User, KeyRound, Delete } from 'lucide-react';
import Link from 'next/link';
import InstallPrompt from '@/components/InstallPrompt';
import { logAction } from '@/lib/logger';
import { useBranch } from '@/context/BranchContext';

export default function EmployeeLoginPage() {
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const branchParam = searchParams.get('branch');
  const { setBranch } = useBranch();

  const handleKeypadPress = (num) => {
    if (pin.length < 6) {
      setPin(prev => prev + num);
      setError(null);
    }
  };

  const handleKeypadDelete = () => {
    setPin(prev => prev.slice(0, -1));
  };

  const handleEmployeeLogin = async (e) => {
    e?.preventDefault();
    if (!pin) {
      setError('Please enter your PIN.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin })
      });
      const data = await res.json();

      if (!res.ok || !data.email) {
        throw new Error(data.error || 'Invalid PIN.');
      }

      const { error: authError } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: pin,
      });

      if (authError) {
        throw new Error('Invalid PIN.');
      }

      await logAction({
        action: 'Employee Login',
        details: `Employee ${data.firstName} ${data.lastName} logged in via PIN.`,
        severity: 'info',
        employeeId: data.employeeId,
        userEmail: data.email
      });

      if (branchParam) {
        setBranch(branchParam);
      }

      router.push('/pos');
    } catch (err) {
      setError(err.message);
      setPin(''); // Clear pin on error
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="split-layout">
      <style jsx>{`
        .split-layout {
          min-height: 100vh;
          display: flex;
          background: var(--background);
        }
        .brand-panel {
          flex: 1;
          background: linear-gradient(135deg, #0f172a 0%, #064e3b 100%);
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: 4rem;
          color: white;
          position: relative;
          overflow: hidden;
        }
        .brand-panel::before {
          content: '';
          position: absolute;
          inset: 0;
          background-image: url('https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?auto=format&fit=crop&q=80');
          background-size: cover;
          background-position: center;
          opacity: 0.15;
          mix-blend-mode: overlay;
        }
        .form-panel {
          flex: 1;
          max-width: 600px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: 4rem;
          background: var(--card);
          box-shadow: -20px 0 40px rgba(0,0,0,0.1);
          z-index: 10;
          width: 100%;
        }
        .keypad {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1rem;
          margin: 2rem 0;
        }
        .keypad-btn {
          background: var(--background);
          border: 1px solid var(--border);
          border-radius: 16px;
          height: 64px;
          font-size: 1.5rem;
          font-weight: 600;
          color: var(--foreground);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.15s ease;
          box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);
        }
        .keypad-btn:hover {
          background: #10b981;
          color: white;
          border-color: #10b981;
          transform: translateY(-2px);
          box-shadow: 0 10px 15px -3px rgba(16, 185, 129, 0.3);
        }
        .keypad-btn:active {
          transform: translateY(0);
        }
        .pin-dots {
          display: flex;
          justify-content: center;
          gap: 1rem;
          margin-bottom: 1.5rem;
        }
        .pin-dot {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          border: 2px solid #10b981;
          background: transparent;
          transition: all 0.2s ease;
        }
        .pin-dot.filled {
          background: #10b981;
          box-shadow: 0 0 10px rgba(16, 185, 129, 0.5);
        }

        /* Speedometer/Dashboard Animations */
        .hud-container {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 800px;
          height: 800px;
          pointer-events: none;
          z-index: 0;
          opacity: 0.8;
        }
        .hud-circle-1 {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          border: 2px dashed rgba(16, 185, 129, 0.15);
          animation: spin 60s linear infinite;
        }
        .hud-circle-2 {
          position: absolute;
          inset: 10%;
          border-radius: 50%;
          border: 4px dotted rgba(16, 185, 129, 0.2);
          animation: spin-reverse 40s linear infinite;
        }
        .hud-circle-3 {
          position: absolute;
          inset: 25%;
          border-radius: 50%;
          border: 1px solid rgba(16, 185, 129, 0.1);
          box-shadow: inset 0 0 50px rgba(16, 185, 129, 0.05);
          animation: spin 80s linear infinite;
        }
        .hud-circle-3::after {
          content: '';
          position: absolute;
          top: -1px; left: 50%;
          width: 4px; height: 15px;
          background: #10b981;
          border-radius: 4px;
          box-shadow: 0 0 10px #10b981;
        }
        @keyframes spin { 100% { transform: rotate(360deg); } }
        @keyframes spin-reverse { 100% { transform: rotate(-360deg); } }
        
        /* Logo Enhancement */
        img[alt="Jobea Auto Logo"] {
          display: inline-block;
          transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        }
        
        img[alt="Jobea Auto Logo"]:hover {
          filter: drop-shadow(0 8px 20px rgba(16, 185, 129, 0.25)) !important;
          opacity: 1 !important;
        }

        /* Responsive Design */
        @media (max-width: 1024px) {
          .brand-panel { padding: 3rem 2rem; }
          .form-panel { padding: 3rem 2rem; }
          .hud-container { width: 600px; height: 600px; }
          h1 { font-size: 2.5rem; }
        }

        @media (max-width: 768px) {
          .split-layout { flex-direction: column; }
          .brand-panel { 
            padding: 2rem 1.5rem; 
            flex: none; 
            text-align: center;
            min-height: 60vh;
            justify-content: flex-start;
            padding-top: 3rem;
          }
          .form-panel { 
            max-width: 100%; 
            padding: 1.5rem;
            flex: 1;
            justify-content: flex-start;
            padding-top: 2rem;
          }
          .hud-container { 
            width: 400px; 
            height: 400px;
            opacity: 0.5;
          }
          h1 { font-size: 2rem; }
          p { font-size: 1rem; }
          .keypad { grid-template-columns: repeat(3, 1fr); gap: 0.75rem; }
          .keypad-btn { height: 56px; font-size: 1.25rem; }
        }

        @media (max-width: 480px) {
          .split-layout { min-height: auto; }
          .brand-panel { 
            padding: 1.5rem 1rem;
            min-height: auto;
            padding-bottom: 1rem;
          }
          .form-panel { 
            padding: 1rem;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            justify-content: center;
          }
          .hud-container { display: none; }
          h1 { 
            font-size: 1.5rem; 
            margin-bottom: 0.5rem;
          }
          p { 
            font-size: 0.875rem;
            line-height: 1.4;
          }
          img { height: 60px; }
          .keypad { 
            gap: 0.5rem; 
            margin: 1.5rem 0;
          }
          .keypad-btn { 
            height: 48px; 
            font-size: 1.125rem;
          }
          .pin-dots { gap: 0.75rem; margin-bottom: 1rem; }
          .pin-dot { width: 18px; height: 18px; }
          label { font-size: 0.75rem; }
          button[type="submit"] { 
            height: 56px; 
            font-size: 1rem;
          }
          .btn { width: 100%; }
        }
      `}</style>

      {/* Left Brand Panel */}
      <div className="brand-panel">
        <div className="hud-container">
          <div className="hud-circle-1" />
          <div className="hud-circle-2" />
          <div className="hud-circle-3" />
        </div>
        
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
          <div style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.3s ease' }}>
            <img src="/logo.png" alt="Jobea Auto Logo" style={{ height: '76px', objectFit: 'contain', filter: 'drop-shadow(0 6px 16px rgba(16, 185, 129, 0.2))', opacity: 0.95, transition: 'all 0.3s ease', transform: 'translateZ(0)' }} />
          </div>
          <h1 style={{ fontSize: '3.5rem', fontWeight: 800, lineHeight: 1.1, marginBottom: '1rem', letterSpacing: '-0.02em' }}>
            Staff Access<br/>Terminal {branchParam ? <span style={{ fontSize: '1.5rem', display: 'block', color: '#10b981' }}>Jobea {branchParam === 'local' ? 'Local' : 'Ex-Japan'}</span> : ''}
          </h1>
          <p style={{ fontSize: '1.25rem', color: '#94a3b8', maxWidth: '400px', lineHeight: 1.6, margin: '0 auto' }}>
            Tap your PIN to access the POS and Service Center.
          </p>
        </div>
      </div>

      {/* Right Form Panel */}
      <div className="form-panel animate-fade-in">
        
        <Link href={branchParam ? `/login?branch=${branchParam}` : '/login'} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: 'var(--muted-foreground)', textDecoration: 'none', marginBottom: '3rem', fontSize: '0.875rem', fontWeight: 500, width: 'fit-content' }}>
          <ArrowLeft size={16} /> Back to Admin
        </Link>

        {error && (
          <div style={{ padding: '1rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '12px', color: '#ef4444', fontSize: '0.875rem', textAlign: 'center', marginBottom: '2rem' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleEmployeeLogin}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '1.5rem', color: 'var(--foreground)', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center' }}>
              Enter PIN
            </label>
            
            {/* PIN Visualizer */}
            <div className="pin-dots">
              {[0, 1, 2, 3].map((index) => (
                <div key={index} className={`pin-dot ${pin.length > index ? 'filled' : ''}`} />
              ))}
            </div>

            {/* POS Keypad */}
            <div className="keypad">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                <button key={num} type="button" className="keypad-btn" onClick={() => handleKeypadPress(num.toString())}>
                  {num}
                </button>
              ))}
              <button type="button" className="keypad-btn" onClick={() => setPin('')} style={{ fontSize: '1rem', color: 'var(--muted-foreground)' }}>
                CLEAR
              </button>
              <button type="button" className="keypad-btn" onClick={() => handleKeypadPress('0')}>
                0
              </button>
              <button type="button" className="keypad-btn" onClick={handleKeypadDelete} style={{ color: 'var(--muted-foreground)' }}>
                <Delete size={24} />
              </button>
            </div>
          </div>

          <button 
            type="submit" 
            className="btn btn-primary" 
            style={{ width: '100%', height: '64px', fontSize: '1.125rem', background: '#10b981', color: 'white', border: 'none', borderRadius: '16px', fontWeight: 600, boxShadow: '0 10px 25px -5px rgba(16, 185, 129, 0.4)' }}
            disabled={loading || pin.length < 4}
          >
            {loading ? <Loader2 size={24} className="animate-spin" /> : 'Access Terminal'}
          </button>
        </form>

      </div>
      <InstallPrompt />
    </div>
  );
}
