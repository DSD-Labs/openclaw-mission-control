import json
from uuid import uuid4

from fastapi import Depends, FastAPI, HTTPException

from .openclaw import get_openclaw
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from .db import engine, get_db
from .models import (
    Base,
    Conversation,
    ConversationType,
    Task,
    Turn,
    Agent,
    WarRoomRun,
    AgentWorkState,
)
from .schemas import (
    AgentCreate,
    AgentOut,
    AgentWorkStateUpsert,
    ConversationCreate,
    ConversationOut,
    TaskCreate,
    TaskOut,
    TurnCreate,
    TurnOut,
)
from .settings import settings

Base.metadata.create_all(bind=engine)

app = FastAPI(title="OpenClaw Mission Control API", version="0.0.1")

origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"] ,
)


@app.get("/health")
def health():
    return {"ok": True}


@app.get("/api/agents", response_model=list[AgentOut])
def list_agents(db: Session = Depends(get_db)):
    agents = db.query(Agent).order_by(Agent.updated_at.desc()).all()
    # ensure work_state relationship loads (sqlite is fine; later optimize)
    for a in agents:
        _ = a.work_state
    return agents


@app.post("/api/agents", response_model=AgentOut)
def create_agent(body: AgentCreate, db: Session = Depends(get_db)):
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
    db.commit()
    db.refresh(agent)
    return agent


@app.get("/api/agents/{agent_id}", response_model=AgentOut)
def get_agent(agent_id: str, db: Session = Depends(get_db)):
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    return agent


@app.patch("/api/agents/{agent_id}", response_model=AgentOut)
def update_agent(agent_id: str, body: dict, db: Session = Depends(get_db)):
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    # Minimal patch semantics (v0). Later: strong schema validation.
    for field in ["name", "role", "soul_md", "model", "enabled", "skills_allow"]:
        if field in body:
            setattr(agent, field, body[field])

    for field in ["execution_policy", "constraints", "output_contract"]:
        if field in body:
            setattr(agent, field, body[field])

    db.add(agent)
    db.commit()
    db.refresh(agent)
    return agent


@app.post("/api/agent-work-state", response_model=dict)
def upsert_agent_work_state(body: AgentWorkStateUpsert, db: Session = Depends(get_db)):
    # Upsert by agent_id
    state = db.query(AgentWorkState).filter(AgentWorkState.agent_id == body.agent_id).first()
    if not state:
        state = AgentWorkState(agent_id=body.agent_id)

    state.task_id = body.task_id
    state.status = body.status
    state.next_step = body.next_step
    state.blockers = body.blockers

    db.add(state)
    db.commit()
    return {"ok": True}


@app.get("/api/tasks", response_model=list[TaskOut])
def list_tasks(db: Session = Depends(get_db)):
    return db.query(Task).order_by(Task.priority.desc(), Task.updated_at.desc()).all()


@app.post("/api/tasks", response_model=TaskOut)
def create_task(body: TaskCreate, db: Session = Depends(get_db)):
    task = Task(
        id=str(uuid4()),
        title=body.title,
        description=body.description,
        status=body.status,
        priority=body.priority,
        owner_agent_id=body.owner_agent_id,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


@app.get("/api/tasks/{task_id}", response_model=TaskOut)
def get_task(task_id: str, db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@app.patch("/api/tasks/{task_id}", response_model=TaskOut)
def update_task(task_id: str, body: dict, db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    for field in ["title", "description", "status", "priority", "owner_agent_id"]:
        if field in body:
            setattr(task, field, body[field])

    db.add(task)
    db.commit()
    db.refresh(task)
    return task


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
        # Let FastAPI return a 200 null for v0; later we can make this a 404
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


@app.post("/api/war-room/run")
async def _send_telegram_via_openclaw(text: str) -> tuple[str | None, str | None]:
    """Send a Telegram message via OpenClaw Gateway tools/invoke (message tool)."""

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


@app.post("/api/war-room/run")
async def war_room_run(db: Session = Depends(get_db)):
    """v0 orchestrator.

    Creates a WAR_ROOM conversation with multiple turns:
    - Chair opening
    - Snapshot of DOING/BLOCKED tasks
    - Chair questions to each owner (or unassigned)
    - Mocked agent updates (placeholder until OpenClaw adapter is wired)
    - Chair decisions + proposed task moves
    """

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

    # Ask for updates
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

        # Mocked agent response (until OpenClaw adapter exists)
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

    # Chair decisions + proposed moves
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

    # Store run + attempt Telegram send (best-effort)
    run_id = str(uuid4())
    wr = WarRoomRun(
        id=run_id,
        conversation_id=convo.id,
        final_answer=final_answer,
        telegram_chat_id=settings.telegram_chat_id,
        telegram_topic_id=settings.telegram_topic_id,
    )
    db.add(wr)

    db.commit()

    # Best-effort send after commit
    # (If send fails, we still have the transcript + stored final_answer)
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
