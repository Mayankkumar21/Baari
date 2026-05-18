from datetime import UTC, date, datetime
from zoneinfo import ZoneInfo

from app.config import get_settings

_TZ = ZoneInfo(get_settings().clinic_tz)


def now_utc() -> datetime:
    return datetime.now(UTC)


def to_clinic_tz(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=UTC)
    return dt.astimezone(_TZ)


def clinic_today() -> date:
    return to_clinic_tz(now_utc()).date()


def fmt_time(dt: datetime) -> str:
    return to_clinic_tz(dt).strftime("%H:%M")


def fmt_datetime(dt: datetime) -> str:
    return to_clinic_tz(dt).strftime("%d %b %Y, %H:%M")
