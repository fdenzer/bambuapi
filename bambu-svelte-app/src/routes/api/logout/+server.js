import { json } from '@sveltejs/kit';

/** @type {import('./$types').RequestHandler} */
export async function POST({ cookies }) {
    try {
        // Clear the session cookies
        cookies.delete('bambu_token', { path: '/' });
        cookies.delete('bambu_user_email', { path: '/' });
        // If using a server-side session store, you would invalidate the session here.

        console.log('Logout API: User logged out, cookies cleared.');
        return json({ success: true, message: 'Logout successful.' });
    } catch (error) {
        console.error('Error in /api/logout POST handler:', error);
        return json({ success: false, message: 'Internal server error during logout.' }, { status: 500 });
    }
}
