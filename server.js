// server.js - Node.js Backend für Bambu Lab Druckerstatus
// Dieses Backend stellt eine sichere Verbindung zum Bambu Lab MQTT-Broker her
// und bietet einen HTTP-Endpunkt für Ihre Frontend-Anwendung.

const express = require('express')
const mqtt = require('mqtt')
const app = express()
const port = 3000 // Der Port, auf dem Ihr Backend läuft

// Ihre Bambu Lab Druckerdaten (BITTE NICHT IM CLIENT-SEITIGEN CODE SPEICHERN!)
// Diese sollten idealerweise aus Umgebungsvariablen oder einem sicheren Konfigurationssystem geladen werden.
const PRINTER_SERIAL = 'IHR_DRUCKER_SERIENNUMMER' // Ersetzen Sie dies durch die Seriennummer Ihres Druckers
const ACCESS_CODE = 'IHR_ZUGANGSCODE'           // Ersetzen Sie dies durch den Zugangscode Ihres Druckers
const MQTT_BROKER = 'mqtts://us.mqtt.bambulab.com:8883' // Oder Ihr regionaler Broker

let latestPrinterStatus = null // Speichert den zuletzt empfangenen Druckerstatus
let mqttClient = null // MQTT-Client-Instanz

/**
 * Stellt eine Verbindung zum MQTT Broker her und abonniert das Drucker-Topic.
 * Verwendet Promises, um den Verbindungsstatus asynchron zu handhaben.
 * @returns {Promise<void>} Eine Promise, die aufgelöst wird, wenn die Verbindung hergestellt und das Topic abonniert wurde.
 */
async function connectMqttClient () {
  return new Promise((resolve, reject) => {
    mqttClient = mqtt.connect(MQTT_BROKER, {
      clientId: PRINTER_SERIAL, // Client ID sollte die Seriennummer sein
      username: 'bblp',         // Standard-Benutzername für Bambu Lab MQTT
      password: ACCESS_CODE,    // Ihr Zugangscode
      reconnectPeriod: 5000,    // Versucht alle 5 Sekunden die Verbindung wiederherzustellen
      protocol: 'mqtts'         // Wichtig für SSL/TLS
    })

    mqttClient.on('connect', () => {
      console.log('Verbunden mit Bambu Lab MQTT Broker')
      mqttClient.subscribe(`device/${PRINTER_SERIAL}/report`, (err) => {
        if (!err) {
          console.log(`Abonniert Topic: device/${PRINTER_SERIAL}/report`)
          resolve() // Verbindung und Abonnement erfolgreich
        } else {
          console.error('Fehler beim Abonnieren des Topics:', err)
          reject(new Error('Failed to subscribe to MQTT topic.'))
        }
      })
    })

    mqttClient.on('message', (topic, message) => {
      try {
        const payload = JSON.parse(message.toString())
        // console.log('MQTT Nachricht empfangen:', JSON.stringify(payload, null, 2)) // Zum Debuggen
        latestPrinterStatus = payload // Speichert den gesamten Status
      } catch (e) {
        console.error('Fehler beim Parsen der MQTT-Nachricht:', e)
      }
    })

    mqttClient.on('error', (err) => {
      console.error('MQTT Fehler:', err)
      // reject(err) // Könnte hier rejecten, wenn ein kritischer Fehler die Verbindung unbrauchbar macht
    })

    mqttClient.on('close', () => {
      console.log('MQTT Verbindung geschlossen.')
    })

    mqttClient.on('offline', () => {
      console.log('MQTT Client ist offline.')
    })

    mqttClient.on('reconnect', () => {
      console.log('MQTT Client versucht, sich wieder zu verbinden...')
    })
  })
}

// Express.js Middleware für CORS
// Dies ist wichtig, damit Ihre Frontend-Webseite (die auf einem anderen Port/Domain laufen könnte)
// auf dieses Backend zugreifen kann.
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*') // Erlaubt Anfragen von jeder Origin (für Entwicklung)
  // In Produktion: Ersetzen Sie '*' durch die Domain Ihrer Frontend-App
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept')
  next()
})

// HTTP GET Endpunkt zum Abrufen des Druckerstatus
app.get('/api/printer-status', (req, res) => {
  if (latestPrinterStatus) {
    // Filtern oder formatieren Sie die Daten hier, wenn nötig
    // Für Ihre Anforderung "druckt bis X Uhr" benötigen wir 'print_status.estimated_finish_time'
    const responseData = {
      state: latestPrinterStatus.print_status?.state || 'unknown',
      progress: latestPrinterStatus.print_status?.progress || 0,
      // 'mc_print_stage.finish_time' ist oft der genauere Timestamp für die geschätzte Endzeit
      // 'estimated_finish_time' kann auch vorkommen
      estimated_finish_time: latestPrinterStatus.print_status?.mc_print_stage?.finish_time || latestPrinterStatus.print_status?.estimated_finish_time || null,
      current_temp_nozzle: latestPrinterStatus.print_status?.nozzle_temper?.current || 0,
      target_temp_nozzle: latestPrinterStatus.print_status?.nozzle_temper?.target || 0,
      current_temp_bed: latestPrinterStatus.print_status?.bed_temper?.current || 0,
      target_temp_bed: latestPrinterStatus.print_status?.bed_temper?.target || 0,
      filament_type: latestPrinterStatus.print_status?.current_ams?.tray_info?.[0]?.tray_type || 'Unknown', // Beispiel für AMS-Info
      print_name: latestPrinterStatus.print_status?.gcode_file || 'Unbekannt',
      message: latestPrinterStatus.print_status?.msg || '' // Allgemeine Nachrichten
    }
    res.json(responseData)
  } else {
    res.status(503).json({ message: 'Druckerstatus nicht verfügbar oder noch nicht empfangen. Bitte warten Sie auf die MQTT-Verbindung.' })
  }
})

// Starten des Servers und der MQTT-Verbindung
async function startServer () {
  try {
    await connectMqttClient()
    app.listen(port, () => {
      console.log(`Bambu Lab Status Backend läuft auf http://localhost:${port}`)
      console.log(`Rufen Sie http://localhost:${port}/api/printer-status auf, um den Status zu sehen.`)
    })
  } catch (error) {
    console.error('Fehler beim Starten des Servers oder der MQTT-Verbindung:', error)
    process.exit(1) // Beendet den Prozess bei einem kritischen Fehler
  }
}

startServer()
