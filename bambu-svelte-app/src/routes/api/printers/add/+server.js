import { json } from '@sveltejs/kit';
import { addOrUpdatePrinter } from '$lib/server/printer_manager.js';

// POST /api/printers/add - Add a new printer or update existing by serial
/** @type {import('./$types').RequestHandler} */
export async function POST({ request }) {
    try {
        const { serial, name } = await request.json();
        if (!serial) {
            return json({ success: false, message: 'Printer serial is required.' }, { status: 400 });
        }

        const updatedPrinters = await addOrUpdatePrinter({ serial, name: name || '' });
        return json({ success: true, message: 'Printer added/updated successfully.', printers: updatedPrinters });
    } catch (error) {
        console.error('Error adding/updating printer in API:', error);
        // Distinguish between client error (e.g. validation) and server error if possible
        if (error.message.includes('required')) { // Simple check
             return json({ success: false, message: error.message }, { status: 400 });
        }
        return json({ success: false, message: 'Failed to add/update printer.' }, { status: 500 });
    }
}
