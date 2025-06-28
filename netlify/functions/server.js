const path = require('path');
const serverless = require('serverless-http');

// Import the Express app from the main server.js file
// This path assumes server.js is at the root of the project: ../../server.js
// Node.js will look for this in the node_modules provided by Netlify's build process.
const app = require(path.resolve(__dirname, '..', '..', 'server.js'));

// Create the handler for Netlify, wrapping the Express app
// serverless-http handles the event and context, passing requests to the Express app.
// The Express app's routes (e.g., /api/login) will be relative to the function's path.
// If the function is at /.netlify/functions/server, a request to
// /.netlify/functions/server/api/login will be routed to /api/login in Express.

console.log('[Function Start]netlify/functions/server.js: Attempting to load app from ../../server.js');
console.log('[Function Start]Resolved path to server.js:', path.resolve(__dirname, '..', '..', 'server.js'));

if (app) {
  console.log('[Function Log]Imported app type:', typeof app);
  // If 'app' is a function (as Express app is), log some of its characteristic properties if they exist
  if (typeof app === 'function') {
    console.log('[Function Log]App has property "routes":', app.hasOwnProperty('routes'));
    console.log('[Function Log]App has property "listen":', app.hasOwnProperty('listen'));
    console.log('[Function Log]App has property "use":', app.hasOwnProperty('use'));
    // Check for a property that serverless-http might specifically look for, e.g., if it's an Express app.
    // Express apps usually have a `settings` object.
    if (app.settings) {
        console.log('[Function Log]App has settings object. Keys:', Object.keys(app.settings));
    }
  } else if (typeof app === 'object' && app !== null) {
    // If it's an object but not a function, log its keys.
    console.log('[Function Log]Imported app is an object. Keys:', Object.keys(app));
  } else {
    console.log('[Function Log]Imported app is not a function or a typical object. Value:', app);
  }
} else {
  console.error('[Function Error]Failed to import app from ../../server.js. App is undefined or null.');
}

try {
  const handler = serverless(app);
  exports.handler = handler;
  console.log('[Function Log]serverless(app) wrapper created successfully.');
} catch (e) {
  console.error('[Function Critical]Error when calling serverless(app):', e);
  // Fallback handler if serverless(app) fails, to ensure the function doesn't just die silently at module load.
  exports.handler = async (event, context) => {
    console.error('[Function Fallback Handler]Critical error during serverless(app) initialization. See logs above.', e.message);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: "Internal Server Error: Function failed to initialize.",
        error: e.message,
        details: "The serverless handler could not be created, likely due to an issue with the Express app import."
      })
    };
  };
}
