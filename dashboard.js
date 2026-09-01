const tableEl = document.getElementById("evidence-table");
const tbody = document.getElementById("evidence-tbody");
const emptyState = document.getElementById("empty-state");
const loadingState = document.getElementById("loading-state");
const statusArea = document.getElementById("status-area");

loadEvidence();

async function loadEvidence() {
  try {
    const response = await fetch(`${API_BASE_URL}/evidence`);
    if (!response.ok) {
      throw new Error(`Server returned status ${response.status}.`);
    }
    const items = await response.json();
    renderTable(Array.isArray(items) ? items : []);
  } catch (err) {
    loadingState.style.display = "none";
    statusArea.innerHTML = `<div class="status-banner error">Could not load evidence list. ${escapeHtml(err.message || "")}</div>`;
  }
}

function renderTable(items) {
  loadingState.style.display = "none";

  if (items.length === 0) {
    emptyState.style.display = "block";
    return;
  }

  tbody.innerHTML = items.map(rowHtml).join("");
  tableEl.style.display = "table";
}

function rowHtml(item) {
  const id = item.id;
  const filename = escapeHtml(item.filename || "Untitled file");
  const collectedBy = escapeHtml(item.collectedBy || "—");
  const date = formatDate(item.uploadedAt || item.date || item.createdAt);
  const hash = item.hash || item.fingerprint || "";
  const shortHash = hash ? hash.slice(0, 12) + "..." : "—";

  return `
    <tr>
      <td data-label="Filename">${filename}</td>
      <td data-label="Collected By">${collectedBy}</td>
      <td data-label="Date">${date}</td>
      <td data-label="Hash"><span class="hash">${escapeHtml(shortHash)}</span></td>
      <td data-label="Actions" class="actions">
        <a href="custody.html?id=${encodeURIComponent(id)}">View Custody Trail</a>
        <a href="verify.html?id=${encodeURIComponent(id)}">Verify Integrity</a>
        <a href="${API_BASE_URL}/evidence/${encodeURIComponent(id)}/file" target="_blank">View Original File</a>
      </td>
    </tr>
  `;
}

function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return escapeHtml(String(value));
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}