# Bambu Lab Druckerstatus Backend

Dieses Node.js-Backend dient als sichere Schnittstelle zur Bambu Lab Cloud API, um den Echtzeitstatus Ihres 3D-Druckers abzurufen und über einfache HTTP-Endpunkte für eine Frontend-Anwendung bereitzustellen. Es löst das Problem des direkten Zugriffs auf die Bambu Lab API vom Browser aus, indem es die Authentifizierung und die API-Kommunikation serverseitig handhabt.

## Funktionen

- **Sichere 2FA-Authentifizierung**
  : Implementiert einen zweistufigen Login-Prozess für die Bambu Lab Cloud API:
  1. **Schritt 1**: E-Mail und Passwort-Eingabe
  2. **Schritt 2**: Verifikationscode aus der E-Mail (falls von Bambu Lab angefordert)
- **Token-Management**
  : Speichert den erhaltenen Access Token in der Server-Session, um wiederholte Logins während einer Browsersitzung zu vermeiden.
- **Druckerstatus-Abruf**
  : Ruft den aktuellen Status Ihres Bambu Lab Druckers ab (Druckstatus, Fortschritt, geschätzte Fertigstellungszeit, Temperaturen etc.).
- **CORS-Konfiguration**
  : Ermöglicht den Zugriff von einer spezifischen Frontend-Domain (z.B. GitHub Pages).
- **Fehlerbehandlung**
  : Behandelt API-Fehler und Token-Ablauf, fordert bei Bedarf einen erneuten Login an.

## Benutzer-Workflow

Die Anwendung führt den Benutzer durch einen intelligenten 2FA-Login-Prozess:

1. **Initiale Anmeldung**: Benutzer gibt E-Mail und Passwort ein
2. **Automatische Erkennung**: Das System erkennt, ob Bambu Lab eine Zwei-Faktor-Authentifizierung erfordert
3. **Direkte Anmeldung**: Falls keine 2FA erforderlich → direkter Zugang zum Druckerstatus
4. **2FA-Verifikation**: Falls 2FA erforderlich → Verifikationsformular wird angezeigt
5. **E-Mail-Verifizierung**: Benutzer erhält Verifikationscode per E-Mail und gibt diesen ein
6. **Abschluss**: Nach erfolgreicher Verifikation → Zugang zum Druckerstatus
7. **Status-Überwachung**: Kontinuierliche Überwachung des 3D-Drucker-Status mit Aktualisierungsmöglichkeit

## Voraussetzungen

- **Node.js**
  : empfohlen: LTS-Version
- **npm**
  : wird mit Node.js installiert

## Installation

- **Repository klonen (oder Dateien herunterladen):**
  :
    ```sh
    git clone https://github.com/fdenzer/your-repo-name.git # Ersetzen Sie dies durch Ihr tatsächliches Repo
    cd your-repo-name
    ```
- **Abhängigkeiten installieren:**
  : Navigieren Sie in das Verzeichnis, in dem sich Ihre package.json und server.js befinden, und führen Sie aus:
    ```sh
    npm install
    ```

## Konfiguration

- **Session Secret:**
  : Ändern Sie den `secret`-Wert in der Session-Konfiguration. Dies sollte ein langes, zufälliges und sicheres Geheimnis sein. Ändern Sie dies unbedingt in einer Produktionsumgebung!
  : Führen Sie den folgenden Einzeiler in Ihrem Terminal aus, um ein sicheres Geheimnis zu generieren und es direkt in Ihre `server.js`-Datei einzufügen. Erstellen Sie vorher eine Sicherungskopie von `server.js`!
    ```sh
    cp server.js server.js.bak && SECRET=$(openssl rand -base64 32) && sed -i.bak "s|secret: 'your_super_secret_key_for_sessions',|secret: '$SECRET',|" server.js
    ```
  : Dieser Befehl erstellt zuerst eine Sicherungskopie (`server.js.bak`), generiert dann ein 32 Byte langes, base64-kodiertes Zufallsgeheimnis und ersetzt den Platzhalter in `server.js` damit.
- **CORS Origin:**
  : Die `Access-Control-Allow-Origin` ist bereits auf `https://fdenzer.github.io` gesetzt. Wenn Ihr Frontend unter einer anderen Domain gehostet wird, passen Sie diese Zeile entsprechend an:
    ```js
    res.header('Access-Control-Allow-Origin', 'https://fdenzer.github.io') // Spezifische Frontend-Domain
    ```

## Ausführung des Backends

- **Starten Sie den Server mit folgendem Befehl im Terminal (im Projektverzeichnis):**
  :
    ```sh
    npm start
    ```
- **Oder direkt:**
  :
    ```sh
    node server.js
    ```
  : Der Server wird auf http://localhost:3000 gestartet. Sie sehen Konsolenmeldungen, die die Verfügbarkeit der Endpunkte bestätigen.

## API-Endpunkte

Das Backend stellt die folgenden HTTP-Endpunkte bereit:

- **POST /api/login**
  : **Beschreibung**
    : Meldet sich bei der Bambu Lab Cloud API an mit zweistufiger Authentifizierung. Dieser Endpunkt verarbeitet sowohl den ersten Schritt (E-Mail/Passwort) als auch den zweiten Schritt (Verifikationscode) je nach übergebenen Parametern.
  
  : **Schritt 1 - Initiale Anmeldung:**
    ```json
    {
        "email": "ihre_email@example.com",
        "password": "ihr_passwort"
    }
    ```
    Antwort bei direktem Login-Erfolg:
    ```json
    { "message": "Login erfolgreich!", "accessTokenAvailable": true }
    ```
    Antwort wenn 2FA erforderlich:
    ```json
    { "message": "Verifikationscode wurde gesendet. Bitte geben Sie den Code ein.", "needsVerification": true }
    ```
  
  : **Schritt 2 - Verifikation (falls erforderlich):**
    ```json
    {
        "email": "ihre_email@example.com",
        "password": "ihr_passwort",
        "verificationCode": "123456"
    }
    ```
    Antwort bei erfolgreicher Verifikation:
    ```json
    { "message": "Verifikation erfolgreich!", "accessTokenAvailable": true }
    ```

- **GET /api/printer-status**
  : **Beschreibung**
    : Ruft den aktuellen Status des Bambu Lab Druckers ab, der mit dem in der Session gespeicherten Access Token verknüpft ist.
  : **Voraussetzung**
    : Ein gültiger Access Token muss in der Session vorhanden sein (d.h., der Login-Endpunkt muss zuvor erfolgreich aufgerufen worden sein).
  : **Antwort**
    : Gibt ein JSON-Objekt mit dem Druckerstatus zurück, das relevante Informationen wie `formatted_status`, `progress`, `estimated_finish_time` etc. enthält. Bei fehlendem oder abgelaufenem Token wird ein 401 Unauthorized zurückgegeben.

## Frontend-Integration

Ihr Frontend (z.B. die `bambulab-printer-status.html`-Datei) sollte HTTP-Anfragen an diese Backend-Endpunkte senden.

- **Für den Login:**
  : Senden Sie eine POST-Anfrage an `http://localhost:3000/api/login` mit den Benutzerdaten.
- **Für den Druckerstatus:**
  : Senden Sie eine GET-Anfrage an `http://localhost:3000/api/printer-status`.

Stellen Sie sicher, dass Ihre Frontend-Anwendung die `credentials: 'include'`-Option in ihren fetch-Anfragen verwendet, damit Session-Cookies korrekt gesendet werden.

```js
// Beispiel für einen Frontend-Fetch-Aufruf
fetch('http://localhost:3000/api/printer-status', {
    method: 'GET',
    credentials: 'include' // Wichtig für Session-Cookies
})
.then(response => response.json())
.then(data => console.log(data))
.catch(error => console.error('Error:', error));
```

## Wichtige Hinweise

- **Produktionseinsatz:**
  : Für den Produktionseinsatz dieses Backends sollten Sie:
    - Ein sicheres, langes Geheimnis für die Session-Konfiguration verwenden, das nicht im Code gespeichert, sondern z.B. über Umgebungsvariablen geladen wird.
    - HTTPS für die Kommunikation zwischen Frontend und Backend implementieren.
    - Einen persistenten Session-Store (z.B. Redis, PostgreSQL) in `express-session` konfigurieren, wenn Sie möchten, dass Sessions Server-Neustarts überleben oder wenn Sie mehrere Server-Instanzen betreiben. Der Standard MemoryStore ist nur für die Entwicklung geeignet.
- **Token-Gültigkeit:**
  : Die Bambu Lab Access Tokens sind laut Dokumentation etwa 3 Monate gültig. Da der Refresh-Token-Endpunkt als "nutzlos" beschrieben wird, muss sich der Benutzer nach Ablauf des Tokens erneut anmelden. Die Session-Dauer (`maxAge` des Cookies) sollte dies widerspiegeln.
- **Drucker-Auswahl:**
  : Das Backend ruft derzeit den Status des ersten in Ihrem Konto gefundenen Druckers ab. Wenn Sie mehrere Drucker haben, müssten Sie die Logik im Backend erweitern, um eine spezifische `dev_id` zu akzeptieren und den Status des entsprechenden Druckers zurückzugeben.