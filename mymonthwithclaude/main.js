import { aggregate } from "./aggregate.js";
import { render } from "./render.js";
import { ENTRY, FORM_ENDPOINT } from "./config.js";

const $ = (id) => document.getElementById(id);

const state = {
  stats: null,
  pngBlob: null,
};

function setStatus(msg) {
  $("status").textContent = msg;
}

function getDisplayName() {
  return ($("name").value || "").trim();
}

function getEmail() { return $("email").value.trim(); }
function getOptin() { return $("optin").checked; }
function getWindow() {
  return parseInt(document.querySelector('input[name="window"]:checked').value, 10);
}
function getUseLogo() {
  return document.querySelector('input[name="style"]:checked').value === "logo";
}

async function onChooseFolder() {
  if (!window.showDirectoryPicker) {
    setStatus("This browser doesn't support the File System Access API. Use Chrome, Edge, Arc, or Brave.");
    return;
  }
  let dirHandle;
  try {
    dirHandle = await window.showDirectoryPicker({mode: "read"});
  } catch (e) {
    setStatus("Folder pick cancelled.");
    return;
  }
  setStatus("aggregating…");
  // Reset prior render so the user submits + regenerates intentionally.
  state.pngBlob = null;
  $("download").disabled = true;
  $("submit").disabled = true;
  try {
    const windowDays = getWindow();
    const stats = await aggregate(dirHandle, windowDays, (s) => setStatus(s));
    state.stats = stats;
    console.log("aggregate result:", stats);
    if (stats.files_scanned === 0) {
      setStatus("No .jsonl files found. Did you pick ~/.claude/projects (or its parent)? You can also pick a single project folder. Check the browser console for details.");
      return;
    }
    if (stats.totals.messages === 0) {
      setStatus(`Found ${stats.files_scanned} files but 0 messages in the last ${windowDays} days. Try a longer window, or check the timestamps in your JSONL.`);
      return;
    }
    setStatus(`Aggregated ${stats.files_scanned} files · ${stats.totals.messages} messages · ${stats.totals.active_days}/${windowDays} active days. Click "Submit & generate" to create your image.`);
    $("submit").disabled = false;
  } catch (e) {
    console.error(e);
    setStatus("aggregation failed: " + e.message);
  }
}

async function renderNow() {
  if (!state.stats) return;
  const blob = await render({
    stats: state.stats,
    displayName: getDisplayName(),
    useLogo: getUseLogo(),
    windowDays: getWindow(),
    onStatus: (s) => setStatus(s),
  });
  state.pngBlob = blob;
  const url = URL.createObjectURL(blob);
  const img = $("preview");
  img.src = url;
  img.style.display = "block";
  const ph = $("preview-placeholder");
  if (ph) ph.style.display = "none";
  $("download").disabled = false;
}

function downloadPNG() {
  if (!state.pngBlob) return;
  const a = document.createElement("a");
  a.href = URL.createObjectURL(state.pngBlob);
  a.download = `mymonthwithclaude-${getDisplayName().toLowerCase().replace(/\s+/g, "-")}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

async function submitToForm() {
  const name = getDisplayName();
  const email = getEmail();
  const t = state.stats.totals;
  const fullStats = JSON.stringify(state.stats);
  const truncated = fullStats.length > 30000 ? fullStats.slice(0, 30000) : fullStats;

  // URLSearchParams → application/x-www-form-urlencoded, the encoding
  // Google Forms /formResponse accepts most reliably under `no-cors`.
  const fd = new URLSearchParams();
  fd.append(ENTRY.name, name);
  fd.append(ENTRY.email, email);
  fd.append(ENTRY.optin, getOptin() ? "Yes" : "");
  fd.append(ENTRY.days, String(getWindow()));
  fd.append(ENTRY.messages, String(t.messages));
  fd.append(ENTRY.output_tokens, String(t.output_tokens));
  fd.append(ENTRY.cache_read, String(t.cache_read_tokens));
  fd.append(ENTRY.cost_usd, String(t.estimated_cost_usd));
  fd.append(ENTRY.active_days, String(t.active_days));
  fd.append(ENTRY.streak, String(t.current_streak));
  fd.append(ENTRY.full_stats, truncated);

  console.log("submitting form payload:", fd.toString());
  try {
    await fetch(FORM_ENDPOINT, {
      method: "POST",
      mode: "no-cors",
      headers: {"Content-Type": "application/x-www-form-urlencoded"},
      body: fd.toString(),
    });
  } catch (e) {
    // no-cors → opaque response. We optimistically continue.
    console.warn("form post error (likely opaque):", e);
  }
}

async function onSubmitAndGenerate() {
  if (!state.stats) {
    setStatus("Pick your ~/.claude/projects folder first.");
    return;
  }
  const name = getDisplayName();
  const email = getEmail();
  if (!name) {
    setStatus("Please enter a display name before submitting.");
    return;
  }
  if (!email) {
    setStatus("Please enter an email before submitting.");
    return;
  }
  if (!getOptin()) {
    setStatus("Email opt-in is required to submit.");
    return;
  }
  $("submit").disabled = true;
  try {
    setStatus("submitting…");
    await submitToForm();
    setStatus("Submitted. Generating PNG…");
    await renderNow();
    setStatus("Done. Click \"Download PNG\" to save.");
  } catch (e) {
    console.error(e);
    setStatus("generate failed: " + e.message);
  } finally {
    $("submit").disabled = false;
  }
}

window.addEventListener("DOMContentLoaded", () => {
  $("choose").addEventListener("click", onChooseFolder);
  $("download").addEventListener("click", downloadPNG);
  $("submit").addEventListener("click", onSubmitAndGenerate);
  // If style/window changes after a render, regenerate locally (no resubmit).
  document.querySelectorAll('input[name="style"], input[name="window"], #name').forEach(el => {
    el.addEventListener("change", async () => {
      if (state.pngBlob) {
        try { setStatus("regenerating…"); await renderNow(); setStatus("Done."); }
        catch (e) { setStatus("render failed: " + e.message); }
      }
    });
  });
  if (!window.showDirectoryPicker) {
    setStatus("This page needs the File System Access API (Chrome, Edge, Arc, Brave). Use one of those, or DM @andrewdchan for the CLI version.");
    $("choose").disabled = true;
  } else {
    setStatus("Ready. Pick your ~/.claude/projects folder to begin.");
  }
});
