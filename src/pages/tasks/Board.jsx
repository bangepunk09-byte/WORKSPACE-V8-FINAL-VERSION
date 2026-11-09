import { useState } from "react";
import { MessageSquare, Paperclip, ListChecks, Plus, AlertTriangle, RotateCw, MoreHorizontal, Users } from "lucide-react";
import { toast } from "sonner";
import { api, errMsg } from "../../lib/api";
import { useApp } from "../../context/AppContext";
import { Avatar, AvatarStack, Labels, PriorityBadge, dueInfo } from "../../components/common";
import { playSound } from "../../lib/sound";

function formatUpdatedAgo(iso) {
  if (!iso) return "Updated recently";
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffSec = Math.max(0, Math.floor((now.getTime() - d.getTime()) / 1000));
    if (diffSec < 60) return "Updated just now";
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `Updated ${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `Updated ${diffHours}hrs ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `Updated ${diffDays}d ago`;
  } catch {
    return "Updated recently";
  }
}

export function TaskCard({ t, onOpen, done, draggable, onDragStart }) {
  const { userMap } = useApp();
  const progressVal = Math.round(t.progress ?? (t.status === "done" || done ? 100 : 0));
  const checkpointTotal = (t.checkpoints?.length || 0) + (t.checklist?.length || 0);
  const userIds = Array.from(new Set([
    t.assignee_id,
    ...(t.requestor_ids || (t.requestor_id ? [t.requestor_id] : [])),
    ...(t.collaborator_ids || [])
  ].filter(Boolean)));
  const userCount = Math.max(userIds.length, 1);

  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onClick={() => onOpen(t.id)}
      data-testid={`task-card-${t.id}`}
      className="group relative w-full cursor-pointer rounded-[26px] border border-slate-100/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 text-left shadow-[0_4px_20px_rgba(0,0,0,0.03)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)]"
      style={t.card_color ? { borderTop: `4px solid ${t.card_color}` } : undefined}
    >
      {/* Top Header: Updated X ago + icons */}
      <div className="flex items-center justify-between text-slate-400">
        <span className="text-[13px] font-medium tracking-tight text-[#64748B] dark:text-slate-400">
          {formatUpdatedAgo(t.updated_at || t.created_at)}
        </span>
        <div className="flex items-center gap-2 text-slate-400" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onOpen(t.id); }}
            className="rounded-full p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
            aria-label="Refresh task"
          >
            <RotateCw size={13} strokeWidth={2.2} />
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onOpen(t.id); }}
            className="rounded-full p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
            aria-label="Task options"
          >
            <MoreHorizontal size={15} strokeWidth={2.2} />
          </button>
        </div>
      </div>

      {/* Title */}
      <h3 className="mt-3.5 mb-4 text-[16px] font-bold leading-snug tracking-tight text-[#0F172A] dark:text-slate-100 line-clamp-2">
        <span className={done ? "line-through decoration-slate-400/80 text-slate-500 dark:text-slate-400 opacity-80" : ""}>
          {t.title}
        </span>
      </h3>

      {/* PROGRESS Section */}
      <div className="mb-4" data-testid={`card-progress-${t.id}`}>
        <p className="mb-2 text-[10px] font-black tracking-widest text-[#64748B] dark:text-slate-400 uppercase">
          PROGRESS
        </p>
        <div className="flex items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#E2E8F0] dark:bg-slate-800">
            <div
              className="h-full rounded-full bg-[#10B981] transition-all duration-300"
              style={{ width: `${Math.min(100, Math.max(0, progressVal))}%` }}
            />
          </div>
          <span className="text-[13px] font-extrabold tracking-tight text-[#0F172A] dark:text-slate-100 min-w-[34px] text-right">
            {progressVal}%
          </span>
        </div>
      </div>

      {/* Footer: Counters + Avatar Stack */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-3.5 text-[13px] font-medium text-[#64748B] dark:text-slate-400">
          {/* Checkpoint / Checklist Icon & Count */}
          <span className="flex items-center gap-1.5" title="Checkpoints / Subtasks">
            <span className="flex h-4 w-4 items-center justify-center rounded-[4px] border-[1.75px] border-slate-400 dark:border-slate-500">
              <span className="h-1.5 w-1.5 rounded-[1px] bg-slate-400 dark:bg-slate-500" />
            </span>
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              {checkpointTotal || 1}
            </span>
          </span>

          {/* User / Team Icon & Count */}
          <span className="flex items-center gap-1.5" title="Collaborators & Assignees">
            <Users size={15} strokeWidth={2.2} className="text-slate-400 dark:text-slate-500" />
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              {userCount}
            </span>
          </span>

          {t.open_issues > 0 && (
            <span className="flex items-center gap-1 font-bold text-rose-500 text-xs" data-testid={`card-issue-indicator-${t.id}`}>
              <AlertTriangle size={13} />
              {t.open_issues}
            </span>
          )}
        </div>

        {/* Right Avatar Stack */}
        <div className="flex items-center">
          <AvatarStack ids={userIds} max={3} size={24} />
        </div>
      </div>
    </div>
  );
}

export default function Board({ tasks, onOpen, onNew, reload }) {
  const { statuses } = useApp();
  const [over, setOver] = useState(null);
  const dark = document.documentElement.classList.contains("dark");
  const drop = async (e, key) => {
    e.preventDefault(); setOver(null);
    const id = e.dataTransfer.getData("task");
    const t = tasks.find((x) => x.id === id);
    if (!t || t.status === key) return;
    try {
      await api.patch(`/tasks/${id}`, { status: key });
      const targetStatus = statuses.find((s) => s.key === key);
      if (targetStatus?.is_done || key === "done") {
        playSound("task_done");
      } else {
        playSound("click");
      }
      reload();
      toast.success(`Moved to ${targetStatus?.name || key}`);
    } catch (er) {
      toast.error(errMsg(er));
    }
  };
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:[grid-template-columns:repeat(var(--cols),minmax(0,1fr))]" style={{ "--cols": statuses.length }} data-testid="task-board">
      {statuses.map((s) => {
        const col = tasks.filter((t) => t.status === s.key);
        return (
          <div key={s.key} onDragOver={(e) => { e.preventDefault(); setOver(s.key); }} onDragLeave={() => setOver(null)} onDrop={(e) => drop(e, s.key)}
            className={`flex min-w-0 flex-col rounded-3xl p-2.5 transition-shadow ${over === s.key ? "ring-2 ring-[var(--c-accent)]" : ""}`}
            style={{ background: dark ? `${s.color}1A` : s.color }} data-testid={`kanban-column-${s.key}`}>
            <div className="mb-3 flex items-center gap-2 px-1"><span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-surface px-1.5 text-xs font-bold">{col.length}</span><span className="flex-1 font-bold">{s.name}</span>
              <button onClick={() => onNew(s.key)} className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-surface" aria-label={`Add task to ${s.name}`} data-testid={`kanban-add-${s.key}`}><Plus size={16} /></button></div>
            <div className="flex min-h-[80px] flex-1 flex-col gap-2.5">
              {col.map((t) => <TaskCard key={t.id} t={t} onOpen={onOpen} done={s.is_done} draggable onDragStart={(e) => e.dataTransfer.setData("task", t.id)} />)}
              <button onClick={() => onNew(s.key)} className="mt-1 flex h-11 items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-[color:var(--c-border)] text-sm font-semibold text-sub hover:bg-surface">+ Add task</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
