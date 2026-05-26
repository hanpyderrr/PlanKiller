import re
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Reminder
from ..schemas import ReminderCreate, ReminderRead
from ..services import dispatch_due_reminders

router = APIRouter(prefix="/reminders", tags=["reminders"])


@router.post("", response_model=ReminderRead)
def create_reminder(payload: ReminderCreate, db: Session = Depends(get_db)) -> Reminder:
    reminder = Reminder(**payload.model_dump())
    db.add(reminder)
    db.commit()
    db.refresh(reminder)
    return reminder


@router.get("", response_model=list[ReminderRead])
def list_reminders(db: Session = Depends(get_db)) -> list[Reminder]:
    return list(db.scalars(select(Reminder).order_by(Reminder.active.desc(), Reminder.next_run_at)).all())


@router.post("/{reminder_id}/snooze", response_model=ReminderRead)
def snooze_reminder(reminder_id: int, minutes: int = 10, db: Session = Depends(get_db)) -> Reminder:
    reminder = db.get(Reminder, reminder_id)
    if reminder is None:
        raise HTTPException(status_code=404, detail="Reminder not found")
    reminder.next_run_at = datetime.now() + timedelta(minutes=minutes)
    reminder.active = True
    db.commit()
    db.refresh(reminder)
    return reminder


@router.post("/dispatch-due")
async def dispatch_due(db: Session = Depends(get_db)) -> dict[str, int]:
    return {"sent": await dispatch_due_reminders(db)}


def parse_reply(text: str) -> dict[str, object]:
    stripped = text.strip()
    if stripped == "完成" or stripped.startswith("完成 "):
        reason = stripped[2:].strip()
        return {"action": "complete", **({"reason": reason} if reason else {})}
    if stripped == "跳过" or stripped.startswith("跳过 "):
        reason = stripped[2:].strip()
        return {"action": "skip", **({"reason": reason} if reason else {})}
    match = re.fullmatch(r"延后(\d+)", stripped)
    if match:
        return {"action": "snooze", "minutes": int(match.group(1))}
    return {"action": "chat", "message": stripped}


@router.post("/parse-reply")
def parse_reminder_reply(payload: dict[str, str]) -> dict[str, object]:
    return parse_reply(payload.get("text", ""))
