import os
from datetime import date, datetime, timedelta
from pathlib import Path
from uuid import uuid4

TEST_DATABASE_PATH = Path(__file__).resolve().parents[1] / "data" / "test_plankiller.db"
TEST_DATABASE_PATH.parent.mkdir(parents=True, exist_ok=True)
if TEST_DATABASE_PATH.exists():
    TEST_DATABASE_PATH.unlink()
os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DATABASE_PATH.as_posix()}"

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.database import SessionLocal, init_db
from app.main import app
from app.models import Habit, HabitLog, ReminderDelivery
from app.services import compute_report, seed_default_reminders


client = TestClient(app)


def setup_module() -> None:
    init_db()
    with SessionLocal() as db:
        seed_default_reminders(db)


def _unique_plan_date() -> str:
    offset = 30 + (uuid4().int % 5000)
    return (date.today() + timedelta(days=offset)).isoformat()


def _recent_plan_date(days_ago: int) -> str:
    return (date.today() - timedelta(days=days_ago)).isoformat()


def _memory_hits(body: dict) -> list[dict]:
    assert "hits" in body
    assert isinstance(body["hits"], list)
    return body["hits"]


def _assert_hit_with_source(hits: list[dict], unique_term: str, source_type: str) -> None:
    assert any(
        hit.get("source_type") == source_type
        and unique_term in " ".join(str(hit.get(field, "")) for field in ("title", "content", "text", "snippet"))
        for hit in hits
    )


def _latest_delivery_response() -> str:
    with SessionLocal() as db:
        delivery = db.scalars(select(ReminderDelivery).order_by(ReminderDelivery.id.desc())).first()
        assert delivery is not None
        return delivery.response


def test_health() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_plan_review_and_history_flow() -> None:
    today = date.today().isoformat()
    response = client.post(
        "/plans",
        json={
            "plan_date": today,
            "focus": "finish MVP",
            "energy_level": 4,
            "items": [
                {"title": "write API", "priority": 1, "estimated_minutes": 90, "start_time": "09:00"},
                {"title": "verify desktop", "priority": 2, "estimated_minutes": 45, "end_time": "15:30"},
            ],
        },
    )
    assert response.status_code == 200
    plan = response.json()
    assert len(plan["items"]) == 2
    assert plan["items"][0]["start_time"] == "09:00"
    assert plan["items"][1]["end_time"] == "15:30"

    item_id = plan["items"][0]["id"]
    response = client.patch(f"/plans/items/{item_id}", json={"done": True})
    assert response.status_code == 200
    assert response.json()["items"][0]["done"] is True

    response = client.post(
        f"/plans/{today}/review",
        json={"completed_summary": "API is usable", "blockers": "none", "mood": "steady"},
    )
    assert response.status_code == 200
    assert response.json()["review"]["completed_summary"] == "API is usable"

    response = client.get(f"/plans?start={today}&end={today}")
    assert response.status_code == 200
    assert response.json()[0]["plan_date"] == today


def test_habit_log_edit_delete_reorder_and_done_only_report() -> None:
    today = date.today().isoformat()
    uid = str(uuid4())[:8]
    response = client.post("/habits", json={"name": f"Meditation {uid}", "reminder_time": "21:30", "emoji": "M"})
    assert response.status_code == 200
    habit_id = response.json()["id"]

    response = client.post(f"/habits/{habit_id}/logs", json={"log_date": today, "status": "done"})
    assert response.status_code == 200
    first_id = response.json()["id"]

    response = client.post(f"/habits/{habit_id}/logs", json={"log_date": today, "status": "skip", "note": "late"})
    assert response.status_code == 200
    assert response.json()["id"] == first_id
    assert response.json()["status"] == "skip"

    response = client.put(f"/habits/{habit_id}", json={"name": f"Meditation edited {uid}", "emoji": "E"})
    assert response.status_code == 200
    assert response.json()["emoji"] == "E"

    second = client.post("/habits", json={"name": f"Stretch {uid}", "emoji": "S"})
    assert second.status_code == 200
    response = client.patch(
        "/habits/reorder",
        json={"habits": [{"id": habit_id, "position": 1}, {"id": second.json()["id"], "position": 0}]},
    )
    assert response.status_code == 200
    assert response.json()["ok"] is True

    response = client.delete(f"/habits/{habit_id}/logs/{today}")
    assert response.status_code == 204

    target = date(2099, 1, 3)
    with SessionLocal() as db:
        before = compute_report(db, target, target)
        done_habit = Habit(name=f"Report done {uid}", emoji="D", active=True)
        skipped_habit = Habit(name=f"Report skip {uid}", emoji="K", active=True)
        db.add_all([done_habit, skipped_habit])
        db.commit()
        db.refresh(done_habit)
        db.refresh(skipped_habit)
        db.add_all(
            [
                HabitLog(habit_id=done_habit.id, log_date=target, status="done"),
                HabitLog(habit_id=skipped_habit.id, log_date=target, status="skip"),
            ]
        )
        db.commit()
        report = compute_report(db, target, target)

    assert report["habit_logs"] == before["habit_logs"] + 1
    assert any("Report skip" in item for item in report["skipped_habits"])


def test_reminder_reply_parser_and_dispatch() -> None:
    assert client.post("/reminders/parse-reply", json={"text": "完成"}).json()["action"] == "complete"
    assert client.post("/reminders/parse-reply", json={"text": "跳过 太累"}).json() == {
        "action": "skip",
        "reason": "太累",
    }
    assert client.post("/reminders/parse-reply", json={"text": "延后10"}).json() == {"action": "snooze", "minutes": 10}

    due_at = (datetime.now() - timedelta(minutes=1)).isoformat()
    response = client.post(
        "/reminders",
        json={
            "title": "stand up",
            "message": "Go move for five minutes",
            "schedule_type": "once",
            "scheduled_time": "09:00",
            "next_run_at": due_at,
        },
    )
    assert response.status_code == 200

    response = client.post("/reminders/dispatch-due")
    assert response.status_code == 200
    assert response.json()["sent"] >= 1


def test_default_reminders_seeded() -> None:
    response = client.get("/reminders")
    assert response.status_code == 200
    titles = [r["title"] for r in response.json()]
    assert "今日计划提醒" in titles
    assert "下班复盘提醒" in titles


def test_ai_fallback_report_and_memory_hits() -> None:
    target_date = _unique_plan_date()
    unique_memory_word = f"chat-memory-{uuid4()}"
    response = client.post(
        "/plans",
        json={
            "plan_date": target_date,
            "focus": "RAG chat memory",
            "energy_level": 2,
            "items": [{"title": "record review blocker", "priority": 1, "estimated_minutes": 20}],
        },
    )
    assert response.status_code == 200
    response = client.post(
        f"/plans/{target_date}/review",
        json={
            "completed_summary": "Skipped exercise",
            "blockers": f"Too tired in the evening {unique_memory_word}",
            "mood": "tired",
            "tomorrow_hint": "Start with a short walk",
        },
    )
    assert response.status_code == 200
    assert client.post("/memory/reindex").status_code == 200

    response = client.post("/ai/chat", json={"message": f"Why did exercise slip? {unique_memory_word}"})
    assert response.status_code == 200
    body = response.json()
    assert body["used_provider"] in {"local-fallback", "openai", "deepseek"}
    assert "memory_hits" in body
    _assert_hit_with_source(body["memory_hits"], unique_memory_word, "daily_review")

    response = client.get("/ai/reports/weekly")
    assert response.status_code == 200
    assert "plan_completion_rate" in response.json()
    assert "narrative" in response.json()


def test_memory_reindex_search_manual_and_reply_memory() -> None:
    target_date = _unique_plan_date()
    unique_blocker = f"review-blocker-{uuid4()}"
    response = client.post(
        "/plans",
        json={
            "plan_date": target_date,
            "focus": "RAG review indexing",
            "energy_level": 3,
            "items": [{"title": "write memory tests", "priority": 1, "estimated_minutes": 30}],
        },
    )
    assert response.status_code == 200
    response = client.post(
        f"/plans/{target_date}/review",
        json={
            "completed_summary": "Prepared RAG backend tests",
            "blockers": f"Need ranking coverage for {unique_blocker}",
            "mood": "steady",
            "tomorrow_hint": "Implement memory search",
        },
    )
    assert response.status_code == 200
    response = client.post("/memory/reindex")
    assert response.status_code == 200

    response = client.get("/memory/search", params={"q": unique_blocker})
    assert response.status_code == 200
    _assert_hit_with_source(_memory_hits(response.json()), unique_blocker, "daily_review")

    manual_term = f"manual-first-{uuid4()}"
    response = client.post(
        "/memory/manual",
        json={"title": "Exercise preference", "content": f"I prefer morning workouts {manual_term}"},
    )
    assert response.status_code == 200
    response = client.get("/memory/search", params={"q": manual_term})
    assert response.status_code == 200
    _assert_hit_with_source(_memory_hits(response.json()), manual_term, "manual")

    reply_term = f"reply-memory-{uuid4()}"
    response = client.post("/qq/webhook", json={"type": "C2C_MESSAGE_CREATE", "d": {"content": f"跳过 {reply_term}"}})
    assert response.status_code == 200
    assert response.json()["parsed"]["action"] == "skip"
    response = client.get("/memory/search", params={"q": reply_term})
    assert response.status_code == 200
    _assert_hit_with_source(_memory_hits(response.json()), reply_term, "ai_insight")


def test_habit_reminder_dispatch_includes_recent_skip_context() -> None:
    habit_name = f"Stretch {uuid4()}"
    response = client.post("/habits", json={"name": habit_name, "reminder_time": "20:30"})
    assert response.status_code == 200
    habit_id = response.json()["id"]

    for days_ago in (2, 1):
        response = client.post(
            f"/habits/{habit_id}/logs",
            json={"log_date": _recent_plan_date(days_ago), "status": "skip", "note": "too tired"},
        )
        assert response.status_code == 200

    due_at = (datetime.now() - timedelta(minutes=1)).isoformat()
    response = client.post(
        "/reminders",
        json={
            "title": "stretch break",
            "message": "Do a stretch break",
            "schedule_type": "once",
            "scheduled_time": "20:30",
            "next_run_at": due_at,
            "target_type": "habit",
            "target_id": habit_id,
        },
    )
    assert response.status_code == 200

    response = client.post("/reminders/dispatch-due")
    assert response.status_code == 200
    assert response.json()["sent"] >= 1
    delivery_response = _latest_delivery_response()
    assert habit_name in delivery_response
    assert "最近 7 天跳过 2 次" in delivery_response
