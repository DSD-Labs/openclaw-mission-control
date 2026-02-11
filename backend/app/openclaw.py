from __future__ import annotations

from dataclasses import dataclass

import httpx

from .settings import settings


@dataclass
class OpenClawClient:
    base_url: str
    token: str

    @property
    def _tools_invoke_url(self) -> str:
        return self.base_url.rstrip("/") + "/tools/invoke"

    @property
    def _headers(self) -> dict[str, str]:
        return {
            "authorization": f"Bearer {self.token}",
            "content-type": "application/json",
        }

    async def invoke_tool(self, tool: str, args: dict, *, session_key: str | None = None) -> dict:
        payload: dict = {"tool": tool, "args": args}
        if session_key:
            payload["sessionKey"] = session_key

        async with httpx.AsyncClient(timeout=30) as client:
            res = await client.post(self._tools_invoke_url, headers=self._headers, json=payload)
            res.raise_for_status()
            data = res.json()
            if not isinstance(data, dict) or not data.get("ok"):
                raise RuntimeError(f"OpenClaw tools/invoke error: {data}")
            return data["result"]

    async def sessions_list(self, *, limit: int = 50) -> dict:
        return await self.invoke_tool("sessions_list", {"limit": limit})

    async def sessions_history(self, session_key: str, *, limit: int = 50, include_tools: bool = False) -> dict:
        return await self.invoke_tool(
            "sessions_history",
            {"sessionKey": session_key, "limit": limit, "includeTools": include_tools},
        )

    async def sessions_send(self, session_key: str, message: str) -> dict:
        return await self.invoke_tool("sessions_send", {"sessionKey": session_key, "message": message})

    async def sessions_spawn(self, task: str, *, label: str | None = None, agent_id: str | None = None) -> dict:
        args: dict = {"task": task}
        if label:
            args["label"] = label
        if agent_id:
            args["agentId"] = agent_id
        return await self.invoke_tool("sessions_spawn", args)

    async def message_send(self, *, channel: str, target: str, text: str, thread_id: str | None = None) -> dict:
        args: dict = {"action": "send", "channel": channel, "target": target, "message": text}
        if thread_id:
            args["threadId"] = thread_id
        return await self.invoke_tool("message", args)


def get_openclaw() -> OpenClawClient | None:
    if not settings.openclaw_gateway_url or not settings.openclaw_gateway_token:
        return None
    return OpenClawClient(settings.openclaw_gateway_url, settings.openclaw_gateway_token)
