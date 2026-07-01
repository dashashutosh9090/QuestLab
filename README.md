<!-- ══════════════════════════════════════════════════════════════════════ -->
<!--                        QUESTLAB · README                                -->
<!-- ══════════════════════════════════════════════════════════════════════ -->

<div align="center">

<!-- ░░ ANIMATED SCI-FI HEADER ░░ -->
<img src="https://capsule-render.vercel.app/api?type=waving&color=0:0f172a,30:4f46e5,60:8b5cf6,100:06b6d4&height=230&section=header&text=QuestLab&fontSize=88&fontColor=ffffff&animation=fadeIn&fontAlignY=38&desc=Turn%20learning%20into%20an%20adventure&descAlignY=60&descSize=20&descColor=e0e7ff" width="100%" alt="QuestLab banner" />

<!-- ░░ TYPING ANIMATION ░░ -->
<a href="#-questlab">
  <img src="https://readme-typing-svg.demolab.com?font=Fira+Code&weight=600&size=24&duration=2800&pause=900&color=8B5CF6&center=true&vCenter=true&width=720&height=60&lines=%E2%9A%A1+Gamified+learning+for+future+engineers;%F0%9F%A4%96+AI-generated+quests+powered+by+Gemini;%F0%9F%9A%80+Earn+XP+%C2%B7+Level+up+%C2%B7+Unlock+badges;%F0%9F%9B%B8+Code+%C2%B7+Compete+%C2%B7+Collaborate+in+real+time" alt="Typing SVG" />
</a>

<br/>

<!-- ░░ STATUS BADGES ░░ -->
<p>
  <img src="https://img.shields.io/badge/status-active-06b6d4?style=for-the-badge&labelColor=0f172a" alt="status" />
  <img src="https://img.shields.io/badge/stack-MERN-4f46e5?style=for-the-badge&labelColor=0f172a" alt="stack" />
  <img src="https://img.shields.io/badge/AI-Gemini-8b5cf6?style=for-the-badge&labelColor=0f172a&logo=googlegemini&logoColor=white" alt="ai" />
  <img src="https://img.shields.io/badge/license-ISC-10b981?style=for-the-badge&labelColor=0f172a" alt="license" />
</p>

<!-- ░░ QUICK NAV ░░ -->
<p>
  <a href="#-features">✨ Features</a> &nbsp;•&nbsp;
  <a href="#-tech-stack">🧬 Tech Stack</a> &nbsp;•&nbsp;
  <a href="#-architecture">🛰️ Architecture</a> &nbsp;•&nbsp;
  <a href="#-getting-started">🚀 Getting Started</a> &nbsp;•&nbsp;
  <a href="#-gamification-engine">🎮 Gamification</a>
</p>

<img src="https://user-images.githubusercontent.com/74038190/212284100-561aa473-3905-4a80-b561-0d28506553ee.gif" width="100%" alt="divider" />

</div>

<!-- ══════════════════════════════════════════════════════════════════════ -->

## 🌌 QuestLab

**QuestLab** is a full-stack, gamified learning platform that transforms skill-building into an interactive quest. Learners tackle **AI-generated coding challenges**, write and run real code in an in-browser editor, earn **XP**, climb **tiers**, unlock **badges**, and level up across five curated tracks — while mentors, study rooms, and live chat keep the whole journey social.

> 🧠 Built as an MCA capstone project — a production-grade MERN application with real-time features, AI integration, and role-based dashboards for both **learners** and **admins**.

<div align="center">
<table>
<tr>
<td align="center">🎯<br/><b>5 Learning Tracks</b><br/><sub>Basics · DSA · Project · Resume · Interview</sub></td>
<td align="center">🤖<br/><b>AI Quests</b><br/><sub>Google Gemini generation</sub></td>
<td align="center">⚡<br/><b>Live Everything</b><br/><sub>Socket.IO rooms, DMs & alerts</sub></td>
<td align="center">🏆<br/><b>Full Gamification</b><br/><sub>XP · Levels · Tiers · Badges</sub></td>
</tr>
</table>
</div>

<br/>

## ✨ Features

<table>
<tr>
<td width="50%" valign="top">

### 🎮 For Learners
- ⚡ **AI Quest Generation** — Gemini crafts fresh challenges per topic & difficulty
- 💻 **In-Browser Code Editor** — Monaco editor + live execution via JDoodle
- 🧗 **XP, Levels & Streaks** — grow your profile with every solved quest
- 🏅 **Tiers & Badges** — Beginner → Expert, plus 5 unlockable achievements
- 🗺️ **Learning Roadmap** — a guided path across all five tracks
- 🏆 **Global Leaderboard** — compete with the whole community
- 🧑‍🏫 **Mentorship** — search mentors, send requests, connect & DM
- 💬 **Live Study Rooms** — real-time topic chat rooms
- 📄 **Resume Builder** + **Interview Prep** resource hub
- 📦 **Project Submissions** — upload ZIPs, get reviewed & commented

</td>
<td width="50%" valign="top">

### 🛡️ For Admins
- ✍️ **Quest Authoring** — create tasks per track, topic & difficulty
- 🔍 **Submission Review** — approve/reject projects with threaded comments
- 🔔 **Live Admin Feed** — real-time notifications on activity & badge unlocks
- 📚 **Interview Resource Manager** — upload & manage PDF prep material
- 👥 **User & Progress Oversight** — monitor the learning ecosystem

### 🔐 Platform & Security
- 🪪 **JWT Auth** + **Google OAuth** sign-in
- 📧 **Password Reset** via email (Nodemailer)
- 🛡️ **Helmet**, **CORS allow-list** & **rate limiting**
- ☁️ **Cloudinary** media storage for uploads
- 🔒 Role derived server-side (never trusted from token)

</td>
</tr>
</table>

<div align="center">
<img src="https://user-images.githubusercontent.com/74038190/212284100-561aa473-3905-4a80-b561-0d28506553ee.gif" width="100%" alt="divider" />
</div>

## 🧬 Tech Stack

<div align="center">

### Frontend
![React](https://img.shields.io/badge/React_19-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Vite](https://img.shields.io/badge/Vite_8-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind_4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)
![Framer Motion](https://img.shields.io/badge/Framer_Motion-0055FF?style=for-the-badge&logo=framer&logoColor=white)
![Monaco](https://img.shields.io/badge/Monaco_Editor-007ACC?style=for-the-badge&logo=visualstudiocode&logoColor=white)
![React Router](https://img.shields.io/badge/React_Router_7-CA4245?style=for-the-badge&logo=reactrouter&logoColor=white)

### Backend
![Node](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express_5-000000?style=for-the-badge&logo=express&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=for-the-badge&logo=mongodb&logoColor=white)
![Socket.IO](https://img.shields.io/badge/Socket.IO-010101?style=for-the-badge&logo=socket.io&logoColor=white)
![JWT](https://img.shields.io/badge/JWT-000000?style=for-the-badge&logo=jsonwebtokens&logoColor=white)

### AI · Services · Tooling
![Gemini](https://img.shields.io/badge/Google_Gemini-8E75B2?style=for-the-badge&logo=googlegemini&logoColor=white)
![Cloudinary](https://img.shields.io/badge/Cloudinary-3448C5?style=for-the-badge&logo=cloudinary&logoColor=white)
![Google OAuth](https://img.shields.io/badge/Google_OAuth-4285F4?style=for-the-badge&logo=google&logoColor=white)
![JDoodle](https://img.shields.io/badge/JDoodle_Exec-FF6C37?style=for-the-badge&logo=hackthebox&logoColor=white)
![Nodemailer](https://img.shields.io/badge/Nodemailer-30B980?style=for-the-badge&logo=maildotru&logoColor=white)

</div>

## 🛰️ Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          QUESTLAB  ·  SYSTEM MAP                           │
└──────────────────────────────────────────────────────────────────────────┘

        ┌────────────────────────┐            ┌───────────────────────────┐
        │      CLIENT (Vite)     │   REST +   │      SERVER (Express 5)    │
        │  React 19 · Tailwind 4 │  Socket.IO │  Node · Mongoose · JWT     │
        │  Framer · Monaco Editor│◀──────────▶│  Helmet · Rate-limit · CORS│
        └───────────┬────────────┘            └───────────┬───────────────┘
                    │                                      │
      ┌─────────────┼──────────────┐        ┌──────────────┼──────────────┐
      ▼             ▼              ▼         ▼              ▼              ▼
 ┌─────────┐  ┌──────────┐  ┌──────────┐ ┌────────┐  ┌──────────┐  ┌──────────┐
 │Dashboard│  │Study Rooms│ │Leaderboard│ │MongoDB │  │  Gemini  │  │Cloudinary│
 │ /Roadmap│  │  + DMs    │ │/Mentorship│ │ Atlas  │  │  AI Gen  │  │  Uploads │
 └─────────┘  └──────────┘  └──────────┘ └────────┘  └──────────┘  └──────────┘
                                              │              │
                                         ┌────┴────┐    ┌────┴─────┐
                                         │ JDoodle │    │Nodemailer│
                                         │  Exec   │    │  Emails  │
                                         └─────────┘    └──────────┘
```

**Project layout**

```
Source Code/
├── backend/                 # Express 5 API + Socket.IO gateway
│   └── src/
│       ├── config/          # DB connection
│       ├── constants/       # Track & topic taxonomy
│       ├── controllers/     # Auth, gamification, admin, code-exec, comments…
│       ├── middleware/      # JWT auth, rate limiters, Cloudinary uploads
│       ├── models/          # User, Task, UserTask, Mentor, Messages, Badges…
│       ├── routes/          # /auth /gamification /admin /notifications
│       └── services/        # AIQuestGenerator, badges, tiers, email
└── frontend/                # React 19 + Vite SPA
    └── src/
        ├── api/             # Axios instance
        ├── components/      # Dashboard, StudyRooms, CodeEditorModal, Admin…
        ├── context/         # Auth context
        └── utils/           # Tier & date helpers
```

<div align="center">
<img src="https://user-images.githubusercontent.com/74038190/212284100-561aa473-3905-4a80-b561-0d28506553ee.gif" width="100%" alt="divider" />
</div>

## 🚀 Getting Started

### 📋 Prerequisites
- **Node.js** 18+ and **npm**
- A **MongoDB** database (local or [Atlas](https://www.mongodb.com/atlas))
- API keys: **Google Gemini**, **Google OAuth**, **Cloudinary**, and **JDoodle** (for code execution)

### 1️⃣ Clone the repo
```bash
git clone https://github.com/dashashutosh9090/QuestLab.git
cd QuestLab
```

### 2️⃣ Launch the backend 🛰️
```bash
cd backend
npm install
cp .env.example .env      # then fill in your secrets (see below)
npm run dev               # starts on http://localhost:5000
```

### 3️⃣ Launch the frontend 🖥️
```bash
cd frontend
npm install
npm run dev               # starts on http://localhost:5173
```

> 💡 Run the two commands in **separate terminals**. The frontend proxies API + Socket.IO calls to the backend on port `5000`.

<br/>

### 🔑 Environment Variables

<details>
<summary><b>backend/.env</b></summary>

```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/gamified-learning
JWT_SECRET=replace_with_a_long_random_secret          # openssl rand -hex 64
GEMINI_API_KEY=your_gemini_api_key_here
GOOGLE_CLIENT_ID=your_google_oauth_client_id_here
ADMIN_SIGNUP_KEY=replace_with_a_secret_admin_key
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```
*(Cloudinary, JDoodle & email credentials are also read from `.env` — see the backend config.)*
</details>

<details>
<summary><b>frontend/.env</b></summary>

```env
VITE_API_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000
VITE_GOOGLE_CLIENT_ID=your_google_oauth_client_id_here
```
</details>

<div align="center">
<img src="https://user-images.githubusercontent.com/74038190/212284100-561aa473-3905-4a80-b561-0d28506553ee.gif" width="100%" alt="divider" />
</div>

## 🎮 Gamification Engine

<div align="center">

### ⭐ XP Tier Ladder

| Tier | Threshold | Vibe |
|:----:|:---------:|:----:|
| 🟢 **Beginner** | `0 XP` | The origin story |
| 🔵 **Intermediate** | `1,000 XP` | Finding your rhythm |
| 🟣 **Advanced** | `3,000 XP` | In the zone |
| 🟠 **Expert** | `7,000 XP` | Legend status |

### 🏅 Unlockable Badges

| Badge | Name | Unlock Condition |
|:-----:|:-----|:-----------------|
| ⚡ | **Fast Learner** | Reach Level 5 within 7 days of signing up |
| 🔥 | **Consistent Performer** | Hit a 7-day learning streak |
| 🛠️ | **Project Master** | Get 5 project submissions approved |
| 🧠 | **Quiz Champion** | Solve 25 coding challenges |
| 🌅 | **Early Bird** | Submit a project 24h+ before its deadline |

</div>

Every quest completion recalculates **XP → Level → Tier**, evaluates all badge predicates atomically, and fires **live notifications** to the learner (and the admin feed) over Socket.IO — no page refresh required. 🚀

<div align="center">
<img src="https://user-images.githubusercontent.com/74038190/212284100-561aa473-3905-4a80-b561-0d28506553ee.gif" width="100%" alt="divider" />
</div>

## 🗺️ Roadmap

- [ ] 📊 Richer analytics dashboards & progress heatmaps
- [ ] 🌍 Multi-language code execution support
- [ ] 📱 Progressive Web App (installable + offline)
- [ ] 🤝 Group/team quests & cooperative challenges
- [ ] 🎨 Customizable avatars & profile themes

## 🤝 Contributing

Contributions, ideas, and bug reports are welcome! Feel free to open an [issue](https://github.com/dashashutosh9090/QuestLab/issues) or submit a pull request.

```bash
# Fork → create a feature branch → commit → open a PR 🚀
git checkout -b feat/amazing-feature
```

## 📜 License

Released under the **ISC License**.

<div align="center">

<br/>

### ⭐ If QuestLab helped or inspired you, drop a star!

<a href="https://github.com/dashashutosh9090/QuestLab">
  <img src="https://img.shields.io/github/stars/dashashutosh9090/QuestLab?style=social" alt="stars" />
</a>

<br/><br/>

**Crafted with ⚡ by [Ashutosh Dash](https://github.com/dashashutosh9090)**

<img src="https://capsule-render.vercel.app/api?type=waving&color=0:06b6d4,40:8b5cf6,70:4f46e5,100:0f172a&height=140&section=footer&text=Level%20Up.%20Ship%20Code.%20Repeat.&fontSize=20&fontColor=ffffff&fontAlignY=70&animation=fadeIn" width="100%" alt="footer" />

</div>
