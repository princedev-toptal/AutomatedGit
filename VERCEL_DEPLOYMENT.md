# Vercel Deployment Guide

## ⚠️ Important Note

**This application requires Git to be installed on the server.** Vercel serverless functions **do not have Git installed**, so Git operations will fail on Vercel.

## Deployment Steps

1. **Push your code to GitHub**
   ```bash
   git add .
   git commit -m "Deploy to Vercel"
   git push
   ```

2. **Connect to Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Import your GitHub repository
   - Vercel will auto-detect the configuration

3. **Deployment Configuration**
   - Framework Preset: **Other**
   - Root Directory: `.` (root)
   - Build Command: Leave empty (or `npm install`)
   - Output Directory: Leave empty
   - Install Command: `npm install`

4. **Environment Variables** (if needed)
   - Add any required environment variables in Vercel dashboard

## Expected Behavior

- ✅ The app will deploy successfully
- ✅ The UI will load and work
- ⚠️ Git operations will fail with error: "Git is not available on Vercel serverless functions"

## Why Git Operations Fail

Vercel serverless functions:
- Don't have Git installed
- Don't have persistent filesystem (only `/tmp` is writable)
- Have execution time limits
- Are stateless

## Alternative Deployment Platforms

For full functionality, deploy to:
- **Railway** (recommended) - Has Git pre-installed
- **Render** - Supports Git operations
- **DigitalOcean App Platform** - Full Git support
- **VPS** (AWS EC2, DigitalOcean Droplet) - Full control

## Troubleshooting

If deployment fails:
1. Check Vercel build logs for specific errors
2. Ensure `package.json` has correct dependencies
3. Verify `vercel.json` configuration
4. Check that `server.js` exports the app correctly

