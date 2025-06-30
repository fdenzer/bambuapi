import { json } from '@sveltejs/kit';
import { getPrinterStatus } from '$lib/server/bambu_api.js';

/** @type {import('./$types').RequestHandler} */
export async function GET({ cookies, url, locals }) {
    // const token = cookies.get('bambu_token');
    // Use token from locals, populated by hooks.server.js
    const token = locals.user?.token;

    if (!token) {
        return json({ success: false, message: 'Not authenticated. Please log in.' }, { status: 401 });
    }

    const serial = url.searchParams.get('serial'); // Get specific printer serial if provided

    try {
        const statusResult = await getPrinterStatus(token, serial);

        if (statusResult.success) {
            // The getPrinterStatus function now returns a comprehensive object
            return json(statusResult);
        } else {
            // Handle cases where the API call itself failed or returned an error status
            // The status code should ideally be passed from statusResult if it's an API error
            const httpStatus = statusResult.status || 500; // Default to 500 if no specific status from function
            // If the token was invalid (401), clear it.
            if (httpStatus === 401) {
                cookies.delete('bambu_token', { path: '/' });
                cookies.delete('bambu_user_email', { path: '/' });
                locals.user = null; // Clear locals as well
            }
            return json({ success: false, message: statusResult.message || 'Failed to get printer status.' }, { status: httpStatus });
        }
    } catch (error)
        console.error('Error in /api/printer-status GET handler:', error);
        return json({ success: false, message: 'Internal server error while fetching printer status.' }, { status: 500 });
    }
}
