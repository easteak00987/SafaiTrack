import axios from "axios";

let inMemoryToken: string | null = null;

export function setAuthToken(token: string | null) {
  inMemoryToken = token;
}

export function getAuthToken(): string | null {
  return inMemoryToken;
}

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "",
  timeout: 20000,
  headers: {
    "Content-Type": "application/json",
  },
});

apiClient.interceptors.request.use(
  config => {
    if (inMemoryToken) {
      config.headers.Authorization = `Bearer ${inMemoryToken}`;
    }
    return config;
  },
  error => Promise.reject(error)
);

export default apiClient;

apiClient.interceptors.response.use(
  response => response,
  error => {
    if (
      error.response?.status === 401 &&
      inMemoryToken &&
      error.config?.headers?.Authorization === `Bearer ${inMemoryToken}` &&
      !error.config?.url?.includes("/auth/login")
    ) {
      window.dispatchEvent(new Event("safaitrack:unauthorized"));
    }
    return Promise.reject(error);
  }
);

export function apiError(error: any): string {
  if (!error.response)
    return "Cannot reach the API. Please retry when the service is available.";
  return (
    error.response.data?.message ||
    (error.response.status === 403
      ? "Your account does not have access to this action."
      : Object.values(error.response.data?.errors || {})
          .flat()
          .join(" ") || "The request could not be completed.")
  );
}
