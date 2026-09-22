# City Admin implementation and verification

Implemented in the existing SafaiTrack workspace, preserving the current teal/lime theme and existing operational pages. The starting revision was `25970a0`, which already included the teammate's billing, multi-ward staff, hybrid database and routing changes. The main implementation was subsequently committed as `3b0c615` while this task was running; that commit was preserved.

## Entry and account approval

- Landing page's **City Admin** button opens `/city-admin/login`. The existing seeded Admin credentials still work there. Public sign-in no longer offers City Admin; its API also directs Admin accounts to the separate entrance.
- Public registration permits only Citizen, Driver and WardOfficer. All start `PendingApproval`, receive no token and cannot sign in before approval.
- Approvals show name, email, mobile, gender and ward details. Citizens and officers need an assigned ward. Declined applications remain recorded as `Rejected` and cannot sign in.
- Directories display contact/account information, never passwords or password hashes.

## Directories and real activity

- `/admin/drivers`: contact information, completed-route and collected-stop counts, wage/bonus history and collection status.
- `/admin/officers`: contact/ward information, distinct complaints personally recorded as resolved, current ward complaint counts and assignment/optimization actions during the last rolling 24 hours.
- `/admin/citizens`: contact information, complaints filed and monthly invoice/payment states.
- Existing historical completed routes contribute to totals. Historical officer actions without an actor record are not invented. New assignments and optimizations create `RouteActivities` in the same transaction as the route change. Automated dispatch is not attributed to an officer.

## Billing and confirmation

The existing hourly billing background service now prepares `BillingDrafts` for active citizens. A proposal is not an invoice and does not appear as a bill to the citizen. **Send bill** atomically creates an invoice, records the sender/time and creates a notification linking to `/billing`. The citizen/month constraint and repeated-send guard prevent duplicate bills. Existing invoices remain intact.

The existing SSLCommerz/simulated checkout remains in place. Successful gateway validation records `Payment.Status = Success`, `ReviewStatus = Pending` and `Invoice.Status = AwaitingApproval`. The UI displays **Payment successful, wait for City Admin confirmation**. Another checkout is blocked once a successful payment exists.

City Admin approves the payment to settle the invoice as `Paid`, or declines confirmation to put it on `ReviewHold`. The gateway's success record is retained. A declined confirmation does **not** pretend to refund money and does not ask the citizen to pay a second time. City Admin can subsequently approve a held payment after reconciliation. Late duplicate successful payments are retained as `Duplicate` for reconciliation without reopening a settled invoice.

## Driver wages

The first newly completed route starts that driver's own 24-hour period. Every route completed during the period contributes once to `DriverWages` through `WageContributions`, which has a unique RouteId. Route completion also saves `Routes.CompletedAt`.

Default, configurable project policy under `Payroll`:

| Setting | Default |
|---|---:|
| RequiredRoutes | 1 |
| RequiredBins | 6 |
| BaseAmount | ৳800 |
| PerBinAmount | ৳50 |
| BonusRate | 0.20 |

This is a project policy, not a claimed official Dhaka wage scale. The 20% bonus applies to base plus bin incentives when the bin quota is reached. The daily base is paid once per period. Release becomes available after the 24-hour period closes and both quota requirements are met, ensuring later work in that day is included. Below-quota periods remain visible and are not automatically payable.

**Release wage** records the Admin, amount and release time, then sends a notification linking to `/driver/wages`. **Collect later** saves a defer timestamp without losing eligibility. **Collect wages now** saves collection atomically and updates the Admin ledger. Repeated release/collection does not duplicate either entitlement or its notification.

Wage release and collection are real database records/acknowledgements. There is currently no bank or mobile-wallet payout integration, so these actions do not transfer external money. The screens state this explicitly.

## Database and preservation

- New PostgreSQL EF migration: `Migrations/*_CityAdministration.cs`; existing migration files were not rewritten.
- The current PostgreSQL snapshot was missing several fields already present in application models. The additive migration includes those fields and preserves existing users as Active when introducing Status.
- Existing SQL Server databases use the embedded, idempotent `Data/CityAdministration.SqlServer.sql` upgrade. It adds only the requested new tables/columns; no existing data is deleted or reset.
- A COPY_ONLY, CHECKSUM backup of the working database was taken before upgrade: `C:\Program Files\Microsoft SQL Server\MSSQL16.SQLEXPRESS\MSSQL\Backup\SafaiTrack-before-city-admin-20260922.bak`.
- Test data is isolated in `SafaiTrackCityAdminChecks`, restored from that backup. Test fixtures do not populate the working database.

## Verification evidence

`artifacts/city-admin-e2e.json` records actual HTTP responses and database checks. Scenarios cover registration gates for all three roles, role separation, retained rejection, proposal/send idempotency, payment confirmation/hold, real complaint and route counts, per-driver wage accrual, one base per day, release/defer/collect and citizen invoice state.

`artifacts/city-admin-ui-checks.json` records browser checks against that real isolated API, including desktop/mobile pages, absence of public Admin login, notification navigation, refresh persistence, browser bill issuance, simulated checkout, Admin confirmation and wage collection. Screenshots are saved alongside both reports. No API responses were mocked.

Only isolated wage fixture timestamps were shifted to exercise a closed 24-hour period without waiting a day. The report labels this explicitly. Route completion, accrual, release, collection and payment actions use the actual endpoints.

Checks: .NET build, TypeScript checking, Vite production build, API/SQL integration tests and headless Edge browser tests. PostgreSQL migration execution and live SSLCommerz transactions were not tested; the local configuration uses the simulated gateway. Vite reports its existing large-bundle warning.

An existing fresh-install issue was found while preparing the isolated database: `DbSeeder` uses `Password123` while Identity requires a special character, ignores the failed creation and then attempts role assignment. The working database's existing accounts are usable. That unrelated seeder was left unchanged; verification used a copy of the existing database. A deployment onto an empty database needs this pre-existing issue addressed.

To repeat integration checks, run the API on port 5283 against **only** `SafaiTrackCityAdminChecks`, then run `python tools/city-admin-e2e.py`. With the frontend running on port 3000, run `node city-admin-ui-check.mjs` from `frontend/safai-track-client`. Run the API test first each time because it prepares fresh browser fixtures. Test account passwords and JWTs are not written into evidence reports.
