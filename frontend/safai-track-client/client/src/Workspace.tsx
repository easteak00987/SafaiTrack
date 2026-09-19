import React, { useCallback, useEffect, useState } from "react";
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
  Check,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  MapPin,
  Navigation,
  Plus,
  RefreshCw,
  Truck,
} from "lucide-react";
import { useAuth } from "./contexts/AuthContext";
import { apiClient, apiError } from "./lib/api-client";
import CollectionMap, { type MapStop } from "./components/CollectionMap";
import Login from "./components/AuthPage";
import "./workspace.css";

type Bin = MapStop & { wardId: number; wardName: string };
type Complaint = {
  complaintId: number;
  binId: number;
  binName: string;
  citizenName: string;
  category: string;
  description: string;
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
type Driver = { id: string; fullName: string; wardId: number };
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
function Status({ value }: { value: string }) {
  return (
    <span className={`ws-status ${value.toLowerCase()}`}>
      {value === "InProgress" ? "In progress" : value}
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
      setData((await apiClient.get<T>(path)).data);
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
  const { user, isAuthenticated } = useAuth();
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
        ]
      : []),
    ...(user?.role === "Driver"
      ? [{ to: "/driver/route", label: "My routes", icon: Navigation }]
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
        ]
      : []),
  ];
  return (
    <div className="ws">
      <aside className="ws-sidebar">
        <Link className="ws-brand" to="/home">
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
            </strong>
            <small>
              {c.binName}
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
        <RouteRows rows={rows as CollectionRoute[]} driver />
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
  return (
    <>
      <Heading
        title={user?.role === "Citizen" ? "My complaints" : "Ward complaints"}
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
    [busy, setBusy] = useState(false);
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
        {c.binName} / Filed {when(c.createdAt)}
      </p>
      <p className="ws-description">{c.description}</p>
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
        <RouteRows rows={resource.data || []} driver={driver} />
      )}
    </>
  );
}
function Dispatch({ onDispatch }: { onDispatch: () => void }) {
  const wards = useData<Ward[]>("/api/workspace/wards"),
    drivers = useData<Driver[]>("/api/workspace/drivers"),
    trucks = useData<Vehicle[]>("/api/trucks");
  const [ward, setWard] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  return (
    <form
      className="ws-dispatch"
      onSubmit={async e => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        setBusy(true);
        setError("");
        try {
          const { data } = await apiClient.post("/api/routes/generate", {
            wardId: Number(ward),
            driverId: form.get("driver"),
            truckId: Number(form.get("truck")),
            algorithm: form.get("algorithm"),
          });
          onDispatch();
          navigate(`/operations/routes/${data.routeId}`);
        } catch (err) {
          setError(apiError(err));
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2>Assign collection work</h2>
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
            {drivers.data
              ?.filter(d => d.wardId === Number(ward))
              .map(d => (
                <option key={d.id} value={d.id}>
                  {d.fullName}
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
        {busy ? "Generating..." : "Generate & assign route"}
      </button>
    </form>
  );
}
function RouteDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const resource = useData<CollectionRoute>(`/api/routes/${id}`);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const route = resource.data;
  const action = async (suffix: string) => {
    setBusy(true);
    setError("");
    try {
      await apiClient.put(`/api/routes/${id}/${suffix}`);
      await resource.reload();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(false);
    }
  };
  if (!route)
    return (
      <>
        <ErrorBox message={resource.error} retry={resource.reload} />
        {resource.loading && <p>Loading route...</p>}
      </>
    );
  const next = route.stops.find(s => !s.collectedAt),
    driver = user?.role === "Driver";
  return (
    <>
      <Heading title={`Route #${route.routeId}`}>
        <Status value={route.status} />
        <button onClick={resource.reload}>
          <RefreshCw size={16} />
          Refresh
        </button>
        {route.status === "Planned" && (
          <button disabled={busy} onClick={() => action("optimize")}>
            <RefreshCw size={16} />
            Optimize stops
          </button>
        )}
        {driver && route.status === "Planned" && (
          <button
            className="primary"
            disabled={busy}
            onClick={() => action("start")}
          >
            <Navigation size={16} />
            Start route
          </button>
        )}
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
        Estimated straight-line distance: {route.totalDistanceKm.toFixed(2)} km.
      </p>
      <ErrorBox message={error || resource.error} />
      <CollectionMap stops={route.stops} route />
      <h2>Collection order</h2>
      <div className="ws-list">
        {route.stops.map((s, index) => (
          <div className="ws-row" key={s.routeStopId}>
            <span className="ws-number">{index + 1}</span>
            <div className="ws-grow">
              <strong>{s.name}</strong>
              <small>
                {s.currentFillPercent}% full / {s.latitude.toFixed(5)},{" "}
                {s.longitude.toFixed(5)}
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
      <Route path="/register" element={<Login register />} />
      <Route element={<Guard />}>
        <Route element={<Shell />}>
          <Route path="/home" element={<HomeRedirect />} />
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
            <Route path="/admin/dashboard" element={<Dashboard />} />
            <Route path="/admin/fleet" element={<Fleet />} />
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
          </Route>
          <Route path="*" element={<HomeRedirect />} />
        </Route>
      </Route>
    </Routes>
  );
}
