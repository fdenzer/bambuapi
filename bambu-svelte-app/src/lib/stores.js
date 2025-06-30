import { writable } from 'svelte/store';

// Message store: { text: string, type: 'info' | 'error' | 'success', visible: boolean }
export const message = writable({ text: '', type: 'info', visible: false });

export function showMessage(text, type = 'info', duration = 5000) {
    message.set({ text, type, visible: true });
    if (duration > 0) {
        setTimeout(() => {
            message.set({ text: '', type: 'info', visible: false });
        }, duration);
    }
}

export function hideMessage() {
    message.set({ text: '', type: 'info', visible: false });
}


// Authentication store
// User object could be: { isAuthenticated: boolean, email?: string, tfaKey?: string, isLoading: boolean }
export const auth = writable({
    isAuthenticated: false,
    email: null, // Could be pre-filled from server-side session if available
    isLoading: true, // To check initial auth status from server
    needsVerification: false,
    tfaKey: null, // Store tfaKey if 2FA is needed
});


// Printer stores
export const printers = writable({
    configured: [], // List of {serial, name} printers configured by the user
    available: [], // List of {dev_id, dev_name, ...} printers available on Bambu account
    isLoading: false,
});

// Current printer status display
// Could be a single object or an array if displaying multiple printers
export const printerStatusDisplay = writable({
    // dev_id: null,
    // dev_name: null,
    // status: 'UNKNOWN', // e.g. PRINTING, IDLE, PAUSED, SUCCESS, FAILED, OFFLINE
    // formatted_status: 'Status Unbekannt',
    // progress: 0,
    // estimated_finish_time: null, // timestamp in seconds
    // current_temp_nozzle: 0,
    // target_temp_nozzle: 0,
    // current_temp_bed: 0,
    // target_temp_bed: 0,
    // filament_type: null,
    // message: 'Lade Druckerstatus...',
    // isLoading: true,
    // available_printers_from_status_api: [] // printers reported by the status endpoint itself
    // Let's simplify: an array of status objects, one per printer, or a single one for the selected printer.
    // For now, let's assume we display one main status.
    data: null, // This will hold the full status object from the API for the selected/primary printer
    isLoading: true,
});

// Selected printer ID for fetching status (can be a serial)
export const selectedPrinterId = writable(null);


// Utility to format time from Bambu's API (seconds timestamp)
export function formatTimeFromSeconds(timestampSeconds) {
    if (!timestampSeconds) return 'N/A';
    const date = new Date(timestampSeconds * 1000); // Convert to milliseconds
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
