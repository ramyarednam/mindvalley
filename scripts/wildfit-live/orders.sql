-- Orders: WildFit programme (every language) or anything sold through a WildFit funnel. One row per order_id.
-- phase 'pre' = the 7 days before promo start (counted as masterclass). Renewals and downgrades left out.
WITH b AS (
__LAUNCHES__),
reg AS (
  SELECT DISTINCT b.yr, l.user_id FROM l3_leads.fact_lead l
  JOIN b ON REGEXP_CONTAINS(LOWER(RTRIM(l.form_path,'/')), b.rx) AND DATE(l.signup_timestamp) BETWEEN b.d1 AND DATE_ADD(b.w, INTERVAL 7 DAY)),
o AS (
  SELECT o.order_id, ANY_VALUE(o.order_timestamp) ts, ANY_VALUE(o.order_amount) amt, ANY_VALUE(IFNULL(o.refund_amount, 0)) refund,
    ANY_VALUE(o.user_id) user_id, ANY_VALUE(o.order_type) otype,
    ANY_VALUE(CASE WHEN p.sub_business_unit = 'Wildfit' THEN 'WildFit programme'
                   WHEN p.business_unit = 'Membership' AND p.revenue_model = 'Subscription' THEN 'Membership' ELSE 'Other' END) prod,
    ANY_VALUE(a.unified_traffic_channel) ch, ANY_VALUE(LOWER(a.utm_source)) src
  FROM l3_sales.fact_sales_order o
  LEFT JOIN l3_common.dim_product p USING (product_id)
  LEFT JOIN l3_sales.fact_sales_attribution a ON o.attribution_order_id = a.order_id
  WHERE o.order_timestamp >= TIMESTAMP '2023-07-01'
    AND (p.sub_business_unit = 'Wildfit' OR REGEXP_CONTAINS(LOWER(o.product_funnel), r'^wf[a-z]{0,2}_product$'))
  GROUP BY 1)
SELECT b.yr, IF(DATE(o.ts) < b.d1, 'pre', 'launch') AS phase, DATE_DIFF(DATE(o.ts), b.d1, DAY) + 1 AS cday,
  CASE WHEN o.ch = 'Email' OR o.src LIKE 'email%' THEN 'Email'
       WHEN o.ch IN ('App','Web','Internal Referral') THEN 'Platform'
       WHEN o.ch = 'Organic Social' THEN 'Organic social'
       WHEN o.ch IN ('Paid Social','Paid Search','Display','Paid Video','Paid Other') THEN 'Paid ads'
       WHEN o.ch = 'Affiliate' THEN 'Affiliate'
       WHEN o.ch IN ('Direct','Organic Search','Organic Referral','LLM Referral') THEN 'Direct & search'
       ELSE 'Other' END AS channel,
  o.prod AS product, reg.user_id IS NOT NULL AS registrant,
  COUNT(*) AS orders, ROUND(SUM(o.amt), 2) AS revenue, ROUND(SUM(o.refund), 2) AS refunds
FROM b JOIN o ON DATE(o.ts) BETWEEN DATE_SUB(b.d1, INTERVAL 7 DAY) AND DATE_ADD(b.w, INTERVAL 7 DAY)
LEFT JOIN reg ON reg.yr = b.yr AND reg.user_id = o.user_id
WHERE o.otype NOT IN ('Renewal', 'Downgrade')
GROUP BY 1, 2, 3, 4, 5, 6
ORDER BY 1, 3
