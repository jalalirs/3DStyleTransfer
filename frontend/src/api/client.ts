import axios from "axios";

// In Docker: VITE_API_URL is "USE_PROXY" → use relative URLs (nginx proxies to backend)
// In dev: defaults to direct backend URL
const envUrl = import.meta.env.VITE_API_URL;
const API_BASE = envUrl === "USE_PROXY" ? "" : (envUrl || "http://localhost:8111");

export const api = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
});

export const getStaticUrl = (path: string) => `${API_BASE}/static/${path}`;

// Model file URL helper — handles both assets/ and storage/ paths
export const getModelUrl = (filePath: string) => {
  return `${API_BASE}/static/${filePath}`;
};
