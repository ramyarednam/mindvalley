#!/usr/bin/env python3
"""Build calendar/fibre-challenge.ics from calendar/events.json.

Run after editing events.json (for example, to add Nora's live calls):

    python3 fibre-challenge/scripts/build_calendar.py

All-day events use "start"/"end" as YYYY-MM-DD (end is the last day, inclusive).
Timed events (live calls) use "start" as an ISO time with a UTC offset, e.g.
"2026-11-25T19:00:00+01:00", plus "durationMinutes" and an optional "url".
"""
from __future__ import annotations

import json
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "calendar" / "events.json"
TARGET = ROOT / "calendar" / "fibre-challenge.ics"
UID_DOMAIN = "fibre-challenge.mindvalley.com"


def escape(text: str) -> str:
    return text.replace("\\", "\\\\").replace(";", "\\;").replace(",", "\\,").replace("\n", "\\n")


def fold(line: str) -> list[str]:
    """Fold lines longer than 75 octets, as RFC 5545 requires."""
    out, current = [], ""
    for char in line:
        if len((current + char).encode("utf-8")) > 75:
            out.append(current)
            current = " " + char
        else:
            current += char
    out.append(current)
    return out


def event_lines(event: dict, stamp: str) -> list[str]:
    lines = ["BEGIN:VEVENT", f"UID:{event['id']}@{UID_DOMAIN}", f"DTSTAMP:{stamp}"]
    start = event["start"]
    if "T" in start:
        begins = datetime.fromisoformat(start).astimezone(timezone.utc)
        ends = begins + timedelta(minutes=int(event.get("durationMinutes", 60)))
        lines += [f"DTSTART:{begins:%Y%m%dT%H%M%SZ}", f"DTEND:{ends:%Y%m%dT%H%M%SZ}"]
    else:
        first = date.fromisoformat(start)
        last = date.fromisoformat(event.get("end", start))
        lines += [
            f"DTSTART;VALUE=DATE:{first:%Y%m%d}",
            f"DTEND;VALUE=DATE:{last + timedelta(days=1):%Y%m%d}",
            "TRANSP:TRANSPARENT",
        ]
    lines.append(f"SUMMARY:{escape(event['title'])}")
    description = event.get("description", "")
    if event.get("url"):
        description = f"{description}\n\nJoin: {event['url']}".strip()
        lines.append(f"URL:{event['url']}")
    if description:
        lines.append(f"DESCRIPTION:{escape(description)}")
    if "T" in start:
        lines += ["BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:Starting in 30 minutes", "TRIGGER:-PT30M", "END:VALARM"]
    lines.append("END:VEVENT")
    return lines


def main() -> None:
    data = json.loads(SOURCE.read_text(encoding="utf-8"))
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//Mindvalley//30-30-30 Fibre Challenge//EN",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        f"X-WR-CALNAME:{escape(data['calendarName'])}",
        "REFRESH-INTERVAL;VALUE=DURATION:PT6H",
        "X-PUBLISHED-TTL:PT6H",
    ]
    for event in data["events"]:
        lines += event_lines(event, stamp)
    lines.append("END:VCALENDAR")
    folded = [part for line in lines for part in fold(line)]
    TARGET.write_bytes(("\r\n".join(folded) + "\r\n").encode("utf-8"))
    print(f"Wrote {TARGET.relative_to(ROOT.parent)} with {len(data['events'])} events")


if __name__ == "__main__":
    main()
