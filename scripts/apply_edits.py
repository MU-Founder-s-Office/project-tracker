#!/usr/bin/env python3
"""Round 3 edit pass.

User's pre-renumber IDs map to CURRENT ids:
  P-26 -> P-23  (Most-Native AI -> AI Native B-School, move to Strategy)
  P-27 -> P-24  (Session Dashboard -> Academic Director Dashboard v2)
  P-28 -> P-25  (Transplacement Report & GTM -> Transplacement)
  P-29 -> P-26  (Exec Ops Inefficiency -> Cross-Functional Ops Inefficiencies from Priyam)
  P-30 -> P-27  (MUBAAT)
  P-31 -> P-28  (Think Tank)
Adds new P-29: AI Training across the Organisation.
Also reformats every project's notes as bullet pointers.
"""
import json
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data" / "projects.json"

BULLET = "•"


def b(*lines):
    """Format a list of points into a bullet block."""
    return "\n".join(f"{BULLET} {line.rstrip('.').strip()}." for line in lines if line.strip())


# Bullet-formatted notes for EVERY project (keyed by CURRENT id post-round-2)
NOTES = {
    "P-01": b("Moved NPS from -17% to 35%"),
    "P-02": b("Active sprint completed", "Staggered survey windows used"),
    "P-03": b("P0 work-in-progress", "Feeds the new NPS structure"),
    "P-04": b("Gate project for the new NPS structure", "Ideation completed"),
    "P-05": b(
        "Unblocked by P-04 (Ideation)",
        "Implementation in progress",
        "See attached PDF for the full transformation plan",
    ),
    "P-06": b("Centralised NPS reporting under one office", "SOP done"),
    "P-07": b("All 4 departments rolled out", "FGDs completed"),
    "P-08": b("Roll-out planned with the upcoming cohort"),
    "P-09": b("Starting June"),
    "P-10": b(
        "Interviews and FGDs taken",
        "Data collected",
        "Meeting with Tarun done",
    ),
    "P-11": b("V1 live", "Reports + FGD quotations done"),
    "P-12": b("V1 done", "Emailers + templatisation complete"),
    "P-13": b(
        "Training students and staff",
        "Weekly adoption reminders",
        "Feedback collected for resolution issues",
    ),
    "P-14": b(
        "New admin-side platform for managing concerns and POC checks",
        "Emailers designed for better accountability",
    ),
    "P-15": b(
        "Detailed discussions with UG team done",
        "Phase 1 done — replication of best-practices framework by UG team on SRC",
    ),
    "P-16": b(
        "Students whose signature was missing due to a technical error have been replaced",
        "The ones who hadn't signed are being processed on the backend",
    ),
    "P-17": b(
        "Spotted the problem after discussions",
        "Broke it down into use cases",
        "Built prototypes",
        "Application is now in development",
    ),
    "P-18": b(
        "Version 1 done and approved by Bhupesh Sir",
        "To be implemented in C7",
        "Had an in-depth discussion",
        "Handing it over to the tech team now",
    ),
    "P-19": b(
        "Discussion 1 (briefer) done with Penguin",
        "Communications established with Tetr team",
        "Discussion 2 was lined up during ED week, postponed to 2nd week of May",
    ),
    "P-20": b("Data training in process", "Handing it over to the tech team"),
    "P-21": b("Nandini Ma'am to confirm a slot for next week"),
    "P-22": b(
        "v1 ready; emails have started to come in",
        "Working on the sanctity of the data with respect to data pull",
    ),
    # --- Round 3 edits below ---
    "P-23": b(  # AI Native B-School
        "Strategic positioning project — the AI-Native B-School narrative",
        "Moved from AI Initiatives capstone into Strategy",
    ),
    "P-24": b(  # Academic Director Dashboard v2
        "Approved by both Bhupesh Sir and Garmina Ma'am",
        "v3 will add an AI session summary",
        "v3 will add hit-rate of the lecture micro-question using session transcripts",
    ),
    "P-25": b(  # Transplacement
        "Report and GTM in process",
        "Web app v2 is ready and deployed",
        "Discussion with Deepansh scheduled for tomorrow",
    ),
    "P-26": b("Diagnostic-first approach", "Cross-functional inefficiencies surfaced by Priyam"),
    "P-27": b("Developing v1"),
    "P-28": b(
        "Students are getting comfortable — intellectually — on campus",
        "No idol?",
        "Maybe the answer is to become strict?",
    ),
}

# Field edits (current id keyed)
EDITS = {
    "P-23": {  # Most-Native AI -> AI Native B-School
        "rename_full": "AI Native B-School",
        "workstream": "Strategy",
    },
    "P-24": {  # Session Dashboard Suite -> Academic Director Dashboard v2
        "rename_full": "Academic Director Dashboard v2",
        "startDate": "2026-02-06", "endDate": "2026-06-30",
    },
    "P-25": {  # Transplacement Report & GTM -> Transplacement
        "rename_full": "Transplacement",
    },
    "P-26": {  # Exec Ops Inefficiency -> Cross-Functional Ops Inefficiencies from Priyam
        "rename_full": "Cross-Functional Ops Inefficiencies from Priyam",
    },
    "P-27": {  # MUBAAT
        "startDate": "2026-04-17", "endDate": "2026-06-21",
        "status": "On Track", "progress": 30,
    },
    "P-28": {  # Think Tank
        "startDate": "2026-06-01", "endDate": "2026-09-01",
    },
}

# New project to append (gets next sequential ID)
NEW_PROJECT = {
    "project": "AI Training across the Organisation",
    "workstream": "AI Initiatives",
    "status": "On Track",
    "priority": "P1",
    "startDate": "2026-04-22",
    "endDate": "2026-06-05",
    "progress": 20,
    "topRisk": "Adoption pace varies by team",
    "notes": b(
        "Meeting teams and defining use cases of AI tools",
        "In process",
    ),
    "references": [],
    "links": [],
    "rag": "",
    "extraFields": {},
}


def duration_days(start, end):
    if not start or not end:
        return 0
    s = date.fromisoformat(start)
    e = date.fromisoformat(end)
    return (e - s).days + 1


def main():
    data = json.loads(DATA.read_text(encoding="utf-8"))
    projects = data["projects"]
    risks = data.get("risks", [])

    # 1. Apply field edits
    for p in projects:
        edits = EDITS.get(p["id"], {})
        if "rename_full" in edits:
            p["project"] = edits["rename_full"]
        for key in ("startDate", "endDate", "progress", "status", "priority", "workstream"):
            if key in edits:
                p[key] = edits[key]
        p["durationDays"] = duration_days(p.get("startDate"), p.get("endDate"))
        if isinstance(p.get("risk"), dict):
            p["risk"]["project"] = p["project"]
            p["risk"]["workstream"] = p["workstream"]

    # 2. Reformat ALL notes
    for p in projects:
        if p["id"] in NOTES:
            p["notes"] = NOTES[p["id"]]
            if isinstance(p.get("risk"), dict):
                p["risk"]["mitigation"] = NOTES[p["id"]]

    # 3. Mirror project name updates into top-level risks
    name_by_id = {p["id"]: p["project"] for p in projects}
    ws_by_id = {p["id"]: p["workstream"] for p in projects}
    for r in risks:
        if r["id"] in name_by_id:
            r["project"] = name_by_id[r["id"]]
            r["workstream"] = ws_by_id[r["id"]]
            if r["id"] in NOTES:
                r["mitigation"] = NOTES[r["id"]]

    # 4. Append new project
    new_id = f"P-{len(projects) + 1:02d}"
    new = dict(NEW_PROJECT)
    new["id"] = new_id
    new["durationDays"] = duration_days(new["startDate"], new["endDate"])
    new["risk"] = {
        "id": new_id,
        "project": new["project"],
        "workstream": new["workstream"],
        "topRisk": new["topRisk"],
        "likelihood": 1.0,
        "impact": 2.0,
        "severity": 2.0,
        "mitigation": new["notes"],
        "owner": new["workstream"],
    }
    projects.append(new)
    risks.append(dict(new["risk"]))

    # 5. Update metadata
    data["projects"] = projects
    data["risks"] = risks
    if "metadata" in data:
        data["metadata"]["projectCount"] = len(projects)

    DATA.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Wrote {len(projects)} projects (added {new_id}: {new['project']}).")


if __name__ == "__main__":
    main()
