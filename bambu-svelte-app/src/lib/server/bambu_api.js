import fetch from 'node-fetch';
import { BAMBU_API_BASE_URL } from '$env/static/private'; // Using $env for base URL

/**
 * Logs into the Bambu Lab Cloud.
 * @param {string} email - User's email.
 * @param {string} password - User's password.
 * @returns {Promise<{success: boolean, needsVerification: boolean, tfaKey?: string, accessToken?: string, message?: string}>} Login result.
 */
export async function loginToBambuLabCloud(email, password) {
    console.log(`Attempting to log into Bambu Lab Cloud with email: ${email}`);
    try {
        const response = await fetch(`${BAMBU_API_BASE_URL}/v1/user-service/user/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ account: email, password: password }),
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('Bambu Cloud Login Error:', data.message || response.statusText);
            return { success: false, needsVerification: false, message: data.message || `Error: ${response.statusText}` };
        }

        console.log('Login response (full):', JSON.stringify(data, null, 2));

        if (data.loginType === 'verifyCode') {
            console.log('2FA required. Verification code sent.');
            return {
                success: true, // The initial request was successful in that it determined 2FA is needed
                needsVerification: true,
                tfaKey: data.tfaKey || '', // Handle empty tfaKey
                message: 'Verification code sent. Please enter the code.',
            };
        }

        const accessToken = data.accessToken || data.access_token || data.token || data.authToken || '';
        if (accessToken && accessToken.trim() !== '') {
            console.log('Login successful! Access Token obtained.');
            if (data.expiresIn) {
                console.log(`Token valid for: ${data.expiresIn / 3600 / 24} days`);
            }
            return { success: true, needsVerification: false, accessToken: accessToken, message: 'Login successful!' };
        } else {
            console.error('No Access Token found in response.');
            console.log('Available fields in response:', Object.keys(data));
            return { success: false, needsVerification: false, message: 'Login failed: No access token received.' };
        }
    } catch (error) {
        console.error('Error during loginToBambuLabCloud:', error.message);
        return { success: false, needsVerification: false, message: `Network or other error: ${error.message}` };
    }
}

/**
 * Verifies the Two-Factor Authentication code.
 * @param {string} tfaKey - The TFA key from the initial login attempt.
 * @param {string} verificationCode - The verification code from the user.
 * @returns {Promise<{success: boolean, accessToken?: string, message?: string}>} Verification result.
 */
export async function verifyTwoFactorAuth(tfaKey, verificationCode) {
    console.log(`Attempting to verify 2FA with code...`);
    try {
        const response = await fetch(`${BAMBU_API_BASE_URL}/v1/user-service/user/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tfaKey: tfaKey, code: verificationCode }),
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('Bambu Cloud 2FA Verification Error:', data.message || response.statusText);
            return { success: false, message: data.message || `Error: ${response.statusText}` };
        }

        console.log('2FA Verification response (full):', JSON.stringify(data, null, 2));
        const accessToken = data.accessToken || data.access_token || data.token || data.authToken || '';

        if (accessToken && accessToken.trim() !== '') {
            console.log('2FA Verification successful! Access Token obtained.');
            if (data.expiresIn) {
                console.log(`Token valid for: ${data.expiresIn / 3600 / 24} days`);
            }
            return { success: true, accessToken: accessToken, message: 'Verification successful!' };
        } else {
            console.error('No Access Token found in 2FA verification response.');
            console.log('Available fields in response:', Object.keys(data));
            return { success: false, message: 'Verification failed: No access token received.' };
        }
    } catch (error) {
        console.error('Error during verifyTwoFactorAuth:', error.message);
        return { success: false, message: `Network or other error: ${error.message}` };
    }
}

// Placeholder for other API functions (managePrinters etc.)
// These will be added in subsequent steps.

/**
 * Fetches the status of printers from Bambu Lab Cloud.
 * @param {string} accessToken - The user's access token.
 * @param {string} [serial] - Optional printer serial to fetch status for a specific printer.
 * @returns {Promise<object>} Printer status data or error object.
 */
export async function getPrinterStatus(accessToken, serial) {
    console.log(`Fetching printer status. Token: ${accessToken ? 'present' : 'missing'}, Serial: ${serial || 'all'}`);
    if (!accessToken) {
        return { success: false, message: 'Access token is required.', status: 401 };
    }

    try {
        // The original code fetched `/v1/iot-service/api/user/print` which seems to list print jobs.
        // It then derived status from the latest print job.
        // Let's replicate that logic.
        const response = await fetch(`${BAMBU_API_BASE_URL}/v1/iot-service/api/user/print`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${accessToken}` },
        });

        if (!response.ok) {
            if (response.status === 401) {
                console.warn('Printer status fetch: Token unauthorized/expired.');
                return { success: false, message: 'Session token expired or invalid. Please log in again.', status: 401 };
            }
            const errorData = await response.json().catch(() => ({ message: `HTTP ${response.status}: ${response.statusText}` }));
            console.error('Error fetching printer status from Bambu API:', errorData.message);
            return { success: false, message: errorData.message || `Failed to fetch printer status: ${response.statusText}`, status: response.status };
        }

        const data = await response.json();
        console.log('Bambu Lab API /user/print response:', JSON.stringify(data, null, 2));

        if (!data.prints || !Array.isArray(data.prints) || data.prints.length === 0) {
            return {
                success: true, // API call was fine, but no data
                status: 'NO_DATA',
                formatted_status: 'No print data available from Bambu Cloud.',
                message: 'No active or recent print jobs found.',
                available_printers: await getAvailablePrintersFromUserBind(accessToken) // Try to get available printers anyway
            };
        }

        const allKnownPrinters = await getAvailablePrintersFromUserBind(accessToken);

        let filteredPrints = data.prints;
        if (serial) {
            filteredPrints = data.prints.filter(p => p.deviceId === serial);
            if (filteredPrints.length === 0) {
                return {
                    success: true, // API call ok
                    status: 'NO_DATA_FOR_SERIAL',
                    formatted_status: `No print data for printer ${serial}.`,
                    message: `Printer ${serial} not found among active jobs or does not have recent print data.`,
                    available_printers: allKnownPrinters,
                };
            }
        }
        // If no serial, or serial not found in active prints, we might want to show status for the "primary" or "first" printer.
        // The original logic picked the latest job from (potentially filtered) prints.

        if (filteredPrints.length === 0) { // This case implies no specific serial or serial had no jobs
             return {
                success: true,
                status: 'IDLE_OR_NO_JOBS', // Or a more specific status based on user's printers
                formatted_status: 'Printers idle or no recent jobs.',
                message: 'No active print jobs found for the selected scope.',
                available_printers: allKnownPrinters,
            };
        }

        // Get the most recent print job from the filtered list
        const latestPrint = filteredPrints.reduce((latest, current) => {
            const latestTime = new Date(latest.startTime || latest.created_at || 0);
            const currentTime = new Date(current.startTime || current.created_at || 0);
            return currentTime > latestTime ? current : latest;
        });

        let printStatus = 'UNKNOWN';
        let formattedStatus = 'Status Unbekannt';

        // Mapping based on original server.js
        switch (latestPrint.status) {
            case 'RUNNING':
                printStatus = 'PRINTING';
                formattedStatus = 'Druckt';
                break;
            case 'PAUSE':
                printStatus = 'PAUSED';
                formattedStatus = 'Pausiert';
                break;
            case 'FINISH':
                printStatus = 'SUCCESS'; // Or IDLE if it implies printer is ready for next job
                formattedStatus = 'Erfolgreich abgeschlossen';
                break;
            case 'FAILED':
                printStatus = 'FAILED';
                formattedStatus = 'Fehlgeschlagen';
                break;
            default: // Covers IDLE, SLICING, etc.
                printStatus = latestPrint.status ? latestPrint.status.toUpperCase() : 'UNKNOWN';
                formattedStatus = `Status: ${latestPrint.status || 'Unbekannt'}`;
        }

        return {
            success: true,
            status: printStatus,
            formatted_status: formattedStatus,
            dev_id: latestPrint.deviceId,
            dev_name: latestPrint.deviceName || latestPrint.deviceId, // Use deviceId as fallback for name
            progress: latestPrint.progress !== undefined ? parseFloat(latestPrint.progress) : 0,
            estimated_finish_time: latestPrint.endTime ? Math.floor(new Date(latestPrint.endTime).getTime() / 1000) : null,
            current_temp_nozzle: latestPrint.nozzleTemp,
            target_temp_nozzle: latestPrint.nozzleTempTarget,
            current_temp_bed: latestPrint.bedTemp,
            target_temp_bed: latestPrint.bedTempTarget,
            filament_type: latestPrint.filamentType, // This might not always be present
            message: `Status for printer: ${latestPrint.deviceName || latestPrint.deviceId}`,
            available_printers: allKnownPrinters, // List all printers associated with the account
            raw_print_job_details: latestPrint, // Include for more detailed client-side rendering if needed
        };

    } catch (error) {
        console.error('Error in getPrinterStatus:', error.message);
        return { success: false, message: `Network or other error: ${error.message}`, status: 500 };
    }
}


async function getAvailablePrintersFromUserBind(accessToken) {
    const bindResult = await getBoundDevices(accessToken);
    if (bindResult.success && bindResult.devices) {
        return bindResult.devices.map(d => ({
            dev_id: d.dev_id,
            dev_name: d.dev_name || d.dev_id, // Fallback name
            serial: d.dev_id, // Use dev_id as serial
            online: d.dev_online,
            product_name: d.dev_product_name,
        }));
    }
    return []; // Return empty if error or no devices
}


export async function getBoundDevices(accessToken) {
    console.log('Fetching bound devices...');
    try {
        const response = await fetch(`${BAMBU_API_BASE_URL}/v1/iot-service/api/user/bind`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
            },
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: response.statusText }));
            console.error('Error fetching bound devices:', errorData.message || response.statusText);
            return { success: false, message: errorData.message || `Error: ${response.statusText}` };
        }
        const data = await response.json();
        console.log('Bound devices data:', data);
        return { success: true, devices: data.devices || [] };
    } catch (error) {
        console.error('Error in getBoundDevices:', error.message);
        return { success: false, message: `Network or other error: ${error.message}` };
    }
}
