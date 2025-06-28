// server.js - Netlify Function for Bambu Lab API
// This serverless function handles all communication with Bambu Lab Cloud API
// and provides HTTP endpoints for the client-side application.

require('dotenv').config()
const express = require('express')
const serverless = require('serverless-http')
const fetch = require('node-fetch')
const session = require('express-session')
const fs = require('fs').promises
const path = require('path')

const app = express()

/**
 * @typedef {Object} BambuDevice
 * @property {string} dev_id - Device ID
 * @property {string} dev_name - Device name
 * @property {string} dev_product_name - Device model name
 * @property {boolean} dev_online - Whether the device is online
 * @property {string} print_status - Current print status
 * @property {string} [name] - Optional display name
 * @property {string} [serial] - Alias for dev_id
 */

const BAMBU_API_BASE_URL = 'https://api.bambulab.com'

// Session-Konfiguration für express-session
app.use(session({
    secret: process.env.SESSION_SECRET || 'fallback-secret-for-development',
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 1000 * 60 * 60 * 24 // Cookie 1 Tag gültig (entspricht ca. der Token-Gültigkeit)
        // secure: true, // Nur über HTTPS senden (für Produktion aktivieren)
        // httpOnly: true, // Cookie nur über HTTP(S) zugänglich, nicht über Client-Side-Skripte
    }
}))

app.use(express.json())

// Express.js Middleware für CORS
app.use((req, res, next) => {
    // Setzt 'Access-Control-Allow-Origin' dynamisch auf den Origin-Header der Anfrage,
    // um CORS für die aufrufende Domain zu erlauben (z.B. für GitHub Pages von fdenzer).
    // Falls kein Origin-Header vorhanden ist, wird ein Standard-Origin gesetzt.
    const allowedOrigin = req.headers.origin;
    res.header('Access-Control-Allow-Origin', allowedOrigin || 'https://fdenzer.github.io');
    res.header('Access-Control-Allow-Methods', 'GET,POST,DELETE');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    res.header('Access-Control-Allow-Credentials', 'true') // Erlaubt das Senden von Cookies/Session-IDs
    next()
})

/**
 * Versucht, sich bei der Bambu Lab Cloud anzumelden und Tokens zu erhalten.
 * @param {string} email - Die E-Mail-Adresse des Bambu Lab Kontos.
 * @param {string} password - Das Passwort des Bambu Lab Kontos.
 * @returns {Promise<{success: boolean, needsVerification: boolean, tfaKey?: string, accessToken?: string}>} Login-Ergebnis
 */
async function loginToBambuLabCloud(email, password) {
    console.log(`Versuche, mich bei Bambu Lab Cloud mit E-Mail: ${email} anzumelden...`)
    try {
        const response = await fetch(`${BAMBU_API_BASE_URL}/v1/user-service/user/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                account: email,
                password: password
            })
        })

        if (!response.ok) {
            const errorData = await response.json()
            console.error('Login-Fehler:', errorData.message || response.statusText)
            return {success: false, needsVerification: false}
        }

        const data = await response.json()
        console.log('Login-Antwort (vollständig):', JSON.stringify(data, null, 2))

        // Check if verification is needed
        if (data.loginType === 'verifyCode') {
            console.log('Zwei-Faktor-Authentifizierung erforderlich. Verifikationscode wurde gesendet.')
            return {
                success: true,
                needsVerification: true,
                tfaKey: data.tfaKey || '' // Handle empty tfaKey
            }
        }

        // Check for access token
        const accessToken = data.accessToken || data.access_token || data.token || data.authToken || ''

        if (accessToken && accessToken.trim() !== '') {
            console.log('Login erfolgreich! Access Token erhalten.')
            if (data.expiresIn) {
                console.log(`Token gültig für: ${data.expiresIn / 3600 / 24} Tage`)
            }
            return {success: true, needsVerification: false, accessToken: accessToken}
        } else {
            console.error('Kein Access Token in der Antwort gefunden.')
            console.log('Verfügbare Felder in der Antwort:', Object.keys(data))
            return {success: false, needsVerification: false}
        }
    } catch (error) {
        console.error('Fehler beim Login:', error.message)
        return {success: false, needsVerification: false}
    }
}

/**
 * Versucht, die Zwei-Faktor-Authentifizierung mit dem gegebenen Code abzuschließen.
 * @param {string} tfaKey - Der TFA-Schlüssel aus dem ersten Login-Schritt.
 * @param {string} verificationCode - Der Verifikationscode.
 * @returns {Promise<{success: boolean, accessToken?: string}>} Verifikations-Ergebnis
 */
async function verifyTwoFactorAuth(tfaKey, verificationCode) {
    console.log(`Versuche, Zwei-Faktor-Authentifizierung mit Code zu verifizieren...`)
    try {
        const response = await fetch(`${BAMBU_API_BASE_URL}/v1/user-service/user/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                tfaKey: tfaKey,
                code: verificationCode
            })
        })

        if (!response.ok) {
            const errorData = await response.json()
            console.error('Verifikations-Fehler:', errorData.message || response.statusText)
            return {success: false}
        }

        const data = await response.json()
        console.log('Verifikations-Antwort (vollständig):', JSON.stringify(data, null, 2))

        // Check for access token
        const accessToken = data.accessToken || data.access_token || data.token || data.authToken || ''

        if (accessToken && accessToken.trim() !== '') {
            console.log('Verifikation erfolgreich! Access Token erhalten.')
            if (data.expiresIn) {
                console.log(`Token gültig für: ${data.expiresIn / 3600 / 24} Tage`)
            }
            return {success: true, accessToken: accessToken}
        } else {
            console.error('Kein Access Token in der Verifikations-Antwort gefunden.')
            console.log('Verfügbare Felder in der Antwort:', Object.keys(data))
            return {success: false}
        }
    } catch (error) {
        console.error('Fehler bei der Verifikation:', error.message)
        return {success: false}
    }
}

// Login endpoint
app.post('/api/login', async (req, res) => {
    const {email, password, verificationCode, tfaKey} = req.body

    if (!email || !password) {
        return res.status(400).json({
            success: false,
            message: 'E-Mail und Passwort sind erforderlich.'
        })
    }

    try {
        let result

        if (verificationCode && tfaKey) {
            // Handle two-factor authentication
            result = await verifyTwoFactorAuth(tfaKey, verificationCode)
        } else {
            // Handle initial login
            result = await loginToBambuLabCloud(email, password)
        }

        if (result.success) {
            if (result.needsVerification) {
                // Two-factor authentication required
                req.session.tfaKey = result.tfaKey
                res.json({
                    success: true,
                    needsVerification: true,
                    tfaKey: result.tfaKey,
                    message: 'Verifikationscode wurde gesendet. Bitte geben Sie den Code ein.'
                })
            } else if (result.accessToken) {
                // Login successful
                req.session.accessToken = result.accessToken
                req.session.email = email
                res.json({
                    success: true,
                    needsVerification: false,
                    message: 'Login erfolgreich!'
                })
            } else {
                res.status(401).json({
                    success: false,
                    message: 'Login fehlgeschlagen. Bitte überprüfen Sie Ihre Anmeldedaten.'
                })
            }
        } else {
            res.status(401).json({
                success: false,
                message: 'Login fehlgeschlagen. Bitte überprüfen Sie Ihre Anmeldedaten.'
            })
        }
    } catch (error) {
        console.error('Fehler beim Login-Endpunkt:', error)
        res.status(500).json({
            success: false,
            message: 'Interner Serverfehler beim Login.'
        })
    }
})

// Logout endpoint
app.post('/api/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Fehler beim Logout:', err)
            return res.status(500).json({
                success: false,
                message: 'Fehler beim Logout'
            })
        }
        res.json({
            success: true,
            message: 'Logout erfolgreich'
        })
    })
})

// Printer management functions
const PRINTERS_FILE = path.join(__dirname, 'printers.json')

async function loadPrintersFromFile() {
    try {
        const data = await fs.readFile(PRINTERS_FILE, 'utf8')
        return JSON.parse(data)
    } catch (error) {
        if (error.code === 'ENOENT') {
            return []
        }
        throw error
    }
}

async function savePrintersToFile(printers) {
    await fs.writeFile(PRINTERS_FILE, JSON.stringify(printers, null, 2))
}

// Get printers endpoint
app.get('/api/printers', async (req, res) => {
    try {
        const printers = await loadPrintersFromFile()
        res.json({success: true, printers})
    } catch (error) {
        console.error('Fehler beim Laden der Drucker:', error)
        res.status(500).json({success: false, message: 'Fehler beim Laden der Drucker'})
    }
})

// Add/update printers endpoint
app.post('/api/printers', async (req, res) => {
    try {
        const {printers} = req.body
        if (!Array.isArray(printers)) {
            return res.status(400).json({success: false, message: 'Ungültiges Drucker-Array'})
        }
        await savePrintersToFile(printers)
        res.json({success: true, message: 'Drucker erfolgreich gespeichert'})
    } catch (error) {
        console.error('Fehler beim Speichern der Drucker:', error)
        res.status(500).json({success: false, message: 'Fehler beim Speichern der Drucker'})
    }
})

// Add single printer endpoint
app.post('/api/printers/add', async (req, res) => {
    try {
        const {serial, name} = req.body
        if (!serial) {
            return res.status(400).json({success: false, message: 'Seriennummer ist erforderlich'})
        }

        const printers = await loadPrintersFromFile()
        
        // Check if printer already exists
        const existingIndex = printers.findIndex(p => 
            (typeof p === 'string' ? p : p.serial) === serial
        )
        
        if (existingIndex !== -1) {
            // Update existing printer
            printers[existingIndex] = {serial, name: name || ''}
        } else {
            // Add new printer
            printers.push({serial, name: name || ''})
        }
        
        await savePrintersToFile(printers)
        res.json({success: true, message: 'Drucker erfolgreich hinzugefügt'})
    } catch (error) {
        console.error('Fehler beim Hinzufügen des Druckers:', error)
        res.status(500).json({success: false, message: 'Fehler beim Hinzufügen des Druckers'})
    }
})

// Remove printer endpoint
app.delete('/api/printers/:serial', async (req, res) => {
    try {
        const {serial} = req.params
        const printers = await loadPrintersFromFile()
        
        const filteredPrinters = printers.filter(p => 
            (typeof p === 'string' ? p : p.serial) !== serial
        )
        
        if (filteredPrinters.length === printers.length) {
            return res.status(404).json({success: false, message: 'Drucker nicht gefunden'})
        }
        
        await savePrintersToFile(filteredPrinters)
        res.json({success: true, message: 'Drucker erfolgreich entfernt'})
    } catch (error) {
        console.error('Fehler beim Entfernen des Druckers:', error)
        res.status(500).json({success: false, message: 'Fehler beim Entfernen des Druckers'})
    }
})

// Validate printers endpoint
app.post('/api/printers/validate', async (req, res) => {
    if (!req.session.accessToken) {
        return res.status(401).json({success: false, message: 'Nicht angemeldet'})
    }

    try {
        const response = await fetch(`${BAMBU_API_BASE_URL}/v1/iot-service/api/user/bind`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${req.session.accessToken}`
            }
        })

        if (!response.ok) {
            return res.status(response.status).json({
                success: false,
                message: 'Fehler beim Validieren der Drucker'
            })
        }

        const data = await response.json()
        const availablePrinters = data.devices || []
        
        res.json({
            success: true,
            availablePrinters: availablePrinters.map(device => ({
                dev_id: device.dev_id,
                dev_name: device.dev_name,
                dev_product_name: device.dev_product_name,
                dev_online: device.dev_online
            }))
        })
    } catch (error) {
        console.error('Fehler beim Validieren der Drucker:', error)
        res.status(500).json({success: false, message: 'Interner Serverfehler'})
    }
})

// Printer status endpoint
app.get('/api/printer-status', async (req, res) => {
    if (!req.session.accessToken) {
        return res.status(401).json({
            success: false,
            message: 'Nicht angemeldet. Bitte melden Sie sich zuerst an.'
        })
    }

    try {
        const response = await fetch(`${BAMBU_API_BASE_URL}/v1/iot-service/api/user/print`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${req.session.accessToken}`
            }
        })

        if (!response.ok) {
            if (response.status === 401) {
                req.session.destroy()
                return res.status(401).json({
                    success: false,
                    message: 'Session abgelaufen. Bitte melden Sie sich erneut an.'
                })
            }
            throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }

        const data = await response.json()
        console.log('Bambu Lab API Antwort:', JSON.stringify(data, null, 2))

        if (!data.prints || !Array.isArray(data.prints)) {
            return res.json({
                success: true,
                status: 'NO_DATA',
                formatted_status: 'Keine Druckdaten verfügbar',
                message: 'Keine aktiven Druckjobs gefunden.',
                available_printers: []
            })
        }

        const requestedSerial = req.query.serial
        const configuredPrinters = await loadPrintersFromFile()
        
        let filteredPrints = data.prints
        let availablePrinters = []

        // Extract available printers from all prints
        data.prints.forEach(print => {
            if (print.deviceId && !availablePrinters.find(p => p.dev_id === print.deviceId)) {
                availablePrinters.push({
                    dev_id: print.deviceId,
                    dev_name: print.deviceName || print.deviceId,
                    serial: print.deviceId
                })
            }
        })

        // Filter by requested serial if provided
        if (requestedSerial) {
            filteredPrints = data.prints.filter(print => print.deviceId === requestedSerial)
            if (filteredPrints.length === 0) {
                return res.json({
                    success: true,
                    status: 'NO_DATA',
                    formatted_status: `Keine Daten für Drucker ${requestedSerial}`,
                    message: `Drucker ${requestedSerial} nicht gefunden oder keine aktiven Jobs.`,
                    available_printers: availablePrinters
                })
            }
        } else if (configuredPrinters.length > 0) {
            // Filter by configured printers if no specific serial requested
            const configuredSerials = configuredPrinters.map(p => 
                typeof p === 'string' ? p : p.serial
            )
            filteredPrints = data.prints.filter(print => 
                configuredSerials.includes(print.deviceId)
            )
        }

        if (filteredPrints.length === 0) {
            return res.json({
                success: true,
                status: 'IDLE',
                formatted_status: 'Alle konfigurierten Drucker sind bereit',
                message: 'Keine aktiven Druckjobs auf den konfigurierten Druckern.',
                available_printers: availablePrinters
            })
        }

        // Get the most recent print job
        const latestPrint = filteredPrints.reduce((latest, current) => {
            const latestTime = new Date(latest.startTime || latest.created_at || 0)
            const currentTime = new Date(current.startTime || current.created_at || 0)
            return currentTime > latestTime ? current : latest
        })

        // Map status
        let status = 'UNKNOWN'
        let formatted_status = 'Status unbekannt'

        switch (latestPrint.status) {
            case 'RUNNING':
                status = 'PRINTING'
                formatted_status = 'Druckt'
                break
            case 'PAUSE':
                status = 'PAUSED'
                formatted_status = 'Pausiert'
                break
            case 'FINISH':
                status = 'SUCCESS'
                formatted_status = 'Erfolgreich abgeschlossen'
                break
            case 'FAILED':
                status = 'FAILED'
                formatted_status = 'Fehlgeschlagen'
                break
            default:
                status = latestPrint.status || 'UNKNOWN'
                formatted_status = `Status: ${latestPrint.status || 'Unbekannt'}`
        }

        const response_data = {
            success: true,
            status: status,
            formatted_status: formatted_status,
            dev_id: latestPrint.deviceId,
            dev_name: latestPrint.deviceName || latestPrint.deviceId,
            progress: latestPrint.progress || 0,
            estimated_finish_time: latestPrint.endTime ? Math.floor(new Date(latestPrint.endTime).getTime() / 1000) : null,
            current_temp_nozzle: latestPrint.nozzleTemp,
            target_temp_nozzle: latestPrint.nozzleTempTarget,
            current_temp_bed: latestPrint.bedTemp,
            target_temp_bed: latestPrint.bedTempTarget,
            filament_type: latestPrint.filamentType,
            available_printers: availablePrinters,
            message: `Drucker: ${latestPrint.deviceName || latestPrint.deviceId}`
        }

        res.json(response_data)

    } catch (error) {
        console.error('Fehler beim Abrufen des Druckerstatus:', error)
        res.status(500).json({
            success: false,
            message: 'Fehler beim Abrufen des Druckerstatus: ' + error.message
        })
    }
})

// Export the serverless function
module.exports.handler = serverless(app)