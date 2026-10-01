# ❄️ Winter Arc Tracker

A complete habit & routine tracking web app with **Firebase cloud sync** — your data works across all devices. Built with HTML, CSS, and JavaScript.

![Winter Arc Tracker](https://img.shields.io/badge/Winter%20Arc-Tracker-blue?style=for-the-badge&logo=snowflake)

## ✨ Features

- 🔐 **Sign Up & Login** — Firebase Authentication (email + password)
- 📋 **Custom Habit Tracker** — Up to 15 habits, 31-day grid, click to toggle ✓/✕
- 😴 **Sleep Tracker** — Log 4–10 hrs per night, color-coded grid + stats
- 🎯 **Monthly Goals** — 3-column layout: Goal / Achieved / Improve
- 📅 **Multi-month tracking** — Switch months & years via dropdowns
- 📊 **Habit Summary** — % completion bars for each habit
- ☁️ **Cloud Sync** — Data saved to Firestore, accessible from any device
- 📱 **Offline Support** — Works without internet, syncs when back online
- 🎨 **Light Theme** — Clean, responsive design

## 🗂️ File Structure

```
Winter Arc/
├── index.html     # Main HTML + Firebase SDKs
├── style.css      # Styles (light theme, responsive)
├── app.js         # Firebase Auth + Firestore logic
└── README.md
```

## 🔧 Firebase Setup (Required)

Before deploying, you need to create a **free Firebase project**:

### Step 1: Create Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click **"Add Project"** → name it → disable Analytics (optional) → **Create Project**

### Step 2: Enable Authentication
1. In your project → **Build** → **Authentication** → **Get Started**
2. Click **Email/Password** → **Enable** → **Save**

### Step 3: Create Firestore Database
1. **Build** → **Firestore Database** → **Create Database**
2. Select **"Start in test mode"** → Choose a region → **Enable**

### Step 4: Register a Web App
1. Project Settings (⚙️ gear icon) → **General** → scroll to **"Your apps"**
2. Click the **Web icon** `</>` → name it (e.g. "Winter Arc") → **Register App**
3. Copy the `firebaseConfig` object

### Step 5: Paste Config in `app.js`
Open `app.js` and replace the placeholder config at the top:

```javascript
const firebaseConfig = {
  apiKey:            "YOUR_API_KEY",
  authDomain:        "YOUR_PROJECT_ID.firebaseapp.com",
  projectId:         "YOUR_PROJECT_ID",
  storageBucket:     "YOUR_PROJECT_ID.firebasestorage.app",
  messagingSenderId: "YOUR_SENDER_ID",
  appId:             "YOUR_APP_ID"
};
```

### Step 6: Set Firestore Rules (for production)
In Firestore → **Rules** tab, replace with:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can only read/write their own data
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    // Usernames collection — anyone authenticated can read, only create if not exists
    match /usernames/{username} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
    }
  }
}
```

## 🚀 Deployment Options

| Platform | Free? | How |
|---|---|---|
| **Firebase Hosting** | ✅ Free | `firebase deploy` (recommended) |
| **GitHub Pages** | ✅ Free | Settings → Pages → Deploy from branch |
| **Vercel** | ✅ Free | Import repo → auto-deploy |
| **Netlify** | ✅ Free | Drag & drop folder |

### Deploy with Firebase Hosting (Recommended)
```bash
npm install -g firebase-tools
firebase login
firebase init hosting   # select your project, set public dir to "."
firebase deploy
```

## 📄 License

MIT — free to use, modify, and share.
