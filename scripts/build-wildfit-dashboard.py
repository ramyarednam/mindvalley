"""Build the live WildFit dashboard: embed the SQL from scripts/wildfit-live/ into the template.

The page queries Metabase itself at view time (Refresh data re-runs every query),
so there is no data snapshot to rebuild. Edit the .sql files or the template, then run:

    python3 scripts/build-wildfit-dashboard.py [out.html]
"""
import json, sys, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
live = root / "scripts/wildfit-live"
launches = (live / "launches.sql").read_text().rstrip("\n")
tpl = (root / "dashboards/wildfit-oct-2026.template.html").read_text()
for name in ("leads", "utm", "email_names", "sales"):
    sql = (live / f"{name}.sql").read_text().replace("__LAUNCHES__", launches)
    tpl = tpl.replace(f"__{name.upper()}_SQL__", json.dumps(sql).replace("</", "<\\/"))
web = (live / "webinar-2026.json").read_text()
tpl = tpl.replace("__WEBINAR_JSON__", json.dumps(json.loads(web)).replace("</", "<\\/"))
assert "__" + "LEADS_SQL__" not in tpl and "__" + "WEBINAR_JSON__" not in tpl
out = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else root / "dashboards/wildfit-oct-2026.html"
out.write_text(tpl)
print(f"wrote {out} ({out.stat().st_size:,} bytes)")
