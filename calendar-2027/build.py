import sys, html, datetime as dt
sys.path.insert(0, '/tmp/claude-0/-home-user-mindvalley/a0c4dc2e-0632-5fef-9aff-540dc237d994/scratchpad')
from data import *
from plan import PLAN

E = html.escape
def M(x, d=2):
    if x is None: return "n/a"
    return f"${x/1e6:.{d}f}M" if x >= 1e6 else f"${x/1e3:.0f}k"
def Mm(x): return f"${x:.2f}M" if x < 10 else f"${x:.1f}M"

fy25 = campaign_total("FY2025"); ytd25 = campaign_total("YTD2025"); ytd26 = campaign_total("YTD2026")
target = fy25 * 1.5
plan_base = sum(p["base"] for p in PLAN); plan_target = sum(p["target"] for p in PLAN)
def br(*ids):
    return sum(p["target"]-p["base"] for p in PLAN if p["id"] in ids)
plan_target_ex21 = plan_target - [p for p in PLAN if p["id"]==21][0]["target"]

LINE_LABEL = {"Mastery":"Mastery programs","Certifications":"Certifications","Accelerator":"Accelerators","Guild":"Guilds","Coach":"Mindvalley Coach","B2B":"B2B","Events":"Events (MVU, Future Human)","Lifebook":"Lifebook","Wildfit":"WildFit","Membership_launch_tagged":"Membership, launch-tagged"}

# ---------- Chart 1: revenue by line ----------
def chart_lines():
    rows = [k for k in CAMPAIGN_LINES if k not in ("B2B","Coach","Wildfit","Guild")]
    rows.append("Other (Coach, B2B, Guild, WildFit)")
    def val(p,k):
        if k.startswith("Other"): return sum(BU[p][x] for x in ("Coach","B2B","Guild","Wildfit"))
        return BU[p][k]
    W, LH, left = 760, 46, 230
    mx = max(val("FY2025",r) for r in rows)
    scale = (W-left-80)/mx
    H = 40 + LH*len(rows)
    s = [f'<svg viewBox="0 0 {W} {H}" role="img" aria-label="Campaign revenue by line, 2025 vs 2026">']
    for i,r in enumerate(rows):
        y = 30 + i*LH
        lbl = LINE_LABEL.get(r, r)
        s.append(f'<text x="{left-12}" y="{y+19}" text-anchor="end" class="ct">{E(lbl)}</text>')
        a, b, c = val("FY2025",r), val("YTD2025",r), val("YTD2026",r)
        s.append(f'<rect x="{left}" y="{y}" width="{a*scale:.1f}" height="14" rx="3" class="s1"/>')
        s.append(f'<rect x="{left}" y="{y+16}" width="{c*scale:.1f}" height="14" rx="3" class="s2"/>')
        # 2025 same-window tick
        s.append(f'<line x1="{left+b*scale:.1f}" x2="{left+b*scale:.1f}" y1="{y-2}" y2="{y+32}" class="tick"/>')
        s.append(f'<text x="{left+a*scale+6:.1f}" y="{y+11}" class="cv">{E(M(a,1))}</text>')
        s.append(f'<text x="{left+c*scale+6:.1f}" y="{y+27}" class="cv">{E(M(c,1))}</text>')
    s.append('</svg>')
    return "\n".join(s)

# ---------- Chart 2: mastery launches ----------
def chart_mastery():
    W, LH, left = 760, 52, 250
    mx = max(max(b[2],c[2]) for _,b,c in MASTERY); scale = (W-left-200)/mx
    H = 30 + LH*len(MASTERY)
    s = [f'<svg viewBox="0 0 {W} {H}" role="img" aria-label="Mastery launch revenue, 2025 vs 2026">']
    for i,(n,b,c) in enumerate(MASTERY):
        y = 20 + i*LH
        s.append(f'<text x="{left-12}" y="{y+20}" text-anchor="end" class="ct">{E(n)}</text>')
        s.append(f'<rect x="{left}" y="{y}" width="{b[2]*scale:.1f}" height="14" rx="3" class="s1"/>')
        s.append(f'<rect x="{left}" y="{y+16}" width="{c[2]*scale:.1f}" height="14" rx="3" class="s2"/>')
        s.append(f'<text x="{left+b[2]*scale+6:.1f}" y="{y+11}" class="cv">{E(M(b[2]))} · ${b[2]/b[1]:.0f}/lead</text>')
        s.append(f'<text x="{left+c[2]*scale+6:.1f}" y="{y+27}" class="cv">{E(M(c[2]))} · ${c[2]/c[1]:.0f}/lead</text>')
    s.append('</svg>')
    return "\n".join(s)

# ---------- Chart 3: membership monthly ----------
def chart_membership():
    W, H, left, top, bottom = 760, 260, 60, 20, 40
    n = len(MEMBERSHIP_MONTHLY); mx = 12_000_000
    cw = (W-left-20)/n
    def yy(v): return top + (H-top-bottom)*(1 - v/mx)
    s = [f'<svg viewBox="0 0 {W} {H}" role="img" aria-label="Monthly membership revenue, total and launch-tagged">']
    for g in (0,4,8,12):
        s.append(f'<line x1="{left}" x2="{W-20}" y1="{yy(g*1e6):.1f}" y2="{yy(g*1e6):.1f}" class="grid"/>')
        s.append(f'<text x="{left-8}" y="{yy(g*1e6)+4:.1f}" text-anchor="end" class="ca">${g}M</text>')
    pts=[]
    for i,(ym,tot,tag,new,_) in enumerate(MEMBERSHIP_MONTHLY):
        x = left + i*cw
        s.append(f'<rect x="{x+3:.1f}" y="{yy(tot):.1f}" width="{cw-6:.1f}" height="{H-bottom-yy(tot):.1f}" rx="3" class="s3b"/>')
        s.append(f'<rect x="{x+3:.1f}" y="{yy(tag):.1f}" width="{cw-6:.1f}" height="{H-bottom-yy(tag):.1f}" rx="3" class="s1"/>')
        pts.append(f"{x+cw/2:.1f},{yy(new):.1f}")
        if ym.endswith("-01") or ym.endswith("-07") or ym.endswith("-11"):
            s.append(f'<text x="{x+cw/2:.1f}" y="{H-14}" text-anchor="middle" class="ca">{ym}</text>')
    s.append(f'<polyline points="{" ".join(pts)}" class="line2"/>')
    s.append('</svg>')
    return "\n".join(s)

# ---------- Gantt ----------
LINE_CLASS = {"mastery":"g-mastery","cert":"g-cert","accel":"g-accel","event":"g-event","membership":"g-member","lifebook":"g-lifebook","guild":"g-guild","wildfit":"g-wildfit"}
def doy(sdate):
    d = dt.date.fromisoformat(sdate); y0 = dt.date(2027,1,1)
    return (d - y0).days
def gantt():
    W, left, LH, top = 1000, 300, 26, 34
    rows = sorted(PLAN, key=lambda p:(p["start"], p["id"]))
    H = top + LH*len(rows) + 10
    dayw = (W-left-16)/365
    s = [f'<svg viewBox="0 0 {W} {H}" role="img" aria-label="2027 calendar, promotion windows and live dates">']
    for m in range(12):
        x = left + doy(f"2027-{m+1:02d}-01")*dayw
        s.append(f'<line x1="{x:.1f}" x2="{x:.1f}" y1="{top-6}" y2="{H-6}" class="grid"/>')
        s.append(f'<text x="{x+ (dayw*15):.1f}" y="{top-12}" text-anchor="middle" class="ca">{["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][m]}</text>')
    for i,p in enumerate(rows):
        y = top + i*LH
        cls = LINE_CLASS[p["line"]]
        name = p["name"] if len(p["name"]) <= 44 else p["name"][:42]+"…"
        s.append(f'<text x="{left-10}" y="{y+15}" text-anchor="end" class="ct small">{E(name)}</text>')
        ps = max(doy(p["promo"]), 0) if p["promo"] >= "2027-01-01" else 0
        pe = doy(p["start"])
        if pe > ps:
            s.append(f'<rect x="{left+ps*dayw:.1f}" y="{y+6}" width="{(pe-ps)*dayw:.1f}" height="10" rx="5" class="{cls} promo"/>')
        a, b = doy(p["start"]), doy(p["end"])+1
        s.append(f'<rect x="{left+a*dayw:.1f}" y="{y+3}" width="{max((b-a)*dayw,6):.1f}" height="16" rx="4" class="{cls}"/>')
        for (xa,xb) in p["extra"]:
            a2, b2 = doy(xa), doy(xb)+1
            s.append(f'<rect x="{left+a2*dayw:.1f}" y="{y+6}" width="{max((b2-a2)*dayw,5):.1f}" height="10" rx="3" class="{cls}"/>')
    s.append('</svg>')
    return "\n".join(s)

STATUS = {"sheet":("In the 2027 sheet · unchanged","chip-sheet"),"jaideep":("Jaideep's Academy timeline","chip-jd"),"proposed":("Proposed","chip-new")}

def plan_table():
    out = ['<div class="tw"><table class="plan"><thead><tr><th>#</th><th>Campaign</th><th>Dates (2027)</th><th>Status</th><th>Sells</th><th>Benchmark (best of 2025 / 2026)</th><th class="num">Base case</th><th class="num">Target (1.5×)</th><th>What has to be true</th></tr></thead><tbody>']
    for p in PLAN:
        lab, cls = STATUS[p["status"]]
        out.append(f'<tr><td>{p["id"]}</td><td><strong>{E(p["name"])}</strong></td><td>{E(p["dates"])}</td><td><span class="chip {cls}">{lab}</span></td><td>{E(p["sells"])}</td><td class="muted">{E(p["bench"])}</td><td class="num">{Mm(p["base"])}</td><td class="num strong">{Mm(p["target"])}</td><td class="muted">{E(p["lever"])}</td></tr>')
    out.append(f'<tr class="total"><td></td><td colspan="5">Total, 27 rows</td><td class="num">{Mm(plan_base)}</td><td class="num strong">{Mm(plan_target)}</td><td class="muted">Row 21 (Spiritual Summit) is counted in both totals; without it the target column is {Mm(plan_target_ex21)}.</td></tr>')
    out.append('</tbody></table></div>')
    return "\n".join(out)

def score_table(rows, year):
    out = [f'<div class="tw"><table class="score"><thead><tr><th>Campaign</th><th>Dates ({year})</th><th>Type</th><th>Sold</th><th>Leads</th><th class="num">Revenue</th><th>Notes</th></tr></thead><tbody>']
    for (name,dates,typ,sells,leads,rev,revtxt,note) in rows:
        cls = "" if rev else "dim"
        out.append(f'<tr class="{cls}"><td><strong>{E(name)}</strong></td><td>{E(dates)}</td><td>{E(typ)}</td><td>{E(sells)}</td><td>{E(leads)}</td><td class="num">{E(revtxt)}</td><td class="muted">{E(note)}</td></tr>')
    out.append('</tbody></table></div>')
    return "\n".join(out)

def sheet_rows():
    cols = ["Name of project","Unique Name","Status","Ticket","Event type","Month","Year","Start date","End Date","Promotions Start Date","Medium","💿 Production Type","Type","Promotions Duration","Responsible","$ Rev target"]
    out = ['<div class="tw"><table class="sheet"><thead><tr>'+"".join(f"<th>{E(c)}</th>" for c in cols)+'</tr></thead><tbody>']
    csv = [",".join(cols)]
    for p in PLAN:
        if p["status"]=="sheet": continue  # already there, unchanged
        sd = dt.date.fromisoformat(p["start"]); ed = dt.date.fromisoformat(p["end"]); pd = dt.date.fromisoformat(p["promo"])
        mon = sd.strftime("%b"); uniq = p["name"].split(" (")[0].split(",")[0]
        status = "Proposal" if p["status"]=="proposed" else "Confirmed"
        vals = [f'{uniq} | {p["etype"]} | {mon} 2027', uniq, status, p["ticket"], p["etype"], mon, "2027",
                sd.strftime("%-d %B %Y"), ed.strftime("%-d %B %Y") if ed!=sd else "", pd.strftime("%B %-d, %Y"),
                p["medium"], p["prod"], p["ptype"], str(p["pdur"]), p["owner"], f'${int(p["target"]*1e6)}']
        out.append("<tr>"+"".join(f"<td>{E(v)}</td>" for v in vals)+"</tr>")
        csv.append(",".join('"'+v.replace('"','""')+'"' for v in vals))
    out.append('</tbody></table></div>')
    open('/tmp/claude-0/-home-user-mindvalley/a0c4dc2e-0632-5fef-9aff-540dc237d994/scratchpad/2027_calendar_proposal.csv','w').write("\n".join(csv))
    return "\n".join(out)

n25 = sum(r[3] for r in MEMBERSHIP_MONTHLY if r[0] <= '2025-10') + 1_400_000
n26 = sum(r[3] for r in MEMBERSHIP_MONTHLY if r[0].startswith('2026'))

page = f"""<title>2027 Campaign Calendar</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,700&family=DM+Mono:wght@400;500&display=swap">
<style>
/* Layout: one long strategy-day read; sticky section nav; brand purple carries the Academy line, cool greys everywhere else. */
:root {{
  --bg:#ffffff; --bg-muted:#f9f9f9; --bg-subtle:#f3f4f6; --surface:#ffffff; --fg:#0f131a; --fg-muted:#595e67; --fg-subtle:#71767f;
  --border:#dfe1e5; --border-muted:#f3f4f6; --brand:#7a12d4; --brand-light:#f8efff; --brand-border:#eed8fe;
  --c-mastery:#7a12d4; --c-cert:#ed6325; --c-event:#005cff; --c-member:#159f65; --c-lifebook:#df1a6f; --c-accel:#9b37f2; --c-guild:#4f0c8a; --c-wildfit:#128756;
  --s1:#7a12d4; --s2:#ed6325; --s3:#005cff; --s3b:#cce6ff; --grid:#e8e9ec; --tick:#0f131a;
  --font:"Google Sans","DM Sans",Inter,system-ui,sans-serif; --mono:"DM Mono",ui-monospace,Menlo,monospace;
}}
@media (prefers-color-scheme: dark) {{ :root:not([data-theme="light"]) {{
  --bg:#0f131a; --bg-muted:#181d26; --bg-subtle:#292d38; --surface:#181d26; --fg:#ffffff; --fg-muted:#b3b8c1; --fg-subtle:#979ca5;
  --border:#41464f; --border-muted:#292d38; --brand:#9b37f2; --brand-light:#241339; --brand-border:#4f0c8a;
  --c-mastery:#9b37f2; --c-cert:#ed6325; --c-event:#2f86ea; --c-member:#18b06c; --c-lifebook:#f72c84; --c-accel:#b06cf5; --c-guild:#c99cf7; --c-wildfit:#18c176;
  --s1:#9b37f2; --s2:#ed6325; --s3:#2f86ea; --s3b:#2b3b55; --grid:#2c313b; --tick:#ffffff; color-scheme:dark }} }}
:root[data-theme="dark"] {{
  --bg:#0f131a; --bg-muted:#181d26; --bg-subtle:#292d38; --surface:#181d26; --fg:#ffffff; --fg-muted:#b3b8c1; --fg-subtle:#979ca5;
  --border:#41464f; --border-muted:#292d38; --brand:#9b37f2; --brand-light:#241339; --brand-border:#4f0c8a;
  --c-mastery:#9b37f2; --c-cert:#ed6325; --c-event:#2f86ea; --c-member:#18b06c; --c-lifebook:#f72c84; --c-accel:#b06cf5; --c-guild:#c99cf7; --c-wildfit:#18c176;
  --s1:#9b37f2; --s2:#ed6325; --s3:#2f86ea; --s3b:#2b3b55; --grid:#2c313b; --tick:#ffffff; color-scheme:dark }}
* {{ box-sizing:border-box }}
body {{ background:var(--bg); color:var(--fg); font-family:var(--font); font-size:16px; line-height:1.5; margin:0 }}
.wrap {{ max-width:1180px; margin:0 auto; padding-left:max(16px, env(safe-area-inset-left, 0px)); padding-right:max(16px, env(safe-area-inset-right, 0px)); padding-block:0 64px }}
body::before {{ content:""; position:fixed; inset:0 0 auto; height:env(safe-area-inset-top,0px); z-index:10; background:var(--bg) }}
nav.top {{ position:sticky; top:env(safe-area-inset-top,0px); z-index:9; background:var(--bg); border-bottom:1px solid var(--border); }}
nav.top .in {{ max-width:1180px; margin:0 auto; display:flex; gap:4px; overflow-x:auto; padding-left:max(16px, env(safe-area-inset-left, 0px)); padding-right:max(16px, env(safe-area-inset-right, 0px)); padding-block:10px }}
nav.top a {{ white-space:nowrap; color:var(--fg-muted); text-decoration:none; font-weight:500; font-size:14px; padding:6px 12px; border-radius:128px }}
nav.top a:hover, nav.top a:focus-visible {{ background:var(--brand-light); color:var(--brand); outline:none }}
.eyebrow {{ font-size:12px; letter-spacing:.08em; text-transform:uppercase; color:var(--brand); font-weight:700 }}
h1 {{ font-size:clamp(34px,5vw,56px); line-height:1.05; letter-spacing:-.02em; margin:8px 0 12px; text-wrap:balance; font-weight:700 }}
h2 {{ font-size:clamp(24px,3vw,32px); letter-spacing:-.02em; margin:0 0 8px; text-wrap:balance }}
h3 {{ font-size:19px; margin:24px 0 8px }}
.lede {{ font-size:19px; color:var(--fg-muted); max-width:70ch; margin:0 }}
section {{ padding-block:40px; border-top:1px solid var(--border-muted) }}
section:first-of-type {{ border-top:0; padding-top:40px }}
p {{ max-width:72ch }}
.tiles {{ display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:12px; margin:28px 0 8px }}
.tile {{ background:var(--bg-muted); border:1px solid var(--border-muted); border-radius:16px; padding:18px 20px }}
.tile .k {{ font-size:12px; letter-spacing:.08em; text-transform:uppercase; color:var(--fg-subtle); font-weight:500 }}
.tile .v {{ font-size:34px; font-weight:700; letter-spacing:-.02em; font-variant-numeric:tabular-nums; margin:4px 0 2px }}
.tile .d {{ font-size:14px; color:var(--fg-muted) }}
.tile.hero {{ background:var(--brand-light); border-color:var(--brand-border) }}
.tile.hero .v {{ color:var(--brand) }}
.chart {{ background:var(--surface); border:1px solid var(--border); border-radius:16px; padding:18px 16px 8px; margin:16px 0; overflow-x:auto }}
.chart svg {{ width:100%; height:auto; display:block; min-width:600px }}
.chart .cap {{ font-size:14px; color:var(--fg-muted); margin:8px 4px 6px }}
.legend {{ display:flex; flex-wrap:wrap; gap:14px; font-size:13px; color:var(--fg-muted); margin:4px 4px 8px }}
.legend span::before {{ content:""; display:inline-block; width:12px; height:12px; border-radius:3px; margin-right:6px; vertical-align:-1px; background:var(--sw) }}
.ct {{ font:500 13px var(--font); fill:var(--fg) }} .ct.small {{ font-size:12px }}
.cv {{ font:500 12px var(--mono); fill:var(--fg-muted); paint-order:stroke; stroke:var(--surface); stroke-width:4px; stroke-linejoin:round }} .ca {{ font:400 12px var(--font); fill:var(--fg-subtle) }}
.s1 {{ fill:var(--s1) }} .s2 {{ fill:var(--s2) }} .s3b {{ fill:var(--s3b) }} .grid {{ stroke:var(--grid); stroke-width:1 }} .tick {{ stroke:var(--tick); stroke-width:2 }}
.line2 {{ fill:none; stroke:var(--s2); stroke-width:2; stroke-linejoin:round }}
.g-mastery {{ fill:var(--c-mastery) }} .g-cert {{ fill:var(--c-cert) }} .g-accel {{ fill:var(--c-accel) }} .g-event {{ fill:var(--c-event) }} .g-member {{ fill:var(--c-member) }} .g-lifebook {{ fill:var(--c-lifebook) }} .g-guild {{ fill:var(--c-guild) }} .g-wildfit {{ fill:var(--c-wildfit) }}
.promo {{ opacity:.28 }}
.findings {{ display:grid; grid-template-columns:repeat(auto-fit,minmax(300px,1fr)); gap:14px; margin-top:16px }}
.finding {{ border:1px solid var(--border); border-radius:16px; padding:18px 20px; background:var(--surface) }}
.finding .n {{ font-family:var(--mono); font-size:12px; color:var(--brand); font-weight:500 }}
.finding h4 {{ margin:6px 0 6px; font-size:17px; letter-spacing:-.01em }}
.finding p {{ margin:0; font-size:15px; color:var(--fg-muted) }}
.finding .big {{ font-size:26px; font-weight:700; letter-spacing:-.02em; font-variant-numeric:tabular-nums; color:var(--fg); margin:2px 0 4px }}
.rules {{ counter-reset:r; list-style:none; padding:0; margin:12px 0 0; display:grid; gap:10px }}
.rules li {{ border-left:3px solid var(--brand); padding:4px 0 4px 16px; max-width:80ch }}
.rules li strong {{ display:block }}
.tw {{ overflow-x:auto; border:1px solid var(--border); border-radius:12px; margin:14px 0 }}
table {{ border-collapse:collapse; width:100%; font-size:13.5px; min-width:900px }}
th {{ text-align:left; font-size:11.5px; letter-spacing:.06em; text-transform:uppercase; color:var(--fg-subtle); font-weight:500; padding:10px 12px; border-bottom:1px solid var(--border); background:var(--bg-muted); position:sticky; top:0 }}
td {{ padding:10px 12px; border-bottom:1px solid var(--border-muted); vertical-align:top }}
td.num, th.num {{ text-align:right; font-variant-numeric:tabular-nums; white-space:nowrap; font-family:var(--mono); font-size:13px }}
td.strong {{ font-weight:700; color:var(--brand) }}
td.muted {{ color:var(--fg-muted); font-size:13px }}
tr.dim td {{ color:var(--fg-subtle) }} tr.dim td strong {{ color:var(--fg-muted); font-weight:500 }}
tr.total td {{ background:var(--bg-muted); font-weight:700; border-top:2px solid var(--border) }}
table.plan {{ min-width:1280px }} table.sheet {{ min-width:1500px; font-size:12.5px }}
.chip {{ display:inline-block; font-size:11.5px; font-weight:500; padding:3px 10px; border-radius:128px; white-space:nowrap }}
.chip-sheet {{ background:var(--bg-subtle); color:var(--fg) }} .chip-jd {{ background:var(--brand-light); color:var(--brand) }} .chip-new {{ background:#e8f9f1; color:#0e6742 }}
:root[data-theme="dark"] .chip-new {{ background:#113626; color:#18c176 }}
@media (prefers-color-scheme: dark) {{ :root:not([data-theme="light"]) .chip-new {{ background:#113626; color:#18c176 }} }}
.bridge {{ display:grid; grid-template-columns:repeat(auto-fit,minmax(260px,1fr)); gap:12px; margin-top:14px }}
.bridge .b {{ background:var(--bg-muted); border-radius:12px; padding:14px 16px; font-size:14px }}
.bridge .b .v {{ font-family:var(--mono); font-weight:500; font-size:18px; color:var(--brand) }}
.note {{ background:var(--bg-muted); border-radius:12px; padding:14px 18px; font-size:14px; color:var(--fg-muted); max-width:90ch }}
details {{ margin:10px 0 }} summary {{ cursor:pointer; font-weight:500; color:var(--brand) }}
.src {{ font-size:13px; color:var(--fg-subtle); max-width:90ch }}
@media (max-width:640px) {{ .tile .v {{ font-size:28px }} }}
@media (prefers-reduced-motion: no-preference) {{ nav.top a {{ transition:background .15s }} }}
</style>

<nav class="top"><div class="in">
<a href="#summary">Summary</a><a href="#why">Why 2026 is lower</a><a href="#y2025">2025 scorecard</a><a href="#y2026">2026 scorecard</a><a href="#rules">What we keep</a><a href="#plan">2027 calendar</a><a href="#targets">Targets</a><a href="#sheet">Sheet rows</a>
</div></nav>

<div class="wrap">
<section id="summary">
<div class="eyebrow">Mindvalley · Strategy day · prepared 11 Nov 2026</div>
<h1>2027 Campaign Calendar</h1>
<p class="lede">Every 2025 and 2026 campaign in the official calendar scored on leads and revenue from Metabase, the reasons 2026 came in lower, and a 2027 calendar built from Jaideep's Academy timeline and what the numbers say. Confirmed 2027 rows are kept as they are.</p>
<div class="tiles">
 <div class="tile"><div class="k">2025 campaign revenue</div><div class="v">{M(fy25,1)}</div><div class="d">Academy + Events + Lifebook + WildFit + launch-tagged Membership. Best year of the two.</div></div>
 <div class="tile"><div class="k">2026 to 10 Nov</div><div class="v">{M(ytd26,1)}</div><div class="d">Same window in 2025: {M(ytd25,1)} ({(ytd26/ytd25-1)*100:.0f}%). Full-year 2026 lands near $38-40M once Black Friday, Q5 and Lifebook come in.</div></div>
 <div class="tile hero"><div class="k">2027 target · 1.5× best year</div><div class="v">{M(target,1)}</div><div class="d">Plan below sums to {Mm(plan_target)} in stretch targets and {Mm(plan_base)} in the evidence-weighted base case.</div></div>
 <div class="tile"><div class="k">Launch sign-ups</div><div class="v">594k</div><div class="d">2025 launch-tagged lead rows (436k unique). 2026 to date: 498k rows (313k unique). Volume held; conversion did not.</div></div>
</div>
<div class="chart">
 <div class="legend"><span style="--sw:var(--s1)">2025 full year</span><span style="--sw:var(--s2)">2026, 1 Jan to 10 Nov</span><span style="--sw:var(--tick)">tick = 2025 in the same 1 Jan to 10 Nov window</span></div>
 {chart_lines()}
 <div class="cap">Campaign revenue by line, USD gross order value (ex-tax, refunds not deducted). Mastery includes summit tickets and VIP upgrades. Membership counts only orders tagged to a Product Launch campaign; evergreen membership is excluded.</div>
</div>
<div class="note">How to read the numbers. Revenue is <code>order_amount</code> from the sales order table with Mindvalley staff removed. Mastery launches are measured by cohort (every order attached to that cohort, whenever placed). Membership promos are measured two ways: orders tagged to the launch, and the lift of the window over the surrounding baseline. Leads are sign-up rows on the campaign's pages; where a page double-logged (2026 Aug and Sep summits), the unique-user count is quoted. Items the calendar lists but Metabase cannot isolate (quest soft releases, value emails, a few workshops) are shown but not scored.</div>
</section>

<section id="why">
<div class="eyebrow">Part 1</div>
<h2>Why 2026 is lower, in order of size</h2>
<p>Like-for-like (1 Jan to 10 Nov), campaign revenue is {M(ytd25,1)} to {M(ytd26,1)}, a {M(ytd25-ytd26,1)} gap. Six things explain almost all of it.</p>
<div class="findings">
 <div class="finding"><div class="n">01</div><h4>The membership base shrank</h4><div class="big">{M(n25,1)} → {M(n26,1)}</div><p>New-member revenue, Jan to 10 Nov. New orders fell from 12-18k a month to 5-7k while evergreen masterclass sign-ups rose 20%. Fewer members means a smaller warm audience for every summit (members were 35-45% of summit sign-ups) and a smaller Black Friday base. Not a calendar problem, but it caps every membership promo.</p></div>
 <div class="finding"><div class="n">02</div><h4>Two flagship summits went free</h4><div class="big">−$4.6M</div><p>Manifesting: $6.69M hybrid in 2025 (54k leads, $124 per sign-up) to $4.03M free in 2026 (136k leads, $30). AI: $7.08M hybrid in July 2025 to $5.07M free in March 2026. More leads, less revenue. Paid tickets are the single biggest lever in the plan.</p></div>
 <div class="finding"><div class="n">03</div><h4>Certifications halved</h4><div class="big">$7.5M → $4.0M</div><p>2025 ran CLC, Business Coach and Hypnotherapist launches plus monthly rolling cohorts worth about $2.3M. 2026 ran two launches (CLC Feb $1.17M, MCH Aug $1.43M), skipped Business Coach and stopped the monthly intakes.</p></div>
 <div class="finding"><div class="n">04</div><h4>No Future Human in 2026</h4><div class="big">−$4.7M</div><p>January 2025's festival sold $1.15M of tickets, $2.42M of the Future Human Mastery bundle and $0.99M of Total Mastery. Nothing replaced it in 2026; Total Mastery alone did $0.46M.</p></div>
 <div class="finding"><div class="n">05</div><h4>Social Media and Speaking slipped</h4><div class="big">−$1.6M</div><p>Social Media at 1BFS Dubai doubled sign-ups to 145k but made $2.10M vs $3.23M, with only six weeks of runway and $0.48M refunded. Speaking & Influence $2.04M to $1.53M.</p></div>
 <div class="finding"><div class="n">06</div><h4>What 2026 added</h4><div class="big">+$2.2M</div><p>Accelerators are a new line ($1.34M from five webinar-led launches). Expert to Authority beat Entrepreneurship ($2.76M vs $2.52M) and seeded Guilds ($0.13M). WildFit came back ($0.47M). MVU 2027 presale is ahead of MVU 2026's pace.</p></div>
</div>
<h3>Mastery launches side by side</h3>
<div class="chart">
 <div class="legend"><span style="--sw:var(--s1)">2025</span><span style="--sw:var(--s2)">2026</span></div>
 {chart_mastery()}
 <div class="cap">Revenue per cohort (Mastery + tickets + VIP) and revenue per summit sign-up. Row 5 compares Entrepreneurship 2025 with Expert to Authority 2026; row 6 compares Spiritual 2025 with AI for Founders 2026, which is still selling.</div>
</div>
<h3>Membership month by month</h3>
<div class="chart">
 <div class="legend"><span style="--sw:var(--s3b)">Total membership revenue</span><span style="--sw:var(--s1)">Launch-tagged (promos, Black Friday, Q5)</span><span style="--sw:var(--s2)">New-member revenue (line)</span></div>
 {chart_membership()}
 <div class="cap">MV Membership sub-unit only. November 2025 is Black Friday: $11.3M in the month, $6.5M of it launch-tagged. The 2026 run-rate is about 40% below 2025 outside promo months.</div>
</div>
</section>

<section id="y2025">
<div class="eyebrow">Part 2</div>
<h2>2025 scorecard</h2>
<p>Every row of the 2025 calendar, excluding program and class-start rows. Scored rows sum to {M(sum(r[5] for r in C2025 if r[5]),1)}; the remaining campaign revenue is always-on cohorts, smaller promos and products the calendar does not list.</p>
{score_table(C2025, "2025")}
</section>

<section id="y2026">
<div class="eyebrow">Part 3</div>
<h2>2026 scorecard (to 10 Nov)</h2>
<p>Scored rows sum to {M(sum(r[5] for r in C2026 if r[5]),1)}. Where the sheet's Actuals column differs from Metabase the note says so; the sheet is usually net of refunds or a different cut-off.</p>
{score_table(C2026, "2026")}
</section>

<section id="rules">
<div class="eyebrow">Part 4</div>
<h2>What the two years tell us to keep, fix and drop</h2>
<ol class="rules">
 <li><strong>Charge for the room.</strong> Hybrid summits out-earn free ones by 30-65% on the same product. Jaideep's plan already makes Manifesting in-person and AI paid-ticket; the data supports both and says do the same for Expert to Authority.</li>
 <li><strong>Sixty days of runway, and never two summits on the list at once.</strong> The best launches (AI Jul 2025, Manifesting May 2025) had 45-60 days; Social Media at 1BFS had six weeks over Christmas.</li>
 <li><strong>Keep the VIP upgrade on every summit.</strong> 22,000 upgrades in 2026 made $0.87M at almost no cost, and VIP buyers are the mastery shortlist.</li>
 <li><strong>Four certification launches plus monthly intakes.</strong> That cadence is worth about $8M; two launches with no intakes is worth $4M.</li>
 <li><strong>Future Human is the identity and the biggest single ticket.</strong> Sell the four-mastery bundle at the event, as in January 2025.</li>
 <li><strong>Two membership summits a year.</strong> Feb and Aug 2025 pulled 75k leads and $1.5M attributed; 2026 ran neither, and new-member revenue fell 58%.</li>
 <li><strong>Accelerators are the cheap filler between summits.</strong> Webinar-led, $0.3-0.6M each, no summit needed. Six in 2027.</li>
 <li><strong>Q4 is one machine.</strong> Free summit in late November, Black Friday, challenge, Lifebook webinar, Q5: the 2025 sequence made $12M+ in eight weeks. Keep the order.</li>
 <li><strong>Drop or merge what did not move the number.</strong> Masters of Manifesting seminar, Windstar cruise, the Jan features promo and the one-day celebrity accelerators without a product in Metabase.</li>
</ol>
</section>

<section id="plan">
<div class="eyebrow">Part 5</div>
<h2>2027 calendar</h2>
<p>Five rows are already in the 2027 sheet and are unchanged: Lifebook Digital Release (Jan 4), Social Media Summit 2027 (Jan 8-10, which is the 1 Billion Followers Summit in Dubai), WildFit webinar (July), Mindvalley U Porto (Jul 12-18) and Future Human Dubai (Nov 5-7). Jaideep's Academy timeline sets the five mastery summits and the two certification launches; the rest is proposed from the 2025 and 2026 results.</p>
<div class="chart">
 <div class="legend"><span style="--sw:var(--c-mastery)">Mastery summits</span><span style="--sw:var(--c-cert)">Certifications</span><span style="--sw:var(--c-accel)">Accelerators</span><span style="--sw:var(--c-event)">Events</span><span style="--sw:var(--c-member)">Membership</span><span style="--sw:var(--c-lifebook)">Lifebook</span><span style="--sw:var(--c-wildfit)">WildFit</span></div>
 {gantt()}
 <div class="cap">Faint bar = promotion window. Solid bar = live dates, with class starts, highlights webinars and Guild dates as small marks. Row 27 (always-on cohorts) runs the full year.</div>
</div>
<h3>First campaign of the year: 1 Billion Followers Summit</h3>
<p>The fifth edition runs <strong>8 to 10 January 2027</strong> across Emirates Towers, DIFC and the Museum of the Future in Dubai, organised by the UAE Government Media Office with 500+ speakers. The 2027 sheet's Social Media Summit row already carries those exact dates. The Metabase read on the 2026 edition: 145k sign-ups (100k paid-media), 444 Social Media Mastery orders, $2.10M gross with $0.48M refunded, promo opened 25 November. The plan keeps the Nov 25 open, adds a paid VIP tier and the Jan 17 highlights webinar, and targets $4.85M.</p>
{plan_table()}
</section>

<section id="targets">
<div class="eyebrow">Part 6</div>
<h2>Does it reach 1.5× the best year?</h2>
<div class="tiles">
 <div class="tile"><div class="k">Required</div><div class="v">{M(target,1)}</div><div class="d">1.5 × 2025's {M(fy25,1)}</div></div>
 <div class="tile hero"><div class="k">Stretch targets, 27 rows</div><div class="v">{Mm(plan_target)}</div><div class="d">Every row set at roughly 1.5× its own best result, with the levers listed.</div></div>
 <div class="tile"><div class="k">Evidence-weighted base</div><div class="v">{Mm(plan_base)}</div><div class="d">Repeat each campaign's best known format and result. +{(plan_base/fy25-1)*100:.0f}% on 2025, about +45% on full-year 2026.</div></div>
</div>
<h3>The {Mm(plan_target-plan_base)} between base and stretch comes from six places</h3>
<div class="bridge">
 <div class="b"><div class="v">+{Mm(br(7,16))}</div>Paid tickets on Manifesting and AI (rows 7, 16) restoring 2025 revenue per lead with 2026 lead volume.</div>
 <div class="b"><div class="v">+{Mm(br(22))}</div>Black Friday back to 1.5× 2025 (row 22). Needs the membership base to stop shrinking; the 2026 result in three weeks is the real benchmark.</div>
 <div class="b"><div class="v">+{Mm(br(19))}</div>Future Human Dubai selling the four-mastery bundle at the event (row 19).</div>
 <div class="b"><div class="v">+{Mm(br(3,6,12,27))}</div>Certifications at 2025 cadence plus better seminar-to-webinar conversion (rows 3, 6, 12, 27).</div>
 <div class="b"><div class="v">+{Mm(br(1,18,20))}</div>Expert to Authority hybrid, AI for Founders with a full promo window, Social Media with eight weeks (rows 1, 18, 20).</div>
 <div class="b"><div class="v">+{Mm(plan_target-plan_base-br(7,16,22,19,3,6,12,27,1,18,20))}</div>Everything else: accelerators, Guilds, membership summits, Lifebook, Q5, BOGO, Spiritual.</div>
</div>
<h3>Open decisions for strategy day</h3>
<ol class="rules">
 <li><strong>Spiritual Summit (row 21).</strong> Biggest free-summit lead pull of 2025 and the warm-up to the record Black Friday, but Jaideep's 2027 Academy plan has no Soul product. Keep as a membership-sold summit, or drop it and accept {Mm(plan_target_ex21)} in the target column.</li>
 <li><strong>Future Human date.</strong> The sheet says Nov 5-7; Jaideep's deck says Dubai every December. Nov 5-7 is kept here. A December date would collide with Black Friday and Q5.</li>
 <li><strong>Speaking & Influence.</strong> Not in Jaideep's 2027 line-up; its June slot goes to the Hypnotherapist launch and the Wealth Code accelerator. $1.5-2.0M of 2025/2026 revenue moves to Expert to Authority.</li>
 <li><strong>Membership.</strong> Even at stretch, launch-tagged membership is {Mm(sum(p['target'] for p in PLAN if p['line']=='membership'))}, close to 2025's $13.6M. The 1.5× year is an Academy and Events year unless new-member acquisition recovers.</li>
</ol>
</section>

<section id="sheet">
<div class="eyebrow">Part 7</div>
<h2>Rows to add to the 2027 sheet</h2>
<p>Same columns as the official calendar. The five rows already in the sheet are not repeated. Targets are the stretch column; Status is Proposal for new rows and Confirmed for Jaideep's timeline rows.</p>
{sheet_rows()}
<p class="src">Sources: Metabase MV BigQuery, tables l3_sales.fact_sales_order, l3_common.dim_product, l3_common.dim_product_cohort, l3_leads.fact_lead, l3_leads.fact_lead_monetization; queried 11 Nov 2026, data through 10 Nov 2026. 1 Billion Followers Summit 2027 dates from the organiser's site and Khaleej Times coverage (Jan 8-10, 2027). Jaideep's 2027 Academy timeline and the Future Human identity model from his strategy deck.</p>
</section>
</div>
"""
open('/tmp/claude-0/-home-user-mindvalley/a0c4dc2e-0632-5fef-9aff-540dc237d994/scratchpad/2027-campaign-calendar.html','w').write(page)
print("ok", len(page), "base", plan_base, "target", plan_target, "ex21", plan_target_ex21, "member", sum(p['target'] for p in PLAN if p['line']=='membership'))
