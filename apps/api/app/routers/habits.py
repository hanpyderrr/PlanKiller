# 习惯管理路由：创建习惯、列表（附带今日打卡状态）、打卡（upsert）、历史日志查询
from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Habit, HabitLog
from ..schemas import HabitCreate, HabitLogCreate, HabitLogRead, HabitRead, HabitReorderRequest, HabitUpdate

router = APIRouter(prefix="/habits", tags=["habits"])


@router.post("", response_model=HabitRead)
def create_habit(payload: HabitCreate, db: Session = Depends(get_db)) -> Habit:
    habit = Habit(**payload.model_dump())
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
    """返回所有习惯，同时注入指定日期（默认今天）的打卡状态到 today_status 字段。"""
    habits = list(db.scalars(select(Habit).order_by(Habit.position.asc(), Habit.name)).all())
    target = log_date or date.today()
    # 当天所有打卡记录索引成 {habit_id: status}，方便 O(1) 查找
    logs = {
        log.habit_id: log.status
        for log in db.scalars(select(HabitLog).where(HabitLog.log_date == target)).all()
    }
    result = []
    for habit in habits:
        item = HabitRead.model_validate(habit)
        item.today_status = logs.get(habit.id)  # 未打卡时为 None
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
    db.delete(log)
    db.commit()
