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
    # Shape (example):
    # {
    #   "default": "propose",
    #   "bySkill": {"github": "execute", "coolify": "propose"}
    # }
    execution_policy: Mapped[dict] = mapped_column(JSON, default=dict)

    # Additional constraints: budgets, forbidden actions, data boundaries, etc.
    constraints: Mapped[dict] = mapped_column(JSON, default=dict)

    # Output contract: what the agent must report on each run.
    # e.g. {"status": true, "fields": ["current_task","next_step","blockers"]}
    output_contract: Mapped[dict] = mapped_column(JSON, default=dict)

    created_at: Mapped[str] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[str] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    tasks: Mapped[list["Task"]] = relationship(back_populates="owner_agent")


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
