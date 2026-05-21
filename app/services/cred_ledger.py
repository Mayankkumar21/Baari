"""Append-only ledger of issued credentials.

⚠ Stores PLAINTEXT passwords. For local MVP convenience only — the source of
truth for auth is still the bcrypt hash in `users.password_hash`.

File location:
  - Local dev:   <repo>/data/credentials.jsonl
  - Vercel:      /tmp/credentials.jsonl  (ephemeral, per-instance)

The directory `data/` is gitignored. Never commit this file or its contents.
If you need to revoke a credential, reset the password in the app and tear
this file down.
"""
from __future__ import annotations

import json
import os
from pathlib import Path

from app.time_utils import now_utc


def _ledger_path() -> Path:
    if os.environ.get("VERCEL"):
        return Path("/tmp/credentials.jsonl")
    return Path(__file__).resolve().parent.parent.parent / "data" / "credentials.jsonl"


def record_credential(
    *,
    clinic_id: int,
    user_id: int,
    name: str,
    mobile: str,
    role: str,
    password: str,
    event: str,
) -> None:
    """`event` is one of: signup | provisioned | reset."""
    record = {
        "ts": now_utc().isoformat(),
        "event": event,
        "clinic_id": clinic_id,
        "user_id": user_id,
        "name": name,
        "mobile": mobile,
        "role": role,
        "password": password,
    }
    path = _ledger_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as fp:
        fp.write(json.dumps(record, separators=(",", ":")) + "\n")
