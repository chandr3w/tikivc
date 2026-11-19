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
  state.stats = null;
  state.pngBlob = null;
  $("choose").disabled = true;
  $("download").disabled = true;
  $("submit").disabled = true;
  try {
    const windowDays = getWindow();
    const stats = await aggregate(dirHandle, windowDays, (s) => setStatus(s));
    if (stats.files_scanned === 0) {
      setStatus("No .jsonl files found. Did you pick ~/.claude/projects (or its parent)? You can also pick a single project folder. Check the browser console for details.");
      return;
    }
    if (stats.totals.messages === 0) {
      setStatus(`Found ${stats.files_scanned} files but 0 messages in the last ${windowDays} days. Try a longer window, or check the timestamps in your JSONL.`);
      return;
    }
    state.stats = stats;
    if (windowDays !== getWindow()) {
      setStatus("Choose your folder again to calculate stats for the new window.");
      return;
    }
    setStatus(`Aggregated ${stats.files_scanned} files · ${stats.totals.messages} messages · ${stats.totals.active_days}/${windowDays} active days. Click "Submit & generate" to create your image.`);
    $("submit").disabled = false;
  } catch (e) {
    console.error(e);
    setStatus("aggregation failed: " + e.message);
  } finally {
    $("choose").disabled = false;
  }
}

async function renderNow() {
  if (!state.stats) return;
  const blob = await render({
    stats: state.stats,
    displayName: getDisplayName(),
    useLogo: getUseLogo(),
    windowDays: state.stats.window_days,
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
  fd.append(ENTRY.days, String(state.stats.window_days));
  fd.append(ENTRY.messages, String(t.messages));
  fd.append(ENTRY.output_tokens, String(t.output_tokens));
  fd.append(ENTRY.cache_read, String(t.cache_read_tokens));
  fd.append(ENTRY.cost_usd, String(t.estimated_cost_usd));
  fd.append(ENTRY.active_days, String(t.active_days));
  fd.append(ENTRY.streak, String(t.current_streak));
  fd.append(ENTRY.full_stats, truncated);

  await fetch(FORM_ENDPOINT, {
    method: "POST",
    mode: "no-cors",
    headers: {"Content-Type": "application/x-www-form-urlencoded"},
    body: fd.toString(),
  });
}

async function onSubmitAndGenerate() {
  if (!state.stats) {
    setStatus("Pick your ~/.claude/projects folder first.");
    return;
  }
  if (state.stats.window_days !== getWindow()) {
    setStatus("Choose your folder again to calculate stats for the new window.");
    return;
  }
  const name = getDisplayName();
  const email = getEmail();
  if (!name) {
    setStatus("Please enter a display name before submitting.");
    return;
  }
  if (!email || !$("email").validity.valid) {
    setStatus("Please enter a valid email before submitting.");
    $("email").focus();
    return;
  }
  if (!getOptin()) {
    setStatus("Email opt-in is required to submit.");
    return;
  }
  $("submit").disabled = true;
  $("choose").disabled = true;
  const windows = document.querySelectorAll('input[name="window"]');
  windows.forEach(input => { input.disabled = true; });
  try {
    setStatus("submitting…");
    let networkFailed = false;
    try {
      await submitToForm();
    } catch (e) {
      networkFailed = true;
      console.warn("Form request failed:", e);
    }
    setStatus("Generating PNG…");
    await renderNow();
    setStatus(networkFailed
      ? 'The submission request failed. Your PNG is ready. Click "Download PNG" to save.'
      : 'Done. Click "Download PNG" to save.');
  } catch (e) {
    console.error(e);
    setStatus("generate failed: " + e.message);
  } finally {
    $("submit").disabled = false;
    $("choose").disabled = false;
    windows.forEach(input => { input.disabled = false; });
  }
}

window.addEventListener("DOMContentLoaded", () => {
  $("choose").addEventListener("click", onChooseFolder);
  $("download").addEventListener("click", downloadPNG);
  $("submit").addEventListener("click", onSubmitAndGenerate);
  document.querySelectorAll('input[name="window"]').forEach(el => {
    el.addEventListener("change", () => {
      if (state.stats && state.stats.window_days !== getWindow()) {
        $("submit").disabled = true;
        setStatus("Choose your folder again to calculate stats for the new window.");
      } else if (state.stats) {
        $("submit").disabled = false;
        setStatus("Click \"Submit & generate\" to create your image.");
      }
    });
  });
  // If the style or display name changes after a render, regenerate locally.
  document.querySelectorAll('input[name="style"], #name').forEach(el => {
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
