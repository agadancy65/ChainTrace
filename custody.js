const evidenceId = new URLSearchParams(window.location.search).get("id");

const headerLoading = document.getElementById("header-loading");
const headerArea = document.getElementById("header-area");
const fileNameEl = document.getElementById("file-name");
const originalHashEl = document.getElementById("original-hash");
const statusArea = document.getElementById("status-area");

const addEventBtn = document.getElementById("add-event-btn");
const addEventForm = document.getElementById("add-event-form");
const actionSelect = document.getElementById("action-select");
const actorInput = document.getElementById("actor-input");
const submitEventBtn = document.getElementById("submit-event-btn");
const addEventStatus = document.getElementById("add-event-status");

const checkChainBtn = document.getElementById("check-chain-btn");
const chainCheckResult = document.getElementById("chain-check-result");

const timelineLoading = document.getElementById("timeline-loading");
const timelineEl = document.getElementById("timeline");
const timelineEmpty = document.getElementById("timeline-empty");

if (!evidenceId) {
  statusArea.innerHTML = `<div class="status-banner error">No evidence selected. Go back to the <a href="dashboard.html">Evidence List</a> and choose a file.</div>`;
} else {
  loadFileHeader();
  loadTimeline();
}

addEventBtn.addEventListener("click", () => {
  addEventForm.classList.toggle("open");
});

submitEventBtn.addEventListener("click", submitCustodyEvent);
checkChainBtn.addEventListener("click", runChainCheck);

async function loadFileHeader() {
  try {
    const response = await fetch(`${API_BASE_URL}/evidence/${encodeURIComponent(evidenceId)}`);
    if (!response.ok) throw new Error(`Server returned status ${response.status}.`);
    const data = await response.json();

    fileNameEl.textContent = data.filename || "Untitled file";
    const hash = data.hash || data.fingerprint || "";
    originalHashEl.textContent = hash ? hash.slice(0, 12) + "..." : "—";

    headerLoading.style.display = "none";
    headerArea.style.display = "block";
  } catch (err) {
    headerLoading.style.display = "none";
    statusArea.innerHTML += `<div class="status-banner error">Could not load file details. ${escapeHtml(err.message || "")}</div>`;
  }
}

async function loadTimeline() {
  timelineLoading.style.display = "block";
  timelineEl.style.display = "none";
  timelineEmpty.style.display = "none";

  try {
    const response = await fetch(`${API_BASE_URL}/evidence/${encodeURIComponent(evidenceId)}/custody`);
    if (!response.ok) throw new Error(`Server returned status ${response.status}.`);
    const events = await response.json();
    renderTimeline(Array.isArray(events) ? events : []);
  } catch (err) {
    timelineLoading.style.display = "none";
    statusArea.innerHTML += `<div class="status-banner error">Could not load custody trail. ${escapeHtml(err.message || "")}</div>`;
  }
}

function renderTimeline(events) {
  timelineLoading.style.display = "none";

  if (events.length === 0) {
    timelineEmpty.style.display = "block";
    return;
  }

  timelineEl.innerHTML = events.map(eventHtml).join("");
  timelineEl.style.display = "block";
}

function eventHtml(evt) {
  const action = escapeHtml(evt.action || "Unknown action");
  const actor = escapeHtml(evt.actor || "Unknown actor");
  const timestamp = formatDateTime(evt.timestamp);
  const entryHash = shortHash(evt.entryHash);
  const previousHash = shortHash(evt.previousHash);

  return `
    <li>
      <div class="event-action">${action}</div>
      <div class="event-meta">${actor} · ${timestamp}</div>
      <div class="event-hashes">
        Entry: <span class="hash">${entryHash}</span> &nbsp; Previous: <span class="hash">${previousHash}</span>
      </div>
    </li>
  `;
}

async function submitCustodyEvent() {
  const action = actionSelect.value;
  const actor = actorInput.value.trim();

  if (!actor) {
    addEventStatus.innerHTML = `<div class="status-banner error">Please enter an actor name.</div>`;
    return;
  }

  submitEventBtn.disabled = true;
  submitEventBtn.textContent = "Adding...";
  addEventStatus.innerHTML = "";

  try {
    const response = await fetch(`${API_BASE_URL}/evidence/${encodeURIComponent(evidenceId)}/custody`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, actor }),
    });

    if (!response.ok) {
      const errText = await safeErrorText(response);
      throw new Error(errText || `Server returned status ${response.status}.`);
    }

    addEventStatus.innerHTML = `<div class="status-banner success">Custody event added.</div>`;
    actorInput.value = "";
    addEventForm.classList.remove("open");
    loadTimeline();
  } catch (err) {
    addEventStatus.innerHTML = `<div class="status-banner error">Could not add custody event. ${escapeHtml(err.message || "")}</div>`;
  } finally {
    submitEventBtn.disabled = false;
    submitEventBtn.textContent = "Add Event";
  }
}

async function runChainCheck() {
  checkChainBtn.disabled = true;
  checkChainBtn.textContent = "Checking...";
  chainCheckResult.innerHTML = `<div class="loading">Checking chain integrity...</div>`;

  try {
    const response = await fetch(`${API_BASE_URL}/evidence/${encodeURIComponent(evidenceId)}/chain-check`);
    if (!response.ok) throw new Error(`Server returned status ${response.status}.`);
    const data = await response.json();

    if (data.valid) {
      chainCheckResult.innerHTML = `<div class="status-banner success">Chain integrity verified. Every custody entry matches the one before it.</div>`;
    } else {
      const brokenAt = (data.brokenAt !== null && data.brokenAt !== undefined) ? ` at entry ${data.brokenAt + 1}` : "";
      chainCheckResult.innerHTML = `<div class="status-banner error">Chain integrity broken${brokenAt}. ${escapeHtml(data.reason || "The custody trail does not link up correctly from that point forward.")}</div>`;
    }
  } catch (err) {
    chainCheckResult.innerHTML = `<div class="status-banner error">Could not check chain integrity. ${escapeHtml(err.message || "")}</div>`;
  } finally {
    checkChainBtn.disabled = false;
    checkChainBtn.textContent = "Check Chain Integrity";
  }
}

function shortHash(hash) {
  return hash ? escapeHtml(hash.slice(0, 12)) + "..." : "—";
}

function formatDateTime(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return escapeHtml(String(value));
  return d.toLocaleString(undefined, {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

async function safeErrorText(response) {
  try {
    const data = await response.json();
    return data.message || data.error || "";
  } catch {
    return "";
  }
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}