const form = document.getElementById("upload-form");
const submitBtn = document.getElementById("submit-btn");
const resultArea = document.getElementById("result-area");
const fileInput = document.getElementById("file-input");
const collectedByInput = document.getElementById("collected-by");
const descriptionInput = document.getElementById("description");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  resultArea.innerHTML = "";

  const file = fileInput.files[0];
  if (!file) {
    showBanner("error", "Please choose a file first.");
    return;
  }
  if (!collectedByInput.value.trim()) {
    showBanner("error", "Please enter who collected this evidence.");
    return;
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("collectedBy", collectedByInput.value.trim());
  formData.append("description", descriptionInput.value.trim());

  setLoading(true);

  try {
    const response = await fetch(`${API_BASE_URL}/evidence/upload`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const errText = await safeErrorText(response);
      throw new Error(errText || `Upload failed (status ${response.status}).`);
    }

    const data = await response.json();
    const hash = data.hash || data.fingerprint || "";
    const shortHash = hash ? hash.slice(0, 12) : "unknown";

    showBanner(
      "success",
      `Evidence fingerprinted. Hash: <span class="hash">${escapeHtml(shortHash)}</span>${hash ? "..." : ""}`
    );

    form.reset();
  } catch (err) {
    showBanner("error", `Could not upload evidence. ${err.message || "Please try again."}`);
  } finally {
    setLoading(false);
  }
});

function setLoading(isLoading) {
  submitBtn.disabled = isLoading;
  submitBtn.textContent = isLoading ? "Uploading..." : "Upload & Fingerprint";
}

function showBanner(type, html) {
  resultArea.innerHTML = `<div class="status-banner ${type}">${html}</div>`;
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