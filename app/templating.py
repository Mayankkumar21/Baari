from pathlib import Path

from fastapi import Request
from fastapi.templating import Jinja2Templates

from app.i18n import COOKIE_NAME as LANG_COOKIE
from app.i18n import normalize_lang
from app.i18n import t as _t
from app.time_utils import fmt_datetime, fmt_time, to_clinic_tz
from app.vocab import vocab_for

TEMPLATES_DIR = Path(__file__).parent / "templates"

THEME_COOKIE = "baari_theme"
_VALID_THEMES = {"light", "dark"}


def normalize_theme(value: str | None) -> str:
    """Returns 'light' / 'dark' if explicitly set, '' otherwise (=> follow OS)."""
    return value if value in _VALID_THEMES else ""


def _i18n_processor(request: Request) -> dict:
    lang = normalize_lang(request.cookies.get(LANG_COOKIE))
    return {
        "lang": lang,
        "t": lambda key: _t(key, lang),
    }


def _vocab_processor(request: Request) -> dict:
    tenant_type = request.scope.get("tenant_type")
    return {"vocab": vocab_for(tenant_type)}


def _theme_processor(request: Request) -> dict:
    """Inject the resolved theme override (or empty for OS-auto) into every template."""
    return {"theme": normalize_theme(request.cookies.get(THEME_COOKIE))}


templates = Jinja2Templates(
    directory=str(TEMPLATES_DIR),
    context_processors=[_i18n_processor, _vocab_processor, _theme_processor],
)
templates.env.filters["fmt_time"] = fmt_time
templates.env.filters["fmt_datetime"] = fmt_datetime
templates.env.filters["clinic_tz"] = to_clinic_tz
