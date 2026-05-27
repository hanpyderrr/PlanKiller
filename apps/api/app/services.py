import time
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

import httpx
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from .config import get_settings
from .memory import sync_insight_memory
from .models import AiConversation, AiInsight, DailyPlan, Habit, HabitLog, Reminder, ReminderDelivery
from .schemas import MemoryHit


def today_in_timezone() -> date:
    return datetime.now(ZoneInfo(get_settings().timezone)).date()


def get_plan_summary(db: Session, days: int = 7) -> dict[str, object]:
    today = today_in_timezone()
    start = today - timedelta(days=days - 1)
    plans = db.scalars(
        select(DailyPlan)
        .where(DailyPlan.plan_date >= start, DailyPlan.plan_date <= today)
        .options(selectinload(DailyPlan.items), selectinload(DailyPlan.review))
        .order_by(DailyPlan.plan_date)
    ).all()
    habits = db.scalars(select(Habit).where(Habit.active.is_(True)).order_by(Habit.position, Habit.name)).all()
    logs = db.scalars(select(HabitLog).where(HabitLog.log_date >= start, HabitLog.log_date <= today)).all()
    return {
        "date_range": {"start": start.isoformat(), "end": today.isoformat()},
        "plans": [
            {
                "date": plan.plan_date.isoformat(),
                "focus": plan.focus,
                "items": [{"title": item.title, "done": item.done, "category": item.category} for item in plan.items],
                "review": plan.review.completed_summary if plan.review else "",
                "blockers": plan.review.blockers if plan.review else "",
            }
            for plan in plans
        ],
        "habits": [{"id": habit.id, "name": habit.name, "time": habit.reminder_time} for habit in habits],
        "habit_logs": [{"habit_id": log.habit_id, "date": log.log_date.isoformat(), "status": log.status} for log in logs],
    }


def build_local_ai_reply(message: str, context: dict[str, object], memory_hits: list[MemoryHit] | None = None) -> str:
    plan_count = len(context.get("plans", []))
    habit_log_count = len(context.get("habit_logs", []))
    memory_count = len(memory_hits or [])
    lower = message.lower()
    medical_terms = ("药", "用药", "疾病", "胸痛", "发烧", "诊断", "medicine", "diagnose")
    if any(term in lower for term in medical_terms):
        return "这个问题可能涉及医疗判断，我不能替代医生。可以先记录症状和作息变化，必要时尽快咨询专业医生。"
    return (
        f"我看了你最近 {plan_count} 天的计划、{habit_log_count} 条习惯记录，"
        f"以及 {memory_count} 条相关长期记忆。"
        "先别把今天定义成失败，我们把下一步缩小到一个能完成的动作："
        "选一件最重要的小任务，设 25 分钟专注；如果是运动或冥想，先做 5 分钟也算开始。"
        f"你刚才说的是：{message}"
    )


def _format_memory_hits(memory_hits: list[MemoryHit] | None) -> str:
    if not memory_hits:
        return "无相关长期记忆。"
    lines = []
    for index, hit in enumerate(memory_hits, start=1):
        date_text = hit.target_date.isoformat() if hit.target_date else "未标日期"
        lines.append(f"{index}. [{date_text}][{hit.source_type}] {hit.title}\n{hit.content}")
    return "\n".join(lines)


async def ask_ai(
    message: str,
    context: dict[str, object],
    memory_hits: list[MemoryHit] | None = None,
    override_api_key: str = "",
) -> tuple[str, str]:
    settings = get_settings()
    if override_api_key:
        api_key = override_api_key
        base_url = settings.openai_base_url
        model = settings.openai_model
        provider = "openai-user-key"
    elif settings.deepseek_api_key:
        api_key = settings.deepseek_api_key
        base_url = "https://api.deepseek.com"
        model = settings.deepseek_model
        provider = "deepseek"
    elif settings.openai_api_key:
        api_key = settings.openai_api_key
        base_url = settings.openai_base_url
        model = settings.openai_model
        provider = "openai"
    else:
        return build_local_ai_reply(message, context, memory_hits), "local-fallback"

    prompt = (
        "你是一个朋友式陪伴监督机器人。你温和、具体、有轻度督促感。"
        "只基于给定计划、习惯数据和相关长期记忆回答，不编造不存在的记录。"
        "如果记忆不足以支持结论，要明确说明这是推测。"
        "健康建议只限作息、运动、冥想、饮水和屏幕时间，不做诊断或用药建议。"
    )
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": prompt},
            {
                "role": "user",
                "content": (
                    f"近期数据：{context}\n\n"
                    f"相关长期记忆：\n{_format_memory_hits(memory_hits)}\n\n"
                    f"用户问题：{message}"
                ),
            },
        ],
    }
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(
                f"{base_url}/v1/chat/completions",
                headers={"Authorization": f"Bearer {api_key}"},
                json=payload,
            )
            response.raise_for_status()
            data = response.json()
        return data["choices"][0]["message"]["content"].strip(), provider
    except Exception as exc:
        return f"AI 服务暂时不可用，我先给你一个本地建议：{build_local_ai_reply(message, context, memory_hits)}（原因：{exc}）", "local-fallback"


ask_openai = ask_ai


_qq_token: str = ""
_qq_token_expires_at: float = 0.0


async def _get_qq_access_token(app_id: str, secret: str) -> str:
    global _qq_token, _qq_token_expires_at
    if _qq_token and time.time() < _qq_token_expires_at - 60:
        return _qq_token
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.post(
            "https://bots.qq.com/app/getAppAccessToken",
            json={"appId": app_id, "clientSecret": secret},
        )
        response.raise_for_status()
        data = response.json()
    _qq_token = data["access_token"]
    _qq_token_expires_at = time.time() + int(data.get("expires_in", 7200))
    return _qq_token


async def send_qq_message(message: str) -> tuple[str, str]:
    settings = get_settings()
    if not settings.qq_bot_enabled:
        return "simulated", f"QQ disabled; would send: {message}"
    if not settings.qq_bot_app_id or not settings.qq_bot_secret or not settings.qq_bot_target_id:
        return "failed", "QQ bot is enabled but missing QQ_BOT_APP_ID, QQ_BOT_SECRET, or QQ_BOT_TARGET_ID"
    try:
        token = await _get_qq_access_token(settings.qq_bot_app_id, settings.qq_bot_secret)
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.post(
                f"https://bots.qq.com/v2/users/{settings.qq_bot_target_id}/messages",
                headers={"Authorization": f"QQBot {token}"},
                json={"content": message, "msg_type": 0},
            )
            response.raise_for_status()
            data = response.json()
        return "sent", str(data)
    except httpx.HTTPStatusError as exc:
        return "failed", f"HTTP {exc.response.status_code}: {exc.response.text}"
    except Exception as exc:
        return "failed", str(exc)


def build_reminder_context(db: Session, reminder: Reminder) -> dict[str, object]:
    today = today_in_timezone()
    plan = db.scalar(
        select(DailyPlan)
        .where(DailyPlan.plan_date == today)
        .options(selectinload(DailyPlan.items), selectinload(DailyPlan.review))
    )
    context: dict[str, object] = {
        "today_focus": plan.focus if plan else "",
        "unfinished_high_priority": [item.title for item in (plan.items if plan else []) if not item.done and item.priority == 3],
        "recent_blocker": plan.review.blockers if plan and plan.review else "",
    }
    if reminder.target_type == "habit" and reminder.target_id is not None:
        habit = db.get(Habit, reminder.target_id)
        start = today - timedelta(days=6)
        logs = db.scalars(
            select(HabitLog)
            .where(HabitLog.habit_id == reminder.target_id, HabitLog.log_date >= start, HabitLog.log_date <= today)
            .order_by(HabitLog.log_date)
        ).all()
        context.update(
            {
                "habit_name": habit.name if habit else "",
                "habit_done_count": sum(1 for log in logs if log.status == "done"),
                "habit_skip_count": sum(1 for log in logs if log.status == "skip"),
            }
        )
    return context


def build_contextual_reminder_message(db: Session, reminder: Reminder) -> str:
    context = build_reminder_context(db, reminder)
    lines = [f"现在提醒：{reminder.message}"]
    habit_name = str(context.get("habit_name") or "")
    if habit_name:
        lines.append(f"关联习惯：{habit_name}")
        lines.append(f"最近 7 天完成 {context.get('habit_done_count', 0)} 次，最近 7 天跳过 {context.get('habit_skip_count', 0)} 次。")
    unfinished = context.get("unfinished_high_priority") or []
    if isinstance(unfinished, list) and unfinished:
        lines.append("今天优先任务：" + "、".join(str(item) for item in unfinished[:3]))
    blocker = str(context.get("recent_blocker") or "")
    if blocker:
        lines.append(f"今天复盘阻碍：{blocker}")
    lines.append("先做一个小动作就算开始。")
    return "\n".join(lines)


def mark_reminder_delivered(db: Session, reminder_id: int | None, status: str, response: str) -> ReminderDelivery:
    delivery = ReminderDelivery(reminder_id=reminder_id, status=status, response=response)
    db.add(delivery)
    db.commit()
    db.refresh(delivery)
    return delivery


def next_run_after(reminder: Reminder, after: datetime | None = None) -> datetime | None:
    settings = get_settings()
    tz = ZoneInfo(settings.timezone)
    now = after or datetime.now(tz)
    hour, minute = [int(part) for part in reminder.scheduled_time.split(":", 1)]
    candidate = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
    if reminder.schedule_type == "once":
        return None
    if reminder.schedule_type == "daily":
        return candidate + timedelta(days=1 if candidate <= now else 0)
    if reminder.schedule_type == "workday":
        candidate = candidate + timedelta(days=1 if candidate <= now else 0)
        while candidate.weekday() >= 5:
            candidate += timedelta(days=1)
        return candidate
    if reminder.schedule_type == "weekly":
        return candidate + timedelta(days=7 if candidate <= now else 0)
    return None


async def dispatch_due_reminders(db: Session, now: datetime | None = None) -> int:
    settings = get_settings()
    tz = ZoneInfo(settings.timezone)
    current = now or datetime.now(tz)
    reminders = db.scalars(
        select(Reminder).where(Reminder.active.is_(True), Reminder.next_run_at.is_not(None), Reminder.next_run_at <= current)
    ).all()
    count = 0
    for reminder in reminders:
        message = build_contextual_reminder_message(db, reminder)
        status, response = await send_qq_message(message)
        mark_reminder_delivered(db, reminder.id, status, response)
        reminder.next_run_at = next_run_after(reminder, current)
        if reminder.schedule_type == "once":
            reminder.active = False
        count += 1
    db.commit()
    return count


def _completion_label(rate: float) -> str:
    return "%d%%" % round(rate * 100)


def compute_patterns(db: Session, start: date, end: date) -> dict[str, list[str] | str]:
    plans = db.scalars(
        select(DailyPlan)
        .where(DailyPlan.plan_date >= start, DailyPlan.plan_date <= end)
        .options(selectinload(DailyPlan.items), selectinload(DailyPlan.review))
        .order_by(DailyPlan.plan_date)
    ).all()
    habit_logs = db.scalars(
        select(HabitLog)
        .where(HabitLog.log_date >= start, HabitLog.log_date <= end)
        .options(selectinload(HabitLog.habit))
        .order_by(HabitLog.log_date)
    ).all()

    blocker_counts: dict[str, int] = {}
    recent_blockers: list[str] = []
    for plan in plans:
        blocker = (plan.review.blockers if plan.review else "").strip()
        if blocker:
            blocker_counts[blocker] = blocker_counts.get(blocker, 0) + 1
            if blocker not in recent_blockers:
                recent_blockers.append(blocker)
    repeated_blockers = [
        blocker for blocker, count in sorted(blocker_counts.items(), key=lambda item: (-item[1], item[0])) if count >= 2
    ]

    skipped_counts: dict[str, int] = {}
    for log in habit_logs:
        if log.status != "skip":
            continue
        name = log.habit.name if log.habit else f"habit-{log.habit_id}"
        skipped_counts[name] = skipped_counts.get(name, 0) + 1
    skipped_habits = [
        f"{name} skipped {count} times"
        for name, count in sorted(skipped_counts.items(), key=lambda item: (-item[1], item[0]))
        if count >= 1
    ]

    unfinished_counts: dict[str, int] = {}
    for plan in plans:
        for item in plan.items:
            if not item.done:
                unfinished_counts[item.category] = unfinished_counts.get(item.category, 0) + 1
    unfinished_categories = [
        f"{category}: {count} unfinished"
        for category, count in sorted(unfinished_counts.items(), key=lambda item: (-item[1], item[0]))
        if count >= 1
    ]

    low_energy_rates = []
    high_energy_rates = []
    for plan in plans:
        total = len(plan.items)
        if total == 0:
            continue
        rate = sum(1 for item in plan.items if item.done) / total
        if plan.energy_level <= 2:
            low_energy_rates.append(rate)
        elif plan.energy_level >= 4:
            high_energy_rates.append(rate)
    energy_completion_notes = []
    if low_energy_rates:
        energy_completion_notes.append(f"低能量日平均完成率 {_completion_label(sum(low_energy_rates) / len(low_energy_rates))}")
    if high_energy_rates:
        energy_completion_notes.append(f"高能量日平均完成率 {_completion_label(sum(high_energy_rates) / len(high_energy_rates))}")

    narrative_parts = []
    if repeated_blockers:
        narrative_parts.append("重复阻碍：" + "、".join(repeated_blockers[:3]))
    if recent_blockers:
        narrative_parts.append("近期阻碍：" + "、".join(recent_blockers[-3:]))
    if skipped_habits:
        narrative_parts.append("习惯中断：" + "、".join(skipped_habits[:3]))
    if unfinished_categories:
        narrative_parts.append("未完成集中在：" + "、".join(unfinished_categories[:3]))
    if energy_completion_notes:
        narrative_parts.append("能量关联：" + "、".join(energy_completion_notes))
    return {
        "repeated_blockers": repeated_blockers,
        "skipped_habits": skipped_habits,
        "unfinished_categories": unfinished_categories,
        "energy_completion_notes": energy_completion_notes,
        "narrative": "。".join(narrative_parts) if narrative_parts else "本周暂时没有明显的重复模式。",
    }


def compute_report(db: Session, start: date, end: date) -> dict[str, object]:
    plans = db.scalars(
        select(DailyPlan)
        .where(DailyPlan.plan_date >= start, DailyPlan.plan_date <= end)
        .options(selectinload(DailyPlan.items))
    ).all()
    total_items = sum(len(plan.items) for plan in plans)
    completed_items = sum(1 for plan in plans for item in plan.items if item.done)
    active_habits_list = db.scalars(select(Habit).where(Habit.active.is_(True))).all()
    habit_logs = (
        db.scalar(
            select(func.count(HabitLog.id)).where(
                HabitLog.log_date >= start,
                HabitLog.log_date <= end,
                HabitLog.status == "done",
            )
        )
        or 0
    )
    habit_possible = 0
    for habit in active_habits_list:
        scheduled = {int(d) for d in (habit.schedule_days or "0,1,2,3,4,5,6").split(",") if d.strip().isdigit()}
        for offset in range((end - start).days + 1):
            if (start + timedelta(days=offset)).weekday() in scheduled:
                habit_possible += 1
    patterns = compute_patterns(db, start, end)
    return {
        "start_date": start,
        "end_date": end,
        "plan_completion_rate": completed_items / total_items if total_items else 0,
        "habit_completion_rate": habit_logs / habit_possible if habit_possible else 0,
        "total_plan_items": total_items,
        "completed_plan_items": completed_items,
        "habit_logs": habit_logs,
        **patterns,
    }


def seed_default_reminders(db: Session) -> None:
    settings = get_settings()
    tz = ZoneInfo(settings.timezone)
    now = datetime.now(tz)
    defaults = [
        ("今日计划提醒", "早上好！是时候写下今天的计划了，请打开 PlanKiller 安排一天的重点。", "08:30", "workday"),
        ("下班复盘提醒", "该复盘啦！请打开 PlanKiller 记录今天完成了什么、遇到了什么阻碍。", "18:30", "workday"),
    ]
    added = False
    for title, message, scheduled_time, schedule_type in defaults:
        if db.scalar(select(Reminder).where(Reminder.title == title)) is not None:
            continue
        hour, minute = [int(part) for part in scheduled_time.split(":")]
        candidate = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
        if candidate <= now:
            candidate += timedelta(days=1)
        while candidate.weekday() >= 5:
            candidate += timedelta(days=1)
        db.add(Reminder(title=title, message=message, scheduled_time=scheduled_time, schedule_type=schedule_type, next_run_at=candidate, active=True))
        added = True
    if added:
        db.commit()


def save_ai_exchange(db: Session, user_message: str, assistant_message: str, insight_type: str = "chat") -> None:
    db.add(AiConversation(role="user", content=user_message))
    db.add(AiConversation(role="assistant", content=assistant_message))
    db.add(AiInsight(insight_type=insight_type, target_date=today_in_timezone(), content=assistant_message))
    db.commit()


def save_weekly_insight(db: Session, content: str, target: date | None = None) -> AiInsight:
    insight = AiInsight(insight_type="weekly", target_date=target or today_in_timezone(), content=content)
    db.add(insight)
    db.commit()
    db.refresh(insight)
    sync_insight_memory(db, insight)
    return insight


def save_reminder_reply_memory(db: Session, raw_text: str, parsed: dict[str, object]) -> AiInsight:
    action = str(parsed.get("action", "unknown"))
    reason = str(parsed.get("reason", "")).strip()
    content = f"提醒反馈：{action}"
    if reason:
        content += f"\n原因：{reason}"
    content += f"\n原始回复：{raw_text}"
    insight = AiInsight(insight_type="reminder-reply", target_date=today_in_timezone(), content=content)
    db.add(insight)
    db.commit()
    db.refresh(insight)
    sync_insight_memory(db, insight)
    return insight
