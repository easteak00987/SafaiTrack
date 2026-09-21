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
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const roleDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (roleDropdownRef.current && !roleDropdownRef.current.contains(e.target as Node)) {
        setRoleDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotStep, setForgotStep] = useState<"email" | "token">("email");
  const [forgotEmail, setForgotEmail] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [generatedToken, setGeneratedToken] = useState("");
  const [forgotBusy, setForgotBusy] = useState(false);
  const [forgotError, setForgotError] = useState("");
  const [forgotSuccess, setForgotSuccess] = useState("");

  const handleSelectRole = (newRole: UserRole) => {
    setRole(newRole);
    setRoleDropdownOpen(false);
    setError("");
  };

  const handleGoogleSignIn = async () => {
    setBusy(true);
    setError("");
    try {
      const gEmail = email.trim() || prompt("Enter your Google Account Email:", "user@gmail.com");
      if (!gEmail) {
        setBusy(false);
        return;
      }
      const gName = name.trim() || gEmail.split("@")[0];
      const backendRole = ROLE_PRESETS[role].backendRole;

      const { data } = await apiClient.post("/api/auth/google", {
        email: gEmail,
        name: gName,
        role: backendRole,
      });

      login(data.token, {
        fullName: data.fullName,
        email: gEmail,
        role: data.role,
      });
      localStorage.setItem("safaitrack_active_role", role);
      navigate("/home", { replace: true });
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(false);
    }
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
            setBusy(true);
            setError("");
            try {
              const emailToUse = email.trim();
              const backendRole = ROLE_PRESETS[role].backendRole;
              const { data } = await apiClient.post(
                `/api/auth/${register ? "register" : "login"}`,
                {
                  email: emailToUse,
                  password,
                  ...(register
                    ? { fullName: name.trim(), role: backendRole }
                    : {}),
                }
              );
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
              <label htmlFor="auth-email">Email address</label>
              <div className="input-with-icon">
                <Mail size={17} className="field-icon" />
                <input
                  id="auth-email"
                  name="email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoComplete="off"
                  placeholder="you@example.com"
                />
              </div>
            </div>
            <div className="field-group">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <label htmlFor="auth-password">Password</label>
                {!register && (
                  <button
                    type="button"
                    className="forgot-password-link"
                    onClick={() => {
                      setShowForgotModal(true);
                      setForgotStep("email");
                      setForgotError("");
                      setForgotSuccess("");
                    }}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#558B2F",
                      fontWeight: 700,
                      fontSize: "14px",
                      cursor: "pointer",
                      padding: 0,
                    }}
                  >
                    Forgot password?
                  </button>
                )}
              </div>
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

            {/* Google Sign In Divider & Button */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "14px 0 6px" }}>
              <div style={{ flex: 1, height: 1, background: "rgba(16, 59, 60, 0.12)" }} />
              <span style={{ fontSize: 13, color: "#64748B", fontWeight: 700 }}>OR</span>
              <div style={{ flex: 1, height: 1, background: "rgba(16, 59, 60, 0.12)" }} />
            </div>

            <button
              type="button"
              className="google-auth-btn"
              disabled={busy}
              onClick={handleGoogleSignIn}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 12,
                width: "100%",
                minHeight: 52,
                borderRadius: 12,
                border: "1.5px solid rgba(16, 59, 60, 0.18)",
                background: "#FFFFFF",
                color: "#1E293B",
                fontWeight: 700,
                fontSize: 16,
                cursor: "pointer",
                transition: "all 0.2s ease",
                boxShadow: "0 2px 4px rgba(0,0,0,0.04)"
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.15C3.26 21.3 7.35 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.24c-.25-.72-.38-1.49-.38-2.24s.13-1.52.38-2.24V6.61H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.39l3.99-3.15z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.35 0 3.26 2.7 1.29 6.61l3.99 3.15c.95-2.85 3.6-4.96 6.72-4.96z"
                />
              </svg>
              <span>Continue with Google</span>
            </button>
          </div>

          {/* Password Reset Modal */}
          <AnimatePresence>
            {showForgotModal && (
              <div
                style={{
                  position: "fixed",
                  inset: 0,
                  background: "rgba(15, 23, 42, 0.65)",
                  backdropFilter: "blur(6px)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  zIndex: 9999,
                  padding: 20
                }}
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 10 }}
                  style={{
                    background: "#FFFFFF",
                    borderRadius: 16,
                    padding: 32,
                    maxWidth: 440,
                    width: "100%",
                    boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                    <h3 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#0F172A" }}>
                      {forgotStep === "email" ? "Reset Your Password" : "Enter Reset Token"}
                    </h3>
                    <button
                      type="button"
                      onClick={() => setShowForgotModal(false)}
                      style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#64748B" }}
                    >
                      ✕
                    </button>
                  </div>

                  {forgotError && (
                    <div style={{ background: "#FEF2F2", color: "#991B1B", border: "1px solid #FCA5A5", borderRadius: 8, padding: 12, fontSize: 14, marginBottom: 16 }}>
                      {forgotError}
                    </div>
                  )}

                  {forgotSuccess && (
                    <div style={{ background: "#F0FDF4", color: "#166534", border: "1px solid #86EFAC", borderRadius: 8, padding: 12, fontSize: 14, marginBottom: 16 }}>
                      {forgotSuccess}
                    </div>
                  )}

                  {forgotStep === "email" ? (
                    <form
                      onSubmit={async e => {
                        e.preventDefault();
                        if (!forgotEmail) return;
                        setForgotBusy(true);
                        setForgotError("");
                        setForgotSuccess("");
                        try {
                          const res = await apiClient.post("/api/auth/forgot-password", { email: forgotEmail });
                          if (res.data.token) {
                            setGeneratedToken(res.data.token);
                            setResetToken(res.data.token);
                            setForgotSuccess("Reset token generated! Proceeding to reset step.");
                            setForgotStep("token");
                          } else {
                            setForgotSuccess(res.data.message || "Reset link generated.");
                            setForgotStep("token");
                          }
                        } catch (err) {
                          setForgotError(apiError(err));
                        } finally {
                          setForgotBusy(false);
                        }
                      }}
                    >
                      <p style={{ color: "#64748B", fontSize: 15, marginTop: 0, marginBottom: 16 }}>
                        Enter your registered email address and we'll generate a password reset token for you.
                      </p>
                      <div className="field-group" style={{ marginBottom: 20 }}>
                        <label htmlFor="forgot-email-input">Email Address</label>
                        <div className="input-with-icon">
                          <Mail size={17} className="field-icon" />
                          <input
                            id="forgot-email-input"
                            type="email"
                            value={forgotEmail}
                            onChange={e => setForgotEmail(e.target.value)}
                            required
                            placeholder="you@example.com"
                          />
                        </div>
                      </div>
                      <button
                        type="submit"
                        disabled={forgotBusy}
                        className="lime-button full"
                        style={{ minHeight: 48 }}
                      >
                        {forgotBusy ? "Generating Token..." : "Request Reset Token"}
                      </button>
                    </form>
                  ) : (
                    <form
                      onSubmit={async e => {
                        e.preventDefault();
                        if (!resetToken || !newPassword) return;
                        setForgotBusy(true);
                        setForgotError("");
                        setForgotSuccess("");
                        try {
                          await apiClient.post("/api/auth/reset-password", {
                            email: forgotEmail,
                            token: resetToken,
                            newPassword,
                          });
                          setForgotSuccess("Password reset successfully! You can now log in.");
                          setTimeout(() => {
                            setShowForgotModal(false);
                            setEmail(forgotEmail);
                          }, 1800);
                        } catch (err) {
                          setForgotError(apiError(err));
                        } finally {
                          setForgotBusy(false);
                        }
                      }}
                    >
                      {generatedToken && (
                        <div style={{ background: "#F1F5F9", padding: 12, borderRadius: 8, marginBottom: 16, fontSize: 13, color: "#334155" }}>
                          <b>Generated Token:</b>
                          <div style={{ fontFamily: "monospace", background: "#E2E8F0", padding: "6px 8px", borderRadius: 4, marginTop: 4, wordBreak: "break-all" }}>
                            {generatedToken}
                          </div>
                        </div>
                      )}
                      <div className="field-group" style={{ marginBottom: 16 }}>
                        <label htmlFor="reset-token-input">Reset Token</label>
                        <div className="input-with-icon">
                          <Key size={17} className="field-icon" />
                          <input
                            id="reset-token-input"
                            value={resetToken}
                            onChange={e => setResetToken(e.target.value)}
                            required
                            placeholder="Paste reset token here"
                          />
                        </div>
                      </div>
                      <div className="field-group" style={{ marginBottom: 20 }}>
                        <label htmlFor="new-password-input">New Password</label>
                        <div className="input-with-icon">
                          <Lock size={17} className="field-icon" />
                          <input
                            id="new-password-input"
                            type="password"
                            value={newPassword}
                            onChange={e => setNewPassword(e.target.value)}
                            required
                            minLength={8}
                            placeholder="Min 8 chars (letters, numbers, symbol)"
                          />
                        </div>
                      </div>
                      <button
                        type="submit"
                        disabled={forgotBusy}
                        className="lime-button full"
                        style={{ minHeight: 48 }}
                      >
                        {forgotBusy ? "Resetting Password..." : "Reset Password"}
                      </button>
                    </form>
                  )}
                </motion.div>
              </div>
            )}
          </AnimatePresence>
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
