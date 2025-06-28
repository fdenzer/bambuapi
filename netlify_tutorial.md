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

        After reviewing `server.js`, the primary environment variable required for your Netlify deployment is:

        *   `SESSION_SECRET`: This is used to sign the session ID cookie for `express-session`. It's crucial for security that you set this to a long, random, and unique string in your Netlify environment variables.
            *   *Example Value*: `a_very_long_random_and_secure_string_generated_by_you`
            *   *Note*: The `server.js` has a fallback for development, but you **must** set this in Netlify for production.

        **Regarding other variables and `server.js` behavior:**
        *   The `server.js` script is designed to interact with the **Bambu Lab Cloud API**. It does *not* directly connect to your printer using IP address, access code, or MQTT credentials. Instead, it expects the end-user to provide their Bambu Lab account email and password through the `/api/login` endpoint. These credentials are then used to obtain an access token from the cloud service.
        *   `PORT`: The `server.js` file attempts to listen on port 3000. When running `server.js` inside the Netlify Function `netlify/functions/server.js`, this specific port number isn't directly exposed to the internet. Netlify manages how functions are invoked via HTTP requests. The function wrapper attempts to run the `server.js` as is.

        **Important Considerations for `server.js` in a Netlify Function:**

        The `server.js` (your main Express application) has been refactored to be compatible with a serverless environment, and the Netlify function (`netlify/functions/server.js`) has been updated to use this refactored app. Here's how it works:

        *   **`server.js` Refactor**:
            *   The `app.listen()` call in your main `server.js` has been commented out.
            *   Instead, `server.js` now exports the Express `app` instance using `module.exports = app;`.

        *   **Netlify Function (`netlify/functions/server.js`) Update**:
            *   This function now imports the Express `app` from your main `server.js`.
            *   It uses the `serverless-http` library to wrap your Express `app`. This library acts as an adapter, allowing your Express application (which is designed for long-running server environments) to correctly process requests in a serverless function's event-driven model.
            *   The dependency `serverless-http` has been added to your `package.json` (implicitly, by running `npm install serverless-http`).
            *   The function still includes a step to run `npm install` within its own execution, primarily as a safeguard or for local development consistency. In a typical Netlify build, dependencies from the root `package.json` are installed globally for the build and functions.

        *   **Frontend URL Update (`index.html`)**:
            *   The `BACKEND_URL` constant in `index.html` has been changed from `http://localhost:3000` to `/.netlify/functions/server`. This ensures that API requests from your frontend correctly target the deployed Netlify function.

        *   **Execution Model**:
            *   When a request hits `https://your-project-name.netlify.app/.netlify/functions/server/api/login` (for example), Netlify invokes the `handler` in `netlify/functions/server.js`.
            *   `serverless-http` takes the Netlify event and context and translates it into a request that your Express `app` can understand. Your Express routing (e.g., `app.post('/api/login', ...)`) will then handle the request as if it were running on a traditional server.
            *   The response from your Express app is then translated back by `serverless-http` into the format Netlify expects.

        *   **Statelessness and Sessions**:
            *   Netlify Functions are generally stateless. Your `express-session` is configured to use a memory store by default. This means session data will **not persist** across different invocations of the function if they are handled by different instances, or if a function instance is recycled (which happens frequently).
            *   For persistent sessions in a serverless environment, you would need to configure `express-session` with an external session store (e.g., a database service like FaunaDB, or a Redis instance). This is a more advanced setup. For now, sessions will work for a user as long as their requests are routed to the same warm function instance, but this is not guaranteed.

        This refactored approach is the standard way to run Express.js applications on Netlify Functions and should resolve the connectivity issues.

5.  **Deploy Site**: Click the "Deploy site" button. Netlify will start the build and deployment process.

## Verifying the Deployment

*   Once deployed, Netlify will provide you with a URL (e.g., `https://your-project-name.netlify.app`).
*   You can access your function at `https://your-project-name.netlify.app/.netlify/functions/server`.

## Troubleshooting

*   Check the deploy logs in the Netlify dashboard for any errors during the build or function execution.
*   Ensure all required environment variables are correctly set in the Netlify UI.
*   Verify that `server.js` is compatible with a serverless function environment (i.e., it can handle an event and produce a response, rather than running a persistent server).

This tutorial provides a basic outline. You may need to adjust settings based on the specific requirements of your `server.js` application.
