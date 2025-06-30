import { json } from '@sveltejs/kit';
import { loginToBambuLabCloud, verifyTwoFactorAuth } from '$lib/server/bambu_api.js';
import { SESSION_SECRET } from '$env/static/private'; // For signing cookies or session data if needed

// Note: SvelteKit's default session management is via hooks and event.locals.
// Cookies are the primary mechanism for persisting session state across requests.
// For simplicity, this example will set an HTTPOnly cookie with the access token.
// In a more robust app, you might store the token in a session store (Redis, DB)
// and set a session ID cookie.

const ONE_DAY_IN_SECONDS = 24 * 60 * 60;
// Bambu tokens are supposedly valid for ~3 months.
// Let's set cookie expiry to a shorter period for security, e.g., 7 days, or align with token if possible.
// For this example, let's use 30 days, but this should be configurable or based on actual token expiry.
const COOKIE_MAX_AGE = 30 * ONE_DAY_IN_SECONDS;


/** @type {import('./$types').RequestHandler} */
export async function POST({ request, cookies }) {
    const body = await request.json();
    const { email, password, verificationCode, tfaKey } = body;

    if (!email || !password) {
        return json({ success: false, message: 'Email and password are required.' }, { status: 400 });
    }

    try {
        let result;
        if (verificationCode && tfaKey) {
            // Step 2: Verify 2FA code
            console.log('Login API: Verifying 2FA');
            result = await verifyTwoFactorAuth(tfaKey, verificationCode);
        } else {
            // Step 1: Initial login attempt
            console.log('Login API: Initial login attempt');
            result = await loginToBambuLabCloud(email, password);
        }

        if (result.success) {
            if (result.needsVerification) {
                // Store tfaKey in a temporary, secure way if needed, or just pass back to client
                // For this example, we assume the client will hold onto the tfaKey it receives.
                return json({
                    success: true,
                    needsVerification: true,
                    tfaKey: result.tfaKey,
                    message: result.message || 'Verification code sent. Please enter the code.',
                });
            } else if (result.accessToken) {
                // Login or 2FA verification successful, token received
                // Set a secure, HTTPOnly cookie for the access token
                cookies.set('bambu_token', result.accessToken, {
                    path: '/',
                    httpOnly: true,
                    secure: process.env.NODE_ENV === 'production', // Use true in production
                    sameSite: 'strict',
                    maxAge: COOKIE_MAX_AGE, // Example: 30 days
                });
                // Optionally, also store email or other non-sensitive user info in session/cookie
                cookies.set('bambu_user_email', email, { // Be cautious about storing PII in cookies
                    path: '/',
                    httpOnly: true,
                    secure: process.env.NODE_ENV === 'production',
                    sameSite: 'strict',
                    maxAge: COOKIE_MAX_AGE,
                });

                return json({
                    success: true,
                    needsVerification: false,
                    message: result.message || 'Login successful!',
                });
            } else {
                // Should not happen if result.success is true without accessToken or needsVerification
                console.error('Login API: Successful result but no token or 2FA needed.');
                return json({ success: false, message: 'Login process error.' }, { status: 500 });
            }
        } else {
            // Login or 2FA failed
            return json({ success: false, message: result.message || 'Login failed. Please check your credentials.' }, { status: 401 });
        }
    } catch (error) {
        console.error('Error in /api/login POST handler:', error);
        return json({ success: false, message: 'Internal server error during login.' }, { status: 500 });
    }
}
