const { execSync } = require('child_process');
const path = require('path');

exports.handler = async (event, context) => {
  try {
    // Install dependencies
    console.log('Installing dependencies...');
    execSync('npm install', { stdio: 'inherit' });
    console.log('Dependencies installed.');

    // Start the server
    console.log('Starting server...');
    // We need to run the server.js from the root of the project
    const serverPath = path.resolve(__dirname, '..', '..', 'server.js');
    // Use a Promise to keep the function alive while the server runs,
    // though Netlify functions are typically short-lived.
    // For a continuously running server, a different hosting solution might be better.
    // However, if server.js is designed to handle requests and then exit, this might work.
    await new Promise((resolve, reject) => {
      const child = require('child_process').fork(serverPath);
      child.on('error', reject);
      child.on('exit', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Server exited with code ${code}`));
        }
      });
      // If the server needs to be explicitly stopped after some time or condition
      // setTimeout(() => child.kill(), 30000); // Example: kill after 30 seconds
    });

    return {
      statusCode: 200,
      body: 'Server executed successfully.',
    };
  } catch (error) {
    console.error('Error executing server:', error);
    return {
      statusCode: 500,
      body: `Error: ${error.message}`,
    };
  }
};
