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
exports.handler = serverless(app);
