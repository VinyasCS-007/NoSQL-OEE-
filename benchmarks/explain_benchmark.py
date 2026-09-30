"""Index benchmark: run the same queries with and without an index and save explain("executionStats").

Usage (from the project root, mongod running):
    python benchmarks/explain_benchmark.py            # 100k messages
    python benchmarks/explain_benchmark.py --n 20000  # smaller, faster

Uses its own database (oee_chat_bench), so the app's data is never touched.
Results: benchmarks/results/<case>_<no_index|with_index>.json and summary.md
"""
import argparse
import json
import random
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

from bson import ObjectId, json_util
from pymongo import MongoClient

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from app.config import settings  # noqa: E402

RESULTS = Path(__file__).parent / "results"
WORDS = ("hello anyone here pizza movie tonight game music exam study coffee weekend travel "
         "football cricket anime coding python mongo index query party rain summer book").split()


def seed(db, n_messages, n_rooms, n_users):
    print(f"Seeding {n_messages:,} messages in {n_rooms} rooms and {n_users:,} users...")
    db.messages.drop()
    db.users.drop()
    rooms = [ObjectId() for _ in range(n_rooms)]
    start = datetime.now(timezone.utc) - timedelta(days=30)
    batch = []
    for i in range(n_messages):
        guest = random.random() < 0.6
        batch.append({
            "room_id": random.choice(rooms),
            "sender": {"type": "guest" if guest else "user", "alias": f"User{random.randint(1, 500)}"},
            "text": " ".join(random.choices(WORDS, k=random.randint(3, 10))),
            "created_at": start + timedelta(seconds=i * 20),
        })
        if len(batch) == 10_000:
            db.messages.insert_many(batch)
            batch = []
    if batch:
        db.messages.insert_many(batch)
    db.users.insert_many([
        {"email": f"user{i}@example.com", "pwd_hash": "x", "alias": f"User{i}",
         "created_at": start} for i in range(n_users)
    ])
    return rooms


def summarize(explain):
    """Pull the numbers that matter out of an explain document."""
    stats = explain["executionStats"]
    plan = explain["queryPlanner"]["winningPlan"]

    def stages(p):
        out = [p.get("stage")]
        for key in ("inputStage", "queryPlan"):
            if key in p:
                out += stages(p[key])
        for child in p.get("inputStages", []):
            out += stages(child)
        return out

    return {
        "stages": " → ".join(s for s in stages(plan) if s),
        "nReturned": stats["nReturned"],
        "totalKeysExamined": stats["totalKeysExamined"],
        "totalDocsExamined": stats["totalDocsExamined"],
        "executionTimeMillis": stats["executionTimeMillis"],
    }


def run_case(db, name, cursor_factory, create_index, drop_index):
    rows = {}
    for label in ("no_index", "with_index"):
        if label == "with_index":
            create_index()
        explain = cursor_factory().explain()  # pymongo's explain() uses executionStats verbosity
        (RESULTS / f"{name}_{label}.json").write_text(json_util.dumps(explain, indent=2))
        rows[label] = summarize(explain)
        # time a few real runs too (explain time includes planning overhead)
        t = time.perf_counter()
        for _ in range(5):
            list(cursor_factory())
        rows[label]["avgQueryMs"] = round((time.perf_counter() - t) / 5 * 1000, 2)
    drop_index()
    return rows


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--n", type=int, default=100_000, help="number of messages")
    parser.add_argument("--rooms", type=int, default=50)
    parser.add_argument("--users", type=int, default=20_000)
    args = parser.parse_args()

    RESULTS.mkdir(exist_ok=True)
    client = MongoClient(settings.mongo_uri)
    db = client["oee_chat_bench"]
    random.seed(42)
    rooms = seed(db, args.n, args.rooms, args.users)
    room = rooms[0]

    cases = {
        # 1. load the latest 50 messages of one room (the chat history query)
        "room_history": run_case(
            db, "room_history",
            lambda: db.messages.find({"room_id": room}).sort([("created_at", -1), ("_id", -1)]).limit(50),
            lambda: db.messages.create_index([("room_id", 1), ("created_at", -1), ("_id", -1)], name="room_recent"),
            lambda: db.messages.drop_index("room_recent"),
        ),
        # 2. login: find a user by email
        "login_email": run_case(
            db, "login_email",
            lambda: db.users.find({"email": "user15000@example.com"}),
            lambda: db.users.create_index("email", unique=True, name="email_unique"),
            lambda: db.users.drop_index("email_unique"),
        ),
    }

    # 3. word search: $regex needs no index but scans everything; $text needs the text index
    RESULTS.mkdir(exist_ok=True)
    regex = db.messages.find({"room_id": room, "text": {"$regex": r"\bpizza\b", "$options": "i"}}).explain()
    db.messages.create_index([("text", "text")], name="text_search")
    text = db.messages.find({"room_id": room, "$text": {"$search": "pizza"}}).explain()
    db.messages.drop_index("text_search")
    (RESULTS / "text_search_no_index.json").write_text(json_util.dumps(regex, indent=2))
    (RESULTS / "text_search_with_index.json").write_text(json_util.dumps(text, indent=2))
    cases["text_search"] = {"no_index": summarize(regex), "with_index": summarize(text)}

    lines = [
        f"# explain() results — {args.n:,} messages, {args.rooms} rooms, {args.users:,} users",
        "",
        f"Generated {datetime.now():%Y-%m-%d %H:%M}. Raw explain output is in the JSON files next to this one.",
        "",
        "| Query | Index | Plan stages | Returned | Keys examined | Docs examined | explain ms | avg query ms |",
        "|---|---|---|---|---|---|---|---|",
    ]
    for name, rows in cases.items():
        for label, r in rows.items():
            lines.append(f"| {name} | {label.replace('_', ' ')} | {r['stages']} | {r['nReturned']} | "
                         f"{r['totalKeysExamined']:,} | {r['totalDocsExamined']:,} | {r['executionTimeMillis']} | {r.get('avgQueryMs', '—')} |")
    lines += ["", "text_search 'no index' uses a case-insensitive $regex (the only option without a text index)."]
    (RESULTS / "summary.md").write_text("\n".join(lines), encoding="utf-8")
    print("\n".join(lines))
    client.drop_database("oee_chat_bench")
    client.close()


if __name__ == "__main__":
    main()
