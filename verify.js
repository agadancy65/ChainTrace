const evidenceId = new URLSearchParams(window.location.search).get("id");

const pageTitle = document.getElementById("page-title");
const fileNameLine = document.getElementById("file-name-line");
const loadingState = document.getElementById("loading-state");
const resultContainer = document.getElementById("result-container");

if (!evidenceId) {
  loadingState.style.display = "none";
  resultContainer.innerHTML = `<div class="status-banner error">No evidence selected. Go back to the Evidence List and choose a file.</div>`;
} else {
  runVerification();
}

async function runVerification() {
  try {
    const response = await fetch(`${API_BASE_URL}/evidence/${encodeURIComponent(evidenceId)}/verify`);
    if (!response.ok) throw new Error(`Server returned status ${response.status}.`);
    const data = await response.json();

    loadingState.style.display = "none";
    pageTitle.textContent = "Verification Result";

    if (data.filename) {
      fileNameLine.textContent = data.filename;
    }

    if (data.match) {
      const dateText = data.originalDate ? formatDate(data.originalDate) : "collection";
      resultContainer.innerHTML = `
        <div class="verify-result match">
          <div class="verify-icon">✅</div>
          <div class="verify-headline">This file matches its original fingerprint.</div>
          <div class="verify-detail">No changes detected since ${escapeHtml(dateText)}.</div>
        </div>
      `;
    } else {
      resultContainer.innerHTML = `
        <div class="verify-result mismatch">
          <div class="verify-icon">⚠️</div>
          <div class="verify-headline">This file does NOT match its original fingerprint.</div>
          <div class="verify-detail">It may have been altered since collection.</div>
        </div>
      `;
    }
  } catch (err) {
    loadingState.style.display = "none";
    resultContainer.innerHTML = `<div class="status-banner error">Could not verify this file right now. ${escapeHtml(err.message || "Please try again.")}</div>`;
  }
}

function formatDate(value) {
  const d = new Date(value);
  if (isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}