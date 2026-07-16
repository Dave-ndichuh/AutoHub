import Link from 'next/link';
import { ArrowLeft, Phone, MapPin, Mail, Clock } from 'lucide-react';

export default function ContactPage() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--background)' }}>
      {/* Simple Header */}
      <header className="glass" style={{ position: 'sticky', top: 0, zIndex: 40, borderBottom: '1px solid var(--border)', padding: '1rem 2rem', display: 'flex', alignItems: 'center' }}>
        <Link href="/shop" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--foreground)', textDecoration: 'none', fontWeight: 500 }}>
          <ArrowLeft size={18} /> Back to Shop
        </Link>
      </header>

      <main style={{ flex: 1, padding: '4rem 2rem', maxWidth: '800px', margin: '0 auto', width: '100%' }}>
        <h1 className="heading-1" style={{ fontSize: '3.5rem', marginBottom: '2rem', background: 'linear-gradient(to right, var(--primary), var(--accent, #0ea5e9))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontWeight: 800 }}>Contact Us</h1>
        
        <p style={{ fontSize: '1.125rem', color: 'var(--muted-foreground)', marginBottom: '3rem', lineHeight: 1.6 }}>
          Have a question about a specific part, need a quotation, or want to check on a delivery? Our team is ready to assist you.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
          
          {/* Contact Info Cards */}
          <div className="glass" style={{ padding: '2rem', borderRadius: '12px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <h2 style={{ fontSize: '1.5rem', color: 'var(--foreground)', margin: 0 }}>Get in Touch</h2>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', color: 'var(--muted-foreground)' }}>
              <Phone size={24} className="text-primary" />
              <div>
                <strong style={{ display: 'block', color: 'var(--foreground)' }}>Phone / WhatsApp</strong>
                <span>+254 725 599 999</span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', color: 'var(--muted-foreground)' }}>
              <MapPin size={24} className="text-primary" />
              <div>
                <strong style={{ display: 'block', color: 'var(--foreground)' }}>Location</strong>
                <span>Maziwa Road<br/>Po. Box 1936, Kakamega</span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', color: 'var(--muted-foreground)' }}>
              <Mail size={24} className="text-primary" />
              <div>
                <strong style={{ display: 'block', color: 'var(--foreground)' }}>Email</strong>
                <span>info@jobea.co.ke</span>
              </div>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', color: 'var(--muted-foreground)' }}>
              <Clock size={24} className="text-primary" />
              <div>
                <strong style={{ display: 'block', color: 'var(--foreground)' }}>Business Hours</strong>
                <span>Mon - Sat: 8:00 AM - 6:00 PM<br/>Sun: Closed</span>
              </div>
            </div>
          </div>

          {/* Quick Inquiry via WhatsApp */}
          <div className="glass" style={{ padding: '2rem', borderRadius: '12px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <h2 style={{ fontSize: '1.5rem', color: 'var(--foreground)', margin: 0 }}>Fastest Response</h2>
            <p style={{ color: 'var(--muted-foreground)', lineHeight: 1.6 }}>
              For the quickest service, we recommend reaching out via WhatsApp. Our sales agents can verify stock, negotiate pricing, and arrange delivery in real-time.
            </p>
            <a 
              href="https://wa.me/254725599999?text=Hello%20Jobea%20Autospares,%20I%20have%20an%20inquiry."
              target="_blank"
              rel="noreferrer"
              className="btn btn-primary"
              style={{ padding: '1rem', textAlign: 'center', fontSize: '1.125rem', background: '#25D366', color: 'white', textDecoration: 'none', marginTop: 'auto' }}
            >
              Chat on WhatsApp
            </a>
          </div>

        </div>
      </main>
    </div>
  );
}
