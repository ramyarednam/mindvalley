-- Email titles and send dates for the WildFit email tracking codes that brought sign-ups to each launch.
-- Tracking codes like email_campaign_daily_email_1 are reused by other launches, so only WildFit sends count.
WITH b AS (
__LAUNCHES__),
ls AS (
  SELECT DISTINCT b.yr, LOWER(l.utm_source) src
  FROM l3_leads.fact_lead l
  JOIN b ON REGEXP_CONTAINS(LOWER(RTRIM(l.form_path,'/')), b.rx) AND DATE(l.signup_timestamp) BETWEEN b.d1 AND DATE_ADD(b.w, INTERVAL 7 DAY)
  WHERE LOWER(l.utm_source) LIKE 'email%'),
c AS (
  SELECT b.yr, b.d1, LOWER(s) src, c.campaign_name, c.campaign_send_date, c.campaign_list, c.language
  FROM l3_leads.dim_email_campaign c, UNNEST(c.utm_sources_array) s
  JOIN b ON c.campaign_send_date BETWEEN DATE_SUB(b.d1, INTERVAL 7 DAY) AND DATE_ADD(b.w, INTERVAL 7 DAY)
  WHERE REGEXP_CONTAINS(LOWER(CONCAT(IFNULL(c.utm_campaigns, ''), ' ', c.campaign_name)), r'wildfit|launch_wf|\bwf(es|de)?\b'))
SELECT ls.yr, ls.src,
  ARRAY_AGG(c.campaign_name ORDER BY IF(c.campaign_send_date >= DATE_SUB(c.d1, INTERVAL 2 DAY), 0, 1), c.campaign_send_date LIMIT 1)[OFFSET(0)] AS campaign_name,
  FORMAT_DATE('%Y-%m-%d', ARRAY_AGG(c.campaign_send_date ORDER BY IF(c.campaign_send_date >= DATE_SUB(c.d1, INTERVAL 2 DAY), 0, 1), c.campaign_send_date LIMIT 1)[OFFSET(0)]) AS send_date,
  ARRAY_AGG(c.campaign_list ORDER BY IF(c.campaign_send_date >= DATE_SUB(c.d1, INTERVAL 2 DAY), 0, 1), c.campaign_send_date LIMIT 1)[OFFSET(0)] AS list,
  ARRAY_AGG(c.language ORDER BY IF(c.campaign_send_date >= DATE_SUB(c.d1, INTERVAL 2 DAY), 0, 1), c.campaign_send_date LIMIT 1)[OFFSET(0)] AS language
FROM ls JOIN c ON c.yr = ls.yr AND c.src = ls.src
GROUP BY 1, 2
ORDER BY 1, 4, 2
