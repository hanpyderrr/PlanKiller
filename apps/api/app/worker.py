import asyncio
import logging

from .database import SessionLocal, init_db
from .services import dispatch_due_reminders

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("plankiller-worker")


async def reminder_loop() -> None:
    """Reminder dispatch loop — runs as a background asyncio task inside FastAPI lifespan."""
    logger.info("Reminder worker started")
    while True:
        try:
            with SessionLocal() as db:
                sent = await dispatch_due_reminders(db)
                if sent:
                    logger.info("Dispatched %s reminder(s)", sent)
        except Exception:
            logger.exception("reminder dispatch error")
        await asyncio.sleep(30)


async def run_forever() -> None:
    init_db()
    await reminder_loop()


if __name__ == "__main__":
    asyncio.run(run_forever())
