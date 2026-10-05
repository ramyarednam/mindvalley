# Dashboards

## WildFit Oct 2026 launch (`wildfit-oct-2026.html`)

Live dashboard for the WildFit live webinar launch (`launch_wf_oct_2026`, webinar Tue 6 Oct 2026),
compared day by day with the WildFit live webinars of Mar 2025, Jul 2024 and Jul 2023.
Live webinar pages only, all languages.

Published at https://claude.ai/artifact/XPu7WpWUgczfZziTqLfjt9 with the Metabase connector
(`execute_sql`, `query`). The page runs its queries when it opens, using the viewer's own
Metabase connection; **Refresh data** re-runs them. Nothing needs rebuilding for new data.

- Sign-ups, orders, email lists and UTM sources: `scripts/wildfit-live/{leads,orders,utm,email_names}.sql` (MV BigQuery, database 35).
  Launch dates and pages live in `scripts/wildfit-live/launches.sql`.
- Sessions: GA4 `l2_user_behavior.ga4_web_session_event` (MV DE Layer), built in the template's `sessionsQuery`.

To change the page: edit `wildfit-oct-2026.template.html` or the SQL files, run
`python3 scripts/build-wildfit-dashboard.py`, then republish the built HTML to the same artifact.
