# ❄️ Winter Arc Tracker

A complete habit & routine tracking web app built with pure HTML, CSS, and JavaScript — no frameworks, no backend needed. All data is stored locally in your browser using `localStorage`.

![Winter Arc Tracker](https://img.shields.io/badge/Winter%20Arc-Tracker-blue?style=for-the-badge&logo=snowflake)

## ✨ Features

- 🔐 **Sign Up & Login** — Multi-user auth system with per-user data isolation
- 📋 **Custom Habit Tracker** — Add up to 15 personal habits, track daily across a 31-day grid
- 😴 **Sleep Tracker** — Log sleep hours (4–10 hrs) per night with color-coded rows
- 🎯 **Monthly Goals** — 3-column layout: My Goal / What I Achieved / What to Improve
- 📅 **Multi-month support** — Switch any month & year via dropdowns; all data persists
- 📊 **Habit Summary** — Progress bars showing % completion for each habit
- 💾 **Persistent data** — All user data survives page refresh via localStorage

## 🗂️ File Structure

```
Winter Arc/
├── index.html    # Main HTML (auth pages + tracker layout)
├── style.css     # All styles (light theme, responsive)
├── app.js        # All logic (auth, habit/sleep/goal tracking)
└── README.md
```

## 🚀 How to Use

1. Open `index.html` in any modern browser
2. Click **Get Started** to create an account
3. Log in and start tracking your habits!

> No server or installation needed — just open the file directly.

## 📸 Layout (matches original tracker)

| Section | Description |
|---|---|
| Habit Tracker | Custom habits vs days 1–31 grid |
| Sleep Tracker | Hours (4–10) vs days 1–31 grid |
| Monthly Goals | Goal / Achieved / Improve columns |

## 🛠️ Tech Stack

- **HTML5** — Semantic structure
- **CSS3** — Custom properties, animations, responsive grid
- **Vanilla JavaScript** — No dependencies
- **localStorage** — Client-side data persistence

## 📄 License

MIT — free to use, modify, and share.
