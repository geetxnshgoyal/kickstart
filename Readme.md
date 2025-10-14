# Kickstart Organizer Console

This project provides an **admin dashboard** for hackathon organizers to manage registrations, form teams, and handle event logistics.

## 🧩 Features
- Secure admin access key login
- Persistent key storage with localStorage
- Switchable dashboard views: **Individuals** and **Teams**
- Refresh and export (CSV/XLSX) options
- Placeholder setup for future data integration

## 🚀 How to Use
1. Open `admin.html` in your browser.
2. Enter the admin key (`test123` by default).
3. (Optional) Check “Remember key” to store it locally.
4. Click **Unlock Dashboard** to access the console.

## 🧠 Developer Notes
- Update the real admin key inside `admin.js`:
  ```js
  const correctKey = "test123";
  ```
- Extend the dashboard logic to connect with your real backend or APIs.
- Add team/individual management functionality as needed.

## 📂 File Structure
```
project-folder/
│
├── admin.html     # Dashboard interface and layout
├── admin.js       # Dashboard logic and interactions
├── style.css      # (Optional) Stylesheet for UI
└── README.md      # Project overview and setup guide
```

## 🛠️ Built With
- HTML5
- Vanilla JavaScript (no frameworks)
- Local Storage API

## 📄 License
This project is for internal hackathon use. Modify and reuse freely.
