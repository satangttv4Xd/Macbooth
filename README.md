# 🍎 MAC DEFENDER — SURVIVE THE HACK
### Interactive Cybersecurity Awareness Booth Game

> **"Your Mac is under attack. Can you survive?"**

---

## 📖 Overview

**MAC DEFENDER** is a fast-paced, high-voltage interactive cybersecurity game engineered for exhibition booths, tech fairs, university roadshows, and conference demo stations. Designed with an **Apple Security Operations Center (SOC) + Hacker Terminal** aesthetic, it challenges players of all experience levels to defend a simulated MacBook against escalating real-time cyber threats.

### 🛡️ Core Educational Focus:
- **Phishing Detection**: Spotting domain spoofs, urgency traps, and fake Apple ID alerts.
- **Password Security**: Understanding passphrase entropy vs dictionary attacks through a live interactive strength meter.
- **Privacy & Permissions**: Identifying unnecessary app permissions (Microphone, Camera, Contacts, Location).
- **Malicious Downloads & Scareware**: Recognizing deceptive "Mac Cleaner" scare tactics.
- **Social Engineering**: Resisting urgent phone calls from fake IT Support demanding OTP/verification codes.
- **Final Boss (Incident Response)**: High-intensity 60-second synchronized multi-vector cyber triage.

---

## 🚀 Quick Start Guide

### Prerequisites
- Node.js `v18+` or `v20+` or `v24+`
- npm `v9+`

### 1. Installation
In the project root directory:
```bash
npm run install:all
```

### 2. Start Development Server
```bash
npm run dev
```
This automatically starts:
- **Backend API & WebSockets Server**: `http://localhost:3001`
- **Frontend Game Application**: `http://localhost:5173`
- Broadcasts the **LAN IP** (e.g., `http://192.168.1.100:5173`) in the terminal for connecting multiple MacBooks at the booth!

---

## 🖥️ Exhibition Booth Modes & URLs

| Mode | URL | Purpose |
| :--- | :--- | :--- |
| **Player Station** | `http://<IP>:5173` | Individual MacBook player terminal. |
| **Big Screen SOC View** | `http://<IP>:5173/bigscreen` | 16:9 Projector / TV displaying live threat statuses of all playing MacBooks. |
| **Leaderboard** | `http://<IP>:5173/leaderboard` | Hall of Fame showing top cyber defenders and ranks. |
| **Booth MC / Admin Panel** | `http://<IP>:5173/admin` | Host stage control (Trigger live attacks, reset scores, analytics). |

---

## 🎛️ Booth Staff & MC Remote Triggers

From `/admin` (Default Staff PIN: `1337`), booth staff can:
- ⚡ **Trigger Live Phishing Attack** to all or specific player stations.
- 🚨 **Broadcast Critical Alert & Alarm** for stage presentations.
- 👾 **Trigger Screen Glitch Effect** on demo machines.
- 🏆 **Reset Leaderboard / Export CSV**.
- 📊 **Monitor Real-Time Booth Analytics** (total players, completion rate, average score).

---

## 🔒 Safety & Privacy Guarantee
- **100% Simulated**: No actual system commands, malware, or exploits are executed.
- **No Personal Data Collected**: Players enter only a game nickname.
- **No Real Credentials**: Never asks for real passwords, OTPs, or credit card info.
