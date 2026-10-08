-- Sales from the live webinar: promo start to webinar + 7 days, one row per order_id.
-- offer: 'full' = WildFit programme sold by the live webinar; 'alumni' = WildFit alumni offer (tagged alumni,
--        or a main_webinar single payment at $199-$299); 'masterclass' = WildFit sold through the masterclass
--        dropdown funnel (place_in_funnel 'Webinar Dropdown'), not the live webinar; 'membership' = Membership sold
--        through the WildFit funnel (what the Mar 2025 webinar sold); 'other' = upsells.
-- dw = days from webinar (0 = webinar day, UTC); h = hours since webinar-day 00:00 UTC (-1 before the webinar day).
-- ch/src = order attribution channel and source (classified on the page). member = active Mindvalley member at purchase. Renewals and downgrades left out.
WITH b AS (
__LAUNCHES__),
reg AS (
  SELECT DISTINCT b.yr, l.user_id FROM l3_leads.fact_lead l
  JOIN b ON REGEXP_CONTAINS(LOWER(RTRIM(l.form_path,'/')), b.rx) AND DATE(l.signup_timestamp) BETWEEN b.d1 AND DATE_ADD(b.w, INTERVAL 7 DAY)),
o AS (
  SELECT o.order_id, ANY_VALUE(o.order_timestamp) ts, ANY_VALUE(o.order_amount) amt, ANY_VALUE(IFNULL(o.refund_amount, 0)) refund,
    ANY_VALUE(o.user_id) user_id, ANY_VALUE(o.order_type) otype, LOGICAL_OR(IFNULL(o.is_active_member, FALSE)) member,
    ANY_VALUE(CASE
      WHEN p.sub_business_unit = 'Wildfit' THEN CASE
        WHEN o.place_in_funnel = 'Webinar Dropdown' OR REGEXP_CONTAINS(LOWER(o.tags), r'(^|,)dropdown_webinar(,|$)') THEN 'masterclass'
        WHEN REGEXP_CONTAINS(LOWER(o.tags), r'(^|,)alumni(,|$)')
          OR (REGEXP_CONTAINS(LOWER(o.tags), r'(^|,)main_webinar(,|$)') AND o.order_amount BETWEEN 199 AND 299) THEN 'alumni'
        ELSE 'full' END
      WHEN p.sub_business_unit = 'MV Membership' AND IFNULL(o.place_in_funnel, '') <> 'Upsell' THEN 'membership'
      ELSE 'other' END) offer,
    ANY_VALUE(a.unified_traffic_channel) ch,
    -- source: the attribution utm_source when it has one, else the buy-link tag on the order
    ANY_VALUE(COALESCE(NULLIF(NULLIF(LOWER(a.utm_source), 'not available'), ''),
      REGEXP_EXTRACT(LOWER(o.tags), r'(?:^|,)(email_campaign_[a-z0-9_]+|live_[a-z_]+|wa_[a-z0-9_]+|mv_(?:yt|ig|fb|tt|li|wa)[a-z0-9_]*|vl_[a-z0-9_]+|aff_[a-z0-9_]+|mvhome_[a-z0-9_]+|inapp_[a-z0-9_]+|home_[a-z0-9_]+|storefront_[a-z0-9_]+|mobile_[a-z0-9_]+|(?:fb|ig|yt|meta)_[a-z0-9_]+)(?:,|$)'))) src
  FROM l3_sales.fact_sales_order o
  LEFT JOIN l3_common.dim_product p USING (product_id)
  LEFT JOIN l3_sales.fact_sales_attribution a ON o.attribution_order_id = a.order_id
  WHERE o.order_timestamp >= TIMESTAMP '2023-07-01'
    AND (p.sub_business_unit = 'Wildfit' OR REGEXP_CONTAINS(LOWER(o.product_funnel), r'^wf[a-z]{0,2}_product$'))
  GROUP BY 1)
SELECT b.yr, DATE_DIFF(DATE(o.ts), b.w, DAY) AS dw,
  IF(o.ts >= TIMESTAMP(b.w), TIMESTAMP_DIFF(o.ts, TIMESTAMP(b.w), HOUR), -1) AS h,
  o.offer, o.member, reg.user_id IS NOT NULL AS registrant,
  o.ch, o.src,
  COUNT(*) AS orders, ROUND(SUM(o.amt), 2) AS revenue, ROUND(SUM(o.refund), 2) AS refunds,
  MAX(o.ts) AS last_order
FROM b JOIN o ON DATE(o.ts) BETWEEN b.d1 AND DATE_ADD(b.w, INTERVAL 7 DAY)
LEFT JOIN reg ON reg.yr = b.yr AND reg.user_id = o.user_id
WHERE o.otype NOT IN ('Renewal', 'Downgrade')
GROUP BY 1, 2, 3, 4, 5, 6, 7, 8
ORDER BY 1, 2, 3
