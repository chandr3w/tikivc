// Subset of aggregate.py — JS port for browser use.
// Computes only the fields needed by build_linkedin.py.

const PRICING = {
  "claude-opus-4-7":   {in: 15.00, out: 75.00, cache_w5m: 18.75, cache_w1h: 30.00, cache_r: 1.50},
  "claude-opus-4-6":   {in: 15.00, out: 75.00, cache_w5m: 18.75, cache_w1h: 30.00, cache_r: 1.50},
  "claude-opus-4-5":   {in: 15.00, out: 75.00, cache_w5m: 18.75, cache_w1h: 30.00, cache_r: 1.50},
  "claude-opus-4-1":   {in: 15.00, out: 75.00, cache_w5m: 18.75, cache_w1h: 30.00, cache_r: 1.50},
  "claude-opus-4":     {in: 15.00, out: 75.00, cache_w5m: 18.75, cache_w1h: 30.00, cache_r: 1.50},
  "claude-sonnet-4-6": {in:  3.00, out: 15.00, cache_w5m:  3.75, cache_w1h:  6.00, cache_r: 0.30},
  "claude-sonnet-4-5": {in:  3.00, out: 15.00, cache_w5m:  3.75, cache_w1h:  6.00, cache_r: 0.30},
  "claude-sonnet-4":   {in:  3.00, out: 15.00, cache_w5m:  3.75, cache_w1h:  6.00, cache_r: 0.30},
  "claude-haiku-4-5":  {in:  1.00, out:  5.00, cache_w5m:  1.25, cache_w1h:  2.00, cache_r: 0.10},
  "claude-3-5-haiku":  {in:  0.80, out:  4.00, cache_w5m:  1.00, cache_w1h:  1.60, cache_r: 0.08},
  "claude-3-5-sonnet": {in:  3.00, out: 15.00, cache_w5m:  3.75, cache_w1h:  6.00, cache_r: 0.30},
};

function priceFor(model) {
  if (!model || model === "<synthetic>") return null;
  const base = model.replace(/-(20\d{6})$/, "");
  if (PRICING[base]) return PRICING[base];
  for (const k of Object.keys(PRICING)) {
    if (base.startsWith(k)) return PRICING[k];
  }
  return PRICING["claude-opus-4-7"];
}

function isoDay(d) {
  // local-tz date
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

async function* iterJsonlFiles(dirHandle, depth = 0) {
  // Recursive (bounded depth) so it works whether the user picks
  // ~/.claude, ~/.claude/projects, or a single project folder.
  if (depth > 4) return;
  for await (const [name, handle] of dirHandle.entries()) {
    if (handle.kind === "file" && name.endsWith(".jsonl")) {
      yield handle;
    } else if (handle.kind === "directory") {
      yield* iterJsonlFiles(handle, depth + 1);
    }
  }
}

export async function aggregate(dirHandle, windowDays, onProgress) {
  const now = new Date();
  const cutoff = new Date(now.getTime() - windowDays * 24 * 3600 * 1000);

  const daily = new Map(); // day -> bucket
  function bucket(day) {
    let b = daily.get(day);
    if (!b) {
      b = {
        messages: 0,
        input_tokens: 0,
        output_tokens: 0,
        cache_creation: 0,
        cache_read: 0,
        cost: 0,
        tool_calls: 0,
        user_prompts: 0,
      };
      daily.set(day, b);
    }
    return b;
  }

  let totalLinesAdded = 0;
  let filesScanned = 0;

  for await (const fh of iterJsonlFiles(dirHandle)) {
    filesScanned++;
    if (onProgress) onProgress(`scanning file ${filesScanned}…`);
    let text;
    try {
      const f = await fh.getFile();
      text = await f.text();
    } catch (e) { continue; }
    const lines = text.split("\n");
    for (const line of lines) {
      if (!line) continue;
      let d;
      try { d = JSON.parse(line); } catch (e) { continue; }
      const ts = d.timestamp;
      if (!ts) continue;
      const when = new Date(ts);
      if (isNaN(when.getTime()) || when < cutoff) continue;
      const day = isoDay(when);
      const t = d.type;

      if (t === "assistant") {
        const msg = d.message || {};
        const usage = msg.usage || {};
        const model = msg.model;
        const inTok = usage.input_tokens || 0;
        const outTok = usage.output_tokens || 0;
        const cc = usage.cache_creation || {};
        let c5m = cc.ephemeral_5m_input_tokens || 0;
        const c1h = cc.ephemeral_1h_input_tokens || 0;
        if (!c5m && !c1h) c5m = usage.cache_creation_input_tokens || 0;
        const cr = usage.cache_read_input_tokens || 0;
        const pr = priceFor(model);
        const cost = pr ? (inTok*pr.in + outTok*pr.out + c5m*pr.cache_w5m + c1h*pr.cache_w1h + cr*pr.cache_r) / 1_000_000 : 0;

        const b = bucket(day);
        b.messages++;
        b.input_tokens += inTok;
        b.output_tokens += outTok;
        b.cache_creation += c5m + c1h;
        b.cache_read += cr;
        b.cost += cost;

        const content = msg.content;
        if (Array.isArray(content)) {
          for (const block of content) {
            if (block && block.type === "tool_use") {
              b.tool_calls++;
              const name = block.name;
              const input = block.input || {};
              if (name === "Write" && typeof input.content === "string") {
                totalLinesAdded += (input.content.match(/\n/g) || []).length;
              } else if (name === "Edit" && typeof input.new_string === "string") {
                const newLines = (input.new_string.match(/\n/g) || []).length;
                const oldLines = typeof input.old_string === "string" ? (input.old_string.match(/\n/g) || []).length : 0;
                const diff = newLines - oldLines;
                if (diff > 0) totalLinesAdded += diff;
              } else if (name === "MultiEdit" && Array.isArray(input.edits)) {
                for (const ed of input.edits) {
                  if (ed && typeof ed.new_string === "string") {
                    const nl = (ed.new_string.match(/\n/g) || []).length;
                    const ol = typeof ed.old_string === "string" ? (ed.old_string.match(/\n/g) || []).length : 0;
                    const diff = nl - ol;
                    if (diff > 0) totalLinesAdded += diff;
                  }
                }
              }
            }
          }
        }
      } else if (t === "user") {
        const msg = d.message || {};
        const content = msg.content;
        let text = "";
        let isToolResult = false;
        if (typeof content === "string") {
          text = content;
        } else if (Array.isArray(content)) {
          const onlyText = [];
          for (const block of content) {
            if (block && typeof block === "object") {
              if (block.type === "tool_result") isToolResult = true;
              else if (block.type === "text") onlyText.push(block.text || "");
            }
          }
          if (!isToolResult) text = onlyText.join("\n");
        }
        if (text && !text.startsWith("<")) {
          bucket(day).user_prompts++;
        }
      }
    }
  }

  // Build day series (oldest -> newest), zero-filled
  const day_series = [];
  for (let i = windowDays - 1; i >= 0; i--) {
    const dt = new Date(now.getTime() - i * 24 * 3600 * 1000);
    const k = isoDay(dt);
    const b = daily.get(k) || {messages:0, input_tokens:0, output_tokens:0, cache_creation:0, cache_read:0, cost:0, tool_calls:0, user_prompts:0};
    day_series.push({
      date: k,
      messages: b.messages,
      input_tokens: b.input_tokens,
      output_tokens: b.output_tokens,
      cache_creation: b.cache_creation,
      cache_read: b.cache_read,
      cost: Math.round(b.cost * 10000) / 10000,
      tool_calls: b.tool_calls,
      user_prompts: b.user_prompts,
    });
  }

  // Streak (consecutive trailing days with messages > 0)
  let current_streak = 0;
  for (let i = day_series.length - 1; i >= 0; i--) {
    if (day_series[i].messages > 0) current_streak++;
    else break;
  }

  const sum = (k) => day_series.reduce((a, b) => a + b[k], 0);
  const totals = {
    messages: sum("messages"),
    user_prompts: sum("user_prompts"),
    tool_calls: sum("tool_calls"),
    input_tokens: sum("input_tokens"),
    output_tokens: sum("output_tokens"),
    cache_creation_tokens: sum("cache_creation"),
    cache_read_tokens: sum("cache_read"),
    estimated_cost_usd: Math.round(sum("cost") * 100) / 100,
    active_days: day_series.filter(d => d.messages > 0).length,
    current_streak,
    lines_added: totalLinesAdded,
  };

  return {
    generated_at: now.toISOString(),
    window_days: windowDays,
    totals,
    day_series,
    files_scanned: filesScanned,
  };
}
