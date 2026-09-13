const API_BASE_URL = "http://localhost:8080";
function getToken() {
  return localStorage.getItem("chaintrace_token");
}

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
    sessionStorage.setItem("chaintrace_return_to", window.location.pathname + window.location.search);
    localStorage.removeItem("chaintrace_token");
    window.location.href = "login.html";
    throw new Error("Session expired.");
  }
  return response;
}

function renderUserBar() {
  const token = getToken();
  if (!token) return;

  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    const bar = document.createElement("div");
    bar.style.cssText = "display:flex;align-items:center;gap:14px;";
    bar.innerHTML = `
      <span style="color:#b9c2d0;font-size:13px;font-weight:700;">${payload.name || payload.username}</span>
      <button id="logoutBtn" class="secondary small">Log Out</button>
    `;

    const nav = document.querySelector(".topbar nav");
    if (nav) nav.parentElement.appendChild(bar);

    document.getElementById("logoutBtn").addEventListener("click", () => {
      localStorage.removeItem("chaintrace_token");
      window.location.href = "login.html";
    });
  } catch (err) {
    // malformed token, ignore — requireLogin() will already redirect if needed
  }
}

function startInactivityWatcher(timeoutMinutes = 10) {
  const timeoutMs = timeoutMinutes * 60 * 1000;
  let timer;

  function logoutForInactivity() {
    sessionStorage.setItem("chaintrace_return_to", window.location.pathname + window.location.search);
    localStorage.removeItem("chaintrace_token");
    window.location.href = "login.html?reason=inactivity";
  }

  function resetTimer() {
    clearTimeout(timer);
    timer = setTimeout(logoutForInactivity, timeoutMs);
  }

  ["mousemove", "keydown", "click", "scroll", "touchstart"].forEach((evt) => {
    document.addEventListener(evt, resetTimer, { passive: true });
  });

  resetTimer();
}