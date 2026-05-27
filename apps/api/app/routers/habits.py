# 习惯管理路由：创建习惯、列表（附带今日打卡状态）、打卡（upsert）、历史日志查询
from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..memory import delete_source_document, sync_habit_log_memory
from ..models import Habit, HabitLog
from ..schemas import HabitCreate, HabitLogCreate, HabitLogRead, HabitRead, HabitReorderRequest, HabitUpdate
from ..services import today_in_timezone

router = APIRouter(prefix="/habits", tags=["habits"])


@router.post("", response_model=HabitRead)
def create_habit(payload: HabitCreate, db: Session = Depends(get_db)) -> Habit:
    max_pos = db.scalar(select(func.max(Habit.position))) or 0
    data = payload.model_dump()
    data["position"] = max_pos + 1
    habit = Habit(**data)
    db.add(habit)
    db.commit()
    db.refresh(habit)
    return habit


@router.patch("/reorder", status_code=200)
def reorder_habits(payload: HabitReorderRequest, db: Session = Depends(get_db)) -> dict:
    """批量更新习惯排序位置。"""
    for item in payload.habits:
        habit = db.get(Habit, item.id)
        if habit is not None:
            habit.position = item.position
    db.commit()
    return {"ok": True}


@router.get("", response_model=list[HabitRead])
def list_habits(log_date: date | None = None, db: Session = Depends(get_db)) -> list[HabitRead]:
    """返回所有习惯，注入今日打卡状态和本周完成次数。"""
    habits = list(db.scalars(select(Habit).order_by(Habit.position.asc(), Habit.name)).all())
    target = log_date or today_in_timezone()
    week_start = target - timedelta(days=target.weekday())  # 本周一

    today_logs = {
        log.habit_id: log.status
        for log in db.scalars(select(HabitLog).where(HabitLog.log_date == target)).all()
    }
    # 本周每个习惯的 done 次数
    week_counts: dict[int, int] = {}
    for log in db.scalars(
        select(HabitLog).where(HabitLog.log_date >= week_start, HabitLog.log_date <= target, HabitLog.status == "done")
    ).all():
        week_counts[log.habit_id] = week_counts.get(log.habit_id, 0) + 1

    result = []
    for habit in habits:
        item = HabitRead.model_validate(habit)
        item.today_status = today_logs.get(habit.id)
        item.week_done_count = week_counts.get(habit.id, 0)
        try:
            scheduled_days = {int(day) for day in (habit.schedule_days or "0,1,2,3,4,5,6").split(",") if day.strip() != ""}
        except ValueError:
            scheduled_days = set(range(7))
        item.is_scheduled_today = target.weekday() in scheduled_days
        result.append(item)
    return result


@router.put("/{habit_id}", response_model=HabitRead)
def update_habit(habit_id: int, payload: HabitUpdate, db: Session = Depends(get_db)) -> Habit:
    """编辑习惯字段（局部更新）。"""
    habit = db.get(Habit, habit_id)
    if habit is None:
        raise HTTPException(status_code=404, detail="Habit not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(habit, field, value)
    db.commit()
    db.refresh(habit)
    return habit


@router.delete("/{habit_id}", status_code=204)
def delete_habit(habit_id: int, db: Session = Depends(get_db)) -> None:
    """删除习惯及其所有打卡记录（级联删除）。"""
    habit = db.get(Habit, habit_id)
    if habit is None:
        raise HTTPException(status_code=404, detail="Habit not found")
    db.delete(habit)
    db.commit()


@router.post("/{habit_id}/logs", response_model=HabitLogRead)
def log_habit(habit_id: int, payload: HabitLogCreate, db: Session = Depends(get_db)) -> HabitLog:
    """打卡 upsert：同一习惯同一天多次提交只保留最新状态（done/skip 可互改）。"""
    if db.get(Habit, habit_id) is None:
        raise HTTPException(status_code=404, detail="Habit not found")
    log = db.scalar(select(HabitLog).where(HabitLog.habit_id == habit_id, HabitLog.log_date == payload.log_date))
    if log is None:
        log = HabitLog(habit_id=habit_id, log_date=payload.log_date)
        db.add(log)
    log.status = payload.status
    log.note = payload.note
    db.commit()
    db.refresh(log)
    sync_habit_log_memory(db, log)
    return log


@router.get("/logs", response_model=list[HabitLogRead])
def list_logs(start: date | None = None, end: date | None = None, db: Session = Depends(get_db)) -> list[HabitLog]:
    """查询打卡历史记录，支持日期范围过滤。"""
    query = select(HabitLog).order_by(HabitLog.log_date.desc())
    if start is not None:
        query = query.where(HabitLog.log_date >= start)
    if end is not None:
        query = query.where(HabitLog.log_date <= end)
    return list(db.scalars(query).all())


@router.delete("/{habit_id}/logs/{log_date}", status_code=204)
def delete_habit_log(habit_id: int, log_date: date, db: Session = Depends(get_db)) -> None:
    """撤销打卡：删除指定日期的打卡记录，恢复为「待打卡」状态。"""
    log = db.scalar(select(HabitLog).where(HabitLog.habit_id == habit_id, HabitLog.log_date == log_date))
    if log is None:
        raise HTTPException(status_code=404, detail="Log not found")
    log_id = log.id
    db.delete(log)
    db.commit()
    delete_source_document(db, "habit_log", log_id)
