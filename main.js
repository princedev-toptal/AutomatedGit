/**
 * Electron Main Process
 * This file starts the Electron application and creates the main window
 */

const { app, BrowserWindow } = require('electron');
const path = require('path');

// Set ELECTRON environment variable before requiring server
process.env.ELECTRON = '1';
const expressApp = require('./server');

let mainWindow;
let server;

// Start Express server
function startServer() {
  return new Promise((resolve) => {
    const PORT = process.env.PORT || 3000;
    server = expressApp.listen(PORT, '127.0.0.1', () => {
      console.log(`Server started on http://127.0.0.1:${PORT}`);
      resolve(PORT);
    });
  });
}

// Create the main application window
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false
    },
    // icon: path.join(__dirname, 'assets', 'icon.png'), // Optional: add icon later
    show: false // Don't show until ready
  });

  // Load the local server
  startServer().then((port) => {
    mainWindow.loadURL(`http://127.0.0.1:${port}`);
    
    // Show window when ready
    mainWindow.once('ready-to-show', () => {
      mainWindow.show();
      
      // Open DevTools in development
      if (process.env.NODE_ENV === 'development') {
        mainWindow.webContents.openDevTools();
      }
    });
  });

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// This method will be called when Electron has finished initialization
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    // On macOS, re-create window when dock icon is clicked
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed
app.on('window-all-closed', () => {
  // On macOS, keep app running even when all windows are closed
  if (process.platform !== 'darwin') {
    if (server) {
      server.close();
    }
    app.quit();
  }
});

// Cleanup on app quit
app.on('before-quit', () => {
  if (server) {
    server.close();
  }
});

// Handle certificate errors (for localhost)
app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
  if (url.startsWith('http://127.0.0.1') || url.startsWith('http://localhost')) {
    event.preventDefault();
    callback(true);
  } else {
    callback(false);
  }
});

