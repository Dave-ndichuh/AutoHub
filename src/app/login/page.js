'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, Mail, Loader2, Sparkles, UserCheck, ArrowRight, Settings, Wrench, Battery, Gauge, Zap, Car, Bike, Truck } from 'lucide-react';
import Link from 'next/link';
import InstallPrompt from '@/components/InstallPrompt';
import { logAction } from '@/lib/logger';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const router = useRouter();

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      
      await logAction({
        action: 'Admin Login',
        details: `Admin user ${email} logged in.`,
        severity: 'info',
        userEmail: email
      });

      router.push('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem',
      backgroundColor: '#0f172a',
      position: 'relative',
      overflow: 'hidden'
    }}>
      <style jsx>{`
        .login-box { padding: 3rem 2.5rem; }
        @media (max-width: 640px) { .login-box { padding: 2rem 1.5rem; } }
        
        .floating-icon {
          position: absolute;
          color: rgba(255, 255, 255, 0.03);
          z-index: 0;
          animation: float linear infinite;
        }
        
        @keyframes aurora {
          0% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(5vw, -5vh) scale(1.1); }
          66% { transform: translate(-5vw, 5vh) scale(0.9); }
          100% { transform: translate(0, 0) scale(1); }
        }
      `}</style>
      
      {/* Professional Ambient Gradient Background */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', zIndex: 0, pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', top: '-10%', left: '-10%', width: '60vw', height: '60vw', background: 'radial-gradient(circle, rgba(59,130,246,0.08) 0%, transparent 70%)', filter: 'blur(60px)', animation: 'aurora 20s ease-in-out infinite alternate' }} />
        <div style={{ position: 'absolute', bottom: '-20%', right: '-10%', width: '70vw', height: '70vw', background: 'radial-gradient(circle, rgba(139,92,246,0.06) 0%, transparent 70%)', filter: 'blur(80px)', animation: 'aurora 25s ease-in-out infinite alternate-reverse' }} />
        <div style={{ position: 'absolute', top: '40%', left: '50%', width: '50vw', height: '50vw', background: 'radial-gradient(circle, rgba(16,185,129,0.03) 0%, transparent 70%)', filter: 'blur(100px)', transform: 'translate(-50%, -50%)', animation: 'aurora 30s ease-in-out infinite alternate' }} />
      </div>

      <div className="glass animate-fade-in login-box" style={{
        width: '100%',
        maxWidth: '420px',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '0 20px 40px -15px rgba(0,0,0,0.5)'
      }}>
        {/* Decorative glows */}
        <div style={{ position: 'absolute', top: '-50px', left: '-50px', width: '150px', height: '150px', background: 'var(--primary)', filter: 'blur(60px)', opacity: 0.3, borderRadius: '50%' }} />
        <div style={{ position: 'absolute', bottom: '-50px', right: '-50px', width: '150px', height: '150px', background: '#f97316', filter: 'blur(60px)', opacity: 0.2, borderRadius: '50%' }} />

        <div style={{ textAlign: 'center', marginBottom: '2.5rem', position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem', transition: 'all 0.3s ease' }}>
            <img src="/logo.png" alt="Jobea Auto Logo" style={{ height: '72px', objectFit: 'contain', filter: 'drop-shadow(0 4px 12px rgba(16, 185, 129, 0.15))', opacity: 0.95, transition: 'all 0.3s ease' }} />
          </div>
          <p className="text-muted" style={{ fontWeight: 500, letterSpacing: '0.05em', textTransform: 'uppercase', fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.5)' }}>Admin Portal</p>
        </div>

        {error && (
          <div style={{ padding: '0.75rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '8px', color: '#ef4444', fontSize: '0.875rem', textAlign: 'center', marginBottom: '1.5rem', position: 'relative' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleAdminLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', position: 'relative' }}>
          
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.5rem', color: 'var(--foreground)' }}>Admin Email</label>
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted-foreground)' }}>
                <Mail size={18} />
              </div>
              <input
                type="email"
                className="input"
                style={{ paddingLeft: '2.5rem', height: '48px' }}
                placeholder="admin@jobea.co.ke"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.5rem', color: 'var(--foreground)' }}>Secure Password</label>
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted-foreground)' }}>
                <Lock size={18} />
              </div>
              <input
                type="password"
                className="input"
                style={{ paddingLeft: '2.5rem', height: '48px' }}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <button 
            type="submit" 
            className="btn btn-primary" 
            style={{ width: '100%', marginTop: '0.5rem', height: '48px', fontSize: '1rem' }}
            disabled={loading}
          >
            {loading ? <Loader2 size={20} className="animate-spin" /> : 'Authenticate'}
          </button>
        </form>

        <div style={{ zIndex: 10, position: 'relative', marginTop: '2.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border)', textAlign: 'center' }}>
          <p className="text-muted" style={{ fontSize: '0.875rem', marginBottom: '1rem' }}>Are you a staff member?</p>
          <button 
            type="button" 
            className="btn btn-secondary" 
            style={{ width: '100%', height: '48px', color: '#10b981', borderColor: 'rgba(16, 185, 129, 0.3)' }}
            onClick={() => router.push('/employee-login')}
          >
            <UserCheck size={18} /> Employee Portal Access <ArrowRight size={16} />
          </button>
        </div>

      </div>
      <InstallPrompt />
    </div>
  );
}
