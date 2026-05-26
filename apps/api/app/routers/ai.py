from datetime import date, timedelta

from fastapi import APIRouter, Depends, Header
from sqlalchemy.orm import Session

from ..config import get_settings
from ..database import get_db
from ..memory import search_memory
from ..schemas import AiChatRequest, AiResponse, ReportSummary
from ..services import ask_openai, compute_report, get_plan_summary, save_ai_exchange, save_weekly_insight, today_in_timezone

router = APIRouter(prefix="/ai", tags=["ai"])


@router.post("/chat", response_model=AiResponse)
async def chat(
    payload: AiChatRequest,
    db: Session = Depends(get_db),
    x_ai_key: str = Header(default="", alias="X-AI-Key"),
) -> AiResponse:
    context = get_plan_summary(db)
    memory_hits = search_memory(db, payload.message, top_k=get_settings().rag_top_k)
    content, provider = await ask_openai(payload.message, context, memory_hits, x_ai_key)
    save_ai_exchange(db, payload.message, content)
    return AiResponse(content=content, used_provider=provider, memory_hits=memory_hits)


@router.post("/daily-review/{target_date}", response_model=AiResponse)
async def daily_review(
    target_date: date,
    db: Session = Depends(get_db),
    x_ai_key: str = Header(default="", alias="X-AI-Key"),
) -> AiResponse:
    context = get_plan_summary(db)
    message = f"请分析 {target_date.isoformat()} 的计划完成情况，给出短总结和明天建议。"
    content, provider = await ask_openai(message, context, None, x_ai_key)
    save_ai_exchange(db, message, content, insight_type="daily-review")
    return AiResponse(content=content, used_provider=provider)


@router.get("/reports/weekly", response_model=ReportSummary)
def weekly_report(db: Session = Depends(get_db)) -> dict[str, object]:
    end = today_in_timezone()
    start = end - timedelta(days=6)
    return compute_report(db, start, end)


@router.post("/insights/weekly", response_model=AiResponse)
def weekly_insight(db: Session = Depends(get_db)) -> AiResponse:
    end = today_in_timezone()
    start = end - timedelta(days=6)
    report = compute_report(db, start, end)
    content = (
        f"{start.isoformat()} 到 {end.isoformat()} 周洞察："
        f"{report['narrative']} "
        f"计划完成率 {round(float(report['plan_completion_rate']) * 100)}%，"
        f"习惯坚持率 {round(float(report['habit_completion_rate']) * 100)}%。"
    )
    save_weekly_insight(db, content, end)
    return AiResponse(content=content, used_provider="local-patterns", memory_hits=[])
