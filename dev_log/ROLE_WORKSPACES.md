# Role Workspaces and Collection Workflow

Implemented 19 September 2026 after reviewing the project proposal and the reported shared-dashboard, authentication, and route failures.

## Access Model

| Role | Workspace and permitted actions |
| --- | --- |
| Citizen | Personal overview, file a complaint against a bin, view only their own complaints, status history, and officer replies. No fleet or route access. |
| Driver | Own assigned routes, service-area priority-bin count, optimize assigned stops before starting, start collection, log the next stop, complete after all stops. No dispatch or complaint access. |
| Ward Officer | Own ward's complaints and bin data, reply and progress complaints, update bin fill, select a ward driver and available truck, generate and assign routes, monitor collection. Fleet is shared dispatch inventory; officers cannot create or maintain trucks. |
| Admin | All ward operations and dispatch, plus fleet registration and maintenance. Public registration never grants a staff role. |

The proposal places dispatch with municipal staff. The user's requested extension lets ward officers dispatch within their own ward and drivers optimize their assigned work. Drivers cannot take another driver's route or independently change their assigned workload.

## Authentication and Navigation

- Login uses entered credentials and the server-returned role. Demo profiles, role selectors, default passwords, and URL-driven identity changes were removed from the active application.
- Workspace pages require authentication and role authorization even when entered directly. The API additionally checks complaint ownership, officer ward, and driver assignment.
- Sign out clears the in-memory session. Browser Back and landing-page entry cannot restore it. Sessions are intentionally not remembered across reloads. Expired or rejected tokens return to login.
- The original landing page remains; `Workspace.tsx` owns authenticated pages. The old demo workspaces were removed from `App.tsx`.

## Connected Workflow

1. A citizen files a complaint. Their overview and complaint detail load database records.
2. The officer sees complaints from their assigned ward and adds an attributed reply or progresses Pending -> InProgress -> Resolved. Updates are stored separately and visible to the complainant.
3. The officer selects a ward, ward-assigned driver, truck, and ordering algorithm. Generation includes bins above 60% fill or with open complaints, excluding bins already reserved by assigned unfinished routes.
4. Driver/truck reservation and lifecycle changes use serializable database transactions. Duplicate dispatch is rejected. Existing unassigned demo drafts remain visible to staff and do not reserve work.
5. The driver sees only assigned routes, can optimize while Planned, starts the route, collects stops in sequence, and completes only after all stops. Collection resets the bin fill; completion makes the truck available again.
6. Complaint resolution remains an officer decision, including for issues such as damage that collection alone does not resolve.

## Maps and Metrics

- Leaflet displays OpenStreetMap tiles, actual stored bin coordinates, depot, numbered collection stops, and collected state.
- OSRM road geometry connects the chosen stops; Directions opens navigation for the next stop. Road-service failure explicitly falls back to a dashed stop-order line, not claimed road directions.
- The existing Ward 08 depot and Haversine/Held-Karp ordering are retained. The `dijkstra` API value remains compatible with the handover. Exact ordering falls back to nearest neighbor above 14 bins to bound computation.
- This is a course-project collection planner, not live truck GPS tracking or a truck-restriction-aware navigation service. Stop ordering minimizes geographic distance; displayed road distance is separate. Multi-depot configuration remains future work.
- Priority counts and daily collection coverage use records. New routes store a naive-distance baseline for estimated savings; legacy routes without one are not assigned fabricated savings. Timestamps are interpreted as UTC and displayed in Dhaka time.

## Files and Database

- Frontend: `client/src/Workspace.tsx`, `components/CollectionMap.tsx`, `workspace.css`, `contexts/AuthContext.tsx`, `lib/api-client.ts`, under `frontend/safai-track-client`.
- Backend: scoped controllers plus `WorkspaceController`, `ComplaintUpdate`, user WardId, and route NaiveDistanceKm.
- Applied migrations: `20260919004748_RoleWorkspacesAndComplaintUpdates` and `20260919005900_RouteDistanceBaseline`.
- Known seeded ward officer and driver accounts are assigned to the existing Ward 08 row. Unassigned staff accounts receive no ward access; other wards/users are not inferred from names.
- Vite proxies `/api` to `http://localhost:5281`. Production hosting must similarly proxy `/api`, or supply `VITE_API_BASE_URL` with appropriate API CORS configuration.
- Prepared real Ward 08 route #14 for `driver01@safaitrack.local` (Karim Driver), truck `DHK-METRO-TA-1234`, with 11 stops. It remains Planned; no existing bins were marked collected and no existing complaints were resolved.

## Verification

Run the backend on 5281 and frontend on 3000, then from `frontend/safai-track-client`:

```text
pnpm check
pnpm build
node tests/workspaces.mjs
```

The integration test uses SQL Server Express, `sqlcmd`, the seeded admin login, and headless Microsoft Edge through Playwright. It creates uniquely named temporary accounts, ward, bins, truck, complaints, and route, and cleans only those records in `finally`.

Verified 49 API assertions plus browser workflows for all four roles, citizen isolation, cross-ward denial, driver assignment enforcement, invalid state transitions, logout and Back, citizen submission, officer reply, dispatch, collection, fleet maintenance, API failure and Retry, rejected-session logout, and road-service fallback. Desktop/mobile screenshots and no-overflow checks are produced in ignored `test-results/`. No pre-existing complaints, routes, trucks, or bin readings are changed by the tests.

Remaining proposal features outside this repair include photo attachments, push notifications, automated sensor history, staff provisioning UI, and broader ward/category administration. The workspace does not expose fake controls for these features.
