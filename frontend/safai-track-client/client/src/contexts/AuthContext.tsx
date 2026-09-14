import React, { createContext, useContext, useState } from "react";
import { setAuthToken } from "../lib/api-client";

export type UserRole = "Citizen" | "Admin" | "Driver" | "WardOfficer";

export interface AuthUser {
  fullName: string;
  email?: string;
  role: UserRole | string;
}

export interface AuthContextType {
  token: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  login: (token: string, user: AuthUser) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setTokenState] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);

  const login = (newToken: string, newUser: AuthUser) => {
    setTokenState(newToken);
    setUser(newUser);
    setAuthToken(newToken);
  };

  const logout = () => {
    setTokenState(null);
    setUser(null);
    setAuthToken(null);
  };

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        isAuthenticated: !!token,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
