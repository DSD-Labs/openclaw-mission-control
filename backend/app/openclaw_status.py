from __future__ import annotations

from dataclasses import asdict, dataclass

import httpx

from .openclaw import OpenClawClient, get_openclaw
from .settings import settings


@dataclass
class OpenClawStatus:
    configured: bool
    gateway_url: str | None

    reachable: bool
    auth_ok: bool
    tool_invoke_ok: bool

    error: str | None


async def probe_openclaw() -> OpenClawStatus:
    oc = get_openclaw()
    if not oc:
        return OpenClawStatus(
            configured=False,
            gateway_url=settings.openclaw_gateway_url,
            reachable=False,
            auth_ok=False,
            tool_invoke_ok=False,
            error="OPENCLAW_GATEWAY_URL/TOKEN not configured",
        )

    # 1) reachability: try /health if present
    base = oc.base_url.rstrip("/")
    health_url = base + "/health"

    reachable = False
    auth_ok = False
    tool_invoke_ok = False
    err: str | None = None

    try:
        async with httpx.AsyncClient(timeout=3) as client:
            r = await client.get(health_url)
            reachable = r.status_code < 500
    except Exception:
        reachable = False

    # 2) auth/tool policy: try a safe tool invoke
    try:
        # session_status is safe and should be allowlisted in most setups.
        res = await oc.invoke_tool("session_status", {})
        _ = res
        auth_ok = True
        tool_invoke_ok = True
    except httpx.HTTPStatusError as e:
        # 401/403 indicates auth issues; 404 can mean tool not allowlisted
        status = e.response.status_code
        if status in (401, 403):
            err = f"Auth failed (HTTP {status})"
        elif status == 404:
            err = "Tool not available (session_status not allowlisted)"
            auth_ok = True  # token accepted but policy blocked
        else:
            err = f"HTTP error {status}: {e.response.text[:200]}"
    except Exception as e:
        err = str(e)

    return OpenClawStatus(
        configured=True,
        gateway_url=settings.openclaw_gateway_url,
        reachable=reachable,
        auth_ok=auth_ok,
        tool_invoke_ok=tool_invoke_ok,
        error=err,
    )


def status_dict(st: OpenClawStatus) -> dict:
    return asdict(st)
