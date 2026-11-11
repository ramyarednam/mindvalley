# 2027 campaign calendar proposal

Strategy-day deliverable built on 2026-11-11 from the official 2025, 2026 and 2027 calendar views and Metabase (MV BigQuery).

- `2027-campaign-calendar.html` – the published page (scorecards for 2025 and 2026, why 2026 is lower, 2027 calendar, targets, sheet rows).
- `2027_calendar_proposal.csv` – rows to paste into the official 2027 calendar sheet (confirmed 2027 rows are not repeated).
- `data.py` – every number used, pulled from `l3_sales.fact_sales_order`, `l3_common.dim_product_cohort`, `l3_leads.fact_lead`, `l3_leads.fact_lead_monetization`.
- `plan.py` – the 27 proposed 2027 rows with benchmarks, base case and 1.5x targets.
- `build.py` – regenerates the HTML and CSV from the two data files.
