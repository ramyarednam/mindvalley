# Dashboards

## WildFit Oct 2026 launch (`wildfit-oct-2026.html`)

Snapshot dashboard for the WildFit live webinar launch (`launch_wf_oct_2026`, webinar Tue 6 Oct 2026),
compared with the WildFit live webinars of Jul 2023, Jul 2024 and Mar 2025. Live webinar pages only, all languages.

To refresh:

1. Run the three queries in `scripts/wildfit-launch.sql` through the Metabase connector (database 35).
2. Save each result as JSON (`leads.json`, `orders.json`, `emails.json`) in one folder.
3. `python3 scripts/wildfit-build-data.py <that folder>` → writes `docs/wildfit-oct-2026-data.json`.
4. `python3 scripts/build-wildfit-dashboard.py` → embeds the data into `dashboards/wildfit-oct-2026.html`.
5. Republish the HTML to the same artifact link.

Edit `wildfit-oct-2026.template.html`, never the built HTML.
