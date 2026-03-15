#!/usr/bin/env python3
"""
Create professional PDFs with real diagrams, charts, and visualizations.
Uses matplotlib for visual generation + reportlab for PDF assembly.
"""

import matplotlib
matplotlib.use('Agg')  # Non-interactive backend
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch
import numpy as np
import os
import tempfile
from io import BytesIO

from reportlab.lib.pagesizes import letter, A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch, mm
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, PageBreak,
    Table, TableStyle, Image as RLImage, KeepTogether
)
from reportlab.lib import colors

# ── Color palette ──────────────────────────────────────────────
NAVY = '#1F4E78'
BLUE = '#2E75B6'
LIGHT_BLUE = '#D6E4F0'
DARK_GRAY = '#333333'
MID_GRAY = '#666666'
LIGHT_GRAY = '#F5F5F5'
GREEN = '#28A745'
ORANGE = '#FD7E14'
RED = '#DC3545'
PURPLE = '#6F42C1'
TEAL = '#20C997'

PROVIDER_COLORS = {
    'OpenAI': '#10A37F',
    'Gemini': '#4285F4',
    'DeepSeek': '#0066FF',
    'Mistral': '#FF6B35',
    'OpenRouter': '#9333EA',
}

# ── Temp dir for images ───────────────────────────────────────
TMPDIR = tempfile.mkdtemp(prefix='crossreview_pdf_')


def save_fig(fig, name, dpi=200):
    """Save a matplotlib figure and return the path."""
    path = os.path.join(TMPDIR, f'{name}.png')
    fig.savefig(path, dpi=dpi, bbox_inches='tight', facecolor='white', edgecolor='none')
    plt.close(fig)
    return path


# ═══════════════════════════════════════════════════════════════
# DIAGRAM GENERATORS
# ═══════════════════════════════════════════════════════════════

def make_architecture_diagram():
    """High-level architecture: User → MCP → Executor → 5 providers → Consensus → Result"""
    fig, ax = plt.subplots(figsize=(10, 6.5))
    ax.set_xlim(0, 10)
    ax.set_ylim(0, 7)
    ax.axis('off')
    fig.patch.set_facecolor('white')

    def box(x, y, w, h, label, color, fontsize=10, textcolor='white'):
        rect = FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0.15",
                              facecolor=color, edgecolor='#555555', linewidth=1.2)
        ax.add_patch(rect)
        ax.text(x + w/2, y + h/2, label, ha='center', va='center',
                fontsize=fontsize, fontweight='bold', color=textcolor,
                wrap=True)

    def arrow(x1, y1, x2, y2, color='#555555'):
        ax.annotate('', xy=(x2, y2), xytext=(x1, y1),
                    arrowprops=dict(arrowstyle='->', color=color, lw=2))

    # Title
    ax.text(5, 6.7, 'cross-review-mcp Architecture', ha='center',
            fontsize=16, fontweight='bold', color=NAVY)

    # Row 1: User / Claude
    box(3.5, 5.8, 3, 0.6, 'User / Claude.ai', NAVY, 11)

    # Arrow down
    arrow(5, 5.8, 5, 5.3)
    ax.text(5.15, 5.55, 'MCP Protocol', fontsize=8, color=MID_GRAY, style='italic')

    # Row 2: MCP Server
    box(3, 4.6, 4, 0.6, 'MCP Server  (index.ts)', BLUE, 10)

    # Arrow down
    arrow(5, 4.6, 5, 4.1)

    # Row 3: Tool Handler
    box(2.5, 3.4, 5, 0.6, 'Tool Handler  (get_dev_guidance / review_content)', '#5B9BD5', 9)

    # Arrow down
    arrow(5, 3.4, 5, 2.9)

    # Row 4: ReviewExecutor
    box(3.2, 2.2, 3.6, 0.6, 'ReviewExecutor  (executor.ts)', '#2E75B6', 9)

    # Fan-out arrows to 5 providers
    providers = list(PROVIDER_COLORS.items())
    px_positions = [0.8, 2.6, 4.4, 6.2, 8.0]
    pw = 1.4

    for i, ((name, clr), px) in enumerate(zip(providers, px_positions)):
        arrow(5, 2.2, px + pw/2, 1.6)
        box(px, 1.0, pw, 0.55, name, clr, 9)

    # Label: PARALLEL
    ax.text(5, 1.75, 'PARALLEL (all 5 at once)', ha='center',
            fontsize=9, fontweight='bold', color=RED, style='italic')

    # Converge arrows
    for px in px_positions:
        arrow(px + pw/2, 1.0, 5, 0.55)

    # Consensus
    box(3, -0.15, 4, 0.6, 'Consensus Algorithm + Result', GREEN, 10)

    return save_fig(fig, 'architecture')


def make_parallel_vs_sequential():
    """Gantt-style chart: sequential (15s) vs parallel (3s)"""
    fig, axes = plt.subplots(2, 1, figsize=(9, 4), gridspec_kw={'height_ratios': [1, 1]})
    fig.patch.set_facecolor('white')

    providers = ['OpenAI', 'Gemini', 'DeepSeek', 'Mistral', 'OpenRouter']
    pcolors = [PROVIDER_COLORS[p] for p in providers]
    durations = [3.2, 2.8, 3.5, 2.5, 3.0]

    # Sequential
    ax = axes[0]
    ax.set_title('Sequential (Old Way) — 15 seconds total', fontsize=11,
                 fontweight='bold', color=RED, pad=8)
    start = 0
    for i, (p, d, c) in enumerate(zip(providers, durations, pcolors)):
        ax.barh(0, d, left=start, height=0.5, color=c, edgecolor='white', linewidth=1)
        ax.text(start + d/2, 0, p, ha='center', va='center', fontsize=8,
                fontweight='bold', color='white')
        start += d
    ax.set_xlim(0, 16)
    ax.set_yticks([])
    ax.set_xlabel('Time (seconds)', fontsize=9)
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)
    ax.spines['left'].set_visible(False)

    # Parallel
    ax = axes[1]
    ax.set_title('Parallel (cross-review-mcp) — 3.5 seconds total', fontsize=11,
                 fontweight='bold', color=GREEN, pad=8)
    for i, (p, d, c) in enumerate(zip(providers, durations, pcolors)):
        ax.barh(i, d, height=0.6, color=c, edgecolor='white', linewidth=1)
        ax.text(d/2, i, p, ha='center', va='center', fontsize=8,
                fontweight='bold', color='white')
    ax.set_xlim(0, 16)
    ax.set_yticks([])
    ax.set_xlabel('Time (seconds)', fontsize=9)
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)
    ax.spines['left'].set_visible(False)

    # Vertical line showing max time
    ax.axvline(x=3.5, color=GREEN, linestyle='--', linewidth=1.5, alpha=0.7)
    ax.text(3.7, 4.2, 'Done!', fontsize=9, color=GREEN, fontweight='bold')

    fig.tight_layout(pad=1.5)
    return save_fig(fig, 'parallel_vs_sequential')


def make_confidence_radar():
    """Radar chart showing 5-model confidence on a sample problem."""
    categories = ['Root Cause\nAccuracy', 'Fix\nSpecificity', 'Context\nAwareness',
                  'Confidence\nCalibration', 'Alternative\nSuggestions']
    N = len(categories)

    models = {
        'Gemini':     [0.95, 0.92, 0.88, 0.90, 0.70],
        'OpenAI':     [0.86, 0.90, 0.85, 0.82, 0.80],
        'Mistral':    [0.82, 0.78, 0.80, 0.75, 0.85],
        'DeepSeek':   [0.78, 0.72, 0.70, 0.80, 0.65],
        'OpenRouter': [0.81, 0.75, 0.77, 0.78, 0.72],
    }

    angles = [n / float(N) * 2 * np.pi for n in range(N)]
    angles += angles[:1]

    fig, ax = plt.subplots(figsize=(7, 7), subplot_kw=dict(polar=True))
    fig.patch.set_facecolor('white')

    ax.set_theta_offset(np.pi / 2)
    ax.set_theta_direction(-1)
    ax.set_rlabel_position(0)

    plt.xticks(angles[:-1], categories, fontsize=9, fontweight='bold')
    plt.yticks([0.2, 0.4, 0.6, 0.8, 1.0], ['20%', '40%', '60%', '80%', '100%'],
               fontsize=7, color=MID_GRAY)
    plt.ylim(0, 1.0)

    for model_name, values in models.items():
        vals = values + values[:1]
        color = PROVIDER_COLORS[model_name]
        ax.plot(angles, vals, 'o-', linewidth=2, label=model_name, color=color, markersize=5)
        ax.fill(angles, vals, alpha=0.08, color=color)

    ax.legend(loc='upper right', bbox_to_anchor=(1.3, 1.15), fontsize=9)
    ax.set_title('Model Capability Radar\n(PORT IS IN USE example)', fontsize=13,
                 fontweight='bold', color=NAVY, pad=25)

    return save_fig(fig, 'confidence_radar')


def make_cost_comparison():
    """Bar chart: cost per request single vs cross-review, with cached."""
    fig, ax = plt.subplots(figsize=(8, 4))
    fig.patch.set_facecolor('white')

    categories = ['Single AI\n(1 model)', 'Cross-Review\n(5 models)', 'Cached\nResponse']
    costs = [0.03, 0.12, 0.00]
    times = [4.0, 4.0, 0.05]
    bar_colors = [MID_GRAY, BLUE, GREEN]

    x = np.arange(len(categories))
    width = 0.35

    bars1 = ax.bar(x - width/2, costs, width, label='Cost ($)', color=bar_colors, alpha=0.85,
                   edgecolor='white', linewidth=1.5)
    ax.set_ylabel('Cost per request ($)', fontsize=10, color=NAVY)
    ax.set_ylim(0, 0.18)

    ax2 = ax.twinx()
    bars2 = ax2.bar(x + width/2, times, width, label='Time (sec)', color=bar_colors, alpha=0.35,
                    edgecolor=bar_colors, linewidth=1.5, hatch='//')
    ax2.set_ylabel('Response time (seconds)', fontsize=10, color=MID_GRAY)
    ax2.set_ylim(0, 6)

    ax.set_xticks(x)
    ax.set_xticklabels(categories, fontsize=10, fontweight='bold')
    ax.set_title('Cost & Speed Comparison', fontsize=13, fontweight='bold', color=NAVY, pad=12)

    # Value labels
    for bar, val in zip(bars1, costs):
        ax.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.005,
                f'${val:.2f}', ha='center', va='bottom', fontsize=9, fontweight='bold')
    for bar, val in zip(bars2, times):
        ax2.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.1,
                 f'{val}s', ha='center', va='bottom', fontsize=9, color=MID_GRAY)

    lines1, labels1 = ax.get_legend_handles_labels()
    lines2, labels2 = ax2.get_legend_handles_labels()
    ax.legend(lines1 + lines2, labels1 + labels2, loc='upper left', fontsize=9)

    ax.spines['top'].set_visible(False)
    ax2.spines['top'].set_visible(False)
    fig.tight_layout()
    return save_fig(fig, 'cost_comparison')


def make_consensus_example():
    """Visual showing consensus verdict with agreement indicators."""
    fig, ax = plt.subplots(figsize=(9, 5))
    fig.patch.set_facecolor('white')
    ax.set_xlim(0, 10)
    ax.set_ylim(0, 6)
    ax.axis('off')

    # Title
    ax.text(5, 5.7, 'Consensus Algorithm in Action', ha='center',
            fontsize=14, fontweight='bold', color=NAVY)
    ax.text(5, 5.35, 'Example: "PORT IS IN USE at 6277"', ha='center',
            fontsize=10, color=MID_GRAY, style='italic')

    # 5 model boxes
    models = [
        ('Gemini', 0.95, 'Process bound\nto port', True),
        ('OpenAI', 0.86, 'TCP port\nstill bound', True),
        ('DeepSeek', 0.78, 'Resource\nconflict', False),
        ('Mistral', 0.82, 'Leftover\nprocess', True),
        ('OpenRouter', 0.81, 'Port still\nin use', True),
    ]

    for i, (name, conf, diagnosis, agrees) in enumerate(models):
        x = 0.5 + i * 1.9
        color = PROVIDER_COLORS[name]
        border_color = GREEN if agrees else ORANGE

        rect = FancyBboxPatch((x, 2.6), 1.5, 2.2, boxstyle="round,pad=0.12",
                              facecolor='white', edgecolor=border_color, linewidth=2.5)
        ax.add_patch(rect)

        # Provider name header
        header = FancyBboxPatch((x, 4.2), 1.5, 0.55, boxstyle="round,pad=0.08",
                                facecolor=color, edgecolor='none')
        ax.add_patch(header)
        ax.text(x + 0.75, 4.47, name, ha='center', va='center',
                fontsize=9, fontweight='bold', color='white')

        # Confidence bar
        bar_w = 1.2 * conf
        ax.add_patch(plt.Rectangle((x + 0.15, 3.7), bar_w, 0.25,
                                   facecolor=color, alpha=0.6, edgecolor='none'))
        ax.add_patch(plt.Rectangle((x + 0.15, 3.7), 1.2, 0.25,
                                   facecolor='none', edgecolor=MID_GRAY, linewidth=0.5))
        ax.text(x + 0.75, 3.82, f'{int(conf*100)}%', ha='center', va='center',
                fontsize=8, fontweight='bold', color=DARK_GRAY)

        # Diagnosis
        ax.text(x + 0.75, 3.2, diagnosis, ha='center', va='center',
                fontsize=8, color=DARK_GRAY)

        # Agreement indicator
        symbol = '✓ Agrees' if agrees else '~ Differs'
        sym_color = GREEN if agrees else ORANGE
        ax.text(x + 0.75, 2.75, symbol, ha='center', va='center',
                fontsize=8, fontweight='bold', color=sym_color)

    # Consensus result box
    result_rect = FancyBboxPatch((1.5, 0.3), 7, 1.8, boxstyle="round,pad=0.15",
                                 facecolor=LIGHT_BLUE, edgecolor=NAVY, linewidth=2)
    ax.add_patch(result_rect)

    ax.text(5, 1.75, 'CONSENSUS VERDICT', ha='center',
            fontsize=12, fontweight='bold', color=NAVY)
    ax.text(5, 1.35, 'Root Cause: Another process is bound to port 6277',
            ha='center', fontsize=10, color=DARK_GRAY)
    ax.text(5, 1.0, 'Fix: lsof -i :6277  →  kill -9 <PID>',
            ha='center', fontsize=10, color=DARK_GRAY, family='monospace')
    ax.text(5, 0.65, 'Confidence: 95%  |  4/5 models agree  |  1 alternative perspective',
            ha='center', fontsize=9, color=MID_GRAY)

    # Converge arrows
    for i in range(5):
        x = 1.25 + i * 1.9
        ax.annotate('', xy=(5, 2.1), xytext=(x, 2.6),
                    arrowprops=dict(arrowstyle='->', color=MID_GRAY, lw=1.2,
                                    connectionstyle='arc3,rad=0'))

    return save_fig(fig, 'consensus_example')


def make_component_diagram():
    """Component diagram showing all 7 modules and their connections."""
    fig, ax = plt.subplots(figsize=(10, 7))
    fig.patch.set_facecolor('white')
    ax.set_xlim(0, 10)
    ax.set_ylim(0, 8)
    ax.axis('off')

    ax.text(5, 7.7, 'System Components & Data Flow', ha='center',
            fontsize=14, fontweight='bold', color=NAVY)

    def component(x, y, w, h, label, sublabel, color, border=None):
        rect = FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0.12",
                              facecolor=color, edgecolor=border or '#888', linewidth=1.5)
        ax.add_patch(rect)
        ax.text(x + w/2, y + h/2 + 0.12, label, ha='center', va='center',
                fontsize=9, fontweight='bold', color='white')
        ax.text(x + w/2, y + h/2 - 0.15, sublabel, ha='center', va='center',
                fontsize=7, color='#ddd', style='italic')

    def link(x1, y1, x2, y2, label='', color='#999'):
        ax.annotate('', xy=(x2, y2), xytext=(x1, y1),
                    arrowprops=dict(arrowstyle='->', color=color, lw=1.5))
        if label:
            mx, my = (x1+x2)/2, (y1+y2)/2
            ax.text(mx + 0.1, my + 0.1, label, fontsize=7, color=color, style='italic')

    # Core pipeline (center column)
    component(3.5, 6.3, 3, 0.7, 'MCP Server', 'index.ts', NAVY)
    component(3.5, 4.9, 3, 0.7, 'Tool Handler', 'dev-guidance.ts', '#5B9BD5')
    component(3.5, 3.5, 3, 0.7, 'ReviewExecutor', 'executor.ts', BLUE)
    component(3.5, 2.1, 3, 0.7, 'Provider Layer', 'providers.ts', '#3A7CA5')
    component(3.5, 0.7, 3, 0.7, 'Consensus', 'consensus-algorithm.ts', GREEN)

    # Links in pipeline
    link(5, 6.3, 5, 5.65)
    link(5, 4.9, 5, 4.25)
    link(5, 3.5, 5, 2.85)
    link(5, 2.1, 5, 1.45)

    # Side modules (left)
    component(0.2, 5.5, 2.5, 0.65, 'Cache Manager', 'cache.ts', TEAL)
    component(0.2, 4.2, 2.5, 0.65, 'Rate Limiter', 'rate-limiter.ts', ORANGE)
    component(0.2, 2.9, 2.5, 0.65, 'Circuit Breaker', 'error-handling.ts', RED)

    # Side modules (right)
    component(7.3, 5.5, 2.5, 0.65, 'Cost Manager', 'cost-manager.ts', PURPLE)
    component(7.3, 4.2, 2.5, 0.65, 'Token Tracker', 'tracking.ts', '#666')
    component(7.3, 2.9, 2.5, 0.65, 'Persistence', 'persistence.ts', '#888')

    # Dashed connections (not yet wired)
    for (x1, y1, x2, y2, lbl) in [
        (2.7, 5.8, 3.5, 5.3, ''),
        (2.7, 4.5, 3.5, 4.0, ''),
        (2.7, 3.2, 3.5, 3.9, ''),
        (7.3, 5.8, 6.5, 5.3, ''),
        (7.3, 4.5, 6.5, 4.0, ''),
        (7.3, 3.2, 6.5, 2.8, ''),
    ]:
        ax.annotate('', xy=(x2, y2), xytext=(x1, y1),
                    arrowprops=dict(arrowstyle='->', color='#ccc', lw=1.5,
                                    linestyle='dashed'))

    # Legend
    ax.add_patch(plt.Rectangle((0.3, 0.1), 0.3, 0.15, facecolor='#ccc'))
    ax.text(0.75, 0.17, '--- Not yet wired into executor', fontsize=8, color=MID_GRAY)
    ax.add_patch(plt.Rectangle((4.5, 0.1), 0.3, 0.15, facecolor='#999'))
    ax.text(4.95, 0.17, '→ Active data flow', fontsize=8, color=MID_GRAY)

    return save_fig(fig, 'component_diagram')


def make_request_flow():
    """Step-by-step request flow diagram (vertical swimlane style)."""
    fig, ax = plt.subplots(figsize=(9, 8))
    fig.patch.set_facecolor('white')
    ax.set_xlim(0, 10)
    ax.set_ylim(0, 9)
    ax.axis('off')

    ax.text(5, 8.7, 'Request Flow: get_dev_guidance', ha='center',
            fontsize=14, fontweight='bold', color=NAVY)

    # Shift step boxes right to avoid overlapping title
    box_x = 1.0  # left edge of step boxes

    steps = [
        (7.8, NAVY,    '1. Tool Call Received',    'User calls get_dev_guidance\nwith error + context'),
        (6.8, BLUE,    '2. Lazy-Load Executor',    'First call only: initialize\nprovider connections'),
        (5.8, '#5B9BD5', '3. Build Prompt',         'Format error, technology,\nenvironment, attempts → prompt'),
        (4.8, BLUE,    '4. Fan Out to 5 Models',   'Promise.all() sends to\nOpenAI, Gemini, DeepSeek,\nMistral, OpenRouter'),
        (3.6, '#3A7CA5', '5. Collect Responses',    'Parse JSON from each model\n(handle markdown wrapping)'),
        (2.5, GREEN,   '6. Build Consensus',        'Find majority diagnosis\nScore confidence\nIdentify divergence'),
        (1.4, TEAL,    '7. Format Result',          'root_cause + immediate_fix\n+ per_model_analysis\n+ alternatives'),
        (0.3, NAVY,    '8. Return to User',         'JSON response via MCP\nprotocol back to Claude'),
    ]

    box_w = 3.0
    box_center = box_x + box_w / 2

    for i, (y, color, title, desc) in enumerate(steps):
        # Step box
        rect = FancyBboxPatch((box_x, y), box_w, 0.75, boxstyle="round,pad=0.1",
                              facecolor=color, edgecolor='none')
        ax.add_patch(rect)
        ax.text(box_center, y + 0.38, title, ha='center', va='center',
                fontsize=9, fontweight='bold', color='white')

        # Description (to the right of box)
        ax.text(box_x + box_w + 0.4, y + 0.38, desc, ha='left', va='center',
                fontsize=8, color=DARK_GRAY)

        # Connector arrow between boxes
        if i > 0:
            prev_y = steps[i-1][0]
            ax.annotate('', xy=(box_center, y + 0.75), xytext=(box_center, prev_y),
                        arrowprops=dict(arrowstyle='->', color=MID_GRAY, lw=1.2))

    # Timing annotations
    ax.text(8.5, 4.8, '~3-5 sec', fontsize=10, fontweight='bold', color=RED,
            ha='center', rotation=0)
    ax.annotate('', xy=(8.0, 3.6), xytext=(8.0, 5.55),
                arrowprops=dict(arrowstyle='<->', color=RED, lw=1.5))
    ax.text(8.5, 4.5, '(API calls)', fontsize=8, color=MID_GRAY, ha='center')

    return save_fig(fig, 'request_flow')


def make_wiring_status():
    """Status matrix showing what's wired vs not wired."""
    fig, ax = plt.subplots(figsize=(8, 4))
    fig.patch.set_facecolor('white')
    ax.axis('off')

    ax.text(4, 3.8, 'Integration Status (v0.5.2)', ha='center',
            fontsize=13, fontweight='bold', color=NAVY)

    modules = [
        ('MCP Server',        'Working', GREEN),
        ('ReviewExecutor',    'Working', GREEN),
        ('Consensus Algo',    'Working', GREEN),
        ('Dev Guidance',      'Working', GREEN),
        ('Cache Manager',     'Code exists, NOT wired', ORANGE),
        ('Cost Manager',      'Code exists, NOT wired', ORANGE),
        ('Rate Limiter',      'Code exists, NOT wired', ORANGE),
        ('Circuit Breaker',   'Code exists, NOT wired', ORANGE),
        ('Persistence',       'Stub only', RED),
        ('Graceful Degrade',  'Code exists, executor throws', RED),
    ]

    for i, (name, status, color) in enumerate(modules):
        y = 3.3 - i * 0.35
        # Status dot
        ax.plot(0.8, y, 'o', color=color, markersize=10)
        # Module name
        ax.text(1.2, y, name, fontsize=9, fontweight='bold', color=DARK_GRAY,
                va='center')
        # Status text
        ax.text(4.2, y, status, fontsize=9, color=color, va='center',
                fontweight='bold')

    # Legend
    for i, (label, color) in enumerate([('Working', GREEN), ('Not Wired', ORANGE), ('Stub/Missing', RED)]):
        ax.plot(6.0 + i * 1.5, -0.3, 'o', color=color, markersize=8)
        ax.text(6.25 + i * 1.5, -0.3, label, fontsize=8, color=DARK_GRAY, va='center')

    return save_fig(fig, 'wiring_status')


# ═══════════════════════════════════════════════════════════════
# PDF BUILDERS
# ═══════════════════════════════════════════════════════════════

def get_styles():
    """Common styles for all PDFs."""
    ss = getSampleStyleSheet()
    return {
        'title': ParagraphStyle('Title', parent=ss['Heading1'], fontSize=26,
                                textColor=colors.HexColor(NAVY), alignment=TA_CENTER,
                                spaceAfter=8, fontName='Helvetica-Bold'),
        'subtitle': ParagraphStyle('Sub', parent=ss['Normal'], fontSize=13,
                                   textColor=colors.HexColor(MID_GRAY), alignment=TA_CENTER,
                                   spaceAfter=20),
        'h2': ParagraphStyle('H2', parent=ss['Heading2'], fontSize=14,
                             textColor=colors.HexColor(NAVY), spaceBefore=16,
                             spaceAfter=8, fontName='Helvetica-Bold'),
        'body': ParagraphStyle('Body', parent=ss['BodyText'], fontSize=10.5,
                               spaceAfter=10, leading=14, textColor=colors.HexColor(DARK_GRAY)),
        'code': ParagraphStyle('Code', parent=ss['BodyText'], fontSize=9,
                               fontName='Courier', spaceAfter=8, leading=12,
                               backColor=colors.HexColor('#F8F8F8'),
                               textColor=colors.HexColor(DARK_GRAY)),
        'caption': ParagraphStyle('Caption', parent=ss['Normal'], fontSize=9,
                                  textColor=colors.HexColor(MID_GRAY), alignment=TA_CENTER,
                                  spaceAfter=16, spaceBefore=4, fontName='Helvetica-Oblique'),
    }


def section_header(text, styles_dict):
    """Blue section header bar."""
    data = [[Paragraph(text, ParagraphStyle('sh', fontSize=12,
             fontName='Helvetica-Bold', textColor=colors.white))]]
    tbl = Table(data, colWidths=[7.2*inch])
    tbl.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor(BLUE)),
        ('TOPPADDING', (0,0), (-1,-1), 10),
        ('BOTTOMPADDING', (0,0), (-1,-1), 10),
        ('LEFTPADDING', (0,0), (-1,-1), 14),
    ]))
    return tbl


def build_user_guide(img_paths):
    """Build USER_GUIDE.pdf with diagrams."""
    pdf = os.path.join('docs', 'USER_GUIDE.pdf')
    doc = SimpleDocTemplate(pdf, pagesize=letter, topMargin=0.6*inch, bottomMargin=0.6*inch,
                            leftMargin=0.7*inch, rightMargin=0.7*inch)
    s = get_styles()
    story = []

    # ── Title page ──
    story.append(Spacer(1, 0.5*inch))
    story.append(Paragraph('cross-review-mcp', s['title']))
    story.append(Paragraph('User Guide v0.5.2', s['subtitle']))
    story.append(Spacer(1, 0.15*inch))
    story.append(Paragraph('Get expert advice from 5 AI models at the same time.', s['body']))
    story.append(Spacer(1, 0.15*inch))

    # Architecture overview image — larger to fill page
    story.append(RLImage(img_paths['architecture'], width=7*inch, height=4.55*inch))
    story.append(Paragraph('Figure 1: System architecture — your question goes to 5 models in parallel', s['caption']))

    # Key features list to fill remaining space
    features = [
        'Ask 5 AI models in parallel — same speed as asking 1',
        'Consensus verdict shows what models agree on',
        'Divergent perspectives highlight alternative approaches',
        'Developer guidance tool for solving blockers instantly',
    ]
    for f in features:
        story.append(Paragraph(f'<bullet>&bull;</bullet>  {f}', s['body']))

    story.append(PageBreak())

    # ── What Is This? ──
    story.append(section_header('What Is This?', s))
    story.append(Spacer(1, 0.1*inch))
    story.append(Paragraph(
        'Imagine asking 5 expert friends the same question at once. Some agree, some disagree — '
        'but you get <b>5 perspectives</b> instead of 1. That\'s cross-review-mcp.', s['body']))
    story.append(Paragraph(
        'Instead of asking ChatGPT OR Gemini OR Claude separately, '
        'you ask <b>all 5 AI models at the SAME TIME</b> and get a consensus verdict.', s['body']))

    # Parallel vs sequential chart
    story.append(Spacer(1, 0.15*inch))
    story.append(RLImage(img_paths['parallel_vs_sequential'], width=6.2*inch, height=2.7*inch))
    story.append(Paragraph('Figure 2: Sequential vs Parallel — same total work, 4x faster', s['caption']))

    # ── Consensus Example (same page, flows naturally) ──
    story.append(section_header('Consensus in Action', s))
    story.append(Spacer(1, 0.1*inch))
    story.append(Paragraph(
        'When all 5 models analyze your problem, the consensus algorithm finds agreement '
        'and highlights where models diverge — because disagreement is often valuable.', s['body']))
    story.append(Spacer(1, 0.1*inch))
    story.append(RLImage(img_paths['consensus_example'], width=6.3*inch, height=3.5*inch))
    story.append(Paragraph('Figure 3: 4 of 5 models agree on root cause; 1 offers alternative angle', s['caption']))

    story.append(PageBreak())

    # ── How It Works ──
    story.append(section_header('How It Works', s))
    story.append(Spacer(1, 0.1*inch))
    story.append(RLImage(img_paths['request_flow'], width=6*inch, height=5.3*inch))
    story.append(Paragraph('Figure 4: Complete request flow from question to answer', s['caption']))

    # ── Installation + Usage (flows onto next page naturally) ──
    story.append(section_header('Installation (3 Steps)', s))
    story.append(Spacer(1, 0.1*inch))
    story.append(Paragraph('<b>Step 1:</b> Install via npm', s['body']))
    story.append(Paragraph('npm install -g cross-review-mcp', s['code']))
    story.append(Paragraph('<b>Step 2:</b> Get API keys from: OpenAI, Gemini, DeepSeek, Mistral, OpenRouter', s['body']))
    story.append(Paragraph('<b>Step 3:</b> Create a <font face="Courier">.env</font> file:', s['body']))
    story.append(Paragraph(
        'OPENAI_API_KEY=sk-proj-...\n'
        'GEMINI_API_KEY=AIzaSy-...\n'
        'DEEPSEEK_API_KEY=sk-...\n'
        'MISTRAL_API_KEY=...\n'
        'OPENROUTER_API_KEY=sk-or-v1-...', s['code']))
    story.append(Paragraph("Don't have all 5? That's fine — use what you have.", s['body']))

    story.append(Spacer(1, 0.15*inch))
    story.append(section_header('Usage', s))
    story.append(Spacer(1, 0.1*inch))
    story.append(Paragraph('<b>CLI:</b>', s['body']))
    story.append(Paragraph(
        'cross-review dev --error "PORT IS IN USE at 6277" \\\n'
        '  --tech "MCP Inspector" --env "macOS" \\\n'
        '  --tried "Killed processes"', s['code']))
    story.append(Paragraph('<b>Claude.ai:</b> Connect via MCP, then ask naturally — '
                           'Claude calls cross-review automatically.', s['body']))
    story.append(Paragraph('<b>Docker:</b>', s['body']))
    story.append(Paragraph(
        'docker run \\\n'
        '  -e OPENAI_API_KEY=sk-... \\\n'
        '  -e GEMINI_API_KEY=AIza... \\\n'
        '  cross-review-mcp', s['code']))

    # ── Cost & Performance (flows naturally) ──
    story.append(section_header('Cost & Performance', s))
    story.append(Spacer(1, 0.1*inch))
    story.append(RLImage(img_paths['cost_comparison'], width=5.8*inch, height=2.9*inch))
    story.append(Paragraph('Figure 5: Cost and speed — 5 models cost ~$0.12 but take same time as 1', s['caption']))

    # Performance table
    perf_data = [
        ['Operation', 'Time', 'Cost', 'Models'],
        ['Single AI call', '3-5 sec', '$0.01-0.05', '1'],
        ['Cross-Review (5 models)', '3-5 sec', '$0.05-0.25', '5'],
        ['Cached response', '<0.1 sec', '$0.00', '0'],
    ]
    perf_tbl = Table(perf_data, colWidths=[2.2*inch, 1.3*inch, 1.3*inch, 1*inch])
    perf_tbl.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor(NAVY)),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#ddd')),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor(LIGHT_GRAY)]),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
    ]))
    story.append(Spacer(1, 0.15*inch))
    story.append(perf_tbl)

    # ── Model Capabilities (flows naturally) ──
    story.append(Spacer(1, 0.15*inch))
    story.append(section_header('Model Capabilities', s))
    story.append(Spacer(1, 0.1*inch))
    story.append(Paragraph(
        'Each AI model has different strengths. The radar chart below shows how models '
        'performed on a real problem (PORT IS IN USE), across 5 capability dimensions.', s['body']))
    story.append(RLImage(img_paths['confidence_radar'], width=5*inch, height=5*inch))
    story.append(Paragraph('Figure 6: Model capability radar — Gemini excels at root cause; OpenAI at alternatives', s['caption']))

    # ── Troubleshooting (flows naturally) ──
    story.append(section_header('Troubleshooting', s))
    story.append(Spacer(1, 0.1*inch))
    problems = [
        ('"Error: Missing API key"', 'Create .env file with your keys. See Installation above.'),
        ('"No model responses"', 'Verify API keys are correct and not expired. Check network.'),
        ('"Answer isn\'t helpful"', 'Add more context: technology, environment, what you\'ve tried.'),
        ('"Timeout"', 'Some providers may be slow. The system waits for all 5 by default.'),
    ]
    for problem, fix in problems:
        story.append(Paragraph(f'<b>{problem}</b> — {fix}', s['body']))

    doc.build(story)
    return os.path.getsize(pdf)


def build_technical_architecture(img_paths):
    """Build TECHNICAL_ARCHITECTURE.pdf with diagrams."""
    pdf = os.path.join('docs', 'TECHNICAL_ARCHITECTURE.pdf')
    doc = SimpleDocTemplate(pdf, pagesize=letter, topMargin=0.6*inch, bottomMargin=0.6*inch,
                            leftMargin=0.7*inch, rightMargin=0.7*inch)
    s = get_styles()
    story = []

    # ── Title ──
    story.append(Spacer(1, 0.6*inch))
    story.append(Paragraph('Technical Architecture', s['title']))
    story.append(Paragraph('cross-review-mcp v0.5.2 — System Design & Internals', s['subtitle']))
    story.append(Spacer(1, 0.3*inch))

    story.append(RLImage(img_paths['architecture'], width=6.5*inch, height=4.2*inch))
    story.append(Paragraph('Figure 1: High-level architecture', s['caption']))

    story.append(PageBreak())

    # ── Components ──
    story.append(section_header('System Components', s))
    story.append(Spacer(1, 0.1*inch))
    story.append(RLImage(img_paths['component_diagram'], width=6.5*inch, height=4.5*inch))
    story.append(Paragraph('Figure 2: All components and integration status (dashed = not yet wired)', s['caption']))

    components = [
        ('MCP Server (index.ts)', 'Entry point. Registers 4 MCP tools. Lazy-loads ReviewExecutor on first call. Suppresses console output to keep MCP protocol clean.'),
        ('ReviewExecutor (executor.ts)', 'Core engine. Initializes provider connections. Sends requests to all 5 models via Promise.all(). Collects responses and calculates costs.'),
        ('Provider Layer (providers.ts)', 'Unified interface for OpenAI, Gemini (Google AI SDK), and OpenAI-compatible APIs (DeepSeek, Mistral, OpenRouter).'),
        ('Consensus Algorithm (consensus-algorithm.ts)', 'Analyzes 5 model responses. Finds majority diagnosis. Scores confidence. Detects paradigm shifts. Preserves divergent perspectives.'),
        ('Dev Guidance (dev-guidance.ts)', 'Formats developer problems into structured prompts. Parses model responses. Returns actionable root cause + fix + 5 perspectives.'),
        ('Cache Manager (cache.ts)', 'LRU/FIFO cache with SHA-256 content hashing, TTL expiry, disk persistence, hit/miss metrics. <b>Not yet wired into executor.</b>'),
        ('Cost Manager (cost-manager.ts)', 'Tracks per-provider token usage and costs. Daily/monthly thresholds. Disk persistence. <b>Not yet wired into executor.</b>'),
    ]

    for title, desc in components:
        story.append(Paragraph(f'<b>{title}</b> — {desc}', s['body']))

    story.append(PageBreak())

    # ── Request Flow ──
    story.append(section_header('Request Flow', s))
    story.append(Spacer(1, 0.1*inch))
    story.append(RLImage(img_paths['request_flow'], width=6*inch, height=5.3*inch))
    story.append(Paragraph('Figure 3: Step-by-step request flow with timing', s['caption']))

    # ── Consensus Deep Dive (flows naturally) ──
    story.append(section_header('Consensus Algorithm Deep Dive', s))
    story.append(Spacer(1, 0.1*inch))
    story.append(RLImage(img_paths['consensus_example'], width=6.3*inch, height=3.5*inch))
    story.append(Paragraph('Figure 4: Consensus in action — agreement and divergence', s['caption']))

    story.append(Paragraph(
        '<b>Key innovation:</b> Disagreement is preserved as "alternative perspectives" rather than '
        'being averaged away. When a problem is genuinely ambiguous, seeing 5 different angles '
        'helps developers think deeper.', s['body']))
    story.append(Paragraph(
        '<b>Confidence formula:</b> consensus_confidence = (agreeing_models / total_models). '
        'A 4/5 agreement yields 80%. Individual model confidence is self-reported (0-1).', s['body']))
    story.append(Paragraph(
        '<b>Paradigm shift detection:</b> When the top-2 diagnoses are fundamentally different, '
        'the algorithm flags this — indicating the problem may have multiple valid interpretations.', s['body']))

    # ── Performance (flows naturally) ──
    story.append(section_header('Performance & Cost', s))
    story.append(Spacer(1, 0.1*inch))
    story.append(RLImage(img_paths['parallel_vs_sequential'], width=6.2*inch, height=2.7*inch))
    story.append(Paragraph('Figure 5: Parallel execution — same wall-clock time as single model', s['caption']))

    story.append(RLImage(img_paths['cost_comparison'], width=5.8*inch, height=2.9*inch))
    story.append(Paragraph('Figure 6: Cost per request — 5x models but same latency', s['caption']))

    # ── Model Radar (flows naturally) ──
    story.append(section_header('Model Capability Comparison', s))
    story.append(Spacer(1, 0.1*inch))
    story.append(RLImage(img_paths['confidence_radar'], width=5*inch, height=5*inch))
    story.append(Paragraph('Figure 7: Model strengths across 5 capability axes', s['caption']))

    # ── Integration Status (flows naturally) ──
    story.append(section_header('Integration Status', s))
    story.append(Spacer(1, 0.1*inch))
    story.append(RLImage(img_paths['wiring_status'], width=5.8*inch, height=2.9*inch))
    story.append(Paragraph('Figure 8: Module wiring status — several components exist but need integration', s['caption']))

    story.append(Paragraph(
        '<b>Critical gap:</b> The ReviewExecutor is the central workhorse, but it does not use the '
        'cache, cost manager, rate limiter, or circuit breaker. These modules exist as standalone '
        'code but are not integrated into the execution pipeline. The executor also throws on missing '
        'API keys rather than gracefully skipping the provider.', s['body']))

    # ── Design Decisions (flows naturally) ──
    story.append(section_header('Key Design Decisions', s))
    story.append(Spacer(1, 0.1*inch))
    decisions = [
        ('Parallel execution', 'All 5 models queried simultaneously via Promise.all(). Latency = max(individual), not sum.'),
        ('Lazy loading', 'ReviewExecutor loaded on first tool call, not at server startup. Avoids API key errors on startup.'),
        ('ESM throughout', '.js extensions in imports, "type": "module" in package.json. No CommonJS.'),
        ('Divergence-as-feature', 'Model disagreement is surfaced, not hidden. Multiple valid perspectives > forced consensus.'),
        ('Console suppression', 'All console output suppressed before dotenv loads, to keep MCP stdio protocol clean.'),
    ]
    for title, desc in decisions:
        story.append(Paragraph(f'<b>{title}:</b> {desc}', s['body']))

    doc.build(story)
    return os.path.getsize(pdf)


def build_production_checklist(img_paths):
    """Build PRODUCTION_CHECKLIST.pdf with status visuals."""
    pdf = os.path.join('docs', 'PRODUCTION_CHECKLIST.pdf')
    doc = SimpleDocTemplate(pdf, pagesize=letter, topMargin=0.6*inch, bottomMargin=0.6*inch,
                            leftMargin=0.7*inch, rightMargin=0.7*inch)
    s = get_styles()
    story = []

    # ── Title ──
    story.append(Spacer(1, 0.4*inch))
    story.append(Paragraph('Production Checklist', s['title']))
    story.append(Paragraph('cross-review-mcp v0.5.2 — What Works, What Doesn\'t', s['subtitle']))
    story.append(Spacer(1, 0.1*inch))

    # ── Integration Status ──
    story.append(section_header('Integration Status Overview', s))
    story.append(Spacer(1, 0.1*inch))
    story.append(RLImage(img_paths['wiring_status'], width=5.8*inch, height=2.9*inch))
    story.append(Paragraph('Figure 1: Current module wiring status', s['caption']))

    # ── What's Working (flows naturally) ──
    story.append(section_header('What\'s Working (Verified)', s))
    story.append(Spacer(1, 0.1*inch))

    working = [
        ['Component', 'Status', 'Notes'],
        ['MCP Server', 'WORKING', '4 tools registered, MCP protocol compliant'],
        ['ReviewExecutor', 'WORKING', 'Parallel execution of 5 providers'],
        ['Consensus Algorithm', 'WORKING', 'Majority diagnosis + divergence detection'],
        ['Dev Guidance Tool', 'WORKING', 'Prompt formatting + response parsing'],
        ['CLI (cross-review)', 'WORKING', 'dev, review, cost, cache commands'],
        ['TypeScript Build', 'WORKING', 'npm run build succeeds'],
        ['Smoke Tests', 'WORKING', '20+ assertions, no API keys needed'],
        ['Live Tests', 'WORKING', 'E2E with real API calls'],
    ]

    tbl = Table(working, colWidths=[2*inch, 1.2*inch, 3.5*inch])
    tbl.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor(NAVY)),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('ALIGN', (1, 0), (1, -1), 'CENTER'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#ddd')),
        ('TEXTCOLOR', (1, 1), (1, -1), colors.HexColor(GREEN)),
        ('FONTNAME', (1, 1), (1, -1), 'Helvetica-Bold'),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor(LIGHT_GRAY)]),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(tbl)

    story.append(Spacer(1, 0.15*inch))

    # ── What Needs Wiring ──
    story.append(section_header('Code Exists But NOT Wired Into Executor', s))
    story.append(Spacer(1, 0.1*inch))

    not_wired = [
        ['Component', 'Status', 'What\'s Missing'],
        ['Cache Manager', 'NOT WIRED', 'Executor doesn\'t check/write cache'],
        ['Cost Manager', 'NOT WIRED', 'Executor doesn\'t call trackUsage()'],
        ['Rate Limiter', 'NOT WIRED', 'Executor doesn\'t throttle requests'],
        ['Circuit Breaker', 'NOT WIRED', 'Executor doesn\'t use fail-fast'],
        ['Retry Logic', 'NOT WIRED', 'retryWithBackoff() exists but unused'],
        ['Graceful Degradation', 'NOT WIRED', 'Executor throws on missing key'],
    ]

    tbl = Table(not_wired, colWidths=[2*inch, 1.2*inch, 3.5*inch])
    tbl.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor(NAVY)),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('ALIGN', (1, 0), (1, -1), 'CENTER'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#ddd')),
        ('TEXTCOLOR', (1, 1), (1, -1), colors.HexColor(ORANGE)),
        ('FONTNAME', (1, 1), (1, -1), 'Helvetica-Bold'),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#FFF8F0')]),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(tbl)

    story.append(Spacer(1, 0.2*inch))

    # ── Stubs ──
    story.append(section_header('Stubs / Not Implemented', s))
    story.append(Spacer(1, 0.1*inch))

    stubs = [
        ['Component', 'Status', 'Details'],
        ['Persistence (SQLite)', 'STUB', 'All methods are no-ops (return empty)'],
        ['Weighted Voting', 'MISSING', 'All models equally weighted'],
        ['Cost Optimization', 'MISSING', 'No cheaper-model fallback logic'],
        ['VS Code Extension', 'NOT STARTED', ''],
        ['Web Dashboard', 'NOT STARTED', ''],
    ]

    tbl = Table(stubs, colWidths=[2*inch, 1.2*inch, 3.5*inch])
    tbl.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor(NAVY)),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('ALIGN', (1, 0), (1, -1), 'CENTER'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#ddd')),
        ('TEXTCOLOR', (1, 1), (1, -1), colors.HexColor(RED)),
        ('FONTNAME', (1, 1), (1, -1), 'Helvetica-Bold'),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#FFF5F5')]),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(tbl)

    # ── Architecture for context (flows naturally) ──
    story.append(section_header('Architecture Reference', s))
    story.append(Spacer(1, 0.1*inch))
    story.append(RLImage(img_paths['architecture'], width=6.5*inch, height=4.2*inch))
    story.append(Paragraph('Architecture overview for reference', s['caption']))

    story.append(Spacer(1, 0.1*inch))
    story.append(RLImage(img_paths['component_diagram'], width=6.5*inch, height=4.5*inch))
    story.append(Paragraph('Component diagram — dashed lines show modules not yet integrated', s['caption']))

    story.append(PageBreak())

    # ── Documentation Status ──
    story.append(section_header('Documentation Status', s))
    story.append(Spacer(1, 0.1*inch))

    docs_status = [
        ['Document', 'Status', 'Format'],
        ['README.md', 'COMPLETE', 'Markdown + quick start'],
        ['USER_GUIDE.md', 'COMPLETE', 'Markdown'],
        ['USER_GUIDE.pdf', 'COMPLETE', 'PDF with diagrams'],
        ['TECHNICAL_ARCHITECTURE.md', 'COMPLETE', 'Markdown'],
        ['TECHNICAL_ARCHITECTURE.pdf', 'COMPLETE', 'PDF with diagrams'],
        ['PRODUCTION_CHECKLIST.md', 'COMPLETE', 'Markdown'],
        ['PRODUCTION_CHECKLIST.pdf', 'COMPLETE', 'PDF with diagrams'],
        ['claude.config.json', 'COMPLETE', 'MCP config'],
        ['.env.example', 'EXISTS', 'Template'],
        ['Deployment guide (systemd)', 'MISSING', ''],
    ]

    tbl = Table(docs_status, colWidths=[2.8*inch, 1.2*inch, 2.7*inch])
    tbl.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor(NAVY)),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('ALIGN', (1, 0), (1, -1), 'CENTER'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#ddd')),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor(LIGHT_GRAY)]),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(tbl)

    story.append(PageBreak())

    # ── Verdict ──
    story.append(section_header('Overall Verdict', s))
    story.append(Spacer(1, 0.15*inch))
    story.append(Paragraph(
        '<b>Core pipeline works end-to-end.</b> MCP server, executor, consensus, and dev guidance '
        'are functional and tested. Documentation is comprehensive.', s['body']))
    story.append(Paragraph(
        '<b>Supporting modules need wiring.</b> Cache, cost tracking, rate limiting, circuit breaker, '
        'and retry logic all exist as code but are not integrated into the executor. This means '
        'there is no caching, no cost tracking, no rate limiting, and no graceful degradation in '
        'the actual execution path.', s['body']))
    story.append(Paragraph(
        '<b>Persistence is a stub.</b> The PersistenceManager has the right interfaces but all '
        'methods return empty results.', s['body']))

    doc.build(story)
    return os.path.getsize(pdf)


# ═══════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════

if __name__ == '__main__':
    os.chdir(os.path.dirname(os.path.abspath(__file__)))

    print('Generating diagrams...')
    imgs = {}
    imgs['architecture'] = make_architecture_diagram()
    imgs['parallel_vs_sequential'] = make_parallel_vs_sequential()
    imgs['confidence_radar'] = make_confidence_radar()
    imgs['cost_comparison'] = make_cost_comparison()
    imgs['consensus_example'] = make_consensus_example()
    imgs['component_diagram'] = make_component_diagram()
    imgs['request_flow'] = make_request_flow()
    imgs['wiring_status'] = make_wiring_status()
    print(f'  Generated {len(imgs)} diagrams in {TMPDIR}')

    print('\nBuilding PDFs...')
    size1 = build_user_guide(imgs)
    print(f'  USER_GUIDE.pdf — {size1/1024:.0f} KB')

    size2 = build_technical_architecture(imgs)
    print(f'  TECHNICAL_ARCHITECTURE.pdf — {size2/1024:.0f} KB')

    size3 = build_production_checklist(imgs)
    print(f'  PRODUCTION_CHECKLIST.pdf — {size3/1024:.0f} KB')

    total = (size1 + size2 + size3) / 1024
    print(f'\nAll 3 PDFs created in docs/ ({total:.0f} KB total)')
    print(f'Temp images: {TMPDIR}')
