import json
from uuid import uuid4

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from .crypto import CryptoError, encrypt_token
from .db import engine, get_db
from .models import (
    Agent,
    AgentWorkState,
    AuditEvent,
    Base,
    Conversation,
    ConversationType,
    Gateway,
    Task,
    Turn,
    WarRoomRun,
    Workspace,
)
from .openclaw import get_openclaw
from .openclaw_status import probe_openclaw, status_dict
from .schemas import (
    AgentCreate,
    AgentOut,
    AgentWorkStateUpsert,
    AuditEventOut,
    ConversationCreate,
    ConversationOut,
    GatewayCreate,
    GatewayOut,
    TaskCreate,
    TaskOut,
    TurnCreate,
    TurnOut,
    WarRoomRunOut,
    WorkspaceCreate,
    WorkspaceOut,
)
from .settings import settings

Base.metadata.create_all(bind=engine)

app = FastAPI(title="OpenClaw Mission Control API", version="0.0.1")


def _require_api_key(x_mc_api_key: str | None = Header(default=None)):
    if settings.mission_control_api_key:
        if not x_mc_api_key or x_mc_api_key != settings.mission_control_api_key:
            raise HTTPException(status_code=401, detail="Invalid API key")


def _require_role(allowed: set[str]):
    def _dep(actor_role: tuple[str, str] = Depends(_actor_from_headers)):
        role = (actor_role[1] or "operator").lower()
        if role not in {r.lower() for r in allowed}:
            raise HTTPException(status_code=403, detail=f"Role '{role}' not permitted")
        return actor_role

    return _dep


def _actor_from_headers(
    x_mc_user: str | None = Header(default=None),
    x_mc_role: str | None = Header(default=None),
) -> tuple[str, str]:
    actor = x_mc_user or "unknown"
    role = x_mc_role or "operator"
    return actor, role


def _workspace_from_header(x_mc_workspace: str | None = Header(default=None)) -> str | None:
    return x_mc_workspace


def _audit(
    db: Session,
    *,
    actor: str,
    role: str,
    workspace_id: str | None,
    action: str,
    entity_type: str,
    entity_id: str | None,
    payload: dict,
):
    db.add(
        AuditEvent(
            id=str(uuid4()),
            workspace_id=workspace_id,
            actor=actor,
            role=role,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            payload=payload,
        )
    )


origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"ok": True}


@app.get("/api/openclaw/status")
async def openclaw_status():
    st = await probe_openclaw()
    return status_dict(st)


# --- Gateways / Workspaces (v0) ---


@app.get("/api/gateways", response_model=list[GatewayOut])
def list_gateways(db: Session = Depends(get_db)):
    return db.query(Gateway).order_by(Gateway.created_at.desc()).all()


@app.post(
    "/api/gateways",
    response_model=GatewayOut,
    dependencies=[Depends(_require_api_key), Depends(_require_role({"admin"}))],
)
def create_gateway(
    body: GatewayCreate,
    db: Session = Depends(get_db),
    actor_role: tuple[str, str] = Depends(_actor_from_headers),
):
    try:
        token_enc = encrypt_token(body.token)
    except CryptoError as e:
        raise HTTPException(status_code=400, detail=str(e))

    gw = Gateway(
        id=str(uuid4()),
        name=body.name,
        url=body.url,
        token=token_enc,
        enabled=body.enabled,
    )
    db.add(gw)
    _audit(
        db,
        actor=actor_role[0],
        role=actor_role[1],
        workspace_id=None,
        action="gateway.create",
        entity_type="gateway",
        entity_id=gw.id,
        payload={"name": gw.name, "url": gw.url, "enabled": gw.enabled},
    )
    db.commit()
    db.refresh(gw)
    return gw


@app.get("/api/workspaces", response_model=list[WorkspaceOut])
def list_workspaces(db: Session = Depends(get_db)):
    return db.query(Workspace).order_by(Workspace.created_at.desc()).all()


@app.post(
    "/api/workspaces",
    response_model=WorkspaceOut,
    dependencies=[Depends(_require_api_key), Depends(_require_role({"admin"}))],
)
def create_workspace(
    body: WorkspaceCreate,
    db: Session = Depends(get_db),
    actor_role: tuple[str, str] = Depends(_actor_from_headers),
):
    ws = Workspace(id=str(uuid4()), name=body.name, gateway_id=body.gateway_id)
    db.add(ws)
    _audit(
        db,
        actor=actor_role[0],
        role=actor_role[1],
        workspace_id=ws.id,
        action="workspace.create",
        entity_type="workspace",
        entity_id=ws.id,
        payload={"name": ws.name, "gateway_id": ws.gateway_id},
    )
    db.commit()
    db.refresh(ws)
    return ws


# --- Agents ---


@app.get("/api/agents", response_model=list[AgentOut])
def list_agents(
    db: Session = Depends(get_db),
    workspace_id: str | None = Depends(_workspace_from_header),
):
    q = db.query(Agent)
    if workspace_id:
        q = q.filter(Agent.workspace_id == workspace_id)
    agents = q.order_by(Agent.updated_at.desc()).all()
    for a in agents:
        _ = a.work_state
    return agents


@app.post(
    "/api/agents",
    response_model=AgentOut,
    dependencies=[Depends(_require_api_key), Depends(_require_role({"admin", "operator"}))],
)
def create_agent(
    body: AgentCreate,
    db: Session = Depends(get_db),
    actor_role: tuple[str, str] = Depends(_actor_from_headers),
    workspace_id: str | None = Depends(_workspace_from_header),
):
    agent = Agent(
        id=str(uuid4()),
        workspace_id=workspace_id,
        name=body.name,
        role=body.role,
        soul_md=body.soul_md,
        model=body.model,
        openclaw_agent_id=body.openclaw_agent_id,
        enabled=body.enabled,
        skills_allow=body.skills_allow,
        execution_policy=body.execution_policy.model_dump(),
        constraints=body.constraints.model_dump(),
        output_contract=body.output_contract.model_dump(),
    )
    db.add(agent)
    _audit(
        db,
        actor=actor_role[0],
        role=actor_role[1],
        workspace_id=workspace_id,
        action="agent.create",
        entity_type="agent",
        entity_id=agent.id,
        payload={"name": agent.name, "role": agent.role},
    )
    db.commit()
    db.refresh(agent)
    return agent


@app.get("/api/agents/{agent_id}", response_model=AgentOut)
def get_agent(agent_id: str, db: Session = Depends(get_db)):
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    return agent


@app.patch(
    "/api/agents/{agent_id}",
    response_model=AgentOut,
    dependencies=[Depends(_require_api_key), Depends(_require_role({"admin", "operator"}))],
)
def update_agent(
    agent_id: str,
    body: dict,
    db: Session = Depends(get_db),
    actor_role: tuple[str, str] = Depends(_actor_from_headers),
    workspace_id: str | None = Depends(_workspace_from_header),
):
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    for field in ["name", "role", "soul_md", "model", "openclaw_agent_id", "enabled", "skills_allow"]:
        if field in body:
            setattr(agent, field, body[field])

    for field in ["execution_policy", "constraints", "output_contract"]:
        if field in body:
            setattr(agent, field, body[field])

    db.add(agent)
    _audit(
        db,
        actor=actor_role[0],
        role=actor_role[1],
        workspace_id=workspace_id,
        action="agent.update",
        entity_type="agent",
        entity_id=agent.id,
        payload=body,
    )
    db.commit()
    db.refresh(agent)
    return agent


# --- Work state ---


@app.post(
    "/api/agent-work-state",
    response_model=dict,
    dependencies=[Depends(_require_api_key), Depends(_require_role({"admin", "operator"}))],
)
def upsert_agent_work_state(
    body: AgentWorkStateUpsert,
    db: Session = Depends(get_db),
    actor_role: tuple[str, str] = Depends(_actor_from_headers),
):
    state = db.query(AgentWorkState).filter(AgentWorkState.agent_id == body.agent_id).first()
    if not state:
        state = AgentWorkState(agent_id=body.agent_id)

    state.task_id = body.task_id
    state.status = body.status
    state.next_step = body.next_step
    state.blockers = body.blockers

    db.add(state)
    _audit(
        db,
        actor=actor_role[0],
        role=actor_role[1],
        action="agent_work_state.upsert",
        entity_type="agent_work_state",
        entity_id=body.agent_id,
        payload=body.model_dump(),
    )
    db.commit()
    return {"ok": True}


# --- Tasks ---


@app.get("/api/tasks", response_model=list[TaskOut])
def list_tasks(
    db: Session = Depends(get_db),
    workspace_id: str | None = Depends(_workspace_from_header),
):
    q = db.query(Task)
    if workspace_id:
        q = q.filter(Task.workspace_id == workspace_id)
    return q.order_by(Task.status.asc(), Task.sort_order.asc(), Task.priority.desc(), Task.updated_at.desc()).all()


@app.post(
    "/api/tasks",
    response_model=TaskOut,
    dependencies=[Depends(_require_api_key), Depends(_require_role({"admin", "operator"}))],
)
def create_task(
    body: TaskCreate,
    db: Session = Depends(get_db),
    actor_role: tuple[str, str] = Depends(_actor_from_headers),
    workspace_id: str | None = Depends(_workspace_from_header),
):
    task = Task(
        id=str(uuid4()),
        workspace_id=workspace_id,
        title=body.title,
        description=body.description,
        status=body.status,
        priority=body.priority,
        sort_order=body.sort_order,
        owner_agent_id=body.owner_agent_id,
    )
    db.add(task)
    _audit(
        db,
        actor=actor_role[0],
        role=actor_role[1],
        workspace_id=workspace_id,
        action="task.create",
        entity_type="task",
        entity_id=task.id,
        payload={"title": task.title, "status": str(task.status), "priority": task.priority},
    )
    db.commit()
    db.refresh(task)
    return task


@app.get("/api/tasks/{task_id}", response_model=TaskOut)
def get_task(task_id: str, db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@app.get("/api/tasks/{task_id}/conversation", response_model=ConversationOut)
def get_or_create_task_conversation(
    task_id: str,
    db: Session = Depends(get_db),
    workspace_id: str | None = Depends(_workspace_from_header),
):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    convo = db.query(Conversation).filter(Conversation.task_id == task_id).first()
    if not convo:
        convo = Conversation(
            id=str(uuid4()),
            workspace_id=workspace_id,
            type=ConversationType.TASK,
            task_id=task_id,
        )
        db.add(convo)
        db.commit()
        db.refresh(convo)

    turns = (
        db.query(Turn)
        .filter(Turn.conversation_id == convo.id)
        .order_by(Turn.created_at.asc())
        .all()
    )
    return ConversationOut(id=convo.id, type=convo.type, task_id=convo.task_id, turns=turns)


@app.patch(
    "/api/tasks/{task_id}",
    response_model=TaskOut,
    dependencies=[Depends(_require_api_key), Depends(_require_role({"admin", "operator"}))],
)
def update_task(
    task_id: str,
    body: dict,
    db: Session = Depends(get_db),
    actor_role: tuple[str, str] = Depends(_actor_from_headers),
    workspace_id: str | None = Depends(_workspace_from_header),
):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    for field in ["title", "description", "status", "priority", "sort_order", "owner_agent_id"]:
        if field in body:
            setattr(task, field, body[field])

    db.add(task)
    _audit(
        db,
        actor=actor_role[0],
        role=actor_role[1],
        workspace_id=workspace_id,
        action="task.update",
        entity_type="task",
        entity_id=task.id,
        payload=body,
    )
    db.commit()
    db.refresh(task)
    return task


# --- Conversations ---


@app.post("/api/conversations")
def create_conversation(body: ConversationCreate, db: Session = Depends(get_db)):
    convo = Conversation(id=str(uuid4()), type=body.type, task_id=body.task_id)
    db.add(convo)
    db.commit()
    db.refresh(convo)
    return convo


@app.get("/api/conversations/{conversation_id}", response_model=ConversationOut)
def get_conversation(conversation_id: str, db: Session = Depends(get_db)):
    convo = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if not convo:
        return None  # type: ignore[return-value]

    turns = (
        db.query(Turn)
        .filter(Turn.conversation_id == conversation_id)
        .order_by(Turn.created_at.asc())
        .all()
    )

    return ConversationOut(id=convo.id, type=convo.type, task_id=convo.task_id, turns=turns)


@app.post("/api/conversations/{conversation_id}/turns", response_model=TurnOut)
def add_turn(conversation_id: str, body: TurnCreate, db: Session = Depends(get_db)):
    turn = Turn(
        id=str(uuid4()),
        conversation_id=conversation_id,
        speaker_type=body.speaker_type,
        speaker_id=body.speaker_id,
        content=body.content,
        tool_events=body.tool_events,
    )
    db.add(turn)
    db.commit()
    db.refresh(turn)
    return turn


# --- Audit ---


@app.get("/api/audit", response_model=list[AuditEventOut])
def list_audit(
    db: Session = Depends(get_db),
    limit: int = 200,
    workspace_id: str | None = Depends(_workspace_from_header),
):
    q = db.query(AuditEvent)
    if workspace_id:
        q = q.filter(AuditEvent.workspace_id == workspace_id)
    return q.order_by(AuditEvent.created_at.desc()).limit(min(limit, 500)).all()


@app.get("/api/war-room/runs", response_model=list[WarRoomRunOut])
def list_war_room_runs(
    db: Session = Depends(get_db),
    limit: int = 50,
    workspace_id: str | None = Depends(_workspace_from_header),
):
    q = db.query(WarRoomRun)
    if workspace_id:
        q = q.filter(WarRoomRun.workspace_id == workspace_id)
    return q.order_by(WarRoomRun.created_at.desc()).limit(min(limit, 200)).all()


@app.get("/api/war-room/runs/{run_id}", response_model=WarRoomRunOut)
def get_war_room_run(
    run_id: str,
    db: Session = Depends(get_db),
    workspace_id: str | None = Depends(_workspace_from_header),
):
    q = db.query(WarRoomRun).filter(WarRoomRun.id == run_id)
    if workspace_id:
        q = q.filter(WarRoomRun.workspace_id == workspace_id)
    run = q.first()
    if not run:
        raise HTTPException(status_code=404, detail="War room run not found")
    return run


# --- War Room ---


async def _send_telegram_via_openclaw(text: str) -> tuple[str | None, str | None]:
    oc = get_openclaw()
    if not oc:
        return None, "OPENCLAW_GATEWAY_URL/TOKEN not configured"
    if not settings.telegram_chat_id:
        return None, "TELEGRAM_CHAT_ID not configured"

    try:
        result = await oc.message_send(
            channel="telegram",
            target=settings.telegram_chat_id,
            text=text,
            thread_id=settings.telegram_topic_id,
        )
        message_id = None
        if isinstance(result, dict):
            message_id = result.get("messageId") or result.get("id")
        return (str(message_id) if message_id else None), None
    except Exception as e:
        return None, str(e)


def _parse_owner_updates(text: str) -> list[dict]:
    """Parse a batched owner update response.

    Expected blocks separated by '---'. Each block may contain keys:
    task_title/current_task/status/next_step/blockers

    Returns list of dicts.
    """

    if not text:
        return []

    blocks = [b.strip() for b in str(text).split("---") if b.strip()]
    out: list[dict] = []

    for b in blocks:
        item: dict[str, str] = {}
        for line in b.splitlines():
            if ":" not in line:
                continue
            k, v = line.split(":", 1)
            k = k.strip().lower()
            v = v.strip()
            if k in {"task_title", "current_task", "status", "next_step", "blockers"}:
                item[k] = v
        if item:
            out.append(item)

    return out


@app.post(
    "/api/war-room/run",
    dependencies=[Depends(_require_api_key), Depends(_require_role({"admin", "operator"}))],
)
async def war_room_run(
    db: Session = Depends(get_db),
    actor_role: tuple[str, str] = Depends(_actor_from_headers),
    workspace_id: str | None = Depends(_workspace_from_header),
):
    convo = Conversation(id=str(uuid4()), workspace_id=workspace_id, type=ConversationType.WAR_ROOM)
    db.add(convo)

    agents = db.query(Agent).order_by(Agent.name.asc()).all()
    agents_by_id = {a.id: a for a in agents}

    tasks_q = db.query(Task).filter(Task.status.in_(["DOING", "BLOCKED"]))
    if workspace_id:
        tasks_q = tasks_q.filter(Task.workspace_id == workspace_id)
    tasks = (
        tasks_q.order_by(Task.status.asc(), Task.priority.desc(), Task.updated_at.desc()).all()
    )

    def add_turn(speaker_type: str, content: str, speaker_id: str | None = None):
        db.add(
            Turn(
                id=str(uuid4()),
                conversation_id=convo.id,
                speaker_type=speaker_type,
                speaker_id=speaker_id,
                content=content,
            )
        )

    add_turn(
        "chair",
        "War Room started. Objective: sync on DOING/BLOCKED tasks, unblock work, and assign next steps.",
    )

    if not tasks:
        add_turn(
            "chair",
            "No DOING/BLOCKED tasks right now. Create tasks on the Kanban to drive work.",
        )
        db.commit()
        return {"ok": True, "conversationId": convo.id}

    snapshot_lines = ["Current focus (DOING/BLOCKED):"]
    for t in tasks:
        owner = agents_by_id.get(t.owner_agent_id) if t.owner_agent_id else None
        snapshot_lines.append(
            f"- [{t.status}] {t.title} (prio {t.priority}) — owner: {owner.name if owner else 'Unassigned'}"
        )
    add_turn("chair", "\n".join(snapshot_lines))

    # Group tasks by owner so we can spawn once per owner
    tasks_by_owner: dict[str, list[Task]] = {}
    unassigned: list[Task] = []
    for t in tasks:
        if not t.owner_agent_id:
            unassigned.append(t)
            continue
        tasks_by_owner.setdefault(t.owner_agent_id, []).append(t)

    # Unassigned tasks
    for t in unassigned:
        add_turn(
            "chair",
            "\n".join(
                [
                    f"Update request for task: {t.title}",
                    "Owner: (unassigned)",
                    "Action: assign an owner or move back to READY.",
                ]
            ),
        )
        add_turn(
            "system",
            "No agent assigned. Chair should assign an owner or move task back to READY.",
        )

    for owner_id, owner_tasks in tasks_by_owner.items():
        owner = agents_by_id.get(owner_id)
        if not owner:
            continue

        add_turn(
            "chair",
            "\n".join(
                [
                    f"Owner update request: {owner.name}",
                    "Please reply for EACH task with: current_task, status, next_step, blockers.",
                    "Tasks:",
                    *[f"- {t.title} (status {t.status}, prio {t.priority})" for t in owner_tasks],
                ]
            ),
        )

        if owner.openclaw_agent_id:
            oc = get_openclaw()
            if not oc:
                add_turn("system", "OpenClaw gateway not configured; cannot spawn agent runs.")
                continue

            prompt = "\n".join(
                [
                    "You are in the hourly War Room.",
                    "Provide a structured update for each task listed.",
                    "Format for each task:",
                    "task_title:",
                    "current_task:",
                    "status:",
                    "next_step:",
                    "blockers:",
                    "---",
                    "Tasks:",
                    *[
                        f"- {t.title}\n  description: {(t.description or '').strip()}\n  status: {t.status}\n  priority: {t.priority}"
                        for t in owner_tasks
                    ],
                ]
            )

            add_turn(
                "system",
                f"Spawning OpenClaw agent `{owner.openclaw_agent_id}` for owner update…",
            )

            try:
                import asyncio

                spawn_res = await oc.sessions_spawn(
                    task=prompt,
                    label=f"war-room:{convo.id}:owner:{owner.id}",
                    agent_id=owner.openclaw_agent_id,
                )
                child_key = spawn_res.get("childSessionKey")
                if not child_key:
                    add_turn("system", f"Spawn returned no childSessionKey: {spawn_res}")
                    continue

                assistant_msg = None
                for _ in range(25):
                    hist = await oc.sessions_history(child_key, limit=30, include_tools=False)
                    msgs = (
                        hist
                        if isinstance(hist, list)
                        else hist.get("messages")
                        if isinstance(hist, dict)
                        else []
                    )
                    for m in reversed(msgs):
                        if isinstance(m, dict) and m.get("role") == "assistant":
                            assistant_msg = m.get("content")
                            break
                    if assistant_msg:
                        break
                    await asyncio.sleep(1.5)

                if assistant_msg:
                    add_turn("agent", str(assistant_msg), speaker_id=owner.id)

                    # Parse structured updates and update AgentWorkState + (optionally) task statuses
                    parsed = _parse_owner_updates(str(assistant_msg))
                    if parsed:
                        # pick a representative current task for the agent work state
                        # prefer the highest priority task title in this owner batch
                        top = sorted(owner_tasks, key=lambda x: x.priority, reverse=True)[0]

                        # Find matching parsed item (by task_title or current_task)
                        best = None
                        for it in parsed:
                            tt = (it.get("task_title") or "").strip()
                            if tt and tt.lower() == top.title.lower():
                                best = it
                                break
                        if not best:
                            best = parsed[0]

                        state = (
                            db.query(AgentWorkState)
                            .filter(AgentWorkState.agent_id == owner.id)
                            .first()
                        )
                        if not state:
                            state = AgentWorkState(agent_id=owner.id)

                        state.task_id = top.id
                        state.status = best.get("status", "working")
                        state.next_step = best.get("next_step", "")
                        state.blockers = best.get("blockers", "")
                        db.add(state)

                        # If APPLY_WAR_ROOM_MOVES is enabled, also mark tasks blocked/unblocked based on blockers
                        if settings.apply_war_room_moves:
                            for it in parsed:
                                title = (it.get("task_title") or it.get("current_task") or "").strip()
                                if not title:
                                    continue
                                # match task by title within this owner's tasks
                                match = None
                                for ot in owner_tasks:
                                    if ot.title.lower() == title.lower():
                                        match = ot
                                        break
                                if not match:
                                    continue
                                blockers = (it.get("blockers") or "").strip().lower()
                                if blockers and blockers not in {"none", "n/a", "na", "no"}:
                                    match.status = "BLOCKED"
                                else:
                                    # keep DONE as DONE, otherwise set to DOING
                                    if match.status != "DONE":
                                        match.status = "DOING"
                                db.add(match)

                else:
                    add_turn("system", f"Timed out waiting for agent response (session {child_key}).")

            except Exception as e:
                add_turn("system", f"Agent spawn/history failed: {e}")

        else:
            add_turn(
                "system",
                "Owner has no `openclaw_agent_id` configured yet; falling back to mocked update.",
            )
            add_turn(
                "agent",
                "\n".join(
                    [
                        f"current_task: (all tasks for {owner.name})",
                        "status: working (mocked update)",
                        "next_step: set openclaw_agent_id for this employee agent",
                        "blockers: none reported (mocked)",
                    ]
                ),
                speaker_id=owner.id,
            )

    moves: list[dict] = []
    for t in tasks:
        if not t.owner_agent_id:
            moves.append({"taskId": t.id, "from": t.status, "to": "READY", "reason": "Needs owner"})
        elif t.status == "BLOCKED":
            moves.append({"taskId": t.id, "from": "BLOCKED", "to": "DOING", "reason": "Assume unblock after check"})

    # Optionally apply moves
    applied_moves: list[dict] = []
    if settings.apply_war_room_moves:
        for m in moves:
            tid = m.get("taskId")
            to = m.get("to")
            if not tid or not to:
                continue
            task = db.query(Task).filter(Task.id == tid).first()
            if not task:
                continue
            # only apply status moves for now
            task.status = to
            db.add(task)
            applied_moves.append(m)

    final_answer = "War Room complete. Next steps assigned in Mission Control."

    decision = {
        "decisions": [
            "Use Kanban as the source of truth; every task must have an owner.",
            "All agent updates must be logged as transcript turns.",
        ],
        "proposed_task_moves": moves,
        "applied_task_moves": applied_moves,
        "final_answer_for_telegram": final_answer,
    }
    add_turn(
        "chair",
        "Chair summary (v0):\n```json\n" + json.dumps(decision, indent=2) + "\n```",
    )

    run_id = str(uuid4())
    wr = WarRoomRun(
        id=run_id,
        workspace_id=workspace_id,
        conversation_id=convo.id,
        final_answer=final_answer,
        summary_json=decision,
        telegram_chat_id=settings.telegram_chat_id,
        telegram_topic_id=settings.telegram_topic_id,
    )
    db.add(wr)
    _audit(
        db,
        actor=actor_role[0],
        role=actor_role[1],
        workspace_id=workspace_id,
        action="war_room.run",
        entity_type="war_room_run",
        entity_id=run_id,
        payload={"conversation_id": convo.id, "final_answer": final_answer},
    )

    db.commit()

    try:
        message_id, err = await _send_telegram_via_openclaw(final_answer)
        if message_id:
            wr.telegram_message_id = str(message_id)
        if err:
            wr.telegram_error = err
        db.add(wr)
        db.commit()
    except Exception as e:
        wr.telegram_error = str(e)
        db.add(wr)
        db.commit()

    return {
        "ok": True,
        "conversationId": convo.id,
        "warRoomRunId": run_id,
        "telegram": {
            "chatId": settings.telegram_chat_id,
            "topicId": settings.telegram_topic_id,
            "messageId": wr.telegram_message_id,
            "error": wr.telegram_error,
        },
    }
