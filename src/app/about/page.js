import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function AboutPage() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--background)' }}>
      {/* Simple Header */}
      <header className="glass" style={{ position: 'sticky', top: 0, zIndex: 40, borderBottom: '1px solid var(--border)', padding: '1rem 2rem', display: 'flex', alignItems: 'center' }}>
        <Link href="/shop" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--foreground)', textDecoration: 'none', fontWeight: 500 }}>
          <ArrowLeft size={18} /> Back to Shop
        </Link>
      </header>

      <main style={{ flex: 1, padding: '4rem 2rem', maxWidth: '800px', margin: '0 auto', width: '100%' }}>
        <h1 className="heading-1" style={{ fontSize: '3.5rem', marginBottom: '2rem', background: 'linear-gradient(to right, var(--primary), var(--accent, #0ea5e9))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontWeight: 800 }}>About Jobea Autospares</h1>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', fontSize: '1.125rem', lineHeight: 1.8, color: 'var(--muted-foreground)' }}>
          <p>
            Welcome to <strong style={{ color: 'var(--foreground)', fontWeight: 700 }}>Jobea Autospares</strong>, your premier destination for high-quality, genuine automotive parts in Kenya. 
            Located in the heart of Kakamega along Maziwa Road, we have built our reputation on reliability, extensive inventory, and an unwavering commitment to customer satisfaction.
          </p>
          
          <p>
            Our inventory includes both <strong style={{ color: 'var(--primary)', fontWeight: 700 }}>Jobea Local</strong> parts and high-grade <strong style={{ color: 'var(--primary)', fontWeight: 700 }}>Jobea Ex-Japan</strong> imports. Whether you are looking for routine maintenance items, engine components, or specialized body parts, our dual-branch system ensures that we can source exactly what your vehicle needs.
          </p>

          <h2 style={{ fontSize: '1.75rem', color: 'var(--foreground)', marginTop: '2.5rem', marginBottom: '1rem', display: 'inline-block', borderBottom: '3px solid var(--primary)', paddingBottom: '0.5rem' }}>Our Mission</h2>
          <p style={{ fontSize: '1.25rem', color: 'var(--foreground)', fontStyle: 'italic', borderLeft: '4px solid var(--primary)', paddingLeft: '1.5rem', margin: '1rem 0', background: 'rgba(59, 130, 246, 0.05)', padding: '1.5rem', borderRadius: '0 12px 12px 0' }}>
            "To provide vehicle owners and mechanics with rapid, reliable access to genuine auto spares, minimizing downtime and ensuring every vehicle runs safely and efficiently."
          </p>

          <h2 style={{ fontSize: '1.75rem', color: 'var(--foreground)', marginTop: '2.5rem', marginBottom: '1rem', display: 'inline-block', borderBottom: '3px solid var(--primary)', paddingBottom: '0.5rem' }}>Why Choose Us?</h2>
          <ul style={{ paddingLeft: '0', display: 'flex', flexDirection: 'column', gap: '1rem', listStyle: 'none' }}>
            <li style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'var(--card)', padding: '1rem 1.5rem', borderRadius: '12px', border: '1px solid var(--border)' }}>
              <div style={{ background: 'var(--primary)', width: '12px', height: '12px', borderRadius: '50%', flexShrink: 0 }} />
              <div><strong style={{ color: 'var(--foreground)' }}>Verified Quality:</strong> Every part is rigorously checked for authenticity.</div>
            </li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'var(--card)', padding: '1rem 1.5rem', borderRadius: '12px', border: '1px solid var(--border)' }}>
              <div style={{ background: 'var(--primary)', width: '12px', height: '12px', borderRadius: '50%', flexShrink: 0 }} />
              <div><strong style={{ color: 'var(--foreground)' }}>Expert Knowledge:</strong> Our staff understands the technical nuances of various car models.</div>
            </li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'var(--card)', padding: '1rem 1.5rem', borderRadius: '12px', border: '1px solid var(--border)' }}>
              <div style={{ background: 'var(--primary)', width: '12px', height: '12px', borderRadius: '50%', flexShrink: 0 }} />
              <div><strong style={{ color: 'var(--foreground)' }}>Nationwide Reach:</strong> We arrange fast shipping directly to your garage or doorstep.</div>
            </li>
          </ul>
        </div>
      </main>
    </div>
  );
}
