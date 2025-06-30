import { json } from '@sveltejs/kit';
import { loadPrinters, savePrinters as savePrintersToFile } from '$lib/server/printer_manager.js';

// GET /api/printers - List all configured printers
/** @type {import('./$types').RequestHandler} */
export async function GET() {
    try {
        const printers = await loadPrinters();
        return json({ success: true, printers });
    } catch (error) {
        console.error('Error loading printers in API:', error);
        return json({ success: false, message: 'Failed to load printers.' }, { status: 500 });
    }
}

// POST /api/printers - Save/update the whole list of printers
// This might be useful if the client manages the list and sends it whole.
// However, the original app had /api/printers/add and /api/printers/:serial/remove
// It's good to keep this for potential bulk updates.
/** @type {import('./$types').RequestHandler} */
export async function POST({ request }) {
    try {
        const { printers } = await request.json();
        if (!Array.isArray(printers)) {
            return json({ success: false, message: 'Invalid printer data: must be an array.' }, { status: 400 });
        }
        // Basic validation for each printer object could be added here
        // e.g., ensure each has a 'serial'
        for (const p of printers) {
            if (!p.serial) {
                return json({ success: false, message: 'Invalid printer data: each printer must have a serial.'}, {status: 400});
            }
        }
        await savePrintersToFile(printers);
        return json({ success: true, message: 'Printers saved successfully.' });
    } catch (error) {
        console.error('Error saving printers in API:', error);
        return json({ success: false, message: 'Failed to save printers.' }, { status: 500 });
    }
}
