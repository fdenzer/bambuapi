import { json } from '@sveltejs/kit';
import { getBoundDevices } from '$lib/server/bambu_api.js'; // Assuming bambu_api.js exports this

// POST /api/printers/validate - Fetches devices bound to the account from Bambu Lab API
// This helps the user see which printers are available on their Bambu account.
/** @type {import('./$types').RequestHandler} */
export async function POST({ locals, cookies }) { // Changed to POST as it might have side-effects or needs auth
    const token = locals.user?.token;

    if (!token) {
        return json({ success: false, message: 'Not authenticated. Please log in.' }, { status: 401 });
    }

    try {
        const result = await getBoundDevices(token);

        if (result.success) {
            // `result.devices` should contain the list of devices from Bambu API
            // Format them as needed for the client
            const availablePrinters = result.devices.map(device => ({
                dev_id: device.dev_id,
                dev_name: device.dev_name || device.dev_id, // Fallback name
                serial: device.dev_id, // Use dev_id as serial for consistency
                dev_product_name: device.dev_product_name,
                dev_online: device.dev_online,
            }));
            return json({ success: true, availablePrinters });
        } else {
            // If token is invalid, clear it
            if (result.status === 401) {
                cookies.delete('bambu_token', { path: '/' });
                cookies.delete('bambu_user_email', { path: '/' });
                locals.user = null;
            }
            return json({ success: false, message: result.message || 'Failed to validate printers with Bambu Lab API.' }, { status: result.status || 500 });
        }
    } catch (error) {
        console.error('Error validating printers in API:', error);
        return json({ success: false, message: 'Internal server error while validating printers.' }, { status: 500 });
    }
}
