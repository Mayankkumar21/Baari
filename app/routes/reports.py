from datetime import date

from fastapi import APIRouter, HTTPException, Request

from app.deps import DbSession, DoctorUser
from app.services.reports_service import day_detail, list_recent_days
from app.templating import templates

router = APIRouter()


@router.get("/reports")
def reports_index(request: Request, db: DbSession, user: DoctorUser):
    days = list_recent_days(db, user.clinic_id)
    return templates.TemplateResponse(
        request,
        "pages/reports.html",
        {"active": "reports", "current_user": user, "days": days},
    )


@router.get("/reports/{day:str}")
def reports_day(request: Request, db: DbSession, user: DoctorUser, day: str):
    try:
        on = date.fromisoformat(day)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date")
    vm = day_detail(db, user.clinic_id, on)
    if not vm:
        raise HTTPException(status_code=404, detail="No report for this day")
    return templates.TemplateResponse(
        request,
        "pages/reports_day.html",
        {"active": "reports", "current_user": user, "vm": vm},
    )
