import random, os, html
OUT = os.environ.get("OUT", os.path.dirname(os.path.abspath(__file__)))

def barcode():
    random.seed(26)  # same bars every build
    cells = []
    for i in range(58):
        w = random.choice([1, 1, 2, 2, 3, 4])
        color = "#0f131a" if i % 2 == 0 else "#ffffff"
        cells.append(f'<td width="{w}" style="width:{w}px;height:46px;background-color:{color};font-size:0;line-height:0;" bgcolor="{color}">&nbsp;</td>')
    return ('<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto;border-collapse:collapse;"><tr>'
            + "".join(cells) + "</tr></table>")

MONO = "'Courier New', Courier, monospace"
SANS = "Helvetica, Arial, sans-serif"

def item(label):
    tag = "&#10003;"
    if isinstance(label, tuple): label, tag = label
    return f'''<tr>
  <td class="r-item" width="88%" style="padding:9px 8px 9px 0;font-family:{SANS};font-size:20px;line-height:26px;color:#0f131a;">{label}</td>
  <td class="r-tag" align="right" style="padding:9px 0;font-family:{SANS};font-size:22px;line-height:26px;color:#0c8a4f;font-weight:bold;white-space:nowrap;">{tag}</td>
</tr>'''

def line(label, value, value_style=""):
    return f'''<tr>
  <td class="r-item" width="88%" style="padding:8px 8px 8px 0;font-family:{SANS};font-size:20px;line-height:26px;color:#0f131a;">{label}</td>
  <td class="r-item" align="right" style="padding:8px 0;font-family:{SANS};font-size:20px;line-height:26px;color:#0f131a;white-space:nowrap;{value_style}">{value}</td>
</tr>'''

def dashed():
    return '<tr><td colspan="2" style="padding:12px 0;"><div style="border-top:2px dashed #c9c3d6;font-size:0;line-height:0;">&nbsp;</div></td></tr>'

def build(v):
    items = "\n".join(item(x) for x in v["items"])
    prices = "\n".join(line(*p) for p in v["prices"])
    return f'''<!doctype html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>{html.escape(v["subject"])}</title>
<!--[if mso]><style>table,td{{font-family:Arial,sans-serif !important;}}</style><![endif]-->
<style>
  body {{ margin:0 !important; padding:0 !important; width:100% !important; background-color:#efeaf7; }}
  table {{ border-collapse:collapse; mso-table-lspace:0pt; mso-table-rspace:0pt; }}
  img {{ border:0; outline:none; text-decoration:none; }}
  a {{ text-decoration:none; }}
  @media screen and (max-width:620px) {{
    .wrap {{ width:100% !important; }}
    .pad {{ padding-left:12px !important; padding-right:12px !important; }}
    .receipt {{ padding:24px 16px !important; }}
    .h1 {{ font-size:26px !important; line-height:32px !important; }}
    .h1 span {{ font-size:18px !important; line-height:26px !important; }}
    .r-item {{ font-size:16px !important; line-height:24px !important; }}
    .r-head {{ font-size:14px !important; letter-spacing:1.5px !important; }}
    .r-prod {{ font-size:13px !important; }}
    .r-tag {{ font-size:18px !important; }}
    .total {{ font-size:34px !important; line-height:40px !important; }}
    .btn a {{ font-size:20px !important; padding:16px 18px !important; }}
  }}
</style>
</head>
<body style="margin:0;padding:0;background-color:#efeaf7;">
<!-- Preheader (hidden) -->
<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">{html.escape(v["pre"])}&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#efeaf7;" bgcolor="#efeaf7">
<tr><td align="center" class="pad" style="padding:32px 24px;">

  <table role="presentation" class="wrap" width="560" cellpadding="0" cellspacing="0" border="0" style="width:560px;max-width:560px;">

    <!-- Headline -->
    <tr><td align="center" style="padding:0 8px 24px;">
      <a href="https://www.mindvalley.com/" target="_blank" style="display:inline-block;"><img src="https://d15k2d11r6t6rl.cloudfront.net/public/users/Integrators/669d5713-9b6a-46bb-bd7e-c542cff6dd6a/7990193d60ff4babbc6b3c28c9e3bcaa/mv-wings-only.png" width="55" height="24" alt="Mindvalley" style="display:block;margin:0 auto;border:0;width:55px;height:24px;"></a>
      <div class="h1" style="font-family:{SANS};font-size:34px;line-height:40px;color:#0f131a;padding-top:10px;"><strong>{v["h1a"]}</strong><br><span style="font-size:22px;line-height:30px;">{v["h1b"]}</span></div>
    </td></tr>

    <!-- Receipt -->
    <tr><td class="receipt" style="background-color:#ffffff;padding:32px 36px;border-top:6px dotted #efeaf7;border-radius:0 0 6px 6px;" bgcolor="#ffffff">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr><td colspan="2" align="center" class="r-head" style="font-family:{MONO};font-size:18px;line-height:24px;letter-spacing:3px;color:#0f131a;font-weight:bold;">MINDVALLEY &middot; BLACK FRIDAY</td></tr>
        <tr><td colspan="2" align="center" class="r-prod" style="font-family:{MONO};font-size:17px;line-height:24px;color:#41464f;padding-top:6px;">{v["product_line"]}</td></tr>
        {dashed()}
        {items}
        {dashed()}
        {prices}
        <tr><td colspan="2" style="padding:12px 0 6px;"><div style="border-top:4px double #0f131a;font-size:0;line-height:0;">&nbsp;</div></td></tr>
        <tr><td colspan="2">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
            <td style="font-family:{MONO};font-size:20px;line-height:26px;color:#0f131a;font-weight:bold;letter-spacing:2px;vertical-align:middle;">TOTAL</td>
            <td align="right" class="total" style="font-family:{SANS};font-size:42px;line-height:48px;color:#7a12d4;font-weight:bold;white-space:nowrap;">{v["total"]}</td>
          </tr></table>
        </td></tr>
        <tr><td colspan="2" align="right" style="font-family:{SANS};font-size:19px;line-height:26px;color:#0f131a;padding-top:4px;">{v["total_note"]}</td></tr>

        <!-- Button -->
        <tr><td colspan="2" align="center" class="btn" style="padding:24px 0 10px;">
          <!--[if mso]>
          <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" href="{v["url"]}" style="height:56px;v-text-anchor:middle;width:440px;" arcsize="50%" stroke="f" fillcolor="#7A12D4">
            <w:anchorlock/><center style="color:#ffffff;font-family:Arial,sans-serif;font-size:19px;font-weight:bold;">{v["cta"]}</center>
          </v:roundrect>
          <![endif]-->
          <!--[if !mso]><!-- -->
          <a href="{v["url"]}" target="_blank" style="display:block;background-color:#7A12D4;color:#ffffff;font-family:{SANS};font-size:22px;line-height:24px;font-weight:bold;text-align:center;padding:16px 24px;border-radius:999px;">{v["cta"]}</a>
          <!--<![endif]-->
        </td></tr>
        <tr><td colspan="2" align="center" style="font-family:{SANS};font-size:18px;line-height:26px;color:#41464f;padding-bottom:6px;">{v["under_cta"]}<br>Until Saturday, Nov 28, 11:59 PM PST</td></tr>
        {dashed()}

        <!-- Barcode -->
        <tr><td colspan="2" align="center" style="padding:4px 0 10px;">{barcode()}</td></tr>
        <tr><td colspan="2" align="center" style="font-family:{MONO};font-size:16px;line-height:24px;color:#41464f;">{v["barcode_note"]}</td></tr>
      </table>
    </td></tr>

    <!-- Compliance -->
    <tr><td style="padding:22px 8px 0;font-family:{SANS};font-size:15px;line-height:23px;color:#41464f;text-align:center;">{v["fine"]}</td></tr>
{v.get("disclaimer","")}
    <!-- Braze footer: unsubscribe + preference centre -->
    <tr><td style="padding:24px 8px 8px;font-family:Verdana,Arial,sans-serif;font-size:13px;line-height:20px;color:#5b6170;text-align:center;">{{{{content_blocks.${{footer_left_side}}}}}}</td></tr>
    <tr><td style="padding:0 8px 8px;font-family:Verdana,Arial,sans-serif;font-size:13px;line-height:20px;color:#5b6170;text-align:center;">{{{{content_blocks.${{footer_right_side_pref_center}}}}}}</td></tr>

  </table>
</td></tr>
</table>
</body>
</html>
'''

BAR = "4.8&#9733; average Quest rating<br>25,959 member stories"

nonmember = dict(
    subject="Your Black Friday receipt",
    pre="Mindvalley Membership, 60% off. $199 for the year.",
    h1a="&#127881; One Membership. Your Whole Transformation.", h1b="60% Off, Until Saturday Nov 28.",
    product_line="1 &times; Mindvalley Membership &middot; 12 months",
    items=["110+ programs", "World-class teachers", "New programs every month", "Offline access on all your devices"],
    prices=[("Usual price, per year", "<s>$499.00</s>", "color:#8b909a;"),
            ("Black Friday &minus;60%", "&minus;$300.00", "font-weight:bold;"),
            ("Every renewal, locked", "$199.00", "font-weight:bold;color:#0c8a4f;")],
    total="$199", total_note="60% off every year you stay a member.",
    url="https://www.mindvalley.com/membership/blackfriday",
    cta="Claim 60% off now",
    under_cta="15-day money-back guarantee",
    barcode_note=BAR,
    fine="$199 for your first year (regular $499). Your price stays $199 every year your membership stays active. 15-day refund. Offer ends Sat Nov 28, 11:59 PM PST.",
)

member = dict(
    subject="Your Lifetime receipt",
    pre="One payment. $0 renewals, for life.",
    h1a="&#127881; Your Black Friday Lifetime Access Starts Now", h1b="Just for Mindvalley Members",
    product_line="1 &times; Mindvalley Membership &middot; Lifetime",
    items=["110+ programs", "World-class teachers", "New programs every month", "Offline access on all your devices"],
    prices=[("Your current plan", "prorated", "font-weight:bold;color:#0c8a4f;"),
            ("Renewals", "$0.00", "font-weight:bold;"),
            ("Future price increases", "none", "font-weight:bold;")],
    total="1 payment", total_note="Then never again.",
    url="https://www.mindvalley.com/membership/blackfriday/members/lifetime",
    cta="Upgrade to Lifetime now",
    under_cta="Limited places",
    barcode_note=BAR,
    fine="One payment, no renewals. Your price depends on your current plan, with credit for unused time, and is shown in Billing &amp; Subscriptions. Limited places. Offer ends Sat Nov 28, 11:59 PM PST.",
    disclaimer='    <tr><td style="padding:16px 8px 0;font-family:Verdana,Arial,sans-serif;font-size:13px;font-style:italic;line-height:20px;color:#5b6170;text-align:center;">{{content_blocks.${Email_Disclaimer_MV_Member}}}</td></tr>',
)

EMAIL = "email5C"  # Email 5, test variation C (receipt). A = long form, B = short form.
CAMPAIGN = "launch_bfcm_nov_2026"

def tracked(base, list_code):
    src = f"email_campaign_{list_code}_{EMAIL}"
    return (f"{base}?utm_source={src}&amp;utm_campaign={CAMPAIGN}&amp;utm_content=content_wwww"
            f"&amp;utm_medium=lp&amp;otag={src}&amp;otag={CAMPAIGN}")

churned = dict(member,
    prices=[p for p in member["prices"] if p[0] != "Your current plan"],
    fine="One payment, no renewals. Limited places. Offer ends Sat Nov 28, 11:59 PM PST.",
    disclaimer="")

# one file per Braze list: (list name as in the sheet, otag code, version)
LISTS = [("Daily", "daily", nonmember),
         ("Highlights", "highlights", nonmember),
         ("Weekly", "weekly", nonmember),
         ("Events", "events", nonmember),
         ("Vishens List", "vl", nonmember),
         ("Coach", "coach", nonmember),
         ("Meditations Customers", "medcust", nonmember),
         ("All Mastery Customers", "mas", nonmember),
         ("Lifebook Customers", "lbcust", nonmember),
         ("WildFit Customers", "wfcust", nonmember),
         ("Members", "mvm", member),
         ("Churned Members", "churned", churned)]

for list_name, code, v in LISTS:
    out = build(dict(v, url=tracked(v["url"], code)))
    name = "Email5C_Receipt_" + list_name.replace(" ", "_") + ".html"
    open(os.path.join(OUT, name), "w").write(out)
    print("wrote", name, len(out))
