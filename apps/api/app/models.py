# 数据库表结构（SQLAlchemy ORM）
# 核心关系：
#   DailyPlan → PlanItem（一对多，级联删除）
#   DailyPlan → DailyReview（一对一，一天只有一条复盘）
#   Habit → HabitLog（一对多，habit_id + log_date 唯一约束防重复打卡）
#   Reminder → ReminderDelivery（发送记录，reminder_id 可为空以支持手动发送）
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


class TimestampMixin:
    # 所有表共用的创建/更新时间字段，由数据库自动维护
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class DailyPlan(TimestampMixin, Base):
    __tablename__ = "daily_plans"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    plan_date: Mapped[date] = mapped_column(Date, unique=True, index=True)  # 每天只有一条计划
    focus: Mapped[str] = mapped_column(String(240), default="")
    energy_level: Mapped[int] = mapped_column(Integer, default=3)  # 1-5，主观精力值
    notes: Mapped[str] = mapped_column(Text, default="")

    items: Mapped[list["PlanItem"]] = relationship(
        back_populates="plan", cascade="all, delete-orphan", order_by="PlanItem.position"
    )
    review: Mapped["DailyReview | None"] = relationship(back_populates="plan", cascade="all, delete-orphan")


class PlanItem(TimestampMixin, Base):
    __tablename__ = "plan_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    plan_id: Mapped[int] = mapped_column(ForeignKey("daily_plans.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(240))
    category: Mapped[str] = mapped_column(String(80), default="work")
    priority: Mapped[int] = mapped_column(Integer, default=2)  # 1=低 2=中 3=高
    estimated_minutes: Mapped[int] = mapped_column(Integer, default=30)
    done: Mapped[bool] = mapped_column(Boolean, default=False)
    position: Mapped[int] = mapped_column(Integer, default=0)  # 前端排序顺序
    start_time: Mapped[str | None] = mapped_column(String(5), nullable=True)   # 任务开始时间 HH:MM
    end_time: Mapped[str | None] = mapped_column(String(5), nullable=True)     # 任务结束时间 HH:MM

    plan: Mapped[DailyPlan] = relationship(back_populates="items")


class DailyReview(TimestampMixin, Base):
    __tablename__ = "daily_reviews"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    plan_id: Mapped[int] = mapped_column(ForeignKey("daily_plans.id", ondelete="CASCADE"), unique=True)
    completed_summary: Mapped[str] = mapped_column(Text, default="")
    blockers: Mapped[str] = mapped_column(Text, default="")
    mood: Mapped[str] = mapped_column(String(80), default="")
    tomorrow_hint: Mapped[str] = mapped_column(Text, default="")

    plan: Mapped[DailyPlan] = relationship(back_populates="review")


class Habit(TimestampMixin, Base):
    __tablename__ = "habits"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(160), unique=True)
    description: Mapped[str] = mapped_column(Text, default="")
    schedule_type: Mapped[str] = mapped_column(String(40), default="daily")
    reminder_time: Mapped[str] = mapped_column(String(5), default="09:00")  # HH:MM 格式
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    emoji: Mapped[str] = mapped_column(String(8), default="✨")   # 用户自选 emoji
    position: Mapped[int] = mapped_column(Integer, default=0)     # 排序位置

    logs: Mapped[list["HabitLog"]] = relationship(back_populates="habit", cascade="all, delete-orphan")


class HabitLog(TimestampMixin, Base):
    __tablename__ = "habit_logs"
    # 每个习惯每天只能有一条记录，upsert 逻辑在 router 层实现
    __table_args__ = (UniqueConstraint("habit_id", "log_date", name="uq_habit_log_date"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    habit_id: Mapped[int] = mapped_column(ForeignKey("habits.id", ondelete="CASCADE"), index=True)
    log_date: Mapped[date] = mapped_column(Date, index=True)
    status: Mapped[str] = mapped_column(String(40), default="done")  # done / skip
    note: Mapped[str] = mapped_column(Text, default="")

    habit: Mapped[Habit] = relationship(back_populates="logs")


class Reminder(TimestampMixin, Base):
    __tablename__ = "reminders"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(180))
    message: Mapped[str] = mapped_column(Text)
    schedule_type: Mapped[str] = mapped_column(String(40), default="once")  # once / daily / workday / weekly
    scheduled_time: Mapped[str] = mapped_column(String(5), default="09:00")  # HH:MM
    next_run_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    target_type: Mapped[str] = mapped_column(String(40), default="general")
    target_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True)


class ReminderDelivery(TimestampMixin, Base):
    # 每次尝试发送的日志，无论成功失败都记录，方便排查 QQ bot 问题
    __tablename__ = "reminder_deliveries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    reminder_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    channel: Mapped[str] = mapped_column(String(40), default="qq")
    status: Mapped[str] = mapped_column(String(40), default="pending")  # sent / failed / simulated
    response: Mapped[str] = mapped_column(Text, default="")


class AiConversation(TimestampMixin, Base):
    # 存储每一轮对话的原始消息，用于 AI 上下文和历史查阅
    __tablename__ = "ai_conversations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    role: Mapped[str] = mapped_column(String(20))  # user / assistant
    content: Mapped[str] = mapped_column(Text)


class AiInsight(TimestampMixin, Base):
    # AI 生成的结构化洞察，按日期索引，类型区分（chat / daily-review）
    __tablename__ = "ai_insights"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    insight_type: Mapped[str] = mapped_column(String(60))
    target_date: Mapped[date | None] = mapped_column(Date, nullable=True, index=True)
    content: Mapped[str] = mapped_column(Text)


class MemoryDocument(TimestampMixin, Base):
    __tablename__ = "memory_documents"
    __table_args__ = (UniqueConstraint("source_type", "source_id", name="uq_memory_source"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    source_type: Mapped[str] = mapped_column(String(40), index=True)
    source_id: Mapped[int] = mapped_column(Integer, index=True)
    title: Mapped[str] = mapped_column(String(240), default="")
    content: Mapped[str] = mapped_column(Text, default="")
    target_date: Mapped[date | None] = mapped_column(Date, nullable=True, index=True)

    chunks: Mapped[list["MemoryChunk"]] = relationship(
        back_populates="document",
        cascade="all, delete-orphan",
        order_by="MemoryChunk.chunk_index",
    )


class MemoryChunk(TimestampMixin, Base):
    __tablename__ = "memory_chunks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    document_id: Mapped[int] = mapped_column(ForeignKey("memory_documents.id", ondelete="CASCADE"), index=True)
    chunk_index: Mapped[int] = mapped_column(Integer, default=0)
    content: Mapped[str] = mapped_column(Text, default="")
    token_count: Mapped[int] = mapped_column(Integer, default=0)
    embedding_json: Mapped[str] = mapped_column(Text, default="")

    document: Mapped[MemoryDocument] = relationship(back_populates="chunks")
