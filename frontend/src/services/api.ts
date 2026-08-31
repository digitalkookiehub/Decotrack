import axios from "axios";
import toast from "react-hot-toast";

const api = axios.create({
  baseURL: `${import.meta.env.VITE_API_URL || ""}/api/v1`,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 30000,
});

// Request interceptor: attach JWT
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor: handle 401 refresh + global error handling
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config as typeof error.config & {
      _retry?: boolean;
      _silent?: boolean;
    };

    // Network error
    if (!error.response) {
      if (error.code === "ECONNABORTED") {
        toast.error("Request timed out. Please try again.");
      } else if (!navigator.onLine) {
        toast.error("You are offline. Check your internet connection.");
      } else {
        toast.error("Cannot reach server. Is the backend running?");
      }
      return Promise.reject(error);
    }

    // 401 — try token refresh
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      localStorage.getItem("refresh_token")
    ) {
      originalRequest._retry = true;

      try {
        const refresh_token = localStorage.getItem("refresh_token");
        const { data } = await axios.post<{
          access_token: string;
          refresh_token: string;
        }>(
          `${import.meta.env.VITE_API_URL || ""}/api/v1/auth/refresh`,
          { refresh_token }
        );

        localStorage.setItem("access_token", data.access_token);
        localStorage.setItem("refresh_token", data.refresh_token);

        originalRequest.headers.Authorization = `Bearer ${data.access_token}`;
        return api(originalRequest);
      } catch {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        window.location.href = "/login";
        return Promise.reject(error);
      }
    }

    // 403 — forbidden
    if (error.response?.status === 403) {
      toast.error("You don't have permission for this action.");
    }

    // 500 — server error
    if (error.response?.status >= 500) {
      toast.error("Server error. Please try again later.");
    }

    return Promise.reject(error);
  }
);

export default api;
