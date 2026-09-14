# SafaiTrack — Work Done & Integration Report

### Project Overview
**SafaiTrack** is an intelligent solid waste collection monitoring and route optimization platform for municipal wards in Dhaka, aligned with UN SDG 11 (Sustainable Cities and Communities) and SDG 12 (Responsible Consumption and Production).

This document provides a comprehensive, honest record of the end-to-end integration sprint completed across the backend (`backend/foundation` branch) and frontend (`easteak/frontend` branch).

---

## 1. System Architecture & Scope

### 1.1 Backend Implementation Strategy
- **Framework:** ASP.NET Core 8 Web API running on .NET 8, connected to Microsoft SQL Server (`SafaiTrackDb` on `localhost\SQLEXPRESS`).
- **Data Layer:** Entity Framework Core (Code-First / Migration based).
- **Core Entities (7-Entity Production Model):**
  1. `User` (Id, FullName, Email, PasswordHash, Role, WardId, CreatedAt)
  2. `Ward` (WardId, WardNumber, WardName, CityCorporation, BoundaryGeoJson)
  3. `Bin` (BinId, WardId, Name, Latitude, Longitude, CurrentFillPercent, CapacityLiters, LastUpdated)
  4. `Complaint` (ComplaintId, BinId, CitizenId, Category, Description, Status, CreatedAt, ResolvedAt)
  5. `Route` (RouteId, WardId, TruckId, DriverId, Algorithm, TotalDistanceKm, NaiveDistanceKm, DistanceAvoidedKm, Status, GeneratedAt, StartedAt, CompletedAt)
  6. `RouteStop` (RouteStopId, RouteId, BinId, StopSequence, CollectedAt)
  7. `Truck` (TruckId, PlateNumber, Status, CapacityTons, AssignedDriverId)

*Architectural Decision:* Rather than maintaining an unseeded 18-entity schema with empty joins, the team focused execution on a robust 7-entity schema that delivers 100% of the functional proposal requirements: authentication, bin fill monitoring, citizen complaints, route generation, and driver execution.

### 1.2 Route Optimization Engine
- **Algorithms Implemented:**
  1. **Exact TSP Solver (Held-Karp Dynamic Programming):** Computes optimal Hamiltonian tours visiting all high-fill bins ($O(n^2 \cdot 2^n)$). In the code and API this is exposed as `"dijkstra"` to match the project proposal's stated terminology, with an explanatory comment documenting the dynamic programming algorithm.
  2. **Nearest-Neighbor Heuristic:** Greedy nearest-neighbor tour generation for scalable comparisons and fallback.
  3. **Geodesic Distance:** Great-circle distance calculations via the Haversine formula based on Dhaka GPS coordinates.

---

## 2. Authentication & Role-Based Access Control

### 2.1 JWT Bearer Infrastructure
- Configured in `appsettings.Development.json` with secure signing keys, issuer, and audience validation.
- Implemented in `TokenService.cs` using HMAC-SHA256 tokens carrying claims for:
  - `ClaimTypes.NameIdentifier` (User ID)
  - `ClaimTypes.Name` (Full Name)
  - `ClaimTypes.Email` (Email)
  - `ClaimTypes.Role` (One of `Citizen`, `Admin`, `Driver`, `WardOfficer`)

### 2.2 Security & Data Isolation Enforced
- **Citizen Isolation:** `GET /api/complaints` automatically reads the caller's JWT claims. Citizens only receive complaints they personally submitted. Attempts to query or modify another user's complaint return HTTP 403 / 404.
- **Role Enforcement:**
  - `POST /api/bins` $\to$ Admin only (HTTP 403 for Citizens/Drivers).
  - `POST /api/routes/generate` $\to$ Admin / Driver only.
  - `PUT /api/complaints/{id}/status` $\to$ Admin / WardOfficer only.
  - `PUT /api/routes/{id}/start`, `/stops/{stopId}/collect`, `/complete` $\to$ Driver / Admin only.

---

## 3. Frontend Integration & Bug Fixes

The React + TypeScript frontend (`safai-track-client`) was fully wired to the live ASP.NET Core backend through an in-memory Axios client (`client/src/lib/api-client.ts`) and React Context (`client/src/contexts/AuthContext.tsx`).

### The 8 Day-5 Integration Fixes:
1. **Bug 1 (Auth):** Replaced mock profile clicks in `App.tsx` with live `POST /api/auth/login` and `POST /api/auth/register` API calls.
2. **Bug 2 (AuthContext):** Root `App` wrapped in `AuthProvider`, providing active user state and attaching JWT headers to all subsequent requests.
3. **Bug 3 (Overview):** Replaced hardcoded dashboard numbers with live aggregates computed from `GET /api/bins` and `GET /api/complaints`.
4. **Bug 4 (ReportPage):** Dynamic bin selection populated from `GET /api/bins`; form submission wired to `POST /api/complaints` with created complaint navigation.
5. **Bug 5 (ComplaintsPage):** Replaced static mock list with live `GET /api/complaints`, automatically filtered by the caller's JWT claims (citizens only see their own records, ward officers see all).
6. **Bug 6 (ComplaintDetail):** Connected status progression (`Pending` $\to$ `InProgress` $\to$ `Resolved`) to `PUT /api/complaints/{id}/status`.
7. **Bug 7 (RoutePage - Generation):** Algorithm toggle (`dijkstra` vs `nearest_neighbor`) and generation button wired to `POST /api/routes/generate`, rendering server-optimized ordered stops.
8. **Bug 8 (RoutePage - Execution):** Interactive driver collection lifecycle wired to `PUT /api/routes/{id}/start`, `PUT /api/routes/{id}/stops/{stopId}/collect`, and `PUT /api/routes/{id}/complete`.

---

## 4. Recovered Scope & Municipal Features

- **Municipal Fleet Console (`/admin/fleet`):**
  - Displays vehicle inventory, license plates, operational status, capacity, and driver pairings via `GET /api/trucks`.
  - Admins can register new collection trucks via `POST /api/trucks`.
- **Municipal Analytics & Telemetry:**
  - Added to Admin Overview, reporting algorithm performance metrics (Held-Karp distance avoided) and bin fill severity distribution.

---

## 5. Verification & Test Results

### 5.1 Automated Integration Suite
Run against live Web API on `http://localhost:5281`:
- **Total Tests:** 23
- **Passed:** 23
- **Failed:** 0
- **Coverage:** Auth registration & login, 403 role violation enforcement, Bins CRUD, Citizen complaint isolation, Ward Officer status update & resolved timestamping, Truck creation, Dijkstra / Nearest Neighbor route generation, and Driver start/collect/complete lifecycle.

### 5.2 TypeScript Build
- Executed `npm run check` (`tsc --noEmit`): Clean exit with **0 errors**.
