import axios from "axios";

export const api = axios.create({
  // Si usas Vite, define VITE_API_URL=http://localhost:4000
  baseURL: import.meta?.env?.VITE_API_URL || ""
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
