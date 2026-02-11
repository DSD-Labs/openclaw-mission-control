import enum

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.sqlite import JSON
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class TaskStatus(str, enum.Enum):
    BACKLOG = "BACKLOG"
    READY = "READY"
    DOING = "DOING"
    BLOCKED = "BLOCKED"
    REVIEW = "REVIEW"
    DONE = "DONE"


class ConversationType(str, enum.Enum):
    TASK = "TASK"
    WAR_ROOM = "WAR_ROOM"


class Agent(Base):
    __tablename__ = "agents"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)

    # High-level function / department label (e.g. "Ops", "Finance")
    role: Mapped[str] = mapped_column(String, nullable=False)

    # The agent's core system prompt / Soul (markdown)
    soul_md: Mapped[str] = mapped_column(Text, default="")

    # Optional model override (otherwise use platform default)
    model: Mapped[str | None] = mapped_column(String, nullable=True)

    enabled: Mapped[bool] = mapped_column(Boolean, default=True)

    # Deny-by-default allowlist of skills/tools this agent may access.
    # Store as JSON array of strings (we keep it flexible as JSON).
    skills_allow: Mapped[list] = mapped_column(JSON, default=list)

    # Execution policy controls whether the agent may execute tools or must propose.
    execution_policy: Mapped[dict] = mapped_column(JSON, default=dict)

    # Additional constraints: budgets, forbidden actions, data boundaries, etc.
    constraints: Mapped[dict] = mapped_column(JSON, default=dict)

    # Output contract: what the agent must report on each run.
    output_contract: Mapped[dict] = mapped_column(JSON, default=dict)

    created_at: Mapped[str] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[str] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    tasks: Mapped[list["Task"]] = relationship(back_populates="owner_agent")
    work_state: Mapped["AgentWorkState" | None] = relationship(
        back_populates="agent", uselist=False
    )


class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    title: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[TaskStatus] = mapped_column(Enum(TaskStatus), default=TaskStatus.BACKLOG)
    priority: Mapped[int] = mapped_column(Integer, default=0)

    owner_agent_id: Mapped[str | None] = mapped_column(String, ForeignKey("agents.id"), nullable=True)
    owner_agent: Mapped[Agent | None] = relationship(back_populates="tasks")

    created_at: Mapped[str] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[str] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    conversation: Mapped["Conversation" | None] = relationship(back_populates="task")


class AgentWorkState(Base):
    __tablename__ = "agent_work_states"

    agent_id: Mapped[str] = mapped_column(String, ForeignKey("agents.id"), primary_key=True)
    agent: Mapped[Agent] = relationship(back_populates="work_state")

    task_id: Mapped[str | None] = mapped_column(String, ForeignKey("tasks.id"), nullable=True)

    # "thinking" | "executing" | "waiting" | "blocked" | ...
    status: Mapped[str] = mapped_column(String, default="idle")

    next_step: Mapped[str] = mapped_column(Text, default="")
    blockers: Mapped[str] = mapped_column(Text, default="")

    updated_at: Mapped[str] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class Conversation(Base):
    __tablename__ = "conversations"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    type: Mapped[ConversationType] = mapped_column(Enum(ConversationType), nullable=False)

    task_id: Mapped[str | None] = mapped_column(String, ForeignKey("tasks.id"), unique=True)
    task: Mapped[Task | None] = relationship(back_populates="conversation")

    created_at: Mapped[str] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[str] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    turns: Mapped[list["Turn"]] = relationship(back_populates="conversation")


class Turn(Base):
    __tablename__ = "turns"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    conversation_id: Mapped[str] = mapped_column(String, ForeignKey("conversations.id"), nullable=False)
    conversation: Mapped[Conversation] = relationship(back_populates="turns")

    speaker_type: Mapped[str] = mapped_column(String, nullable=False)
    speaker_id: Mapped[str | None] = mapped_column(String, nullable=True)

    content: Mapped[str] = mapped_column(Text, nullable=False)
    tool_events: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    created_at: Mapped[str] = mapped_column(DateTime(timezone=True), server_default=func.now())


class WarRoomRun(Base):
    __tablename__ = "war_room_runs"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    conversation_id: Mapped[str] = mapped_column(String, ForeignKey("conversations.id"), nullable=False)

    final_answer: Mapped[str] = mapped_column(Text, nullable=False)

    telegram_chat_id: Mapped[str | None] = mapped_column(String, nullable=True)
    telegram_topic_id: Mapped[str | None] = mapped_column(String, nullable=True)
    telegram_message_id: Mapped[str | None] = mapped_column(String, nullable=True)
    telegram_error: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[str] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AuditEvent(Base):
    __tablename__ = "audit_events"

    id: Mapped[str] = mapped_column(String, primary_key=True)

    # who
    actor: Mapped[str] = mapped_column(String, default="unknown")
    role: Mapped[str] = mapped_column(String, default="operator")

    # what
    action: Mapped[str] = mapped_column(String, nullable=False)  # e.g. task.update, agent.create
    entity_type: Mapped[str] = mapped_column(String, nullable=False)  # agent/task/war_room
    entity_id: Mapped[str | None] = mapped_column(String, nullable=True)

    # details
    payload: Mapped[dict] = mapped_column(JSON, default=dict)

    created_at: Mapped[str] = mapped_column(DateTime(timezone=True), server_default=func.now())


# --- Multi-gateway / multi-workspace (v0) ---


class Gateway(Base):
    __tablename__ = "gateways"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    url: Mapped[str] = mapped_column(String, nullable=False)

    # NOTE: v0 stores token plaintext in DB. Next: encrypt at rest / KMS.
    token: Mapped[str] = mapped_column(String, nullable=False)

    enabled: Mapped[bool] = mapped_column(Boolean, default=True)

    created_at: Mapped[str] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Workspace(Base):
    __tablename__ = "workspaces"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, unique=True, nullable=False)

    gateway_id: Mapped[str | None] = mapped_column(String, ForeignKey("gateways.id"), nullable=True)

    created_at: Mapped[str] = mapped_column(DateTime(timezone=True), server_default=func.now())
