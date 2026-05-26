# 每日计划路由：创建/更新计划、勾选任务条目、提交晚间复盘、查询历史
# upsert 策略：同一天的计划只有一条，POST /plans 会覆盖当天已有记录
from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..database import get_db
from ..models import DailyPlan, DailyReview, PlanItem
from ..schemas import DailyPlanCreate, DailyPlanRead, DailyReviewCreate, PlanItemUpdate

router = APIRouter(prefix="/plans", tags=["plans"])


def _load_plan(db: Session, plan_date: date) -> DailyPlan | None:
    """带子关系预加载的计划查询，避免 N+1 问题。"""
    return db.scalar(
        select(DailyPlan)
        .where(DailyPlan.plan_date == plan_date)
        .options(selectinload(DailyPlan.items), selectinload(DailyPlan.review))
    )


@router.post("", response_model=DailyPlanRead)
def upsert_plan(payload: DailyPlanCreate, db: Session = Depends(get_db)) -> DailyPlan:
    plan = _load_plan(db, payload.plan_date)
    if plan is None:
        plan = DailyPlan(plan_date=payload.plan_date)
        db.add(plan)
    plan.focus = payload.focus
    plan.energy_level = payload.energy_level
    plan.notes = payload.notes
    # 按 title 匹配保留 done 状态：同名条目复用，新增条目创建，移除的条目删除
    existing_by_title = {item.title: item for item in plan.items}
    new_items: list[PlanItem] = []
    for position, item_data in enumerate(payload.items):
        existing = existing_by_title.pop(item_data.title, None)
        if existing:
            existing.category = item_data.category
            existing.priority = item_data.priority
            existing.estimated_minutes = item_data.estimated_minutes
            existing.start_time = item_data.start_time   # 原来是 planned_time
            existing.end_time = item_data.end_time        # 新增
            existing.position = position
            new_items.append(existing)
        else:
            new_items.append(PlanItem(
                title=item_data.title,
                category=item_data.category,
                priority=item_data.priority,
                estimated_minutes=item_data.estimated_minutes,
                start_time=item_data.start_time,   # 原来是 planned_time
                end_time=item_data.end_time,        # 新增
                position=position,
            ))
    for removed in existing_by_title.values():
        db.delete(removed)
    plan.items = new_items
    db.commit()
    return _load_plan(db, payload.plan_date)  # type: ignore[return-value]


@router.get("/{plan_date}", response_model=DailyPlanRead)
def get_plan(plan_date: date, db: Session = Depends(get_db)) -> DailyPlan:
    plan = _load_plan(db, plan_date)
    if plan is None:
        raise HTTPException(status_code=404, detail="Plan not found")
    return plan


@router.patch("/items/{item_id}", response_model=DailyPlanRead)
def update_item(item_id: int, payload: PlanItemUpdate, db: Session = Depends(get_db)) -> DailyPlan:
    """局部更新单个任务条目（主要用途：前端勾选 done）。"""
    item = db.get(PlanItem, item_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Plan item not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(item, field, value)
    db.commit()
    plan = db.get(DailyPlan, item.plan_id)
    return _load_plan(db, plan.plan_date)  # type: ignore[union-attr,return-value]


@router.delete("/items/{item_id}", status_code=204)
def delete_item(item_id: int, db: Session = Depends(get_db)) -> None:
    """删除单个计划任务条目。"""
    item = db.get(PlanItem, item_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Plan item not found")
    db.delete(item)
    db.commit()


@router.post("/{plan_date}/review", response_model=DailyPlanRead)
def submit_review(plan_date: date, payload: DailyReviewCreate, db: Session = Depends(get_db)) -> DailyPlan:
    """提交或更新当天复盘（一对一，已有则覆盖）。"""
    plan = _load_plan(db, plan_date)
    if plan is None:
        raise HTTPException(status_code=404, detail="Plan not found")
    review = plan.review or DailyReview(plan_id=plan.id)
    review.completed_summary = payload.completed_summary
    review.blockers = payload.blockers
    review.mood = payload.mood
    review.tomorrow_hint = payload.tomorrow_hint
    db.add(review)
    db.commit()
    db.expire_all()
    return _load_plan(db, plan_date)  # type: ignore[return-value]


@router.get("", response_model=list[DailyPlanRead])
def list_plans(start: date | None = None, end: date | None = None, db: Session = Depends(get_db)) -> list[DailyPlan]:
    """按日期范围查询计划列表，不传参数则返回全部。"""
    query = select(DailyPlan).options(selectinload(DailyPlan.items), selectinload(DailyPlan.review)).order_by(
        DailyPlan.plan_date.desc()
    )
    if start is not None:
        query = query.where(DailyPlan.plan_date >= start)
    if end is not None:
        query = query.where(DailyPlan.plan_date <= end)
    return list(db.scalars(query).all())
