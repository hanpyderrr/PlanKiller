import json
import math
import re
from datetime import date

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from .config import get_settings
from .models import AiInsight, DailyPlan, DailyReview, HabitLog, MemoryChunk, MemoryDocument
from .schemas import MemoryHit

MAX_CHUNK_CHARS = 1000
MAX_HIT_CONTENT_CHARS = 500


def _line(label: str, value: object) -> str:
    text = str(value or "").strip()
    return f"{label}{text}" if text else ""


def _token_count(text: str) -> int:
    return len([part for part in re.split(r"\s+", text.strip()) if part])


def _serialize_embedding(values: list[float]) -> str:
    return json.dumps(values, separators=(",", ":")) if values else ""


def _deserialize_embedding(raw: str) -> list[float]:
    if not raw.strip():
        return []
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        return []
    if not isinstance(parsed, list):
        return []
    return [float(item) for item in parsed if isinstance(item, (int, float))]


def _cosine_similarity(left: list[float], right: list[float]) -> float:
    if not left or not right or len(left) != len(right):
        return 0.0
    left_norm = math.sqrt(sum(value * value for value in left))
    right_norm = math.sqrt(sum(value * value for value in right))
    if not left_norm or not right_norm:
        return 0.0
    return sum(l_value * r_value for l_value, r_value in zip(left, right)) / (left_norm * right_norm)


def _chunk_text(content: str, max_chars: int = MAX_CHUNK_CHARS) -> list[str]:
    text = content.strip()
    if not text:
        return []
    if len(text) <= max_chars:
        return [text]
    chunks = []
    start = 0
    while start < len(text):
        chunks.append(text[start : start + max_chars].strip())
        start += max_chars
    return [chunk for chunk in chunks if chunk]


def _render_plan(plan: DailyPlan) -> tuple[str, str, date | None]:
    title = f"{plan.plan_date.isoformat()} 每日计划"
    lines = [
        f"日期：{plan.plan_date.isoformat()}",
        "类型：每日计划",
        _line("今日焦点：", plan.focus),
        f"精力：{plan.energy_level}/5",
        _line("备注：", plan.notes),
        "任务：",
    ]
    for item in plan.items:
        state = "完成" if item.done else "未完成"
        time_text = ""
        if item.start_time or item.end_time:
            time_text = f"，时间 {item.start_time or ''}-{item.end_time or ''}"
        lines.append(
            f"- [{state}] {item.title}（{item.category}，优先级 {item.priority}，预计 {item.estimated_minutes} 分钟{time_text}）"
        )
    return title, "\n".join(line for line in lines if line), plan.plan_date


def _render_review(review: DailyReview) -> tuple[str, str, date | None]:
    plan_date = review.plan.plan_date if review.plan else None
    date_text = plan_date.isoformat() if plan_date else "未标日期"
    title = f"{date_text} 每日复盘"
    lines = [
        f"日期：{date_text}",
        "类型：每日复盘",
        _line("完成：", review.completed_summary),
        _line("阻碍：", review.blockers),
        _line("心情：", review.mood),
        _line("明日提示：", review.tomorrow_hint),
    ]
    return title, "\n".join(line for line in lines if line), plan_date


def _render_habit_log(log: HabitLog) -> tuple[str, str, date | None]:
    habit_name = log.habit.name if log.habit else f"habit-{log.habit_id}"
    title = f"{log.log_date.isoformat()} 习惯打卡：{habit_name}"
    lines = [
        f"日期：{log.log_date.isoformat()}",
        "类型：习惯打卡",
        f"习惯：{habit_name}",
        f"状态：{log.status}",
        _line("备注：", log.note),
    ]
    return title, "\n".join(line for line in lines if line), log.log_date


def _render_ai_insight(insight: AiInsight) -> tuple[str, str, date | None]:
    date_text = insight.target_date.isoformat() if insight.target_date else "未标日期"
    title = f"{date_text} AI 洞察：{insight.insight_type}"
    lines = [
        f"日期：{date_text}",
        "类型：AI 洞察",
        f"洞察类型：{insight.insight_type}",
        _line("内容：", insight.content),
    ]
    return title, "\n".join(line for line in lines if line), insight.target_date


def _can_embed() -> bool:
    settings = get_settings()
    return bool(settings.rag_enabled and settings.openai_api_key and settings.openai_embedding_model)


def _embed_texts(texts: list[str]) -> list[list[float]]:
    settings = get_settings()
    if not texts or not _can_embed():
        return [[] for _ in texts]
    payload = {"model": settings.openai_embedding_model, "input": texts}
    try:
        with httpx.Client(timeout=60) as client:
            response = client.post(
                "https://api.openai.com/v1/embeddings",
                headers={"Authorization": f"Bearer {settings.openai_api_key}"},
                json=payload,
            )
            response.raise_for_status()
            data = response.json().get("data", [])
    except Exception:
        return [[] for _ in texts]
    embeddings = []
    for item in data:
        embedding = item.get("embedding", [])
        if isinstance(embedding, list):
            embeddings.append([float(value) for value in embedding if isinstance(value, (int, float))])
    return embeddings if len(embeddings) == len(texts) else [[] for _ in texts]


def _add_document(
    db: Session,
    source_type: str,
    source_id: int,
    title: str,
    content: str,
    target_date: date | None,
) -> int:
    chunks = _chunk_text(content)
    embeddings = _embed_texts(chunks)
    document = MemoryDocument(
        source_type=source_type,
        source_id=source_id,
        title=title,
        content=content,
        target_date=target_date,
    )
    for index, chunk_content in enumerate(chunks):
        document.chunks.append(
            MemoryChunk(
                chunk_index=index,
                content=chunk_content,
                token_count=_token_count(chunk_content),
                embedding_json=_serialize_embedding(embeddings[index] if index < len(embeddings) else []),
            )
        )
    db.add(document)
    return len(document.chunks)


def _replace_chunks(document: MemoryDocument, content: str) -> None:
    document.chunks.clear()
    chunks = _chunk_text(content)
    embeddings = _embed_texts(chunks)
    for index, chunk_content in enumerate(chunks):
        document.chunks.append(
            MemoryChunk(
                chunk_index=index,
                content=chunk_content,
                token_count=_token_count(chunk_content),
                embedding_json=_serialize_embedding(embeddings[index] if index < len(embeddings) else []),
            )
        )


def reindex_memory(db: Session) -> dict[str, int]:
    auto_docs = db.scalars(select(MemoryDocument).where(MemoryDocument.source_type != "manual")).all()
    for document in auto_docs:
        db.delete(document)
    db.flush()

    document_count = 0
    chunk_count = 0

    for plan in db.scalars(select(DailyPlan).options(selectinload(DailyPlan.items)).order_by(DailyPlan.plan_date)):
        title, content, target_date = _render_plan(plan)
        chunk_count += _add_document(db, "daily_plan", plan.id, title, content, target_date)
        document_count += 1

    for review in db.scalars(select(DailyReview).options(selectinload(DailyReview.plan)).order_by(DailyReview.id)):
        title, content, target_date = _render_review(review)
        chunk_count += _add_document(db, "daily_review", review.id, title, content, target_date)
        document_count += 1

    for log in db.scalars(select(HabitLog).options(selectinload(HabitLog.habit)).order_by(HabitLog.log_date, HabitLog.id)):
        title, content, target_date = _render_habit_log(log)
        chunk_count += _add_document(db, "habit_log", log.id, title, content, target_date)
        document_count += 1

    for insight in db.scalars(select(AiInsight).order_by(AiInsight.id)):
        title, content, target_date = _render_ai_insight(insight)
        chunk_count += _add_document(db, "ai_insight", insight.id, title, content, target_date)
        document_count += 1

    db.commit()
    return {"documents": document_count, "chunks": chunk_count}


def create_manual_memory(db: Session, title: str, content: str, target_date: date | None = None) -> MemoryDocument:
    document = MemoryDocument(source_type="manual", source_id=0, title=title.strip(), content=content.strip(), target_date=target_date)
    _replace_chunks(document, document.content)
    db.add(document)
    db.flush()
    document.source_id = document.id
    db.commit()
    db.refresh(document)
    return document


def list_manual_memories(db: Session) -> list[MemoryDocument]:
    return list(
        db.scalars(select(MemoryDocument).where(MemoryDocument.source_type == "manual").order_by(MemoryDocument.id.desc())).all()
    )


def update_manual_memory(
    db: Session,
    memory_id: int,
    title: str | None = None,
    content: str | None = None,
    target_date: date | None = None,
    clear_target_date: bool = False,
) -> MemoryDocument | None:
    document = db.get(MemoryDocument, memory_id)
    if document is None or document.source_type != "manual":
        return None
    if title is not None:
        document.title = title.strip()
    if content is not None:
        document.content = content.strip()
        _replace_chunks(document, document.content)
    if clear_target_date:
        document.target_date = None
    elif target_date is not None:
        document.target_date = target_date
    db.commit()
    db.refresh(document)
    return document


def delete_manual_memory(db: Session, memory_id: int) -> bool:
    document = db.get(MemoryDocument, memory_id)
    if document is None or document.source_type != "manual":
        return False
    db.delete(document)
    db.commit()
    return True


def _normalize(text: str) -> str:
    return " ".join(text.lower().strip().split())


def _terms(query: str) -> list[str]:
    normalized = _normalize(query)
    terms = set(re.findall(r"[\w-]+", normalized, flags=re.UNICODE))
    compact = re.sub(r"\s+", "", normalized)
    if 2 <= len(compact) <= 24:
        terms.add(compact)
    if len(compact) > 6 and any(ord(char) > 127 for char in compact):
        for size in (2, 3, 4, 5, 6):
            for start in range(0, len(compact) - size + 1):
                terms.add(compact[start : start + size])
    return [term for term in terms if term]


def _score(query: str, title: str, content: str) -> float:
    normalized_query = _normalize(query)
    normalized_title = _normalize(title)
    normalized_content = _normalize(content)
    if not normalized_query:
        return 0.0
    score = 0.0
    if normalized_query in normalized_title:
        score += 8
    if normalized_query in normalized_content:
        score += 5
    for term in _terms(query):
        weight = 50 if len(term) >= 12 else 1
        score += normalized_title.count(term) * 2 * weight
        score += normalized_content.count(term) * weight
    return score


def _hybrid_score(query: str, chunk: MemoryChunk, query_embedding: list[float]) -> float:
    keyword_score = _score(query, chunk.document.title, chunk.content)
    chunk_embedding = _deserialize_embedding(chunk.embedding_json)
    if not query_embedding or not chunk_embedding:
        return keyword_score
    semantic_score = max(_cosine_similarity(query_embedding, chunk_embedding), 0.0)
    return keyword_score + (semantic_score * 100)


def _shorten(text: str) -> str:
    text = text.strip()
    if len(text) <= MAX_HIT_CONTENT_CHARS:
        return text
    return text[: MAX_HIT_CONTENT_CHARS - 1].rstrip() + "..."


def search_memory(db: Session, query: str, top_k: int = 5) -> list[MemoryHit]:
    settings = get_settings()
    limit = max(1, min(top_k or settings.rag_top_k, 20))
    rows = db.scalars(select(MemoryChunk).options(selectinload(MemoryChunk.document)).order_by(MemoryChunk.id.desc())).all()
    query_embedding = _embed_texts([query])[0] if _can_embed() else []

    scored: list[tuple[float, MemoryChunk]] = []
    for chunk in rows:
        score = _hybrid_score(query, chunk, query_embedding)
        if score > 0:
            scored.append((score, chunk))

    scored.sort(key=lambda item: (item[0], item[1].document.target_date or date.min, item[1].id), reverse=True)
    hits = []
    for score, chunk in scored[:limit]:
        document = chunk.document
        hits.append(
            MemoryHit(
                document_id=document.id,
                chunk_id=chunk.id,
                source_type=document.source_type,
                source_id=document.source_id,
                title=document.title,
                content=_shorten(chunk.content),
                score=score,
                target_date=document.target_date,
            )
        )
    return hits
