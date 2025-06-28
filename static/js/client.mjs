/**
 * @typedef {Object} PrinterStatus
 * @property {string} status - Current printer status
 * @property {string} [formatted_status] - Formatted status message
 * @property {string} [dev_name] - Device name
 * @property {number} [progress] - Print progress percentage
 * @property {string} [estimated_finish_time] - Estimated finish time
 * @property {number} [current_temp_nozzle] - Current nozzle temperature
 * @property {number} [target_temp_nozzle] - Target nozzle temperature
 * @property {number} [current_temp_bed] - Current bed temperature
 * @property {number} [target_temp_bed] - Target bed temperature
 * @property {string} [filament_type] - Type of filament
 * @property {Array} [available_printers] - List of available printers
 * @property {string} [dev_id] - Device ID
 * @property {string} [message] - Status message
 */

const BACKEND_URL = 'http://localhost:3000';

// DOM Elements
const messageBox = document.getElementById('messageBox');
const loginSection = document.getElementById('loginSection');
const verificationSection = document.getElementById('verificationSection');
const statusSection = document.getElementById('statusSection');
const emailInput = document.getElementById('emailInput');
const passwordInput = document.getElementById('passwordInput');
const loginButton = document.getElementById('loginButton');
const verificationCodeInput = document.getElementById('verificationCodeInput');
const verifyButton = document.getElementById('verifyButton');
const backToLoginButton = document.getElementById('backToLoginButton');
const printerStatus = document.getElementById('printerStatus');
const printerDetailsDiv = document.getElementById('printerDetails');
const loadingIndicator = document.getElementById('loadingIndicator');
const refreshButton = document.getElementById('refreshButton');
const printerSerialInput = document.getElementById('printerSerial');
const printerNameInput = document.getElementById('printerName');
const addPrinterButton = document.getElementById('addPrinterButton');
const printerList = document.getElementById('printerList');
const printerSelect = document.getElementById('printerSelect');
const printerManagementSection = document.getElementById('printerManagementSection');
const validatePrintersButton = document.getElementById('validatePrintersButton');

// Global state
let hasAttemptedLogin = false;
let selectedPrinterId = null;
let configuredPrinters = [];

// Utility Functions
export function showMessage(message, type = 'info') {
    messageBox.textContent = message;
    messageBox.className = `message-box ${type}`;
    messageBox.style.display = 'block';
    
    setTimeout(() => {
        messageBox.style.display = 'none';
    }, 5000);
}

export function hideMessage() {
    messageBox.style.display = 'none';
}

export function formatTimeFromSeconds(timestampSeconds) {
    const date = new Date(timestampSeconds * 1000);
    return date.toLocaleTimeString();
}

// Update the printer selector dropdown
function updatePrinterSelector(availablePrinters, selectedPrinterId) {
    if (!printerSelect) return;
    
    // Save the current selection
    const currentSelection = printerSelect.value;
    
    // Clear existing options
    printerSelect.innerHTML = '';
    
    // Add default option
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = 'Alle Drucker anzeigen';
    printerSelect.appendChild(defaultOption);
    
    // Add available printers
    availablePrinters.forEach(printer => {
        const option = document.createElement('option');
        option.value = printer.dev_id || printer.serial || printer;
        option.textContent = printer.dev_name || printer.name || printer.serial || printer;
        option.selected = (printer.dev_id === selectedPrinterId) || (printer.serial === selectedPrinterId);
        printerSelect.appendChild(option);
    });
    
    // Show the selector if there are multiple printers
    const printerSelector = document.getElementById('printerSelector');
    if (printerSelector) {
        printerSelector.classList.toggle('hidden', availablePrinters.length <= 1);
    }
}

// Printer Management
export async function loadPrinters() {
    try {
        const response = await fetch('/api/printers', {
            method: 'GET',
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error('Fehler beim Laden der Druckerliste');
        }

        const data = await response.json();
        configuredPrinters = data.printers || [];
        displayPrinters(configuredPrinters);
        await fetchPrinterStatus();
        return configuredPrinters;
    } catch (error) {
        console.error('Fehler beim Laden der Drucker:', error);
        showMessage(`Fehler beim Laden der Drucker: ${error.message}`, 'error');
        return [];
    }
}

export function displayPrinters(printers) {
    if (!printerList) return;
    
    if (!printers || printers.length === 0) {
        printerList.innerHTML = `
            <div class="text-center py-4 text-gray-500 dark:text-gray-400">
                Keine Drucker konfiguriert. Fügen Sie einen Drucker hinzu.
            </div>`;
        return;
    }

    printerList.innerHTML = printers.map(printer => {
        const serial = typeof printer === 'string' ? printer : printer.serial;
        const name = typeof printer === 'object' ? printer.name : '';
        
        return `
            <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-4 flex justify-between items-center">
                <div>
                    <div class="font-medium text-gray-900 dark:text-gray-100">${name || 'Drucker'}</div>
                    <div class="text-sm text-gray-500 dark:text-gray-400">${serial}</div>
                </div>
                <button onclick="removePrinter('${serial}')" class="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                </button>
            </div>`;
    }).join('');
}

// API Functions
export async function fetchPrinterStatus(printerId = null) {
    hideMessage();
    if (loadingIndicator) loadingIndicator.style.display = 'block';
    if (refreshButton) refreshButton.disabled = true;

    try {
        let url = `${BACKEND_URL}/api/printer-status`;
        if (printerId) {
            url += `?serial=${encodeURIComponent(printerId)}`;
        }

        const response = await fetch(url, {
            credentials: 'include'
        });
        const data = await response.json();

        if (response.ok) {
            if (data.available_printers?.length > 1) {
                updatePrinterSelector(data.available_printers, printerId || data.dev_id);
            } else if (document.getElementById('printerSelector')) {
                document.getElementById('printerSelector').classList.add('hidden');
            }

            // Update UI with printer status
            if (printerStatus) {
                printerStatus.textContent = data.formatted_status || `Status: ${data.status || 'Unbekannt'}`;
            }

            // Update printer details
            if (printerDetailsDiv) {
                let detailsMessage = '';
                switch(data.status) {
                    case 'PRINTING':
                        detailsMessage = `Druckjob: ${data.dev_name || 'Unbekannt'} (${data.progress || 0}%)<br>`;
                        if (data.estimated_finish_time) {
                            detailsMessage += `Voraussichtliche Fertigstellung: ${formatTimeFromSeconds(data.estimated_finish_time)}<br>`;
                        }
                        if (data.current_temp_nozzle !== undefined) {
                            detailsMessage += `Düse: ${data.current_temp_nozzle}°C`;
                            if (data.target_temp_nozzle) detailsMessage += ` / ${data.target_temp_nozzle}°C`;
                            if (data.current_temp_bed !== undefined) {
                                detailsMessage += `, Bett: ${data.current_temp_bed}°C`;
                                if (data.target_temp_bed) detailsMessage += ` / ${data.target_temp_bed}°C`;
                            }
                            detailsMessage += '<br>';
                        }
                        if (data.filament_type) {
                            detailsMessage += `Filament: ${data.filament_type}`;
                        }
                        break;
                    case 'IDLE':
                        detailsMessage = 'Drucker ist online und bereit.';
                        break;
                    case 'PAUSED':
                        detailsMessage = 'Druck ist pausiert.';
                        if (data.dev_name) detailsMessage = `Druckjob: ${data.dev_name} (pausiert)`;
                        break;
                    case 'SUCCESS':
                        detailsMessage = 'Der letzte Druck wurde erfolgreich abgeschlossen.';
                        break;
                    case 'FAILED':
                        detailsMessage = 'Ein Fehler ist aufgetreten. Bitte überprüfen Sie den Drucker.';
                        break;
                    default:
                        detailsMessage = data.message || 'Keine weiteren Details verfügbar.';
                }
                printerDetailsDiv.innerHTML = detailsMessage;
            }

            // Show status section if not already visible
            if (statusSection && !statusSection.classList.contains('hidden')) {
                statusSection.classList.remove('hidden');
            }
        } else {
            const errorMsg = data.message || 'Unbekannter Fehler';
            showMessage(`Fehler: ${errorMsg}`, 'error');
            if (printerStatus) printerStatus.textContent = 'Status nicht verfügbar';
            if (printerDetailsDiv) printerDetailsDiv.textContent = errorMsg;
        }
    } catch (error) {
        console.error('Fehler beim Abrufen des Druckerstatus:', error);
        showMessage('Verbindungsfehler. Bitte überprüfen Sie Ihre Internetverbindung.', 'error');
        if (printerStatus) printerStatus.textContent = 'Verbindungsfehler';
        if (printerDetailsDiv) printerDetailsDiv.textContent = 'Der Server konnte nicht erreicht werden.';
    } finally {
        if (loadingIndicator) loadingIndicator.style.display = 'none';
        if (refreshButton) refreshButton.disabled = false;
    }
}

// Event Handlers
export function handleLogin() {
    // Implementation...
}

export function handleVerification() {
    // Implementation...
}

export function backToLogin() {
    if (verificationSection) verificationSection.classList.add('hidden');
    if (loginSection) loginSection.classList.remove('hidden');
    if (verificationCodeInput) verificationCodeInput.value = '';
}

// Check if login form is valid and update button state
function updateLoginButtonState() {
    if (!loginButton) return;
    
    const isFormValid = emailInput && emailInput.value.trim() !== '' && 
                      passwordInput && passwordInput.value.trim() !== '';
    
    if (isFormValid) {
        loginButton.classList.remove('opacity-50', 'cursor-not-allowed');
        loginButton.disabled = false;
    } else {
        loginButton.classList.add('opacity-50', 'cursor-not-allowed');
        loginButton.disabled = true;
    }
}

// Initialize event listeners
export function initEventListeners() {
    if (loginButton) loginButton.addEventListener('click', handleLogin);
    if (verifyButton) verifyButton.addEventListener('click', handleVerification);
    if (backToLoginButton) backToLoginButton.addEventListener('click', backToLogin);
    
    // Add input event listeners for login form validation
    if (emailInput && passwordInput) {
        const validateForm = () => updateLoginButtonState();
        
        emailInput.addEventListener('input', validateForm);
        passwordInput.addEventListener('input', validateForm);
        
        // Also validate on paste events
        emailInput.addEventListener('paste', validateForm);
        passwordInput.addEventListener('paste', validateForm);
        
        // Enter key support for login form
        emailInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !loginButton.disabled) handleLogin();
        });
        passwordInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !loginButton.disabled) handleLogin();
        });
    }
    
    // Initial validation
    updateLoginButtonState();
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    initEventListeners();
    
    // Show login section by default
    if (loginSection) loginSection.classList.remove('hidden');
    if (printerManagementSection) printerManagementSection.classList.add('hidden');
    if (verificationSection) verificationSection.classList.add('hidden');
    if (statusSection) statusSection.classList.add('hidden');
});
