from pathlib import Path

from fastapi import Request
from fastapi.templating import Jinja2Templates

from app.i18n import COOKIE_NAME as LANG_COOKIE
from app.i18n import normalize_lang
from app.i18n import t as _t
from app.time_utils import fmt_datetime, fmt_time, to_clinic_tz

TEMPLATES_DIR = Path(__file__).parent / "templates"


def _i18n_processor(request: Request) -> dict:
    lang = normalize_lang(request.cookies.get(LANG_COOKIE))
    return {
        "lang": lang,
        "t": lambda key: _t(key, lang),
    }


templates = Jinja2Templates(
    directory=str(TEMPLATES_DIR),
    context_processors=[_i18n_processor],
)
templates.env.filters["fmt_time"] = fmt_time
templates.env.filters["fmt_datetime"] = fmt_datetime
templates.env.filters["clinic_tz"] = to_clinic_tz
