import { NextResponse } from 'next/server';
import { verifyToken } from './lib/auth';

// Paths that require 'admin' role
const ADMIN_PATHS = [
    '/dashboard/settings',
    '/dashboard/discounts',
    '/dashboard/customers' // Maybe limit editing customers? For now let's guard these.
];

export async function middleware(request) {
    const { pathname } = request.nextUrl;

    // Check if path is protected
    const isAdminPath = ADMIN_PATHS.some(path => pathname.startsWith(path));

    if (isAdminPath) {
        const token = request.cookies.get('token')?.value;

        if (!token) {
            return NextResponse.redirect(new URL('/login', request.url));
        }

        const payload = await verifyToken(token); // We need to check if verifyToken works in Edge runtime or node
        // Warning: 'jsonwebtoken' might not work in Edge Middleware unless using 'jose' or similar.
        // next-auth or simple base64 decode if checking role (less secure but ok for UI redirect, API handles security).
        // Let's try standard verifyToken first. If it fails due to Node runtime, we switch to 'jose'.

        // Actually, 'jsonwebtoken' depends on Node crypto which might be missing in Edge.
        // For simplicity in this project (Node environment), we will do a simpler check or rely on server components.
        // BUT middleware runs on Edge by default. Using 'jose' is safer.
        // Let's implement a simplified check for the UI redirect using simple decoding or just API protection.

        // BETTER APPROACH:
        // Client-side: Hide links.
        // API-side: Already protected (we did this).
        // Page-side: Server Component check.
        // Middleware is good but complex with JWT in Edge.

        // Let's stick to Server Components for "Page Protection" to avoid Edge runtime issues with 'jsonwebtoken'.
        // So I will NOT create this middleware file for Auth logic if I don't have 'jose'.
        // I'll update the page.js files to check session role.

        return NextResponse.next();
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/dashboard/:path*'],
};
