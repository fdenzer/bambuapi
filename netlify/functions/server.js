const { execSync } = require('child_process');
const path =require('path');
const serverless = require('serverless-http');

// Import the Express app from the main server.js file
// The path needs to be relative to this function file when deployed,
// or correctly resolved if an alternative build setup is used.
// Assuming server.js is at the root of the project: ../../server.js
const app = require(path.resolve(__dirname, '..', '..', 'server.js'));

// Flag to ensure dependencies are installed only once per cold start
let dependenciesInstalled = false;

const installDependencies = () => {
  if (!dependenciesInstalled) {
    try {
      console.log('Installing dependencies...');
      // In a Netlify environment, dependencies from package.json should ideally be pre-installed.
      // However, if there's a need to run npm install (e.g., for specific function dependencies
      // not in the root package.json, or if the build process doesn't cover it), it can be done here.
      // For this project, package.json is at the root, so Netlify's build should handle `npm install`.
      // This explicit `npm install` here might be redundant or even problematic if not scoped correctly.
      // For now, we'll keep it but with a note that it might be better handled by Netlify's build process.

      // Change current working directory to the project root for npm install
      const projectRoot = path.resolve(__dirname, '..', '..');
      execSync('npm install', { cwd: projectRoot, stdio: 'inherit' });

      console.log('Dependencies installed.');
      dependenciesInstalled = true;
    } catch (error) {
      console.error('Error installing dependencies:', error);
      // If dependencies fail to install, subsequent calls might fail.
      // Depending on the error, you might want to throw it to fail the function execution.
      throw error;
    }
  }
};

// Create the handler for Netlify, wrapping the Express app
const handler = async (event, context) => {
  try {
    // Ensure dependencies are installed (primarily for local dev or specific scenarios)
    // In a typical Netlify deployment, dependencies from the root package.json
    // are installed during the build step. This call might be redundant.
    // However, if server.js or its dependencies are not correctly found without it,
    // this ensures they are present in the function's execution environment.
    installDependencies();
  } catch (error) {
    // If dependency installation fails, return an error response
    console.error('Failed to initialize function due to dependency installation error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Function initialization error: Could not install dependencies.' }),
    };
  }

  // Use serverless-http to handle the request with the Express app
  // The event path needs to be correctly mapped.
  // Netlify function URLs are like `/.netlify/functions/server/api/login`
  // serverless-http needs to be configured or the Express app needs to be aware of the base path.
  // By default, serverless-http will pass the path part after `/server` to the Express app.
  // So, if the request is `/.netlify/functions/server/api/login`, Express will see `/api/login`.
  return serverless(app)(event, context);
};

exports.handler = handler;
