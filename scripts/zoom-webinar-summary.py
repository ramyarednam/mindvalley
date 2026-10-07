"""Summarise a Zoom webinar attendee report + survey report into aggregate numbers (no names or emails).

    python3 scripts/zoom-webinar-summary.py attendee.csv survey.csv > scripts/wildfit-live/webinar-2026.json

The dashboard build embeds the JSON. Keep the raw CSVs out of git: they hold personal data.
"""
import csv, collections, datetime as dt, json, sys

def rows_of(path):
    return list(csv.reader(open(path, encoding="utf-8-sig")))

def ts(s):
    return dt.datetime.strptime(s.strip(), "%m/%d/%Y %I:%M:%S %p")

def attendees(path):
    rows = rows_of(path)
    meta = dict(zip(rows[2], rows[3]))
    generated = rows[1][1]
    i = next(k for k, r in enumerate(rows) if r and r[0] == "Attendee Details")
    staff = {r[2].strip().lower() for r in rows[:i] if len(r) > 2 and "@" in r[2]}
    people = collections.defaultdict(lambda: {"mins": 0, "iv": []})
    countries = collections.Counter()
    for r in rows[i + 2:]:
        if len(r) < 6 or r[0] != "Yes" or r[2].strip().lower() in staff:
            continue
        key = r[2].strip().lower() or r[1].strip().lower()
        p = people[key]
        if not p["iv"]:
            countries[r[7] if len(r) > 7 else ""] += 1
        p["mins"] += int(r[5] or 0)
        p["iv"].append((ts(r[3]), ts(r[4])))
    start = min(a for p in people.values() for a, _ in p["iv"])
    end = max(b for p in people.values() for _, b in p["iv"])
    length = int((end - start).total_seconds() // 60)
    curve = []
    for m in range(0, length + 1, 5):
        t = start + dt.timedelta(minutes=m)
        curve.append([m, sum(1 for p in people.values() if any(a <= t < b for a, b in p["iv"]))])
    mins = sorted(min(p["mins"], length) for p in people.values())
    n = len(mins)
    return {
        "report_generated": generated, "topic": meta.get("Topic", "").strip(),
        "zoom_unique_viewers": int(meta.get("Unique Viewers", 0) or 0), "zoom_max_concurrent": int(meta.get("Max Concurrent Views", 0) or 0),
        "unique_attendees": n, "first_join": start.strftime("%H:%M"), "length_min": length,
        "avg_min": round(sum(mins) / n, 1), "median_min": mins[n // 2],
        "stayed": {str(k): sum(m >= k for m in mins) for k in (15, 30, 60, 90)},
        "at_end": sum(1 for p in people.values() if any(b >= end - dt.timedelta(minutes=10) for _, b in p["iv"])),
        "curve": curve, "countries": countries.most_common(8),
    }

def survey(path):
    rows = rows_of(path)
    hi = next(k for k, r in enumerate(rows) if r and r[0] == "#" and "User ID" in r)
    hdr = rows[hi]
    data = [r for r in rows[hi + 1:] if r and r[0].strip().isdigit()]
    qs = []
    for j, q in enumerate(hdr[8:], 8):
        c = collections.Counter(r[j].strip() for r in data if len(r) > j and r[j].strip())
        qs.append({"q": q.strip(), "answers": c.most_common()})
    return {"responses": len(data), "generated": rows[2][0], "questions": qs}

if __name__ == "__main__":
    out = {"attendees": attendees(sys.argv[1]), "survey": survey(sys.argv[2])}
    json.dump(out, sys.stdout, indent=1)
    print()
