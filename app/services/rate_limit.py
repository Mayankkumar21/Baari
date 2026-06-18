"""Fixed-window DB-backed rate limiter.

Why DB-backed: Vercel serverless functions start cold and don't share memory across
invocations, so in-process counters are useless. A tiny `rate_limit_buckets` table
gives us a shared store. Buckets are GC'd by cron_jobs.run_tick.

The limiter ALWAYS fails open on DB error — if the table is unreachable, we let
the request through and log. Rate-limiting is defense-in-depth; locking users out
because of an infra hiccup is worse than the attack we're defending against.

The bucket key looks like 'signup:1.2.3.4:5840' where the trailing int is
`epoch_seconds // window_seconds`. There is no read-modify-write race window
that lets a single client exceed the limit: every request increments via an
atomic UPSERT and reads back the post-increment count.
"""
from __future__ import annotations

import logging
from datetime import timedelta

from sqlalchemy.dialects.postgresql import insert
from sqlmodel import Session, delete, select

from app.models import RateLimitBucket
from app.time_utils import now_utc

logger = logging.getLogger(__name__)

# (max_count, window_seconds)
SIGNUP_LIMIT = (5, 3600)        # 5 signups per IP per hour
LOGIN_LIMIT = (10, 900)         # 10 login attempts per mobile per 15 min


def _bucket_key(scope: str, window_seconds: int) -> str:
    return f"{scope}:{int(now_utc().timestamp()) // window_seconds}"


def check_and_increment(
    db: Session, *, key: str, max_count: int, window_seconds: int
) -> bool:
    """Returns True if the request is allowed (under the limit), False if the
    limit has been hit. Fails open on any exception."""
    bucket_key = _bucket_key(key, window_seconds)
    try:
        table = RateLimitBucket.__table__
        stmt = (
            insert(table)
            .values(bucket_key=bucket_key, count=1, created_at=now_utc().replace(tzinfo=None))
            .on_conflict_do_update(
                index_elements=["bucket_key"],
                set_={"count": table.c.count + 1},
            )
            .returning(table.c.count)
        )
        result = db.exec(stmt)
        row = result.first()
        db.commit()
        if row is None:
            return True
        # row is a Row tuple — first element is the count
        try:
            current = row[0]
        except (TypeError, KeyError):
            current = int(row)
        return int(current) <= max_count
    except Exception as e:
        try:
            db.rollback()
        except Exception:
            pass
        logger.warning("rate-limit DB error for %s; failing open: %s", key, e)
        return True


def allow_signup(db: Session, *, ip: str) -> bool:
    max_count, window = SIGNUP_LIMIT
    return check_and_increment(db, key=f"signup:{ip}", max_count=max_count, window_seconds=window)


def allow_login(db: Session, *, mobile: str) -> bool:
    max_count, window = LOGIN_LIMIT
    return check_and_increment(db, key=f"login:{mobile}", max_count=max_count, window_seconds=window)


def gc_old_buckets(db: Session, *, older_than_seconds: int = 7200) -> int:
    """Delete buckets older than `older_than_seconds`. Called by cron_jobs.run_tick.
    Two windows-worth of retention is enough; anything older can't be relevant."""
    cutoff = now_utc().replace(tzinfo=None) - timedelta(seconds=older_than_seconds)
    try:
        result = db.exec(
            delete(RateLimitBucket).where(RateLimitBucket.created_at < cutoff)
        )
        return getattr(result, "rowcount", 0) or 0
    except Exception as e:
        logger.warning("rate-limit GC failed: %s", e)
        try:
            db.rollback()
        except Exception:
            pass
        return 0
