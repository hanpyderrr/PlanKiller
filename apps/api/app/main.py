# 应用入口：创建 FastAPI 实例，挂载所有路由，启动时建表并写入默认提醒
import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from .database import SessionLocal, engine, init_db
from .routers import ai, habits, health, memory, plans, qq, reminders
from .services import seed_default_reminders
from .worker import reminder_loop


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 启动时：建表 → 插入默认提醒（幂等，已存在则跳过）
    init_db()
    # 迁移：planned_time → start_time，新增 end_time（已执行过则静默跳过）
    with engine.connect() as _conn:
        try:
            _conn.execute(text("ALTER TABLE plan_items RENAME COLUMN planned_time TO start_time"))
            _conn.commit()
        except Exception:
            pass  # 已重命名或列不存在（新安装）
        try:
            _conn.execute(text("ALTER TABLE plan_items ADD COLUMN start_time VARCHAR(5)"))
            _conn.commit()
        except Exception:
            pass  # 列已存在
        try:
            _conn.execute(text("ALTER TABLE plan_items ADD COLUMN end_time VARCHAR(5)"))
            _conn.commit()
        except Exception:
            pass  # 列已存在
        try:
            _conn.execute(text("ALTER TABLE habits ADD COLUMN emoji VARCHAR(8) DEFAULT '✨'"))
            _conn.commit()
        except Exception:
            pass
        try:
            _conn.execute(text("ALTER TABLE habits ADD COLUMN position INTEGER DEFAULT 0"))
            _conn.commit()
        except Exception:
            pass
        try:
            _conn.execute(text("ALTER TABLE habits ADD COLUMN times_per_week INTEGER NOT NULL DEFAULT 7"))
            _conn.commit()
        except Exception:
            pass
        try:
            _conn.execute(text("ALTER TABLE habits ADD COLUMN schedule_days VARCHAR(20) DEFAULT '0,1,2,3,4,5,6'"))
            _conn.commit()
        except Exception:
            pass
    with SessionLocal() as db:
        seed_default_reminders(db)
    import os as _os
    _worker_task = None
    if not _os.environ.get("DISABLE_EMBEDDED_WORKER"):
        _worker_task = asyncio.create_task(reminder_loop())
    yield
    if _worker_task is not None:
        _worker_task.cancel()
        await asyncio.gather(_worker_task, return_exceptions=True)


app = FastAPI(title="PlanKiller API", version="0.1.0", lifespan=lifespan)

# 开发期允许所有来源跨域；正式部署后应缩小到具体域名
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(plans.router)
app.include_router(habits.router)
app.include_router(reminders.router)
app.include_router(ai.router)
app.include_router(qq.router)
app.include_router(memory.router)
