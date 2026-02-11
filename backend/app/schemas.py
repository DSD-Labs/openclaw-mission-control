from pydantic import BaseModel, Field

from .models import ConversationType, TaskStatus


# --- Agent profile schema ---


class AgentExecutionPolicy(BaseModel):
    # default behavior: "execute" | "propose"
    default: str = "propose"

    # per-skill override: {"github": "execute", "coolify": "propose"}
    by_skill: dict[str, str] = Field(default_factory=dict)


class AgentOutputContract(BaseModel):
    # Minimal contract we can enforce everywhere.
    required_fields: list[str] = Field(
        default_factory=lambda: ["current_task", "status", "next_step", "blockers"]
    )


class AgentConstraints(BaseModel):
    # Flexible JSON object for future governance constraints.
    # Examples: budgets, forbidden operations, data boundaries.
    data_boundaries: dict = Field(default_factory=dict)
    forbidden: list[str] = Field(default_factory=list)


class AgentCreate(BaseModel):
    name: str
    role: str
    soul_md: str = ""
    model: str | None = None
    enabled: bool = True

    # deny-by-default allowlist
    skills_allow: list[str] = Field(default_factory=list)

    execution_policy: AgentExecutionPolicy = Field(default_factory=AgentExecutionPolicy)
    constraints: AgentConstraints = Field(default_factory=AgentConstraints)
    output_contract: AgentOutputContract = Field(default_factory=AgentOutputContract)


class AgentOut(BaseModel):
    id: str
    name: str
    role: str
    soul_md: str
    model: str | None
    enabled: bool

    skills_allow: list
    execution_policy: dict
    constraints: dict
    output_contract: dict

    class Config:
        from_attributes = True


# --- Tasks ---


class TaskCreate(BaseModel):
    title: str
    description: str | None = None
    status: TaskStatus = TaskStatus.BACKLOG
    priority: int = 0
    owner_agent_id: str | None = None


class TaskOut(BaseModel):
    id: str
    title: str
    description: str | None
    status: TaskStatus
    priority: int
    owner_agent_id: str | None

    class Config:
        from_attributes = True


# --- Conversations / transcripts ---


class ConversationCreate(BaseModel):
    type: ConversationType
    task_id: str | None = None


class TurnCreate(BaseModel):
    speaker_type: str
    speaker_id: str | None = None
    content: str
    tool_events: dict | None = None


class TurnOut(BaseModel):
    id: str
    conversation_id: str
    speaker_type: str
    speaker_id: str | None
    content: str
    tool_events: dict | None
    created_at: str | None = None

    class Config:
        from_attributes = True


class ConversationOut(BaseModel):
    id: str
    type: ConversationType
    task_id: str | None
    turns: list[TurnOut]

    class Config:
        from_attributes = True
