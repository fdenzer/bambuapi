// server.js - Node.js Backend für Bambu Lab Druckerstatus
// Dieses Backend stellt eine sichere Verbindung zur Bambu Lab Cloud API her
// und bietet HTTP-Endpunkte für Login und Druckerstatus für Ihre Frontend-Anwendung.

require('dotenv').config()
const express = require('express')
const fetch = require('node-fetch')
const session = require('express-session')
const fs = require('fs').promises
const path = require('path')
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

// HTTP POST Endpunkt zum Abmelden
app.post('/api/logout', (req, res) => {
  // Session zerstören
  req.session.destroy((err) => {
    if (err) {
      console.error('Fehler beim Zerstören der Session:', err);
      return res.status(500).json({ message: 'Fehler beim Abmelden' });
    }
    res.clearCookie('connect.sid'); // Session-Cookie löschen
    res.json({ message: 'Erfolgreich abgemeldet' });
  });
});

/**
 * Lädt die gespeicherte Druckerliste oder gibt leere Liste zurück
 * @returns {Promise<Array>} Liste der gespeicherten Drucker
 */
async function loadPrinterList() {
  try {
    const data = await fs.readFile(path.join(__dirname, 'printers.json'), 'utf8');
    return JSON.parse(data);
  } catch (error) {
    // Datei existiert nicht oder ist nicht lesbar - leere Liste zurückgeben
    return [];
  }
}

/**
 * Speichert die Druckerliste
 * @param {Array} printers - Liste der Drucker
 */
async function savePrinterList(printers) {
  await fs.writeFile(path.join(__dirname, 'printers.json'), JSON.stringify(printers, null, 2));
}

// HTTP GET Endpunkt zum Abrufen der konfigurierten Drucker
app.get('/api/printers', async (req, res) => {
  try {
    const printers = await loadPrinterList();
    res.json({ printers });
  } catch (error) {
    console.error('Fehler beim Laden der Druckerliste:', error);
    res.status(500).json({ message: 'Fehler beim Laden der Druckerliste.' });
  }
});

// HTTP POST Endpunkt zum Konfigurieren der Drucker
app.post('/api/printers', async (req, res) => {
  const { printers } = req.body;
  if (!Array.isArray(printers)) {
    return res.status(400).json({ message: 'Eine Liste von Druckerseriennummern ist erforderlich.' });
  }
  
  // Validiere Druckerseriennummern
  for (const printer of printers) {
    if (typeof printer !== 'string' || printer.trim().length === 0) {
      return res.status(400).json({ message: 'Alle Druckerseriennummern müssen gültige, nicht-leere Strings sein.' });
    }
  }
  
  try {
    await savePrinterList(printers);
    res.json({ message: 'Druckerliste erfolgreich gespeichert.', count: printers.length });
  } catch (error) {
    console.error('Fehler beim Speichern der Druckerliste:', error);
    res.status(500).json({ message: 'Fehler beim Speichern der Druckerliste.' });
  }
});

// HTTP POST Endpunkt zum Hinzufügen eines Druckers
app.post('/api/printers/add', async (req, res) => {
  const { serial, name } = req.body;
  if (!serial || typeof serial !== 'string' || serial.trim().length === 0) {
    return res.status(400).json({ message: 'Eine gültige Druckerseriennummer ist erforderlich.' });
  }
  
  try {
    const printers = await loadPrinterList();
    
    // Prüfen ob Drucker bereits existiert
    const exists = printers.some(p => 
      (typeof p === 'string' && p === serial) || 
      (typeof p === 'object' && p.serial === serial)
    );
    
    if (exists) {
      return res.status(400).json({ message: 'Drucker mit dieser Seriennummer bereits vorhanden.' });
    }
    
    // Drucker als Objekt mit Serial und optional Name hinzufügen
    const newPrinter = name ? { serial: serial.trim(), name: name.trim() } : serial.trim();
    printers.push(newPrinter);
    
    await savePrinterList(printers);
    res.json({ message: 'Drucker erfolgreich hinzugefügt.', printer: newPrinter });
  } catch (error) {
    console.error('Fehler beim Hinzufügen des Druckers:', error);
    res.status(500).json({ message: 'Fehler beim Hinzufügen des Druckers.' });
  }
});

// HTTP DELETE Endpunkt zum Entfernen eines Druckers
app.delete('/api/printers/:serial', async (req, res) => {
  const { serial } = req.params;
  if (!serial) {
    return res.status(400).json({ message: 'Druckerseriennummer ist erforderlich.' });
  }
  
  try {
    const printers = await loadPrinterList();
    const initialLength = printers.length;
    
    // Entferne Drucker mit der angegebenen Seriennummer
    const filteredPrinters = printers.filter(p => 
      !((typeof p === 'string' && p === serial) || 
        (typeof p === 'object' && p.serial === serial))
    );
    
    if (filteredPrinters.length === initialLength) {
      return res.status(404).json({ message: 'Drucker mit dieser Seriennummer nicht gefunden.' });
    }
    
    await savePrinterList(filteredPrinters);
    res.json({ message: 'Drucker erfolgreich entfernt.' });
  } catch (error) {
    console.error('Fehler beim Entfernen des Druckers:', error);
    res.status(500).json({ message: 'Fehler beim Entfernen des Druckers.' });
  }
});

// HTTP POST Endpunkt zum Validieren von Druckern gegen Bambu Lab API
app.post('/api/printers/validate', async (req, res) => {
  const accessToken = req.session.accessToken;
  if (!accessToken) {
    return res.status(401).json({ message: 'Kein Access Token verfügbar. Bitte zuerst anmelden.' });
  }
  
  try {
    // Hole verfügbare Drucker von der Bambu Lab API
    const response = await fetch(`${BAMBU_API_BASE_URL}/v1/iot-service/api/user/bind`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      return res.status(response.status).json({ message: 'Fehler beim Abrufen der Drucker von Bambu Lab.' });
    }
    
    const data = await response.json();
    const availableDevices = data.devices || [];
    
    // Lade gespeicherte Druckerliste
    const configuredPrinters = await loadPrinterList();
    
    // Validiere jede konfigurierte Seriennummer
    const validationResults = configuredPrinters.map(printer => {
      const serial = typeof printer === 'string' ? printer : printer.serial;
      const name = typeof printer === 'object' ? printer.name : null;
      const device = availableDevices.find(d => d.dev_id === serial);
      
      return {
        serial,
        name,
        valid: !!device,
        deviceInfo: device ? {
          name: device.name,
          model: device.dev_product_name,
          online: device.online,
          status: device.print_status
        } : null
      };
    });
    
    res.json({
      totalConfigured: configuredPrinters.length,
      totalAvailable: availableDevices.length,
      validationResults,
      availableDevices: availableDevices.map(d => ({
        serial: d.dev_id,
        name: d.name,
        model: d.dev_product_name,
        online: d.online,
        status: d.print_status
      }))
    });
  } catch (error) {
    console.error('Fehler bei der Drucker-Validierung:', error);
    res.status(500).json({ message: 'Fehler bei der Drucker-Validierung.' });
  }
});

// HTTP GET Endpunkt zum Abrufen des Druckerstatus
app.get('/api/printer-status', async (req, res) => {
  const accessToken = req.session.accessToken // Access Token aus der Session abrufen
  const printerSerial = req.query.serial // Optionaler Parameter für die Druckerseriennummer

  if (!accessToken) {
    return res.status(401).json({ message: 'Kein Access Token in der Session verfügbar. Bitte zuerst anmelden.' })
  }

  try {
    // Lade konfigurierte Drucker
    const configuredPrinters = await loadPrinterList();
    
    const response = await fetch(`${BAMBU_API_BASE_URL}/v1/iot-service/api/user/print`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      const errorData = await response.json()
      console.error('Fehler beim Abrufen des Druckerstatus:', errorData.message || response.statusText)
      
      if (response.status === 401) {
        console.log('Access Token ungültig/abgelaufen. Session-Token wird gelöscht.')
        req.session.destroy((err) => {
          if (err) console.error('Fehler beim Zerstören der Session:', err)
        })
        return res.status(401).json({ message: 'Token abgelaufen oder ungültig. Bitte melden Sie sich erneut an.' })
      }
      return res.status(response.status).json({ message: errorData.message || 'Fehler beim Abrufen des Druckerstatus.' })
    }

    const data = await response.json()

    if (!data.devices || data.devices.length === 0) {
      return res.status(404).json({ 
        message: 'Keine Drucker gefunden.',
        help: 'Bitte stellen Sie sicher, dass Sie mindestens einen Drucker mit Ihrem Bambu Lab Konto verbunden haben.',
        configuredPrinters: configuredPrinters.length
      })
    }

    let printer;
    let printerConfig = null;
    
    if (printerSerial) {
      // Suche spezifischen Drucker
      printer = data.devices.find(d => d.dev_id === printerSerial)
      if (!printer) {
        return res.status(404).json({ 
          message: 'Drucker nicht gefunden.',
          help: 'Bitte überprüfen Sie die Seriennummer des Druckers.',
          requestedSerial: printerSerial,
          availableDevices: data.devices.map(d => d.dev_id)
        })
      }
      // Finde Konfiguration für diesen Drucker
      printerConfig = configuredPrinters.find(p => 
        (typeof p === 'string' && p === printerSerial) ||
        (typeof p === 'object' && p.serial === printerSerial)
      );
    } else if (configuredPrinters.length > 0) {
      // Bevorzuge konfigurierten Drucker wenn keine spezielle Seriennummer angegeben
      for (const configPrinter of configuredPrinters) {
        const serial = typeof configPrinter === 'string' ? configPrinter : configPrinter.serial;
        printer = data.devices.find(d => d.dev_id === serial);
        if (printer) {
          printerConfig = configPrinter;
          break;
        }
      }
      // Fallback auf ersten verfügbaren Drucker
      if (!printer) {
        printer = data.devices[0];
      }
    } else {
      // Keine konfigurierte Drucker, verwende ersten verfügbaren
      printer = data.devices[0]
    }

    // Verbesserte Statusmeldung
    let statusMessage;
    switch (printer.print_status?.toLowerCase()) {
      case 'idle':
      case 'ready':
        statusMessage = 'Der Drucker ist bereit zum Drucken.';
        break;
      case 'running':
      case 'printing':
        statusMessage = 'Der Drucker druckt gerade.';
        break;
      case 'paused':
        statusMessage = 'Der Druck ist pausiert.';
        break;
      case 'finish':
      case 'success':
        statusMessage = 'Der Druck wurde erfolgreich abgeschlossen.';
        break;
      case 'failed':
      case 'error':
        statusMessage = 'Es ist ein Druckfehler aufgetreten.';
        break;
      case 'offline':
        statusMessage = 'Der Drucker ist offline.';
        break;
      default:
        statusMessage = printer.dev_online ? 'Der Drucker ist online.' : 'Der Drucker ist offline oder nicht verfügbar.';
    }
    
    const responseData = {
      // Grundlegende Drucker-Informationen
      serial: printer.dev_id,
      name: printer.dev_name,
      model: printer.dev_product_name,
      online: printer.dev_online,
      
      // Status-Informationen
      status: printer.print_status,
      formatted_status: statusMessage,
      
      // Druck-Informationen (falls verfügbar)
      task_name: printer.task_name,
      progress: printer.progress,
      prediction: printer.prediction, // Zeit in Sekunden
      start_time: printer.start_time,
      
      // Konfigurationsinformationen
      configured: !!printerConfig,
      config_name: typeof printerConfig === 'object' ? printerConfig.name : null,
      
      // Allgemeine Nachrichten
      message: printer.message || ''
    }
    
    // Formatiere geschätzte Restzeit
    if (printer.prediction && printer.progress) {
      const remainingSeconds = Math.round(printer.prediction * (100 - printer.progress) / 100);
      if (remainingSeconds > 0) {
        const hours = Math.floor(remainingSeconds / 3600);
        const minutes = Math.floor((remainingSeconds % 3600) / 60);
        responseData.estimated_finish_time = `${hours}h ${minutes}m`;
      }
    }
    
    // Füge Informationen über verfügbare Drucker hinzu
    responseData.available_printers = data.devices.map(d => {
      const config = configuredPrinters.find(p => 
        (typeof p === 'string' && p === d.dev_id) ||
        (typeof p === 'object' && p.serial === d.dev_id)
      );
      return {
        serial: d.dev_id,
        name: d.dev_name,
        model: d.dev_product_name,
        status: d.print_status,
        online: d.dev_online,
        configured: !!config,
        config_name: typeof config === 'object' ? config.name : null
      };
    });
    
    // Statistiken
    responseData.statistics = {
      total_devices: data.devices.length,
      configured_devices: configuredPrinters.length,
      online_devices: data.devices.filter(d => d.dev_online).length,
      printing_devices: data.devices.filter(d => 
        d.print_status === 'running' || d.print_status === 'printing'
      ).length
    };
    
    res.json(responseData)
  } catch (error) {
    console.error('Backend-Fehler beim Abrufen des Druckerstatus:', error)
    res.status(500).json({ message: 'Interner Serverfehler beim Abrufen des Druckerstatus.' })
  }
})

// Starten des Servers
app.listen(port, () => {
  console.log(`Bambu Lab Status Backend läuft auf http://localhost:${port}`)
  console.log(`Login-Endpunkt: POST http://localhost:${port}/api/login`)
  console.log(`Status-Endpunkt: GET http://localhost:${port}/api/printer-status`)
  console.log('Der Access Token wird nun in der Session gespeichert. Bei Server-Neustart bleibt die Session bestehen, solange der Browser-Cookie gültig ist.')
})
