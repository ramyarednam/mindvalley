-- Sign-ups by UTM source per campaign day: people, first sign-up per launch, staff removed.
WITH b AS (
__LAUNCHES__),
l AS (
  SELECT b.yr, b.d1, l.user_id, l.signup_timestamp, l.is_member, l.traffic_channel ch,
    LOWER(IFNULL(NULLIF(TRIM(l.utm_source), ''), '(no utm_source)')) src, LOWER(IFNULL(l.utm_medium, '')) med,
    ROW_NUMBER() OVER (PARTITION BY b.yr, l.user_id ORDER BY l.signup_timestamp) rn
  FROM l3_leads.fact_lead l
  JOIN b ON REGEXP_CONTAINS(LOWER(RTRIM(l.form_path,'/')), b.rx) AND DATE(l.signup_timestamp) BETWEEN b.d1 AND DATE_ADD(b.w, INTERVAL 7 DAY)
  LEFT JOIN l3_common.dim_user u ON u.user_id = l.user_id
  WHERE NOT COALESCE(u.is_mv_user, l.is_mv_user, FALSE))
SELECT yr, src, DATE_DIFF(DATE(signup_timestamp), d1, DAY) + 1 AS cday,
  ANY_VALUE(med) AS medium, ANY_VALUE(ch) AS channel,
  COUNT(*) AS people, COUNTIF(IFNULL(is_member, FALSE)) AS members
FROM l WHERE rn = 1
GROUP BY 1, 2, 3
ORDER BY 1, 2, 3
