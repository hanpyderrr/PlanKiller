# HTTP 请求/响应的数据校验模型（Pydantic）
# 命名规则：xxxCreate = 写入时的入参，xxxRead = 返回给前端的出参，xxxUpdate = 局部更新
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field


class PlanItemCreate(BaseModel):
    id: int | None = None
    title: str = Field(min_length=1, max_length=240)
    category: str = "work"
    priority: int = Field(default=2, ge=1, le=3)
    estimated_minutes: int = Field(default=30, ge=1, le=600)
    start_time: str | None = None
    end_time: str | None = None


class PlanItemRead(PlanItemCreate):
    id: int
    done: bool
    position: int

    model_config = {"from_attributes": True}


class PlanItemUpdate(BaseModel):
    title: str | None = None
    category: str | None = None
    priority: int | None = Field(default=None, ge=1, le=3)
    estimated_minutes: int | None = Field(default=None, ge=1, le=600)
    done: bool | None = None


class DailyReviewCreate(BaseModel):
    completed_summary: str = ""
    blockers: str = ""
    mood: str = ""
    tomorrow_hint: str = ""


class DailyReviewRead(DailyReviewCreate):
    id: int

    model_config = {"from_attributes": True}


class DailyPlanCreate(BaseModel):
    plan_date: date
    focus: str = ""
    energy_level: int = Field(default=3, ge=1, le=5)
    notes: str = ""
    items: list[PlanItemCreate] = Field(default_factory=list)


class DailyPlanRead(BaseModel):
    id: int
    plan_date: date
    focus: str
    energy_level: int
    notes: str
    items: list[PlanItemRead]
    review: DailyReviewRead | None = None

    model_config = {"from_attributes": True}


class HabitCreate(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    description: str = ""
    schedule_type: Literal["daily", "workday", "weekly"] = "daily"
    reminder_time: str = "09:00"
    active: bool = True
    emoji: str = "✨"
    position: int = 0
    schedule_days: str = "0,1,2,3,4,5,6"


class HabitRead(HabitCreate):
    id: int
    today_status: str | None = None  # 当天打卡状态（done/skip），由 router 注入
    week_done_count: int = 0          # 本周已完成次数，由 router 注入
    is_scheduled_today: bool = True   # 当天是否在计划日内，由 router 注入

    model_config = {"from_attributes": True}


class HabitUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=160)
    description: str | None = None
    schedule_type: Literal["daily", "workday", "weekly"] | None = None
    reminder_time: str | None = None
    active: bool | None = None
    emoji: str | None = None
    position: int | None = None
    schedule_days: str | None = None


class HabitReorderItem(BaseModel):
    id: int
    position: int


class HabitReorderRequest(BaseModel):
    habits: list[HabitReorderItem]


class HabitLogCreate(BaseModel):
    log_date: date
    status: Literal["done", "skip"] = "done"
    note: str = ""


class HabitLogRead(HabitLogCreate):
    id: int
    habit_id: int

    model_config = {"from_attributes": True}


class ReminderCreate(BaseModel):
    title: str
    message: str
    schedule_type: Literal["once", "daily", "workday", "weekly"] = "once"
    scheduled_time: str = Field(default="09:00", pattern=r"^\d{2}:\d{2}$")
    next_run_at: datetime | None = None
    target_type: str = "general"
    target_id: int | None = None
    active: bool = True


class ReminderRead(ReminderCreate):
    id: int

    model_config = {"from_attributes": True}


class AiChatRequest(BaseModel):
    message: str = Field(min_length=1)


class MemoryHit(BaseModel):
    document_id: int
    chunk_id: int
    source_type: str
    source_id: int
    title: str
    content: str
    score: float
    target_date: date | None = None


class MemorySearchResponse(BaseModel):
    query: str
    hits: list[MemoryHit]


class MemoryReindexResponse(BaseModel):
    documents: int
    chunks: int


class ManualMemoryCreate(BaseModel):
    title: str = Field(min_length=1, max_length=240)
    content: str = Field(min_length=1)
    target_date: date | None = None


class ManualMemoryUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=240)
    content: str | None = Field(default=None, min_length=1)
    target_date: date | None = None


class ManualMemoryRead(BaseModel):
    id: int
    source_type: str
    source_id: int
    title: str
    content: str
    target_date: date | None = None


class AiResponse(BaseModel):
    content: str
    used_provider: str  # "openai" 或 "local-fallback"
    memory_hits: list[MemoryHit] = Field(default_factory=list)


class ReportSummary(BaseModel):
    start_date: date
    end_date: date
    plan_completion_rate: float
    habit_completion_rate: float
    total_plan_items: int
    completed_plan_items: int
    habit_logs: int
    repeated_blockers: list[str] = Field(default_factory=list)
    skipped_habits: list[str] = Field(default_factory=list)
    unfinished_categories: list[str] = Field(default_factory=list)
    energy_completion_notes: list[str] = Field(default_factory=list)
    narrative: str = ""
