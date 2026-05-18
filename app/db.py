from collections.abc import Iterator

from sqlalchemy import create_engine
from sqlmodel import Session

from app.config import get_settings

_settings = get_settings()

engine = create_engine(
    _settings.database_url,
    pool_pre_ping=True,
    pool_size=1,
    max_overflow=2,
    pool_recycle=300,
)


def get_session() -> Iterator[Session]:
    with Session(engine) as session:
        yield session
