# Billing and Payments

Monthly waste-collection service fees, charged per household and settled through a
payment gateway. Added on top of the existing ward / bin / complaint model.

## What it does

A household attached to a ward is billed a monthly collection fee. The citizen sees
the invoice in their workspace, pays it through a hosted checkout, and staff see how
much of each ward's billed revenue has actually been recovered.

| Concern | Where it lives |
|---|---|
| The charge raised against a household | `Models/Invoice.cs` |
| One attempt to settle a charge | `Models/Payment.cs` |
| Gateway abstraction | `Services/IPaymentGateway.cs` |
| SSLCommerz implementation | `Services/SslCommerzPaymentGateway.cs` |
| Offline stand-in | `Services/SimulatedPaymentGateway.cs` |
| Monthly billing pass | `Services/InvoiceGenerationService.cs` |
| Fee policy | `Services/BillingOptions.cs` |
| Invoice + revenue endpoints | `Controllers/InvoicesController.cs` |
| Payment + callback endpoints | `Controllers/PaymentsController.cs` |
| Citizen and staff UI | `Workspace.tsx` → `CitizenBilling`, `RevenueOverview` |

## Why SSLCommerz

SSLCommerz aggregates bKash, Nagad, Rocket and card rails behind one merchant
account, so one integration covers the instruments a Dhaka household actually uses.
Integrating each wallet separately would mean four merchant onboardings for the same
result.

The gateway sits behind `IPaymentGateway`. Nothing in the billing code knows which
implementation is running, so the sandbox can be swapped for a live merchant account,
or for a different aggregator, without touching the invoice or payment logic.

## Why there is a simulated gateway

`SimulatedPaymentGateway` is selected automatically when no merchant credentials are
configured. It implements the same two-phase contract — open a session, redirect,
validate the callback server-side — and serves its own checkout page at
`/api/payments/simulated-checkout`, where a tester picks an instrument and approves,
fails, or cancels.

This is the same reasoning the project already applies to bin sensors: model the real
feed faithfully so the real one drops in without a redesign. It also means a fresh
clone runs the complete billing flow with no accounts, no keys, and no internet.

## Payment flow

1. Citizen presses **Pay now** → `POST /api/payments/initiate`.
2. A `Payment` row is created with our own transaction reference, and the invoice
   moves to `Processing`. Any earlier open attempt on that invoice is cancelled, so
   one invoice has at most one live checkout session.
3. The gateway opens a session and returns a checkout URL; the browser is sent there.
4. The gateway returns the citizen to `/api/payments/callback/{success|fail|cancel}`
   and, independently, notifies `/api/payments/ipn` server-to-server.
5. **The callback is not trusted.** `SettleAsync` re-asks the gateway what happened
   via `ValidateAsync` before anything is marked paid. Only then does the invoice
   become `Paid` and a notification get raised.
6. The citizen is redirected to `/billing?payment=…`, which shows the outcome.

### What the validation step checks

`SslCommerzPaymentGateway.ValidateAsync` rejects the transaction unless all hold:

- the gateway reports status `VALID` or `VALIDATED`;
- the returned `tran_id` matches the reference we opened the session with — otherwise
  a valid `val_id` from an unrelated payment could be replayed against this invoice;
- the settled amount is at least the invoice amount and the currency matches —
  otherwise a tampered redirect could claim a smaller settlement than billed.

### Why it is safe to be called twice

The browser redirect and the IPN commonly both arrive. `SettleAsync` returns early
when the payment is already `Success`, and `MarkUnsuccessfulAsync` never walks back a
payment the gateway already confirmed. Both run in a `Serializable` transaction, the
same isolation level `RoutesController` uses for dispatch.

Failed and cancelled attempts are kept rather than deleted, so the ledger shows every
attempt against an invoice.

## Configuration

Non-secret defaults are in `appsettings.json`:

```json
"Billing": {
  "MonthlyFee": 150,
  "Currency": "BDT",
  "DueAfterDays": 14,
  "GenerationIntervalHours": 1
},
"SslCommerz": {
  "UseSandbox": true,
  "ApiBaseUrl": "http://localhost:5281",
  "ClientBaseUrl": "http://localhost:3000"
}
```

`StoreId` and `StorePassword` are secrets and must never be committed. Register for a
sandbox account at <https://developer.sslcommerz.com/>, then:

```bash
cd backend/SafaiTrack.Api
dotnet user-secrets init
dotnet user-secrets set "SslCommerz:StoreId" "<your sandbox store id>"
dotnet user-secrets set "SslCommerz:StorePassword" "<your sandbox store password>"
```

The API logs which gateway it selected on startup. With no credentials it says the
simulated gateway is in use; with credentials it names the SSLCommerz sandbox.

> The gateway calls `ApiBaseUrl` back over the public internet. `localhost` works for
> the browser redirect but the IPN will not reach a local machine — expose the API
> with a tunnel (ngrok or similar) and set `ApiBaseUrl` to that URL when testing IPN
> against the real sandbox.

## Endpoints

| Method | Route | Roles | Purpose |
|---|---|---|---|
| GET | `/api/invoices` | Citizen, Admin, WardOfficer | Own invoices; ward's for staff. Optional `?status=` |
| GET | `/api/invoices/{id}` | Citizen, Admin, WardOfficer | One invoice, scoped to the caller |
| GET | `/api/invoices/summary` | Admin, WardOfficer | Revenue and collection rate per ward |
| POST | `/api/invoices/generate` | Admin | Run the billing pass now |
| GET | `/api/payments` | Citizen, Admin, WardOfficer | Payment attempt history |
| POST | `/api/payments/initiate` | Citizen | Open a checkout session |
| GET/POST | `/api/payments/callback/{success\|fail\|cancel}` | Anonymous | Gateway browser redirect |
| POST | `/api/payments/ipn` | Anonymous | Gateway server-to-server notification |

The callback and IPN routes are anonymous because the gateway calls them, not a
signed-in user. They are safe to expose because they carry no authority of their own —
each one re-validates against the gateway before changing any record.

## Billing pass

`InvoiceGenerationService` runs at startup and then hourly. It bills every citizen
with a ward for the current calendar month, skipping anyone already billed for that
period, and raises a notification per invoice. A unique index on
`(CitizenId, BillingPeriodStart)` enforces one fee per household per month at the
database level, so a concurrent run cannot double-bill.

Admins can trigger the same pass from the UI with **Run billing** rather than waiting
for the timer.

## Change to registration

`ApplicationUser.WardId` was never populated anywhere before this work — registration
did not capture it. A collection fee is a ward service charge, so billing needs it.
`RegisterDto` now accepts an optional `WardId`, validated against existing wards.

Accounts registered before this change have no ward and will not be billed until one
is assigned.

## Database

Migration `AddBillingAndPayments` adds:

- **Invoices** — unique `InvoiceNumber`, unique `(CitizenId, BillingPeriodStart)`,
  index on `(WardId, Status)`, `decimal(18,2)` amounts, `Restrict` on both FKs.
- **Payments** — unique `TransactionRef` (the gateway echoes it on every callback, so
  it must resolve to exactly one attempt), cascade from `Invoices`, `Restrict` to the
  citizen.
