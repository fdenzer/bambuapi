// server.js - Node.js Backend für Bambu Lab Druckerstatus
// Dieses Backend stellt eine sichere Verbindung zur Bambu Lab Cloud API her
// und bietet HTTP-Endpunkte für Login und Druckerstatus für Ihre Frontend-Anwendung.

require('dotenv').config()
const express = require('express')
const fetch = require('node-fetch')
const session = require('express-session')
const app = express()
const port = 3000

const BAMBU_API_BASE_URL = 'https://api.bambulab.com'

// Session-Konfiguration für express-session
// In einer Produktionsumgebung:
// - 'secret' sollte ein langes, zufälliges, sicheres Geheimnis sein, das aus Umgebungsvariablen geladen wird.
// - 'resave' und 'saveUninitialized' sollten oft auf false gesetzt werden, um unnötige Session-Speicherungen zu vermeiden.
// - 'store' sollte eine persistente Session-Speicherung (z.B. Redis, MongoDB) verwenden, wenn Sie
//   mehrere Server-Instanzen betreiben oder Sessions über Server-Neustarts hinweg beibehalten möchten.
//   Für eine einzelne Server-Instanz, die bei Neustart den Login erfordert, reicht der MemoryStore.
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
  res.header('Access-Control-Allow-Methods', 'GET,POST');
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
async function loginToBambuLabCloud (email, password) {
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
      return { success: false, needsVerification: false }
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
    const accessToken = data.accessToken || data.access_token || data.token || data.authToken
    
    if (accessToken && accessToken.trim() !== '') {
      console.log('Login erfolgreich! Access Token erhalten.')
      if (data.expiresIn) {
        console.log(`Token gültig für: ${data.expiresIn / 3600 / 24} Tage`)
      }
      return { success: true, needsVerification: false, accessToken }
    } else {
      console.error('Login erfolgreich, aber kein Access Token in der Antwort gefunden.')
      console.error('Verfügbare Felder in der Antwort:', Object.keys(data))
      return { success: false, needsVerification: false }
    }
  } catch (error) {
    console.error('Fehler beim Login-Versuch:', error)
    return { success: false, needsVerification: false }
  }
}

/**
 * Verifiziert den Login mit einem Verifikationscode.
 * @param {string} email - Die E-Mail-Adresse des Bambu Lab Kontos.
 * @param {string} verificationCode - Der Verifikationscode.
 * @param {string} tfaKey - Der TFA-Schlüssel aus dem ersten Login-Versuch.
 * @returns {Promise<string|null>} Der Access Token bei Erfolg, sonst null.
 */
async function verifyLogin(email, verificationCode, tfaKey) {
  console.log(`Verifiziere Login mit Code für E-Mail: ${email}...`)
  try {
    // Prepare the request body
    const requestBody = {
      account: email,
      code: verificationCode
    }
    
    // Only include tfaKey if it's not empty
    if (tfaKey && tfaKey.trim() !== '') {
      requestBody.tfaKey = tfaKey
    }
    
    const response = await fetch(`${BAMBU_API_BASE_URL}/v1/user-service/user/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    })

    if (!response.ok) {
      const errorData = await response.json()
      console.error('Verifikations-Fehler:', errorData.message || response.statusText)
      return null
    }

    const data = await response.json()
    console.log('Verifikations-Antwort (vollständig):', JSON.stringify(data, null, 2))
    
    const accessToken = data.accessToken || data.access_token || data.token || data.authToken
    
    if (accessToken && accessToken.trim() !== '') {
      console.log('Verifikation erfolgreich! Access Token erhalten.')
      if (data.expiresIn) {
        console.log(`Token gültig für: ${data.expiresIn / 3600 / 24} Tage`)
      }
      return accessToken
    } else {
      console.error('Verifikation erfolgreich, aber kein Access Token in der Antwort gefunden.')
      return null
    }
  } catch (error) {
    console.error('Fehler bei der Verifikation:', error)
    return null
  }
}

// HTTP POST Endpunkt für den Login
app.post('/api/login', async (req, res) => {
  const { email, password, verificationCode } = req.body

  if (!email || !password) {
    return res.status(400).json({ message: 'E-Mail und Passwort sind erforderlich.' })
  }

  // If verification code is provided, this is the second step
  if (verificationCode) {
    const tfaKey = req.session.tfaKey || '' // Use empty string if no tfaKey in session
    const accessToken = await verifyLogin(email, verificationCode, tfaKey)
    
    if (accessToken) {
      req.session.accessToken = accessToken
      delete req.session.tfaKey // Clean up TFA key
      res.json({ message: 'Verifikation erfolgreich!', accessTokenAvailable: true })
    } else {
      res.status(401).json({ message: 'Verifikation fehlgeschlagen. Überprüfen Sie den Code.' })
    }
    return
  }

  // First step: initial login
  const loginResult = await loginToBambuLabCloud(email, password)

  if (!loginResult.success) {
    return res.status(401).json({ message: 'Login fehlgeschlagen. Überprüfen Sie Ihre Zugangsdaten.' })
  }

  if (loginResult.needsVerification) {
    // Store TFA key in session for second step
    req.session.tfaKey = loginResult.tfaKey
    res.json({ 
      message: 'Verifikationscode wurde gesendet. Bitte geben Sie den Code ein.',
      needsVerification: true 
    })
  } else if (loginResult.accessToken) {
    req.session.accessToken = loginResult.accessToken
    res.json({ message: 'Login erfolgreich!', accessTokenAvailable: true })
  } else {
    res.status(500).json({ message: 'Unerwarteter Login-Fehler.' })
  }
})

// HTTP GET Endpunkt zum Abrufen des Druckerstatus
app.get('/api/printer-status', async (req, res) => {
  const accessToken = req.session.accessToken // Access Token aus der Session abrufen

  if (!accessToken) {
    return res.status(401).json({ message: 'Kein Access Token in der Session verfügbar. Bitte zuerst anmelden.' })
  }

  try {
    const response = await fetch(`${BAMBU_API_BASE_URL}/v1/iot-service/api/user/print`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`, // Token aus der Session verwenden
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      const errorData = await response.json()
      console.error('Fehler beim Abrufen des Druckerstatus:', errorData.message || response.statusText)
      // Wenn der Token abgelaufen ist oder ungültig ist (z.B. 401 Unauthorized)
      if (response.status === 401) {
        console.log('Access Token ungültig/abgelaufen. Session-Token wird gelöscht.')
        req.session.destroy((err) => { // Session zerstören
          if (err) console.error('Fehler beim Zerstören der Session:', err)
        })
        return res.status(401).json({ message: 'Token abgelaufen oder ungültig. Bitte melden Sie sich erneut an.' })
      }
      return res.status(response.status).json({ message: errorData.message || 'Fehler beim Abrufen des Druckerstatus.' })
    }

    const data = await response.json()
    // console.log('Druckerstatus Rohdaten:', JSON.stringify(data, null, 2)) // Zum Debuggen

    if (data.devices && data.devices.length > 0) {
      const printer = data.devices[0] // Nehmen Sie den ersten Drucker
      let statusMessage = 'Unbekannt'
      let estimatedFinishTime = null

      // Die 'prediction' ist die verbleibende Zeit in Sekunden
      if (printer.print_status === 'PRINTING' && typeof printer.prediction === 'number') {
        const finishTimestampSeconds = Math.floor(Date.now() / 1000) + printer.prediction
        estimatedFinishTime = finishTimestampSeconds
        statusMessage = `Druckt bis ${new Date(finishTimestampSeconds * 1000).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr`
      } else if (printer.print_status === 'SUCCESS') {
        statusMessage = 'Druck abgeschlossen'
      } else if (printer.print_status === 'IDLE') {
        statusMessage = 'Bereit zum Drucken'
      } else if (printer.print_status === 'PAUSED') {
        statusMessage = 'Druck pausiert'
      } else if (printer.print_status === 'FAILED') {
        statusMessage = 'Druck fehlgeschlagen'
      } else {
        statusMessage = `Status: ${printer.print_status || 'Unbekannt'}`
      }

      const responseData = {
        dev_id: printer.dev_id,
        dev_name: printer.dev_name,
        online: printer.dev_online,
        print_status: printer.print_status,
        progress: printer.progress, // Kann null sein, wenn nicht gedruckt wird
        prediction_seconds: printer.prediction, // Verbleibende Zeit in Sekunden
        estimated_finish_time: estimatedFinishTime, // Timestamp in Sekunden
        formatted_status: statusMessage,
        message: printer.message || '' // Allgemeine Nachrichten
      }
      res.json(responseData)
    } else {
      res.status(404).json({ message: 'Keine Drucker gefunden oder Status nicht verfügbar.' })
    }
  } catch (error) {
    console.error('Backend-Fehler beim Abrufen des Druckerstatus:', error)
    res.status(500).json({ message: 'Interner Serverfehler beim Abrufen des Druckerstatus.' })
  }
})

// // Starten des Servers - Wird für Serverless-Betrieb nicht direkt hier aufgerufen
// app.listen(port, () => {
//   console.log(`Bambu Lab Status Backend läuft auf http://localhost:${port}`)
//   console.log(`Login-Endpunkt: POST http://localhost:${port}/api/login`)
//   console.log(`Status-Endpunkt: GET http://localhost:${port}/api/printer-status`)
//   console.log('Der Access Token wird nun in der Session gespeichert. Bei Server-Neustart bleibt die Session bestehen, solange der Browser-Cookie gültig ist.')
// })

// Export the app for serverless environments
module.exports = app;
// Optional: Export für ES Modules (falls zukünftig benötigt)
// export default app;
