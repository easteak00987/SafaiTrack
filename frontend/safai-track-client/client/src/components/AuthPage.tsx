import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowUpRight,
  Eye,
  EyeOff,
  Key,
  Lock,
  Mail,
  User,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { apiClient, apiError } from "../lib/api-client";

export default function AuthPage({ register = false }: { register?: boolean }) {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
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
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, ease }}
          onSubmit={async event => {
            event.preventDefault();
            const fields = new FormData(event.currentTarget);
            setBusy(true);
            setError("");
            try {
              const email = String(fields.get("email")).trim();
              const { data } = await apiClient.post(
                `/api/auth/${register ? "register" : "login"}`,
                {
                  email,
                  password: fields.get("password"),
                  ...(register
                    ? { fullName: fields.get("name"), role: "Citizen" }
                    : {}),
                }
              );
              login(data.token, {
                fullName: data.fullName,
                email,
                role: data.role,
              });
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
                ? "Create your citizen account to report and track local issues."
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
                    required
                    maxLength={120}
                    autoComplete="name"
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
                  required
                  autoComplete="username"
                  placeholder="you@example.com"
                />
              </div>
            </div>
            <div className="field-group">
              <label htmlFor="auth-password">Password</label>
              <div className="input-with-icon">
                <Lock size={17} className="field-icon" />
                <input
                  id="auth-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={register ? 6 : 1}
                  autoComplete={register ? "new-password" : "current-password"}
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
              disabled={busy}
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
