#!/usr/bin/env python3
"""LinkedIn 1080x1080 slide — sanitized for browser Pyodide use.

Reads /stats.json from Pyodide virtual FS.
Writes /output.png.
Reads env vars DISPLAY_NAME, USE_LOGO ("1"/"0"), WINDOW_DAYS.
Claude logo expected at /logo.png in Pyodide FS.

Tradeoff: matplotlib's Inter/Andale Mono are unlikely to be available in the
Pyodide bundle. We use 'sans-serif' + 'monospace' fallbacks so matplotlib
substitutes its DejaVu defaults. Visual fidelity drops slightly vs. the
desktop original; acceptable for in-browser use.
"""
import json, math, os
from datetime import datetime, timedelta
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.image as mimage
import matplotlib.patheffects as pe
from matplotlib.patches import FancyBboxPatch, Rectangle
from matplotlib.offsetbox import OffsetImage, AnnotationBbox
from matplotlib.colors import LinearSegmentedColormap

# ============================================================================
# PALETTE
# ============================================================================
BG       = '#000000'
BG_2     = '#02060a'
MINT     = '#4ECD89'
MINT_2   = '#6CE8A3'
MINT_PEAK = '#A8FFD0'
INK      = '#FFFFFF'
INK_3    = '#9aa1a8'
INK_4    = '#54595e'
LINE_2   = '#33363a'

MINT_CMAP = LinearSegmentedColormap.from_list('mint', [
    (0.00, '#08110b'),
    (0.15, '#0e2c1a'),
    (0.30, '#16482a'),
    (0.45, '#1f6c3d'),
    (0.60, '#2c9456'),
    (0.75, MINT),
    (0.88, MINT_2),
    (1.00, MINT_PEAK),
], N=256)

def mint_at(v):
    rgba = MINT_CMAP(max(0.0, min(1.0, v)))
    return '#%02x%02x%02x' % (int(rgba[0]*255), int(rgba[1]*255), int(rgba[2]*255))

def smooth_glow(color, sigma_pts=8.0, max_dist_pts=16.0, n_layers=18, peak_alpha=0.55):
    distances = np.linspace(0.4, max_dist_pts, n_layers)
    def T(d): return peak_alpha * math.exp(-(d / sigma_pts) ** 2)
    strokes = []
    prev_T = peak_alpha
    for d in distances:
        t_now = T(d)
        layer_alpha = max(0.0, prev_T - t_now)
        prev_T = t_now
        if layer_alpha > 0.0008:
            strokes.append(pe.Stroke(linewidth=2 * d, foreground=color, alpha=layer_alpha))
    strokes.append(pe.Normal())
    return strokes

# ============================================================================
# FONTS — fallbacks for Pyodide. See module docstring.
# ============================================================================
INTER = 'sans-serif'
MONO  = 'monospace'

# ============================================================================
# LAYOUT
# ============================================================================
LEFT  = 0.07
RIGHT = 0.93
WIDTH = RIGHT - LEFT

EYEBROW_Y      = 0.952
EYEBROW_RULE_X = 0.495
EYEBROW_RULE_Y = 0.945

TITLE1_Y = 0.908
TITLE2_Y = 0.847
SUB_Y    = 0.762
DIV1_Y   = 0.733

HM_LEFT  = (1 - 0.77) / 2
HM_W     = 0.77
HM_TOP   = 0.722
HM_H     = 0.32

LEG_Y    = 0.395
DIV2_Y   = 0.358

KPI_TOP  = 0.290
KPI_GAP  = 0.018
KPI_COLW = (WIDTH - 3 * KPI_GAP) / 4

DIV3_Y      = 0.105
FOOTER_Y    = 0.058
LOGO_ZOOM   = 0.0225

# ============================================================================
# I/O
# ============================================================================
DISPLAY_NAME = os.environ.get("DISPLAY_NAME", "Andrew")
USE_LOGO     = os.environ.get("USE_LOGO", "1") == "1"
WINDOW_DAYS  = int(os.environ.get("WINDOW_DAYS", "30"))
STATS_PATH   = "/stats.json"
LOGO_PATH    = "/logo.png"
OUT_PATH     = "/output.png"

DPI = 200
SQ  = 5.4

plt.rcParams.update({
    'font.family': INTER,
    'figure.facecolor': BG,
    'axes.facecolor': BG,
    'text.color': INK,
    'axes.linewidth': 0,
    'xtick.major.width': 0,
    'ytick.major.width': 0,
})
# 'text.parse_math' (added in matplotlib 3.4) is unrecognized in older Pyodide
# matplotlib builds — set it best-effort, swallow the KeyError otherwise.
try:
    plt.rcParams['text.parse_math'] = False
except (KeyError, ValueError):
    pass

with open(STATS_PATH) as f:
    d = json.load(f)
totals = d["totals"]
day_series = d["day_series"]
first_date = datetime.fromisoformat(day_series[0]["date"]).date()
last_date  = datetime.fromisoformat(day_series[-1]["date"]).date()

def load_inverted_claude_logo(path):
    img = mimage.imread(path)
    if img.shape[-1] == 3:
        img = np.dstack([img, np.ones(img.shape[:2], dtype=img.dtype)])
    rgb = img[..., :3].astype(np.float32).copy()
    a   = img[..., 3].astype(np.float32).copy()
    rng = rgb.max(-1) - rgb.min(-1)
    lum = rgb.mean(-1)
    is_gray = rng < 0.12
    light_gray = is_gray & (lum > 0.6)
    dark_gray  = is_gray & (lum <= 0.6)
    a = np.where(light_gray, 0.0, a)
    rgb[dark_gray] = 1.0
    return np.dstack([rgb, a])

def fmt_b(n): return f"{n/1_000_000_000:.1f}B"
def fmt_m(n): return f"{n/1_000_000:.1f}M"
def fmt_k(n):
    if n >= 1_000_000: return f"{n/1_000_000:.1f}M"
    return f"{n/1_000:.0f}K"

def render(use_logo, out_path):
    fig = plt.figure(figsize=(SQ, SQ), facecolor=BG)

    fig.text(LEFT, EYEBROW_Y, f'{WINDOW_DAYS} DAYS  ·  CLAUDE CODE',
             fontsize=8.5, color=MINT, fontfamily=MONO,
             va='top', ha='left', fontweight='regular')
    fig.patches.append(Rectangle((EYEBROW_RULE_X, EYEBROW_RULE_Y),
                                 RIGHT - EYEBROW_RULE_X, 0.0008,
                                 facecolor=LINE_2, alpha=0.6,
                                 transform=fig.transFigure))

    title1 = f"{DISPLAY_NAME}'s month with" if use_logo else "I'M ADDICTED TO"
    title1_y = TITLE1_Y + (0.001852 if use_logo else 0.0)
    fig.text(LEFT, title1_y, title1,
             fontsize=30, color=INK, fontweight=500,
             va='top', ha='left')

    if use_logo:
        try:
            logo_img = load_inverted_claude_logo(LOGO_PATH)
            logo_h_fig = 0.0675
            logo_w_fig = logo_h_fig * (1280 / 275)
            logo_ax = fig.add_axes([LEFT, TITLE2_Y - logo_h_fig - 0.00462, logo_w_fig, logo_h_fig])
            logo_ax.imshow(logo_img, interpolation='bilinear')
            logo_ax.set_axis_off()
        except Exception:
            # If logo missing, fall back to wordmark
            fig.text(LEFT, TITLE2_Y, "CLAUDE CODE.",
                     fontsize=30, color=MINT_2, fontweight=500,
                     va='top', ha='left')
    else:
        claude_txt = fig.text(LEFT, TITLE2_Y, "CLAUDE CODE.",
                 fontsize=30, color=MINT_2, fontweight=500,
                 va='top', ha='left')
        claude_txt.set_path_effects(smooth_glow(MINT,
            sigma_pts=10.0, max_dist_pts=20.0, n_layers=22, peak_alpha=0.55))

    sub = f"{totals['messages']:,} assistant messages,  {totals.get('lines_added',0):,} lines of code"
    fig.text(LEFT, SUB_Y, sub,
             fontsize=10, color=INK_3, fontweight=300,
             va='top', ha='left')

    fig.patches.append(Rectangle((LEFT, DIV1_Y), WIDTH, 0.0008,
                                 facecolor=LINE_2, alpha=0.7,
                                 transform=fig.transFigure))

    # ---- HEATMAP ----
    hm_ax = fig.add_axes([HM_LEFT, HM_TOP - HM_H, HM_W, HM_H])
    # Number of weeks in window: ceil(window/7) +1 for partial
    # Number of weeks (rows) needed = ceil((window + start-of-week offset) / 7).
    # Previous formula assumed worst-case offset=6 every time, which over-counted
    # by a row in most cases (e.g. 30d starting on a Wed → 6 rows, 12 blank cells).
    _offset = first_date.weekday()  # 0=Mon..6=Sun
    n_weeks = math.ceil((WINDOW_DAYS + _offset) / 7)
    hm_ax.set_xlim(0, 7)
    hm_ax.set_ylim(-0.55, n_weeks + 0.20)
    hm_ax.invert_yaxis()
    hm_ax.set_axis_off()

    day_lookup = {x["date"]: x for x in day_series}
    max_out = max((x["output_tokens"] for x in day_series), default=1) or 1

    def cell_color_and_v(out):
        if out <= 0:
            return None, 0.0
        v = math.log10(1 + out) / math.log10(1 + max_out)
        return mint_at(v), v

    DOW = ['MON','TUE','WED','THU','FRI','SAT','SUN']
    for i, name in enumerate(DOW):
        hm_ax.text(i + 0.5, -0.30, name,
                   fontsize=7.5, color=MINT, fontfamily=MONO,
                   ha='center', va='center')

    grid_start = first_date - timedelta(days=first_date.weekday())

    cell_pad  = 0.10
    cell_size = 1.0 - 2*cell_pad

    for row in range(n_weeks):
        for col in range(7):
            cur = grid_start + timedelta(days=row*7 + col)
            info = day_lookup.get(cur.isoformat())
            x0 = col + cell_pad
            y0 = row + cell_pad
            if info is None:
                patch = FancyBboxPatch(
                    (x0, y0), cell_size, cell_size,
                    boxstyle="round,pad=0,rounding_size=0.10",
                    facecolor='none', edgecolor=LINE_2, linewidth=1.2, alpha=0.65,
                    transform=hm_ax.transData)
                hm_ax.add_patch(patch)
                continue
            out_tok = info["output_tokens"]
            color, v = cell_color_and_v(out_tok)
            if color is None:
                patch = FancyBboxPatch(
                    (x0, y0), cell_size, cell_size,
                    boxstyle="round,pad=0,rounding_size=0.10",
                    facecolor=BG_2, edgecolor=LINE_2, linewidth=0.7,
                    transform=hm_ax.transData)
                hm_ax.add_patch(patch)
                continue
            patch = FancyBboxPatch(
                (x0, y0), cell_size, cell_size,
                boxstyle="round,pad=0,rounding_size=0.10",
                facecolor=color, edgecolor='none',
                transform=hm_ax.transData)
            hm_ax.add_patch(patch)
            if v >= 0.92:
                peak = 0.12 + (v - 0.92) / 0.08 * 0.18
                patch.set_path_effects(smooth_glow(MINT_2,
                    sigma_pts=1.3, max_dist_pts=2.6, n_layers=8, peak_alpha=peak))
            is_dim_cell = v < 0.45
            txt_color = INK_3 if is_dim_cell else BG
            hm_ax.text(x0 + 0.10, y0 + 0.2166, str(cur.day),
                       fontsize=6.8, color=txt_color, fontfamily=MONO,
                       ha='left', va='center')

    # ---- HEATMAP LEGEND ----
    fig.text(LEFT + 0.045, LEG_Y, 'INTENSITY = OUTPUT TOKENS',
             fontsize=7, color=INK_4, fontfamily=MONO,
             ha='left', va='center_baseline')

    sw_w, sw_h   = 0.018, 0.012
    sw_gap       = 0.003
    LABEL_GAP    = 0.018

    leg_right    = RIGHT - 0.045
    total_sw     = 5 * sw_w + 4 * sw_gap
    LABEL_W      = 0.043

    sw_end    = leg_right - LABEL_W - LABEL_GAP
    sw_start  = sw_end - total_sw
    for i in range(5):
        sx = sw_start + i * (sw_w + sw_gap)
        sample_v = 0.18 + i * 0.20
        fig.patches.append(FancyBboxPatch(
            (sx, LEG_Y - sw_h/2), sw_w, sw_h,
            boxstyle="round,pad=0,rounding_size=0.002",
            facecolor=mint_at(sample_v), edgecolor='none',
            transform=fig.transFigure))
    fig.text(sw_end + LABEL_GAP, LEG_Y, 'MORE',
             fontsize=7, color=INK_4, fontfamily=MONO,
             ha='left', va='center_baseline')
    fig.text(sw_start - LABEL_GAP, LEG_Y, 'LESS',
             fontsize=7, color=INK_4, fontfamily=MONO,
             ha='right', va='center_baseline')

    fig.patches.append(Rectangle((LEFT, DIV2_Y), WIDTH, 0.0008,
                                 facecolor=LINE_2, alpha=0.7,
                                 transform=fig.transFigure))

    # ---- KPI ROW ----
    def kpi(x, y_top, w, eyebrow, value, sub):
        cx = x + w / 2
        bar_w = w * 0.34
        bar_h = 0.0022
        rule = FancyBboxPatch((cx - bar_w/2, y_top), bar_w, bar_h,
                              boxstyle=f"round,pad=0,rounding_size={bar_h/2}",
                              facecolor=MINT_2, edgecolor='none', alpha=0.95,
                              transform=fig.transFigure)
        fig.patches.append(rule)
        rule.set_path_effects(smooth_glow(MINT,
            sigma_pts=5.0, max_dist_pts=14.0, n_layers=40, peak_alpha=0.42))
        fig.text(cx, y_top - 0.02278, eyebrow,
                 fontsize=7.0, color=MINT, fontfamily=MONO,
                 ha='center', va='top')
        fig.text(cx, y_top - 0.0543, value,
                 fontsize=22, color=INK, fontweight=500,
                 ha='center', va='top')
        if sub:
            fig.text(cx, y_top - 0.110, sub,
                     fontsize=7.5, color=INK_3, fontweight=300,
                     ha='center', va='top')

    cache_read = totals.get('cache_read_tokens', 0)
    for i, (eb, val, sb) in enumerate([
        ('API LIST COST', f"${totals['estimated_cost_usd']/1000:,.1f}K",  "vs your sub"),
        ('OUTPUT TOKENS', fmt_m(totals['output_tokens']),                 f"{fmt_b(cache_read)} from cache"),
        ('PROMPTS SENT',  f"{totals['user_prompts']:,}",                  f"{fmt_k(totals['tool_calls'])} tool calls back"),
        ('ACTIVE DAYS',   f"{totals['active_days']}/{WINDOW_DAYS}",       f"{totals['current_streak']}-day streak"),
    ]):
        kpi(LEFT + i*(KPI_COLW + KPI_GAP), KPI_TOP, KPI_COLW, eb, val, sb)

    # ---- FOOTER ----
    fig.patches.append(Rectangle((LEFT, DIV3_Y), WIDTH, 0.0008,
                                 facecolor=LINE_2, alpha=0.6,
                                 transform=fig.transFigure))

    # ATAS logo bottom-left (loaded from /atas-logo.png in Pyodide FS).
    # LOGO_ZOOM was tuned for DPI=400; the in-browser renderer uses DPI=200,
    # so double the zoom to preserve the same physical size.
    try:
        atas = mimage.imread('/atas-logo.png')
        ab = AnnotationBbox(OffsetImage(atas, zoom=LOGO_ZOOM * (400 / DPI)),
                            (LEFT, FOOTER_Y),
                            xycoords='figure fraction', frameon=False,
                            box_alignment=(0, 0.5), zorder=10)
        fig.add_artist(ab)
    except Exception:
        # If the asset isn't available, fall back to a text label.
        fig.text(LEFT, FOOTER_Y, "ATAS",
                 fontsize=8, color=INK, fontfamily=MONO, fontweight=500,
                 ha='left', va='center')
    fig.text(RIGHT, FOOTER_Y,
             f"SOURCE  ~/.CLAUDE/PROJECTS  ·  {WINDOW_DAYS} DAYS  ·  TIKI.VC/MYMONTHWITHCLAUDE",
             fontsize=7, color=INK_4, fontfamily=MONO,
             ha='right', va='center')

    fig.savefig(out_path, dpi=DPI, facecolor=BG)
    plt.close(fig)


render(use_logo=USE_LOGO, out_path=OUT_PATH)
print(f"Wrote {OUT_PATH}")
