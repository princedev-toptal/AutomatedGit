# Building Desktop Application (.exe)

This guide explains how to build a standalone desktop application (.exe) file that can run on any Windows machine without requiring Node.js to be installed.

## Prerequisites

1. Install Node.js (if not already installed): https://nodejs.org/
2. Install dependencies:
   ```bash
   npm install
   ```

## Running the Application (Development)

To run the Electron app in development mode:

```bash
npm run electron
```

Or with DevTools open:

```bash
npm run electron:dev
```

## Building the Executable

### For Windows (.exe)

```bash
npm run build:win
```

This will create two files in the `dist` folder:
- **Installer**: `Auto Git Setup 1.0.0.exe` - Full installer with NSIS
- **Portable**: `AutoGit-1.0.0-portable.exe` - Standalone executable (no installation needed)

### For macOS (.dmg)

```bash
npm run build:mac
```

### For Linux (.AppImage and .deb)

```bash
npm run build:linux
```

### Build for All Platforms

```bash
npm run build
```

## Running the Built Application

### Windows Installer
1. Run `Auto Git Setup 1.0.0.exe`
2. Follow the installation wizard
3. Launch from Start Menu or Desktop shortcut

### Windows Portable
1. Double-click `AutoGit-1.0.0-portable.exe`
2. The application will open in a window

## Application Features

- **Desktop GUI**: Native desktop application window
- **No Browser Required**: Runs as a standalone application
- **Self-Contained**: Includes Node.js runtime (no Node.js installation needed)
- **Portable Option**: Can run without installation

## Important Notes

1. **✅ No Node.js Required**: The application bundles Node.js runtime inside the executable. Users do NOT need to install Node.js separately - just run the .exe file!

2. **⚠️ Git Required**: The application still requires Git to be installed on the system where it runs. The executable bundles Node.js but not Git itself. Users need to have Git installed and available in their system PATH.

3. **First Build**: The first build may take several minutes as Electron Builder downloads Electron binaries and builds the application.

4. **File Size**: The executable will be approximately 100-150 MB as it includes the Electron runtime and all dependencies.

5. **Port**: The application runs a local server on `http://127.0.0.1:3000` (or the port specified by the PORT environment variable) internally. You don't need to open a browser - the Electron window displays the UI.

## Troubleshooting

### Build Fails / rcedit Errors
- The `rcedit` error ("Unable to commit changes") is usually non-fatal - the build continues
- This error occurs when Windows Defender/antivirus locks the executable during metadata modification
- **Solution**: The configuration now disables executable signing/editing to avoid this issue
- If you still see errors, try:
  - Temporarily disable Windows Defender during build
  - Run as Administrator
  - Close any antivirus software temporarily

### 7-Zip Compression Errors
- If you see `7za` errors, it's usually during the NSIS installer compression step
- The build may still succeed - check the `dist` folder for `.exe` files
- Try building just the portable version: `electron-builder --win portable`

### Build Fails
- Make sure all dependencies are installed: `npm install`
- Check that you have internet connection (electron-builder downloads Electron binaries)
- Try deleting `node_modules` and reinstalling: `rm -rf node_modules && npm install`
- On Windows, you may need to install Visual Studio Build Tools
- Clear electron-builder cache: `rm -rf %LOCALAPPDATA%\electron-builder\Cache`

### Application Doesn't Start
- Ensure Git is installed on the target machine
- Check Windows Defender or antivirus isn't blocking the executable
- Check the console output for error messages

### Static Files Not Loading
- Make sure the `public` folder is included in the build (it's configured in package.json)
- Check that `index.html` exists in the `public` folder

### Port Already in Use
- The application uses port 3000 by default
- If port 3000 is in use, the app will try to find an available port automatically

## Development vs Production

- **Development**: Run `npm run electron:dev` - Opens DevTools and shows debug information
- **Production**: Run `npm run build:win` - Creates optimized production build
