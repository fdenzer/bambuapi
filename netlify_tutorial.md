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
        *   **Execution Model**: Netlify Functions are designed for short-lived, request-response cycles. The current `netlify/functions/server.js` attempts to run your entire `server.js` (which includes `app.listen()`) as a child process. This approach has limitations:
            *   **Timeout**: The function might time out if `server.js` tries to run indefinitely. Standard Netlify functions have execution limits (e.g., 10-15 seconds on the free tier).
            *   **Statelessness**: Each invocation of the Netlify function is stateless. While `express-session` (using server-side memory store by default) is used, this session state will not persist across different invocations of the Netlify function if you have multiple or if the function instance recycles. For persistent sessions in a serverless environment, you'd typically use an external session store (like Redis or a database).
        *   **Suitability**: If `server.js` is intended to be a long-running, persistent server, a standard Netlify Function is not the ideal environment. You might need to:
            1.  **Refactor `server.js`**: Modify it to export the Express `app` instance or a specific handler function, which the Netlify function can then use to process incoming requests directly without `app.listen()`. This is the more common pattern for Express apps in serverless functions.
            2.  **Consider Alternatives**: For persistent Node.js servers, explore options like Netlify Background Functions (if applicable for your use case, though they also have constraints), or dedicated Node.js hosting platforms (e.g., Heroku, Render, AWS Elastic Beanstalk, Google Cloud Run).

        The current setup *might* work for simple, infrequent requests if the `server.js` process can initialize, handle a request passed to it (though the current wrapper doesn't explicitly pass the event to the Express router within the forked process), and then exit gracefully within the time limit. However, this is not a typical or robust way to host an Express application on Netlify Functions.

5.  **Deploy Site**: Click the "Deploy site" button. Netlify will start the build and deployment process.

## Verifying the Deployment

*   Once deployed, Netlify will provide you with a URL (e.g., `https://your-project-name.netlify.app`).
*   You can access your function at `https://your-project-name.netlify.app/.netlify/functions/server`.

## Troubleshooting

*   Check the deploy logs in the Netlify dashboard for any errors during the build or function execution.
*   Ensure all required environment variables are correctly set in the Netlify UI.
*   Verify that `server.js` is compatible with a serverless function environment (i.e., it can handle an event and produce a response, rather than running a persistent server).

This tutorial provides a basic outline. You may need to adjust settings based on the specific requirements of your `server.js` application.
