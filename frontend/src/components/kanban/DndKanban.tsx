import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useMemo, useState } from "react";

import { cn } from "@/lib/utils";

export type TaskStatus = "BACKLOG" | "READY" | "DOING" | "BLOCKED" | "REVIEW" | "DONE";

export type KanbanTask = {
  id: string;
  title: string;
  status: TaskStatus;
  priority: number;
};

const columns: TaskStatus[] = ["BACKLOG", "READY", "DOING", "BLOCKED", "REVIEW", "DONE"];

function DraggableTaskCard({ task }: { task: KanbanTask }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    data: { fromStatus: task.status },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn("rounded-lg border bg-card p-2", isDragging && "opacity-50")}
      {...listeners}
      {...attributes}
    >
      <div className="text-sm font-extrabold leading-tight">{task.title}</div>
      <div className="text-xs text-muted-foreground">prio: {task.priority}</div>
      <div className="truncate text-[11px] text-muted-foreground">id: {task.id}</div>
    </div>
  );
}

function DroppableColumn({
  status,
  children,
}: {
  status: TaskStatus;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "grid min-h-[60px] gap-2 rounded-md p-2",
        isOver && "bg-accent/40",
      )}
    >
      {children}
    </div>
  );
}

export function DndKanban({
  tasks,
  onMove,
}: {
  tasks: KanbanTask[];
  onMove: (taskId: string, toStatus: TaskStatus) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const [activeId, setActiveId] = useState<string | null>(null);

  const tasksByStatus = useMemo(() => {
    const map = new Map<TaskStatus, KanbanTask[]>();
    for (const c of columns) map.set(c, []);
    for (const t of tasks) map.get(t.status)?.push(t);
    for (const c of columns) {
      map.get(c)!.sort((a, b) => (b.priority - a.priority) || a.title.localeCompare(b.title));
    }
    return map;
  }, [tasks]);

  const activeTask = useMemo(
    () => (activeId ? tasks.find((t) => t.id === activeId) : null),
    [activeId, tasks],
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);
    if (!over) return;

    const taskId = String(active.id);
    const toStatus = String(over.id) as TaskStatus;
    if (!columns.includes(toStatus)) return;

    const fromStatus = (active.data.current?.fromStatus ?? "BACKLOG") as TaskStatus;
    if (fromStatus !== toStatus) {
      onMove(taskId, toStatus);
    }
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={(e) => setActiveId(String(e.active.id))}
      onDragEnd={handleDragEnd}
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
        {columns.map((col) => {
          const colTasks = tasksByStatus.get(col) ?? [];
          return (
            <div key={col} className="rounded-lg border">
              <div className="border-b px-3 py-2 text-xs font-extrabold tracking-wide">
                {col} ({colTasks.length})
              </div>
              <DroppableColumn status={col}>
                {colTasks.map((t) => (
                  <DraggableTaskCard key={t.id} task={t} />
                ))}
                {colTasks.length === 0 && (
                  <div className="px-1 py-2 text-xs text-muted-foreground">—</div>
                )}
              </DroppableColumn>
            </div>
          );
        })}
      </div>

      <DragOverlay>
        {activeTask ? (
          <div className="rounded-lg border bg-card p-2 shadow">
            <div className="text-sm font-extrabold leading-tight">{activeTask.title}</div>
            <div className="text-xs text-muted-foreground">prio: {activeTask.priority}</div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
