from uuid import uuid4

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from .db import engine, get_db
from .models import Base, Conversation, ConversationType, Task, Turn, Agent
from .schemas import (
    AgentCreate,
    AgentOut,
    ConversationCreate,
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
    return db.query(Agent).order_by(Agent.updated_at.desc()).all()


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
    )
    db.add(agent)
    db.commit()
    db.refresh(agent)
    return agent


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


@app.post("/api/conversations")
def create_conversation(body: ConversationCreate, db: Session = Depends(get_db)):
    convo = Conversation(id=str(uuid4()), type=body.type, task_id=body.task_id)
    db.add(convo)
    db.commit()
    db.refresh(convo)
    return convo


@app.get("/api/conversations/{conversation_id}")
def get_conversation(conversation_id: str, db: Session = Depends(get_db)):
    convo = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if not convo:
        return None
    turns = (
        db.query(Turn)
        .filter(Turn.conversation_id == conversation_id)
        .order_by(Turn.created_at.asc())
        .all()
    )
    return {"id": convo.id, "type": convo.type, "task_id": convo.task_id, "turns": turns}


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
def war_room_run_stub(db: Session = Depends(get_db)):
    convo = Conversation(id=str(uuid4()), type=ConversationType.WAR_ROOM)
    db.add(convo)
    db.add(
        Turn(
            id=str(uuid4()),
            conversation_id=convo.id,
            speaker_type="system",
            content="War room run stub created. Next: wire OpenClaw adapter + Telegram posting.",
        )
    )
    db.commit()
    return {"ok": True, "conversationId": convo.id}
