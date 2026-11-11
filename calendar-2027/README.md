# 2027 campaign calendar proposal

Strategy-day deliverable built on 2026-11-11 from the official 2025, 2026 and 2027 calendar views and Metabase (MV BigQuery).

- `2027-campaign-calendar.html` – the published page (scorecards for 2025 and 2026, why 2026 is lower, 2027 calendar, targets, sheet rows).
- `2027_calendar_proposal.csv` – rows to paste into the official 2027 calendar sheet (confirmed 2027 rows are not repeated).
- `months.py` – launch-tagged revenue by month and by campaign for 2025 and 2026; `data.py` – cohort and lead figures behind the mastery chart.
- `plan2027.py` – the 2027 calendar month by month with basis, target (1.3x) and reasons.
- `build2.py` – regenerates the HTML and CSV from the data files.
