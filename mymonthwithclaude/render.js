// Pyodide bootstrap + render orchestration.

const PYODIDE_URL = "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js";
const PYODIDE_INDEX = "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/";

let _pyodidePromise = null;
let _scriptPromise = null;

function loadPyodideScript() {
  if (_scriptPromise) return _scriptPromise;
  _scriptPromise = new Promise((resolve, reject) => {
    if (window.loadPyodide) return resolve();
    const s = document.createElement("script");
    s.src = PYODIDE_URL;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("pyodide script failed"));
    document.head.appendChild(s);
  });
  return _scriptPromise;
}

async function getPyodide(onStatus) {
  if (_pyodidePromise) return _pyodidePromise;
  _pyodidePromise = (async () => {
    onStatus && onStatus("loading Pyodide runtime (~10MB, one-time)…");
    await loadPyodideScript();
    const pyodide = await window.loadPyodide({indexURL: PYODIDE_INDEX});
    onStatus && onStatus("loading numpy + matplotlib…");
    await pyodide.loadPackage(["numpy", "matplotlib"]);

    onStatus && onStatus("loading renderer…");
    // Fetch the build script and the logo, mount into Pyodide FS
    // Cache-bust so updates to build_linkedin.py / logo deploy without a hard
    // refresh from every visitor. Bumped on each meaningful renderer change.
    const v = "5";
    const [pyText, logoBytes, atasBytes] = await Promise.all([
      fetch(`./build_linkedin.py?v=${v}`, {cache: "no-cache"}).then(r => r.text()),
      fetch(`./assets/Claude_AI_logo.svg.png?v=${v}`).then(r => r.arrayBuffer()),
      fetch(`./assets/atas-logo.png?v=${v}`).then(r => r.arrayBuffer()),
    ]);
    pyodide.FS.writeFile("/build_linkedin.py", pyText);
    pyodide.FS.writeFile("/logo.png", new Uint8Array(logoBytes));
    pyodide.FS.writeFile("/atas-logo.png", new Uint8Array(atasBytes));
    return pyodide;
  })();
  return _pyodidePromise;
}

export async function render({stats, displayName, useLogo, windowDays, onStatus}) {
  const pyodide = await getPyodide(onStatus);
  onStatus && onStatus("rendering PNG…");
  pyodide.FS.writeFile("/stats.json", JSON.stringify(stats));

  // Set env vars then run script
  pyodide.runPython(`
import os
os.environ["DISPLAY_NAME"] = ${JSON.stringify(displayName || "Andrew")}
os.environ["USE_LOGO"]     = ${JSON.stringify(useLogo ? "1" : "0")}
os.environ["WINDOW_DAYS"]  = ${JSON.stringify(String(windowDays))}
`);
  // Re-execute the script. Use exec on file contents so env vars apply this run.
  const code = pyodide.FS.readFile("/build_linkedin.py", {encoding: "utf8"});
  await pyodide.runPythonAsync(code);

  const bytes = pyodide.FS.readFile("/output.png");
  return new Blob([bytes], {type: "image/png"});
}

export function preloadPyodide(onStatus) {
  return getPyodide(onStatus).catch(e => {
    onStatus && onStatus("Pyodide failed to load: " + e.message);
  });
}
