from pydantic import BaseModel, Field

from .models import ConversationType, TaskStatus


class AgentCreate(BaseModel):
    name: str
    role: str
    soul_md: str = ""
    model: str | None = None
    enabled: bool = True
    skills_allow: list[str] = Field(default_factory=list)


class AgentOut(BaseModel):
    id: str
    name: str
    role: str
    soul_md: str
    model: str | None
    enabled: bool
    skills_allow: list

    class Config:
        from_attributes = True


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

    class Config:
        from_attributes = True
