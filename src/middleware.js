import { NextResponse } from 'next/server';

export function middleware(request) {
  const url = request.nextUrl;
  const hostname = request.headers.get('host') || '';

  // Define how we identify the admin domain
  // Explicitly map jobeaautos.vercel.app to the Admin Dashboard
  const isAdminDomain = hostname === 'jobeaautos.vercel.app' || hostname.startsWith('admin.');

  // If the user is on the ADMIN domain
  if (isAdminDomain) {
    // Prevent access to the public shop pages from the admin URL
    if (url.pathname.startsWith('/shop') || url.pathname === '/about' || url.pathname === '/contact') {
      return NextResponse.redirect(new URL('/', request.url));
    }
  } 
  // If the user is on the PUBLIC domain (e.g., jobea.co.ke)
  else {
    // If they visit the root URL, seamlessly serve them the shop instead of the admin landing page
    if (url.pathname === '/') {
      return NextResponse.rewrite(new URL('/shop', request.url));
    }

    // List of all private dashboard routes
    const adminPaths = [
      '/dashboard', '/pos', '/customers', '/suppliers', '/invoices', 
      '/transactions', '/reports', '/settings', '/employees', '/logs', 
      '/login', '/employee-login'
    ];
    
    // Block access to any admin path from the public domain
    const isTryingToAccessAdmin = adminPaths.some(path => url.pathname.startsWith(path));

    if (isTryingToAccessAdmin) {
      // Redirect them back to the shop
      return NextResponse.redirect(new URL('/shop', request.url));
    }
  }

  return NextResponse.next();
}

// Ensure the middleware only runs on actual page routes, not static files or API routes
export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.png|.*\\.jpg|.*\\.jpeg|.*\\.svg$).*)'],
};
