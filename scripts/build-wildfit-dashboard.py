"""Embed docs/wildfit-oct-2026-data.json into the dashboard template.

Usage: python3 scripts/build-wildfit-dashboard.py [out.html]
"""
import json, sys, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
data = json.loads((root / "docs/wildfit-oct-2026-data.json").read_text())
tpl = (root / "dashboards/wildfit-oct-2026.template.html").read_text()
blob = json.dumps(data, separators=(",", ":")).replace("</", "<\\/")
out = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else root / "dashboards/wildfit-oct-2026.html"
out.write_text(tpl.replace("__DATA__", blob))
print(f"wrote {out} ({out.stat().st_size:,} bytes)")
