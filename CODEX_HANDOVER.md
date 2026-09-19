# SafaiTrack — Complete Codex Handover & System Context

This document provides a single-source-of-truth briefing for OpenAI Codex / AI coding assistants working in this workspace.

---

## 1. Project Identification & Repository State
- **Project Name:** SafaiTrack (CSE 3200 — Software Development V, AUST)
- **Domain:** Smart Solid Waste Collection & Route Optimization for Dhaka Municipal Wards (SDG 11 & SDG 12)
- **Local Path:** `D:\SafaiTrack`
- **Active Git Branch:** `backend/foundation`
- **Reference Docs:** 
  - `README.md` — Project overview and feature summary
  - `WORK_DONE.md` — End-to-end integration sprint details & Day 5 bug fixes
  - `dev_log/MILESTONE_PLAN.md` & `dev_log/OVERALL_PLAN.md` — Complete milestone tracking

---

## 2. Active Services & Live Endpoints (Currently Running)
| Component | Local URL / Port | Technology | Notes |
|---|---|---|---|
| **Backend API** | `http://localhost:5281` | ASP.NET Core (.NET 10 preview) | Root (`/`) redirects to `/swagger`. |
| **Swagger UI** | `http://localhost:5281/swagger` | Swashbuckle OpenAPI | Interactive API documentation & test console. |
| **Frontend App** | `http://localhost:3000` | React 19 + TypeScript + Vite | Tailwind CSS v4, shadcn/ui. |
| **Database** | `localhost\SQLEXPRESS` | Microsoft SQL Server Express | Database name: `SafaiTrackDb`. |

---

## 3. Database Architecture (`SafaiTrackDb`)
- **ORM:** Entity Framework Core (Code-First with migrations in `backend/SafaiTrack.Api/Migrations/`)
- **Schema Model (7-Entity Production Core):**
  1. `AspNetUsers` / `AspNetRoles` / Identity tables — User accounts and RBAC
  2. `Wards` — Municipal wards (Ward 08 / Dhanmondi seeded)
  3. `Bins` — Waste bins tracking GPS (lat, lng), current fill percent (0-100%), and timestamps
  4. `Complaints` — Citizen reports tied to bins (`BinId`) and citizens (`CitizenId`) with status (`Pending`, `InProgress`, `Resolved`)
  5. `Trucks` — Collection vehicles with capacity (tons), operational status, and assigned driver
  6. `Routes` — Generated collection circuits tracking distance, naive distance, distance avoided, and status (`Planned`, `InProgress`, `Completed`)
  7. `RouteStops` — Sequenced bin collection stops per route with timestamps (`CollectedAt`)

### Default Pre-Seeded Credentials (All passwords: `Password123`)
| Role | Email | Capabilities / Scope |
|---|---|---|
| **Admin** | `admin@safaitrack.local` | Route generation, bin management, fleet console, all complaints |
| **Ward Officer** | `officer08@safaitrack.local` | Ward 08 complaints desk, status progression (`Pending` → `InProgress` → `Resolved`) |
| **Truck Driver** | `driver01@safaitrack.local` | Active route navigation, stop collection (`Collect`), route completion |
| **Citizen** | `citizen01@safaitrack.local` | Report issues, dynamic bin selector, strictly isolated personal complaint trail |

---

## 4. Key Codebase Structure & File Map

### Backend: `backend/SafaiTrack.Api/`
- `Program.cs` — CORS (`http://localhost:3000`), JWT authentication, Swagger, root redirect to `/swagger`, database auto-seeder
- `appsettings.Development.json` — Connection string to `localhost\SQLEXPRESS;Database=SafaiTrackDb`, JWT signing key
- `Controllers/`:
  - `AuthController.cs` — `/api/auth/register`, `/api/auth/login` (issues HMAC-SHA256 JWTs)
  - `BinsController.cs` — `/api/bins` CRUD, fill percentage updates, ward filtering
  - `ComplaintsController.cs` — `/api/complaints` with strict citizen isolation & Ward Officer status progression
  - `RoutesController.cs` — `/api/routes/generate`, `/api/routes/{id}/start`, `/stops/{stopId}/collect`, `/complete`
  - `TrucksController.cs` — `/api/trucks` fleet management and truck creation
- `Services/`:
  - `RouteOptimizerService.cs` — Held-Karp exact TSP dynamic programming ($O(n^2 \cdot 2^n)$) exposed as `"dijkstra"` per proposal terms, plus Greedy Nearest Neighbor and Haversine distance calculations
  - `TokenService.cs` — JWT token generation with role & identity claims

### Frontend: `frontend/safai-track-client/` (Root at `client/`)
- `vite.config.ts` — Port 3000, alias `@/` mapped to `client/src`
- `client/src/lib/api-client.ts` — Axios instance with `baseURL: http://localhost:5281` and JWT interceptor
- `client/src/contexts/AuthContext.tsx` — Global React Auth state & token storage
- `client/src/pages/`:
  - `LoginPage.tsx` — Role-based sign-in & registration
  - `OverviewPage.tsx` — Dashboard metrics computed from live API data
  - `ReportPage.tsx` — Dynamic bin selection and complaint filing
  - `ComplaintsPage.tsx` & `ComplaintDetailPage.tsx` — Live complaint tracking & status transitions
  - `RoutePage.tsx` — Route optimization generation & driver stop-by-stop collection interface
  - `FleetPage.tsx` — Municipal vehicle fleet status and truck registration

---

## 5. Architectural Design Principles to Maintain
1. **Security & RBAC:** Keep the citizen complaint isolation intact. Citizens must never see other citizens' reports.
2. **Algorithm Grounding:** The exact TSP solver is in `RouteOptimizerService.cs`. Route stops use Haversine coordinates mapped to Dhaka GPS bounds.
3. **Simulated Sensor Feed:** Real hardware is out of scope; bin fill levels are managed programmatically via DB records and citizen reports.
4. **API-First Decoupled Frontend:** Frontend connects through `apiClient` (`api-client.ts`). Keep JWT token attached to all requests.

