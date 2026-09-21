# SafaiTrack — Project Summary & Architecture Overview

SafaiTrack is an intelligent municipal solid waste management and route optimization platform tailored for Dhaka City. It bridges citizens, municipal ward officers, drivers, and administrators to ensure timely garbage collection, optimized collection routing, and transparent complaint tracking.

---

## 1. High-Level Architecture & Tech Stack

* **Backend:** ASP.NET Core (.NET 10) Web API
  * Modular controllers for authentication, bins, complaints, routes, trucks, notifications, and workspaces.
  * Background hosted services for continuous, autonomous system simulations.
  * JWT-based authentication and strict Role-Based Access Control (RBAC).
* **Database:** Microsoft SQL Server (LocalDB / SQLEXPRESS) via Entity Framework Core.
* **Frontend:** React + TypeScript powered by Vite, TailwindCSS, and Leaflet Maps.
* **External Geospatial Services:** 
  * OpenStreetMap (OSM) & Overpass API (city ward boundaries & real-world waste points).
  * OSRM (Open Source Routing Machine) for real-world drivable road routing and polyline generation.

---

## 2. Role-Based Portals & Access Hierarchy

The system enforces clear organizational boundaries across four distinct user roles:

1. **System Administrator (`admin@safaitrack.local`)**
   * Full city-wide visibility across all 41 Dhaka wards and 200+ waste collection bins.
   * Can create, assign, and monitor collection routes, manage vehicles, and oversee complaints.
2. **Ward Officer (`officer08@safaitrack.local`)**
   * Scoped strictly to their assigned ward (e.g., Ward 08 - Dhanmondi).
   * Monitors local bin fill levels, manages citizen complaints, and dispatches collection trucks for their ward.
3. **Truck Driver (`driver01@safaitrack.local`)**
   * Views routes specifically assigned to their vehicle/profile.
   * Receives incoming dispatch notifications, can Accept or Decline routes, and follows the live turn-by-turn route map.
4. **Citizen (`citizen@safaitrack.local`)**
   * Reports overflowing bins or sanitation issues with descriptions and locations.
   * Tracks real-time status changes and resolution of their filed complaints.

---

## 3. Core System Features

* **Route Optimization Engine:** Calculates optimal collection paths using TSP algorithms (Held-Karp dynamic programming for small clusters, greedy nearest-neighbor for larger paths) combined with real OSRM road distance matrices.
* **Turn-by-Turn Road Geometry:** Overlays actual road-following polylines onto interactive Leaflet maps rather than unrealistic straight lines.
* **Citizen Complaint Lifecycle:** Real-time workflow from submission to investigation, in-progress resolution, and completion, tied directly to automated notification alerts.
* **Fleet Management:** Tracks truck plate numbers, capacities, operational statuses, and assignments.

---

## 4. Key Upgrades Completed Today

### Part 1: Routing Engine Audit & Hardening
* Analyzed the underlying OSRM road-routing mechanism.
* Confirmed it operates without third-party API key locks and established robust client fallbacks to straight-line geometry if public tile/routing servers experience transient latency.

### Part 2: Automated Bin-Fill Simulation
* Added an autonomous background service (`BinFillSimulationService`) that runs independently on a recurring schedule.
* Gradually increases each bin's fill level across Dhaka by a realistic 1–8% per cycle (capped at 100%) to simulate real-world municipal trash accumulation.
* Preserved manual fill overrides and citizen reporting alongside the automated simulation.

### Part 3: Full Dhaka City Seeding (OpenStreetMap & Overpass)
* Built and executed an OSM data extraction pipeline (`seed_dhaka_wards.py`) respecting OSM usage guidelines.
* Expanded the system database from a single isolated test ward to **41 wards across Dhaka** and **200+ real and centroid-grounded waste bins** spanning Uttara, Mirpur, Gulshan, Banani, Dhanmondi, Mohammadpur, Lalmatia, and beyond.

### Part 4: Automated Route Scheduling & Dispatch Queue
* Created a background scheduling service (`AutomaticRouteService`) that continuously evaluates ward conditions.
* Automatically generates optimized routes in `Pending` status whenever bins exceed 60% capacity or unresolved complaints are detected, queuing them up for administrative dispatch.

### Part 5: Driver Dispatch & Acceptance Flow
* Upgraded the dispatch lifecycle to include an `AwaitingAcceptance` state.
* Drivers now receive pending assignments on their dashboard with the ability to **Accept** (transitioning the route to `InProgress`) or **Decline** (returning the route to the unassigned pool).

### Part 6: Animated Truck Simulation & Proximity Auto-Collection
* Implemented road-coordinate interpolation along genuine OSRM geometries (`routeMotion.ts`).
* The driver's map now animates the collection vehicle smoothly along streets at a realistic simulated speed.
* When the vehicle reaches within 50 meters of a stop, the system automatically marks the bin as collected, resets its fill level to 0%, turns the map marker green, and records real timestamps.
* Upon reaching the final stop, the entire route is automatically marked `Completed`.

---

## 5. High-Level Project Structure

```text
SafaiTrack/
├── backend/
│   └── SafaiTrack.Api/
│       ├── Controllers/             # Auth, Bins, Complaints, Routes, Trucks, Workspace
│       ├── Data/                    # ApplicationDbContext & database configurations
│       ├── Dtos/                    # Request and response models
│       ├── Models/                  # Core entities: User, Ward, Bin, Route, Complaint, Truck
│       └── Services/                # RouteOptimizer, RoadRouting, BinFillSimulation, AutomaticRoute
│
├── frontend/
│   └── safai-track-client/
│       └── client/
│           └── src/
│               ├── components/      # UI components: CollectionMap, AuthPage, HeaderActions
│               ├── contexts/        # AuthContext, session state management
│               ├── lib/             # API client, route motion, and geospatial utilities
│               └── Workspace.tsx    # Unified multi-role portal & dashboards
│
├── tools/                           # Seeder scripts for OSM & Overpass Dhaka ward ingestion
└── PROJECT_SUMMARY.md               # This project documentation
```

---

## 6. How to Run the Project

### Start Backend API
```powershell
dotnet run --project backend/SafaiTrack.Api
```
* **URL:** `http://localhost:5281`

### Start Frontend Client
```powershell
cd frontend/safai-track-client
pnpm run dev
```
* **URL:** `http://localhost:3000`

---

## 7. Default Credentials for Testing

| Role | Email | Password | Scope |
| :--- | :--- | :--- | :--- |
| **System Admin** | `admin@safaitrack.local` | `Password123` | City-wide (all 41 wards, all bins) |
| **Ward Officer** | `officer08@safaitrack.local` | `Password123` | Scoped to Ward 08 (Dhanmondi) |
| **Truck Driver** | `driver01@safaitrack.local` | `Password123` | Scoped to assigned collection routes |
| **Citizen** | `citizen@safaitrack.local` | `Password123` | Scoped to personal filed complaints |
