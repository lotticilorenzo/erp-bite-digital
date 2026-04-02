import axios from "axios";

const api = axios.create({
  baseURL: "/api/v1",
});

// Interceptor per aggiungere il token JWT
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("BITE_ERP_TOKEN");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor per gestire errori (es. 401)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("BITE_ERP_TOKEN");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export default api;
