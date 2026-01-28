import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Defines which paths are public (no auth needed)
const PUBLIC_PATHS = [
    '/',
    '/login',
    '/signup',
    '/api/auth', // Supabase auth routes often live here or are handled by client
    '/api/webhooks',  // Webhooks must be public
    '/favicon.ico',
];

export async function middleware(req: NextRequest) {
    const res = NextResponse.next();
    const path = req.nextUrl.pathname;

    // 1. SECURITY HEADERS (Backup for some deployments, main source is next.config.ts)
    // We don't need to duplicate headers if next.config.ts handles them, 
    // but Middleware is great for dynamic headers if needed.

    // 2. CORS (Cross-Origin Resource Sharing)
    // Prevent other websites from consuming your API
    const origin = req.headers.get('origin');

    // Allow requests with no origin (like mobile apps or curl requests)
    // OR allow requests from your own domain.
    // We'll trust the deployment domain for now.
    if (origin && !origin.includes('localhost') && !origin.includes('vercel.app')) {
        // If strict mode, you might block it. For now, we allow it but don't explicitly add CORS headers 
        // to tell the browser "it's okay", so the browser effectively blocks it for fetch().
        // Ideally, you explicitly deny.
    }

    // 3. AUTHENTICATION PROTECTION FOR /api
    // We specifically want to protect /api routes that aren't webhooks or auth
    const isPublic = PUBLIC_PATHS.some(publicPath => path.startsWith(publicPath));

    if (path.startsWith('/api') && !isPublic) {
        // Check for Authorization header (Bearer token)
        // Note: Supabase client usually handles this, but blocking at middleware level is safer.
        // However, middleware runs on Edge, so validating the JWT fully requires a library.
        // Basic check: Ensure header exists. 

        // We defer strict token validation to the route handlers (Supabase getUser) 
        // to avoid adding heavy JWT libraries to edge middleware if not needed.
        // BUT we can reject requests that are obviously malformed.

        const authHeader = req.headers.get('Authorization');
        // Also check for cookies if your app uses them for API
        // const cookie = req.cookies.get('sb-access-token');

        if (!authHeader) {
            // If no auth header, return 401 immediately
            return NextResponse.json(
                { error: 'Unauthorized: Missing Authentication' },
                { status: 401 }
            );
        }
    }

    // 4. RATE LIMITING (Basic)
    // Real rate limiting needs Redis or similar. 
    // Here we just add a header to tell clients the policy.
    res.headers.set('X-RateLimit-Limit', '100');

    return res;
}

export const config = {
    matcher: [
        // Apply to all API routes
        '/api/:path*',
    ],
};
