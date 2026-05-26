import hashlib
import hmac
import re

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..config import get_settings
from ..database import get_db
from ..memory import search_memory
from ..routers.reminders import parse_reply
from ..schemas import AiChatRequest, AiResponse
from ..services import ask_openai, get_plan_summary, save_ai_exchange, save_reminder_reply_memory, send_qq_message

router = APIRouter(prefix="/qq", tags=["qq"])


def _sign_challenge(event_token: str, plain_token: str) -> str:
    settings = get_settings()
    key = settings.qq_bot_secret.encode()
    msg = (event_token + plain_token).encode()
    return hmac.new(key, msg, hashlib.sha256).hexdigest()


@router.post("/send-test")
async def send_test(payload: dict[str, str]) -> dict[str, str]:
    status, response = await send_qq_message(payload.get("message", "PlanKiller test"))
    return {"status": status, "response": response}


@router.post("/webhook")
async def qq_webhook(payload: dict[str, object], db: Session = Depends(get_db)) -> dict[str, object]:
    if payload.get("op") == 13:
        d = payload.get("d") or {}
        plain_token = str(d.get("plain_token", "") if isinstance(d, dict) else "")
        event_token = str(d.get("event_token", "") if isinstance(d, dict) else "")
        return {"plain_token": plain_token, "signature": _sign_challenge(event_token, plain_token)}

    event_type = str(payload.get("type") or payload.get("t") or "")
    raw = payload.get("d") or payload
    data: dict[str, object] = raw if isinstance(raw, dict) else payload

    openid = ""
    text = str(payload.get("text") or "")
    if not text and event_type in ("C2C_MESSAGE_CREATE", "DIRECT_MESSAGE_CREATE"):
        author = data.get("author") or {}
        if isinstance(author, dict):
            openid = str(author.get("user_openid") or author.get("id") or "")
        text = re.sub(r"<@!\d+>\s*", "", str(data.get("content") or "")).strip()
    elif not text and event_type in ("GROUP_AT_MESSAGE_CREATE", "AT_MESSAGE_CREATE"):
        author = data.get("author") or {}
        if isinstance(author, dict):
            openid = str(author.get("member_openid") or author.get("id") or "")
        text = re.sub(r"<@!\d+>\s*", "", str(data.get("content") or "")).strip()
    elif not text:
        return {"handled": False, "type": event_type}

    parsed = parse_reply(text)
    if parsed["action"] != "chat":
        save_reminder_reply_memory(db, text, parsed)
        return {"handled": True, "parsed": parsed, "sender_openid": openid}

    context = get_plan_summary(db)
    memory_hits = search_memory(db, text, top_k=get_settings().rag_top_k)
    content, provider = await ask_openai(text, context, memory_hits)
    save_ai_exchange(db, text, content)
    return {"handled": True, "parsed": parsed, "reply": content, "provider": provider, "sender_openid": openid}


@router.post("/chat", response_model=AiResponse)
async def qq_chat(payload: AiChatRequest, db: Session = Depends(get_db)) -> AiResponse:
    context = get_plan_summary(db)
    memory_hits = search_memory(db, payload.message, top_k=get_settings().rag_top_k)
    content, provider = await ask_openai(payload.message, context, memory_hits)
    save_ai_exchange(db, payload.message, content)
    return AiResponse(content=content, used_provider=provider, memory_hits=memory_hits)
