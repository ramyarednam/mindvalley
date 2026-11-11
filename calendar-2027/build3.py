import sys, html, datetime as dt
sys.path.insert(0, '/tmp/claude-0/-home-user-mindvalley/a0c4dc2e-0632-5fef-9aff-540dc237d994/scratchpad')
from data import MASTERY
from months3 import *
from plan3 import PLAN, PROMO_NOTES, RUNNING

E = html.escape
def M(x, d=2):
    if x is None: return "—"
    return f"${x/1e6:.{d}f}M" if abs(x) >= 1e6 else f"${x/1e3:.0f}k"
def fm(x): return "—" if x is None else f"${x:.2f}M"

camp25 = sum(CAMP_2025.values()); camp26_ytd = sum(CAMP_2026.values())
remaining26 = [(m, c) for m in ("Nov","Dec") for c in CAL_2026[m] if len(c) > 4 and c[2]]
rem26 = sum(c[2] for _, c in remaining26)
camp26_full = camp26_ytd + rem26
target27 = camp26_full * 1.3
rows27 = [(m, r) for m in MONTHS for r in PLAN[m]]
plan27 = sum(r["target"] for _, r in rows27)
p25 = sum(r["y2025"] or 0 for _, r in rows27); p26 = sum(r["y2026"] or 0 for _, r in rows27)
tot25 = sum(TOTAL_2025.values()); tot26 = sum(TOTAL_2026.values())

STATUS = {"sheet":("In the 2027 sheet · unchanged","chip-sheet","■"),"jaideep":("Jaideep's Academy timeline","chip-jd","▲"),"proposed":("Proposed","chip-new","●")}

def chart_monthly():
    W, LH, left = 760, 44, 60
    mx = max(CAMP_2025.values()); scale = (W-left-250)/mx
    H = 30 + LH*12
    s = [f'<svg viewBox="0 0 {W} {H}" role="img" aria-label="Campaign revenue by month, 2026 above 2025">']
    s.append('<defs><pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" class="p-bg"/><line x1="0" y1="0" x2="0" y2="6" class="p-ln"/></pattern></defs>')
    for i,m in enumerate(MONTHS):
        y = 20 + i*LH
        s.append(f'<text x="{left-10}" y="{y+19}" text-anchor="end" class="ct">{m}</text>')
        a = CAMP_2026.get(m); b = CAMP_2025[m]
        if a is not None:
            s.append(f'<rect x="{left}" y="{y}" width="{a*scale:.1f}" height="14" rx="3" class="s26"/>')
            s.append(f'<text x="{left+a*scale+6:.1f}" y="{y+11}" class="cv">2026 {E(M(a,1))}{" · to 10 Nov" if m=="Nov" else ""}</text>')
        else:
            s.append(f'<text x="{left+6}" y="{y+11}" class="cv dim">2026 · not yet</text>')
        s.append(f'<rect x="{left}" y="{y+16}" width="{b*scale:.1f}" height="14" rx="3" class="s25"/>')
        s.append(f'<rect x="{left}" y="{y+16}" width="{b*scale:.1f}" height="14" rx="3" fill="url(#hatch)"/>')
        s.append(f'<text x="{left+b*scale+6:.1f}" y="{y+27}" class="cv">2025 {E(M(b,1))}{" · Black Friday" if m=="Nov" else ""}</text>')
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
        s.append(f'<text x="{left+c[2]*scale+6:.1f}" y="{y+11}" class="cv">2026 {E(M(c[2]))} · ${c[2]/c[1]:.0f}/sign-up · {E(c[0])}</text>')
        s.append(f'<rect x="{left}" y="{y+16}" width="{b[2]*scale:.1f}" height="14" rx="3" class="s25"/>')
        s.append(f'<rect x="{left}" y="{y+16}" width="{b[2]*scale:.1f}" height="14" rx="3" fill="url(#hatch)"/>')
        s.append(f'<text x="{left+b[2]*scale+6:.1f}" y="{y+27}" class="cv">2025 {E(M(b[2]))} · ${b[2]/b[1]:.0f}/sign-up · {E(b[0])}</text>')
    s.append('</svg>')
    return "\n".join(s)

LINE_CLASS = {"mastery":"g-mastery","cert":"g-cert","accel":"g-accel","event":"g-event","membership":"g-member","lifebook":"g-member","guild":"g-accel","wildfit":"g-member"}
def line_of(r):
    n = r["name"]; e = r["etype"]
    if "Summit" in n and "Membership" not in n: return "mastery"
    if "Certified" in n: return "cert"
    if "Accelerator" in n or "accelerators" in n or "Guild" in n: return "accel"
    if "Mindvalley U" in n or "Future Human" in n: return "event"
    return "membership"
def doy(s): return (dt.date.fromisoformat(s) - dt.date(2027,1,1)).days
def gantt():
    W, left, LH, top = 1000, 330, 24, 34
    rows = sorted(rows27, key=lambda t:(t[1]["start"]))
    H = top + LH*len(rows) + 8
    dayw = (W-left-16)/365
    s = [f'<svg viewBox="0 0 {W} {H}" role="img" aria-label="2027 calendar: campaign windows and live dates">']
    s.append('<defs><pattern id="hatch2" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" class="p-bg"/><line x1="0" y1="0" x2="0" y2="6" class="p-ln"/></pattern></defs>')
    for mi in range(12):
        x = left + doy(f"2027-{mi+1:02d}-01")*dayw
        s.append(f'<line x1="{x:.1f}" x2="{x:.1f}" y1="{top-6}" y2="{H-4}" class="grid"/>')
        s.append(f'<text x="{x+dayw*15:.1f}" y="{top-12}" text-anchor="middle" class="ca">{MONTHS[mi]}</text>')
    for i,(m,r) in enumerate(rows):
        y = top + i*LH; cls = LINE_CLASS[line_of(r)]
        name = r["name"] if len(r["name"]) <= 48 else r["name"][:46]+"…"
        s.append(f'<text x="{left-10}" y="{y+15}" text-anchor="end" class="ct small">{E(name)}</text>')
        try:
            pd = dt.datetime.strptime(r["promo"], "%B %d, %Y").date()
            ps = max((pd - dt.date(2027,1,1)).days, 0)
        except Exception:
            ps = 0
        pe = doy(r["start"])
        if pe > ps: s.append(f'<rect x="{left+ps*dayw:.1f}" y="{y+6}" width="{(pe-ps)*dayw:.1f}" height="10" rx="5" class="{cls} promo"/>')
        a, b = doy(r["start"]), doy(r["end"])+1
        s.append(f'<rect x="{left+a*dayw:.1f}" y="{y+3}" width="{max((b-a)*dayw,6):.1f}" height="16" rx="4" class="{cls}"/>')
        if cls in ("g-cert","g-event"): s.append(f'<rect x="{left+a*dayw:.1f}" y="{y+3}" width="{max((b-a)*dayw,6):.1f}" height="16" rx="4" fill="url(#hatch2)"/>')
    s.append('</svg>')
    return "\n".join(s)

def month_table(cal, camp, tot, year, partial=False):
    out = [f'<div class="tw"><table class="months"><thead><tr><th>Month</th><th>Campaign (as in the official {year} calendar)</th><th>Dates</th><th class="num">Campaign revenue</th><th>Where the number comes from</th><th class="num">Month: all campaign revenue</th><th class="num">Month: total revenue, all orders</th></tr></thead><tbody>']
    for m in MONTHS:
        if m not in camp and m not in cal: continue
        items = [it for it in cal.get(m, []) if it[2]]
        n = max(len(items),1); first = True
        tgt_sum = sum(it[2] for it in items if len(it) > 4)
        for it in items:
            name, dates, rev, note = it[:4]; is_t = len(it) > 4
            out.append(f'<tr class="{"tgt" if is_t else ""}">')
            if first: out.append(f'<td rowspan="{n}" class="mcell"><strong>{m}</strong></td>')
            out.append(f'<td><strong>{E(name)}</strong>{"<span class=small>target, not yet run</span>" if is_t else ""}</td><td class="dates">{E(dates)}</td><td class="num">{E(M(rev))}{"<span class=small>target</span>" if is_t else ""}</td><td class="muted">{E(note)}</td>')
            if first:
                mc = camp.get(m)
                if tgt_sum:
                    mc_txt = f'{E(M((mc or 0)+tgt_sum))}<span class="small">{E(M(mc or 0))} actual + {E(M(tgt_sum))} targets</span>'
                else:
                    mc_txt = E(M(mc)) + ("<span class=small>to 10 Nov</span>" if (m=="Nov" and partial) else "")
                out.append(f'<td rowspan="{n}" class="num mtot">{mc_txt}</td><td rowspan="{n}" class="num mtot2">{E(M(tot.get(m)))}{"<span class=small>to 11 Nov</span>" if (m=="Nov" and partial and tot.get(m)) else ""}</td>')
            out.append('</tr>'); first = False
    if partial:
        out.append(f'<tr class="total"><td></td><td colspan="4">{year} actual to 10 Nov</td><td class="num">{E(M(sum(camp.values())))}</td><td class="num">{E(M(sum(tot.values())))}</td></tr>')
        out.append(f'<tr class="total"><td></td><td colspan="4">{year} full year if the remaining campaigns hit their sheet targets</td><td class="num">{E(M(camp26_full))}</td><td class="num muted">—</td></tr>')
    else:
        out.append(f'<tr class="total"><td></td><td colspan="4">{year} total</td><td class="num">{E(M(sum(camp.values())))}</td><td class="num">{E(M(sum(tot.values())))}</td></tr>')
    out.append('</tbody></table></div>')
    return "\n".join(out)

def plan_table():
    out = ['<div class="tw"><table class="plan"><thead><tr><th style="width:9%">Month</th><th style="width:23%">Campaign</th><th class="num" style="width:8%">2025</th><th class="num" style="width:8%">2026</th><th class="num" style="width:9%">2027 target</th><th style="width:43%">Why it is on the calendar, and where the numbers come from</th></tr></thead><tbody>']
    t25 = t26 = t27 = 0.0
    for m in MONTHS:
        items = PLAN[m]; running = RUNNING.get(m, [])
        n = len(items) + len(running) + (1 if items else 0)
        first = True
        for txt in running:
            out.append('<tr class="run">')
            if first: out.append(f'<td rowspan="{n}" class="mcell"><strong>{m}</strong></td>'); first = False
            out.append(f'<td colspan="5" class="muted">⟶ {E(txt)}</td></tr>')
        for r in items:
            lab, cls, glyph = STATUS[r["status"]]
            tgt = f'{fm(r["target"])}<span class="small">{"set by you" if r.get("user_set") else ("1.3 × " + r["basis_year"])}</span>'
            out.append('<tr>')
            if first: out.append(f'<td rowspan="{n}" class="mcell"><strong>{m}</strong></td>'); first = False
            out.append(f'<td><strong>{E(r["name"])}</strong><span class="small">{E(r["dates"])}</span><span class="small">Sells: {E(r["sells"])}</span><span class="chip {cls}">{glyph} {lab}</span></td><td class="num">{fm(r["y2025"])}</td><td class="num">{fm(r["y2026"])}</td><td class="num strong">{tgt}</td><td class="muted">{E(r["why"])}<br><span class="small">Numbers: {E(r["basis_note"])}.</span></td></tr>')
        if items:
            s25 = sum(r["y2025"] or 0 for r in items); s26 = sum(r["y2026"] or 0 for r in items); s27 = sum(r["target"] for r in items)
            t25 += s25; t26 += s26; t27 += s27
            out.append(f'<tr class="sub"><td class="muted">{m} total</td><td class="num">{fm(s25) if s25 else "—"}</td><td class="num">{fm(s26) if s26 else "—"}</td><td class="num strong">{fm(s27)}</td><td class="muted small2">Sum of the campaigns above. For reference, all campaign revenue in {m}: {E(M(CAMP_2025[m]))} in 2025, {E(M(CAMP_2026.get(m)))} in 2026{" (to 10 Nov)" if m=="Nov" else ""}.</td></tr>')
    out.append(f'<tr class="total"><td></td><td>Total, {len(rows27)} campaigns</td><td class="num">{fm(t25)}</td><td class="num">{fm(t26)}</td><td class="num strong">{fm(t27)}</td><td class="muted">The 2025 and 2026 columns add up only these campaigns (same campaigns, earlier years). 2027 target to beat: {E(M(target27,1))} (1.3 × 2026 full year {E(M(camp26_full,1))}).</td></tr>')
    out.append('</tbody></table></div>')
    return "\n".join(out)

def sheet_rows():
    cols = ["Name of project","Unique Name","Status","Ticket","Event type","Month","Year","Start date","End Date","Promotions Start Date","Medium","💿 Production Type","Type","Promotions Duration","Responsible","$ Rev target"]
    out = ['<div class="tw"><table class="sheet"><thead><tr>'+"".join(f"<th>{E(c)}</th>" for c in cols)+'</tr></thead><tbody>']
    csv = [",".join(cols)]
    for m, r in rows27:
        if r["status"]=="sheet": continue
        sd = dt.date.fromisoformat(r["start"]); ed = dt.date.fromisoformat(r["end"]); uniq = r["name"].split(" (")[0]
        status = "Proposal" if r["status"]=="proposed" else "Confirmed"
        vals = [f'{uniq} | {r["etype"]} | {m} 2027', uniq, status, r["ticket"], r["etype"], m, "2027", sd.strftime("%-d %B %Y"), ed.strftime("%-d %B %Y") if ed!=sd else "", r["promo"],
                r["medium"], r["prod"], r["ptype"], str(r["pdur"]), r["owner"], f'${int(round(r["target"]*1e6))}']
        out.append("<tr>"+"".join(f"<td>{E(v)}</td>" for v in vals)+"</tr>")
        csv.append(",".join('"'+v.replace('"','""')+'"' for v in vals))
    out.append('</tbody></table></div>')
    open('/tmp/claude-0/-home-user-mindvalley/a0c4dc2e-0632-5fef-9aff-540dc237d994/scratchpad/2027_calendar_proposal.csv','w').write("\n".join(csv))
    return "\n".join(out)

def bar(label, val, cls=""):
    return f'<div class="bar"><span>{E(label)}</span><div class="track"><div class="fill {cls}" style="width:{val/max(plan27*1e6,target27)*100:.0f}%"></div><span class="lab">{E(M(val,1))}</span></div></div>'

page = f"""<title>2027 Campaign Calendar</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,700&family=DM+Mono:wght@400;500&display=swap">
<style>
/* Two tabs on the hash. 2026 is solid purple, 2025 hatched orange; no blue or green anywhere; every bar is labelled. */
:root {{
  --bg:#ffffff; --bg-muted:#f9f9f9; --bg-subtle:#f3f4f6; --surface:#ffffff; --fg:#0f131a; --fg-muted:#595e67; --fg-subtle:#71767f;
  --border:#dfe1e5; --border-muted:#f3f4f6; --brand:#7a12d4; --brand-light:#f8efff; --brand-border:#eed8fe;
  --s26:#7a12d4; --s25:#ed6325; --s25-bg:#fbe3d6; --hatch:#ed6325; --tag-bg:#fff4e9; --tag-fg:#9a4018; --grey:#71767f; --tgt-bg:#fffaf3;
  --font:"Google Sans","DM Sans",Inter,system-ui,sans-serif; --mono:"DM Mono",ui-monospace,Menlo,monospace;
}}
@media (prefers-color-scheme: dark) {{ :root:not([data-theme="light"]) {{
  --bg:#0f131a; --bg-muted:#181d26; --bg-subtle:#292d38; --surface:#181d26; --fg:#ffffff; --fg-muted:#b3b8c1; --fg-subtle:#979ca5;
  --border:#41464f; --border-muted:#292d38; --brand:#b06cf5; --brand-light:#241339; --brand-border:#4f0c8a;
  --s26:#b06cf5; --s25:#ff931f; --s25-bg:#4a2a12; --hatch:#ff931f; --tag-bg:#3a2210; --tag-fg:#ffb46a; --grey:#979ca5; --tgt-bg:#2a2218; color-scheme:dark }} }}
:root[data-theme="dark"] {{
  --bg:#0f131a; --bg-muted:#181d26; --bg-subtle:#292d38; --surface:#181d26; --fg:#ffffff; --fg-muted:#b3b8c1; --fg-subtle:#979ca5;
  --border:#41464f; --border-muted:#292d38; --brand:#b06cf5; --brand-light:#241339; --brand-border:#4f0c8a;
  --s26:#b06cf5; --s25:#ff931f; --s25-bg:#4a2a12; --hatch:#ff931f; --tag-bg:#3a2210; --tag-fg:#ffb46a; --grey:#979ca5; --tgt-bg:#2a2218; color-scheme:dark }}
* {{ box-sizing:border-box }}
body {{ background:var(--bg); color:var(--fg); font-family:var(--font); font-size:16px; line-height:1.5; margin:0 }}
.wrap {{ max-width:1240px; margin:0 auto; padding-left:max(16px, env(safe-area-inset-left, 0px)); padding-right:max(16px, env(safe-area-inset-right, 0px)); padding-block:0 64px }}
body::before {{ content:""; position:fixed; inset:0 0 auto; height:env(safe-area-inset-top,0px); z-index:10; background:var(--bg) }}
nav.top {{ position:sticky; top:env(safe-area-inset-top,0px); z-index:9; background:var(--bg); border-bottom:1px solid var(--border) }}
nav.top .in {{ max-width:1240px; margin:0 auto; display:flex; gap:6px; align-items:center; overflow-x:auto; padding-left:max(16px, env(safe-area-inset-left, 0px)); padding-right:max(16px, env(safe-area-inset-right, 0px)); padding-block:10px }}
nav.top .brand {{ font-weight:700; margin-right:auto; font-size:15px; white-space:nowrap }}
nav.top a {{ white-space:nowrap }}
nav.top a {{ color:var(--fg-muted); text-decoration:none; font-weight:500; font-size:15px; padding:8px 16px; border-radius:128px; border:1px solid transparent }}
nav.top a[aria-current="page"] {{ background:var(--brand); color:#fff }}
nav.top a:not([aria-current]):hover, nav.top a:focus-visible {{ border-color:var(--border); outline:none }}
.tab[hidden] {{ display:none }}
.eyebrow {{ font-size:12px; letter-spacing:.08em; text-transform:uppercase; color:var(--brand); font-weight:700 }}
h1 {{ font-size:clamp(32px,5vw,52px); line-height:1.05; letter-spacing:-.02em; margin:8px 0 12px; text-wrap:balance; font-weight:700 }}
h2 {{ font-size:clamp(22px,3vw,30px); letter-spacing:-.02em; margin:0 0 8px; text-wrap:balance }}
h3 {{ font-size:19px; margin:26px 0 8px }}
.lede {{ font-size:18px; color:var(--fg-muted); max-width:72ch; margin:0 }}
section {{ padding-block:36px; border-top:1px solid var(--border-muted) }} section.first {{ border-top:0 }}
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
.legend span::before {{ content:""; display:inline-block; width:22px; height:12px; border-radius:3px; margin-right:6px; vertical-align:-1px; background:var(--sw) }}
.legend .k25::before {{ background:repeating-linear-gradient(45deg, var(--hatch) 0 2px, var(--s25-bg) 2px 6px); border:1px solid var(--s25) }}
.ct {{ font:500 13px var(--font); fill:var(--fg) }} .ct.small {{ font-size:12px }}
.cv {{ font:500 12px var(--mono); fill:var(--fg); paint-order:stroke; stroke:var(--surface); stroke-width:4px; stroke-linejoin:round }} .cv.dim {{ fill:var(--fg-subtle) }}
.ca {{ font:400 12px var(--font); fill:var(--fg-subtle) }}
.s26 {{ fill:var(--s26) }} .s25 {{ fill:var(--s25-bg); stroke:var(--s25); stroke-width:1 }} .p-bg {{ fill:transparent }} .p-ln {{ stroke:var(--hatch); stroke-width:2 }} .grid {{ stroke:var(--border-muted); stroke-width:1 }}
.g-mastery {{ fill:var(--s26) }} .g-cert {{ fill:var(--s25-bg); stroke:var(--s25) }} .g-accel {{ fill:var(--s26); opacity:.55 }} .g-event {{ fill:var(--bg-subtle); stroke:var(--fg) }} .g-member {{ fill:var(--grey) }}
.promo {{ opacity:.25 }}
.findings {{ display:grid; grid-template-columns:repeat(auto-fit,minmax(300px,1fr)); gap:14px; margin-top:16px }}
.finding {{ border:1px solid var(--border); border-radius:16px; padding:18px 20px; background:var(--surface) }}
.finding .n {{ font-family:var(--mono); font-size:12px; color:var(--brand); font-weight:500 }}
.finding h4 {{ margin:6px 0 6px; font-size:17px }} .finding p {{ margin:0; font-size:15px; color:var(--fg-muted) }}
.finding .big {{ font-size:26px; font-weight:700; letter-spacing:-.02em; font-variant-numeric:tabular-nums; color:var(--fg); margin:2px 0 4px }}
.rules {{ list-style:none; padding:0; margin:12px 0 0; display:grid; gap:10px }}
.rules li {{ border-left:3px solid var(--brand); padding:4px 0 4px 16px; max-width:84ch }} .rules li strong {{ display:block }}
.tw {{ overflow-x:auto; border:1px solid var(--border); border-radius:12px; margin:14px 0 }}
table {{ border-collapse:collapse; width:100%; font-size:13.5px; min-width:1100px }}
th {{ text-align:left; font-size:11.5px; letter-spacing:.06em; text-transform:uppercase; color:var(--fg-subtle); font-weight:500; padding:10px 12px; border-bottom:1px solid var(--border); background:var(--bg-muted); position:sticky; top:0 }}
td {{ padding:9px 12px; border-bottom:1px solid var(--border-muted); vertical-align:top }}
td.num, th.num {{ text-align:right; font-variant-numeric:tabular-nums; white-space:nowrap; font-family:var(--mono); font-size:13px }}
td.strong {{ font-weight:700; color:var(--brand) }} td.muted {{ color:var(--fg-muted); font-size:13px }} td.dates {{ white-space:nowrap }}
td.mcell {{ background:var(--bg-muted); border-right:1px solid var(--border); font-size:15px; min-width:92px; color:var(--fg) }}
td.mtot {{ background:var(--brand-light); font-weight:700; border-left:1px solid var(--border) }} td.mtot2 {{ background:var(--bg-muted) }}
.small {{ font-size:11.5px; color:var(--fg-subtle); font-family:var(--font); white-space:normal; display:block; font-weight:400 }}
tr.tgt td {{ background:var(--tgt-bg) }} tr.run td {{ color:var(--fg-subtle); font-style:italic; background:var(--bg-muted) }}
tr.total td {{ background:var(--bg-muted); font-weight:700; border-top:2px solid var(--border) }}
tr.sub td {{ background:var(--brand-light); font-weight:700; border-bottom:2px solid var(--border) }} tr.sub td.small2 {{ font-weight:400; font-size:12.5px }}
table.plan {{ min-width:1150px; table-layout:fixed }} table.plan td {{ overflow-wrap:anywhere }} table.plan .chip {{ margin-top:6px; white-space:normal }} table.sheet {{ min-width:1500px; font-size:12.5px }} table.quests {{ min-width:800px }}
.chip {{ display:inline-block; font-size:11.5px; font-weight:500; padding:3px 10px; border-radius:128px; white-space:nowrap }}
.chip-sheet {{ background:var(--bg-subtle); color:var(--fg); border:1px solid var(--border) }} .chip-jd {{ background:var(--brand-light); color:var(--brand) }} .chip-new {{ background:var(--tag-bg); color:var(--tag-fg) }}
.note {{ background:var(--bg-muted); border-radius:12px; padding:14px 18px; font-size:14px; color:var(--fg-muted); max-width:96ch }}
.bars {{ display:grid; gap:8px; margin:14px 0; max-width:760px }}
.bar {{ display:grid; grid-template-columns:260px 1fr; gap:12px; align-items:center; font-size:14px }}
.bar .track {{ height:16px; background:var(--bg-subtle); border-radius:4px; display:flex; align-items:center; min-width:0 }}
.bar .fill {{ max-width:70% }}
.bar .fill {{ height:100%; border-radius:4px; background:var(--s26); flex:none }}
.bar .fill.h {{ background:repeating-linear-gradient(45deg, var(--hatch) 0 2px, var(--s25-bg) 2px 6px); border:1px solid var(--s25) }}
.bar .fill.g {{ background:var(--grey) }} .bar .fill.l {{ background:var(--s26); opacity:.5 }}
.bar .lab {{ font-family:var(--mono); font-size:12.5px; margin-left:8px; white-space:nowrap }}
.src {{ font-size:13px; color:var(--fg-subtle); max-width:96ch }}
@media (max-width:640px) {{ .bar {{ grid-template-columns:1fr; gap:4px }} .bar .fill {{ max-width:60% }} nav.top .brand {{ display:none }} }}
</style>

<nav class="top"><div class="in"><span class="brand">2027 Campaign Calendar</span><a href="#summary" id="tab-summary">Summary</a><a href="#calendar" id="tab-calendar">2027 calendar</a></div></nav>

<div class="wrap">
<div class="tab" id="summary">
<section class="first">
<div class="eyebrow">Mindvalley · Strategy day · prepared 11 Nov 2026 · data to 10 Nov 2026</div>
<h1>How the 2027 calendar was built</h1>
<p class="lede">Campaign revenue only. For Academy launches (summits, masteries, certifications, accelerators, guilds) that is every order of the launched product. For Membership it is only orders tagged to a launch (Black Friday, Q5, promos, summits); evergreen membership is out. Events and Lifebook are their own product sales. Programs, class starts and quest soft releases are not campaigns. 2027 targets are 30% above the same campaign's 2026 result.</p>
<div class="tiles">
 <div class="tile"><div class="k">2025 campaign revenue</div><div class="v">{M(camp25,1)}</div><div class="d">Academy $34.6M, Events $3.6M, Membership launch-tagged $13.6M, Lifebook $1.4M, WildFit $0.9M.</div></div>
 <div class="tile"><div class="k">2026 actual, to 10 Nov</div><div class="v">{M(camp26_ytd,1)}</div><div class="d">Same window in 2025: {M(CAMP_2025_YTD,1)} ({(camp26_ytd/CAMP_2025_YTD-1)*100:.0f}%).</div></div>
 <div class="tile"><div class="k">2026 full year</div><div class="v">{M(camp26_full,1)}</div><div class="d">Actual {M(camp26_ytd,1)} + the remaining confirmed campaigns at their sheet targets: Black Friday $4.0M, 3-year offer $0.2M, AI Guild $0.5M, Lifebook $1.0M, Q5 $0.5M.</div></div>
 <div class="tile hero"><div class="k">2027 target · 30% above 2026</div><div class="v">{M(target27,1)}</div><div class="d">1.3 × {M(camp26_full,1)}. The calendar on the next tab adds up to {M(plan27*1e6,1)}.</div></div>
</div>
<div class="bars">
 {bar("2025 campaign revenue", camp25, "h")}
 {bar("2026 actual to 10 Nov", camp26_ytd)}
 {bar("2026 full year (actual + sheet targets)", camp26_full, "l")}
 {bar("2027 target (1.3 × 2026 full year)", target27, "g")}
 {bar("2027 calendar, sum of campaign targets", plan27*1e6)}
</div>
</section>

<section>
<div class="eyebrow">Why 2026 is lower</div>
<h2>Campaign revenue, 2026 above 2025, month by month</h2>
<div class="chart">
 <div class="legend"><span style="--sw:var(--s26)">2026 (solid)</span><span class="k25">2025 (hatched)</span></div>
 {chart_monthly()}
 <div class="cap">November 2025 is Black Friday: $6.4M of membership orders tagged to the sale, $7.7M of campaign revenue in the month. The 2026 Black Friday runs Nov 16-30; presale orders so far are $0.58M.</div>
</div>
<p>Like-for-like (1 Jan to 10 Nov) campaign revenue fell from {M(CAMP_2025_YTD,1)} to {M(camp26_ytd,1)}. Five things explain it.</p>
<div class="findings">
 <div class="finding"><div class="n">01</div><h4>No Future Human in 2026</h4><div class="big">−$4.7M</div><p>The January 2025 festival sold $1.15M of tickets, $2.42M of the Future Human Mastery bundle, $0.99M of Total Mastery and $0.16M of virtual passes. Nothing replaced it in 2026.</p></div>
 <div class="finding"><div class="n">02</div><h4>Manifesting Summit: in person became free</h4><div class="big">$6.69M → $4.03M</div><p>2026 had 136k sign-ups to 2025's 54k and still made $2.7M less: $124 per sign-up in 2025, $30 in 2026. Paid tickets were $1.0M of the 2025 number on their own.</p></div>
 <div class="finding"><div class="n">03</div><h4>AI Summit: July became March, with 50k fewer sign-ups</h4><div class="big">$7.08M → $5.07M</div><p>Both summits were free. 2025 ran in July after Manifesting had closed and pulled 170k sign-ups; 2026 ran in March, six weeks after Social Media, with 120k.</p></div>
 <div class="finding"><div class="n">04</div><h4>Certifications: one launch fewer, no Business Coach, no rolling intakes</h4><div class="big">$7.5M → $4.0M</div><p>2025 launched CLC (Feb, $1.28M), Business Coach (Apr, $0.71M) and Hypnotherapist (Sep, $2.10M) and kept monthly intakes worth $2.3M. 2026 ran CLC (Feb, $1.17M) and Hypnotherapist (Aug, $1.43M) and stopped the intakes.</p></div>
 <div class="finding"><div class="n">05</div><h4>Membership ran fewer campaigns</h4><div class="big">$5.9M → $4.1M</div><p>Jan to 10 Nov membership launch-tagged. 2025 had the Best of Mindvalley summit, two promos, the June renewal promo ($1.13M) and the Membership Summit. 2026 kept only the June promo ($0.70M). Social Media Summit also slipped, $3.23M to $2.10M, on six weeks of runway over Christmas.</p></div>
 <div class="finding"><div class="n">06</div><h4>What 2026 added</h4><div class="big">+$3.5M</div><p>Accelerators are a new line ($1.34M from five webinar-led launches). Expert to Authority ($2.89M) beat Entrepreneurship ($2.52M) and seeded Guilds. WildFit came back ($0.47M). AI for Founders is at $1.97M with the class not yet started.</p></div>
</div>
<h3>Mastery launches side by side</h3>
<div class="chart">
 <div class="legend"><span style="--sw:var(--s26)">2026 (solid)</span><span class="k25">2025 (hatched)</span></div>
 {chart_mastery()}
 <div class="cap">Full launch revenue (mastery + tickets + VIP) and revenue per summit sign-up. Row 5 compares Entrepreneurship 2025 with Expert to Authority 2026; row 6 compares Spiritual 2025 with AI for Founders 2026, still selling.</div>
</div>
</section>

<section>
<div class="eyebrow">2025, month by month</div>
<h2>2025 calendar with campaign revenue</h2>
<p>Every campaign in the official 2025 calendar, minus programs, class starts and quest releases, with the revenue of the product it sold in that month. Rolling certification intakes are shown as one line per month. The last two columns are the month's totals: all campaign revenue, and total revenue from every order.</p>
{month_table(CAL_2025, CAMP_2025, TOTAL_2025, 2025)}
</section>

<section>
<div class="eyebrow">2026, month by month</div>
<h2>2026 calendar, actuals to 10 Nov and the confirmed campaigns to December</h2>
<p>Rows shaded orange have not run yet; their number is the target from the 2026 sheet. Black Friday is live: $0.58M of launch-tagged membership orders since Nov 1 (to Nov 11), against the $4.0M target for Nov 16-30. AI for Founders has taken $1.90M of Mastery orders plus $0.07M of VIP to Nov 10, with the class starting Nov 17. Mastery BOGO is left out, as agreed.</p>
{month_table(CAL_2026, CAMP_2026, TOTAL_2026, 2026, partial=True)}
</section>
</div>

<div class="tab" id="calendar" hidden>
<section class="first">
<div class="eyebrow">2027 proposed calendar</div>
<h1>2027, month by month</h1>
<p class="lede">Jaideep's Academy timeline sets the spine: Social Media Summit at 1BFS in January, Manifesting Summit in person in April, AI Summit with a paid ticket in July, Expert to Authority in September, AI for Founders in October, and Life Coach (Jan-Feb) and Hypnotherapist (Jun-Aug) certification launches, each with its campaign window before it. The five rows already in the 2027 sheet are unchanged. Membership adds one summit, four quest-release webinars, a challenge every quarter, Black Friday and Q5.</p>
<div class="tiles">
 <div class="tile"><div class="k">2026 full year</div><div class="v">{M(camp26_full,1)}</div><div class="d">Actual to 10 Nov + remaining sheet targets.</div></div>
 <div class="tile"><div class="k">2027 target · 30% above 2026</div><div class="v">{M(target27,1)}</div><div class="d">1.3 × {M(camp26_full,1)}.</div></div>
 <div class="tile hero"><div class="k">This calendar adds up to</div><div class="v">{M(plan27*1e6,1)}</div><div class="d">{len(rows27)} campaigns. The same campaigns made {fm(p26)} in 2026 (to date, incl. Black Friday at its $4.0M target) and {fm(p25)} in 2025.</div></div>
</div>
</section>
<section>
<div class="eyebrow">The progression</div>
<h2>Future Human is the identity. The year walks people through the four masteries that build it.</h2>
<ol class="rules">
 <li><strong>Q1 · Build visibility, then clarity.</strong> Social Media Summit at 1BFS (Jan 8-10) and the Life Coach launch open the year. The Q1 challenge (Feb 15-21, clarity) runs the week the Manifesting campaign opens.</li>
 <li><strong>Q2 · Build clarity, then systems.</strong> Manifesting Summit in person (Apr 16-18), Membership Summit (May 22-23). The Q2 challenge (Jun 1-7, systems) runs as the AI campaign opens.</li>
 <li><strong>Q3 · Build systems, then authority.</strong> MVU Porto and the AI Summit with a paid ticket (Jul 23-25), Hypnotherapist cohort (Aug 2). The Q3 challenge (Aug 15-21, authority) runs inside the Expert to Authority campaign; the summit follows Sep 17-19.</li>
 <li><strong>Q4 · Become it.</strong> AI for Founders (Oct 29-31), Future Human Dubai (Nov 5-7) where the four-mastery bundle is sold, then the Q4 challenge (Nov 16 - Dec 16) carrying the list into Black Friday, Lifebook and Q5.</li>
</ol>
<div class="note">What a $1M challenge needs. The best challenge on record, 7 Sacred States in Dec 2025, pulled 25.5k sign-ups and $0.43M of attributed orders, about $17 per sign-up. At that rate $1M is roughly 60k sign-ups; the alternative is a paid product sold at the end of the challenge (the next summit's VIP ticket or an accelerator), which is why each challenge is placed at the start of a summit campaign.</div>
</section>
<section>
<h2>The calendar</h2>
<p>Status: ■ already in the sheet · ▲ Jaideep's Academy timeline · ● proposed. For each campaign: what it made in 2025, what it made in 2026, the 2027 target (1.3 × 2026; 1.3 × 2025 where it did not run in 2026; $1M where you set it). A dash means the campaign did not run that year. Italic lines show which campaign windows are open that month. Each month ends with a total row.</p>
{plan_table()}
<h3>1 Billion Followers Summit, campaign one</h3>
<p>The fifth edition runs <strong>8 to 10 January 2027</strong> across Emirates Towers, DIFC and the Museum of the Future in Dubai, organised by the UAE Government Media Office with 500+ speakers. The 2027 sheet's Social Media Summit row already carries those dates. 2026 at 1BFS: 145k sign-ups, 444 Social Media Mastery orders, $2.10M, promo opened 25 November. Target $2.73M.</p>
<h3>Four things to settle on the day</h3>
<ol class="rules">
 <li><strong>Black Friday.</strong> 2027 is 1.3 × the 2026 sheet target. Re-set to 1.3 × the actual once the sale closes on Nov 30. 2025 did $8.1M.</li>
 <li><strong>Membership Summit date.</strong> May 22-23 is the free fortnight in Q2 (after the Manifesting class start, before the AI Summit campaign opens May 24).</li>
 <li><strong>Hypnotherapist 2026.</strong> Metabase shows $1.88M of MCH orders in Aug-Sep ($1.43M on the cohort table); the sheet says $2.5M. The 2027 target uses $1.88M; on $2.5M it would be $3.25M.</li>
 <li><strong>Future Human date.</strong> The sheet says Nov 5-7; Jaideep's deck says December. Nov 5-7 is kept so it does not sit on Black Friday.</li>
</ol>
</section>
<section>
<div class="eyebrow">Membership campaigns in 2027</div>
<h2>What Membership runs next year</h2>
<p>Black Friday and Q5 are the only promos. The rest is built on the quests that already bring the most people in: one live, launch-tagged release webinar per quarter on a top quest, a Membership Summit in May, three challenges and WildFit in July. The 2026 quest releases (Healing from Heartbreak, Maestro's Guide, Silva webinar, Negotiate with Confidence, Bold Conversations) were untagged, so none can be measured; the 2027 ones must carry a launch tag.</p>
<div class="tw"><table class="quests"><thead><tr><th>Quest funnel</th><th class="num">2025 revenue</th><th class="num">2026 revenue (to 10 Nov)</th><th class="num">2026 sign-ups</th><th>2027 move</th></tr></thead><tbody>
<tr><td><strong>Silva Ultramind (sums)</strong></td><td class="num">$9.22M</td><td class="num">$5.39M</td><td class="num">87k</td><td>Live release webinar Mar 9. Biggest funnel in the company; the Feb 2026 webinar was untagged.</td></tr>
<tr><td><strong>Duality (du)</strong></td><td class="num">$5.42M</td><td class="num">$3.47M</td><td class="num">203k</td><td>Live release webinar Aug 24. Most sign-ups of any quest.</td></tr>
<tr><td><strong>Art of Manifesting (tam)</strong></td><td class="num">$4.47M</td><td class="num">$2.60M</td><td class="num">158k</td><td>Live session Nov 9, the week before Black Friday. Sign-ups doubled in 2026 (77k to 158k).</td></tr>
<tr><td><strong>Superbrain (sb)</strong></td><td class="num">$5.96M</td><td class="num">$2.53M</td><td class="num">31k</td><td>Relaunch with Jim Kwik Jun 8. Biggest drop of any quest; pair with the book promo.</td></tr>
<tr><td><strong>Be Extraordinary / eb + be</strong></td><td class="num">$5.73M</td><td class="num">$3.88M</td><td class="num">93k</td><td>Keep evergreen; the Jul 2026 email masterclass attributed only $13k, so no campaign slot.</td></tr>
<tr><td><strong>WildFit (wf)</strong></td><td class="num">$0.90M</td><td class="num">$0.66M</td><td class="num">12k</td><td>July webinar + cohort (already in the sheet).</td></tr>
<tr><td><strong>Lifebook (lbo)</strong></td><td class="num">$1.20M</td><td class="num">$0.30M</td><td class="num">n/a</td><td>Year-end webinar only, Dec 27.</td></tr>
</tbody></table></div>
<div class="note">Revenue here is all membership orders attributed to the quest funnel (evergreen included), to show which quests matter. The four webinars are targeted at $0.30M each on the WildFit benchmark because no other quest webinar was tagged.</div>
</section>
<section>
<div class="eyebrow">Rows for the sheet</div>
<h2>Rows to add to the 2027 calendar sheet</h2>
<p>Same columns as the official calendar. The five rows already in the sheet are not repeated. Status is Proposal for proposed rows and Confirmed for Jaideep's timeline rows; $ Rev target is the 2027 target above.</p>
{sheet_rows()}
<p class="src">Sources: Metabase MV BigQuery, l3_sales.fact_sales_order (MV staff excluded), l3_common.dim_product, l3_common.dim_product_cohort, l3_leads.fact_lead; queried 11 Nov 2026, data through 10 Nov 2026 (membership to 11 Nov). 1 Billion Followers Summit 2027 dates from 1billionsummit.com and Khaleej Times (8-10 Jan 2027). Jaideep's 2027 Academy timeline and Future Human identity model from his strategy deck.</p>
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
print("camp25", camp25, "ytd26", camp26_ytd, "ytd25", CAMP_2025_YTD, "full26", camp26_full, "target27", target27, "plan27", plan27, "p25", p25, "p26", p26)
