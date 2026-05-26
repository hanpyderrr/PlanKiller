from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..memory import (
    create_manual_memory,
    delete_manual_memory,
    list_manual_memories,
    reindex_memory,
    search_memory,
    update_manual_memory,
)
from ..schemas import ManualMemoryCreate, ManualMemoryRead, ManualMemoryUpdate, MemoryReindexResponse, MemorySearchResponse

router = APIRouter(prefix="/memory", tags=["memory"])


@router.post("/reindex", response_model=MemoryReindexResponse)
def reindex(db: Session = Depends(get_db)) -> dict[str, int]:
    return reindex_memory(db)


@router.get("/search", response_model=MemorySearchResponse)
def search(
    q: str = Query(min_length=1),
    top_k: int = Query(default=5, ge=1, le=20),
    db: Session = Depends(get_db),
) -> MemorySearchResponse:
    return MemorySearchResponse(query=q, hits=search_memory(db, q, top_k=top_k))


@router.post("/manual", response_model=ManualMemoryRead)
def create_manual(payload: ManualMemoryCreate, db: Session = Depends(get_db)):
    return create_manual_memory(db, payload.title, payload.content, payload.target_date)


@router.get("/manual", response_model=list[ManualMemoryRead])
def list_manual(db: Session = Depends(get_db)):
    return list_manual_memories(db)


@router.patch("/manual/{memory_id}", response_model=ManualMemoryRead)
def update_manual(memory_id: int, payload: ManualMemoryUpdate, db: Session = Depends(get_db)):
    clear_target = "target_date" in payload.model_fields_set and payload.target_date is None
    document = update_manual_memory(
        db,
        memory_id,
        title=payload.title,
        content=payload.content,
        target_date=payload.target_date,
        clear_target_date=clear_target,
    )
    if document is None:
        raise HTTPException(status_code=404, detail="Manual memory not found")
    return document


@router.delete("/manual/{memory_id}")
def delete_manual(memory_id: int, db: Session = Depends(get_db)) -> dict[str, bool]:
    if not delete_manual_memory(db, memory_id):
        raise HTTPException(status_code=404, detail="Manual memory not found")
    return {"deleted": True}
