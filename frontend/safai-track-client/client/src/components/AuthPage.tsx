import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  ChevronRight,
  Eye,
  EyeOff,
  Key,
  Lock,
  Mail,
  Phone,
  Shield,
  Sparkles,
  Truck,
  User,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { apiClient, apiError } from "../lib/api-client";
import { type UserRole } from "../lib/headerData";

const ROLE_PRESETS: Record<UserRole, { backendRole: string }> = {
  "Ward Officer": { backendRole: "WardOfficer" },
  "Truck Driver": { backendRole: "Driver" },
  "Citizen": { backendRole: "Citizen" },
  "City Admin": { backendRole: "Admin" },
};

export function isValidBdPhone(phone: string): boolean {
  const cleaned = phone.trim().replace(/[\s-]/g, "");
  return /^(\+?8801|01)[3-9]\d{8}$/.test(cleaned);
}

export function missingPasswordRequirements(password: string): string[] {
  return [
    password.length < 8 && "at least 8 characters",
    !/[a-z]/.test(password) && "a lowercase letter",
    !/[A-Z]/.test(password) && "an uppercase letter",
    !/[0-9]/.test(password) && "a number",
    !/[^a-zA-Z0-9\s]/.test(password) && "a special character",
  ].filter((requirement): requirement is string => typeof requirement === "string");
}

export default function AuthPage({ register = false }: { register?: boolean }) {
  const { login, isAuthenticated, initializing } = useAuth();
  const navigate = useNavigate();

  const [role, setRole] = useState<UserRole>(() => {
    const stored = (typeof localStorage !== "undefined" ? localStorage.getItem("safaitrack_active_role") : null) as UserRole | null;
    return stored && ROLE_PRESETS[stored] ? stored : "Citizen";
  });
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [gender, setGender] = useState<"Male" | "Female" | "Other">("Male");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);
  const [genderDropdownOpen, setGenderDropdownOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [wards, setWards] = useState<{ wardId: number; name: string }[]>([]);
  const [requestedWardId, setRequestedWardId] = useState<number | "">("");
  const [pendingSuccess, setPendingSuccess] = useState("");
  const roleDropdownRef = useRef<HTMLDivElement>(null);
  const genderDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (register) {
      apiClient.get<{ wardId: number; name: string }[]>("/api/workspace/wards")
        .then(res => setWards(res.data))
        .catch(() => {});
    }
  }, [register]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (roleDropdownRef.current && !roleDropdownRef.current.contains(e.target as Node)) {
        setRoleDropdownOpen(false);
      }
      if (genderDropdownRef.current && !genderDropdownRef.current.contains(e.target as Node)) {
        setGenderDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectRole = (newRole: UserRole) => {
    setRole(newRole);
    setRoleDropdownOpen(false);
    setError("");
  };

  const missingRequirements = missingPasswordRequirements(password);
  if (initializing) return <p role="status">Restoring session...</p>;
  if (isAuthenticated) return <Navigate to="/home" replace />;

  const ease = [0.16, 1, 0.3, 1] as const;

  return (
    <div className="auth-page">
      <div className="auth-visual">
        <div className="auth-visual-top">
          <Link to="/" className="brand" aria-label="SafaiTrack home">
            <span className="brand-mark">
              <span />
              <span />
              <span />
            </span>
            <span className="brand-word">
              Safai<span className="word-signal">T</span>rack
            </span>
          </Link>
          <div className="auth-live-badge">
            <span className="live-ping-dot" />
            <span>CIVIC WORKSPACE</span>
          </div>
        </div>
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease }}
          className="auth-visual-copy"
        >
          <div className="eyebrow">
            <span className="signal-bar lime" /> DHAKA &middot; CIVIC OPERATIONS
            LAYER
          </div>
          <h1>
            Log the signal.
            <br />
            <span className="text-lime">Move the city.</span>
          </h1>
          <p>
            A shared operating layer for residents, ward officers, dispatch
            teams, and drivers.
          </p>
          <div className="auth-feature-pills">
            <div className="feature-pill">
              <span className="pill-dot lime" />
              <span>Real-time fill signals</span>
            </div>
            <div className="feature-pill">
              <span className="pill-dot cyan" />
              <span>Automated route sequencing</span>
            </div>
            <div className="feature-pill">
              <span className="pill-dot coral" />
              <span>Accountable civic response</span>
            </div>
          </div>
        </motion.div>
        <div className="auth-bottom">
          SafaiTrack <small>Connected collection. Accountable response.</small>
        </div>
      </div>
      <div className="auth-form-wrap">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Link to="/" className="auth-back-link">
            <ArrowLeft size={18} />
            <b>Return to SafaiTrack</b>
          </Link>
        </motion.div>
        <motion.form
          className="auth-form"
          autoComplete="off"
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, ease }}
          onSubmit={async event => {
            event.preventDefault();
            if (register && missingRequirements.length) {
              setError(`Password requires ${missingRequirements.join(", ")}.`);
              return;
            }
            if (register && !isValidBdPhone(phone)) {
              setError("Please enter a valid Bangladeshi mobile number (e.g. +8801991000166 or 01991000166).");
              return;
            }
            const backendRole = ROLE_PRESETS[role].backendRole;
            if (register && backendRole === "WardOfficer" && !requestedWardId) {
              setError("Which ward are you applying for? Please select a ward.");
              return;
            }
            setBusy(true);
            setError("");
            try {
              const emailToUse = email.trim();
              const { data } = await apiClient.post(
                `/api/auth/${register ? "register" : "login"}`,
                {
                  email: emailToUse,
                  password,
                  ...(register
                    ? {
                        fullName: name.trim(),
                        phoneNumber: phone.trim(),
                        gender,
                        role: backendRole,
                        ...(backendRole === "WardOfficer" ? { requestedWardId: Number(requestedWardId) } : {}),
                      }
                    : {}),
                }
              );
              if (register && data.status === "PendingApproval") {
                setPendingSuccess(data.message || "Your registration has been submitted and is pending admin approval.");
                return;
              }
              login(data.token, {
                fullName: data.fullName,
                email: emailToUse,
                role: data.role,
              });
              localStorage.setItem("safaitrack_active_role", role);
              navigate("/home", { replace: true });
            } catch (err) {
              setError(apiError(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="auth-header-row">
            <span className="access-layer-badge">
              <span className="access-dot" /> ACCESS LAYER
            </span>
            <div className="key-icon-box" title="Protected Access">
              <Key size={17} />
            </div>
          </div>
          <div>
            <h2>
              {register ? "Join the response layer." : "Welcome back."}
              <br />
              <span className="purpose-highlight">Move with purpose.</span>
            </h2>
            <p className="auth-subtitle">
              {register
                ? "Choose how you’ll help make civic handoffs visible."
                : "Sign in to pick up the next useful signal in your ward."}
            </p>
          </div>

          {pendingSuccess ? (
            <div
              className="auth-success-banner"
              role="status"
              style={{
                color: "#0f5132",
                background: "#d1e7dd",
                border: "1px solid #badbcc",
                borderRadius: 10,
                padding: "20px 22px",
                textAlign: "center",
                display: "flex",
                flexDirection: "column",
                gap: 12,
                marginTop: 12,
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 17, color: "#0a3622" }}>Registration Received!</div>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: "#0f5132" }}>{pendingSuccess}</p>
              <p style={{ margin: 0, fontSize: 13, color: "#146c43" }}>
                An Administrator will review your credentials and assign your ward before you can sign in.
              </p>
              <Link
                to="/login"
                className="lime-button full open-access-btn"
                style={{ textDecoration: "none", marginTop: 8, textAlign: "center" }}
              >
                Return to Sign In
              </Link>
            </div>
          ) : (
            <div className="form-fields">
              {register && (
                <div className="field-group">
                  <label htmlFor="auth-name">Your name</label>
                  <div className="input-with-icon">
                    <User size={17} className="field-icon" />
                    <input
                      id="auth-name"
                      name="name"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      required
                      maxLength={120}
                      autoComplete="off"
                      placeholder="e.g. Kabir Hossain"
                    />
                  </div>
                </div>
              )}
              <div className="field-group">
                <label htmlFor="auth-email">{register ? "Email address" : "Email or Registered Full Name"}</label>
                <div className="input-with-icon">
                  <Mail size={17} className="field-icon" />
                  <input
                    id="auth-email"
                    name="email"
                    type={register ? "email" : "text"}
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    autoComplete={register ? "email" : "username"}
                    placeholder={register ? "you@example.com" : "e.g. Karim Driver or driver@safaitrack.local"}
                  />
                </div>
              </div>
              {register && (
                <>
                  <div className="field-group">
                    <label htmlFor="auth-phone">Mobile number (Bangladesh) <span style={{ color: "#ef4444" }}>*</span></label>
                    <div className="input-with-icon">
                      <Phone size={17} className="field-icon" />
                      <input
                        id="auth-phone"
                        name="phone"
                        type="tel"
                        value={phone}
                        onChange={e => setPhone(e.target.value)}
                        required
                        autoComplete="tel"
                        placeholder="+8801991000166"
                      />
                    </div>
                    <small style={{ color: "#64748b", fontSize: 12, marginTop: 4, display: "block" }}>
                      Format: +8801XXXXXXXXX or 01XXXXXXXXX
                    </small>
                  </div>

                  <div className="field-group">
                    <label>Gender <span style={{ color: "#ef4444" }}>*</span></label>
                    <div className="role-selector-box" ref={genderDropdownRef}>
                      <div className="role-current-display">
                        <span className="role-current-label">{gender}</span>
                      </div>
                      <button
                        type="button"
                        className="role-select-arrow-btn"
                        onClick={() => setGenderDropdownOpen(prev => !prev)}
                        aria-label="Toggle gender dropdown"
                        aria-expanded={genderDropdownOpen}
                      >
                        <ChevronRight
                          size={22}
                          strokeWidth={2.5}
                          className={`role-select-chevron ${genderDropdownOpen ? "open" : ""}`}
                        />
                      </button>

                      <AnimatePresence>
                        {genderDropdownOpen && (
                          <motion.div
                            className="role-dropdown-menu"
                            initial={{ opacity: 0, y: -6, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -6, scale: 0.98 }}
                            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                          >
                            {(["Male", "Female", "Other"] as const).map(g => (
                              <button
                                key={g}
                                type="button"
                                className={`role-dropdown-item ${gender === g ? "selected" : ""}`}
                                onClick={() => {
                                  setGender(g);
                                  setGenderDropdownOpen(false);
                                }}
                              >
                                <span className="dropdown-item-text">{g}</span>
                                {gender === g && (
                                  <Check
                                    size={18}
                                    strokeWidth={2.8}
                                    className="dropdown-item-check"
                                  />
                                )}
                              </button>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </>
              )}
              <div className="field-group">
                <label htmlFor="auth-password">Password</label>
                <div className="input-with-icon">
                  <Lock size={17} className="field-icon" />
                  <input
                    id="auth-password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    minLength={register ? 8 : 1}
                    autoComplete="new-password"
                    aria-describedby={register ? "password-requirements" : undefined}
                    aria-invalid={register && missingRequirements.length > 0}
                    placeholder="Enter your access key"
                  />
                  <button
                    type="button"
                    className="password-toggle-btn"
                    onClick={() => setShowPassword(value => !value)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </div>

              {register && missingRequirements.length > 0 && (
                <p id="password-requirements" role="alert">Password requires {missingRequirements.join(", ")}.</p>
              )}

              {/* Access as dropdown */}
              <div className="field-group">
                <label>Access as</label>
                <div className="role-selector-box" ref={roleDropdownRef}>
                  <div className="role-current-display">
                    <span className="role-badge-icon">
                      {role === "Ward Officer" ? (
                        <Shield size={22} />
                      ) : role === "Truck Driver" ? (
                        <Truck size={22} />
                      ) : role === "Citizen" ? (
                        <User size={22} />
                      ) : (
                        <Sparkles size={22} />
                      )}
                    </span>
                    <span className="role-current-label">{role}</span>
                  </div>
                  <button
                    type="button"
                    className="role-select-arrow-btn"
                    onClick={() => setRoleDropdownOpen(prev => !prev)}
                    aria-label="Toggle role dropdown"
                    aria-expanded={roleDropdownOpen}
                  >
                    <ChevronRight
                      size={22}
                      strokeWidth={2.5}
                      className={`role-select-chevron ${roleDropdownOpen ? "open" : ""}`}
                    />
                  </button>

                  <AnimatePresence>
                    {roleDropdownOpen && (
                      <motion.div
                        className="role-dropdown-menu"
                        initial={{ opacity: 0, y: -6, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -6, scale: 0.98 }}
                        transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                      >
                        {(
                          [
                            { name: "Ward Officer", icon: <Shield size={20} /> },
                            { name: "Truck Driver", icon: <Truck size={20} /> },
                            { name: "Citizen", icon: <User size={20} /> },
                            { name: "City Admin", icon: <Sparkles size={20} /> },
                          ] as const
                        ).map(item => (
                          <button
                            key={item.name}
                            type="button"
                            className={`role-dropdown-item ${role === item.name ? "selected" : ""}`}
                            onClick={() => handleSelectRole(item.name)}
                          >
                            <span className="dropdown-item-icon">{item.icon}</span>
                            <span className="dropdown-item-text">{item.name}</span>
                            {role === item.name && (
                              <Check
                                size={18}
                                strokeWidth={2.8}
                                className="dropdown-item-check"
                              />
                            )}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {register && role === "Ward Officer" && (
                <div className="field-group">
                  <label htmlFor="auth-ward">
                    Which ward are you applying for? <span style={{ color: "#d9534f" }}>*</span>
                  </label>
                  <select
                    id="auth-ward"
                    name="requestedWardId"
                    value={requestedWardId}
                    onChange={e => setRequestedWardId(e.target.value ? Number(e.target.value) : "")}
                    required
                    style={{
                      width: "100%",
                      padding: "12px 14px",
                      borderRadius: 10,
                      border: "1px solid #d2d6dc",
                      background: "#fff",
                      fontSize: 14,
                      color: "#1f2937",
                      cursor: "pointer",
                      outline: "none",
                    }}
                  >
                    <option value="">Select your ward</option>
                    {wards.map(w => (
                      <option key={w.wardId} value={w.wardId}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {error && (
                <div
                  className="auth-error-banner"
                  role="alert"
                  style={{
                    color: "#a32c26",
                    background: "#fff0ee",
                    border: "1px solid #e4aaa5",
                    borderRadius: 8,
                    padding: "12px 14px",
                  }}
                >
                  {error}
                </div>
              )}
              <motion.button
                type="submit"
                aria-label={register ? "Create account" : "Sign in"}
                whileHover={{ scale: busy ? 1 : 1.02 }}
                whileTap={{ scale: busy ? 1 : 0.98 }}
                disabled={busy || (register && missingRequirements.length > 0)}
                className="lime-button full open-access-btn"
              >
                {busy
                  ? "Authenticating..."
                  : register
                    ? "Create access layer"
                    : "Open access layer"}
                <ArrowUpRight size={22} strokeWidth={2.6} />
              </motion.button>
            </div>
          )}
          <div className="civic-workspace-footer">
            <span className="workspace-line" />
            <span className="workspace-text">PROTECTED CIVIC WORKSPACE</span>
            <span className="workspace-line" />
          </div>
          <div className="auth-switch">
            {register ? "Already have access?" : "Need an account?"}{" "}
            <Link to={register ? "/login" : "/register"}>
              {register ? "Sign in" : "Register here"}
            </Link>
          </div>
        </motion.form>
      </div>
    </div>
  );
}
