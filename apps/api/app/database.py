# 数据库连接管理：创建 SQLAlchemy 引擎和 Session 工厂，提供 FastAPI 依赖注入用的 get_db()
from collections.abc import Generator
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from .config import get_settings


class Base(DeclarativeBase):
    pass


def _connect_args(database_url: str) -> dict[str, object]:
    # SQLite 不支持多线程共享同一连接，关闭该检查让 FastAPI 的线程池正常工作
    if database_url.startswith("sqlite"):
        return {"check_same_thread": False}
    return {}


def _ensure_sqlite_dir(database_url: str) -> None:
    # 相对路径的 SQLite 文件（如 ./data/xxx.db）首次连接前父目录可能不存在
    if not database_url.startswith("sqlite:///"):
        return
    path = database_url.replace("sqlite:///", "", 1)
    if path != ":memory:":
        Path(path).parent.mkdir(parents=True, exist_ok=True)


import os as _os

settings = get_settings()

# 打包为桌面 .exe 时，Tauri 注入 DC_DATA_DIR 指向用户 AppData 目录
# 开发模式下不设置此变量，沿用 settings.database_url（相对路径）
_dc_data_dir = _os.environ.get("DC_DATA_DIR")
if _dc_data_dir:
    _db_file = Path(_dc_data_dir) / "plankiller.db"
    _db_file.parent.mkdir(parents=True, exist_ok=True)
    _effective_url = f"sqlite:///{_db_file}"
else:
    _effective_url = settings.database_url

_ensure_sqlite_dir(_effective_url)
engine = create_engine(_effective_url, connect_args=_connect_args(_effective_url))
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)


def init_db() -> None:
    from . import models  # noqa: F401 — 必须先 import models，Base 才能感知所有表定义
    Base.metadata.create_all(bind=engine)


def get_db() -> Generator[Session, None, None]:
    # FastAPI 依赖注入：每个请求分配一个独立 Session，请求结束后自动关闭
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
