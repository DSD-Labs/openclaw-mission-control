import json
from uuid import uuid4

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

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


def _actor_from_headers(
    x_mc_user: str | None = Header(default=None),
    x_mc_role: str | None = Header(default=None),
) -> tuple[str, str]:
    actor = x_mc_user or "unknown"
    role = x_mc_role or "operator"
    return actor, role


def _audit(
    db: Session,
    *,
    actor: str,
    role: str,
    action: str,
    entity_type: str,
    entity_id: str | None,
    payload: dict,
):
    db.add(
        AuditEvent(
            id=str(uuid4()),
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


# --- Gateways / Workspaces (v0) ---


@app.get("/api/gateways", response_model=list[GatewayOut])
def list_gateways(db: Session = Depends(get_db)):
    return db.query(Gateway).order_by(Gateway.created_at.desc()).all()


@app.post("/api/gateways", response_model=GatewayOut, dependencies=[Depends(_require_api_key)])
def create_gateway(
    body: GatewayCreate,
    db: Session = Depends(get_db),
    actor_role: tuple[str, str] = Depends(_actor_from_headers),
):
    gw = Gateway(
        id=str(uuid4()),
        name=body.name,
        url=body.url,
        token=body.token,
        enabled=body.enabled,
    )
    db.add(gw)
    _audit(
        db,
        actor=actor_role[0],
        role=actor_role[1],
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


@app.post("/api/workspaces", response_model=WorkspaceOut, dependencies=[Depends(_require_api_key)])
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
def list_agents(db: Session = Depends(get_db)):
    agents = db.query(Agent).order_by(Agent.updated_at.desc()).all()
    for a in agents:
        _ = a.work_state
    return agents


@app.post("/api/agents", response_model=AgentOut, dependencies=[Depends(_require_api_key)])
def create_agent(
    body: AgentCreate,
    db: Session = Depends(get_db),
    actor_role: tuple[str, str] = Depends(_actor_from_headers),
):
    agent = Agent(
        id=str(uuid4()),
        name=body.name,
        role=body.role,
        soul_md=body.soul_md,
        model=body.model,
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
    dependencies=[Depends(_require_api_key)],
)
def update_agent(
    agent_id: str,
    body: dict,
    db: Session = Depends(get_db),
    actor_role: tuple[str, str] = Depends(_actor_from_headers),
):
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    for field in ["name", "role", "soul_md", "model", "enabled", "skills_allow"]:
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
    dependencies=[Depends(_require_api_key)],
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
def list_tasks(db: Session = Depends(get_db)):
    return db.query(Task).order_by(Task.priority.desc(), Task.updated_at.desc()).all()


@app.post("/api/tasks", response_model=TaskOut, dependencies=[Depends(_require_api_key)])
def create_task(
    body: TaskCreate,
    db: Session = Depends(get_db),
    actor_role: tuple[str, str] = Depends(_actor_from_headers),
):
    task = Task(
        id=str(uuid4()),
        title=body.title,
        description=body.description,
        status=body.status,
        priority=body.priority,
        owner_agent_id=body.owner_agent_id,
    )
    db.add(task)
    _audit(
        db,
        actor=actor_role[0],
        role=actor_role[1],
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


@app.patch(
    "/api/tasks/{task_id}",
    response_model=TaskOut,
    dependencies=[Depends(_require_api_key)],
)
def update_task(
    task_id: str,
    body: dict,
    db: Session = Depends(get_db),
    actor_role: tuple[str, str] = Depends(_actor_from_headers),
):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    for field in ["title", "description", "status", "priority", "owner_agent_id"]:
        if field in body:
            setattr(task, field, body[field])

    db.add(task)
    _audit(
        db,
        actor=actor_role[0],
        role=actor_role[1],
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
def list_audit(db: Session = Depends(get_db), limit: int = 200):
    return (
        db.query(AuditEvent)
        .order_by(AuditEvent.created_at.desc())
        .limit(min(limit, 500))
        .all()
    )


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


@app.post("/api/war-room/run", dependencies=[Depends(_require_api_key)])
async def war_room_run(
    db: Session = Depends(get_db),
    actor_role: tuple[str, str] = Depends(_actor_from_headers),
):
    convo = Conversation(id=str(uuid4()), type=ConversationType.WAR_ROOM)
    db.add(convo)

    agents = db.query(Agent).order_by(Agent.name.asc()).all()
    agents_by_id = {a.id: a for a in agents}

    tasks = (
        db.query(Task)
        .filter(Task.status.in_(["DOING", "BLOCKED"]))
        .order_by(Task.status.asc(), Task.priority.desc(), Task.updated_at.desc())
        .all()
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

    for t in tasks:
        owner = agents_by_id.get(t.owner_agent_id) if t.owner_agent_id else None
        who = owner.name if owner else "(unassigned)"
        add_turn(
            "chair",
            "\n".join(
                [
                    f"Update request for task: {t.title}",
                    f"Owner: {who}",
                    "Please reply with: current_task, status, next_step, blockers.",
                ]
            ),
        )

        if owner:
            add_turn(
                "agent",
                "\n".join(
                    [
                        f"current_task: {t.title}",
                        f"status: working (mocked update)",
                        "next_step: provide real update once OpenClaw adapter is wired",
                        "blockers: none reported (mocked)",
                    ]
                ),
                speaker_id=owner.id,
            )
        else:
            add_turn(
                "system",
                "No agent assigned. Chair should assign an owner or move task back to READY.",
            )

    moves = []
    for t in tasks:
        if not t.owner_agent_id:
            moves.append({"taskId": t.id, "from": t.status, "to": "READY", "reason": "Needs owner"})
        elif t.status == "BLOCKED":
            moves.append({"taskId": t.id, "from": "BLOCKED", "to": "DOING", "reason": "Assume unblock after check"})

    final_answer = "War Room complete. Next steps assigned in Mission Control."

    decision = {
        "decisions": [
            "Use Kanban as the source of truth; every task must have an owner.",
            "All agent updates must be logged as transcript turns.",
        ],
        "proposed_task_moves": moves,
        "final_answer_for_telegram": final_answer,
    }
    add_turn(
        "chair",
        "Chair summary (v0):\n```json\n" + json.dumps(decision, indent=2) + "\n```",
    )

    run_id = str(uuid4())
    wr = WarRoomRun(
        id=run_id,
        conversation_id=convo.id,
        final_answer=final_answer,
        telegram_chat_id=settings.telegram_chat_id,
        telegram_topic_id=settings.telegram_topic_id,
    )
    db.add(wr)
    _audit(
        db,
        actor=actor_role[0],
        role=actor_role[1],
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
