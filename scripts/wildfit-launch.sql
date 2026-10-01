-- WildFit live webinar launches: Oct 2026 vs Jul 2023, Jul 2024, Mar 2025
-- Run each query against Metabase database 35 (MV BigQuery). Days are UTC.
-- Save each result as JSON ({started_at, cols, rows}) to leads.json / orders.json / emails.json,
-- then run: python3 scripts/wildfit-build-data.py <dir with those files>
--           python3 scripts/build-wildfit-dashboard.py
--
-- Launch definitions (promo start -> live webinar). Live webinar pages only, every language.
-- Masterclass pages (/wildfit/masterclass, /wildfit/content) are never counted.
--   2023  /wildfit/transformation90  2023-07-31 -> 2023-08-02
--   2024  /wildfit/transformation90  2024-07-27 -> 2024-07-30
--   2025  /wildfit/health90          2025-03-05 -> 2025-03-11
--   2026  /wildfit/invite            2026-09-30 -> 2026-10-06
-- Launch window = promo start .. webinar + 7 days. Revenue before promo start = masterclass (left out).

-- ============ Query 1: sign-ups (people, first sign-up per launch, staff removed) ============
WITH b AS (
  SELECT '2023' yr, r'^(/[a-z]{2})?/wildfit/transformation90$' rx, DATE '2023-07-31' d1, DATE '2023-08-02' w UNION ALL
  SELECT '2024', r'^(/[a-z]{2})?/wildfit/transformation90$', DATE '2024-07-27', DATE '2024-07-30' UNION ALL
  SELECT '2025', r'^(/[a-z]{2})?/wildfit/health90$', DATE '2025-03-05', DATE '2025-03-11' UNION ALL
  SELECT '2026', r'^(/[a-z]{2})?/wildfit/invite$', DATE '2026-09-30', DATE '2026-10-06'),
l AS (
  SELECT b.yr, b.w, l.user_id, l.signup_timestamp, l.is_member, l.nth_user_signup, l.traffic_channel ch, LOWER(l.utm_source) src,
    REGEXP_EXTRACT(LOWER(l.form_path), r'^/([a-z]{2})/') lang,
    ROW_NUMBER() OVER (PARTITION BY b.yr, l.user_id ORDER BY l.signup_timestamp) rn
  FROM l3_leads.fact_lead l
  JOIN b ON REGEXP_CONTAINS(LOWER(RTRIM(l.form_path,'/')), b.rx) AND DATE(l.signup_timestamp) BETWEEN b.d1 AND DATE_ADD(b.w, INTERVAL 7 DAY)
  LEFT JOIN l3_common.dim_user u ON u.user_id = l.user_id
  WHERE NOT COALESCE(u.is_mv_user, l.is_mv_user, FALSE))
SELECT yr, DATE_DIFF(DATE(signup_timestamp), w, DAY) dw,
  CASE WHEN ch='Email' OR src LIKE 'email%' THEN 'Email'
       WHEN ch IN ('App','Web','Internal Referral') OR src LIKE 'mvapp%' OR src LIKE 'mvhome%' THEN 'Platform'
       WHEN ch='Organic Social' THEN 'Organic social'
       WHEN ch IN ('Paid Social','Paid Search','Display','Paid Video','Paid Other') THEN 'Paid ads'
       WHEN ch='Affiliate' THEN 'Affiliate'
       WHEN ch IN ('Direct','Organic Search','Organic Referral','LLM Referral') THEN 'Direct & search'
       ELSE 'Unattributed' END chg,
  ch, IFNULL(lang,'en') lang, IFNULL(is_member,FALSE) mem, nth_user_signup=1 first_ever, COUNT(*) n,
  FORMAT_TIMESTAMP('%Y-%m-%dT%H:%M:%SZ', MAX(signup_timestamp)) last_ts
FROM l WHERE rn=1 GROUP BY 1,2,3,4,5,6,7 ORDER BY 1,2;

-- ============ Query 2: orders (one row per order_id; WildFit programme or any WildFit funnel) ============
-- The Mar 2025 webinar sold Membership through the wf_product funnel, so funnel orders are included.
-- Renewals/Downgrades are dropped in the build step (not new sales).
WITH b AS (
  SELECT '2023' yr, r'^(/[a-z]{2})?/wildfit/transformation90$' rx, DATE '2023-07-31' d1, DATE '2023-08-02' w UNION ALL
  SELECT '2024', r'^(/[a-z]{2})?/wildfit/transformation90$', DATE '2024-07-27', DATE '2024-07-30' UNION ALL
  SELECT '2025', r'^(/[a-z]{2})?/wildfit/health90$', DATE '2025-03-05', DATE '2025-03-11' UNION ALL
  SELECT '2026', r'^(/[a-z]{2})?/wildfit/invite$', DATE '2026-09-30', DATE '2026-10-06'),
reg AS (
  SELECT b.yr, l.user_id, MIN(l.signup_timestamp) first_reg FROM l3_leads.fact_lead l
  JOIN b ON REGEXP_CONTAINS(LOWER(RTRIM(l.form_path,'/')), b.rx) AND DATE(l.signup_timestamp) BETWEEN b.d1 AND DATE_ADD(b.w, INTERVAL 7 DAY)
  GROUP BY 1,2),
o AS (
  SELECT o.order_id, ANY_VALUE(o.order_timestamp) ts, ANY_VALUE(o.order_amount) amt, ANY_VALUE(o.user_id) user_id,
    ANY_VALUE(o.product_id) pid, ANY_VALUE(p.name) pname, ANY_VALUE(p.language_code) plang, ANY_VALUE(o.product_funnel) funnel,
    ANY_VALUE(CASE WHEN p.sub_business_unit='Wildfit' THEN 'WildFit programme' WHEN p.business_unit='Membership' AND p.revenue_model='Subscription' THEN 'Membership' ELSE 'Other' END) prod,
    ANY_VALUE(IFNULL(o.refund_amount,0)) refund_amt, ANY_VALUE(o.order_type) otype,
    ANY_VALUE(a.unified_traffic_channel) ch, ANY_VALUE(a.unified_traffic_source) tsrc, ANY_VALUE(a.unified_acquisition_type) acq,
    ANY_VALUE(LOWER(a.utm_source)) src, ANY_VALUE(LOWER(a.utm_campaign_name)) camp, COUNT(*) attr_rows
  FROM l3_sales.fact_sales_order o
  LEFT JOIN l3_common.dim_product p USING (product_id)
  LEFT JOIN l3_sales.fact_sales_attribution a ON o.attribution_order_id = a.order_id
  WHERE o.order_timestamp >= TIMESTAMP '2023-07-01'
    AND (p.sub_business_unit = 'Wildfit' OR REGEXP_CONTAINS(LOWER(o.product_funnel), r'^wf[a-z]{0,2}_product$'))
  GROUP BY 1)
SELECT b.yr, o.order_id, FORMAT_TIMESTAMP('%Y-%m-%dT%H:%M:%SZ', o.ts) ts, DATE_DIFF(DATE(o.ts), b.w, DAY) dw, ROUND(o.amt,2) amt, ROUND(o.refund_amt,2) refund,
  o.pid, o.pname, o.plang, o.funnel, o.prod, o.otype, o.ch, o.tsrc, o.acq, o.src, o.camp, o.attr_rows,
  reg.user_id IS NOT NULL is_reg, reg.first_reg < o.ts reg_before_order
FROM b JOIN o ON DATE(o.ts) BETWEEN DATE_SUB(b.d1, INTERVAL 7 DAY) AND DATE_ADD(b.w, INTERVAL 7 DAY)
LEFT JOIN reg ON reg.yr=b.yr AND reg.user_id=o.user_id
ORDER BY 1,3;

-- ============ Query 3: email sign-ups by send (utm_source) ============
WITH b AS (
  SELECT '2023' yr, r'^(/[a-z]{2})?/wildfit/transformation90$' rx, DATE '2023-07-31' d1, DATE '2023-08-02' w UNION ALL
  SELECT '2024', r'^(/[a-z]{2})?/wildfit/transformation90$', DATE '2024-07-27', DATE '2024-07-30' UNION ALL
  SELECT '2025', r'^(/[a-z]{2})?/wildfit/health90$', DATE '2025-03-05', DATE '2025-03-11' UNION ALL
  SELECT '2026', r'^(/[a-z]{2})?/wildfit/invite$', DATE '2026-09-30', DATE '2026-10-06'),
l AS (
  SELECT b.yr, b.w, l.user_id, l.signup_timestamp, l.is_member, l.traffic_channel ch, LOWER(l.utm_source) src,
    ROW_NUMBER() OVER (PARTITION BY b.yr, l.user_id ORDER BY l.signup_timestamp) rn
  FROM l3_leads.fact_lead l
  JOIN b ON REGEXP_CONTAINS(LOWER(RTRIM(l.form_path,'/')), b.rx) AND DATE(l.signup_timestamp) BETWEEN b.d1 AND DATE_ADD(b.w, INTERVAL 7 DAY)
  LEFT JOIN l3_common.dim_user u ON u.user_id = l.user_id
  WHERE NOT COALESCE(u.is_mv_user, l.is_mv_user, FALSE))
SELECT yr, src, DATE_DIFF(DATE(MIN(signup_timestamp)), ANY_VALUE(w), DAY) first_dw, COUNT(*) n, COUNTIF(IFNULL(is_member,FALSE)) members
FROM l WHERE rn=1 AND (ch='Email' OR src LIKE 'email%')
GROUP BY 1,2 ORDER BY 1, n DESC;
