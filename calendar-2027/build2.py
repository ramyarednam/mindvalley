import sys, html, datetime as dt
sys.path.insert(0, '/tmp/claude-0/-home-user-mindvalley/a0c4dc2e-0632-5fef-9aff-540dc237d994/scratchpad')
from data import MASTERY
from months import *
from plan2027 import PLAN, PROMO_NOTES

E = html.escape
MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
def M(x, d=2):
    if x is None: return "n/a"
    return f"${x/1e6:.{d}f}M" if abs(x) >= 1e6 else f"${x/1e3:.0f}k"
def Mm(x): return f"${x:.2f}M"

TOTAL_2025 = {"Jan":8761893,"Feb":5430599,"Mar":7643857,"Apr":7199233,"May":10000353,"Jun":11019082,"Jul":11394458,"Aug":11065210,"Sep":8601905,"Oct":6515199,"Nov":12561422,"Dec":7894820}
TOTAL_2026 = {"Jan":7314287,"Feb":4407111,"Mar":6469737,"Apr":5238172,"May":6984490,"Jun":5043756,"Jul":5438031,"Aug":6326501,"Sep":6011811,"Oct":4289335,"Nov":3129558}

pl25 = sum(PL_2025.values()); pl26 = sum(PL_2026.values())
tot25 = sum(TOTAL_2025.values()); tot26 = sum(TOTAL_2026.values())
# 2026 projection: YTD + rest of Nov + Dec. Low = Q4 at 65% of 2025 (membership base down ~40%); high = Q4 repeats 2025.
rest25 = PL_2025["Nov"] - PL_2025_NOV1_10 + PL_2025["Dec"]
proj_lo = pl26 + rest25*0.65; proj_hi = pl26 + rest25
bar_lo, bar_hi, bar_35 = proj_lo*1.3, proj_hi*1.3, 35e6*1.3

rows27 = [(m, r) for m in MONTHS for r in PLAN[m]]
fc_total = sum(r["target"] for _, r in rows27)
fc_tagged = fc_total - sum(r["target"] for _, r in rows27 if r["name"].startswith("Mindvalley U"))
month27 = {m: sum(r["target"] for r in PLAN[m]) for m in MONTHS}

STATUS = {"sheet":("In the 2027 sheet · unchanged","chip-sheet","■"),"jaideep":("Jaideep's Academy timeline","chip-jd","▲"),"proposed":("Proposed","chip-new","●")}

# ---------- Chart: monthly launch-tagged, 2026 on top, 2025 below ----------
def chart_monthly():
    W, LH, left = 760, 44, 60
    mx = max(PL_2025.values()); scale = (W-left-250)/mx
    H = 30 + LH*12
    s = [f'<svg viewBox="0 0 {W} {H}" role="img" aria-label="Launch-tagged revenue by month, 2026 above 2025">']
    s.append('<defs><pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" class="p-bg"/><line x1="0" y1="0" x2="0" y2="6" class="p-ln"/></pattern></defs>')
    for i,m in enumerate(MONTHS):
        y = 20 + i*LH
        s.append(f'<text x="{left-10}" y="{y+19}" text-anchor="end" class="ct">{m}</text>')
        a = PL_2026.get(m); b = PL_2025[m]
        if a is not None:
            s.append(f'<rect x="{left}" y="{y}" width="{a*scale:.1f}" height="14" rx="3" class="s26"/>')
            lab = M(a,1) + (" · to 10 Nov" if m=="Nov" else "")
            s.append(f'<text x="{left+a*scale+6:.1f}" y="{y+11}" class="cv">2026 {E(lab)}</text>')
        else:
            s.append(f'<text x="{left+6}" y="{y+11}" class="cv dim">2026 · not yet</text>')
        s.append(f'<rect x="{left}" y="{y+16}" width="{b*scale:.1f}" height="14" rx="3" class="s25"/>')
        s.append(f'<rect x="{left}" y="{y+16}" width="{b*scale:.1f}" height="14" rx="3" fill="url(#hatch)"/>')
        lab = M(b,1) + (" · Black Friday" if m=="Nov" else "")
        s.append(f'<text x="{left+b*scale+6:.1f}" y="{y+27}" class="cv">2025 {E(lab)}</text>')
    s.append('</svg>')
    return "\n".join(s)

def chart_mastery():
    W, LH, left = 760, 52, 250
    mx = max(max(b[2],c[2]) for _,b,c in MASTERY); scale = (W-left-210)/mx
    H = 30 + LH*len(MASTERY)
    s = [f'<svg viewBox="0 0 {W} {H}" role="img" aria-label="Mastery launch revenue, 2026 above 2025">']
    for i,(n,b,c) in enumerate(MASTERY):
        y = 20 + i*LH
        s.append(f'<text x="{left-12}" y="{y+20}" text-anchor="end" class="ct">{E(n)}</text>')
        s.append(f'<rect x="{left}" y="{y}" width="{c[2]*scale:.1f}" height="14" rx="3" class="s26"/>')
        s.append(f'<text x="{left+c[2]*scale+6:.1f}" y="{y+11}" class="cv">2026 {E(M(c[2]))} · ${c[2]/c[1]:.0f}/sign-up</text>')
        s.append(f'<rect x="{left}" y="{y+16}" width="{b[2]*scale:.1f}" height="14" rx="3" class="s25"/>')
        s.append(f'<rect x="{left}" y="{y+16}" width="{b[2]*scale:.1f}" height="14" rx="3" fill="url(#hatch)"/>')
        s.append(f'<text x="{left+b[2]*scale+6:.1f}" y="{y+27}" class="cv">2025 {E(M(b[2]))} · ${b[2]/b[1]:.0f}/sign-up</text>')
    s.append('</svg>')
    return "\n".join(s)

# ---------- Month tables ----------
def month_table(cal, pl, tot, year, partial_note=None):
    out = [f'<div class="tw"><table class="months"><thead><tr><th>Month</th><th>Campaigns in the official {year} calendar</th><th>Dates</th><th class="num">Launch-tagged revenue</th><th>Where the number comes from</th><th class="num">Month: all launch-tagged</th><th class="num">Month: total revenue</th></tr></thead><tbody>']
    for m in MONTHS:
        if m not in pl: continue
        items = cal.get(m, [])
        n = max(len(items),1)
        first = True
        for (name, dates, rev, note) in (items or [("", "", None, "")]):
            cls = "" if rev else "dim"
            out.append(f'<tr class="{cls}">')
            if first:
                out.append(f'<td rowspan="{n}" class="mcell"><strong>{m}</strong></td>')
            out.append(f'<td><strong>{E(name)}</strong></td><td class="dates">{E(dates)}</td><td class="num">{E(M(rev)) if rev else "—"}</td><td class="muted">{E(note)}</td>')
            if first:
                out.append(f'<td rowspan="{n}" class="num mtot">{E(M(pl[m]))}{"<br><span class=small>to 10 Nov</span>" if (m=="Nov" and partial_note) else ""}</td><td rowspan="{n}" class="num mtot2">{E(M(tot[m]))}</td>')
            out.append('</tr>'); first = False
    out.append(f'<tr class="total"><td></td><td colspan="4">{year} total{" (to 10 Nov)" if partial_note else ""}</td><td class="num">{E(M(sum(pl.values())))}</td><td class="num">{E(M(sum(tot.values())))}</td></tr>')
    out.append('</tbody></table></div>')
    return "\n".join(out)

def plan_table():
    out = ['<div class="tw"><table class="plan"><thead><tr><th style="width:9%">Month</th><th style="width:20%">Campaign</th><th style="width:19%">What it made before (launch-tagged)</th><th class="num" style="width:8%">2027 target</th><th style="width:28%">Why it is on the calendar</th><th class="num" style="width:6%">Month target</th><th class="num" style="width:5%">2026</th><th class="num" style="width:5%">2025</th></tr></thead><tbody>']
    for m in MONTHS:
        items = PLAN[m]; n = max(len(items),1); first = True
        mcell = f'<td rowspan="{n}" class="mcell"><strong>{m}</strong>{("<div class=small>"+E(PROMO_NOTES[m])+"</div>") if m in PROMO_NOTES else ""}</td>'
        if not items:
            out.append(f'<tr class="dim">{mcell.replace(f"rowspan=\"{n}\" ","")}<td colspan="4" class="muted">{E(PROMO_NOTES.get(m,"Nothing live."))}</td><td class="num mtot">—</td><td class="num">{E(M(PL_2026.get(m)))}</td><td class="num">{E(M(PL_2025[m]))}</td></tr>')
            continue
        for r in items:
            lab, cls, glyph = STATUS[r["status"]]
            tgt = f'{Mm(r["target"])}' + ('<span class="small">set by you</span>' if r.get("user_set") else f'<span class="small">1.3 × {r["basis_year"]}</span>')
            out.append('<tr>')
            if first: out.append(mcell)
            out.append(f'<td><strong>{E(r["name"])}</strong><span class="small">{E(r["dates"])}</span><span class="small">Sells: {E(r["sells"])}</span><span class="chip {cls}">{glyph} {lab}</span></td><td class="muted">{E(r["basis_note"])}</td><td class="num strong">{tgt}</td><td class="muted">{E(r["why"])}</td>')
            if first:
                out.append(f'<td rowspan="{n}" class="num mtot">{Mm(month27[m])}</td><td rowspan="{n}" class="num">{E(M(PL_2026.get(m)))}{"<span class=small>to 10 Nov</span>" if m=="Nov" else ""}</td><td rowspan="{n}" class="num">{E(M(PL_2025[m]))}</td>')
            out.append('</tr>'); first = False
    out.append(f'<tr class="total"><td></td><td colspan="2">2027 forecast if every campaign hits target ({len(rows27)} campaigns)</td><td class="num strong">{Mm(fc_total)}</td><td class="muted">{Mm(fc_tagged)} on launch tags alone; MVU Porto ($2.94M) is ticket revenue with no launch tag.</td><td class="num">{Mm(fc_total)}</td><td class="num">{E(M(pl26))}<span class="small">to 10 Nov</span></td><td class="num">{E(M(pl25))}</td></tr>')
    out.append('</tbody></table></div>')
    return "\n".join(out)

def sheet_rows():
    cols = ["Name of project","Unique Name","Status","Ticket","Event type","Month","Year","Start date","End Date","Promotions Start Date","Medium","💿 Production Type","Type","Promotions Duration","Responsible","$ Rev target"]
    out = ['<div class="tw"><table class="sheet"><thead><tr>'+"".join(f"<th>{E(c)}</th>" for c in cols)+'</tr></thead><tbody>']
    csv = [",".join(cols)]
    for m, r in rows27:
        if r["status"]=="sheet": continue
        sd = dt.date.fromisoformat(r["start"]); ed = dt.date.fromisoformat(r["end"])
        uniq = r["name"].split(" (")[0]
        status = "Proposal" if r["status"]=="proposed" else "Confirmed"
        vals = [f'{uniq} | {r["etype"]} | {m} 2027', uniq, status, r["ticket"], r["etype"], m, "2027",
                sd.strftime("%-d %B %Y"), ed.strftime("%-d %B %Y") if ed!=sd else "", r["promo"],
                r["medium"], r["prod"], r["ptype"], str(r["pdur"]), r["owner"], f'${int(round(r["target"]*1e6))}']
        out.append("<tr>"+"".join(f"<td>{E(v)}</td>" for v in vals)+"</tr>")
        csv.append(",".join('"'+v.replace('"','""')+'"' for v in vals))
    out.append('</tbody></table></div>')
    open('/tmp/claude-0/-home-user-mindvalley/a0c4dc2e-0632-5fef-9aff-540dc237d994/scratchpad/2027_calendar_proposal.csv','w').write("\n".join(csv))
    return "\n".join(out)

page = f"""<title>2027 Campaign Calendar</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,700&family=DM+Mono:wght@400;500&display=swap">
<style>
/* Two tabs (Summary, 2027 calendar) on the hash. Colour carries no meaning on its own: 2026 is solid purple, 2025 is hatched orange, and every bar is labelled. No blue, no green. */
:root {{
  --bg:#ffffff; --bg-muted:#f9f9f9; --bg-subtle:#f3f4f6; --surface:#ffffff; --fg:#0f131a; --fg-muted:#595e67; --fg-subtle:#71767f;
  --border:#dfe1e5; --border-muted:#f3f4f6; --brand:#7a12d4; --brand-light:#f8efff; --brand-border:#eed8fe;
  --s26:#7a12d4; --s25:#ed6325; --s25-bg:#fbe3d6; --hatch:#ed6325; --tag-bg:#fff4e9; --tag-fg:#9a4018;
  --font:"Google Sans","DM Sans",Inter,system-ui,sans-serif; --mono:"DM Mono",ui-monospace,Menlo,monospace;
}}
@media (prefers-color-scheme: dark) {{ :root:not([data-theme="light"]) {{
  --bg:#0f131a; --bg-muted:#181d26; --bg-subtle:#292d38; --surface:#181d26; --fg:#ffffff; --fg-muted:#b3b8c1; --fg-subtle:#979ca5;
  --border:#41464f; --border-muted:#292d38; --brand:#b06cf5; --brand-light:#241339; --brand-border:#4f0c8a;
  --s26:#b06cf5; --s25:#ff931f; --s25-bg:#4a2a12; --hatch:#ff931f; --tag-bg:#3a2210; --tag-fg:#ffb46a; color-scheme:dark }} }}
:root[data-theme="dark"] {{
  --bg:#0f131a; --bg-muted:#181d26; --bg-subtle:#292d38; --surface:#181d26; --fg:#ffffff; --fg-muted:#b3b8c1; --fg-subtle:#979ca5;
  --border:#41464f; --border-muted:#292d38; --brand:#b06cf5; --brand-light:#241339; --brand-border:#4f0c8a;
  --s26:#b06cf5; --s25:#ff931f; --s25-bg:#4a2a12; --hatch:#ff931f; --tag-bg:#3a2210; --tag-fg:#ffb46a; color-scheme:dark }}
* {{ box-sizing:border-box }}
body {{ background:var(--bg); color:var(--fg); font-family:var(--font); font-size:16px; line-height:1.5; margin:0 }}
.wrap {{ max-width:1240px; margin:0 auto; padding-left:max(16px, env(safe-area-inset-left, 0px)); padding-right:max(16px, env(safe-area-inset-right, 0px)); padding-block:0 64px }}
body::before {{ content:""; position:fixed; inset:0 0 auto; height:env(safe-area-inset-top,0px); z-index:10; background:var(--bg) }}
nav.top {{ position:sticky; top:env(safe-area-inset-top,0px); z-index:9; background:var(--bg); border-bottom:1px solid var(--border) }}
nav.top .in {{ max-width:1240px; margin:0 auto; display:flex; gap:6px; align-items:center; padding-left:max(16px, env(safe-area-inset-left, 0px)); padding-right:max(16px, env(safe-area-inset-right, 0px)); padding-block:10px }}
nav.top .brand {{ font-weight:700; letter-spacing:-.01em; margin-right:auto; font-size:15px }}
nav.top a {{ color:var(--fg-muted); text-decoration:none; font-weight:500; font-size:15px; padding:8px 16px; border-radius:128px; border:1px solid transparent }}
nav.top a[aria-current="page"] {{ background:var(--brand); color:#fff }}
nav.top a:not([aria-current]):hover, nav.top a:focus-visible {{ border-color:var(--border); outline:none }}
.tab[hidden] {{ display:none }}
.eyebrow {{ font-size:12px; letter-spacing:.08em; text-transform:uppercase; color:var(--brand); font-weight:700 }}
h1 {{ font-size:clamp(32px,5vw,52px); line-height:1.05; letter-spacing:-.02em; margin:8px 0 12px; text-wrap:balance; font-weight:700 }}
h2 {{ font-size:clamp(22px,3vw,30px); letter-spacing:-.02em; margin:0 0 8px; text-wrap:balance }}
h3 {{ font-size:19px; margin:26px 0 8px }}
.lede {{ font-size:18px; color:var(--fg-muted); max-width:72ch; margin:0 }}
section {{ padding-block:36px; border-top:1px solid var(--border-muted) }}
section.first {{ border-top:0 }}
p {{ max-width:76ch }}
.tiles {{ display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:12px; margin:24px 0 8px }}
.tile {{ background:var(--bg-muted); border:1px solid var(--border-muted); border-radius:16px; padding:18px 20px }}
.tile .k {{ font-size:12px; letter-spacing:.08em; text-transform:uppercase; color:var(--fg-subtle); font-weight:500 }}
.tile .v {{ font-size:32px; font-weight:700; letter-spacing:-.02em; font-variant-numeric:tabular-nums; margin:4px 0 2px }}
.tile .d {{ font-size:14px; color:var(--fg-muted) }}
.tile.hero {{ background:var(--brand-light); border-color:var(--brand-border) }} .tile.hero .v {{ color:var(--brand) }}
.chart {{ background:var(--surface); border:1px solid var(--border); border-radius:16px; padding:18px 16px 8px; margin:16px 0; overflow-x:auto }}
.chart svg {{ width:100%; height:auto; display:block; min-width:600px }}
.chart .cap {{ font-size:14px; color:var(--fg-muted); margin:8px 4px 6px; max-width:none }}
.legend {{ display:flex; flex-wrap:wrap; gap:16px; font-size:13px; color:var(--fg-muted); margin:4px 4px 8px }}
.legend .k26::before, .legend .k25::before {{ content:""; display:inline-block; width:22px; height:12px; border-radius:3px; margin-right:6px; vertical-align:-1px }}
.legend .k26::before {{ background:var(--s26) }}
.legend .k25::before {{ background:repeating-linear-gradient(45deg, var(--hatch) 0 2px, var(--s25-bg) 2px 6px); border:1px solid var(--s25) }}
.ct {{ font:500 13px var(--font); fill:var(--fg) }}
.cv {{ font:500 12px var(--mono); fill:var(--fg); paint-order:stroke; stroke:var(--surface); stroke-width:4px; stroke-linejoin:round }} .cv.dim {{ fill:var(--fg-subtle) }}
.s26 {{ fill:var(--s26) }} .s25 {{ fill:var(--s25-bg); stroke:var(--s25); stroke-width:1 }} .p-bg {{ fill:transparent }} .p-ln {{ stroke:var(--hatch); stroke-width:2 }}
.findings {{ display:grid; grid-template-columns:repeat(auto-fit,minmax(300px,1fr)); gap:14px; margin-top:16px }}
.finding {{ border:1px solid var(--border); border-radius:16px; padding:18px 20px; background:var(--surface) }}
.finding .n {{ font-family:var(--mono); font-size:12px; color:var(--brand); font-weight:500 }}
.finding h4 {{ margin:6px 0 6px; font-size:17px; letter-spacing:-.01em }}
.finding p {{ margin:0; font-size:15px; color:var(--fg-muted) }}
.finding .big {{ font-size:26px; font-weight:700; letter-spacing:-.02em; font-variant-numeric:tabular-nums; color:var(--fg); margin:2px 0 4px }}
.rules {{ list-style:none; padding:0; margin:12px 0 0; display:grid; gap:10px }}
.rules li {{ border-left:3px solid var(--brand); padding:4px 0 4px 16px; max-width:84ch }}
.rules li strong {{ display:block }}
.tw {{ overflow-x:auto; border:1px solid var(--border); border-radius:12px; margin:14px 0 }}
table {{ border-collapse:collapse; width:100%; font-size:13.5px; min-width:1100px }}
th {{ text-align:left; font-size:11.5px; letter-spacing:.06em; text-transform:uppercase; color:var(--fg-subtle); font-weight:500; padding:10px 12px; border-bottom:1px solid var(--border); background:var(--bg-muted); position:sticky; top:0 }}
td {{ padding:9px 12px; border-bottom:1px solid var(--border-muted); vertical-align:top }}
td.num, th.num {{ text-align:right; font-variant-numeric:tabular-nums; white-space:nowrap; font-family:var(--mono); font-size:13px }}
td.strong {{ font-weight:700; color:var(--brand) }}
td.muted {{ color:var(--fg-muted); font-size:13px }}
td.mcell {{ background:var(--bg-muted); border-right:1px solid var(--border); font-size:15px; min-width:92px; color:var(--fg) }}
td.dates {{ white-space:nowrap }}
tr.dim td.mcell, tr.dim td.mtot, tr.dim td.mtot2 {{ color:var(--fg) }} tr.dim td.mcell strong {{ color:var(--fg); font-weight:700 }}
td.mcell .small {{ font-weight:400 }}
td.mtot {{ background:var(--brand-light); font-weight:700; border-left:1px solid var(--border) }}
td.mtot2 {{ background:var(--bg-muted) }}
.small {{ font-size:11.5px; color:var(--fg-subtle); font-family:var(--font); white-space:normal; display:block }}
tr.dim td {{ color:var(--fg-subtle) }} tr.dim td strong {{ color:var(--fg-muted); font-weight:500 }}
tr.total td {{ background:var(--bg-muted); font-weight:700; border-top:2px solid var(--border) }}
table.plan {{ min-width:1150px; table-layout:fixed }} table.plan td {{ overflow-wrap:anywhere }} table.plan .chip {{ margin-top:6px; white-space:normal }} table.quests {{ min-width:800px }} table.sheet {{ min-width:1500px; font-size:12.5px }}
.chip {{ display:inline-block; font-size:11.5px; font-weight:500; padding:3px 10px; border-radius:128px; white-space:nowrap }}
.chip-sheet {{ background:var(--bg-subtle); color:var(--fg); border:1px solid var(--border) }} .chip-jd {{ background:var(--brand-light); color:var(--brand) }} .chip-new {{ background:var(--tag-bg); color:var(--tag-fg) }}
.note {{ background:var(--bg-muted); border-radius:12px; padding:14px 18px; font-size:14px; color:var(--fg-muted); max-width:96ch }}
.bars {{ display:grid; gap:8px; margin:14px 0; max-width:760px }}
.bar {{ display:grid; grid-template-columns:230px 1fr; gap:12px; align-items:center; font-size:14px }}
.bar .track {{ height:16px; background:var(--bg-subtle); border-radius:4px; display:flex; align-items:center }}
.bar .fill {{ height:100%; border-radius:4px; background:var(--s26); flex:none }}
.bar .fill.h {{ background:repeating-linear-gradient(45deg, var(--hatch) 0 2px, var(--s25-bg) 2px 6px); border:1px solid var(--s25) }}
.bar .fill.g {{ background:var(--fg-subtle) }}
.bar .lab {{ font-family:var(--mono); font-size:12.5px; margin-left:8px; white-space:nowrap }}
.src {{ font-size:13px; color:var(--fg-subtle); max-width:96ch }}
@media (max-width:640px) {{ .bar {{ grid-template-columns:1fr; gap:4px }} }}
</style>

<nav class="top"><div class="in"><span class="brand">2027 Campaign Calendar</span><a href="#summary" id="tab-summary">Summary</a><a href="#calendar" id="tab-calendar">2027 calendar</a></div></nav>

<div class="wrap">
<div class="tab" id="summary">
<section class="first">
<div class="eyebrow">Mindvalley · Strategy day · prepared 11 Nov 2026 · data to 10 Nov 2026</div>
<h1>How the 2027 calendar was built</h1>
<p class="lede">Only launch campaigns count. Every number on this page is revenue from orders that carry a Product Launch tag at checkout, pulled from Metabase. Evergreen membership, programs, class starts and quest releases are left out. 2027 targets are 30% above what the same campaign did in 2026.</p>
<div class="tiles">
 <div class="tile"><div class="k">2025 campaign revenue</div><div class="v">{M(pl25,1)}</div><div class="d">Launch-tagged orders, all business units. Academy $21.2M, Membership $14.6M (of which Black Friday + Cyber Monday $8.1M), Events $0.4M.</div></div>
 <div class="tile"><div class="k">2026 to 10 Nov</div><div class="v">{M(pl26,1)}</div><div class="d">Same window in 2025: {M(PL_2025_YTD,1)} ({(pl26/PL_2025_YTD-1)*100:.0f}%). Academy $14.8M, Membership $4.1M.</div></div>
 <div class="tile"><div class="k">2026 projected</div><div class="v">{M(proj_lo,0)[:-1]}–{M(proj_hi,0)}</div><div class="d">Adds Black Friday, Cyber Monday, Q5, Lifebook and the rest of AI for Founders. Low end: Q4 at 65% of 2025 (membership base is down 40%). High end: Q4 repeats 2025. Your working number is $35M.</div></div>
 <div class="tile hero"><div class="k">2027 forecast from the proposed calendar</div><div class="v">{Mm(fc_total)}</div><div class="d">{len(rows27)} campaigns, each at 1.3× its own 2026 result (2025 where it did not run in 2026; $1M where you set it). Bar to clear: {M(bar_lo,1)}–{M(bar_hi,1)} on the data, {M(bar_35,1)} on $35M.</div></div>
</div>
</section>

<section>
<div class="eyebrow">How it works</div>
<h2>Three rules</h2>
<ol class="rules">
 <li><strong>Only launch campaigns count.</strong> Revenue on this page is from orders that carry a Product Launch tag at checkout: summits, cert launches, Black Friday, Q5, quest webinars. Evergreen membership, programs, class starts and States are not campaign revenue.</li>
 <li><strong>Month by month, as in the official calendar.</strong> Each month lists the calendar's campaigns, what each made, the month's campaign total and the month's total revenue from every order.</li>
 <li><strong>2027 target = 30% above what the same campaign made in 2026.</strong> If it did not run in 2026, 30% above 2025. Challenges and the Porto accelerators are $1M each on your instruction.</li>
</ol>
<div class="note">One thing to know about the tags: about 45% of Academy launch orders (deposits, payment plans) carry no launch tag, so a $1.17M cert cohort shows as $0.27M here. The tables say so where it matters. Tagging every checkout would lift reported campaign revenue by roughly $6M a year without changing a sale.</div>
</section>

<section>
<div class="eyebrow">Why 2026 is lower</div>
<h2>Launch-tagged revenue, 2026 above 2025, month by month</h2>
<div class="chart">
 <div class="legend"><span class="k26">2026 (solid)</span><span class="k25">2025 (hatched)</span></div>
 {chart_monthly()}
 <div class="cap">November 2025 is Black Friday: $7.2M of launch-tagged orders in one month, $6.5M of it membership. Nothing in 2026 comes close yet; the 2026 Black Friday runs Nov 16-30.</div>
</div>
<p>Like-for-like (1 Jan to 10 Nov) campaign revenue fell from {M(PL_2025_YTD,1)} to {M(pl26,1)}. In campaign terms, five things explain it.</p>
<div class="findings">
 <div class="finding"><div class="n">01</div><h4>AI Summit: hybrid in July became free in March</h4><div class="big">$6.25M → $3.23M</div><p>Launch-tagged AI Mastery orders, Jul-Aug 2025 vs Mar-Apr 2026. 170k sign-ups in 2025 vs 120k; paid tickets and a July slot after the Manifesting cohort. The biggest single swing of the year.</p></div>
 <div class="finding"><div class="n">02</div><h4>No Future Human in 2026</h4><div class="big">−$2.44M</div><p>January 2025's festival sold $1.57M of the Future Human Mastery bundle, $0.71M of Total Mastery and $0.16M of virtual passes, all tagged to the event. 2026 had no January festival and no bundle.</p></div>
 <div class="finding"><div class="n">03</div><h4>Manifesting Summit: in person became free</h4><div class="big">$3.45M → $2.15M</div><p>Apr-Jun tagged orders. 2026 had 136k sign-ups to 2025's 54k and still made $1.3M less: $124 per sign-up in 2025, $30 in 2026.</p></div>
 <div class="finding"><div class="n">04</div><h4>Membership ran fewer campaigns</h4><div class="big">$5.9M → $4.1M</div><p>Jan-10 Nov membership launch-tagged. 2025 had the Best of Mindvalley summit (Feb), two promos (Jan, Apr-May), the June renewal promo ($1.07M) and the Membership Summit (Aug, $0.42M). 2026 kept only the June promo ($0.62M). The 2027 plan keeps one Membership Summit and drops every promo except Black Friday and Q5, as you asked.</p></div>
 <div class="finding"><div class="n">05</div><h4>Certifications: one launch fewer, no Business Coach</h4><div class="big">$1.45M → $1.06M</div><p>Tagged cert orders Jan-10 Nov. 2025: CLC Feb, Business Coach Apr, Hypnotherapist Sep plus deposits through the year. 2026: CLC Feb and Hypnotherapist Aug. Business Coach is dropped for 2027 on your call.</p></div>
 <div class="finding"><div class="n">06</div><h4>What 2026 added</h4><div class="big">+$1.9M</div><p>Accelerators ($0.40M AI, $0.09M AI Clones, $0.32M Wealth Code, $0.22M Priestley, $0.08M Manifesting Blocks), Expert to Authority ($2.42M vs Entrepreneurship $2.24M), WildFit back ($0.23M) and AI for Founders already at $1.22M with the class not yet started.</p></div>
</div>
<h3>Mastery launches side by side (cohort revenue, tagged and untagged)</h3>
<div class="chart">
 <div class="legend"><span class="k26">2026 (solid)</span><span class="k25">2025 (hatched)</span></div>
 {chart_mastery()}
 <div class="cap">Full cohort revenue, which includes untagged orders, so these bars sit above the launch-tagged figures in the tables. Row 5 compares Entrepreneurship 2025 with Expert to Authority 2026; row 6 compares Spiritual 2025 with AI for Founders 2026, still selling.</div>
</div>
</section>

<section>
<div class="eyebrow">2025, month by month</div>
<h2>2025 calendar with launch-tagged revenue</h2>
<p>Every campaign the official 2025 calendar lists, minus programs and class starts. Rows in grey could not be matched to tagged orders. The last two columns are the month's totals: all launch-tagged orders, and all revenue from every order.</p>
{month_table(CAL_2025, PL_2025, TOTAL_2025, 2025)}
</section>

<section>
<div class="eyebrow">2026, month by month</div>
<h2>2026 calendar with launch-tagged revenue (to 10 Nov)</h2>
{month_table(CAL_2026, PL_2026, TOTAL_2026, 2026, partial_note=True)}
</section>


</div>

<div class="tab" id="calendar" hidden>
<section class="first">
<div class="eyebrow">2027 proposed calendar</div>
<h1>2027, month by month</h1>
<p class="lede">Five rows are already in the 2027 sheet and are unchanged: Lifebook Digital Release (Jan 4, a class start, not counted), Social Media Summit 2027 at the 1 Billion Followers Summit (Jan 8-10), WildFit webinar (July), Mindvalley U Porto (Jul 12-18) and Future Human Dubai (Nov 5-7). Jaideep's Academy timeline sets the four mastery summits and the two certification launches. Everything else is proposed, including four quest-release webinars for Membership. Each row shows what the same campaign did in 2026 (or 2025), the 2027 target at 1.3× that, and why it is there.</p>
<div class="tiles">
 <div class="tile hero"><div class="k">2027 forecast</div><div class="v">{Mm(fc_total)}</div><div class="d">Sum of the {len(rows27)} targets below. {Mm(fc_tagged)} on launch tags alone.</div></div>
 <div class="tile"><div class="k">Bar: 30% above 2026</div><div class="v">{M(bar_lo,1)}–{M(bar_hi,1)}</div><div class="d">On the data projection of 2026 ({M(proj_lo,1)}–{M(proj_hi,1)}). On your $35M view the bar is {M(bar_35,1)}, which this calendar misses by {M(bar_35-fc_total,1)}.</div></div>
 <div class="tile"><div class="k">Where the gap would close</div><div class="v">3 rows</div><div class="d">AI Summit back to its 2025 level (+$2.0M), Black Friday re-set once 2026 closes, Future Human tickets on top of the bundle (+$1.2M).</div></div>
</div>
<div class="bars">
 <div class="bar"><span>2025 campaign revenue</span><div class="track"><div class="fill h" style="width:{pl25/(fc_total*1e6)*100:.0f}%"></div><span class="lab">{M(pl25,1)}</span></div></div>
 <div class="bar"><span>2026 to 10 Nov</span><div class="track"><div class="fill" style="width:{pl26/(fc_total*1e6)*100:.0f}%"></div><span class="lab">{M(pl26,1)}</span></div></div>
 <div class="bar"><span>2026 projected (high)</span><div class="track"><div class="fill" style="width:{proj_hi/(fc_total*1e6)*100:.0f}%; opacity:.5"></div><span class="lab">{M(proj_hi,1)}</span></div></div>
 <div class="bar"><span>Bar: 1.3 × 2026 projected</span><div class="track"><div class="fill g" style="width:{bar_hi/(fc_total*1e6)*100:.0f}%"></div><span class="lab">{M(bar_hi,1)}</span></div></div>
 <div class="bar"><span>2027 forecast (this calendar)</span><div class="track"><div class="fill" style="width:100%"></div><span class="lab">{Mm(fc_total)}</span></div></div>
</div>
</section>
<section>
<h2>The calendar</h2>
<p>Status: ■ already in the sheet · ▲ Jaideep's Academy timeline · ● proposed. Month target is the sum of that month's campaign targets; the last two columns show what the same month made in 2026 and 2025 on launch tags.</p>
{plan_table()}
<h3>1 Billion Followers Summit, campaign one</h3>
<p>The fifth edition runs <strong>8 to 10 January 2027</strong> across Emirates Towers, DIFC and the Museum of the Future in Dubai, organised by the UAE Government Media Office with 500+ speakers. The 2027 sheet's Social Media Summit row already carries those dates. The 2026 edition in Metabase: 145k sign-ups (100k from paid media), 444 Social Media Mastery orders, $1.41M launch-tagged in Jan-Feb ($2.10M by cohort), promo opened 25 November. Target $1.83M on tags.</p>
<h3>Three things to settle on the day</h3>
<ol class="rules">
 <li><strong>Black Friday target.</strong> Placeholder uses 2025 ($8.15M). Re-set to 1.3× the 2026 result in December.</li>
 <li><strong>Membership Summit date.</strong> May 22-23 is the free fortnight in Q2; confirm against the AI Summit promo start (May 24).</li>
 <li><strong>Future Human date.</strong> Sheet says Nov 5-7; Jaideep's deck says December. Nov 5-7 is kept so it does not sit on Black Friday.</li>
</ol>
</section>
<section>
<div class="eyebrow">Membership campaigns in 2027</div>
<h2>What Membership runs next year</h2>
<p>Black Friday and Q5 are the only promos. The rest of the membership calendar is built on the quests that already bring the most people in: one live, launch-tagged release webinar per quarter on a top quest, a Membership Summit in May, three challenges and WildFit in July. The 2026 quest releases (Healing from Heartbreak, Maestro's Guide, Silva webinar, Negotiate with Confidence, Bold Conversations) were untagged emails, so none of them can be measured; the 2027 ones must carry a launch tag.</p>
<div class="tw"><table class="quests"><thead><tr><th>Quest funnel</th><th class="num">2025 revenue</th><th class="num">2026 revenue (to 10 Nov)</th><th class="num">2026 sign-ups</th><th>2027 move</th></tr></thead><tbody>
<tr><td><strong>Silva Ultramind (sums)</strong></td><td class="num">$9.22M</td><td class="num">$5.39M</td><td class="num">87k</td><td>Live release webinar Mar 9. Biggest funnel in the company; the Feb 2026 webinar was untagged.</td></tr>
<tr><td><strong>Duality (du)</strong></td><td class="num">$5.42M</td><td class="num">$3.47M</td><td class="num">203k</td><td>Live release webinar Aug 24. Most sign-ups of any quest.</td></tr>
<tr><td><strong>Art of Manifesting (tam)</strong></td><td class="num">$4.47M</td><td class="num">$2.60M</td><td class="num">158k</td><td>Live session Nov 9, the week before Black Friday. Sign-ups doubled in 2026 (77k to 158k).</td></tr>
<tr><td><strong>Superbrain (sb)</strong></td><td class="num">$5.96M</td><td class="num">$2.53M</td><td class="num">31k</td><td>Relaunch with Jim Kwik Jun 8. Biggest drop of any quest; pair with the book promo.</td></tr>
<tr><td><strong>Be Extraordinary / eb + be</strong></td><td class="num">$5.73M</td><td class="num">$3.88M</td><td class="num">93k</td><td>Keep evergreen; the Jul 2026 email masterclass attributed only $13k, so no campaign slot.</td></tr>
<tr><td><strong>WildFit (wf)</strong></td><td class="num">$0.90M</td><td class="num">$0.66M</td><td class="num">12k</td><td>July webinar + cohort (already in the sheet). The one quest webinar with a tagged result: $0.23M.</td></tr>
<tr><td><strong>Lifebook (lbo)</strong></td><td class="num">$1.20M</td><td class="num">$0.30M</td><td class="num">n/a</td><td>Year-end webinar only, Dec 27.</td></tr>
</tbody></table></div>
<div class="note">Revenue here is all membership orders attributed to the quest funnel (evergreen included), to show which quests matter; the 2027 targets for the four webinars ($0.30M each) use the WildFit benchmark because no other quest webinar was tagged. Sign-ups are 2026 lead rows on the funnel's pages.</div>
</section>
<section>
<div class="eyebrow">Rows for the sheet</div>
<h2>Rows to add to the 2027 calendar sheet</h2>
<p>Same columns as the official calendar. The five rows already in the sheet are not repeated. Status is Proposal for proposed rows and Confirmed for Jaideep's timeline rows; $ Rev target is the 2027 target above.</p>
{sheet_rows()}
<p class="src">Sources: Metabase MV BigQuery, l3_sales.fact_sales_order (campaign_type = Product Launch, MV staff excluded), l3_common.dim_product, l3_common.dim_product_cohort, l3_leads.fact_lead; queried 11 Nov 2026, data through 10 Nov 2026. 1 Billion Followers Summit 2027 dates from 1billionsummit.com and Khaleej Times (8-10 Jan 2027). Jaideep's 2027 Academy timeline and Future Human identity model from his strategy deck.</p>
</section>
</div>
</div>
<script>
(function(){{
  var tabs = ['summary','calendar'];
  function show(){{
    var h = (location.hash||'#summary').slice(1); if (tabs.indexOf(h)<0) h='summary';
    tabs.forEach(function(t){{ document.getElementById(t).hidden = (t!==h); var a=document.getElementById('tab-'+t); if(t===h) a.setAttribute('aria-current','page'); else a.removeAttribute('aria-current'); }});
    window.scrollTo(0,0);
  }}
  window.addEventListener('hashchange', show); show();
}})();
</script>
"""
open('/tmp/claude-0/-home-user-mindvalley/a0c4dc2e-0632-5fef-9aff-540dc237d994/scratchpad/2027-campaign-calendar.html','w').write(page)
print("ok", len(page), "pl25", pl25, "pl26", pl26, "ytd25", PL_2025_YTD, "proj", proj_lo, proj_hi, "fc", fc_total, fc_tagged, "bars", bar_lo, bar_hi, bar_35)
print({m: round(month27[m],2) for m in MONTHS})
