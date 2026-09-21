# 🚀 SafaiTrack Deployment Guide

Simple, 100% free deployment setup using **Render** and **Neon PostgreSQL**.

---

## 🏆 Live Links (Presentation & Evaluation)

| Component | Live Link | Description |
| :--- | :--- | :--- |
| 🌐 **Frontend Web App** | [https://safaitrack-client.onrender.com](https://safaitrack-client.onrender.com) | React + TypeScript web app for Citizens, Drivers, & Admins |
| ⚙️ **Backend API** | [https://safaitrack-api.onrender.com](https://safaitrack-api.onrender.com) | ASP.NET Core 10 Web API service |
| 📄 **Swagger Specs** | [https://safaitrack-api.onrender.com/swagger](https://safaitrack-api.onrender.com/swagger) | Interactive API endpoint documentation |
| 🏥 **Health Check** | [https://safaitrack-api.onrender.com/health](https://safaitrack-api.onrender.com/health) | System health monitor (`{"status":"healthy"}`) |

---

## 📌 How the Architecture Works

1. **Database**: [Neon](https://neon.tech) — Free, permanent PostgreSQL database (no 30-day deletion).
2. **Backend**: [Render Web Service](https://render.com) — Runs ASP.NET Core API inside Docker container.
3. **Frontend**: [Render Static Site](https://render.com) — Hosts compiled React files globally.

---

## 🛠️ Quick 3-Step Deployment Guide

### 1️⃣ Step 1: Create Database on Neon
1. Sign up at **[neon.tech](https://neon.tech)** and click **Create Project**.
2. Click the green **Connect** button.
3. Copy your PostgreSQL connection URL:
   ```text
   postgresql://user:password@ep-something.aws.neon.tech/neondb?sslmode=require
   ```

### 2️⃣ Step 2: Deploy on Render via Blueprint
1. Log in to **[dashboard.render.com](https://dashboard.render.com)**.
2. Click **New +** → **Blueprint**.
3. Select your GitHub repository (`Safai_Track`) and branch `main`.

### 3️⃣ Step 3: Enter Environment Variables
When Render asks for environment variables, fill in:

* **For `safaitrack-api`**:
  - `DATABASE_URL`: *(Your Neon string from Step 1)*
  - `Cors__AllowedOrigins__0`: `https://safaitrack-client.onrender.com`
  - `SslCommerz__ApiBaseUrl`: `https://safaitrack-api.onrender.com`
  - `SslCommerz__ClientBaseUrl`: `https://safaitrack-client.onrender.com`

* **For `safaitrack-client`**:
  - `VITE_API_BASE_URL`: `https://safaitrack-api.onrender.com`

---

## 💻 Running Locally

### Backend:
```bash
cd backend/SafaiTrack.Api
dotnet run
```
*API runs at `http://localhost:5281` with Swagger at `/swagger`.*

### Frontend:
```bash
cd frontend/safai-track-client
npm run dev
```
*Frontend runs at `http://localhost:3000`.*
