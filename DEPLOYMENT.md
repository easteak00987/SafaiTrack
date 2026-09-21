# 🌐 SafaiTrack Live Application

### 🔗 Main Presentation URL:
## **[https://safaitrack-client.onrender.com](https://safaitrack-client.onrender.com)**

> [!IMPORTANT]
> **This single link runs the entire application.** It connects the React frontend to the ASP.NET Core API and PostgreSQL database automatically. Open this link to evaluate Citizen, Driver, Admin, and Inspector workspaces.

---

## 🎯 Why We Deployed

1. **Public Accessibility**: Allows course evaluators, instructors, and judges to access and test the full live system instantly from any device without installing local dependencies.
2. **Real-world Simulation**: Demonstrates live sensor data simulation, real-time route optimization on Dhaka ward maps, and automated bill generation in a production-like cloud environment.
3. **100% Free & Sustainable Architecture**: Designed to run permanently on free-tier cloud infrastructure aligned with UN SDG 11 (*Sustainable Cities and Communities*).

---

## 🏗️ How We Deployed

The project is deployed using a decoupled, 3-tier cloud architecture:

| Layer | Service | Deployment Method | Why This Technology |
| :--- | :--- | :--- | :--- |
| 🌐 **Frontend Web App** | **Render Static Site** | Automated Vite production build from `main` branch | Served globally over CDN with sub-second page load times. |
| ⚙️ **Backend API** | **Render Web Service** | Containerized **ASP.NET Core 10** built via Dockerfile | Runs C# Web API endpoints, JWT auth, and background services. |
| 🛢️ **Database** | **Neon PostgreSQL** | Serverless cloud PostgreSQL database | Provides permanent storage without the 30-day deletion limit of standard free DBs. |
| ⚡ **Service Keep-Warm** | **GitHub Actions** | Automated ping workflow ([`keep-warm.yml`](.github/workflows/keep-warm.yml)) | Pings `/health` every 10 minutes to prevent cloud sleep cycles during evaluation. |

---

## 🔗 Supplementary Links (For Technical Inspection Only)

* ⚙️ **Backend API Base**: [https://safaitrack-api.onrender.com](https://safaitrack-api.onrender.com)
* 📄 **OpenAPI / Swagger Specs**: [https://safaitrack-api.onrender.com/swagger](https://safaitrack-api.onrender.com/swagger)
* 🏥 **System Health Check**: [https://safaitrack-api.onrender.com/health](https://safaitrack-api.onrender.com/health)

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
