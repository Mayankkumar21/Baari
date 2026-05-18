from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles

from app.deps import AuthRequired
from app.routes import (
    auth,
    booking,
    cron,
    queue,
    reports,
    search,
    setup as setup_routes,
    settings as settings_routes,
)

STATIC_DIR = Path(__file__).parent.parent / "static"

app = FastAPI(title="Baari — ClinicQueue", docs_url=None, redoc_url=None, openapi_url=None)

app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

app.include_router(auth.router)
app.include_router(queue.router)
app.include_router(booking.router)
app.include_router(search.router)
app.include_router(reports.router)
app.include_router(setup_routes.router)
app.include_router(settings_routes.router)
app.include_router(cron.router)


@app.exception_handler(AuthRequired)
async def _redirect_to_login(request: Request, exc: AuthRequired) -> RedirectResponse:
    next_url = request.url.path
    target = "/login" if next_url in ("/", "/login") else f"/login?next={next_url}"
    return RedirectResponse(url=target, status_code=303)


@app.get("/")
def root() -> RedirectResponse:
    return RedirectResponse(url="/queue", status_code=302)


@app.get("/healthz")
def healthz() -> dict[str, str]:
    return {"status": "ok"}
