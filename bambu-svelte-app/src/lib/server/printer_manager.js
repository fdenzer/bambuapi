import fs from 'fs/promises';
import path from 'path';
import { dev } from '$app/environment';

// Path to the printers JSON file.
// IMPORTANT: This file-based storage approach has limitations for serverless deployments like Netlify.
// - Writing to the filesystem during function execution is often not persisted or unreliable.
// - For local development (npm run dev), this will work as expected.
// - For production on Netlify, a proper database (e.g., FaunaDB, Supabase, Vercel KV)
//   or Netlify Blobs (if suitable) should be used for persistent storage.
// This implementation mimics the original project's fs usage for `printers.json`
// but with the understanding that it's primarily for local dev or specific environments
// where fs writes are persistent.

// Using a path relative to the current module. This should work better.
// __dirname is not available in ES modules by default.
// We can use `import.meta.url` to construct a path.
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Place printers.json inside a 'data' subdirectory within 'src/lib/server'
const DATA_DIR = path.join(__dirname, 'data');
const PRINTERS_FILE_PATH = path.join(DATA_DIR, 'printers.json');

async function ensureDataFileExists() {
    try {
        await fs.mkdir(DATA_DIR, { recursive: true });
        // Try to access the file. If it doesn't exist, ENOENT will be caught.
        // If it exists, we do nothing. If it doesn't, we create it with an empty array.
        await fs.access(PRINTERS_FILE_PATH);
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.log(`Printers file not found at ${PRINTERS_FILE_PATH}, creating with empty list.`);
            await fs.writeFile(PRINTERS_FILE_PATH, JSON.stringify([], null, 2), 'utf-8');
        } else {
            console.error('Error ensuring printer data file/directory exists:', error);
            throw error; // Rethrow other errors
        }
    }
}


/**
 * Loads the list of configured printers.
 * @returns {Promise<Array<{serial: string, name: string}>>}
 */
export async function loadPrinters() {
    await ensureDataFileExists(); // Ensures directory and file exist
    try {
        const data = await fs.readFile(PRINTERS_FILE_PATH, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') {
            // If file doesn't exist, return empty array and try to create the file.
            await savePrinters([]);
            return [];
        }
        console.error('Error loading printers:', error);
        throw error; // Re-throw for the caller to handle
    }
}

/**
 * Saves the list of printers.
 * @param {Array<{serial: string, name: string}>} printers
 */
export async function savePrinters(printers) {
    await ensureDataDirectoryExists();
    try {
        await fs.writeFile(PRINTERS_FILE_PATH, JSON.stringify(printers, null, 2), 'utf-8');
    } catch (error) {
        console.error('Error saving printers:', error);
        throw error;
    }
}

/**
 * Adds a printer to the list. If it exists, it updates it.
 * @param {{serial: string, name?: string}} printerToAdd
 */
export async function addOrUpdatePrinter(printerToAdd) {
    if (!printerToAdd.serial) {
        throw new Error('Printer serial is required.');
    }
    const printers = await loadPrinters();
    const existingIndex = printers.findIndex(p => p.serial === printerToAdd.serial);
    if (existingIndex !== -1) {
        printers[existingIndex] = { ...printers[existingIndex], ...printerToAdd };
    } else {
        printers.push({ serial: printerToAdd.serial, name: printerToAdd.name || '' });
    }
    await savePrinters(printers);
    return printers;
}

/**
 * Removes a printer by its serial number.
 * @param {string} serial
 */
export async function removePrinter(serial) {
    let printers = await loadPrinters();
    const initialLength = printers.length;
    printers = printers.filter(p => p.serial !== serial);
    if (printers.length === initialLength) {
        throw new Error('Printer not found.'); // Or return a specific status/message
    }
    await savePrinters(printers);
    return printers;
}
