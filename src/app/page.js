'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Power, Sparkles, Recycle, Clock, ChevronDown } from 'lucide-react';

export default function LandingPage() {
  const [isActive, setIsActive] = useState(false);
  const [time, setTime] = useState('');
  const router = useRouter();

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{
      minHeight: '100vh',
      margin: '-2rem',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#170833',
      position: 'relative',
      overflow: 'hidden', // It's okay to hide overflow on the main page wrapper
      color: '#ffffff',
      paddingBottom: '5rem' // Buffer to ensure it never touches the footer
    }}>
      {/* 1. Global Background */}
      <div style={{ 
        position: 'absolute', 
        inset: 0, 
        background: 'radial-gradient(ellipse at center, #4c1d95 0%, #2e1065 50%, #170833 100%)',
        zIndex: 0 
      }} />
      
      {/* Subtle Dot Matrix Texture */}
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px)',
        backgroundSize: '24px 24px',
        zIndex: 1,
        pointerEvents: 'none'
      }} />

      {/* Main Content */}
      <main style={{
        position: 'relative',
        zIndex: 10,
        width: '100%',
        maxWidth: '42rem', // max-w-2xl
        margin: '0 1rem'
      }}>
        {/* 2. Main Container (Dashboard Panel Color) */}
        <div style={{
          background: 'rgba(28, 36, 49, 0.8)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: '1px solid rgba(45, 55, 72, 0.5)',
          borderRadius: '2rem',
          padding: '2.5rem',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          boxShadow: '0 8px 32px 0 rgba(0,0,0,0.37)',
          position: 'relative',
          width: '100%',
          // No overflow-hidden so button glows are not clipped!
        }}>
          
          {/* Integrated Card Header (Clock) */}
          <div style={{
            position: 'absolute',
            top: '1.5rem',
            right: '2rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontFamily: 'monospace',
            fontSize: '0.8rem',
            color: 'rgba(255, 255, 255, 0.6)'
          }}>
            <Clock size={14} />
            {time}
          </div>

          {/* 3. Typography & Branding */}
          <div style={{ 
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center', 
            marginBottom: '3rem',
            opacity: isActive ? 0.8 : 1, 
            transition: 'all 0.5s ease',
            marginTop: '0.5rem'
          }}>
            <img 
              src="/logo.png" 
              alt="Jobea Logo" 
              style={{ 
                height: '80px', 
                objectFit: 'contain', 
                marginBottom: '1.25rem',
                filter: 'drop-shadow(0 4px 8px rgba(0, 0, 0, 0.3))'
              }} 
            />
            <h1 style={{ 
              fontSize: '2.25rem', 
              fontWeight: 700, 
              letterSpacing: '-0.025em', 
              marginBottom: '0.75rem',
              lineHeight: 1.2,
              color: '#ffffff'
            }}>
              Welcome to Jobea Autospares
            </h1>
            
            <p style={{ 
              color: '#94a3b8', 
              fontSize: '1rem',
              fontWeight: 500,
              marginTop: '0.75rem'
            }}>
              Please select your branch to sign in.
            </p>
            
            {/* Animated Arrow */}
            <div style={{
              marginTop: '1.5rem',
              opacity: isActive ? 0 : 1,
              transition: 'opacity 0.3s ease',
              animation: 'bounce-subtle 2s infinite ease-in-out',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center'
            }}>
              <ChevronDown size={32} color="#94a3b8" strokeWidth={2.5} />
            </div>
          </div>

          {/* 4. The Power Button (Primary Action) */}
          <div style={{ position: 'relative' }}>
            {/* Outer glow ring when active */}
            <div style={{
              position: 'absolute',
              inset: '-20px',
              borderRadius: '50%',
              background: 'conic-gradient(from 0deg, transparent, rgba(167, 139, 250, 0.6), transparent)',
              animation: isActive ? 'spin 3s linear infinite' : 'none',
              opacity: isActive ? 1 : 0,
              transition: 'opacity 0.5s ease',
              filter: 'blur(12px)'
            }} />
            
            <button 
              onClick={() => setIsActive(!isActive)}
              style={{
                position: 'relative',
                width: '120px',
                height: '120px',
                borderRadius: '50%',
                background: 'linear-gradient(to top right, #9333ea, #a78bfa)',
                border: 'none',
                boxShadow: isActive 
                  ? '0 0 60px -10px rgba(167, 139, 250, 0.9), inset 0 2px 4px rgba(255, 255, 255, 0.4)' 
                  : '0 0 40px -10px rgba(167, 139, 250, 0.7), inset 0 2px 4px rgba(255, 255, 255, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.3s ease-in-out',
                transform: isActive ? 'scale(1.05)' : 'scale(1)',
                zIndex: 2
              }}
              onMouseOver={(e) => {
                if (!isActive) e.currentTarget.style.boxShadow = '0 0 60px -10px rgba(167, 139, 250, 0.9), inset 0 2px 4px rgba(255, 255, 255, 0.4)';
              }}
              onMouseOut={(e) => {
                if (!isActive) e.currentTarget.style.boxShadow = '0 0 40px -10px rgba(167, 139, 250, 0.7), inset 0 2px 4px rgba(255, 255, 255, 0.4)';
              }}
            >
              <Power 
                size={48} 
                color="#ffffff" 
                style={{ 
                  filter: isActive ? 'drop-shadow(0 0 12px rgba(255,255,255,0.8))' : 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))',
                  transition: 'all 0.4s ease'
                }} 
              />
            </button>
          </div>

          {/* 5. Routing Cards ("Jobea Local" & "Ex-Japan") */}
          <div style={{ 
            display: 'flex',
            gap: '1.5rem',
            width: '100%',
            justifyContent: 'center',
            maxHeight: isActive ? '300px' : '0px',
            opacity: isActive ? 1 : 0,
            transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
            pointerEvents: isActive ? 'auto' : 'none',
            paddingTop: isActive ? '3rem' : '0'
          }}>
            
            <button 
              onClick={() => router.push('/login?branch=local')}
              className={`routing-card ${isActive ? 'animate-slide-up-1' : ''}`}
              style={{
                padding: '1.5rem',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '1rem',
                borderRadius: '1rem',
                cursor: 'pointer',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                background: 'rgba(0, 0, 0, 0.2)',
                transition: 'all 0.3s ease',
                width: '180px'
              }}
            >
              <div style={{ 
                padding: '1rem', 
                borderRadius: '50%', 
                background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3), inset 0 2px 4px rgba(255,255,255,0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Sparkles size={32} color="#ffffff" strokeWidth={2.5} style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' }} />
              </div>
              <div style={{ textAlign: 'center' }}>
                <h3 style={{ color: '#ffffff', fontWeight: 600, fontSize: '1.1rem', marginBottom: '0.2rem' }}>Jobea Local</h3>
                <p style={{ color: '#d8b4fe', fontSize: '0.75rem', fontWeight: 500 }}>Brand New Parts</p>
              </div>
            </button>

            <button 
              onClick={() => router.push('/login?branch=ex-japan')}
              className={`routing-card ${isActive ? 'animate-slide-up-2' : ''}`}
              style={{
                padding: '1.5rem',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '1rem',
                borderRadius: '1rem',
                cursor: 'pointer',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                background: 'rgba(0, 0, 0, 0.2)',
                transition: 'all 0.3s ease',
                width: '180px'
              }}
            >
              <div style={{ 
                padding: '1rem', 
                borderRadius: '50%', 
                background: 'linear-gradient(135deg, #a855f7, #7e22ce)',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3), inset 0 2px 4px rgba(255,255,255,0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Recycle size={32} color="#ffffff" strokeWidth={2.5} style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' }} />
              </div>
              <div style={{ textAlign: 'center' }}>
                <h3 style={{ color: '#ffffff', fontWeight: 600, fontSize: '1.1rem', marginBottom: '0.2rem' }}>Ex-Japan</h3>
                <p style={{ color: '#d8b4fe', fontSize: '0.75rem', fontWeight: 500 }}>Quality Used Parts</p>
              </div>
            </button>

          </div>
        </div>
      </main>

      {/* Distinct Footer */}
      <footer style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 10,
        padding: '1.25rem',
        textAlign: 'center',
        borderTop: '1px solid rgba(45, 55, 72, 0.5)',
        background: 'rgba(28, 36, 49, 0.6)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        color: '#94a3b8',
        fontSize: '0.875rem',
        display: 'flex',
        justifyContent: 'center',
        gap: '0.5rem',
        width: '100%'
      }}>
        <span style={{ fontWeight: 500 }}>&copy; {new Date().getFullYear()} Jobea Autospares</span>
        <span>&bull;</span>
        <span>
          System by <a href="https://machariandichu.vercel.app/" target="_blank" rel="noopener noreferrer" style={{ color: '#e2e8f0', textDecoration: 'none', fontWeight: 600, transition: 'color 0.2s' }} onMouseOver={(e) => e.target.style.color = '#ffffff'} onMouseOut={(e) => e.target.style.color = '#e2e8f0'}>Nexus Solutions</a>
        </span>
      </footer>
      
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        
        @keyframes bounce-subtle {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(10px); }
        }
        
        .animate-slide-up-1 {
          animation: slideUp 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
          animation-delay: 0.1s;
          opacity: 0;
          transform: translateY(20px);
        }

        .animate-slide-up-2 {
          animation: slideUp 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
          animation-delay: 0.25s;
          opacity: 0;
          transform: translateY(20px);
        }

        @keyframes slideUp {
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .routing-card:hover {
          transform: translateY(-4px) !important;
          border-color: rgba(192, 132, 252, 0.5) !important;
          background: rgba(0, 0, 0, 0.3) !important;
        }
      `}} />
    </div>
  );
}
