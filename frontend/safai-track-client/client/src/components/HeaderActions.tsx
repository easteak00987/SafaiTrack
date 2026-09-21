import React, { useState, useEffect, useRef, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Bell,
  Check,
  ChevronRight,
  CircleAlert,
  ClipboardList,
  Compass,
  FileText,
  Filter,
  Gauge,
  LogOut,
  Mail,
  MapPin,
  Phone,
  Route as RouteIcon,
  Settings2,
  ShieldCheck,
  Sparkles,
  Truck,
  User,
  UserCheck,
  UserRound,
  X,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import {
  UserRole,
  UserProfile,
  DEMO_PROFILES,
  AppNotification,
  SearchItem,
  SEARCH_ITEMS,
} from "../lib/headerData";

import { apiClient, apiError } from "../lib/api-client";
import { useAuth } from "../contexts/AuthContext";

export type { UserRole, UserProfile, AppNotification, SearchItem };

interface HeaderActionsProps {
  currentUser: UserProfile;
  setCurrentUser: (profile: UserProfile) => void;
}

export function HeaderActions({ currentUser, setCurrentUser }: HeaderActionsProps) {
  const navigate = useNavigate();
  const [searchOpen, setSearchOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);

  // Keyboard shortcut Ctrl+K / Cmd+K to open search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      } else if (e.key === "Escape") {
        setSearchOpen(false);
        setNotifOpen(false);
        setProfileOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleRoleSwitch = (newRole: UserRole) => {
    const profile = DEMO_PROFILES[newRole];
    setCurrentUser(profile);
    setProfileOpen(false);
    toast.success(`Switched role to ${newRole} (${profile.name})`);
  };

  return (
    <>
      <div className="top-actions top-actions-enhanced">
        {/* 1. Search Button (Enlarged) */}
        <button
          className="icon-button icon-button-lg"
          onClick={() => setSearchOpen(true)}
          title="Search bins, complaints, fleet (Ctrl+K)"
          aria-label="Search"
        >
          <Search size={22} strokeWidth={2.2} />
          <span className="kbd-shortcut">⌘K</span>
        </button>

        <NotificationAction currentUserRole={currentUser.role} />

        {/* 3. User Avatar Profile Button (Enlarged) */}
        <div className="popover-anchor">
          <button
            className={`mini-profile-btn ${profileOpen ? "active" : ""}`}
            onClick={() => {
              setProfileOpen((prev) => !prev);
              setNotifOpen(false);
            }}
            title={`${currentUser.name} (${currentUser.role})`}
            aria-label="User Profile"
          >
            <span
              className="mini-profile-avatar"
              style={{ backgroundColor: currentUser.avatarColor }}
            >
              {currentUser.initials}
            </span>
            <span className="profile-online-ring" />
          </button>

          {/* Profile Dropdown */}
          <AnimatePresence>
            {profileOpen && (
              <ProfileMenu
                currentUser={currentUser}
                onEditProfile={() => {
                  setProfileOpen(false);
                  setEditModalOpen(true);
                }}
                onSwitchRole={handleRoleSwitch}
                onClose={() => setProfileOpen(false)}
              />
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Global Search Modal */}
      {/* Global Search Modal */}
      <AnimatePresence>
        {searchOpen && (
          <SearchPalette
            currentUserRole={currentUser.role}
            onClose={() => setSearchOpen(false)}
            onSelect={(item) => {
              setSearchOpen(false);
              navigate(item.link);
            }}
          />
        )}
      </AnimatePresence>

      {/* Edit Personal Information Modal */}
      <AnimatePresence>
        {editModalOpen && (
          <EditProfileModal
            currentUser={currentUser}
            onSave={(updated) => {
              setCurrentUser(updated);
              setEditModalOpen(false);
              toast.success("Personal information updated successfully!");
            }}
            onClose={() => setEditModalOpen(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}

type StoredNotification = {
  notificationId: number; message: string; relatedComplaintId: number | null;
  isRead: boolean; createdAt: string;
};

export function NotificationAction({ currentUserRole }: { currentUserRole: UserRole }) {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    setItems([]);
    setLoading(true);
    const refresh = async () => {
      try {
        const { data } = await apiClient.get<StoredNotification[]>("/api/notifications");
        if (!active) return;
        setItems(data.map(n => ({
          id: String(n.notificationId), role: currentUserRole,
          title: "Complaint status updated", message: n.message, read: n.isRead,
          category: "info", timestamp: new Date(/Z$|[+-]\d{2}:\d{2}$/.test(n.createdAt) ? n.createdAt : n.createdAt + "Z").toLocaleString(),
          link: n.relatedComplaintId ? `/citizen/complaints/${n.relatedComplaintId}` : undefined,
        })));
        setError("");
      } catch (e) { if (active) setError(apiError(e)); }
      finally { if (active) setLoading(false); }
    };
    void refresh();
    const timer = window.setInterval(refresh, 30000);
    return () => { active = false; clearInterval(timer); };
  }, [token, currentUserRole, open]);
  const markRead = async (item: AppNotification) => {
    if (item.read) return;
    await apiClient.put(`/api/notifications/${item.id}/read`);
    setItems(previous => previous.map(n => n.id === item.id ? { ...n, read: true } : n));
  };
  const unread = items.filter(n => !n.read).length;
  return <div className="popover-anchor">
    <button className={`icon-button icon-button-lg ${open ? "active" : ""}`}
      aria-label="Notifications" title="Notifications" onClick={() => setOpen(value => !value)}>
      <Bell size={22} strokeWidth={2.2} />
      {unread > 0 && <span className="notification-badge-pulse">{unread}</span>}
    </button>
    <AnimatePresence>{open && <NotificationDrawer
      activeRole={currentUserRole} currentUserRole={currentUserRole}
      notifications={items} loading={loading} error={error}
      onMarkAllRead={async () => {
        try { await Promise.all(items.filter(n => !n.read).map(markRead)); setError(""); }
        catch (e) { setError(apiError(e)); }
      }}
      onItemClick={async item => {
        try { await markRead(item); setOpen(false); if (item.link) navigate(item.link); }
        catch (e) { setError(apiError(e)); }
      }} onClose={() => setOpen(false)} />}</AnimatePresence>
  </div>;
}

// -------------------------------------------------------------
// Sub-Component: Search Palette
// -------------------------------------------------------------
const ROLE_SEARCH_CATEGORIES: Record<UserRole, string[]> = {
  "Citizen": ["All", "Complaints", "Neighborhood Bins", "Quick Actions"],
  "Truck Driver": ["All", "My Route & Stops", "Assigned Bins", "Quick Actions"],
  "Ward Officer": ["All", "Bins & Sensors", "Complaints", "Fleet & Drivers", "Quick Actions"],
  "City Admin": ["All", "Bins & Sensors", "Complaints", "Fleet & Drivers", "Wards & Locations", "Quick Actions"],
};

const ROLE_SEARCH_PLACEHOLDERS: Record<UserRole, string> = {
  "Citizen": "Search your complaints, neighborhood bins, reporting guides...",
  "Truck Driver": "Search assigned stops, sequenced route, vehicle status...",
  "Ward Officer": "Search Ward 08 bins, complaints, field crew, routes...",
  "City Admin": "Search all bins, complaints, drivers, wards, routes...",
};

function SearchPalette({
  currentUserRole = "Ward Officer",
  onClose,
  onSelect,
}: {
  currentUserRole?: UserRole;
  onClose: () => void;
  onSelect: (item: SearchItem) => void;
}) {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("All");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const categories = useMemo(() => {
    return ROLE_SEARCH_CATEGORIES[currentUserRole] || ROLE_SEARCH_CATEGORIES["Ward Officer"];
  }, [currentUserRole]);

  // Reset active category if not present in new role's categories
  useEffect(() => {
    if (!categories.includes(activeCategory)) {
      setActiveCategory("All");
    }
  }, [categories, activeCategory]);

  const placeholder = ROLE_SEARCH_PLACEHOLDERS[currentUserRole] || "Search civic operations...";

  // First filter items accessible to this role
  const accessibleItems = useMemo(() => {
    if (currentUserRole === "City Admin") return SEARCH_ITEMS;
    return SEARCH_ITEMS.filter((item) => {
      if (!item.roles) return true;
      return item.roles.includes(currentUserRole);
    });
  }, [currentUserRole]);

  const filtered = useMemo(() => {
    return accessibleItems.filter((item) => {
      const matchCat = activeCategory === "All" || item.category === activeCategory;
      const matchQuery =
        !query ||
        item.title.toLowerCase().includes(query.toLowerCase()) ||
        item.subtitle.toLowerCase().includes(query.toLowerCase()) ||
        item.category.toLowerCase().includes(query.toLowerCase());
      return matchCat && matchQuery;
    });
  }, [query, activeCategory, accessibleItems]);

  return (
    <div className="search-palette-overlay" onClick={onClose}>
      <motion.div
        className="search-palette-modal"
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.94, y: -20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: -20 }}
        transition={{ duration: 0.2 }}
      >
        <div className="search-palette-header">
          <Search size={22} className="search-icon-muted" />
          <input
            ref={inputRef}
            type="text"
            className="search-palette-input"
            placeholder={placeholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button className="search-clear-btn" onClick={() => setQuery("")}>
              <X size={16} />
            </button>
          )}
          <span className="search-esc-hint" onClick={onClose}>
            ESC
          </span>
        </div>

        {/* Filter chips */}
        <div className="search-chips-row">
          {categories.map((cat) => (
            <button
              key={cat}
              className={`search-chip ${activeCategory === cat ? "active" : ""}`}
              onClick={() => setActiveCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Results List */}
        <div className="search-results-list">
          {filtered.length > 0 ? (
            filtered.map((item) => (
              <div
                key={item.id}
                className="search-result-row"
                onClick={() => onSelect(item)}
              >
                <div className="result-category-indicator" />
                <div className="result-info">
                  <div className="result-title-line">
                    <strong>{item.title}</strong>
                    {item.badge && (
                      <span className={`search-badge ${item.badgeTone || "blue"}`}>
                        {item.badge}
                      </span>
                    )}
                  </div>
                  <small>{item.subtitle}</small>
                </div>
                <ChevronRight size={16} className="result-arrow" />
              </div>
            ))
          ) : (
            <div className="search-empty-state">
              <CircleAlert size={28} />
              <p>No matching signals found for "{query}"</p>
              <small>Try searching "Dhanmondi", "Overflow", "Truck", or "Ward 08"</small>
            </div>
          )}
        </div>

        <div className="search-palette-footer">
          <span>Navigate with mouse or click to inspect</span>
          <span className="footer-tag">SafaiTrack Intelligence System</span>
        </div>
      </motion.div>
    </div>
  );
}

// -------------------------------------------------------------
// Sub-Component: Notification Drawer
// -------------------------------------------------------------
function NotificationDrawer({
  activeRole,
  currentUserRole,
  notifications,
  onMarkAllRead,
  onItemClick,
  onClose,
  loading,
  error,
}: {
  loading: boolean;
  error: string;
  activeRole: UserRole;
  currentUserRole: UserRole;
  notifications: AppNotification[];
  onMarkAllRead: () => void;
  onItemClick: (notif: AppNotification) => void;
  onClose: () => void;
}) {

  return (
    <motion.div
      className="notif-drawer-popover"
      initial={{ opacity: 0, y: 12, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 12, scale: 0.96 }}
      transition={{ duration: 0.2 }}
    >
      <div className="notif-drawer-header">
        <div>
          <div className="notif-eyebrow">
            <span className="pulse-dot-coral" /> CIVIC SIGNAL FEED
          </div>
          <h3>Notifications</h3>
        </div>
        <div className="notif-actions">
          <button className="notif-link-btn" onClick={onMarkAllRead}>
            Mark all read
          </button>
          <button className="notif-close-btn" aria-label="Close notifications" style={{ color: "#103b3c" }} onClick={onClose}>
            <X size={17} />
          </button>
        </div>
      </div>

      <div className="notif-role-tabs locked"><div className="locked-role-info">
        <span className="locked-role-chip">{currentUserRole} Feed</span>
      </div></div>
      {error && <p role="alert">{error}</p>}
      {/* Notification items */}
      <div className="notif-items-container">
        {loading ? <p role="status">Loading notifications...</p> : notifications.length > 0 ? (
          notifications.map((n) => (
            <div
              key={n.id}
              className={`notif-card ${n.read ? "read" : "unread"}`}
              onClick={() => onItemClick(n)}
            >
              <div className="notif-icon-col">
                <span className={`notif-type-icon ${n.category}`}>
                  {n.category === "alert" && <CircleAlert size={16} />}
                  {n.category === "warning" && <ClipboardList size={16} />}
                  {n.category === "success" && <Check size={16} />}
                  {n.category === "info" && <RouteIcon size={16} />}
                </span>
              </div>
              <div className="notif-body">
                <div className="notif-top-line">
                  <strong className="notif-title">{n.title}</strong>
                  <span className="notif-time">{n.timestamp}</span>
                </div>
                <p className="notif-msg">{n.message}</p>
                {n.link && (
                  <span className="notif-action-link">
                    Open signal <ChevronRight size={12} />
                  </span>
                )}
              </div>
              {!n.read && <span className="unread-dot" />}
            </div>
          ))
        ) : (
          <div className="notif-empty">
            <Check size={28} />
            <p>All caught up!</p>
            <small>No notifications for {activeRole}</small>
          </div>
        )}
      </div>

      <div className="notif-drawer-footer">
        <span>Logged as: <b>{currentUserRole}</b></span>
        <Link to="/settings" onClick={onClose} className="footer-settings-link">
          Alert Preferences <Settings2 size={13} />
        </Link>
      </div>
    </motion.div>
  );
}

// -------------------------------------------------------------
// Sub-Component: Profile Menu
// -------------------------------------------------------------
function ProfileMenu({
  currentUser,
  onEditProfile,
  onSwitchRole,
  onClose,
}: {
  currentUser: UserProfile;
  onEditProfile: () => void;
  onSwitchRole: (role: UserRole) => void;
  onClose: () => void;
}) {
  const navigate = useNavigate();

  const handleLogout = () => {
    onClose();
    toast.success("Signed out of SafaiTrack session");
    navigate("/login");
  };

  return (
    <motion.div
      className="profile-menu-popover"
      initial={{ opacity: 0, y: 12, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 12, scale: 0.96 }}
      transition={{ duration: 0.2 }}
    >
      {/* User Identity Card */}
      <div className="profile-card-header">
        <div
          className="profile-card-avatar"
          style={{ backgroundColor: currentUser.avatarColor }}
        >
          {currentUser.initials}
        </div>
        <div className="profile-card-meta">
          <strong>{currentUser.name}</strong>
          <span className="role-tag-chip">{currentUser.role}</span>
          <small>{currentUser.email}</small>
          <small className="ward-small">
            <MapPin size={11} /> {currentUser.ward}
          </small>
        </div>
      </div>

      <div className="profile-divider" />

      {/* Role Switcher Section */}
      <div className="quick-role-grid">
        {(["Ward Officer", "Citizen", "Truck Driver", "City Admin"] as UserRole[]).map((r) => (
          <button
            key={r}
            className={`quick-role-btn ${currentUser.role === r ? "active" : ""}`}
            onClick={() => onSwitchRole(r)}
          >
            <UserCheck size={14} />
            <span>{r}</span>
          </button>
        ))}
      </div>

      <div className="profile-divider" />

      {/* Navigation Options */}
      <div className="profile-menu-links">
        <button className="profile-menu-item" onClick={onEditProfile}>
          <User size={16} />
          <span>Edit personal information</span>
        </button>

        <Link
          to="/settings"
          className="profile-menu-item"
          onClick={onClose}
        >
          <Settings2 size={16} />
          <span>Workspace & System settings</span>
        </Link>

        <Link
          to="/citizen/complaints"
          className="profile-menu-item"
          onClick={onClose}
        >
          <ClipboardList size={16} />
          <span>Activity & Grievance record</span>
        </Link>

        <button className="profile-menu-item logout" onClick={handleLogout}>
          <LogOut size={16} />
          <span>Sign out</span>
        </button>
      </div>
    </motion.div>
  );
}

// -------------------------------------------------------------
// Sub-Component: Edit Profile Modal
// -------------------------------------------------------------
function EditProfileModal({
  currentUser,
  onSave,
  onClose,
}: {
  currentUser: UserProfile;
  onSave: (profile: UserProfile) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(currentUser.name);
  const [email, setEmail] = useState(currentUser.email);
  const [phone, setPhone] = useState(currentUser.phone);
  const [ward, setWard] = useState(currentUser.ward);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Please enter a valid name");
      return;
    }
    const initials = name
      .trim()
      .split(" ")
      .map((p) => p[0])
      .join("")
      .substring(0, 2)
      .toUpperCase();

    onSave({
      ...currentUser,
      name,
      email,
      phone,
      ward,
      initials: initials || currentUser.initials,
    });
  };

  return (
    <div className="search-palette-overlay" onClick={onClose}>
      <motion.div
        className="edit-profile-modal"
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.22 }}
      >
        <div className="edit-modal-head">
          <div>
            <span className="notif-eyebrow">
              <User size={13} /> PROFILE DIRECTORY
            </span>
            <h2>Edit Personal Information</h2>
          </div>
          <button className="notif-close-btn" aria-label="Close notifications" style={{ color: "#103b3c" }} onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="edit-profile-form">
          <div className="form-field">
            <label>Full Name</label>
            <div className="input-icon-wrap">
              <User size={16} />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter full name"
                required
              />
            </div>
          </div>

          <div className="form-row-2">
            <div className="form-field">
              <label>Email Address</label>
              <div className="input-icon-wrap">
                <Mail size={16} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@dncc.gov.bd"
                  required
                />
              </div>
            </div>

            <div className="form-field">
              <label>Phone Number</label>
              <div className="input-icon-wrap">
                <Phone size={16} />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+880 1711-xxxxxx"
                  required
                />
              </div>
            </div>
          </div>

          <div className="form-field">
            <label>Assigned Ward / Jurisdiction</label>
            <div className="input-icon-wrap">
              <MapPin size={16} />
              <input
                type="text"
                value={ward}
                onChange={(e) => setWard(e.target.value)}
                placeholder="Ward 08 / Dhanmondi"
                required
              />
            </div>
          </div>

          <div className="role-display-box">
            <span>Current Role:</span>
            <strong>{currentUser.role}</strong>
            <small>(Role can be switched anytime from the profile avatar menu)</small>
          </div>

          <div className="edit-modal-actions">
            <button type="button" className="outline-button" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="lime-button">
              Save changes <Check size={15} />
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
