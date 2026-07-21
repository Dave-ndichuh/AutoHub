'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/AuthGuard';
import { Save, Mail, Lock, ShieldCheck, AlertTriangle } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function SettingsPage() {
  const { user, role } = useAuth();
  const router = useRouter();
  
  const [email, setEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [loadingEmail, setLoadingEmail] = useState(false);
  const [loadingPassword, setLoadingPassword] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    if (role === 'employee') {
      router.push('/');
    }
    if (user?.email) {
      setEmail(user.email);
    }
  }, [user, role, router]);

  const handleUpdateEmail = async (e) => {
    e.preventDefault();
    setLoadingEmail(true);
    setMessage({ type: '', text: '' });

    if (email === user?.email) {
      setMessage({ type: 'info', text: 'Email is already up to date.' });
      setLoadingEmail(false);
      return;
    }

    const { error } = await supabase.auth.updateUser({ email });
    
    if (error) {
      setMessage({ type: 'error', text: error.message });
    } else {
      setMessage({ type: 'success', text: 'Email update initiated. If secure email change is enabled, please check both your old and new inboxes for confirmation links.' });
    }
    setLoadingEmail(false);
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    setLoadingPassword(true);
    setMessage({ type: '', text: '' });

    if (password !== confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match.' });
      setLoadingPassword(false);
      return;
    }

    if (password.length < 6) {
      setMessage({ type: 'error', text: 'Password must be at least 6 characters long.' });
      setLoadingPassword(false);
      return;
    }

    // Verify current password first by attempting a re-login
    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword
    });

    if (verifyError) {
      setMessage({ type: 'error', text: 'Incorrect current password.' });
      setLoadingPassword(false);
      return;
    }

    // If verification passes, update to the new password
    const { error } = await supabase.auth.updateUser({ password });
    
    if (error) {
      setMessage({ type: 'error', text: error.message });
    } else {
      setMessage({ type: 'success', text: 'Password updated successfully!' });
      setCurrentPassword('');
      setPassword('');
      setConfirmPassword('');
    }
    setLoadingPassword(false);
  };

  if (role === 'employee') return null;

  return (
    <div className="animate-fade-in" style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      <div>
        <h2 className="heading-2" style={{ marginBottom: '0.5rem', color: 'var(--foreground)' }}>Profile & Security Settings</h2>
        <p style={{ color: 'var(--muted-foreground)', margin: 0 }}>Update your administrator login credentials securely.</p>
      </div>

      {message.text && (
        <div className="animate-fade-in" style={{ 
          padding: '1rem 1.5rem', 
          borderRadius: '8px', 
          display: 'flex', 
          alignItems: 'center', 
          gap: '0.75rem',
          background: message.type === 'error' ? 'rgba(239, 68, 68, 0.1)' : message.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(59, 130, 246, 0.1)',
          color: message.type === 'error' ? '#ef4444' : message.type === 'success' ? '#10b981' : '#3b82f6',
          border: `1px solid ${message.type === 'error' ? 'rgba(239, 68, 68, 0.2)' : message.type === 'success' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(59, 130, 246, 0.2)'}`
        }}>
          {message.type === 'error' ? <AlertTriangle size={20} /> : <ShieldCheck size={20} />}
          <span style={{ fontWeight: 500 }}>{message.text}</span>
        </div>
      )}

      <div className="glass" style={{ padding: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <Mail className="text-primary" size={24} />
          <h3 className="heading-2" style={{ margin: 0, fontSize: '1.25rem' }}>Email Address</h3>
        </div>
        
        <form onSubmit={handleUpdateEmail} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: 'var(--muted-foreground)', marginBottom: '0.5rem' }}>Current or New Email</label>
            <input 
              type="email" 
              className="input" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              required 
              style={{ maxWidth: '400px' }}
            />
          </div>
          <div>
            <button type="submit" className="btn btn-primary" disabled={loadingEmail}>
              <Save size={18} />
              {loadingEmail ? 'Updating...' : 'Update Email'}
            </button>
          </div>
        </form>
      </div>

      <div className="glass" style={{ padding: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <Lock className="text-primary" size={24} />
          <h3 className="heading-2" style={{ margin: 0, fontSize: '1.25rem' }}>Change Password</h3>
        </div>
        
        <form onSubmit={handleUpdatePassword} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: 'var(--muted-foreground)', marginBottom: '0.5rem' }}>Current Password</label>
            <input 
              type="password" 
              className="input" 
              value={currentPassword} 
              onChange={(e) => setCurrentPassword(e.target.value)} 
              placeholder="Enter current password"
              required 
              style={{ maxWidth: '400px' }}
            />
          </div>
          <div style={{ height: '1px', background: 'var(--border)', maxWidth: '400px', margin: '0.5rem 0' }}></div>
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: 'var(--muted-foreground)', marginBottom: '0.5rem' }}>New Password</label>
            <input 
              type="password" 
              className="input" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              placeholder="Enter new password"
              required 
              style={{ maxWidth: '400px' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: 'var(--muted-foreground)', marginBottom: '0.5rem' }}>Confirm New Password</label>
            <input 
              type="password" 
              className="input" 
              value={confirmPassword} 
              onChange={(e) => setConfirmPassword(e.target.value)} 
              placeholder="Confirm new password"
              required 
              style={{ maxWidth: '400px' }}
            />
          </div>
          <div>
            <button type="submit" className="btn btn-primary" disabled={loadingPassword}>
              <Save size={18} />
              {loadingPassword ? 'Updating...' : 'Update Password'}
            </button>
          </div>
        </form>
      </div>

    </div>
  );
}
