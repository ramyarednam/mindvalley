-- Sign-ups: people, first sign-up per launch on the live webinar page (all languages), staff removed.
WITH b AS (
__LAUNCHES__),
l AS (
  SELECT b.yr, b.d1, l.user_id, l.signup_timestamp, l.is_member, l.nth_user_signup, l.traffic_channel ch, LOWER(l.utm_source) src,
    REGEXP_CONTAINS(LOWER(l.form_path), r'^/[a-z]{2}/') non_en,
    ROW_NUMBER() OVER (PARTITION BY b.yr, l.user_id ORDER BY l.signup_timestamp) rn
  FROM l3_leads.fact_lead l
  JOIN b ON REGEXP_CONTAINS(LOWER(RTRIM(l.form_path,'/')), b.rx) AND DATE(l.signup_timestamp) BETWEEN b.d1 AND DATE_ADD(b.w, INTERVAL 7 DAY)
  LEFT JOIN l3_common.dim_user u ON u.user_id = l.user_id
  WHERE NOT COALESCE(u.is_mv_user, l.is_mv_user, FALSE))
SELECT yr, DATE_DIFF(DATE(signup_timestamp), d1, DAY) + 1 AS cday,
  CASE WHEN ch='Email' OR src LIKE 'email%' THEN 'Email'
       WHEN ch IN ('App','Web','Internal Referral') OR src LIKE 'mvapp%' OR src LIKE 'mvhome%' THEN 'Platform'
       WHEN ch='Organic Social' THEN 'Organic social'
       WHEN ch IN ('Paid Social','Paid Search','Display','Paid Video','Paid Other') THEN 'Paid ads'
       WHEN ch='Affiliate' THEN 'Affiliate'
       WHEN ch IN ('Direct','Organic Search','Organic Referral','LLM Referral') THEN 'Direct & search'
       ELSE 'Other' END AS channel,
  IFNULL(is_member, FALSE) AS member, IFNULL(nth_user_signup = 1, FALSE) AS first_ever, non_en,
  COUNT(*) AS people,
  FORMAT_TIMESTAMP('%Y-%m-%dT%H:%M:%SZ', MAX(signup_timestamp)) AS last_signup
FROM l WHERE rn = 1
GROUP BY 1, 2, 3, 4, 5, 6
ORDER BY 1, 2
