# SafaiTrack

### A Smart Waste Collection & Route Optimization System for Dhaka Neighborhoods

SafaiTrack digitizes ward-level solid-waste collection in Dhaka — replacing fixed, condition-blind truck schedules and informal, untracked citizen complaints with a simulated-sensor-driven bin monitoring system, an algorithmic route optimizer, and a structured, trackable complaint channel.

Built on **ASP.NET Core (C#)**, **SQL Server**, and **React + TypeScript**, as a course project for CSE 3200 (Software Development V), aligned with **UN SDG 11** (Sustainable Cities and Communities) and **SDG 12** (Responsible Consumption and Production).

---

## Table of Contents

- [Problem Statement](#problem-statement)
- [Key Features](#key-features)
- [User Roles](#user-roles)
- [Technology Stack](#technology-stack)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Development Roadmap](#development-roadmap)
- [Team](#team)
- [Academic Project](#academic-project)
- [License](#license)

---

## Problem Statement

Waste collection across residential wards in Dhaka remains largely manual and reactive. Municipal trucks follow fixed schedules regardless of how full a bin actually is — resulting in bins that overflow for days, and trucks that visit bins that are still nearly empty, wasting fuel and staff time. Residents have no formal channel to report an overflowing bin or missed collection; complaints, when made at all, travel informally through phone calls or word of mouth and are rarely logged or resolved on record.

SafaiTrack addresses this by giving citizens a structured way to report bin status and complaints, and by giving municipal staff a data-driven, optimized route to follow — rather than a fixed schedule that ignores real conditions on the ground.

Since large-scale IoT bin sensors are outside the budget and hardware scope of this project, bin-fill status is captured through a **simulated sensor model** plus optional citizen reporting — architecturally identical to what a real ultrasonic-sensor feed would produce, so the system can be upgraded to real IoT input later without a redesign.

---

## Key Features

| Feature | Description |
|---|---|
| **Registration & Role-Based Login** | Citizens, Municipal Staff, Truck Drivers, and Ward Officers each register and authenticate with role-scoped access. |
| **Bin Status Reporting** | Automated "Simulate Bin Fill Data" process plus optional citizen-reported fill level, timestamped per bin. |
| **Citizen Complaint Portal** | Residents file complaints against a specific bin (overflow, missed collection, damage) with description and optional photo. |
| **Complaint Tracking & Notifications** | Citizens track live complaint status (Pending → In Progress → Resolved) and receive status-change notifications. |
| **Dynamic Route Generation** | Route optimization engine (Dijkstra / greedy nearest-neighbor) generates the most efficient truck route per ward from current bin fill levels and location. |
| **Truck & Driver Assignment** | Admins assign an available truck and driver to a generated route and log truck maintenance. |
| **Route Execution & Collection Logging** | Drivers view their assigned route, start/end it, and log each bin as collected in real time. |
| **Ward Officer Complaint Handling** | Ward officers view and update the status of complaints assigned within their ward. |
| **Admin Analytics Dashboard** | Visual summary of bin fill trends, complaint volume by ward, average resolution time, and route efficiency over time. |

---

## User Roles

- **Citizen** — reports bin fill levels, files complaints, tracks status, receives notifications
- **Municipal Staff (Admin)** — generates optimized routes, assigns trucks/drivers, manages bins/wards/categories, views analytics
- **Truck Driver** — views assigned route, starts/ends it, logs bin collections
- **Ward Officer** — views and resolves complaints assigned to their ward
- **System (Automated)** — drives the simulated bin-fill data feed

---

## Technology Stack

> **Note — deviates from proposal:** the original project proposal specified Razor Views with Bootstrap for the frontend. The team switched to a decoupled React + TypeScript SPA with Tailwind CSS + shadcn/ui instead, since it gives a more distinctive, professional, portfolio-worthy UI than server-rendered Razor/Bootstrap and better supports the "real-world engineering" goal of the course. This is a deliberate, documented architecture change — not an unplanned drift from the approved proposal.

| Layer | Technology |
|---|---|
| **Backend** | ASP.NET Core (C#) Web API |
| **Database** | Microsoft SQL Server, Entity Framework Core (Database-First, 3NF, 18 entities) |
| **Frontend** | React + TypeScript + Vite |
| **Styling** | Tailwind CSS v4 + shadcn/ui (Radix primitives) |
| **Animation** | Motion |
| **UI Components** | Watermelon UI, Motion Primitives |
| **Icons** | lucide-react |
| **Authentication** | ASP.NET Core Identity with JWT (access + refresh tokens) |
| **Route Optimization** | Custom C# implementation of Dijkstra's algorithm / greedy nearest-neighbor heuristic |
| **Version Control** | Git & GitHub |

---

## Architecture

The system is organized into three cooperating layers:

- **Presentation Layer** — citizen-facing bin status reporting and complaint filing; admin-facing bin/ward/category management, route generation, and analytics; driver-facing route execution; ward-officer complaint handling.
- **Application/Logic Layer** — route optimization logic, complaint-status workflow with a full audit trail, and simulated bin-fill data generation, exposed through a RESTful Web API.
- **Data Layer** — SQL Server database implementing an 18-entity, third-normal-form (3NF) schema covering Identity (User supertype with Citizen / Municipal Staff / Truck Driver / Ward Officer subtypes), City/Bin/Sensor data, Fleet/Routing/Collection, and Complaints/Alerts.

---

## Project Structure

```
SafaiTrack/
├── frontend/
│   └── safai-track-client/       # React + TypeScript + Vite
├── backend/
│   ├── SafaiTrack.Api/            # Controllers, Middleware, Program.cs
│   ├── SafaiTrack.Application/    # Services, DTOs, Business Logic
│   ├── SafaiTrack.Domain/         # Entities, Interfaces
│   ├── SafaiTrack.Infrastructure/ # DB Context, Repositories
│   └── SafaiTrack.Shared/         # Common Utilities
└── database/
    └── schema.sql                 # Database scripts
```

---

## Getting Started

### Prerequisites

| Tool | Version | Notes |
|---|---|---|
| **.NET SDK** | 8/9+ | `dotnet --version` to check |
| **SQL Server** | Express or Developer | Local instance (e.g. `.\SQLEXPRESS`) |
| **Node.js** | v20+ | `node --version` to check |
| **Git** | Any | For cloning the repository |

### Clone the Repository

```bash
git clone https://github.com/easteak00987/SafaiTrack.git
cd SafaiTrack
```

### Frontend Setup

```bash
cd frontend/safai-track-client
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

### Backend Setup

> Backend setup instructions will be added once the API foundation (Milestone 1 backend) is complete.

```bash
cd backend/SafaiTrack.Api
dotnet restore
dotnet run
```

Swagger UI will be available at `http://localhost:5000/swagger` (or your configured port).

### Environment Variables and Secrets

JWT signing keys and connection strings are **never committed to source control**. Use `dotnet user-secrets` locally for the backend, and a `.env` file (excluded via `.gitignore`) for any frontend secrets.

---

## Development Roadmap

See [`OVERALL_PLAN.md`](./OVERALL_PLAN.md) for the full milestone breakdown, and [`WORK_DONE.md`](./WORK_DONE.md) for a running log of completed work.

---

## Team

| Team Member | Student ID | Primary Role |
|---|---|---|
| **Easteak Ahmed** | 20230104123 | Frontend + Little Backend — UI Design, Landing Page, Complaint Portal, Bin Monitoring Frontend, Fleet Frontend |
| **Fairuz Anadi** | 20230104121 | Backend — APIs, Database, Authentication, Route Optimization, Admin Backend |
| **Saleh Mahmud Sami** | 20220204061 | Little Frontend — Authentication Pages, Admin Dashboard Frontend, Analytics Charts |

---

## Academic Project

SafaiTrack is developed as an undergraduate course project for **CSE 3200 — Software Development V**, Department of Computer Science and Engineering, Ahsanullah University of Science and Technology (AUST).

**Course Instructors:** Ms. Tanjila Broti, Mr. Md Hasan Al Kayem
**Lab Section:** C1 · **Group No:** 05

---

## License

All rights reserved — academic project.
