# 健康检查端点：GET /health，前端用来判断后端是否在线
import os
from fastapi import APIRouter

from ..config import get_settings
from ..services import today_in_timezone

router = APIRouter(tags=["health"])


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/info")
def info() -> dict[str, str]:
    """返回运行时信息：数据目录路径（桌面端由 Tauri 注入 DC_DATA_DIR）。"""
    settings = get_settings()
    data_dir = os.environ.get("DC_DATA_DIR", "")
    db_path = settings.database_url.removeprefix("sqlite:///")
    return {
        "data_dir": data_dir,
        "timezone": settings.timezone,
        "today": today_in_timezone().isoformat(),
        "db_path": db_path,
    }
