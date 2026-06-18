"""Cloudflare Turnstile verification.

If both TURNSTILE_SITE_KEY and TURNSTILE_SECRET_KEY env vars are set, the widget
is rendered on auth pages and the server verifies tokens on submit. If either is
empty, verification is skipped (returns True) so dev/preview deploys keep working
without Cloudflare configured. This mirrors the MSG91 dev-mode pattern.
"""
from __future__ import annotations

import logging

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)

VERIFY_ENDPOINT = "https://challenges.cloudflare.com/turnstile/v0/siteverify"


def is_enabled() -> bool:
    s = get_settings()
    return bool(s.turnstile_site_key and s.turnstile_secret_key)


def site_key() -> str:
    return get_settings().turnstile_site_key


def verify(token: str | None, *, remote_ip: str | None = None) -> bool:
    """Returns True if the token verifies, OR if Turnstile is disabled.
    Fails CLOSED — a configured-but-failing verification is treated as bot-like."""
    if not is_enabled():
        return True
    if not token:
        return False
    data = {"secret": get_settings().turnstile_secret_key, "response": token}
    if remote_ip:
        data["remoteip"] = remote_ip
    try:
        with httpx.Client(timeout=6.0) as client:
            r = client.post(VERIFY_ENDPOINT, data=data)
        if r.status_code != 200:
            logger.warning("turnstile non-200: %s %s", r.status_code, r.text[:200])
            return False
        body = r.json()
        return bool(body.get("success"))
    except httpx.RequestError as e:
        logger.warning("turnstile transport error; failing closed: %s", e)
        return False
