const API_BASE_URL = "http://localhost:8080";
function getToken() {
  return localStorage.getItem("chaintrace_token");
}

function requireLogin() {
  if (!getToken()) {
    window.location.href = "login.html";
  }
}

async function authFetch(url, options = {}) {
  const token = getToken();
  const headers = { ...(options.headers || {}), Authorization: `Bearer ${token}` };
  const response = await fetch(url, { ...options, headers });
  if (response.status === 401) {
    localStorage.removeItem("chaintrace_token");
    window.location.href = "login.html";
    throw new Error("Session expired.");
  }
  return response;
}