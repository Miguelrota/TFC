const path = require('path');
const fs = require('fs');
const { app } = require('electron');

/**
 * Robust environment variable loader for Electron.
 * Handles both development and packaged environments.
 */
function loadEnv() {
    // Determine the path to the .env file
    let envPath;
    
    // Check if we are in development or production
    if (!app || !app.isPackaged) {
        // Development: .env is in the root directory
        envPath = path.join(process.cwd(), '.env');
        console.log('Loading environment from development path:', envPath);
    } else {
        // Production: .env is in the resources folder
        // For electron-builder extraResources, it's directly in process.resourcesPath
        envPath = path.join(process.resourcesPath, '.env');
        console.log('Loading environment from production path:', envPath);
    }

    if (fs.existsSync(envPath)) {
        require('dotenv').config({ path: envPath });
        console.log('Environment loaded successfully from:', envPath);
    } else {
        console.warn('Warning: .env file not found at:', envPath);
        // Fallback to default dotenv behavior just in case
        require('dotenv').config();
    }
}

module.exports = { loadEnv };
