# All figures pulled from Metabase (MV BigQuery, db 35) on 2026-11-11.
# Revenue = fact_sales_order.order_amount (gross contract value, ex-tax, MV staff excluded).
# Leads = fact_lead sign-ups (MV staff excluded). "unique" = distinct user_id.
# Data runs 2025-01-01 .. 2026-11-10.

# ---------- Year totals (USD) ----------
# business unit / sub-BU revenue. FY2025 full year; YTD = Jan 1 - Nov 10 (like-for-like window)
BU = {
    "FY2025": {"Mastery": 26_510_712, "Certifications": 8_131_399, "Accelerator": 0, "Guild": 0,
               "Coach": 291_705, "B2B": 140_940, "Events": 3_573_313, "Lifebook": 1_422_416,
               "Wildfit": 27_343, "Membership_launch_tagged": 13_641_848,
               "Membership_total": 68_902_286, "Membership_new": 29_000_000},
    "YTD2025": {"Mastery": 24_779_048, "Certifications": 7_514_469, "Accelerator": 0, "Guild": 0,
                "Coach": 259_750, "B2B": 136_612, "Events": 3_526_070, "Lifebook": 555_478,
                "Wildfit": 26_844, "Membership_launch_tagged": 13_641_848 - 6_452_558 - 2_245_900 + 1_246_148,
                "Membership_total": 53_153_000},
    "YTD2026": {"Mastery": 17_776_235, "Certifications": 3_953_105, "Accelerator": 1_341_113, "Guild": 131_375,
                "Coach": 150_242, "B2B": 44_700, "Events": 2_054_142, "Lifebook": 297_007,
                "Wildfit": 334_633, "Membership_launch_tagged": 3_716_018,
                "Membership_total": 34_740_364},
}
CAMPAIGN_LINES = ["Mastery", "Certifications", "Accelerator", "Guild", "Coach", "B2B", "Events", "Lifebook", "Wildfit", "Membership_launch_tagged"]

def campaign_total(p):
    return sum(BU[p][k] for k in CAMPAIGN_LINES)

# Monthly MV Membership revenue (total, launch-tagged, new-member revenue, new orders)
MEMBERSHIP_MONTHLY = [
 ("2025-01",4990411,315686,1695849,10494),("2025-02",4110417,537627,1281450,6548),("2025-03",4120217,308083,1427332,6026),
 ("2025-04",4420160,421506,1742405,9823),("2025-05",5079599,343375,2265114,13425),("2025-06",6501968,1130959,3168972,18693),
 ("2025-07",5631489,330002,3142412,18164),("2025-08",5704872,559413,3176917,17963),("2025-09",4766642,451613,2190585,12930),
 ("2025-10",4989686,545126,2014799,12065),("2025-11",11273591,6452558,4168744,24183),("2025-12",5555886,2245900,2686466,15396),
 ("2026-01",4558712,393082,1901359,11126),("2026-02",2796979,221102,906823,5592),("2026-03",2833766,190492,938484,5776),
 ("2026-04",2772573,241818,776900,5255),("2026-05",2959219,201914,763797,4769),("2026-06",3551681,698955,690493,4221),
 ("2026-07",3303293,231571,874663,5559),("2026-08",3570246,295765,1118041,6968),("2026-09",3050037,300283,881374,5616),
 ("2026-10",3048085,387573,721967,4766),("2026-11",1379666,553463,339887,2260),
]

# Leads by period (rows = sign-ups, unique = distinct users). Product-launch tagged leads by page kind.
LEADS = {
    "FY2025": {"all_rows": 2_289_000, "launch_summit": (315_851, 222_585), "launch_cert": (143_396, 105_520),
               "launch_accel": (2, 2), "launch_challenge": (30_550, 27_904), "launch_other": (101_836, 79_500)},
    "YTD2026": {"launch_summit": (289_912, 163_981), "launch_cert": (112_336, 70_621),
                "launch_accel": (55_181, 45_985), "launch_challenge": (1_595, 1_512), "launch_other": (39_025, 30_917)},
}

# ---------- 2025 campaign scorecard ----------
# (name, dates, type, sells, leads_text, revenue_usd, revenue_text, note)
# revenue_usd None = not isolatable in Metabase
C2025 = [
 ("FutureHuman Festival", "Jan 10-12", "Festival (paid)", "FH tickets, Future Human Mastery bundle, Total Mastery",
  "Ticketed (2,136 Jan ticket orders; 1,945 in 2024)", 4_720_000,
  "$4.72M", "Tickets $1.15M (Jul 24-Jan 25) + FH Mastery bundle $2.42M + Total Mastery $0.99M + virtual pass $0.17M. Jan 2025 alone: $3.74M."),
 ("Masters of Manifesting", "Jan 18-19", "Live seminar", "Manifesting Mastery (early)", "n/a", None, "n/a", "No product or lead page tagged to this seminar in Metabase."),
 ("Membership - New Features promo", "Jan 22-31", "Membership promo", "Membership", "n/a", 104_123, "$0.10M tagged",
  "No lift: $1.40M in the 10 promo days vs $1.84M/10 days in the Jan 2-21 baseline."),
 ("Best of Mindvalley Summit", "Feb 8-9", "Membership summit (free)", "Membership", "55,400 sign-ups (52k unique)", 356_498, "$0.36M tagged in summit week",
  "Feb 8-13 membership $1.13M vs $0.73M/6-day baseline. Lead-attributed lifetime revenue $0.91M."),
 ("Certified Life Coach (seminar Feb 23 + webinar Feb 25)", "Feb 23-25", "Cert launch", "CLC Mar-2025 cohort", "24,900 sign-ups (20k unique)", 1_279_443, "$1.28M",
  "402 enrolments in the Feb 10-Mar 17 purchase window. Lead campaign launch_clc_feb_2025: 16.4k leads, $1.02M attributed."),
 ("Master of Manifesting promo", "Feb 28", "Membership promo", "Membership", "n/a", 42_766, "$0.04M tagged",
  "Feb 28 total $227k vs ~$140k/day baseline, almost all renewals."),
 ("States email funnel", "Mar 3", "Email funnel", "States", "n/a", 17_600, "$0.02M", "States BU revenue for March."),
 ("MVU event campaign (Mar + Apr + May + Jun)", "Mar 10 - Jun 30", "Event campaign", "Mindvalley U 2025 tickets", "1,716 webinar sign-ups (Apr)", 1_017_000, "$1.02M (Mar-Jun ticket sales)",
  "MVU 2025 lifetime $1.96M (2,863 orders), of which $0.42M pre-sold in 2024."),
 ("Wildfit live webinar", "Mar 11", "Webinar", "WildFit cohort (members)", "13,000 sign-ups", 212_114, "$0.21M lead-attributed",
  "launch_wf_march_2025: 5,975 leads, $161k within 90 days."),
 ("Social Media Summit", "Mar 28-30", "Hybrid summit", "Social Media Mastery 2025", "78,200 sign-ups (72k unique, 45k paid)", 3_228_463, "$3.23M",
  "644 Mastery orders, $0.94M refunded. Summit page launch_sms_march_2025: 21k leads, $1.98M attributed."),
 ("Social Media Summit Highlights", "Apr 6", "Highlights webinar", "Social Media Mastery", "5,067 sign-ups", 196_065, "$0.20M attributed", "Part of the $3.23M above."),
 ("Business Coach (seminar Apr 13 + webinar Apr 15)", "Apr 13-15", "Cert launch", "CBC Apr-2025 cohort", "12,400 sign-ups", 705_803, "$0.71M",
  "152 enrolments. 13k launch leads, $0.94M attributed within 90 days."),
 ("MVU Webinar", "Apr 17", "Live workshop", "MVU 2025", "1,716 sign-ups", 166_002, "$0.17M attributed", "launch_mvu_apr_2025 leads."),
 ("Membership Promo", "Apr 30 - May 2", "Membership promo", "Membership", "n/a", 120_397, "$0.12M tagged",
  "3-day window $0.54M vs $0.44M baseline: about $0.10M incremental."),
 ("Manifesting Summit", "May 17-18", "Hybrid summit (paid + free)", "Manifesting Mastery 2025 + tickets", "54,000 sign-ups + 14,319 virtual and 1,670 in-person ticket buyers", 6_693_662, "$6.69M",
  "Mastery $5.69M (1,191 orders) + tickets $1.00M. Highest revenue per lead of any summit ($124/sign-up)."),
 ("Manifesting Summit Highlights", "Jun 1", "Highlights webinar", "Manifesting Mastery", "4,911 sign-ups", None, "in Mastery total", "Mastery sold $1.67M in June."),
 ("AI Quest launch", "Jun 5-6", "Quest soft release", "Membership", "n/a", None, "n/a", "Not isolatable in Metabase."),
 ("Speaking Summit", "Jun 14-15", "Free summit", "Influence Mastery 2025", "48,800 sign-ups (46k unique, 27k paid)", 2_043_164, "$2.04M",
  "435 orders. launch_sais_june_2025: 18.7k leads, $1.31M attributed."),
 ("Awesome to Flawsome", "Jun 18-20", "Quest soft release", "Membership", "1,031 sign-ups", None, "n/a", "Not isolatable."),
 ("MVU Virtual tickets", "Jun 23 - Aug 10", "Event campaign", "MVU Online pass", "n/a", 151_459, "$0.15M", "3,091 virtual passes."),
 ("AI Summit", "Jul 25-26", "Hybrid summit", "AI Mastery Advanced 2025", "170,000 sign-ups (155k unique, 108k paid)", 7_079_975, "$7.08M",
  "1,231 orders. Biggest campaign of the two years. launch_AIS_july_2025: 51k leads, $4.25M attributed."),
 ("AI Mastery Highlights", "Aug 3", "Highlights webinar", "AI Mastery", "24,000 sign-ups (Jul-Aug)", None, "in Mastery total", "AI Mastery sold $2.37M in August."),
 ("MVU Amsterdam", "Aug 4-17", "Mindvalley U", "MVU 2025 + MVU 2026 presale", "n/a", 985_636, "$0.99M MVU 2026 presold at the event",
  "MVU 2025 lifetime $1.96M; MVU 2026 presale $1.08M by Dec 2025."),
 ("Supercoach Summit", "Aug 9-10", "Coach summit", "Supercoach tickets, Coaching Business Accelerator", "5,411 challenge sign-ups (Jun)", 277_515, "$0.28M",
  "Tickets $0.04M + Coaching Business Accelerator $0.23M (57 orders)."),
 ("Membership Summit", "Aug 9", "Membership summit", "Membership", "20,200 sign-ups", 1_183_447, "$1.18M lead-attributed",
  "launch_mvx_aug_2025: $0.97M within 90 days. Aug 9-10 new-member revenue doubled vs baseline."),
 ("Certified Hypnotherapy (seminar Aug 31 + webinar Sep 2)", "Aug 31 - Sep 2", "Cert launch", "MCH Sep-2025 cohort", "73,000 sign-ups (60k unique)", 2_102_717, "$2.10M",
  "516 enrolments. Best certification launch of the two years. 40k launch leads, $2.06M attributed."),
 ("Entrepreneurship Summit", "Sep 26-28", "Hybrid summit", "Entrepreneurship Mastery", "52,000 sign-ups", 2_519_566, "$2.52M",
  "535 orders. 38.7k launch leads, $1.88M attributed."),
 ("Entrepreneurship Mastery Live with Vishen (x2)", "Oct 2, Oct 18", "Academy webinars", "Entrepreneurship Mastery", "1,738 sign-ups", None, "in Mastery total", "Mastery sold $0.97M in October."),
 ("Entrepreneurship Summit Highlights", "Oct 10", "Highlights webinar", "Entrepreneurship Mastery", "11,900 sign-ups", None, "in Mastery total", ""),
 ("Speaking Academy workshop + retreat", "Oct 23; Nov 10-14", "Live workshop + luxury retreat", "Speaking Academy ($10k seats)", "9,565 + 1,478 sign-ups", 338_000, "$0.34M",
  "31 seats sold Aug-Nov. Lead campaigns attributed $0.20M."),
 ("Black Friday + Cyber Monday", "Nov 1 - Dec 7", "Membership major sale", "Membership (new, upgrades, renewals)", "n/a", 8_143_416, "$8.14M launch-tagged",
  "Total membership in the window $14.0M (Nov 1-16 $3.2M, Nov 17-30 $8.1M, Dec 1-7 $2.7M) vs a $0.16M/day baseline. New-member revenue $4.2M in Nov."),
 ("Windstar Cruise with Vishen", "Nov 11", "Live workshop", "n/a", "n/a", None, "n/a", "No product found in Metabase."),
 ("Last chance to become a life coach", "Nov 16", "Cert webinar", "CLC Nov-2025 cohort", "961 sign-ups", 127_596, "$0.13M", "29 enrolments; 895 launch leads, $0.11M attributed."),
 ("Spiritual Summit", "Nov 22-23", "Free summit", "Spiritual Mastery 2025 + Spiritual & Manifesting bundle", "96,800 sign-ups (54k paid)", 1_441_356, "$1.44M",
  "Mastery $1.05M (286 orders) + bundle $0.35M + tickets $0.04M. Most sign-ups of any free summit, lowest revenue per lead ($15)."),
 ("Spiritual Summit Highlights", "Dec 7", "Highlights webinar", "Spiritual Mastery", "7,471 sign-ups", None, "in Mastery total", ""),
 ("Manifesting Cert webinar", "Dec 8", "Cert webinar", "Manifesting Coaching Certification (Seville, Jan 2026)", "n/a", 469_362, "$0.47M",
  "Nov $0.23M, Dec $0.15M, Jan $0.08M. 2026 sheet shows $0.38M actual."),
 ("7 Sacred States challenge", "Dec 18-24", "Challenge", "Spiritual Mastery / Membership", "25,500 sign-ups", 431_238, "$0.43M lead-attributed", "launch_CHSP_dec_2025: 23.9k leads."),
 ("Lifebook 2.0 webinar", "Dec 28", "Lifebook live webinar", "Lifebook Online", "39,500 sign-ups (manifesto page)", 849_000, "$0.85M",
  "Lifebook product sales Dec 28-Jan 31. Dec 28 was a $398k day. 19.7k launch leads, $0.97M attributed."),
 ("Q5 Promo", "Dec 29-31", "Membership promo", "Membership", "n/a", 1_285_392, "$1.29M launch-tagged (Dec 28-Jan 1)",
  "Window total $2.21M vs $0.46M baseline: about $1.75M incremental incl. Lifebook."),
]

# ---------- 2026 campaign scorecard ----------
C2026 = [
 ("Social Media Summit at 1BFS (Dubai)", "Jan 9-11", "Hybrid summit (free + VIP)", "Social Media Mastery 2026", "145,000 sign-ups Dec-Jan (100k paid)", 2_103_778, "$2.10M",
  "444 orders, $0.48M refunded. Sheet actual $2.09M. Twice the leads of 2025 but $14 per sign-up vs $41."),
 ("Healing from Heartbreak", "Jan 15", "Quest soft release", "Membership", "n/a", None, "n/a", "Not isolatable (Jan 15 shows a $511k renewal batch unrelated to the quest)."),
 ("Manifesting Cert (Seville)", "Jan 17-19", "Certification event", "Manifesting Coaching Certification", "n/a", 469_362, "$0.47M (Nov 25-Feb 26)", "Sheet actual $0.38M."),
 ("Self Reset", "Jan 18", "Event campaign (free)", "n/a", "n/a", None, "n/a", "No product or lead page found."),
 ("Social Media Summit Highlights", "Jan 18", "Highlights webinar", "Social Media Mastery", "11,200 sign-ups", None, "in Mastery total", ""),
 ("Social Media Mastery Academy webinar", "Jan 21", "Academy webinar", "Social Media Mastery", "332 sign-ups", None, "in Mastery total", ""),
 ("AI Accelerator (webinar Jan 31, class Feb 9-15)", "Jan 31 - Feb 15", "7-day accelerator", "AI Accelerator", "29,300 sign-ups", 577_232, "$0.58M",
  "568 orders. Sheet actual $0.58M. 25k launch leads, $0.60M attributed."),
 ("Silva Ultramind webinar", "Feb 3", "Quest release webinar", "Membership", "n/a", None, "n/a", "Not isolatable."),
 ("Certified Life Coach (seminar Feb 13 + webinar Feb 22, cohort Mar 4)", "Feb 13 - Mar 4", "Cert launch", "CLC Mar-2026 cohort", "41,000 sign-ups", 1_170_846, "$1.17M",
  "314 enrolments. Sheet: seminar $0.32M + program $1.06M. 25.6k launch leads, $1.09M attributed."),
 ("States Box Set offer", "Feb 16-17", "States release", "States", "n/a", 59_700, "$0.06M", "States revenue in Feb."),
 ("Maestro's Guide to Leadership", "Feb 26", "Quest soft release", "Membership", "n/a", None, "n/a", "Not isolatable."),
 ("Negotiate with Confidence", "Mar 3", "Quest release webinar", "Membership", "n/a", None, "n/a", "Not isolatable."),
 ("AI Summit", "Mar 20-22", "Free summit + VIP", "AI Mastery 2026", "120,000 sign-ups (70k paid)", 5_069_628, "$5.07M",
  "Mastery $4.33M (780 orders) + VIP upgrades $0.47M (9,064) + deposits $0.27M. Sheet actual $4.26M. 50k launch leads, $2.5M attributed."),
 ("AI Summit Highlights", "Mar 28", "Highlights webinar", "AI Mastery", "13,300 sign-ups", None, "in Mastery total", ""),
 ("AI Clones Accelerator (downsell Apr 21-30, class Apr 27-May 3)", "Apr 21 - May 3", "7-day accelerator", "AI Accelerator 2026", "1,305 sign-ups", 116_023, "$0.12M",
  "78 orders. Sheet shows $0.58M, which is the Feb AI Accelerator figure repeated."),
 ("MVU Webinar", "Apr 29", "Live workshop", "MVU 2026", "632 sign-ups", 87_701, "$0.09M attributed", "MVU 2026 sold $0.42M in Apr-May."),
 ("Manifesting Summit", "May 15-17", "Free summit + VIP", "Manifesting Mastery 2026", "136,000 sign-ups (54k paid)", 4_030_921, "$4.03M",
  "Mastery $3.79M (827 orders) + VIP upgrades $0.24M (4,723). Sheet actual $3.72M. 88k launch leads, $2.8M attributed."),
 ("Manifesting Summit Highlights", "May 23", "Highlights webinar", "Manifesting Mastery", "26,500 sign-ups", None, "in Mastery total", ""),
 ("Manifesting Pathway Downsell (72h)", "Jun 3-5", "Email funnel", "Manifesting Blocks accelerator", "n/a", 84_915, "$0.08M", "85 orders of the downsell product."),
 ("Speaking & Influence Summit", "Jun 26-28", "Free summit + VIP", "Speaking & Influence Mastery 2026", "52,300 sign-ups", 1_525_416, "$1.53M",
  "Mastery $1.44M (303 orders) + VIP $0.09M. Sheet actual $1.20M."),
 ("Vishen x Chiara King podcast", "Jul 4", "Value email", "Brand", "n/a", None, "n/a", ""),
 ("Daniel Priestley webinar + 2-day accelerator", "Jul 6; Jul 18-19", "Accelerator", "Science of Growing Customers", "10,800 sign-ups", 229_267, "$0.23M",
  "433 orders. 7.7k launch leads, $0.20M attributed."),
 ("S&I Summit Highlights", "Jul 7", "Highlights webinar", "S&I Mastery", "3,669 sign-ups", None, "in Mastery total", ""),
 ("Regan Hillyer webinar + Wealth Code accelerator", "Jul 16; Jul 25-26", "Accelerator", "Manifesting Accelerator: Wealth Code", "19,500 sign-ups", 324_968, "$0.32M",
  "632 orders. 14k launch leads, $0.37M attributed."),
 ("MVU Estonia", "Jul 20 - Aug 2", "Mindvalley U", "MVU 2026 + MVU 2027 presale", "n/a", 599_730, "$0.60M MVU 2027 presold Jul-Aug",
  "MVU 2026 lifetime $2.26M (2,195 orders); MVU 2027 presale $0.87M by Nov 10."),
 ("Jeffrey Allen - Art of Unmanifesting", "Jul 22", "1-day accelerator", "n/a", "n/a", None, "n/a", "No product found."),
 ("Be Extraordinary masterclass (email)", "Jul 23-24", "Email funnel", "Membership", "743 sign-ups", 12_698, "$0.01M attributed", ""),
 ("Vishen - Expert & Authority 1-day (Jul 23 promo, Aug 1)", "Jul 23 - Aug 1", "1-day accelerator", "Authority seminar", "6,400 sign-ups", 214_775, "$0.21M lead-attributed", "launch_eawc_* leads."),
 ("Jim Kwik - Limitless Brain", "Jul 30", "1-day accelerator", "n/a", "n/a", None, "n/a", "No product found."),
 ("Certified Hypnotherapy (seminar Aug 9 + webinar Aug 18, cohort Aug 26)", "Aug 9-26", "Cert launch", "MCH Aug-2026 cohort", "38,000 unique sign-ups (67k rows)", 1_425_478, "$1.43M cohort ($1.88M MCH orders Aug-Sep)",
  "338 enrolments + $0.05M in $29 seminar tickets. Sheet actual $2.5M. 2025 launch did $2.10M."),
 ("Jim Kwik book promo", "Aug 15-16; Sep 8", "Book promotion", "Brand", "n/a", None, "n/a", ""),
 ("Expert to Authority Summit", "Sep 18-20", "Free summit + VIP", "Expert & Authority Mastery + Mastermind", "35,000 unique sign-ups (69k rows)", 2_760_353, "$2.76M",
  "Mastery $2.54M (540 orders) + VIP $0.09M + Mastermind $0.13M. 20k unique launch leads, $1.32M attributed."),
 ("Authority Guild webinars + Guild", "Sep 23, 28; Oct 14", "Guild", "The Authority Guild", "3,500 sign-ups", 131_375, "$0.13M", "21 Guild orders + 34 deposits."),
 ("WildFit webinar + cohort", "Oct 6-12", "Webinar + program", "WildFit (members)", "11,800 sign-ups", 467_000, "$0.47M",
  "WildFit product $0.33M (2026) + membership wf_product $0.23M in Oct. Launch leads $0.20M attributed."),
 ("Bold Conversations quest", "Oct 9", "Quest soft release", "Membership", "n/a", None, "n/a", "Not isolatable."),
 ("AI for Founders Summit", "Oct 30 - Nov 1", "Free summit + VIP", "AI for Founders Mastery", "40,000 unique sign-ups (80k rows)", 1_969_762, "$1.97M so far (to Nov 10)",
  "Mastery $1.90M (279 orders, class starts Nov 17) + VIP $0.07M. Still selling."),
 ("Black Friday + 3-year offer (confirmed)", "Nov 16-30", "Membership major sale", "Membership", "n/a", 553_762, "$0.55M tagged Nov 1-10 (presale)", "Upcoming. 2025 window did $8.14M tagged."),
 ("Fibre Challenge, AIFM class, BOGO, AI Guild, Lifebook Dec 27, Q5 (confirmed)", "Nov 16 - Dec 31", "various", "", "", None, "upcoming", ""),
]

# ---------- Mastery launches side by side ----------
MASTERY = [
 # name, 2025 (format, leads, revenue), 2026 (format, leads, revenue)
 ("Social Media", ("Hybrid, Mar", 78_200, 3_228_463), ("Free + VIP at 1BFS Dubai, Jan", 145_000, 2_103_778)),
 ("Manifesting", ("Hybrid paid + free, May", 54_000, 6_693_662), ("Free + VIP, May", 136_000, 4_030_921)),
 ("Speaking & Influence", ("Free, Jun", 48_800, 2_043_164), ("Free + VIP, Jun", 52_300, 1_525_416)),
 ("AI", ("Hybrid, Jul", 170_000, 7_079_975), ("Free + VIP, Mar", 120_000, 5_069_628)),
 ("Entrepreneurship / Expert to Authority", ("Hybrid, Sep", 52_000, 2_519_566), ("Free + VIP, Sep", 35_000, 2_760_353)),
 ("Spiritual / AI for Founders", ("Free, Nov", 96_800, 1_441_356), ("Free + VIP, Oct", 40_000, 1_969_762)),
]
