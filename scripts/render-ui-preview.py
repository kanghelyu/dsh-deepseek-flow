"""Render a deterministic layout QA screenshot without a browser runtime."""
from pathlib import Path
import sys
from PIL import Image, ImageDraw, ImageFont

out = Path(sys.argv[1] if len(sys.argv) > 1 else "qa/ui-preview.png")
W = int(sys.argv[2]) if len(sys.argv) > 2 else 1680
H = int(sys.argv[3]) if len(sys.argv) > 3 else 950
scheme = sys.argv[4] if len(sys.argv) > 4 else "light"
collapsed = W < 1040
rail = 0 if collapsed else min(264, int(W * 0.28))
inspector = 0 if collapsed else min(380, int(W * 0.34))
splitter = 9
cx = rail + splitter
cw = W - rail - inspector - splitter * 2
ix = cx + cw + splitter

FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
MONO = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf"
font = lambda size, bold=False, mono=False: ImageFont.truetype(MONO if mono else (BOLD if bold else FONT), size)

if scheme == "dark":
    BG, LAYER, LAYER2, LINE, BORDER2 = "#15171d", "#1d2028", "#252934", "#343a47", "#4a5365"
    INK, MUTED, BRAND, BRAND_SOFT = "#f0f2f6", "#a6adbd", "#7f96ff", "#2a3150"
    SUCCESS, WARN, ERROR, SHADOW, ON_BRAND = "#58c991", "#e0ac4f", "#ff7a84", "#101218", "#101218"
else:
    BG, LAYER, LAYER2, LINE, BORDER2 = "#f7f8fb", "#ffffff", "#f8f9fb", "#e1e4eb", "#cdd2dd"
    INK, MUTED, BRAND, BRAND_SOFT = "#202536", "#737b8f", "#4f6ff0", "#eef2ff"
    SUCCESS, WARN, ERROR, SHADOW, ON_BRAND = "#2ca36b", "#d89a24", "#d05b63", "#e6e8ee", "#ffffff"
im = Image.new("RGB", (W, H), BG)
d = ImageDraw.Draw(im)

def txt(x, y, value, size=12, color=INK, bold=False, mono=False, anchor=None):
    d.text((x, y), value, font=font(size, bold, mono), fill=color, anchor=anchor)

def box(x0, y0, x1, y1, radius=8, fill=LAYER, outline=LINE, width=1):
    d.rounded_rectangle((x0, y0, x1, y1), radius=radius, fill=fill, outline=outline, width=width)

# Editor-only title bar
d.rectangle((0, 0, W, 48), fill=LAYER)
d.line((0, 47, W, 47), fill=LINE)
txt(20, 15, "Flow editor", 13, INK, True)
box(104, 12, 170, 36, 12, BRAND_SOFT, BRAND_SOFT)
txt(137, 24, "EDIT ONLY", 8, BRAND, True, anchor="mm")
txt(181, 17, "Run from the current Session", 10, MUTED)

# Documents rail
if rail:
    d.rectangle((0, 48, rail, H), fill=LAYER)
    d.line((rail - 1, 48, rail - 1, H), fill=LINE)
    txt(14, 63, "WORKFLOW DOCUMENTS", 12, INK, True)
    txt(14, 84, "Read WORKFLOW.md, then each STEP.md", 9, MUTED)
    d.line((0, 106, rail, 106), fill=LINE)
    txt(16, 119, "MASTER", 9, MUTED, True)
    box(9, 140, rail - 9, 198, 10, BRAND_SOFT, BRAND)
    box(18, 154, 42, 183, 5, BRAND_SOFT, BRAND)
    txt(30, 169, "MD", 8, BRAND, True, anchor="mm")
    txt(51, 151, "WORKFLOW.md", 11, BRAND, True)
    txt(51, 172, ".../new-workflow", 8, MUTED, mono=True)
    txt(16, 215, "STEP WORKSPACES", 9, MUTED, True)
    docs = ["Input", "Plan & break down", "Build", "Screenshot debug", "Quality gate", "Output"]
    for i, label in enumerate(docs):
        y = 240 + i * 57
        active = False
        if active:
            box(9, y, rail - 9, y + 49, 10, BRAND_SOFT, BRAND)
        box(18, y + 10, 42, y + 38, 5, LAYER if not active else BRAND_SOFT, BRAND if active else MUTED)
        txt(30, y + 24, f"{i+1:02d}", 8, BRAND if active else MUTED, True, anchor="mm")
        txt(51, y + 8, label, 10, BRAND if active else INK, True)
        txt(51, y + 26, f"{i+1:02d}-{label.lower().replace(' ', '-')}/STEP.md"[:25], 7, MUTED, mono=True)
# Resizable panel edges remain visible even when a panel is fully collapsed.
for sx, is_closed in [(rail, rail == 0), (ix - splitter, inspector == 0)]:
    d.rectangle((sx, 48, sx + splitter, H), fill=LAYER)
    d.rectangle((sx + 3, 48, sx + 5, H), fill=BRAND if is_closed else LINE)
    gy = H // 2
    d.rounded_rectangle((sx + 2, gy - 20, sx + 6, gy + 20), radius=2, fill=BRAND if is_closed else BORDER2)

# Toolbar
d.rectangle((cx, 48, cx + cw, 106), fill=LAYER)
d.line((cx, 105, cx + cw, 105), fill=LINE)
txt(cx + 14, 69, "Flow", 10, MUTED)
box(cx + 48, 63, cx + min(250, cw - 300), 95)
txt(cx + 60, 72, "New workflow - docs first", 10)
x = cx + min(264, max(110, cw * .31))
for label, bw in [("Import", 58), ("Export", 58), ("Save", 50), ("<-", 32), ("->", 32), ("Auto layout", 78)]:
    box(x, 63, x + bw, 95)
    txt(x + bw / 2, 79, label, 9, anchor="mm")
    x += bw + 8
if W >= 1180:
    txt(cx + cw - 14, 75, "Markdown synced", 9, SUCCESS, anchor="ra")

# Canvas and dot grid
canvas_y = 100
add_h, resize_h, assistant_h = 50, 8, (44 if collapsed else 240)
canvas_h = H - canvas_y - add_h - resize_h - assistant_h
d.rectangle((cx, canvas_y, cx + cw, canvas_y + canvas_h), fill=BG)
for gx in range(cx + 12, cx + cw, 24):
    for gy in range(canvas_y + 12, canvas_y + canvas_h, 24):
        d.ellipse((gx, gy, gx + 2, gy + 2), fill=LINE)

graph_nodes = [
    ("input", "INPUT", "Input", 40, 250),
    ("research", "AGENT", "Research", 300, 250),
    ("plan", "AGENT", "Plan", 560, 250),
    ("build", "AGENT", "Build", 820, 250),
    ("review", "CONDITION", "Logic", 1080, 250),
    ("qa", "AGENT", "Screenshot QA", 1340, 150),
    ("fix", "AGENT", "Fix", 1340, 390),
    ("deliver", "AGENT", "Deliver", 1600, 250),
    ("archive", "AGENT", "Archive", 1860, 250),
    ("output", "OUTPUT", "Output", 2120, 250),
]
graph_edges = [
    ("input", "research"), ("research", "plan"), ("plan", "build"), ("build", "review"),
    ("review", "qa"), ("review", "fix"), ("fix", "qa"), ("qa", "deliver"),
    ("deliver", "archive"), ("archive", "output"),
]
world = {node[0]: node for node in graph_nodes}
world_min_x, world_max_x = 40, 2328
world_min_y, world_max_y = 150, 506
scale = min((cw - 54) / (world_max_x - world_min_x), (canvas_h - 46) / (world_max_y - world_min_y))
scale = max(.2, min(.56, scale))
origin_x = cx + (cw - (world_max_x - world_min_x) * scale) / 2 - world_min_x * scale
origin_y = canvas_y + (canvas_h - (world_max_y - world_min_y) * scale) / 2 - world_min_y * scale

def point(wx, wy):
    return origin_x + wx * scale, origin_y + wy * scale

def bezier(p0, p1, p2, p3, count=28):
    pts = []
    for index in range(count + 1):
        t = index / count
        q = 1 - t
        pts.append((q**3*p0[0] + 3*q*q*t*p1[0] + 3*q*t*t*p2[0] + t**3*p3[0], q**3*p0[1] + 3*q*q*t*p1[1] + 3*q*t*t*p2[1] + t**3*p3[1]))
    return pts

# SVG-equivalent edge layer: fill is always none; every visible curve ends in one closed marker.
for source_id, target_id in graph_edges:
    source = world[source_id]
    target = world[target_id]
    sx, sy = point(source[3] + 208, source[4] + 58)
    tx, ty = point(target[3], target[4] + 58)
    bend = max(54 * scale, abs(tx - sx) * .46)
    pts = bezier((sx, sy), (sx + bend, sy), (tx - bend, ty), (tx, ty))
    d.line(pts, fill=BRAND, width=3, joint="curve")
    angle_x, angle_y = pts[-2]
    vx, vy = tx - angle_x, ty - angle_y
    length = max(1, (vx * vx + vy * vy) ** .5)
    ux, uy = vx / length, vy / length
    size = 10
    d.polygon([(tx, ty), (tx - ux * size - uy * 5, ty - uy * size + ux * 5), (tx - ux * size + uy * 5, ty - uy * size - ux * 5)], fill=BRAND)

for i, (node_id, kind, label, wx, wy) in enumerate(graph_nodes):
    nx, ny = point(wx, wy)
    node_w, node_h = 208 * scale, 116 * scale
    active = node_id == "build"
    radius = max(5, int(12 * scale))
    d.rounded_rectangle((nx + 2, ny + 5, nx + node_w + 2, ny + node_h + 5), radius=radius, fill=SHADOW)
    box(nx, ny, nx + node_w, ny + node_h, radius, LAYER, BRAND if active else BORDER2, 2 if active else 1)
    pad = max(6, 12 * scale)
    txt(nx + pad, ny + 8 * scale, kind, max(6, int(9 * scale + 3)), SUCCESS if kind == "INPUT" else (ERROR if kind == "OUTPUT" else BRAND), True)
    txt(nx + pad, ny + 31 * scale, label, max(7, int(11 * scale + 3)), INK, True)
    txt(nx + pad, ny + 57 * scale, "Input, output, fallback, QA"[:22], max(6, int(8 * scale + 3)), MUTED)
    d.line((nx + pad, ny + 80 * scale, nx + node_w - pad, ny + 80 * scale), fill=LINE)
    txt(nx + pad, ny + 91 * scale, f"{i+1:02d}-{node_id}/STEP.md", max(6, int(7 * scale + 3)), MUTED, mono=True)
    # Exactly two owned handles, centered on the left and right borders.
    port_r = max(3, 6 * scale)
    cy = ny + node_h / 2
    for px in (nx, nx + node_w):
        d.ellipse((px - port_r, cy - port_r, px + port_r, cy + port_r), fill=BRAND, outline=BG, width=max(1, int(2 * scale)))

# Flow-box palette
fy = canvas_y + canvas_h
d.rectangle((cx, fy, cx + cw, H), fill=LAYER)
d.line((cx, fy, cx + cw, fy), fill=LINE)
txt(cx + 14, fy + 16, "ADD NODE", 8, MUTED, True)
x = cx + 80
for label in ["Input", "Agent", "Map", "Condition", "Merge", "Output"]:
    if x + 66 > cx + cw - 10:
        break
    box(x, fy + 10, x + 66, fy + 39, 7)
    txt(x + 33, fy + 21, label, 8, anchor="mm")
    x += 74
if cw > 780:
    txt(cx + cw - 14, fy + 18, "Drag between side handles to create an arrow", 8, MUTED, anchor="ra")

# Bottom AI assistant: part of normal layout, never overlays the canvas
resize_y = fy + add_h
d.rectangle((cx, resize_y, cx + cw, resize_y + resize_h), fill=LAYER)
d.rectangle((cx, resize_y + 3, cx + cw, resize_y + 5), fill=LINE)
d.rounded_rectangle((cx + cw / 2 - 22, resize_y + 2, cx + cw / 2 + 22, resize_y + 6), radius=2, fill=BORDER2)
ay = resize_y + resize_h
d.rectangle((cx, ay, cx + cw, H), fill=LAYER)
d.line((cx, ay, cx + cw, ay), fill=LINE)
box(cx + 14, ay + 9, cx + 41, ay + 36, 8, BRAND_SOFT, BRAND_SOFT)
txt(cx + 27, ay + 22, "*", 13, BRAND, True, anchor="mm")
txt(cx + 50, ay + 11, "AI DOCUMENT ASSISTANT", 10, INK, True)
txt(cx + 50, ay + 27, "Manual - one-shot Agent - never runs the flow", 8, MUTED)
target_right = cx + (310 if W < 1180 else 400)
box(cx + 270, ay + 10, target_right, ay + 35, 12, LAYER2, LINE)
txt((cx + 270 + target_right) / 2, ay + 22, "WORKFLOW.md", 8, MUTED, mono=True, anchor="mm")

bx = cx + cw - 430
for label, bw, primary in [("Logic validation", 94, True), ("Optimize doc", 104, False), ("Optimize workflow", 126, False), ("v", 28, False)]:
    box(bx, ay + 8, bx + bw, ay + 37, 7, BRAND if primary else LAYER, BRAND if primary else BORDER2)
    txt(bx + bw / 2, ay + 22, label, 8, ON_BRAND if primary else INK, primary, anchor="mm")
    bx += bw + 6

if not collapsed:
    body_y = ay + 46
    left_w = max(230, int(cw * .36))
    left_x0, left_x1 = cx + 14, cx + left_w - 6
    box(left_x0, body_y, left_x1, H - 12, 11, LAYER2, LINE)
    txt(left_x0 + 10, body_y + 9, "Optimization request (optional)", 8, MUTED)
    box(left_x0 + 9, body_y + 25, left_x1 - 9, body_y + 52, 7, BG, BORDER2)
    txt(left_x0 + 18, body_y + 34, "Emphasize screenshot QA and fallback", 8, MUTED)
    txt(left_x0 + 10, body_y + 63, "8 validation findings", 8, MUTED)
    box(left_x0 + 112, body_y + 57, left_x0 + 166, body_y + 77, 10, LAYER2, ERROR)
    txt(left_x0 + 139, body_y + 67, "Error 2", 7, ERROR, True, anchor="mm")
    box(left_x0 + 173, body_y + 57, left_x0 + 225, body_y + 77, 10, LAYER2, WARN)
    txt(left_x0 + 199, body_y + 67, "Warn 6", 7, WARN, True, anchor="mm")
    for i, (level, message) in enumerate([
        (ERROR, "Missing output contract"),
        (WARN, "Quality step needs acceptance criteria"),
        (WARN, "Condition branch is incomplete")
    ]):
        yy = body_y + 83 + i * 35
        box(left_x0 + 8, yy, left_x1 - 8, yy + 30, 7, BG, BG)
        d.ellipse((left_x0 + 17, yy + 11, left_x0 + 24, yy + 18), fill=level)
        txt(left_x0 + 32, yy + 8, message, 8, INK)
    d.rounded_rectangle((left_x1 - 6, body_y + 84, left_x1 - 3, H - 22), radius=2, fill=LINE)
    d.rounded_rectangle((left_x1 - 6, body_y + 84, left_x1 - 3, body_y + 120), radius=2, fill=BORDER2)

    px = cx + left_w + 6
    box(px, body_y, cx + cw - 14, H - 12, 11, BG, LINE)
    d.rounded_rectangle((px, body_y, cx + cw - 14, body_y + 38), radius=11, fill=LAYER2, outline=LINE)
    d.rectangle((px, body_y + 28, cx + cw - 14, body_y + 38), fill=LAYER2)
    txt(px + 10, body_y + 13, "ACCEPT OR REJECT - FULL MARKDOWN", 8, MUTED, True)
    box(cx + cw - 186, body_y + 6, cx + cw - 98, body_y + 32, 7, LAYER, BORDER2)
    txt(cx + cw - 142, body_y + 19, "Reject", 8, INK, anchor="mm")
    box(cx + cw - 91, body_y + 6, cx + cw - 23, body_y + 32, 7, BRAND, BRAND)
    txt(cx + cw - 57, body_y + 19, "Accept", 8, ON_BRAND, True, anchor="mm")
    for i, (line, bold) in enumerate([
        ("# New workflow", True),
        ("## Goal and scope", True),
        ("Preserve user intent and clarify constraints.", False),
        ("## Deliverables", True),
        ("- Verified files and logic-validation notes", False),
        ("## Quality and acceptance", True)
    ]):
        txt(px + 12, body_y + 50 + i * 18, line, 8, INK if bold else MUTED, bold, mono=True)
    d.rounded_rectangle((cx + cw - 21, body_y + 46, cx + cw - 18, H - 20), radius=2, fill=LINE)
    d.rounded_rectangle((cx + cw - 21, body_y + 46, cx + cw - 18, body_y + 82), radius=2, fill=BORDER2)

# Markdown editor
if inspector:
    d.rectangle((ix, 48, W, H), fill=LAYER)
    d.line((ix, 48, ix, H), fill=LINE)
    txt(ix + 16, 64, "WORKFLOW.md", 13, INK, True)
    txt(ix + 16, 88, "DOCS FIRST", 8, BRAND, True)
    box(ix + 16, 112, W - 16, 171, 9, LAYER2, LINE)
    txt(ix + 27, 122, "DOCUMENT WORKSPACE", 8, MUTED)
    txt(ix + 27, 143, "~/.dsh/deepseek-flow/workspaces/...", 8, INK, mono=True)
    txt(ix + 16, 188, "Markdown content", 10, MUTED)
    box(ix + 16, 207, W - 16, H - 20, 9, BG, BORDER2)
    editor_lines = [
        ("# New workflow", True), ("", False),
        ("Read this file before each STEP.md.", False), ("", False),
        ("## Execution order", True), ("", False),
        ("1. Input", False), ("2. Plan & break down", False),
        ("3. Build", False), ("4. Screenshot debug", False),
        ("5. Quality gate", False), ("6. Output", False), ("", False),
        ("## Quality contract", True), ("- Run the workflow", False),
        ("- Capture key screenshots", False), ("- Verify regressions", False),
    ]
    y = 225
    for line, is_bold in editor_lines:
        txt(ix + 29, y, line, 10, INK if is_bold else MUTED, is_bold, mono=True)
        y += 24

out.parent.mkdir(parents=True, exist_ok=True)
im.save(out)
print(f"saved {out} ({W}x{H})")
