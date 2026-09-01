# SafaiTrack — Overall Development Plan

**Stack:** ASP.NET Core Web API (C#) · React + Vite (TypeScript) + Tailwind CSS v4 + shadcn/ui · SQL Server + Entity Framework Core

> **Note on ordering:** the team has chosen to build **frontend-first**, ahead of the backend-led order this plan's milestones originated from. Milestone *numbers* still map to the original feature grouping (for traceability against the proposal), but the **actual build order** follows the sequence in [Section 0](#0-actual-build-order) below.

---

## 0. Actual Build Order

| Phase | Owner | What |
|---|---|---|
| **Phase A** | Easteak | Frontend foundation — Vite + React + TypeScript scaffold, Tailwind CSS v4, shadcn/ui (Radix + Vega), Motion, Watermelon UI blocks |
| **Phase B** | Easteak | Landing page — Hero, Features, How It Works, SDG Alignment, Stats, Footer |
| **Phase C** | Fairuz | Backend foundation — solution structure, database schema (18 entities), EF Core scaffold, Identity integration, API foundation (Swagger, CORS, Serilog) |
| **Phase D** | Fairuz + Sami | Authentication — JWT, login/register, protected routes, role-based dashboards |
| **Phase E** | Easteak + Fairuz | Bin monitoring — backend CRUD + simulation, frontend bin map/dashboard |
| **Phase F** | Fairuz | Route optimization core — Dijkstra / greedy nearest-neighbor |
| **Phase G** | Easteak | Citizen complaint portal — form, tracking, ward officer dashboard |
| **Phase H** | Sami | Fleet management frontend, admin dashboard, analytics charts |
| **Phase I** | All | Testing, hardening, deployment, final presentation |

Phases A–B run first and independently since they don't depend on the backend existing yet. Fairuz's Phase C can start in parallel once she's ready — see [Section 2](#2-team-responsibility-matrix) for coordination notes.

---

## 1. Milestone Breakdown

### Milestone 1 — Database Schema & API Foundation *(Fairuz — backend)* / Frontend Foundation *(Easteak — frontend, done first)*

**Frontend tasks (done first, independent of backend):**
| # | Task | Description |
|---|---|---|
| 1.1 | Vite + React Setup | Configure TypeScript, Tailwind v4, shadcn/ui |
| 1.2 | Landing Page | Hero, Features, How It Works, SDG Alignment, Stats, Footer |
| 1.3 | Responsive Layout | Navbar, footer, mobile breakpoints |

**Backend tasks:**
| # | Task | Description |
|---|---|---|
| 1.4 | Create Database Schema | Implement 3NF schema with 18 entities (see proposal) |
| 1.5 | Entity Framework Setup | Install EF Core packages, scaffold from database |
| 1.6 | Identity Integration | Extend `IdentityDbContext<ApplicationUser>` |
| 1.7 | API Foundation | Setup `Program.cs` with Swagger, CORS, Serilog |
| 1.8 | Base Controllers | Create `CategoriesController`, `WardsController` |
| 1.9 | Test Endpoints | Verify API returns seeded data from SQL Server |
| 1.10 | API Client Setup | Frontend: Configure Axios with base URL, interceptors |
| 1.11 | React Router | Setup routes, layouts, protected route wrapper |

---

### Milestone 2 — Authentication & Authorization

| # | Task | Description |
|---|---|---|
| 2.1 | JWT Setup | Configure JWT Bearer authentication |
| 2.2 | AuthController | Registration/login endpoints |
| 2.3 | Role-Based Authorization | Customer, MunicipalStaff, TruckDriver, WardOfficer |
| 2.4 | Refresh Token | Refresh token rotation |
| 2.5 | AuthContext | React Context for auth state |
| 2.6 | Login/Register Pages | Login form + role-specific registration |
| 2.7 | Protected Routes | Route guard for authenticated users |
| 2.8 | Dashboard Layout | Role-based dashboard routing |

---

### Milestone 3 — Bin Monitoring & Data Simulation

| # | Task | Description |
|---|---|---|
| 3.1 | BinController | CRUD operations for bins |
| 3.2 | BinSensorReadingController | Create/read sensor readings |
| 3.3 | Simulated Sensor Service | Automated bin fill simulation |
| 3.4 | Citizen Reporting | Citizens report bin fill levels |
| 3.5 | Bin Management Page | Admin view of all bins |
| 3.6 | Bin Map View | Map showing bin locations with fill levels (Leaflet) |
| 3.7 | Citizen Bin Report | Form to report bin overflow/status |

---

### Milestone 4 — Route Optimization Core

| # | Task | Description |
|---|---|---|
| 4.1 | Dijkstra Algorithm | Implement Dijkstra's shortest path |
| 4.2 | Greedy Nearest-Neighbor | Fallback routing heuristic |
| 4.3 | RouteGenerationService | Generate optimized routes from bin data |
| 4.4 | RouteController | Route CRUD endpoints |
| 4.5 | Route Generation Page | Admin interface to generate routes |
| 4.6 | Route Map View | Visualize optimized routes on map |

---

### Milestone 5 — Citizen Complaint Portal

| # | Task | Description |
|---|---|---|
| 5.1 | ComplaintController | Complaint CRUD endpoints |
| 5.2 | Complaint Filing | Citizens file complaints with photos |
| 5.3 | Complaint Status History | Track status changes (audit trail) |
| 5.4 | Complaint Assignment | Ward Officer assignment |
| 5.5 | Complaint Form | File complaint with photo upload |
| 5.6 | Complaint List / Detail | View complaints with status + timeline |
| 5.7 | Ward Officer Dashboard | View/update assigned complaints |

---

### Milestone 6 — Truck Fleet & Driver Management

| # | Task | Description |
|---|---|---|
| 6.1 | TruckController | Create/update/delete trucks |
| 6.2 | Truck/Driver Assignment | Assign truck and driver to route |
| 6.3 | Route Execution | Driver logs collection progress |
| 6.4 | Truck Management (Frontend) | Admin view of fleet |
| 6.5 | Driver Dashboard | View assigned route, start/end route, log collections |

---

### Milestone 7 — Admin Dashboard & Analytics

| # | Task | Description |
|---|---|---|
| 7.1 | Admin Stats Endpoint | Platform analytics |
| 7.2 | Bin Trends / Complaint Analytics | Fill trends, volume by ward, resolution time |
| 7.3 | Route Efficiency | Distance saved vs fixed schedule |
| 7.4 | Admin Dashboard (Frontend) | Stats cards + charts (Recharts) |
| 7.5 | User / Ward / Category Management | CRUD interfaces |

---

### Milestone 8 — Testing, Hardening & Deployment

| # | Task | Description |
|---|---|---|
| 8.1 | Integration Testing | Test all API endpoints |
| 8.2 | Security Audit | JWT, authorization, IDOR testing |
| 8.3 | Frontend Build | Production build, minification |
| 8.4 | Deployment | Deploy to Azure/AWS/Heroku |
| 8.5 | Documentation & Final Presentation | API docs, user guide, slides, demo prep |

---

## 2. Team Responsibility Matrix

| Team Member | Primary Role | Milestones |
|---|---|---|
| **Easteak Ahmed** | Frontend + Little Backend | UI Design, Landing Page, Complaint Portal Frontend, Bin Monitoring Frontend, Fleet Frontend |
| **Fairuz Anadi** | Backend | All backend APIs, Database, Authentication, Route Optimization, Admin Backend |
| **Saleh Mahmud Sami** | Little Frontend | Authentication Pages, Admin Dashboard Frontend, Analytics Charts |

**Coordination note:** Easteak is building the frontend foundation independently first. Before Fairuz creates the backend solution structure (Milestone 1 backend tasks), the two should sync briefly to avoid overlapping/conflicting on the repo's `backend/` folder structure.

---

## 3. Design System Reference

| Element | Value |
|---|---|
| Primary | `#0EA5E9` (Sky Blue) |
| Secondary | `#10B981` (Emerald Green) |
| Accent | `#F59E0B` (Amber) |
| Dark | `#1E293B` (Slate) |
| Background | `#F8FAFC` (Light Gray) |
| Component library | shadcn/ui (Radix UI, Vega preset) |
| UI blocks | Watermelon UI |
| Animation | Motion Primitives / Motion |
| Icons | lucide-react |
| Maps | Leaflet + OpenStreetMap |

---

## 4. Timeline Summary

| Week | Milestone | Lead | Key Deliverables |
|---|---|---|---|
| Week 1 | Frontend Foundation + Landing Page | Easteak | Vite/Tailwind/shadcn setup, Hero + Features sections |
| Week 1–2 | Milestone 1 (Backend) | Fairuz | Schema, EF Core, API foundation |
| Week 3 | Milestone 2 — Authentication | Fairuz + Sami | JWT, Login/Register, Protected Routes |
| Week 4 | Milestone 3 — Bin Monitoring | Easteak + Fairuz | Bin CRUD, Simulation, Citizen Reporting |
| Week 5 | Milestone 4 — Route Optimization | Fairuz | Dijkstra algorithm, Route generation |
| Week 6 | Milestone 5 — Complaint Portal | Easteak | Complaint form, Status tracking |
| Week 7 | Milestone 6 — Fleet Management | Sami | Truck/Driver, Route execution |
| Week 8 | Milestone 7 — Admin Dashboard | Fairuz + Sami | Analytics, User management |
| Week 9 | Milestone 8 — Testing & Deployment | All | Integration tests, Deploy |
| Week 10 | Buffer & Finalization | All | Polish, Presentation prep |
