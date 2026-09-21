# SafaiTrack — Project Snapshot & System Architecture

**Generated:** 2026-09-19  
**Branch:** `backend/foundation`  
**Status:** Functional Production Foundation (Live .NET 8 Web API + React 18 / TypeScript SPA)  
**Database:** Microsoft SQL Server (`SafaiTrackDb`) via Entity Framework Core 8

---

## 1. Folder Structure

The repository maintains an active two-tier architecture: **`backend/SafaiTrack.Api`** (ASP.NET Core Web API) and **`frontend/safai-track-client`** (Vite + React SPA). 

> **Note on Root Folders:** Leftover boilerplate directories (`/client`, `/server`, `/shared`, `/database`) at the repository root represent the initial template scaffolding prior to the migration to .NET 8 Web API and Vite. The active, maintained code exclusively resides in `backend/` and `frontend/`.

```
SafaiTrack/
├── backend/
│   └── SafaiTrack.Api/                     # .NET 8 C# Web API Project
│       ├── Controllers/                    # REST API Controllers (Role-guarded)
│       │   ├── AuthController.cs           # User registration & JWT authentication
│       │   ├── BinsController.cs           # Bin CRUD, fill updates, ward scoping
│       │   ├── ComplaintsController.cs     # Complaint lifecycle, triage & audit timeline
│       │   ├── RoutesController.cs         # Route generation, optimization & driver workflow
│       │   ├── TrucksController.cs         # Garbage fleet vehicle management
│       │   └── WorkspaceController.cs      # Metadata endpoints (wards, drivers)
│       ├── Data/                           # EF Core Database Context & Seeding
│       │   ├── ApplicationDbContext.cs     # DbContext, relationships, cascades & schema rules
│       │   └── DbSeeder.cs                 # Seed data (wards, users, bins, trucks, complaints)
│       ├── Dtos/                           # Data Transfer Objects
│       │   ├── AuthResponseDto.cs          # Login/registration token payload
│       │   ├── BinDtos.cs                  # Bin query & command DTOs
│       │   ├── ComplaintDtos.cs            # Complaint submission, detail & update DTOs
│       │   ├── LoginDto.cs                 # Login credential DTO
│       │   ├── RegisterDto.cs              # Registration payload DTO
│       │   ├── RouteDtos.cs                # Route, stop, and generation request DTOs
│       │   └── TruckDtos.cs                # Fleet truck CRUD DTOs
│       ├── Migrations/                     # Entity Framework Core migration history
│       │   ├── 20260906000000_InitialCreate.cs
│       │   ├── 20260907150000_AddComplaintAuditTimeline.cs
│       │   └── ApplicationDbContextModelSnapshot.cs
│       ├── Models/                         # Domain Entities
│       │   ├── ApplicationUser.cs          # Identity user with WardId & Role
│       │   ├── Bin.cs                      # Waste bin with coordinates & fill %
│       │   ├── Complaint.cs                # Citizen complaint record
│       │   ├── ComplaintUpdate.cs          # Audit trail / status transition logs
│       │   ├── Route.cs                    # Waste collection route
│       │   ├── RouteStop.cs                # Ordered stop along a route
│       │   ├── Truck.cs                    # Collection vehicle
│       │   └── Ward.cs                     # Municipal administrative ward
│       ├── Services/                       # Business Logic & Algorithms
│       │   ├── RouteOptimizerService.cs    # TSP solver (Held-Karp Dijkstra & Nearest Neighbor)
│       │   └── TokenService.cs             # HMAC-SHA256 JWT generation
│       ├── Program.cs                      # Dependency Injection, middleware, JWT auth & CORS
│       ├── SafaiTrack.Api.csproj           # Project configuration & NuGet dependencies
│       └── appsettings.json                # Connection strings & JWT secret settings
│
├── frontend/
│   └── safai-track-client/                 # Vite + React 18 + TypeScript Application
│       ├── client/
│       │   ├── public/                     # Static assets & public icons
│       │   ├── src/
│       │   │   ├── components/             # Reusable UI & presentation components
│       │   │   │   ├── ui/                 # Atomic UI primitives (button, badge, dialog, etc.)
│       │   │   │   ├── AuthPage.tsx        # Login & Registration with role selection
│       │   │   │   ├── CollectionMap.tsx   # Leaflet Map with OSRM routing & Dhaka GPS pins
│       │   │   │   ├── ErrorBoundary.tsx   # React error boundary fallback
│       │   │   │   ├── HeaderActions.tsx   # Top navigation bar, profile menu & notifications
│       │   │   │   ├── ManusDialog.tsx     # Reusable modal dialog wrapper
│       │   │   │   └── Map.tsx             # Auxiliary map renderer
│       │   │   ├── contexts/               # React Context Providers
│       │   │   │   ├── AuthContext.tsx     # Global JWT state, user profile & token lifecycle
│       │   │   │   └── ThemeContext.tsx    # Dark / Light theme provider
│       │   │   ├── lib/                    # Client libraries & utilities
│       │   │   │   ├── api-client.ts       # Axios instance with auto JWT Bearer header interceptor
│       │   │   │   ├── headerData.ts       # Navigation headers & notification helpers
│       │   │   │   ├── routeOptimizer.ts   # Client-side heuristic calculator (for landing demo)
│       │   │   │   └── utils.ts            # Class merging utility (clsx / tailwind-merge)
│       │   │   ├── pages/                  # Top-level standalone views
│       │   │   │   ├── Home.tsx            # Legacy home page
│       │   │   │   └── NotFound.tsx        # 404 fallback page
│       │   │   ├── App.tsx                 # Root application wrapper & public landing showcase
│       │   │   ├── Workspace.tsx           # Role-based workspace shell, guards & sub-views
│       │   │   ├── main.tsx                # React DOM bootstrap
│       │   │   ├── index.css               # Core styling & design system tokens
│       │   │   └── workspace.css           # Workspace panel & grid layout styling
│       │   ├── index.html                  # HTML entry point
│       │   ├── package.json                # NPM package dependencies and scripts
│       │   ├── tsconfig.json               # TypeScript compiler configuration
│       │   └── vite.config.ts              # Vite dev server configuration (Port 3000, proxy)
│
├── patches/                                # Local fix patches
├── dev_log/                                # Historical dev task logs
└── PROJECT_SNAPSHOT.md                     # Current document
```

---

## 2. Frontend Routes

All routes are declared in `Workspace.tsx` and wrapped by `<AuthProvider>` in `App.tsx`. Authenticated routes use a `<Guard>` component that verifies JWT session existence and role authorization before rendering the `<Shell>`.

| URL Path | Component File | Target Role(s) | Real Backend API or Mock Data? |
| :--- | :--- | :--- | :--- |
| `/` | `client/src/App.tsx` (`Landing`) | Public | **Interactive Demo / Presentation**: Uses static showcase statistics, animated canvas, and client-side TSP comparison algorithm (`routeOptimizer.ts`) for demonstration prior to sign-in. |
| `/login` | `client/src/components/AuthPage.tsx` | Public | **100% Real**: Submits credentials to `POST /api/auth/login`, stores issued JWT in `localStorage`, and updates `AuthContext`. |
| `/register` | `client/src/components/AuthPage.tsx` | Public | **100% Real**: Submits registration payload to `POST /api/auth/register`, then immediately authenticates via `POST /api/auth/login`. |
| `/home` | `client/src/Workspace.tsx` (`HomeRedirect`) | Any Authenticated | **100% Real**: Reads the user's role from JWT claims and immediately redirects to their dedicated dashboard (`/citizen/dashboard`, `/driver/dashboard`, `/officer/dashboard`, or `/admin/dashboard`). |
| `/citizen/dashboard` | `client/src/Workspace.tsx` (`Dashboard`) | `Citizen` | **100% Real**: Calls `GET /api/bins` and `GET /api/complaints` via `apiClient`. Renders citizen summary cards and an interactive live bin map. |
| `/citizen/complaints` | `client/src/Workspace.tsx` (`Complaints`) | `Citizen` | **100% Real**: Calls `GET /api/complaints`. Backend automatically scopes records to only those filed by the logged-in citizen. |
| `/citizen/complaints/:id`| `client/src/Workspace.tsx` (`ComplaintDetail`) | `Citizen` | **100% Real**: Calls `GET /api/complaints/{id}` and `GET /api/complaints/{id}/updates` to view real-time resolution history and audit timeline. |
| `/citizen/report` | `client/src/Workspace.tsx` (`Report`) | `Citizen` | **100% Real**: Fetches active bins via `GET /api/bins` to populate the target bin picker; submits complaint via `POST /api/complaints`. |
| `/driver/dashboard` | `client/src/Workspace.tsx` (`Dashboard`) | `Driver` | **100% Real**: Calls `GET /api/routes` to identify the driver's active route, remaining stops, and map progression. |
| `/driver/route` | `client/src/Workspace.tsx` (`RouteList`) | `Driver` | **100% Real**: Calls `GET /api/routes`. Shows assigned collection routes, status badges (`Planned`, `InProgress`, `Completed`), and stop counts. |
| `/driver/route/:id` | `client/src/Workspace.tsx` (`RouteDetail`) | `Driver` | **100% Real**: Calls `GET /api/routes/{id}`. Triggers `PUT /api/routes/{id}/start`, `PUT /api/routes/{id}/stops/{stopId}/collect`, and `PUT /api/routes/{id}/complete`. |
| `/officer/dashboard` | `client/src/Workspace.tsx` (`Dashboard`) | `WardOfficer` | **100% Real**: Calls `GET /api/bins` and `GET /api/complaints` (strictly scoped to the officer's assigned Ward). |
| `/officer/complaints/:id`| `client/src/Workspace.tsx` (`ComplaintDetail`) | `WardOfficer` | **100% Real**: Calls `GET /api/complaints/{id}` & `GET /api/complaints/{id}/updates`. Enables status updates (`InProgress`, `Resolved`) via `PUT /api/complaints/{id}/status`. |
| `/admin/dashboard` | `client/src/Workspace.tsx` (`Dashboard`) | `Admin` | **100% Real**: Calls `GET /api/bins` and `GET /api/complaints` across all municipal wards. |
| `/admin/fleet` | `client/src/Workspace.tsx` (`Fleet`) | `Admin` | **100% Real**: Calls `GET /api/trucks` and `GET /api/workspace/drivers`. Allows creating, modifying, and deleting fleet trucks. |
| `/operations/complaints` | `client/src/Workspace.tsx` (`Complaints`) | `Admin`, `WardOfficer` | **100% Real**: Calls `GET /api/complaints`. Lists all triage items across the jurisdiction with search and status filtering. |
| `/operations/complaints/:id` | `client/src/Workspace.tsx` (`ComplaintDetail`) | `Admin`, `WardOfficer` | **100% Real**: Allows officers/admins to transition statuses and write audit messages to the citizen's complaint thread. |
| `/operations/bins` | `client/src/Workspace.tsx` (`Bins`) | `Admin`, `WardOfficer` | **100% Real**: Calls `GET /api/bins` & `GET /api/workspace/wards`. Supports updating fill levels, editing coordinates, and adding new bins. |
| `/operations/routes` | `client/src/Workspace.tsx` (`RouteList`) | `Admin`, `WardOfficer` | **100% Real**: Calls `GET /api/routes`. Includes route generation modal backed by `POST /api/routes/generate`. |
| `/operations/routes/:id` | `client/src/Workspace.tsx` (`RouteDetail`) | `Admin`, `WardOfficer` | **100% Real**: Calls `GET /api/routes/{id}`. Displays turn-by-turn Leaflet route visualization and trigger for `PUT /api/routes/{id}/optimize`. |
| `/operations/fleet` | `client/src/Workspace.tsx` (`Fleet`) | `Admin`, `WardOfficer` | **100% Real**: Calls `GET /api/trucks` and `GET /api/workspace/drivers` for viewing fleet readiness and maintenance statuses. |

---

## 3. Backend API Endpoints

The backend is built on ASP.NET Core 8 Web API. All endpoints (except public authentication) require a valid `Bearer <JWT>` in the HTTP `Authorization` header.

### AuthController (`/api/auth`)
| Method & Path | Required Role | Description | Entity / Table Touched |
| :--- | :--- | :--- | :--- |
| `POST /api/auth/register` | Public | Registers a new user account with role, password, and optional Ward assignment. | `AspNetUsers`, `AspNetUserRoles`, `Wards` |
| `POST /api/auth/login` | Public | Verifies credentials and issues a signed HMAC-SHA256 JWT containing role and ward claims. | `AspNetUsers`, `AspNetUserRoles`, `Wards` |

### BinsController (`/api/bins`)
| Method & Path | Required Role | Description | Entity / Table Touched |
| :--- | :--- | :--- | :--- |
| `GET /api/bins` | Any Authenticated | Lists waste bins. Scoped automatically to user's `WardId` for `WardOfficer` and `Driver`. Supports `?wardId=` for `Admin`. | `Bins`, `Wards` |
| `GET /api/bins/{id}` | Any Authenticated | Retrieves detailed metadata and location for a specific bin (scoped by ward). | `Bins`, `Wards` |
| `POST /api/bins` | `Admin` | Provisions a new waste bin in a specified ward with initial coordinates and capacity. | `Bins`, `Wards` |
| `PUT /api/bins/{id}` | `Admin`, `WardOfficer` | Updates bin fill percentage, designation, or GPS coordinates (ward-restricted for officers). | `Bins` |
| `DELETE /api/bins/{id}` | `Admin` | Deletes a bin record (prohibited if bin is linked to active route stops). | `Bins`, `RouteStops` |

### ComplaintsController (`/api/complaints`)
| Method & Path | Required Role | Description | Entity / Table Touched |
| :--- | :--- | :--- | :--- |
| `GET /api/complaints` | `Citizen`, `Admin`, `WardOfficer` | Lists complaints. Citizens receive only their own; Ward Officers receive their ward's; Admins receive all. | `Complaints`, `Bins`, `AspNetUsers` |
| `GET /api/complaints/{id}` | `Citizen`, `Admin`, `WardOfficer` | Fetches details of a single complaint with ownership/ward verification. | `Complaints`, `Bins`, `AspNetUsers` |
| `POST /api/complaints` | `Citizen` | Submits a new citizen complaint against a specific bin with category and description. | `Complaints`, `Bins` |
| `PUT /api/complaints/{id}/status` | `Admin`, `WardOfficer` | Updates complaint status (`Pending` &rarr; `InProgress` &rarr; `Resolved`), sets resolution time, and creates an audit entry. | `Complaints`, `ComplaintUpdates` |
| `GET /api/complaints/{id}/updates` | `Citizen`, `Admin`, `WardOfficer` | Retrieves chronological audit timeline and update notes for a complaint. | `ComplaintUpdates`, `Complaints` |

### RoutesController (`/api/routes`)
| Method & Path | Required Role | Description | Entity / Table Touched |
| :--- | :--- | :--- | :--- |
| `GET /api/routes` | `Admin`, `WardOfficer`, `Driver` | Lists collection routes. Drivers see assigned routes; Officers see ward routes; Admins see all. | `Routes`, `RouteStops`, `Bins`, `Trucks`, `AspNetUsers` |
| `GET /api/routes/{id}` | `Admin`, `WardOfficer`, `Driver` | Returns route details, total distance, truck/driver assignment, and ordered collection stops. | `Routes`, `RouteStops`, `Bins`, `Trucks` |
| `POST /api/routes/generate` | `Admin`, `WardOfficer` | Generates an optimized pickup path for high-fill (&gt;60%) or complained bins using Held-Karp or Nearest Neighbor TSP. | `Routes`, `RouteStops`, `Bins`, `Trucks`, `AspNetUsers` |
| `PUT /api/routes/{id}/optimize` | `Admin`, `WardOfficer`, `Driver` | Recalculates and re-sequences stops for an existing `Planned` route using the optimization service. | `Routes`, `RouteStops`, `Bins` |
| `PUT /api/routes/{id}/start` | `Driver` | Transitions route status from `Planned` to `InProgress` and truck status to `OnRoute`. | `Routes`, `Trucks` |
| `PUT /api/routes/{id}/stops/{stopId}/collect` | `Driver` | Records sequential pickup: marks stop `CollectedAt` and automatically resets bin fill level to `0%`. | `RouteStops`, `Bins` |
| `PUT /api/routes/{id}/complete` | `Driver` | Finishes the route: marks status `Completed` and releases the assigned truck back to `Available`. | `Routes`, `Trucks` |

### TrucksController (`/api/trucks`)
| Method & Path | Required Role | Description | Entity / Table Touched |
| :--- | :--- | :--- | :--- |
| `GET /api/trucks` | `Admin`, `WardOfficer` | Returns the fleet roster with current status (`Available`, `OnRoute`, `Maintenance`). | `Trucks` |
| `GET /api/trucks/{id}` | `Admin`, `WardOfficer` | Retrieves single truck details. | `Trucks` |
| `POST /api/trucks` | `Admin` | Adds a new waste collection truck to the municipal fleet. | `Trucks` |
| `PUT /api/trucks/{id}` | `Admin` | Updates vehicle license plate or operational status. | `Trucks` |
| `DELETE /api/trucks/{id}` | `Admin` | Removes a truck from the fleet (prohibited if linked to active routes). | `Trucks`, `Routes` |

### WorkspaceController (`/api/workspace`)
| Method & Path | Required Role | Description | Entity / Table Touched |
| :--- | :--- | :--- | :--- |
| `GET /api/workspace/wards` | Any Authenticated | Returns all municipal wards for dropdown filters and map layer toggles. | `Wards` |
| `GET /api/workspace/drivers` | `Admin`, `WardOfficer` | Returns active drivers (filtered to officer's ward for Ward Officers). | `AspNetUsers` |

---

## 4. Database Entities

Configured in `SafaiTrack.Api.Data.ApplicationDbContext` with SQL Server relational constraints and cascade prevention rules:

### 1. `AspNetUsers` (`ApplicationUser`)
*Extends ASP.NET Core IdentityUser*
- **Primary Key:** `Id` (`nvarchar(450)`)
- **Fields:** `UserName`, `Email`, `PasswordHash`, `FullName` (`nvarchar(max)`), `Role` (`nvarchar(max)`), `WardId` (`int`, nullable)
- **Relationships:**
  - `WardId` &rarr; Foreign Key to `Wards.WardId` (`ON DELETE RESTRICT`)

### 2. `Wards` (`Ward`)
- **Primary Key:** `WardId` (`int`, Identity)
- **Fields:** `Name` (`nvarchar(150)`, required), `Description` (`nvarchar(500)`, optional)
- **Relationships:**
  - Has many `Bins` (`Ward.Bins`)
  - Has many `Routes` (`Ward.Routes`)

### 3. `Bins` (`Bin`)
- **Primary Key:** `BinId` (`int`, Identity)
- **Fields:** `Name` (`nvarchar(150)`, required), `Latitude` (`float`), `Longitude` (`float`), `CurrentFillPercent` (`int`), `LastUpdated` (`datetime2`), `WardId` (`int`, required)
- **Relationships:**
  - `WardId` &rarr; Foreign Key to `Wards.WardId` (`ON DELETE RESTRICT`)
  - Has many `Complaints` (`Bin.Complaints`)
  - Has many `RouteStops` (`Bin.RouteStops`)

### 4. `Complaints` (`Complaint`)
- **Primary Key:** `ComplaintId` (`int`, Identity)
- **Fields:** `BinId` (`int`, required), `CitizenId` (`nvarchar(450)`, required), `Category` (`nvarchar(100)`, required), `Description` (`nvarchar(1000)`, required), `Status` (`nvarchar(50)`, default `"Pending"`), `CreatedAt` (`datetime2`), `ResolvedAt` (`datetime2`, nullable)
- **Relationships:**
  - `BinId` &rarr; Foreign Key to `Bins.BinId` (`ON DELETE CASCADE`)
  - `CitizenId` &rarr; Foreign Key to `AspNetUsers.Id` (`ON DELETE RESTRICT`)
  - Has many `ComplaintUpdates` (`Complaint.ComplaintUpdates`)

### 5. `ComplaintUpdates` (`ComplaintUpdate`)
- **Primary Key:** `ComplaintUpdateId` (`int`, Identity)
- **Fields:** `ComplaintId` (`int`, required), `AuthorId` (`nvarchar(max)`), `AuthorName` (`nvarchar(max)`), `Status` (`nvarchar(max)`), `Message` (`nvarchar(1000)`), `CreatedAt` (`datetime2`)
- **Relationships:**
  - `ComplaintId` &rarr; Foreign Key to `Complaints.ComplaintId` (`ON DELETE CASCADE`)

### 6. `Trucks` (`Truck`)
- **Primary Key:** `TruckId` (`int`, Identity)
- **Fields:** `PlateNumber` (`nvarchar(50)`, required), `Status` (`nvarchar(50)`, default `"Available"`)
- **Relationships:**
  - Has many `Routes` (`Truck.Routes`)

### 7. `Routes` (`Route`)
- **Primary Key:** `RouteId` (`int`, Identity)
- **Fields:** `WardId` (`int`, required), `Algorithm` (`nvarchar(100)`, e.g. `"Held-Karp"`, `"NearestNeighbor"`), `TotalDistanceKm` (`float`), `NaiveDistanceKm` (`float`, nullable), `Status` (`nvarchar(50)`, default `"Planned"`), `TruckId` (`int`, nullable), `DriverId` (`nvarchar(450)`, nullable), `CreatedAt` (`datetime2`)
- **Relationships:**
  - `WardId` &rarr; Foreign Key to `Wards.WardId` (`ON DELETE RESTRICT`)
  - `TruckId` &rarr; Foreign Key to `Trucks.TruckId` (`ON DELETE SET NULL`)
  - `DriverId` &rarr; Foreign Key to `AspNetUsers.Id` (`ON DELETE SET NULL`)
  - Has many `RouteStops` (`Route.RouteStops`)

### 8. `RouteStops` (`RouteStop`)
- **Primary Key:** `RouteStopId` (`int`, Identity)
- **Fields:** `RouteId` (`int`, required), `BinId` (`int`, required), `StopSequence` (`int`), `CollectedAt` (`datetime2`, nullable)
- **Relationships:**
  - `RouteId` &rarr; Foreign Key to `Routes.RouteId` (`ON DELETE CASCADE`)
  - `BinId` &rarr; Foreign Key to `Bins.BinId` (`ON DELETE RESTRICT`)

---

## 5. Role-to-Feature Matrix

| Feature / Capability | Citizen | Driver | Ward Officer | City Admin |
| :--- | :---: | :---: | :---: | :---: |
| **User Registration & Login** | &#x2705; Real | &#x2705; Real | &#x2705; Real | &#x2705; Real |
| **Role-Guarded Workspace Shell** | &#x2705; Real | &#x2705; Real | &#x2705; Real | &#x2705; Real |
| **Overview Dashboard & Stats** | &#x2705; Real | &#x2705; Real | &#x2705; Real | &#x2705; Real |
| **Interactive Map with Dhaka GPS Coordinates** | &#x2705; Real | &#x2705; Real | &#x2705; Real | &#x2705; Real |
| **File Complaints Against Real Bins** | &#x2705; Real | &#x274C; *N/A* | &#x274C; *N/A* | &#x274C; *N/A* |
| **Track Own Complaints & Timeline History** | &#x2705; Real | &#x274C; *N/A* | &#x2705; Real | &#x2705; Real |
| **Triage & Update Complaint Status (with Notes)** | &#x274C; *No Permission* | &#x274C; *No Permission* | &#x2705; Real (Ward Scoped) | &#x2705; Real (All Wards) |
| **Generate TSP Routes (Held-Karp / Nearest Neighbor)**| &#x274C; *No Permission* | &#x274C; *No Permission* | &#x2705; Real (Ward Scoped) | &#x2705; Real (All Wards) |
| **Re-Optimize Existing Route Sequence** | &#x274C; *No Permission* | &#x2705; Real | &#x2705; Real | &#x2705; Real |
| **Execute Driver Workflow (Start &rarr; Collect &rarr; Complete)**| &#x274C; *No Permission* | &#x2705; Real | &#x274C; *No Permission* | &#x274C; *No Permission* |
| **Auto-Reset Bin Fill to 0% on Driver Collection** | &#x274C; *N/A* | &#x2705; Real | &#x274C; *N/A* | &#x274C; *N/A* |
| **Manage Waste Bins (Create, Edit Fill %, Delete)** | &#x274C; *No Permission* | &#x274C; *No Permission* | &#x2705; Partial (Edit Fill Only) | &#x2705; Full CRUD |
| **Manage Fleet Vehicles (Trucks)** | &#x274C; *No Permission* | &#x274C; *No Permission* | &#x2705; View Only | &#x2705; Full CRUD |
| **Photo Upload for Complaints** | &#x23F3; *Planned* | &#x274C; *N/A* | &#x274C; *N/A* | &#x274C; *N/A* |
| **Automated IoT Sensor Telemetry Stream** | &#x23F3; *Planned* | &#x23F3; *Planned* | &#x23F3; *Planned* | &#x23F3; *Planned* |
| **Multi-Truck CVRP Fleet Splitting** | &#x23F3; *Planned* | &#x23F3; *Planned* | &#x23F3; *Planned* | &#x23F3; *Planned* |

*Legend: &#x2705; Real (Functioning and backed by real database and backend API endpoints) | &#x23F3; Planned (Specified in design but not yet implemented in code) | &#x274C; N/A or No Permission (Disallowed by design or role-based security).*

---

## 6. Current Known Gaps

The following list represents the factual technical and operational gaps identified in the current codebase:

1. **Complaint Photo Attachment Storage:**
   - *Current State:* The citizen complaint form has input accommodation for visual evidence, but the backend `Complaint` entity only stores text fields (`Category`, `Description`).
   - *Gap:* There is currently no file upload middleware, local disk storage, or cloud bucket integration (e.g., Azure Blob Storage, AWS S3) to persist and serve photo attachments.

2. **Real-time IoT Sensor Ingestion Pipeline:**
   - *Current State:* Bin fill levels (`CurrentFillPercent`) are updated manually via `PUT /api/bins/{id}` or reset to 0% during driver route completion.
   - *Gap:* No background MQTT message broker, WebSocket stream, or scheduled IoT telemetry listener is actively running to push ultrasonic sensor readings from physical smart bins.

3. **Capacitated Vehicle Routing Problem (CVRP) Multi-Truck Splitting:**
   - *Current State:* `RouteOptimizerService` solves the Travelling Salesperson Problem (TSP) using Held-Karp dynamic programming or Nearest Neighbor for a single truck.
   - *Gap:* It does not partition a large ward with 40+ overflowing bins across multiple trucks simultaneously based on vehicle payload tonnage constraints (CVRP).

4. **Offline Driver Sync / Progressive Web App (PWA):**
   - *Current State:* The driver collection workflow (`PUT /api/routes/{id}/stops/{stopId}/collect`) depends on synchronous HTTP requests.
   - *Gap:* If a driver enters a cellular dead zone in Dhaka, stops cannot be recorded locally and queued in IndexedDB / Service Worker for later synchronization.

5. **Persistent Notification Entity:**
   - *Current State:* The notification popover in `HeaderActions.tsx` displays notifications derived from local state and heuristics.
   - *Gap:* There is no `Notifications` table in `ApplicationDbContext` or push notification provider (WebPush/FCM) to notify citizens when their complaint is marked `Resolved`.

6. **Email / SMS Notification Service:**
   - *Current State:* ASP.NET Core Identity manages password hashes and user authentication.
   - *Gap:* No SMTP email service or SMS gateway is configured for email confirmation, password resets, or citizen alert messages.

7. **Leftover Scaffolding in Repository Root:**
   - *Current State:* Legacy folders (`/client`, `/server`, `/shared`, `/database`) remain at the repo root.
   - *Gap:* While non-interfering, they create slight visual ambiguity for developers unfamiliar with the active `backend/SafaiTrack.Api` and `frontend/safai-track-client` structure.
