-- Email sign-ups by send (utm_source), people's first sign-up per launch.
WITH b AS (
__LAUNCHES__),
l AS (
  SELECT b.yr, b.d1, l.user_id, l.signup_timestamp, l.is_member, l.traffic_channel ch, LOWER(l.utm_source) src,
    ROW_NUMBER() OVER (PARTITION BY b.yr, l.user_id ORDER BY l.signup_timestamp) rn
  FROM l3_leads.fact_lead l
  JOIN b ON REGEXP_CONTAINS(LOWER(RTRIM(l.form_path,'/')), b.rx) AND DATE(l.signup_timestamp) BETWEEN b.d1 AND DATE_ADD(b.w, INTERVAL 7 DAY)
  LEFT JOIN l3_common.dim_user u ON u.user_id = l.user_id
  WHERE NOT COALESCE(u.is_mv_user, l.is_mv_user, FALSE))
SELECT yr, src, DATE_DIFF(DATE(MIN(signup_timestamp)), ANY_VALUE(d1), DAY) + 1 AS first_cday,
  COUNT(*) AS people, COUNTIF(IFNULL(is_member, FALSE)) AS members
FROM l WHERE rn = 1 AND (ch = 'Email' OR src LIKE 'email%')
GROUP BY 1, 2
ORDER BY 1, people DESC
