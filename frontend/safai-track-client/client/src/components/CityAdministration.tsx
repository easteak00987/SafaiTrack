import { useCallback, useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Link } from "react-router-dom";
import { Check, Clock, RefreshCw, Search, Send, Wallet } from "lucide-react";
import { apiClient, apiError } from "../lib/api-client";
import "./city-administration.css";

const money = (amount: number) =>
  `৳${amount.toLocaleString("en-BD", { maximumFractionDigits: 2 })}`;
const date = (value?: string | null) =>
  value
    ? new Date(
        /Z$|[+-]\d{2}:\d{2}$/.test(value) ? value : `${value}Z`
      ).toLocaleString("en-GB", { timeZone: "Asia/Dhaka" })
    : "—";
const labels: Record<string, string> = {
  ReadyForCollection: "Collection pending",
  Collected: "Driver collected",
  Accruing: "Work recorded",
  AwaitingApproval: "Awaiting confirmation",
  ReviewHold: "Review required",
  PendingApproval: "Awaiting approval",
};
function Badge({ value }: { value: string }) {
  return (
    <span className={`ca-badge ca-${value.toLowerCase()}`}>
      {labels[value] || value}
    </span>
  );
}

function useLive<T>(path: string) {
  const [data, setData] = useState<T[]>([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    try {
      const response = await apiClient.get<T[]>(path);
      setData(response.data);
      setError("");
    } catch (e) {
      setError(apiError(e));
    } finally {
      setLoading(false);
    }
  }, [path]);
  useEffect(() => {
    setLoading(true);
    void reload();
    const timer = setInterval(reload, 15000);
    return () => clearInterval(timer);
  }, [reload]);
  return { data, error, loading, reload };
}
function useAction(reload: () => Promise<unknown>) {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  const run = async (path: string, body?: unknown, post = false) => {
    if (busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const { data } = await (post
        ? apiClient.post(path, body)
        : apiClient.put(path, body));
      setMessage(data.message || "Review saved successfully.");
      await reload();
    } catch (e) {
      setError(apiError(e));
    } finally {
      setBusy(false);
    }
  };
  return { busy, message, error, run };
}
function Feedback({
  loading,
  error,
  message,
}: {
  loading?: boolean;
  error?: string;
  message?: string;
}) {
  return (
    <>
      {loading && <p role="status">Loading records…</p>}
      {error && (
        <p className="ws-error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="ca-success" role="status">
          <Check size={18} />
          {message}
        </p>
      )}
    </>
  );
}
function Intro({
  title,
  description,
  reload,
}: {
  title: string;
  description: string;
  reload: () => unknown;
}) {
  return (
    <div className="ca-intro">
      <div>
        <p className="ca-eyebrow">CITY SERVICES · LIVE RECORDS</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      <button className="ws-button" onClick={() => reload()}>
        <RefreshCw size={16} />
        Refresh
      </button>
    </div>
  );
}

type Bill = {
  invoiceId: number;
  invoiceNumber: string;
  billingPeriodStart: string;
  status: string;
  amount: number;
};
type Wage = {
  driverWageId: number;
  driverId: string;
  driverName?: string;
  phoneNumber?: string;
  periodStart: string;
  periodEnd: string;
  routesCompleted: number;
  binsCollected: number;
  requiredRoutes: number;
  requiredBins: number;
  baseAmount: number;
  perBinAmount: number;
  bonusAmount: number;
  amount: number;
  status: string;
  releasedAt?: string;
  collectedAt?: string;
  deferredAt?: string;
  eligible: boolean;
};
type Person = {
  id: string;
  fullName: string;
  email: string;
  phoneNumber?: string;
  gender?: string;
  status: string;
  wardName?: string;
  completedRoutes: number;
  collectedBins: number;
  complaintsFiled: number;
  complaintsHandled: number;
  wardResolved: number;
  wardPending: number;
  wardInProgress: number;
  assignments24h: number;
  optimizations24h: number;
  bills: Bill[];
  wages: Wage[];
};

export function PeopleDirectory({
  role,
}: {
  role: "Driver" | "WardOfficer" | "Citizen";
}) {
  const resource = useLive<Person>(`/api/city-admin/people/${role}`),
    [search, setSearch] = useState("");
  const reduced = useReducedMotion();
  const rows = resource.data.filter(p =>
    `${p.fullName} ${p.email} ${p.phoneNumber || ""} ${p.wardName || ""}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );
  const title =
    role === "Driver"
      ? "Truck drivers"
      : role === "WardOfficer"
        ? "Ward officers"
        : "Citizens";
  return (
    <section className="ca">
      <Intro
        title={title}
        description="Account details and service activity, connected to the city's records."
        reload={resource.reload}
      />
      <div className="ca-toolbar">
        <label className="ca-search">
          <Search size={18} />
          <input
            aria-label={`Search ${title}`}
            placeholder="Search name, mobile, email or ward"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </label>
        <span>{rows.length} accounts</span>
      </div>
      <Feedback loading={resource.loading} error={resource.error} />
      {role === "WardOfficer" && (
        <p className="ca-note">
          Handled counts identify the officer who recorded a resolution. Ward
          totals show current complaint states. Assignment and optimization
          counts cover the last 24 hours, from the new activity log onward.
        </p>
      )}
      <div className="ca-people">
        {rows.map((p, index) => (
          <motion.article
            className="ca-person"
            key={p.id}
            initial={reduced ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ y: -8, scale: 1.015 }}
            whileTap={{ scale: 0.98 }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1], delay: Math.min(index * 0.03, 0.2) }}
          >
            <div className="ca-person-top">
              <span className="ca-avatar">
                {p.fullName
                  .split(" ")
                  .slice(0, 2)
                  .map(n => n[0])
                  .join("")}
              </span>
              <div>
                <h2>{p.fullName}</h2>
                <p>
                  {p.wardName ||
                    (role === "Driver"
                      ? "City-wide pool"
                      : "Ward not assigned")}
                </p>
              </div>
              <Badge value={p.status} />
            </div>
            <dl className="ca-contact">
              <div>
                <dt>Mobile</dt>
                <dd>{p.phoneNumber || "Not provided"}</dd>
              </div>
              <div>
                <dt>Gender</dt>
                <dd>{p.gender || "Not provided"}</dd>
              </div>
              <div>
                <dt>Email</dt>
                <dd>{p.email}</dd>
              </div>
            </dl>
            {role === "Driver" && (
              <>
                <div className="ca-metrics">
                  <Metric label="Routes completed" value={p.completedRoutes} />
                  <Metric label="Bins cleared" value={p.collectedBins} />
                </div>
                <h3>Wage history</h3>
                {p.wages.length ? (
                  p.wages.map(w => (
                    <div className="ca-ledger-line" key={w.driverWageId}>
                      <div>
                        <strong>{money(w.amount)}</strong>
                        <small>
                          Bonus {money(w.bonusAmount)} · period ends{" "}
                          {date(w.periodEnd)}
                        </small>
                        <small>
                          {w.collectedAt
                            ? `Collected ${date(w.collectedAt)}`
                            : w.releasedAt
                              ? `Released ${date(w.releasedAt)}`
                              : "Awaiting release"}
                        </small>
                      </div>
                      <Badge value={w.status} />
                    </div>
                  ))
                ) : (
                  <p className="ca-note">No wage period recorded yet.</p>
                )}
                <Link className="ca-text-link" to="/admin/payments-wages">
                  Manage wages →
                </Link>
              </>
            )}
            {role === "WardOfficer" && (
              <>
                <div className="ca-metrics">
                  <Metric
                    label="Complaints handled"
                    value={p.complaintsHandled}
                  />
                  <Metric label="Assignments / 24h" value={p.assignments24h} />
                  <Metric
                    label="Optimizations / 24h"
                    value={p.optimizations24h}
                  />
                </div>
                <div className="ca-ward-counts">
                  <span>{p.wardResolved} resolved</span>
                  <span>{p.wardPending} pending</span>
                  <span>{p.wardInProgress} in progress</span>
                </div>
              </>
            )}
            {role === "Citizen" && (
              <>
                <div className="ca-metrics">
                  <Metric label="Complaints filed" value={p.complaintsFiled} />
                  <Metric
                    label="Paid bills"
                    value={p.bills.filter(b => b.status === "Paid").length}
                  />
                  <Metric
                    label="Unsettled bills"
                    value={
                      p.bills.filter(
                        b => !["Paid", "Cancelled"].includes(b.status)
                      ).length
                    }
                  />
                </div>
                <h3>Monthly bills</h3>
                {p.bills.length ? (
                  p.bills.map(b => (
                    <div className="ca-ledger-line" key={b.invoiceId}>
                      <div>
                        <strong>
                          {new Date(b.billingPeriodStart).toLocaleDateString(
                            "en-GB",
                            { month: "long", year: "numeric" }
                          )}{" "}
                          · {money(b.amount)}
                        </strong>
                        <small>{b.invoiceNumber}</small>
                      </div>
                      <Badge value={b.status} />
                    </div>
                  ))
                ) : (
                  <p className="ca-note">No invoices issued.</p>
                )}
              </>
            )}
          </motion.article>
        ))}
      </div>
      {!resource.loading && !rows.length && (
        <p className="ws-empty">No matching accounts.</p>
      )}
    </section>
  );
}
function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <strong>{value}</strong>
      <small>{label}</small>
    </div>
  );
}

type Draft = {
  billingDraftId: number;
  citizenName: string;
  phoneNumber: string;
  wardName: string;
  periodStart: string;
  amount: number;
};
export function PaymentsAndWages() {
  const drafts = useLive<Draft>("/api/city-admin/billing-drafts"),
    wages = useLive<Wage>("/api/city-admin/wages");
  const reload = async () => {
    await Promise.all([drafts.reload(), wages.reload()]);
  };
  const action = useAction(reload);
  return (
    <section className="ca">
      <Intro
        title="Payments & wages"
        description="Issue household bills. Review completed work. Release daily wages."
        reload={reload}
      />
      <div className="ca-summary">
        <Metric label="Bills ready to send" value={drafts.data.length} />
        <Metric
          label="Wages ready to release"
          value={wages.data.filter(w => w.eligible).length}
        />
        <Metric
          label="Awaiting driver collection"
          value={
            wages.data.filter(w => w.status === "ReadyForCollection").length
          }
        />
      </div>
      <Feedback
        loading={drafts.loading || wages.loading}
        error={drafts.error || wages.error || action.error}
        message={action.message}
      />
      <div className="ca-section-heading">
        <div>
          <h2>Citizen billing</h2>
          <p>
            Proposals are prepared automatically. Sending creates the invoice
            and notification together.
          </p>
        </div>
        <button
          className="ws-button"
          disabled={action.busy}
          onClick={() => action.run("/api/invoices/generate", {}, true)}
        >
          <RefreshCw size={16} />
          Check due bills
        </button>
      </div>
      <div className="ca-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Citizen</th>
              <th>Ward / period</th>
              <th>Amount</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {drafts.data.map(d => (
              <tr key={d.billingDraftId}>
                <td>
                  <strong>{d.citizenName}</strong>
                  <small>{d.phoneNumber}</small>
                </td>
                <td>
                  {d.wardName}
                  <small>
                    {new Date(d.periodStart).toLocaleDateString("en-GB", {
                      month: "long",
                      year: "numeric",
                    })}
                  </small>
                </td>
                <td>{money(d.amount)}</td>
                <td>
                  <button
                    className="ws-button primary"
                    disabled={action.busy}
                    onClick={() =>
                      action.run(
                        `/api/city-admin/billing-drafts/${d.billingDraftId}/send`,
                        {},
                        true
                      )
                    }
                  >
                    <Send size={15} />
                    Send bill
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!drafts.loading && !drafts.data.length && (
          <p className="ws-empty">No bills awaiting issue.</p>
        )}
      </div>
      <div className="ca-section-heading">
        <div>
          <h2>Driver wages</h2>
          <p>
            Each driver's 24-hour period starts with their first completed
            route. Release becomes available after that period closes and its
            quota is met.
          </p>
        </div>
      </div>
      <p className="ca-note">
        Project payroll policy, not an official municipal pay scale. Amounts
        include the recorded base, bin incentive and bonus. Release and
        collection are recorded here; this app does not transfer money to a bank
        or mobile wallet.
      </p>
      <div className="ca-wage-grid">
        {wages.data.map(w => (
          <WageCard
            key={w.driverWageId}
            wage={w}
            admin
            busy={action.busy}
            run={action.run}
          />
        ))}
      </div>
      {!wages.loading && !wages.data.length && (
        <p className="ws-empty">
          Completed routes will automatically create driver wage records.
        </p>
      )}
    </section>
  );
}

function WageCard({
  wage: w,
  admin = false,
  busy,
  run,
}: {
  wage: Wage;
  admin?: boolean;
  busy: boolean;
  run: (path: string) => unknown;
}) {
  const reduced = useReducedMotion(),
    quota =
      w.routesCompleted >= w.requiredRoutes &&
      w.binsCollected >= w.requiredBins;
  return (
    <motion.article
      className="ca-wage"
      initial={reduced ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -8, scale: 1.015 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="ca-person-top">
        <Wallet size={22} />
        <div>
          <h2>{admin ? w.driverName : "Daily collection wage"}</h2>
          <small>{admin ? w.phoneNumber : `Wage #${w.driverWageId}`}</small>
        </div>
        <Badge value={w.eligible ? "Ready to release" : w.status} />
      </div>
      <div className="ca-wage-amount">
        {money(w.amount)}
        <span>{w.status === "Accruing" ? "accrued" : "released"}</span>
      </div>
      <div className="ca-breakdown">
        <span>Base {money(w.baseAmount)}</span>
        <span>
          {w.binsCollected} bins × {money(w.perBinAmount)}
        </span>
        <span>Bonus {money(w.bonusAmount)}</span>
      </div>
      <div className="ca-progress">
        <span
          style={{
            width: `${Math.min(100, (w.binsCollected / w.requiredBins) * 100)}%`,
          }}
        />
      </div>
      <p className="ca-note">
        {w.routesCompleted}/{w.requiredRoutes} routes · {w.binsCollected}/
        {w.requiredBins} bins · {quota ? "Quota met" : "Below quota"}
      </p>
      <small className="ca-period">
        {date(w.periodStart)} → {date(w.periodEnd)} (Dhaka)
      </small>
      {w.collectedAt ? (
        <p className="ca-success">
          <Check size={18} />
          Collected {date(w.collectedAt)}
        </p>
      ) : w.releasedAt ? (
        <p className="ca-note">
          Released {date(w.releasedAt)} ·{" "}
          {w.deferredAt
            ? `Saved for later ${date(w.deferredAt)}`
            : "Driver collection pending"}
        </p>
      ) : (
        <p className="ca-note">
          {w.eligible
            ? "Ready for City Admin release."
            : quota
              ? "Waiting for the work period to close."
              : "Quota not met. Not payable automatically."}
        </p>
      )}
      {admin && w.eligible && (
        <button
          className="ws-button primary"
          disabled={busy}
          onClick={() => run(`/api/city-admin/wages/${w.driverWageId}/release`)}
        >
          <Wallet size={16} />
          Release wage
        </button>
      )}
      {!admin && w.status === "ReadyForCollection" && (
        <div className="ca-buttons">
          <motion.button
            whileHover={reduced ? {} : { y: -2 }}
            whileTap={{ scale: 0.98 }}
            className="ws-button primary"
            disabled={busy}
            onClick={() => run(`/api/wages/${w.driverWageId}/collect`)}
          >
            <Check size={16} />
            Collect wages now
          </motion.button>
          <button
            className="ws-button"
            disabled={busy}
            onClick={() => run(`/api/wages/${w.driverWageId}/defer`)}
          >
            <Clock size={16} />
            Collect later
          </button>
        </div>
      )}
    </motion.article>
  );
}
export function DriverWages() {
  const resource = useLive<Wage>("/api/wages"),
    action = useAction(resource.reload);
  return (
    <section className="ca">
      <Intro
        title="My wages"
        description="Your work, daily earnings and collection history in one place."
        reload={resource.reload}
      />
      <Feedback
        loading={resource.loading}
        error={resource.error || action.error}
        message={action.message}
      />
      <p className="ca-note">
        Collection records your acknowledgement of the wage issued by City
        Admin. It does not initiate a bank or mobile wallet transfer.
      </p>
      <div className="ca-wage-grid">
        {resource.data.map(w => (
          <WageCard
            key={w.driverWageId}
            wage={w}
            busy={action.busy}
            run={action.run}
          />
        ))}
      </div>
      {!resource.loading && !resource.data.length && (
        <p className="ws-empty">
          Your first completed route starts your daily wage period.
        </p>
      )}
    </section>
  );
}

type PaymentReview = {
  paymentId: number;
  citizenName: string;
  phoneNumber: string;
  amount: number;
  gateway: string;
  paymentMethod: string;
  transactionRef: string;
  invoiceNumber: string;
  reviewStatus: string;
  completedAt: string;
};
export function PaymentApprovals() {
  const resource = useLive<PaymentReview>("/api/city-admin/payment-approvals"),
    action = useAction(resource.reload);
  return (
    <section className="ca ca-approval-section">
      <Intro
        title="Payment approvals"
        description="Gateway verification is complete. Confirm the bill or hold it for review."
        reload={resource.reload}
      />
      <Feedback
        loading={resource.loading}
        error={resource.error || action.error}
        message={action.message}
      />
      <div className="ca-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Citizen / invoice</th>
              <th>Payment</th>
              <th>Status</th>
              <th>Review</th>
            </tr>
          </thead>
          <tbody>
            {resource.data.map(p => (
              <tr key={p.paymentId}>
                <td>
                  <strong>{p.citizenName}</strong>
                  <small>{p.phoneNumber}</small>
                  <small>{p.invoiceNumber}</small>
                </td>
                <td>
                  <strong>{money(p.amount)}</strong>
                  <small>
                    {p.gateway} · {p.paymentMethod}
                  </small>
                  <small>{p.transactionRef}</small>
                  <small>{date(p.completedAt)}</small>
                </td>
                <td>
                  <Badge value={p.reviewStatus} />
                </td>
                <td>
                  {["Pending", "Rejected"].includes(p.reviewStatus) && (
                    <div className="ca-buttons">
                      <button
                        className="ws-button primary"
                        disabled={action.busy}
                        onClick={() =>
                          action.run(
                            `/api/city-admin/payment-approvals/${p.paymentId}`,
                            { approve: true }
                          )
                        }
                      >
                        <Check size={15} />
                        Approve
                      </button>
                      {p.reviewStatus === "Pending" && (
                        <button
                          className="ws-button"
                          disabled={action.busy}
                          onClick={() =>
                            action.run(
                              `/api/city-admin/payment-approvals/${p.paymentId}`,
                              { approve: false }
                            )
                          }
                        >
                          Decline confirmation
                        </button>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!resource.loading && !resource.data.length && (
          <p className="ws-empty">No payments awaiting review.</p>
        )}
      </div>
      <p className="ca-note">
        Declining confirmation puts the bill on hold. It does not reverse a
        gateway payment or issue a refund, and the citizen cannot accidentally
        pay the same bill again.
      </p>
    </section>
  );
}
