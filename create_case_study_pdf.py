#!/usr/bin/env python3
"""Generate a one-page A4 case study PDF showing cross-review MCP in action."""

from reportlab.lib.pagesizes import A4
from reportlab.lib.colors import HexColor, white, black
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
)
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER
import os

OUTPUT = os.path.join(os.path.dirname(__file__), "cross-review-case-study.pdf")

# Colors
BLUE = HexColor("#1a73e8")
RED = HexColor("#d32f2f")
GREEN = HexColor("#2e7d32")
DARK_BG = HexColor("#1e1e2e")
LIGHT_BG = HexColor("#f5f5f5")
BLUE_BG = HexColor("#e3f2fd")
RED_BG = HexColor("#ffebee")
GREEN_BG = HexColor("#e8f5e9")
GRAY = HexColor("#666666")

# Styles
title_style = ParagraphStyle("Title", fontSize=16, leading=20, textColor=HexColor("#1a1a2e"),
                              fontName="Helvetica-Bold", alignment=TA_CENTER, spaceAfter=2*mm)
subtitle_style = ParagraphStyle("Subtitle", fontSize=9, leading=12, textColor=GRAY,
                                 fontName="Helvetica", alignment=TA_CENTER, spaceAfter=4*mm)

def bubble_style(color, bg, name="bubble"):
    return ParagraphStyle(name, fontSize=8, leading=11, textColor=color,
                          fontName="Helvetica", spaceBefore=1*mm, spaceAfter=1*mm)

label_style = ParagraphStyle("Label", fontSize=7, leading=9, textColor=GRAY,
                              fontName="Helvetica-Bold", spaceBefore=2*mm, spaceAfter=0.5*mm)

def make_bubble(text, color, bg_color, width=170*mm):
    """Create a colored bubble as a single-cell table."""
    style = bubble_style(HexColor("#1a1a2e"), bg_color)
    para = Paragraph(text, style)
    t = Table([[para]], colWidths=[width])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), bg_color),
        ('BOX', (0, 0), (-1, -1), 0.5, color),
        ('TOPPADDING', (0, 0), (-1, -1), 3*mm),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3*mm),
        ('LEFTPADDING', (0, 0), (-1, -1), 4*mm),
        ('RIGHTPADDING', (0, 0), (-1, -1), 4*mm),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ]))
    return t

def make_label(text, color):
    s = ParagraphStyle("lbl", fontSize=7.5, leading=10, textColor=color,
                        fontName="Helvetica-Bold", spaceBefore=3*mm, spaceAfter=1*mm)
    return Paragraph(text, s)

def build_pdf():
    doc = SimpleDocTemplate(OUTPUT, pagesize=A4,
                            topMargin=12*mm, bottomMargin=10*mm,
                            leftMargin=15*mm, rightMargin=15*mm)
    story = []

    # Title
    story.append(Paragraph("Cross-Review MCP in Practice", title_style))
    story.append(Paragraph("How adversarial multi-model review catches bugs that single-model analysis misses", subtitle_style))
    story.append(HRFlowable(width="100%", thickness=0.5, color=HexColor("#ddd"), spaceAfter=3*mm))

    # --- STEP 1: User question (BLUE) ---
    story.append(make_label("1 &nbsp; USER QUESTION", BLUE))
    story.append(make_bubble(
        '<i>"I just saw these on my Claude Desktop dev log — is this something we should '
        'take a closer look at on code level, or are these some old noise?"</i><br/><br/>'
        '<font face="Courier" size="7" color="#555">'
        'Error: SSE stream disconnected: TypeError: terminated<br/>'
        'Error: SSE stream disconnected: TypeError: terminated<br/>'
        'Error: SSE stream disconnected: TypeError: terminated<br/>'
        '... (hundreds of repeating errors after every tool call)</font>',
        BLUE, BLUE_BG
    ))

    # --- STEP 2: AI initial assessment (RED) ---
    story.append(make_label("2 &nbsp; CLAUDE\'S INITIAL ASSESSMENT — MISDIAGNOSIS", RED))
    story.append(make_bubble(
        '<b>Verdict: "Not a bug in your server code."</b><br/><br/>'
        '"Your server\'s StreamableHTTP handling is correct — it follows the standard MCP SDK pattern. '
        'The errors come from mcp-remote, not your server. This is a known rough edge in the '
        'mcp-remote bridge — it aggressively reconnects SSE streams rather than backing off.<br/><br/>'
        '<b>Verdict: noise from mcp-remote, not actionable on your side.</b>"',
        RED, RED_BG
    ))

    # --- STEP 3: User proposes cross-review (GREEN) ---
    story.append(make_label("3 &nbsp; USER LEVERAGES CROSS-REVIEW MCP", GREEN))
    story.append(make_bubble(
        '<i>"Why don\'t we do cross-review on this one and then we might know?"</i><br/><br/>'
        'The user invoked the cross-review MCP tool, sending the server code + error logs '
        'to GPT and Gemini for independent adversarial analysis.',
        GREEN, GREEN_BG
    ))

    # --- STEP 4: Cross-review catches the bug (GREEN) ---
    story.append(make_label("4 &nbsp; MULTI-MODEL CONSENSUS — BUG FOUND", GREEN))
    story.append(make_bubble(
        '<b>GPT:</b> "The biggest red flag is routing all methods through <font face="Courier">app.all(\'/mcp\')</font>. '
        'If you use <font face="Courier">express.json()</font> globally, it runs for GET too — for SSE endpoints '
        'it\'s best to exclude them from body parsing. Also: disable socket timeouts for GET /mcp with '
        '<font face="Courier">req.socket.setTimeout(0)</font>."<br/><br/>'
        '<b>Gemini:</b> "The code doesn\'t explicitly set SSE headers. Without these, the client won\'t treat '
        'the connection as an SSE stream. The <font face="Courier">transport.onclose</font> handler is also '
        'problematic — rapid deletion and re-creation contributes to the disconnect flood."<br/><br/>'
        '<b>Consensus:</b> Three actionable server-side fixes identified — split route handlers, disable '
        'timeouts on SSE, restrict JSON middleware to POST only.',
        GREEN, GREEN_BG
    ))

    # --- STEP 5: Correction (RED) ---
    story.append(make_label("5 &nbsp; CLAUDE CORRECTS COURSE — APPLIES FIXES", RED))
    story.append(make_bubble(
        '"Good catches from the models. Both OpenAI and Gemini converge on the same actionable issue: '
        '<font face="Courier">express.json()</font> is applied to all <font face="Courier">/mcp</font> methods '
        'including GET (SSE), which interferes with the long-lived SSE stream."<br/><br/>'
        'Claude applied all three fixes, tests passed (102/102), code was pushed to git, '
        'and the Linux production server was updated — all within the same session.',
        RED, RED_BG
    ))

    # --- THE BIGGER PICTURE ---
    PURPLE = HexColor("#6a1b9a")
    PURPLE_BG = HexColor("#f3e5f5")
    story.append(make_label("THE BIGGER PICTURE — SELF-CORRECTING AI", PURPLE))
    story.append(make_bubble(
        '<b>What actually happened here:</b><br/><br/>'
        '<b>1. Self-diagnosis</b> — The MCP tool analyzed its own server code and found bugs in itself.<br/>'
        '<b>2. Self-correction</b> — The fixes were applied, tested, and deployed automatically.<br/>'
        '<b>3. Self-validation</b> — 102 tests confirmed the fix, production was updated live.<br/><br/>'
        'This is not just "getting a second opinion." This is a <b>closed-loop self-healing workflow</b>: '
        'software that can identify its own blind spots by consulting independent reasoning engines, '
        'then act on the consensus without human intervention beyond the initial prompt.<br/><br/>'
        'A single model has inherent blind spots — it will confidently defend its own code. '
        'Multiple adversarial models break that echo chamber. The result: bugs found in seconds '
        'that would otherwise ship to production as "not our problem."',
        PURPLE, PURPLE_BG
    ))

    # Footer
    story.append(Spacer(1, 2*mm))
    story.append(HRFlowable(width="100%", thickness=0.5, color=HexColor("#ddd"), spaceBefore=1*mm, spaceAfter=2*mm))
    footer_style = ParagraphStyle("Footer", fontSize=7, leading=10, textColor=GRAY,
                                   fontName="Helvetica", alignment=TA_CENTER)
    story.append(Paragraph(
        "Cross-Review MCP — Adversarial multi-model code review as an MCP tool<br/>"
        "github.com/KEIJOT/cross-review-mcp &nbsp;|&nbsp; March 2026",
        footer_style
    ))

    doc.build(story)
    print(f"PDF created: {OUTPUT}")

if __name__ == "__main__":
    build_pdf()
