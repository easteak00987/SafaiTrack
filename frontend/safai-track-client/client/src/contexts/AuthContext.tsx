import React, { createContext, useContext, useEffect, useState } from "react";
import { apiClient, setAuthToken } from "../lib/api-client";

export type UserRole = "Citizen" | "Admin" | "Driver" | "WardOfficer";
export interface AuthUser {
  id?: string;
  fullName: string;
  email?: string;
  role: string;
  wardId?: number;
}
interface AuthContextType {
  token: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  login: (token: string, user: AuthUser) => void;
  logout: () => void;
}
const AuthContext = createContext<AuthContextType | undefined>(undefined);
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const logout = () => {
    setAuthToken(null);
    setToken(null);
    setUser(null);
    localStorage.removeItem("safaitrack_active_role");
    sessionStorage.removeItem("safaitrack_token");
  };
  const login = (value: string, profile: AuthUser) => {
    setAuthToken(value);
    setToken(value);
    setUser(profile);
  };
  useEffect(() => {
    window.addEventListener("safaitrack:unauthorized", logout);
    return () => window.removeEventListener("safaitrack:unauthorized", logout);
  }, []);
  useEffect(() => {
    if (!token) return;
    let expiry: number;
    try {
      expiry =
        JSON.parse(
          atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))
        ).exp * 1000;
    } catch {
      logout();
      return;
    }
    const timer = window.setTimeout(logout, Math.max(0, expiry - Date.now()));
    let active = true;
    apiClient
      .get("/api/auth/me")
      .then(r => {
        if (active) setUser(r.data);
      })
      .catch(() => {
        if (active) logout();
      });
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [token]);
  return (
    <AuthContext.Provider
      value={{ token, user, isAuthenticated: !!token, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}
export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("AuthProvider is required.");
  return value;
}
