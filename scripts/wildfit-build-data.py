"""Turn the three Metabase pulls in scripts/wildfit-launch.sql into docs/wildfit-oct-2026-data.json.

Usage: python3 scripts/wildfit-build-data.py <dir containing leads.json, orders.json, emails.json>
"""
import json, re, collections
L = {
 "2023": dict(label="WildFit Jul 2023", page="/wildfit/transformation90", d1="2023-07-31", web="2023-08-02", d1w=-2),
 "2024": dict(label="WildFit Jul 2024", page="/wildfit/transformation90", d1="2024-07-27", web="2024-07-30", d1w=-3),
 "2025": dict(label="WildFit Mar 2025", page="/wildfit/health90", d1="2025-03-05", web="2025-03-11", d1w=-6),
 "2026": dict(label="WildFit Oct 2026", page="/wildfit/invite", d1="2026-09-30", web="2026-10-06", d1w=-6),
}
import sys, os
SRC = sys.argv[1] if len(sys.argv) > 1 else "."
def load(n):
    n = os.path.join(SRC, n)
    d=json.load(open(n)); return d["started_at"], [dict(zip(d["cols"],r)) for r in d["rows"]]
lt, leads = load("leads.json"); ot, orders = load("orders.json"); et, emails = load("emails.json")
CH_FIX = {"Unattributed":"Other / untagged"}
def fam(src):
    s = re.sub(r'^email_campaign_','',src or '')
    s = re.split(r'_(email|vlnl)(_|$)', s)[0]
    s = re.sub(r'[-_]?\d+$','',s)
    return s.replace('newslettertest-daily','newslettertest').replace('newsletter_digest_new','newsletter_digest') or 'other'
out = {"pulled": {"leads": lt[:19]+"Z", "orders": ot[:19]+"Z", "emails": et[:19]+"Z"}, "launches": []}
for yr, m in L.items():
    lr = [r for r in leads if r["yr"]==yr]
    by_ch = collections.Counter(); by_day = collections.defaultdict(collections.Counter); by_lang = collections.Counter()
    for r in lr:
        ch = CH_FIX.get(r["chg"], r["chg"]); by_ch[ch]+=r["n"]; by_day[r["dw"]][ch]+=r["n"]; by_lang[r["lang"]]+=r["n"]
    tot = sum(by_ch.values()); mem = sum(r["n"] for r in lr if r["mem"]); first = sum(r["n"] for r in lr if r["first_ever"])
    last_ts = max(r["last_ts"] for r in lr)
    orr = [r for r in orders if r["yr"]==yr]
    launch = [r for r in orr if r["dw"]>=m["d1w"] and r["otype"] not in ("Renewal","Downgrade")]
    pre = [r for r in orr if r["dw"]<m["d1w"] and r["otype"] not in ("Renewal","Downgrade")]
    renew = [r for r in orr if r["dw"]>=m["d1w"] and r["otype"] in ("Renewal","Downgrade")]
    def agg(rows, key):
        t = collections.defaultdict(lambda: {"orders":0,"rev":0.0,"refunds":0.0})
        for r in rows:
            k = key(r); t[k]["orders"]+=1; t[k]["rev"]+=r["amt"]; t[k]["refunds"]+=r["refund"]
        return {k:{a:round(b,2) for a,b in v.items()} for k,v in t.items()}
    def ochan(r):
        ch, src = r["ch"], (r["src"] or "")
        if ch=="Email" or src.startswith("email"): return "Email"
        if ch in ("App","Web","Internal Referral"): return "Platform"
        if ch=="Organic Social": return "Organic social"
        if ch in ("Paid Social","Paid Search","Display","Paid Video","Paid Other"): return "Paid ads"
        if ch=="Affiliate": return "Affiliate"
        if ch in ("Direct","Organic Search","Organic Referral","LLM Referral"): return "Direct & search"
        return "Other / untagged"
    em = [r for r in emails if r["yr"]==yr]
    efam = collections.defaultdict(lambda: {"leads":0,"members":0,"sends":0})
    for r in em:
        f=fam(r["src"]); efam[f]["leads"]+=r["n"]; efam[f]["members"]+=r["members"]; efam[f]["sends"]+=1
    erev = agg([r for r in launch if ochan(r)=="Email"], lambda r: fam(r["src"]) if (r["src"] or "").startswith("email") else "email (no list tag)")
    out["launches"].append(dict(yr=yr, **m,
        leads=dict(total=tot, members=mem, first_ever=first, last_signup=last_ts, by_channel=dict(by_ch), by_lang=dict(by_lang),
                   by_day={str(k):dict(v) for k,v in sorted(by_day.items())}),
        revenue=dict(total=agg(launch, lambda r:"all").get("all",{"orders":0,"rev":0,"refunds":0}),
                     by_channel=agg(launch, ochan), by_product=agg(launch, lambda r:r["prod"]),
                     by_day={str(k):v for k,v in sorted(agg(launch, lambda r:r["dw"]).items())},
                     by_reg=agg(launch, lambda r:"registrant" if r["is_reg"] else "not registered"),
                     by_product_name=agg(launch, lambda r:f'{r["pname"]} ({r["plang"]})'),
                     masterclass_pre_promo=agg(pre, lambda r:"all").get("all",{"orders":0,"rev":0,"refunds":0}),
                     renewals_excluded=agg(renew, lambda r:"all").get("all",{"orders":0,"rev":0,"refunds":0})),
        email_lists=dict(sorted(efam.items(), key=lambda kv:-kv[1]["leads"])),
        email_list_revenue=erev,
        email_sends=[dict(src=r["src"], dw=r["first_dw"], leads=r["n"], members=r["members"]) for r in em]))
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "docs", "wildfit-oct-2026-data.json")
json.dump(out, open(OUT,"w"), indent=1)
for l in out["launches"]:
    print(l["yr"], l["leads"]["total"], l["leads"]["by_channel"], l["revenue"]["total"], l["revenue"]["by_product"], l["revenue"]["by_reg"], "pre", l["revenue"]["masterclass_pre_promo"], "renew", l["revenue"]["renewals_excluded"])
    print("  ch", {k:round(v["rev"]) for k,v in l["revenue"]["by_channel"].items()})
    print("  lists", list(l["email_lists"].items())[:8])
