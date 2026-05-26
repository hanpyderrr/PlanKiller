import asyncio
import logging

from .database import SessionLocal, init_db
from .services import dispatch_due_reminders

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("plankiller-worker")


async def run_forever() -> None:
    init_db()
    logger.info("Reminder worker started")
    while True:
        with SessionLocal() as db:
            sent = await dispatch_due_reminders(db)
            if sent:
                logger.info("Dispatched %s reminder(s)", sent)
        await asyncio.sleep(30)


if __name__ == "__main__":
    asyncio.run(run_forever())
