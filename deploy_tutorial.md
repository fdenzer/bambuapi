# Deploying the Bambu Lab Status Backend

This guide explains how to deploy the Bambu Lab Status Backend, which is a Node.js application. You'll typically deploy this to a platform that supports Node.js hosting, such as Netlify, Heroku, AWS, or a Virtual Private Server (VPS).

GitHub Pages is **not** suitable for hosting this Node.js backend directly, as it only serves static files.

## General Deployment Steps

The general process involves taking the application code, ensuring its dependencies are available, and running the `server.js` file in a Node.js environment on your chosen hosting platform.

### Step 1: Get the Deployment Package

A `deployment-package.zip` is automatically built by GitHub Actions every time changes are pushed to the `main` branch.

1.  **Go to your GitHub repository.**
2.  Click on the **"Actions"** tab.
3.  Find the latest workflow run for the `main` branch (usually at the top).
4.  Click on the workflow run name.
5.  Scroll down to the **"Artifacts"** section.
6.  You should see an artifact named `deployment-package`. Click on it to download the zip file.

### Step 2: Prepare Your Hosting Environment

The specifics will vary greatly depending on your chosen hosting platform (Netlify, Heroku, AWS, VPS, etc.).

*   **For platforms like Netlify or Heroku:**
    *   They often integrate directly with your GitHub repository and can automatically pull the code, install dependencies (`npm install`), and run your application based on the `scripts.start` command in `package.json` (`node server.js`).
    *   You might not need the `deployment-package.zip` directly if the platform builds from your repository. However, understanding the package contents is still useful.
    *   You will need to configure environment variables through the platform's dashboard (see Step 4).

*   **For a VPS or manual deployment:**
    1.  Upload the `deployment-package.zip` to your server.
    2.  Extract the zip file: `unzip deployment-package.zip -d bambulab-backend`
    3.  Navigate into the extracted directory: `cd bambulab-backend`
    4.  Ensure Node.js and npm are installed on your server.
    5.  Install dependencies: `npm install --production` (the `--production` flag skips devDependencies, though this project doesn't have any explicitly defined).
    6.  Configure environment variables (see Step 4).

### Step 3: Configure Environment Variables

This application requires a `SESSION_SECRET` environment variable for securing user sessions.

*   **Generating a `SESSION_SECRET`:**
    As mentioned in the main `readme.md`, you need a strong, random secret. You can generate one using OpenSSL:
    ```bash
    openssl rand -base64 32
    ```
    Copy the output of this command.

*   **Setting the `SESSION_SECRET`:**
    How you set this variable depends on your hosting platform:
    *   **Netlify:** Go to Site settings > Build & deploy > Environment > Environment variables.
    *   **Heroku:** Go to your app's Settings tab > Config Vars.
    *   **VPS:** You can set it in your shell profile (e.g., `.bashrc`, `.zshrc`), use a `.env` file (ensure it's in your `.gitignore` and not committed if you create one directly on the server), or use a process manager like `pm2` which can manage environment variables.
        Example for a `.env` file (create this file in the root of `bambulab-backend` on your server):
        ```
        SESSION_SECRET=your_generated_secret_here
        ```
        If using a `.env` file, ensure `dotenv` is loaded at the very start of `server.js` (which it already is in this project).

    **Important:** Never commit your actual `SESSION_SECRET` or any `.env` file containing sensitive information to your Git repository.

### Step 4: Run the Application

*   **For platforms like Netlify or Heroku:**
    The platform will typically run the `npm start` command from your `package.json`, which executes `node server.js`.

*   **For a VPS or manual deployment:**
    You can run the application directly:
    ```bash
    node server.js
    ```
    For long-running applications in production, it's highly recommended to use a process manager like `pm2`:
    ```bash
    # Install pm2 globally (if not already installed)
    npm install pm2 -g

    # Start the application with pm2
    pm2 start server.js --name bambulab-backend

    # To view logs
    pm2 logs bambulab-backend

    # To ensure pm2 restarts on server reboot
    pm2 startup
    ```
    `pm2` will keep your application running in the background and restart it if it crashes.

### Step 5: Configure Your Frontend

Once your backend is running and accessible via a public URL (e.g., `https://your-backend-url.netlify.app` or `http://your-vps-ip:3000`), you need to update your frontend application (`index.html` or similar) to point its API requests to this backend URL instead of `http://localhost:3000`.

For example, if your frontend has:
```javascript
fetch('http://localhost:3000/api/login', { /* ... */ })
```
You'll need to change it to:
```javascript
fetch('https://your-backend-url.netlify.app/api/login', { /* ... */ })
```

Also, ensure the CORS configuration in `server.js` allows requests from your frontend's domain:
```javascript
// server.js
const allowedOrigin = req.headers.origin;
// Update this if you need to restrict it more or handle multiple specific origins
res.header('Access-Control-Allow-Origin', allowedOrigin || 'https://your-frontend-domain.com');
```
The current dynamic `allowedOrigin` setting in `server.js` is quite permissive. For production, you might want to explicitly list allowed origins.

## Example: Deploying to Netlify (Conceptual)

1.  **Push your code to GitHub.**
2.  **Sign up/Log in to Netlify.**
3.  **Create a new site from Git:**
    *   Connect to your GitHub provider.
    *   Pick your repository.
4.  **Build settings:**
    *   **Branch to deploy:** `main`
    *   **Build command:** `npm install` (or leave blank if Netlify detects it's a Node.js app and does this automatically. Sometimes you might need to specify `npm run build` if you had a build script, but for this project, `npm install` is the main setup).
    *   **Publish directory:** Not directly applicable for a Node.js server in the same way as static sites. Netlify Functions are typically used for backend code. If you're deploying a Node.js server directly (might require specific Netlify configurations or paid features), the setup might differ. *For serverless functions on Netlify, you'd structure your `server.js` code within a `netlify/functions` directory.*
5.  **Environment Variables:**
    *   Go to Site settings > Build & deploy > Environment.
    *   Add `SESSION_SECRET` with the value you generated.
6.  **Deploy.**
7.  Netlify will provide you with a URL (e.g., `your-site-name.netlify.app`). Your API will be available at this URL (e.g., `https://your-site-name.netlify.app/api/login`).

**Note on Netlify Functions:**
If you want to use Netlify's standard serverless functions (which is common for free/starter tiers), you would typically refactor `server.js` to export an Express app or handler that Netlify can use. You'd place this in a `netlify/functions` directory. For example, a file `netlify/functions/api.js` might contain your Express app, and Netlify would make it available at `/.netlify/functions/api/*`. This often requires a `netlify.toml` configuration file.

This project, as it stands (`server.js` starting an Express server with `app.listen`), is more suited for a traditional Node.js hosting environment or a platform that can run a persistent Node.js server process. If you intend to use Netlify Functions, the structure of `server.js` would need to be adapted.

This tutorial provides general guidance. Always refer to the specific documentation of your chosen hosting platform for the most accurate and up-to-date instructions.
