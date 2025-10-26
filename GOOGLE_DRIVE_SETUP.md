# Google Drive Integration Setup Guide

## Step 1: Create a Google Cloud Project

1. Go to: https://console.cloud.google.com/
2. Click **"Select a Project"** → **"NEW PROJECT"**
3. Name it: `Becca Music Player`
4. Click **"CREATE"**

## Step 2: Enable Google Drive API

1. Go to: https://console.cloud.google.com/apis/library
2. Search for: **"Google Drive API"**
3. Click on it
4. Click **"ENABLE"**

## Step 3: Create OAuth 2.0 Credentials

1. Go to: https://console.cloud.google.com/apis/credentials
2. Click **"+ CREATE CREDENTIALS"**
3. Select **"OAuth 2.0 Client ID"**
4. Choose **"Web application"**
5. Name it: `Becca Music Player`
6. Add these **Authorized JavaScript origins:**
   - `http://localhost:8000`
   - `https://sepgit1.github.io`
   - `https://yourdomain.com` (if you have your own domain)
7. Add these **Authorized redirect URIs:**
   - `http://localhost:8000/index.html`
   - `https://sepgit1.github.io/RebeccaMediaPlayer/index.html`
8. Click **"CREATE"**

## Step 4: Copy Your Credentials

1. You'll see a popup with:
   - **Client ID**
   - **Client Secret**
2. Copy the **Client ID**

## Step 5: Get API Key

1. Go back to: https://console.cloud.google.com/apis/credentials
2. Click **"+ CREATE CREDENTIALS"**
3. Select **"API Key"**
4. Copy the API Key

## Step 6: Update the App Configuration

1. Open `google-drive-sync.html` in the media player folder
2. Find this section:
   ```javascript
   const GOOGLE_DRIVE_CONFIG = {
       CLIENT_ID: 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com',
       API_KEY: 'YOUR_GOOGLE_API_KEY',
   ```
3. Replace:
   - `YOUR_GOOGLE_CLIENT_ID` with your Client ID
   - `YOUR_GOOGLE_API_KEY` with your API Key

## Step 7: Integrate Into App

1. The sync script is ready to integrate into `index.html`
2. It will automatically:
   - Sync playlists to Google Drive
   - Sync comments to Google Drive
   - Load data from any device
   - Keep everything in a folder called "Becca Music Player"

## How It Works

- **Automatic Cloud Backup**: Every time you add/remove songs or post comments
- **Multi-Device Sync**: Access your playlists on phone, tablet, or computer
- **Offline Mode**: App works offline, syncs when connected
- **Secure**: Uses Google's OAuth 2.0 authentication

## What Gets Synced

✅ **Playlists** - All songs and videos
✅ **Comments** - All comments on songs
✅ **Settings** - Theme, colors, preferences
✅ **Media History** - Songs you've played

## First Time Setup

1. When you first use the app, you'll be asked to:
   - Sign in with your Gmail account
   - Grant permission to access Google Drive
2. Click **"Allow"**
3. Your data will sync automatically!

## Questions?

If you need help:
1. Make sure your Client ID and API Key are correct
2. Check that Google Drive API is enabled
3. Verify the authorized URLs match your deployment

---

**Ready to sync? Let me know and I'll integrate this into your app!** 🚀
