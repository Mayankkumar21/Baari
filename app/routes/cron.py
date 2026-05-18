from fastapi import APIRouter, Depends

from app.deps import DbSession, require_cron_secret
from app.services.cron_jobs import run_tick

router = APIRouter(prefix="/api/cron")


@router.post("/tick")
@router.get("/tick")
def tick(db: DbSession, _: None = Depends(require_cron_secret)) -> dict:
    summary = run_tick(db)
    return {"ok": True, "summary": summary}
