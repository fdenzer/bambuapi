# Netlify Deployment Tutorial

This document guides you through deploying the bambuapi project to Netlify.

## Prerequisites

- A Netlify account.
- The project repository cloned to your local machine or accessible on a Git provider (GitHub, GitLab, Bitbucket).

## Deployment Steps

1.  **Log in to Netlify**: Go to [app.netlify.com](https://app.netlify.com/) and log in.
2.  **Connect to Git Provider**:
    *   Click on "Add new site" -> "Import an existing project".
    *   Choose your Git provider (e.g., GitHub).
3.  **Select Repository**:
    *   Authorize Netlify to access your repositories if you haven't already.
    *   Search for and select your `bambuapi` repository.
4.  **Configure Project and Deploy**:
    *   **Team**: Select your team.
    *   **Branch to deploy**: Choose the branch you want to deploy (e.g., `main`).
    *   **Base directory**: Leave this blank or set to the root of your project if your `package.json` is there. For this project, it's likely the root.
    *   **Build command**: Since our Netlify function handles dependency installation and server execution, you might not need a specific build command here for the main site build, or you could use `npm install` if you have other build steps. However, the function itself will run `npm install`. For a simple Node.js app where the function is the primary artifact, this might be sufficient.
    *   **Publish directory**: If you have static assets to publish (e.g., an `index.html` at the root for a landing page), set this to the directory containing those assets. If your `index.html` is at the root, you might need to specify a directory or ensure Netlify serves `index.html` from the root. Often, for API-only backends, this might be less critical or could point to a directory with a simple status page.
    *   **Functions directory**: Set this to `netlify/functions`. This is crucial for Netlify to find and deploy your serverless function.
    *   **Environment Variables**: This is where you'll configure the necessary variables for your `server.js` to run. Click "Show advanced" then "New variable".

        ### Required Environment Variables

        Based on a typical Node.js server that might interact with a Bambulab printer or other services, you will likely need the following environment variables. **Please update these with the actual variables your `server.js` requires.**

        *   `BAMBU_IP`: The IP address of your Bambulab printer.
            *   *Example Value*: `192.168.1.100`
        *   `BAMBU_ACCESS_CODE`: The access code for your Bambulab printer.
            *   *Example Value*: `your_printer_access_code`
        *   `BAMBU_SERIAL`: The serial number of your Bambulab printer.
            *   *Example Value*: `your_printer_serial_number`
        *   `MQTT_USERNAME`: The username for connecting to the MQTT broker on your printer (often the serial number).
            *   *Example Value*: `your_printer_serial_number`
        *   `MQTT_PASSWORD`: The password for connecting to the MQTT broker (often the access code).
            *   *Example Value*: `your_printer_access_code`
        *   `PORT`: The port your server will listen on. Netlify typically manages this for functions, but your `server.js` might still expect it. For Netlify Functions, the function itself doesn't listen on a port in the traditional sense; it's invoked via HTTP requests. However, if `server.js` is a standard Node HTTP server, this setup might need adjustment as Netlify Functions are not designed to run persistent servers. **If `server.js` starts an HTTP server, this approach of running it directly in a short-lived Netlify Function might not be suitable. Netlify Functions are meant to execute and then terminate.** You might need to refactor `server.js` to export a handler that can be called by the Netlify function, or use a different hosting service for persistent Node.js servers (like Netlify Background Functions if applicable, or services like Heroku, Render, etc.).

        **Important Considerations for `server.js` in a Netlify Function:**
        *   Netlify Functions are stateless and have execution time limits (typically 10-15 seconds on the free tier, extendable on paid plans).
        *   If `server.js` starts a long-running process (e.g., `app.listen()`), it will likely time out or not behave as expected in a standard Netlify Function.
        *   The `netlify/functions/server.js` wrapper attempts to run `server.js`. If `server.js` is an Express app or similar, it should ideally be modified to export the app or a handler, rather than starting the server itself with `listen()`. The Netlify Function would then pass event data to this handler.

5.  **Deploy Site**: Click the "Deploy site" button. Netlify will start the build and deployment process.

## Verifying the Deployment

*   Once deployed, Netlify will provide you with a URL (e.g., `https://your-project-name.netlify.app`).
*   You can access your function at `https://your-project-name.netlify.app/.netlify/functions/server`.

## Troubleshooting

*   Check the deploy logs in the Netlify dashboard for any errors during the build or function execution.
*   Ensure all required environment variables are correctly set in the Netlify UI.
*   Verify that `server.js` is compatible with a serverless function environment (i.e., it can handle an event and produce a response, rather than running a persistent server).

This tutorial provides a basic outline. You may need to adjust settings based on the specific requirements of your `server.js` application.
