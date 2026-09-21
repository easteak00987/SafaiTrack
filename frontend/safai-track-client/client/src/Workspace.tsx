import { PeopleDirectory, PaymentsAndWages, PaymentApprovals, DriverWages } from "./components/CityAdministration";
import React, { useCallback, useEffect, useState, useRef } from "react";
import {
  Link,
  Navigate,
  NavLink,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";
import {
  Banknote,
  Camera,
  Check,
  CircleAlert,
  ClipboardList,
  CreditCard,
  LayoutDashboard,
  LogOut,
  MapPin,
  Maximize2,
  Navigation,
  Plus,
  RefreshCw,
  Shield,
  Truck,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { useAuth } from "./contexts/AuthContext";
import { apiClient, apiError } from "./lib/api-client";
import CollectionMap, { type MapStop } from "./components/CollectionMap";
import { NotificationAction } from "./components/HeaderActions";
import Login from "./components/AuthPage";
import "./workspace.css";

type Bin = MapStop & { wardId: number; wardName: string };
type Complaint = {
  complaintId: number;
  binId: number;
  binName: string;
  wardId?: number;
  wardName?: string;
  citizenName: string;
  category: string;
  description: string;
  photoUrl?: string | null;
  status: string;
  createdAt: string;
};
type Stop = MapStop & { routeStopId: number };
type CollectionRoute = {
  routeId: number;
  wardId: number;
  wardName: string;
  driverName: string;
  driverId: string;
  truckPlate: string;
  status: string;
  totalDistanceKm: number;
  distanceAvoidedKm: number | null;
  stops: Stop[];
  collectedStopsCount: number;
  stopsCount: number;
};
type Ward = { wardId: number; name: string };
type Vehicle = { truckId: number; plateNumber: string; status: string };
type Driver = { id: string; fullName: string; email?: string; wardId: number; isBusy?: boolean };
type Invoice = {
  invoiceId: number;
  invoiceNumber: string;
  citizenName: string | null;
  wardId: number;
  wardName: string | null;
  billingPeriodStart: string;
  billingPeriodEnd: string;
  amount: number;
  currency: string;
  issuedAt: string;
  dueAt: string;
  status: string;
  isOverdue: boolean;
  paidAt: string | null;
};
type PaymentRecord = {
  reviewStatus?: string | null;
  paymentId: number;
  invoiceId: number;
  invoiceNumber: string | null;
  transactionRef: string;
  gateway: string;
  amount: number;
  currency: string;
  status: string;
  paymentMethod: string | null;
  gatewayTransactionId: string | null;
  failureReason: string | null;
  initiatedAt: string;
  completedAt: string | null;
};
type WardCollection = {
  wardId: number;
  wardName: string;
  totalInvoices: number;
  paidInvoices: number;
  overdueInvoices: number;
  amountBilled: number;
  amountCollected: number;
  amountOutstanding: number;
  collectionRate: number;
};
type BillingSummary = {
  amountBilled: number;
  amountCollected: number;
  amountOutstanding: number;
  totalInvoices: number;
  paidInvoices: number;
  overdueInvoices: number;
  collectionRate: number;
  currency: string;
  wards: WardCollection[];
};
const roleNames: Record<string, string> = {
  Citizen: "Citizen",
  Driver: "Truck Driver",
  WardOfficer: "Ward Officer",
  Admin: "City Admin",
};
const home = (role?: string) =>
  role === "Citizen"
    ? "/citizen/dashboard"
    : role === "Driver"
      ? "/driver/dashboard"
      : role === "WardOfficer"
        ? "/officer/dashboard"
        : "/admin/dashboard";
const utcDate = (date: string) =>
  new Date(/(?:Z|[+-]\d{2}:\d{2})$/i.test(date) ? date : `${date}Z`);
const when = (date: string) =>
  utcDate(date).toLocaleString("en-GB", { timeZone: "Asia/Dhaka" });
const day = (date: string) =>
  utcDate(date).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Dhaka",
  });
const billingPeriod = (date: string) =>
  utcDate(date).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "Asia/Dhaka",
  });
const money = (amount: number, currency = "BDT") =>
  `${currency === "BDT" ? "৳" : `${currency} `}${amount.toLocaleString("en-GB", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
function Status({ value }: { value: string }) {
  return (
    <span className={`ws-status ${value.toLowerCase()}`}>
      {value === "AwaitingApproval" ? "Awaiting confirmation" : value === "ReviewHold" ? "Review required" : value === "InProgress" ? "In progress" : value === "AwaitingAcceptance" ? "Awaiting acceptance" : value}
    </span>
  );
}
function ErrorBox({ message, retry }: { message: string; retry?: () => void }) {
  return message ? (
    <div className="ws-error" role="alert">
      {message}
      {retry && (
        <button onClick={retry}>
          <RefreshCw size={15} /> Retry
        </button>
      )}
    </div>
  ) : null;
}
function useData<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    if (!path) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const sep = path.includes("?") ? "&" : "?";
      const res = await apiClient.get<T>(`${path}${sep}_t=${Date.now()}`);
      setData(res.data);
    } catch (e) {
      setError(apiError(e));
    } finally {
      setLoading(false);
    }
  }, [path]);
  useEffect(() => {
    void reload();
  }, [reload]);
  return { data, error, loading, reload };
}
function Guard({ roles }: { roles?: string[] }) {
  const { user, isAuthenticated, initializing } = useAuth();
  if (initializing) return <p role="status">Restoring session...</p>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user!.role))
    return <Navigate to={home(user!.role)} replace />;
  return <Outlet />;
}
function Shell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const staff = user?.role === "Admin" || user?.role === "WardOfficer";
  const links = [
    { to: home(user?.role), label: "Overview", icon: LayoutDashboard },
    ...(user?.role === "Citizen"
      ? [
          {
            to: "/citizen/complaints",
            label: "My complaints",
            icon: ClipboardList,
          },
          { to: "/citizen/report", label: "Report an issue", icon: Plus },
          { to: "/billing", label: "Billing", icon: Wallet },
        ]
      : []),
    ...(user?.role === "Driver"
      ? [{ to: "/driver/route", label: "My routes", icon: Navigation }, { to: "/driver/wages", label: "My wages", icon: Wallet }]
      : []),
    ...(staff
      ? [
          {
            to: "/operations/complaints",
            label: "Complaints",
            icon: ClipboardList,
          },
          { to: "/operations/bins", label: "Bins", icon: MapPin },
          {
            to: "/operations/routes",
            label: "Dispatch & routes",
            icon: Navigation,
          },
          { to: "/operations/fleet", label: "Fleet", icon: Truck },
          { to: "/billing", label: "Revenue", icon: Wallet },
        ]
      : []),
    ...(user?.role === "Admin"
      ? [
          { to: "/admin/drivers", label: "Truck drivers", icon: Truck },
          { to: "/admin/officers", label: "Ward officers", icon: Shield },
          { to: "/admin/citizens", label: "Citizens", icon: Users },
          { to: "/admin/payments-wages", label: "Payments & wages", icon: Wallet },
          {
            to: "/operations/approvals",
            label: "Approvals",
            icon: Shield,
          },
        ]
      : []),
  ];
  return (
    <div className="ws">
      <aside className="ws-sidebar">
        <Link className="ws-brand" to="/">
          SafaiTrack
        </Link>
        <p className="ws-role">{roleNames[user!.role]}</p>
        <nav aria-label="Workspace">
          {links.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to}>
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="ws-account">
          <strong>{user?.fullName}</strong>
          <small>{user?.email}</small>
          <button
            onClick={() => {
              logout();
              navigate("/login", { replace: true });
            }}
          >
            <LogOut size={17} /> Sign out
          </button>
        </div>
      </aside>
      <main className="ws-main">
        <header className="ws-top">
          <span>{roleNames[user!.role]} workspace</span>
          <span>Dhaka municipal services</span>
          <NotificationAction currentUserRole={roleNames[user!.role] as "Citizen" | "Truck Driver" | "Ward Officer" | "City Admin"} />
        </header>
        <div className="ws-content">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
function Heading({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="ws-heading">
      <h1>{title}</h1>
      <div className="ws-actions">{children}</div>
    </div>
  );
}
function ComplaintRows({
  rows,
  staff = false,
}: {
  rows: Complaint[];
  staff?: boolean;
}) {
  return rows.length ? (
    <div className="ws-list">
      {rows.map(c => (
        <Link
          className="ws-row"
          key={c.complaintId}
          to={`${staff ? "/operations" : "/citizen"}/complaints/${c.complaintId}`}
        >
          <div>
            <strong>
              #{c.complaintId} {c.category}
              {c.photoUrl && (
                <span className="ws-photo-tag" title="Photo attached">
                  <Camera size={12} /> Photo
                </span>
              )}
            </strong>
            <small>
              {c.wardName ? `[${c.wardName}] ` : c.wardId ? `[Ward ${c.wardId}] ` : ""}{c.binName}
              {staff ? ` / ${c.citizenName}` : ""}
            </small>
            <small>{when(c.createdAt)}</small>
          </div>
          <Status value={c.status} />
        </Link>
      ))}
    </div>
  ) : (
    <p className="ws-empty">No complaints yet.</p>
  );
}
function Dashboard() {
  const { user } = useAuth();
  const citizen = user?.role === "Citizen",
    driver = user?.role === "Driver";
  const resource = useData<Complaint[] | CollectionRoute[]>(
    driver ? "/api/routes" : "/api/complaints"
  );
  const bins = useData<Bin[]>(citizen ? null : "/api/bins");
  if (resource.loading) return <p role="status">Loading dashboard...</p>;
  if (resource.error)
    return <ErrorBox message={resource.error} retry={resource.reload} />;
  const rows = resource.data || [];
  return (
    <>
      <Heading
        title={
          citizen
            ? "My overview"
            : driver
              ? "My collection work"
              : user?.role === "Admin"
                ? "City overview"
                : "Ward overview"
        }
      >
        {citizen ? (
          <Link className="primary" to="/citizen/report">
            <Plus size={17} />
            Report an issue
          </Link>
        ) : (
          <Link
            className="primary"
            to={driver ? "/driver/route" : "/operations/routes"}
          >
            <Navigation size={17} />
            {driver ? "Open my routes" : "Dispatch a route"}
          </Link>
        )}
      </Heading>
      <p className="ws-welcome">Welcome, {user?.fullName}.</p>
      <div className="ws-metrics">
        {(driver
          ? [
              [
                "Assigned routes",
                rows.filter(r => r.status !== "Completed").length,
              ],
              [
                "Completed routes",
                rows.filter(r => r.status === "Completed").length,
              ],
              [
                "Stops collected",
                (rows as CollectionRoute[]).reduce(
                  (a, r) => a + r.collectedStopsCount,
                  0
                ),
              ],
            ]
          : [
              [
                "Pending complaints",
                rows.filter(r => r.status === "Pending").length,
              ],
              [
                "In progress",
                rows.filter(r => r.status === "InProgress").length,
              ],
              ["Resolved", rows.filter(r => r.status === "Resolved").length],
            ]
        ).map(([label, value]) => (
          <div key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      {!citizen && (
        <>
          <ErrorBox message={bins.error} retry={bins.reload} />
          <p>
            {bins.data?.filter(b => b.currentFillPercent > 60).length ?? "..."}{" "}
            bins above 60% fill in your service area.
          </p>
        </>
      )}
      {!citizen && !driver && bins.data && !bins.error && (
        <OperationsMetrics bins={bins.data} />
      )}
      <h2>
        {driver
          ? "Assigned routes"
          : citizen
            ? "My recent complaints"
            : "Recent ward complaints"}
      </h2>
      {driver ? (
        <DriverRoutes rows={rows as CollectionRoute[]} reload={resource.reload} />
      ) : (
        <ComplaintRows
          rows={(rows as Complaint[]).slice(0, 8)}
          staff={!citizen}
        />
      )}
    </>
  );
}
function OperationsMetrics({ bins }: { bins: Bin[] }) {
  const routes = useData<CollectionRoute[]>("/api/routes");
  if (routes.loading) return <p>Loading collection metrics...</p>;
  if (routes.error)
    return <ErrorBox message={routes.error} retry={routes.reload} />;
  const completed = (routes.data || []).filter(r => r.status === "Completed");
  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Dhaka",
  });
  const collected = new Set(
    (routes.data || []).flatMap(r =>
      r.stops
        .filter(
          s =>
            s.collectedAt &&
            utcDate(s.collectedAt).toLocaleDateString("en-CA", {
              timeZone: "Asia/Dhaka",
            }) === today
        )
        .map(s => s.binId)
    )
  );
  const measured = completed.filter(r => r.distanceAvoidedKm != null);
  return (
    <>
      <ErrorBox message={routes.error} retry={routes.reload} />
      <div className="ws-metrics">
        <div>
          <span>Priority bins</span>
          <strong>{bins.filter(b => b.currentFillPercent > 60).length}</strong>
        </div>
        <div>
          <span>Collection coverage today</span>
          <strong>
            {bins.length ? Math.round((collected.size / bins.length) * 100) : 0}
            %
          </strong>
          <small>
            {collected.size} of {bins.length} bins
          </small>
        </div>
        <div>
          <span>Estimated distance avoided</span>
          <strong>
            {measured.length
              ? `${measured.reduce((n, r) => n + (r.distanceAvoidedKm || 0), 0).toFixed(1)} km`
              : "Not recorded"}
          </strong>
          <small>Completed routes with a saved baseline</small>
        </div>
      </div>
      <CollectionMap stops={bins} />
    </>
  );
}
function Complaints() {
  const { user } = useAuth();
  const resource = useData<Complaint[]>("/api/complaints");
  const [filter, setFilter] = useState("All");
  const pageTitle =
    user?.role === "Citizen"
      ? "My complaints"
      : user?.role === "Admin"
        ? "All City Complaints"
        : "Ward complaints";
  return (
    <>
      <Heading
        title={pageTitle}
      >
        <select
          aria-label="Filter complaints"
          value={filter}
          onChange={e => setFilter(e.target.value)}
        >
          {["All", "Pending", "InProgress", "Resolved"].map(s => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <button onClick={resource.reload}>
          <RefreshCw size={16} />
          Refresh
        </button>
      </Heading>
      <ErrorBox message={resource.error} retry={resource.reload} />
      {resource.loading ? (
        <p>Loading complaints...</p>
      ) : (
        <ComplaintRows
          rows={(resource.data || []).filter(
            c => filter === "All" || c.status === filter
          )}
          staff={user?.role !== "Citizen"}
        />
      )}
    </>
  );
}
function ComplaintDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const resource = useData<Complaint>(`/api/complaints/${id}`);
  const history = useData<
    {
      complaintUpdateId: number;
      authorName: string;
      message: string;
      status: string;
      createdAt: string;
    }[]
  >(`/api/complaints/${id}/updates`);
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [zoomedPhoto, setZoomedPhoto] = useState(false);
  const c = resource.data;
  const staff = user?.role !== "Citizen";
  if (!c)
    return (
      <>
        <ErrorBox message={resource.error} retry={resource.reload} />
        {resource.loading && <p>Loading complaint...</p>}
      </>
    );
  return (
    <>
      <Heading title={`Complaint #${c.complaintId}`}>
        <Status value={c.status} />
        <button
          onClick={() => {
            void resource.reload();
            void history.reload();
          }}
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </Heading>
      <h2>{c.category}</h2>
      <p>
        {c.wardName ? `${c.wardName} / ` : c.wardId ? `Ward ${c.wardId} / ` : ""}{c.binName} / Filed {when(c.createdAt)}
      </p>
      <p className="ws-description">{c.description}</p>
      {c.photoUrl ? (
        <div className="ws-complaint-photo-container">
          <div className="ws-complaint-photo-topbar">
            <span style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 600, color: "#1e293b" }}>
              <Camera size={18} style={{ color: "#0284c7" }} />
              Attached Photo Evidence
            </span>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button
                type="button"
                className="ws-photo-view-btn"
                onClick={() => setZoomedPhoto(true)}
              >
                <Maximize2 size={15} /> Expand Photo
              </button>
              <a
                href={c.photoUrl}
                target="_blank"
                rel="noreferrer"
                className="ws-photo-view-btn"
                style={{ textDecoration: "none" }}
              >
                Open in new tab ↗
              </a>
            </div>
          </div>
          <div className="ws-complaint-photo-frame" onClick={() => setZoomedPhoto(true)}>
            <img
              src={c.photoUrl}
              alt={`Evidence for complaint #${c.complaintId}`}
              className="ws-complaint-photo-image"
            />
            <div className="ws-photo-overlay-hint">
              <Maximize2 size={16} /> Click to zoom in
            </div>
          </div>
        </div>
      ) : (
        <div className="ws-complaint-no-photo-badge">
          <small style={{ color: "#64748b" }}>No photo evidence attached to this complaint.</small>
        </div>
      )}
      {zoomedPhoto && c.photoUrl && (
        <div className="ws-photo-modal-backdrop" onClick={() => setZoomedPhoto(false)}>
          <div className="ws-photo-modal-content" onClick={e => e.stopPropagation()}>
            <div className="ws-photo-modal-header">
              <strong>Complaint #{c.complaintId} — Attached Photo Evidence</strong>
              <button type="button" onClick={() => setZoomedPhoto(false)} className="ws-photo-modal-close">
                <X size={20} />
              </button>
            </div>
            <div className="ws-photo-modal-body">
              <img src={c.photoUrl} alt={`Full evidence for complaint #${c.complaintId}`} />
            </div>
          </div>
        </div>
      )}
      <h2>Progress & replies</h2>
      <div className="ws-timeline">
        <p>
          <strong>Complaint filed</strong>
          <small>{when(c.createdAt)}</small>
        </p>
        {history.data?.map(u => (
          <div key={u.complaintUpdateId}>
            <Status value={u.status} />
            <p className="ws-description">{u.message}</p>
            <small>
              {u.authorName} / {when(u.createdAt)}
            </small>
          </div>
        ))}
      </div>
      <ErrorBox message={history.error} retry={history.reload} />
      <ErrorBox message={error} />
      {staff && (
        <form
          className="ws-form"
          onSubmit={async e => {
            e.preventDefault();
            const values = new FormData(e.currentTarget);
            setBusy(true);
            setError("");
            try {
              await apiClient.put(`/api/complaints/${id}/status`, {
                status: values.get("status"),
                message: values.get("message"),
              });
              await resource.reload();
              await history.reload();
            } catch (err) {
              setError(apiError(err));
            } finally {
              setBusy(false);
            }
          }}
          key={c.status}
        >
          <label>
            Status
            <select aria-label="Status" name="status" defaultValue={c.status}>
              <option>{c.status}</option>
              {c.status === "Pending" && <option>InProgress</option>}
              {c.status === "InProgress" && <option>Resolved</option>}
            </select>
          </label>
          <label>
            Reply to citizen
            <textarea name="message" required maxLength={1000} rows={4} />
          </label>
          <button className="primary" disabled={busy}>
            <Check size={16} />
            {busy ? "Saving..." : "Send update"}
          </button>
        </form>
      )}
    </>
  );
}
function Report() {
  const bins = useData<Bin[]>("/api/bins");
  const navigate = useNavigate();
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [photoData, setPhotoData] = useState<string | null>(null);
  const [photoName, setPhotoName] = useState<string>("");
  const [photoSize, setPhotoSize] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please select an image file (JPG, JPEG, PNG, WEBP, etc.)");
      return;
    }

    setPhotoName(file.name);
    setPhotoSize(file.size > 1024 * 1024 ? `${(file.size / (1024 * 1024)).toFixed(1)} MB` : `${Math.round(file.size / 1024)} KB`);
    setError("");

    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      const img = new window.Image();
      img.onload = () => {
        const maxDim = 1280;
        let width = img.width;
        let height = img.height;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            setPhotoData(canvas.toDataURL(file.type.includes("png") ? "image/png" : "image/jpeg", 0.85));
            return;
          }
        }
        setPhotoData(dataUrl);
      };
      img.onerror = () => setPhotoData(dataUrl);
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  const removePhoto = () => {
    setPhotoData(null);
    setPhotoName("");
    setPhotoSize("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <>
      <Heading title="Report an issue" />
      <ErrorBox message={bins.error} retry={bins.reload} />
      <ErrorBox message={error} />
      <form
        className="ws-form"
        onSubmit={async e => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          setBusy(true);
          setError("");
          try {
            const { data } = await apiClient.post("/api/complaints", {
              binId: Number(form.get("bin")),
              category: form.get("category"),
              description: form.get("description"),
              photoUrl: photoData || null,
            });
            navigate(`/citizen/complaints/${data.complaintId}`);
          } catch (err) {
            setError(apiError(err));
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Bin
          <select aria-label="Bin" name="bin" required defaultValue="">
            <option value="" disabled>
              Select a bin
            </option>
            {bins.data?.map(b => (
              <option value={b.binId} key={b.binId}>
                {b.wardName} / {b.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Issue
          <select aria-label="Issue" name="category">
            <option>Overflowing bin</option>
            <option>Missed collection</option>
            <option>Damaged bin</option>
            <option>Other</option>
          </select>
        </label>
        <label>
          Description
          <textarea name="description" required maxLength={1000} rows={5} />
        </label>
        <div className="ws-field ws-photo-upload-group">
          <label className="ws-photo-label" htmlFor="complaint-photo-input">
            Photo evidence (optional)
            <small>Supports any image format (JPG, JPEG, PNG, WEBP, etc.)</small>
          </label>
          <input
            id="complaint-photo-input"
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={handlePhotoSelect}
          />
          {!photoData ? (
            <button
              type="button"
              className="ws-photo-picker-button"
              onClick={() => fileInputRef.current?.click()}
            >
              <Camera size={20} />
              <span>Attach a photo of the bin or issue</span>
            </button>
          ) : (
            <div className="ws-photo-preview-box">
              <img src={photoData} alt="Complaint preview thumbnail" className="ws-photo-preview-thumb" />
              <div className="ws-photo-preview-details">
                <strong>{photoName || "Uploaded photo"}</strong>
                <small>{photoSize}</small>
                <div className="ws-photo-preview-actions">
                  <button type="button" onClick={() => fileInputRef.current?.click()} className="ws-photo-action-btn">
                    Change photo
                  </button>
                  <button type="button" onClick={removePhoto} className="ws-photo-remove-btn">
                    <X size={15} /> Remove
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
        <button className="primary" disabled={busy || !bins.data?.length}>
          <Plus size={16} />
          {busy ? "Submitting..." : "Submit complaint"}
        </button>
      </form>
    </>
  );
}
function Bins() {
  const resource = useData<Bin[]>("/api/bins");
  const [error, setError] = useState("");
  return (
    <>
      <Heading title="Ward bins">
        <button onClick={resource.reload}>
          <RefreshCw size={16} />
          Refresh
        </button>
      </Heading>
      <ErrorBox message={resource.error || error} retry={resource.reload} />
      {resource.data && <CollectionMap stops={resource.data} />}
      <div className="ws-list">
        {resource.data?.map(bin => (
          <form
            className="ws-row"
            key={bin.binId}
            onSubmit={async e => {
              e.preventDefault();
              const form = e.currentTarget;
              const value = Number(new FormData(form).get("fill"));
              setError("");
              try {
                await apiClient.put(`/api/bins/${bin.binId}`, {
                  currentFillPercent: value,
                });
                await resource.reload();
              } catch (err) {
                setError(apiError(err));
              }
            }}
          >
            <div>
              <strong>{bin.name}</strong>
              <small>{bin.wardName}</small>
            </div>
            <label>
              Fill %
              <input
                aria-label={`${bin.name} fill percent`}
                name="fill"
                type="number"
                min={0}
                max={100}
                defaultValue={bin.currentFillPercent}
                key={bin.currentFillPercent}
                required
              />
            </label>
            <button type="submit">
              <Check size={16} />
              Update
            </button>
          </form>
        ))}
      </div>
    </>
  );
}
function RouteRows({
  rows,
  driver = false,
}: {
  rows: CollectionRoute[];
  driver?: boolean;
}) {
  return rows.length ? (
    <div className="ws-list">
      {rows.map(r => (
        <Link
          className="ws-row"
          key={r.routeId}
          to={`${driver ? "/driver/route" : "/operations/routes"}/${r.routeId}`}
        >
          <div>
            <strong>
              Route #{r.routeId} / {r.wardName}
            </strong>
            <small>
              {r.driverName || "Unassigned draft"} /{" "}
              {r.truckPlate || "No truck"}
            </small>
            <small>
              {r.collectedStopsCount} / {r.stopsCount} stops collected
            </small>
          </div>
          <Status value={r.status} />
        </Link>
      ))}
    </div>
  ) : (
    <p className="ws-empty">No assigned routes yet.</p>
  );
}
function DriverRoutes({ rows, reload }: { rows: CollectionRoute[]; reload: () => Promise<void> }) {
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const awaiting = rows.filter(r => r.status === "AwaitingAcceptance" || r.status === "Planned");
  const respond = async (id: number, decision: string) => {
    setBusy(true); setError("");
    try {
      await apiClient.put(`/api/routes/${id}/${decision}`);
      if (decision === "accept") {
        navigate(`/driver/route/${id}`);
      } else {
        await reload();
      }
    }
    catch (e) { setError(apiError(e)); }
    finally { setBusy(false); }
  };
  return <>
    <ErrorBox message={error} />
    {awaiting.length > 0 && <><h2>Awaiting acceptance</h2>
      {awaiting.map(r => <div key={r.routeId}>
        <RouteRows rows={[r]} driver />
        <div className="ws-actions">
          <button disabled={busy} className="primary" onClick={() => respond(r.routeId, "accept")}>Accept</button>
          <button disabled={busy} onClick={() => respond(r.routeId, "decline")}>Decline</button>
        </div>
      </div>)}
    </>}
    <h2>In progress and completed</h2>
    <RouteRows rows={rows.filter(r => !awaiting.includes(r))} driver />
  </>;
}
function RouteList() {
  const { user } = useAuth();
  const driver = user?.role === "Driver";
  const resource = useData<CollectionRoute[]>("/api/routes");
  return (
    <>
      <Heading title={driver ? "My routes" : "Dispatch & routes"}>
        <button onClick={resource.reload}>
          <RefreshCw size={16} />
          Refresh
        </button>
      </Heading>
      {!driver && <Dispatch onDispatch={resource.reload} />}
      <ErrorBox message={resource.error} retry={resource.reload} />
      {resource.loading ? (
        <p>Loading routes...</p>
      ) : (
        driver ? <DriverRoutes rows={resource.data || []} reload={resource.reload} /> : <RouteRows rows={resource.data || []} />
      )}
    </>
  );
}
function Dispatch({ onDispatch, pending }: { onDispatch: () => void; pending?: CollectionRoute }) {
  const wards = useData<Ward[]>("/api/workspace/wards"),
    drivers = useData<Driver[]>("/api/workspace/drivers"),
    trucks = useData<Vehicle[]>("/api/trucks");
  const [ward, setWard] = useState(pending ? String(pending.wardId) : ""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  // Auto-select ward when officer has only one ward available
  useEffect(() => {
    if (!pending && wards.data && wards.data.length === 1 && ward === "") {
      setWard(String(wards.data[0].wardId));
    }
  }, [wards.data, pending, ward]);

  return (
    <form
      className="ws-dispatch"
      onSubmit={async e => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        setBusy(true);
        setError("");
        try {
          const payload = {
            wardId: Number(ward),
            driverId: form.get("driver"),
            truckId: Number(form.get("truck")),
            algorithm: form.get("algorithm"),
          };
          const { data } = pending
            ? await apiClient.put(`/api/routes/${pending.routeId}/assign`, payload)
            : await apiClient.post("/api/routes/generate", payload);
          onDispatch();
          navigate(`/operations/routes/${data.routeId}`);
        } catch (err) {
          setError(apiError(err));
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2>{pending ? "Assign pending route" : "Assign collection work"}</h2>
      <ErrorBox
        message={error || wards.error || drivers.error || trucks.error}
        retry={() => {
          void wards.reload();
          void drivers.reload();
          void trucks.reload();
        }}
      />
      <div className="ws-fields">
        <label>
          Ward
          <select
            aria-label="Ward"
            disabled={!!pending}
            required
            value={ward}
            onChange={e => setWard(e.target.value)}
          >
            <option value="">Select ward</option>
            {wards.data?.map(w => (
              <option key={w.wardId} value={w.wardId}>
                {w.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Driver
          <select
            aria-label="Driver"
            name="driver"
            required
            key={ward}
            defaultValue=""
          >
            <option value="">Select driver</option>
            {drivers.data?.map(d => (
              <option key={d.id} value={d.id} disabled={d.isBusy}>
                {d.fullName} {d.wardId ? `[Ward ${d.wardId}]` : "[City Pool]"}{d.email ? ` (${d.email})` : ""}{d.isBusy ? " — [On Route]" : ""}
              </option>
            ))}
          </select>
        </label>
        <label>
          Truck
          <select aria-label="Truck" name="truck" required defaultValue="">
            <option value="">Select truck</option>
            {trucks.data
              ?.filter(t => t.status === "Available")
              .map(t => (
                <option key={t.truckId} value={t.truckId}>
                  {t.plateNumber} / #{t.truckId}
                </option>
              ))}
          </select>
        </label>
        <label>
          Stop ordering
          <select aria-label="Stop ordering" name="algorithm">
            <option value="dijkstra">Shortest collection order</option>
            <option value="nearest_neighbor">Nearest neighbor</option>
          </select>
        </label>
      </div>
      <button className="primary" disabled={busy}>
        <Navigation size={17} />
        {busy ? "Saving..." : pending ? "Assign route" : "Generate & assign route"}
      </button>
    </form>
  );
}
function RouteDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const resource = useData<CollectionRoute>(`/api/routes/${id}`);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [focusedIndex, setFocusedIndex] = useState<number | undefined>(),
    [refreshing, setRefreshing] = useState(false);
  const route = resource.data;
  const actionBusy = useRef(false);
  const action = async (suffix: string): Promise<boolean> => {
    if (actionBusy.current) return false;
    actionBusy.current = true;
    setBusy(true);
    setError("");
    try {
      await apiClient.put(`/api/routes/${id}/${suffix}`);
      if (suffix === "decline") navigate("/driver/route");
      else await resource.reload();
      return true;
    } catch (err) {
      setError(apiError(err));
      await resource.reload();
      return false;
    } finally {
      actionBusy.current = false;
      setBusy(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await resource.reload();
    } finally {
      setTimeout(() => setRefreshing(false), 500);
    }
  };

  if (!route)
    return (
      <>
        <ErrorBox message={resource.error} retry={resource.reload} />
        {resource.loading ? <p>Loading route...</p> : !resource.error ? <p className="ws-empty">Route #{id} not found.</p> : null}
      </>
    );
  const next = route.stops.find(s => !s.collectedAt),
    driver = user?.role === "Driver",
    staff = user?.role === "Admin" || user?.role === "WardOfficer";

  return (
    <>
      <Heading title={`Route #${route.routeId}`}>
        <Status value={route.status} />
        <button
          type="button"
          disabled={busy || refreshing}
          onClick={handleRefresh}
          title="Reload route status and stops"
        >
          <RefreshCw size={16} className={refreshing ? "ws-spin" : ""} />
          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
        {staff && ["Planned", "Pending", "AwaitingAcceptance"].includes(route.status) && (
          <button disabled={busy} onClick={() => action("optimize")}>
            <RefreshCw size={16} />
            Optimize stops
          </button>
        )}
        {driver && ["Planned", "AwaitingAcceptance"].includes(route.status) && (
          <button
            className="primary"
            disabled={busy}
            onClick={() => action("accept")}
          >
            <Navigation size={16} />
            Accept route
          </button>
        )}
        {driver && ["Planned", "AwaitingAcceptance"].includes(route.status) && <button disabled={busy} onClick={() => action("decline")}>Decline route</button>}
        {driver && route.status === "InProgress" && !next && (
          <button
            className="primary"
            disabled={busy}
            onClick={() => action("complete")}
          >
            <Check size={16} />
            Complete route
          </button>
        )}
      </Heading>
      <p>
        {route.wardName} / {route.driverName || "Unassigned draft"} /{" "}
        {route.truckPlate || "No truck assigned"}
      </p>
      <p>
        {route.collectedStopsCount} of {route.stopsCount} stops collected.
        Estimated straight-line distance: {(route.totalDistanceKm ?? 0).toFixed(2)} km.
      </p>
      <ErrorBox message={error || resource.error} />
      {!driver && route.status === "Pending" && <Dispatch pending={route} onDispatch={resource.reload} />}
      <CollectionMap stops={route.stops} route routeId={route.routeId} focusedIndex={focusedIndex} motion={driver ? {
        routeId: route.routeId, active: route.status === "InProgress",
        collect: index => action(`stops/${route.stops[index].routeStopId}/collect`),
        complete: () => action("complete"),
      } : undefined} />
      <h2>Collection order</h2>
      <div className="ws-list">
        {route.stops.map((s, index) => (
          <div
            className={`ws-row ws-row-clickable ${focusedIndex === index ? "ws-row-focused" : ""}`}
            key={s.routeStopId}
            onClick={() => setFocusedIndex(index)}
            title="Click to locate and focus on map"
          >
            <span className="ws-number">{index + 1}</span>
            <div className="ws-grow">
              <strong>{s.name}</strong>
              <small>
                {s.currentFillPercent}% full / {(s.latitude ?? 0).toFixed(5)},{" "}
                {(s.longitude ?? 0).toFixed(5)} — <span style={{ color: "#0284c7", fontWeight: 600 }}>📍 Focus on map</span>
              </small>
              {s.collectedAt && <small>Collected {when(s.collectedAt)}</small>}
            </div>
            {!s.collectedAt &&
              driver &&
              route.status === "InProgress" &&
              s === next && (
                <>
                  <a
                    className="ws-button"
                    target="_blank"
                    rel="noreferrer"
                    href={`https://www.google.com/maps/dir/?api=1&destination=${s.latitude},${s.longitude}&travelmode=driving`}
                  >
                    <Navigation size={16} />
                    Directions
                  </a>
                  <button
                    className="primary"
                    disabled={busy}
                    onClick={() => action(`stops/${s.routeStopId}/collect`)}
                  >
                    <Check size={16} />
                    Collect
                  </button>
                </>
              )}
            {s.collectedAt && <Status value="Collected" />}
          </div>
        ))}
      </div>
    </>
  );
}
function Fleet() {
  const { user } = useAuth();
  const resource = useData<Vehicle[]>("/api/trucks");
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <>
      <Heading title="Fleet" />
      <ErrorBox message={resource.error || error} retry={resource.reload} />
      {user?.role === "Admin" && (
        <form
          className="ws-dispatch"
          onSubmit={async e => {
            e.preventDefault();
            const form = e.currentTarget;
            setBusy(true);
            setError("");
            try {
              await apiClient.post("/api/trucks", {
                plateNumber: new FormData(form).get("plate"),
                status: "Available",
              });
              form.reset();
              await resource.reload();
            } catch (err) {
              setError(apiError(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Registration plate
            <input name="plate" required maxLength={50} />
          </label>
          <button disabled={busy}>
            <Plus size={16} />
            Register truck
          </button>
        </form>
      )}
      <div className="ws-list">
        {resource.data?.map(t => (
          <div className="ws-row" key={t.truckId}>
            <strong>
              {t.plateNumber} / #{t.truckId}
            </strong>
            <Status value={t.status} />
            {user?.role === "Admin" && t.status !== "OnRoute" && (
              <button
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  setError("");
                  try {
                    await apiClient.put(`/api/trucks/${t.truckId}`, {
                      status:
                        t.status === "Maintenance"
                          ? "Available"
                          : "Maintenance",
                    });
                    await resource.reload();
                  } catch (err) {
                    setError(apiError(err));
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {t.status === "Maintenance"
                  ? "Return to service"
                  : "Mark maintenance"}
              </button>
            )}
          </div>
        ))}
      </div>
    </>
  );
}

interface PendingUser {
  id: string;
  fullName: string;
  email: string;
  role: string;
  status: string;
  requestedWardId: number | null;
  requestedWardName: string | null;
  wardId: number | null;
  phoneNumber: string | null;
  gender: string | null;
}

interface TruckItem {
  truckId: number;
  plateNumber: string;
  status: string;
}

function PendingApprovals() {
  const resource = useData<PendingUser[]>("/api/auth/pending-approvals");
  const wards = useData<Ward[]>("/api/workspace/wards");
  const trucks = useData<TruckItem[]>("/api/trucks");
  useEffect(() => { const timer = setInterval(resource.reload, 15000); return () => clearInterval(timer); }, [resource.reload]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);
  const [selectedWards, setSelectedWards] = useState<Record<string, number | "">>({});
  const [selectedTrucks, setSelectedTrucks] = useState<Record<string, number | "">>({});

  const handleApprove = async (user: PendingUser) => {
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const wardId =
        (user.role === "WardOfficer" || user.role === "Citizen")
          ? (selectedWards[user.id] !== undefined && selectedWards[user.id] !== ""
              ? Number(selectedWards[user.id])
              : user.requestedWardId ?? user.wardId)
          : null;

      if ((user.role === "WardOfficer" || user.role === "Citizen") && !wardId) {
        setError(`Please select an assigned ward for ${user.fullName}.`);
        setBusy(false);
        return;
      }

      const truckId = user.role === "Driver" ? (selectedTrucks[user.id] ? Number(selectedTrucks[user.id]) : null) : null;

      await apiClient.put(`/api/auth/pending-approvals/${user.id}/approve`, {
        wardId: wardId || null,
        truckId: truckId || null,
      });
      setSuccess(`Approved ${user.fullName} (${user.role === "Citizen" ? "Citizenship approved" : roleNames[user.role] || user.role}).`);
      await resource.reload();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleReject = async (user: PendingUser) => {
    if (!window.confirm(`Are you sure you want to decline the registration for ${user.fullName}?`)) {
      return;
    }
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await apiClient.delete(`/api/auth/pending-approvals/${user.id}/reject`);
      setSuccess(`Declined application for ${user.fullName}.`);
      await resource.reload();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Heading title="Registration approvals" />
      <ErrorBox message={resource.error || error} retry={resource.reload} />
      {success && (
        <div style={{ padding: "0.75rem 1rem", borderRadius: 8, background: "#ecfdf5", border: "1px solid #10b981", color: "#065f46", marginBottom: "1rem" }}>
          {success}
        </div>
      )}
      {resource.loading && <p>Loading pending accounts...</p>}
      {!resource.loading && (!resource.data || resource.data.length === 0) && (
        <p className="ws-empty">No pending registrations requiring approval.</p>
      )}
      <div className="ws-list">
        {resource.data?.map(u => (
          <div className="ws-row" key={u.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap", padding: "1rem" }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: "1.05rem" }}>{u.fullName}</div>
              <div style={{ color: "#64748b", fontSize: "0.875rem" }}>
                {u.email} · {u.phoneNumber || "No mobile"} · {u.gender || "Gender not provided"} &bull; <span style={{ fontWeight: 500, color: "#1e293b" }}>{roleNames[u.role] || u.role}</span>
              </div>
              {u.role === "WardOfficer" && (
                <div style={{ fontSize: "0.85rem", color: "#0284c7", marginTop: 4 }}>
                  Requested Ward: <strong>{u.requestedWardName ? `${u.requestedWardName} (Ward ${u.requestedWardId})` : (u.requestedWardId ? `Ward ${u.requestedWardId}` : "None")}</strong>
                </div>
              )}
              {u.role === "Citizen" && (
                <div style={{ fontSize: "0.85rem", color: "#047857", marginTop: 4 }}>
                  Requested Ward: <strong>{u.requestedWardName ? `${u.requestedWardName} (Ward ${u.requestedWardId})` : (u.requestedWardId ? `Ward ${u.requestedWardId}` : (u.wardId ? `Ward ${u.wardId}` : "None"))}</strong>
                </div>
              )}
              {u.role === "Driver" && (
                <div style={{ fontSize: "0.85rem", color: "#64748b", marginTop: 4 }}>
                  Role: Heavy Collection Fleet Driver &bull; Assign collection truck below
                </div>
              )}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
              {u.role === "Driver" ? (
                <label style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.875rem" }}>
                  <span style={{ fontWeight: 600, color: "#1e293b" }}>Assign Truck:</span>
                  <select
                    value={selectedTrucks[u.id] ?? ""}
                    onChange={e =>
                      setSelectedTrucks(prev => ({
                        ...prev,
                        [u.id]: e.target.value ? Number(e.target.value) : "",
                      }))
                    }
                    style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #cbd5e1" }}
                  >
                    <option value="">-- Select Truck --</option>
                    {trucks.data?.map(t => (
                      <option key={t.truckId} value={t.truckId}>
                        Truck #{t.truckId} - {t.plateNumber} ({t.status})
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <label style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.875rem" }}>
                  <span style={{ fontWeight: 600, color: "#1e293b" }}>Assign Ward:</span>
                  <select
                    value={
                      selectedWards[u.id] !== undefined
                        ? selectedWards[u.id]
                        : ((u.requestedWardId ?? u.wardId) ? String(u.requestedWardId ?? u.wardId) : "")
                    }
                    onChange={e =>
                      setSelectedWards(prev => ({
                        ...prev,
                        [u.id]: e.target.value ? Number(e.target.value) : "",
                      }))
                    }
                    style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #cbd5e1" }}
                  >
                    <option value="">-- Select Ward --</option>
                    {wards.data?.map(w => (
                      <option key={w.wardId} value={w.wardId}>
                        Ward {w.wardId} - {w.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <button
                type="button"
                disabled={busy}
                onClick={() => handleApprove(u)}
                style={{
                  background: "#10b981",
                  color: "#fff",
                  border: "none",
                  padding: "6px 14px",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontWeight: 600,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4
                }}
              >
                <Check size={16} /> {u.role === "Citizen" ? "Approve Citizenship" : u.role === "Driver" ? "Approve Driver" : "Approve Officer"}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => handleReject(u)}
                style={{
                  background: "#ef4444",
                  color: "#fff",
                  border: "none",
                  padding: "6px 14px",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontWeight: 500
                }}
              >
                Reject
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

/**
 * Shows the result the gateway sent us back with, then strips it from the URL so a
 * refresh does not replay the message.
 */
function PaymentOutcome() {
  const location = useLocation();
  const navigate = useNavigate();
  const [notice, setNotice] = useState<{ outcome: string; message: string } | null>(
    null
  );
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const outcome = params.get("payment");
    if (!outcome) return;
    setNotice({
      outcome,
      message: params.get("message") || "The payment could not be completed.",
    });
    navigate(location.pathname, { replace: true });
  }, [location.pathname, location.search, navigate]);
  if (!notice) return null;
  return (
    <div className={`ws-notice ${notice.outcome}`} role="status">
      {notice.outcome === "success" ? <Check size={16} /> : <CircleAlert size={16} />}
      {notice.message}
    </div>
  );
}

function CitizenBilling() {
  const invoices = useData<Invoice[]>("/api/invoices");
  const payments = useData<PaymentRecord[]>("/api/payments");
  useEffect(() => { const timer = setInterval(() => { void invoices.reload(); void payments.reload(); }, 15000); return () => clearInterval(timer); }, [invoices.reload, payments.reload]);
  const [paying, setPaying] = useState<number | null>(null);
  const [error, setError] = useState("");
  const rows = invoices.data || [];
  const outstanding = rows
    .filter(i => i.status !== "Paid" && i.status !== "Cancelled")
    .reduce((total, i) => total + i.amount, 0);
  const settled = rows.filter(i => i.status === "Paid");
  const pay = async (invoice: Invoice) => {
    setPaying(invoice.invoiceId);
    setError("");
    try {
      const { data } = await apiClient.post<{ redirectUrl: string }>(
        "/api/payments/initiate",
        { invoiceId: invoice.invoiceId }
      );
      // Hand the browser to the gateway's hosted checkout; it returns to /billing.
      window.location.assign(data.redirectUrl);
    } catch (e) {
      setError(apiError(e));
      setPaying(null);
      void invoices.reload();
    }
  };
  return (
    <>
      <Heading title="Billing">
        <button
          onClick={() => {
            void invoices.reload();
            void payments.reload();
          }}
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </Heading>
      <PaymentOutcome />
      <ErrorBox message={error} />
      <ErrorBox message={invoices.error} retry={invoices.reload} />
      <div className="ws-metrics">
        <div>
          <span>Outstanding</span>
          <strong>{money(outstanding)}</strong>
          <small>
            {rows.filter(i => i.isOverdue).length} overdue
          </small>
        </div>
        <div>
          <span>Paid to date</span>
          <strong>
            {money(settled.reduce((total, i) => total + i.amount, 0))}
          </strong>
          <small>{settled.length} invoice(s) settled</small>
        </div>
        <div>
          <span>Monthly collection fee</span>
          <strong>{rows.length ? money(rows[0].amount) : "Not billed yet"}</strong>
          <small>{rows[0]?.wardName || "Awaiting ward assignment"}</small>
        </div>
      </div>
      {invoices.loading ? (
        <p>Loading invoices...</p>
      ) : rows.length ? (
        <div className="ws-list">
          {rows.map(invoice => (
            <div className="ws-row" key={invoice.invoiceId}>
              <div>
                <strong>
                  {billingPeriod(invoice.billingPeriodStart)} collection fee
                </strong>
                <small>
                  {invoice.invoiceNumber} / {invoice.wardName}
                </small>
                <small>
                  {invoice.status === "Paid" && invoice.paidAt
                    ? `Paid ${when(invoice.paidAt)}`
                    : `Due ${day(invoice.dueAt)}`}
                </small>
              </div>
              <strong className="ws-amount">
                {money(invoice.amount, invoice.currency)}
              </strong>
              <Status
                value={invoice.isOverdue ? "Overdue" : invoice.status}
              />
              {(invoice.status === "Unpaid" || invoice.status === "Processing") && (
                <button
                  className="ws-pay"
                  disabled={paying !== null}
                  onClick={() => void pay(invoice)}
                >
                  <CreditCard size={16} />
                  {paying === invoice.invoiceId ? "Opening gateway..." : "Pay now"}
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="ws-empty">
          No collection fees have been billed to your household yet.
        </p>
      )}
      <h2 className="ws-subhead">Transaction history</h2>
      <ErrorBox message={payments.error} retry={payments.reload} />
      {payments.loading ? (
        <p>Loading transactions...</p>
      ) : (payments.data || []).length ? (
        <div className="ws-list">
          {(payments.data || []).map(payment => (
            <div className="ws-row" key={payment.paymentId}>
              <div>
                <strong>
                  {payment.invoiceNumber || `Invoice #${payment.invoiceId}`}
                </strong>
                <small>
                  {payment.gateway}
                  {payment.paymentMethod ? ` / ${payment.paymentMethod}` : ""} /{" "}
                  {payment.transactionRef}
                </small>
                <small>
                  {payment.failureReason ||
                    (payment.gatewayTransactionId
                      ? `Gateway reference ${payment.gatewayTransactionId}`
                      : "Awaiting gateway confirmation")}
                </small>
              </div>
              <strong className="ws-amount">
                {money(payment.amount, payment.currency)}
              </strong>
              <Status value={payment.reviewStatus === "Pending" ? "AwaitingApproval" : payment.reviewStatus === "Rejected" ? "ReviewHold" : payment.reviewStatus === "Approved" ? "Confirmed" : payment.status} />
              <small className="ws-when">
                {when(payment.completedAt || payment.initiatedAt)}
              </small>
            </div>
          ))}
        </div>
      ) : (
        <p className="ws-empty">No payment attempts recorded yet.</p>
      )}
    </>
  );
}

function RevenueOverview() {
  const { user } = useAuth();
  const summary = useData<BillingSummary>("/api/invoices/summary");
  const invoices = useData<Invoice[]>("/api/invoices");
  const [running, setRunning] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const data = summary.data;
  const runBilling = async () => {
    setRunning(true);
    setNotice("");
    setError("");
    try {
      const response = await apiClient.post<{ message: string }>(
        "/api/invoices/generate"
      );
      setNotice(response.data.message);
      await Promise.all([summary.reload(), invoices.reload()]);
    } catch (e) {
      setError(apiError(e));
    } finally {
      setRunning(false);
    }
  };
  return (
    <>
      <Heading title="Collection revenue">
        {user?.role === "Admin" && (
          <button disabled={running} onClick={() => void runBilling()}>
            <Banknote size={16} />
            {running ? "Billing..." : "Run billing"}
          </button>
        )}
        <button
          onClick={() => {
            void summary.reload();
            void invoices.reload();
          }}
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </Heading>
      {notice && (
        <div className="ws-notice success" role="status">
          <Check size={16} />
          {notice}
        </div>
      )}
      <ErrorBox message={error} />
      <ErrorBox message={summary.error} retry={summary.reload} />
      {summary.loading ? (
        <p>Loading collection revenue...</p>
      ) : data ? (
        <>
          <div className="ws-metrics">
            <div>
              <span>Collected</span>
              <strong>{money(data.amountCollected, data.currency)}</strong>
              <small>
                {data.paidInvoices} of {data.totalInvoices} invoices settled
              </small>
            </div>
            <div>
              <span>Collection rate</span>
              <strong>{data.collectionRate}%</strong>
              <small>Share of billed value recovered</small>
            </div>
            <div>
              <span>Outstanding</span>
              <strong>{money(data.amountOutstanding, data.currency)}</strong>
              <small>{data.overdueInvoices} past due</small>
            </div>
          </div>
          <h2 className="ws-subhead">By ward</h2>
          {data.wards.length ? (
            <div className="ws-list">
              {data.wards.map(ward => (
                <div className="ws-row" key={ward.wardId}>
                  <div>
                    <strong>{ward.wardName}</strong>
                    <small>
                      {ward.paidInvoices} paid / {ward.totalInvoices} billed
                      {ward.overdueInvoices > 0
                        ? ` / ${ward.overdueInvoices} overdue`
                        : ""}
                    </small>
                    <small>
                      Outstanding{" "}
                      {money(ward.amountOutstanding, data.currency)}
                    </small>
                  </div>
                  <strong className="ws-amount">
                    {money(ward.amountCollected, data.currency)}
                  </strong>
                  <Status
                    value={ward.collectionRate >= 75 ? "Healthy" : "Lagging"}
                  />
                </div>
              ))}
            </div>
          ) : (
            <p className="ws-empty">
              No collection fees have been billed yet. Run billing to issue this
              month's invoices.
            </p>
          )}
        </>
      ) : null}
    </>
  );
}

function Billing() {
  const { user } = useAuth();
  return user?.role === "Citizen" ? <CitizenBilling /> : <RevenueOverview />;
}

function HomeRedirect() {
  const { user } = useAuth();
  return <Navigate to={home(user?.role)} replace />;
}
export default function WorkspaceRoutes({
  landing,
}: {
  landing: React.ReactNode;
}) {
  const location = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);
  return (
    <Routes>
      <Route path="/" element={landing} />
      <Route path="/login" element={<Login />} />
      <Route path="/city-admin/login" element={<Login cityAdmin />} />
      <Route path="/register" element={<Login register />} />
      <Route element={<Guard />}>
        <Route element={<Shell />}>
          <Route path="/home" element={<HomeRedirect />} />
          <Route element={<Guard roles={["Citizen", "Admin", "WardOfficer"]} />}>
            <Route path="/billing" element={<Billing />} />
          </Route>
          <Route element={<Guard roles={["Citizen"]} />}>
            <Route path="/citizen/dashboard" element={<Dashboard />} />
            <Route path="/citizen/complaints" element={<Complaints />} />
            <Route
              path="/citizen/complaints/:id"
              element={<ComplaintDetail />}
            />
            <Route path="/citizen/report" element={<Report />} />
          </Route>
          <Route element={<Guard roles={["Driver"]} />}>
            <Route path="/driver/wages" element={<DriverWages />} />
            <Route path="/driver/dashboard" element={<Dashboard />} />
            <Route path="/driver/route" element={<RouteList />} />
            <Route path="/driver/route/:id" element={<RouteDetail />} />
          </Route>
          <Route element={<Guard roles={["WardOfficer"]} />}>
            <Route path="/officer/dashboard" element={<Dashboard />} />
            <Route
              path="/officer/complaints/:id"
              element={<ComplaintDetail />}
            />
          </Route>
          <Route element={<Guard roles={["Admin"]} />}>
            <Route path="/admin/drivers" element={<PeopleDirectory key="drivers" role="Driver" />} />
            <Route path="/admin/officers" element={<PeopleDirectory key="officers" role="WardOfficer" />} />
            <Route path="/admin/citizens" element={<PeopleDirectory key="citizens" role="Citizen" />} />
            <Route path="/admin/payments-wages" element={<PaymentsAndWages />} />
            <Route path="/admin/dashboard" element={<Dashboard />} />
            <Route path="/admin/complaints" element={<Complaints />} />
            <Route path="/admin/complaints/:id" element={<ComplaintDetail />} />
            <Route path="/admin/bins" element={<Bins />} />
            <Route path="/admin/routes" element={<RouteList />} />
            <Route path="/admin/routes/:id" element={<RouteDetail />} />
            <Route path="/admin/fleet" element={<Fleet />} />
            <Route path="/operations/approvals" element={<><PendingApprovals /><PaymentApprovals /></>} />
            <Route path="/admin/approvals" element={<><PendingApprovals /><PaymentApprovals /></>} />
          </Route>
          <Route element={<Guard roles={["Admin", "WardOfficer"]} />}>
            <Route path="/operations/complaints" element={<Complaints />} />
            <Route
              path="/operations/complaints/:id"
              element={<ComplaintDetail />}
            />
            <Route path="/operations/bins" element={<Bins />} />
            <Route path="/operations/routes" element={<RouteList />} />
            <Route path="/operations/routes/:id" element={<RouteDetail />} />
            <Route path="/operations/fleet" element={<Fleet />} />
            <Route path="/ward/bins" element={<Bins />} />
            <Route path="/ward/complaints" element={<Complaints />} />
            <Route path="/ward/complaints/:id" element={<ComplaintDetail />} />
            <Route path="/ward/routes" element={<RouteList />} />
            <Route path="/ward/routes/:id" element={<RouteDetail />} />
          </Route>
          <Route path="*" element={<HomeRedirect />} />
        </Route>
      </Route>
    </Routes>
  );
}
