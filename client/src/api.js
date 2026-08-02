const API = "/api";

async function request(path, { method = "GET", body, token } = {}) {
  const headers = {};
  if (body) headers["Content-Type"] = "application/json";
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const error = new Error(data?.message || "Something went wrong");
    error.status = res.status;
    throw error;
  }

  return data;
}

export const api = {
  register: (payload) => request("/auth/register", { method: "POST", body: payload }),
  login: (payload) => request("/auth/login", { method: "POST", body: payload }),
  createUrl: (originalUrl, token) =>
    request("/url", { method: "POST", body: { originalUrl }, token }),
  myUrls: (token) => request("/url/my-urls", { token }),
  analytics: (shortCode, token) => request(`/url/${shortCode}/analytics`, { token }),
  updateUrl: (shortCode, originalUrl, token) =>
    request(`/url/${shortCode}`, { method: "PUT", body: { originalUrl }, token }),
  deleteUrl: (shortCode, token) =>
    request(`/url/${shortCode}`, { method: "DELETE", token })
};
