import { useState } from "react";
import { MessageSquare, Paperclip, ListChecks, Plus, AlertTriangle, RotateCw, MoreHorizontal, Users, Archive, Trash2, ExternalLink, Copy } from "lucide-react";
import { toast } from "sonner";
import { api, errMsg } from "../../lib/api";
import { useApp } from "../../context/AppContext";
import { Avatar, AvatarStack, Labels, PriorityBadge, dueInfo } from "../../components/common";
import { playSound } from "../../lib/sound";
import { ItemChip } from "./fields";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator
} from "../../components/ui/dropdown-menu";

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

export function TaskCard({ t, onOpen, done, draggable, onDragStart, onDragEnd, isDragging, reload }) {
  const { userMap } = useApp();
  const [refreshing, setRefreshing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const progressVal = Math.round(t.progress ?? (t.status === "done" || done ? 100 : 0));
  const checkpointTotal = (t.checkpoints?.length || 0) + (t.checklist?.length || 0);
  const userIds = Array.from(new Set([
    ...(t.assignee_ids && t.assignee_ids.length ? t.assignee_ids : (t.assignee_id ? [t.assignee_id] : [])),
    ...(t.requestor_ids || (t.requestor_id ? [t.requestor_id] : [])),
    ...(t.collaborator_ids || [])
  ].filter(Boolean)));
  const userCount = Math.max(userIds.length, 1);

  const handleRefresh = async (e) => {
    e.stopPropagation();
    if (refreshing) return;
    setRefreshing(true);
    try {
      playSound("pop");
      if (reload) {
        await reload(true);
      } else {
        await api.get(`/tasks/${t.id}`);
      }
      toast.success(`Task "${t.title}" berhasil disegarkan`);
    } catch (err) {
      toast.error(errMsg(err, "Gagal menyegarkan task"));
    } finally {
      setTimeout(() => setRefreshing(false), 600);
    }
  };

  const handleArchive = async (e) => {
    e?.stopPropagation?.();
    setMenuOpen(false);
    try {
      playSound("pop");
      await api.patch(`/tasks/${t.id}`, { archived: true });
      toast.success(`Task "${t.title}" berhasil diarsipkan`);
      if (reload) await reload(true);
    } catch (err) {
      toast.error(errMsg(err, "Gagal mengarsipkan task"));
    }
  };

  const handleDelete = async (e) => {
    e?.stopPropagation?.();
    setMenuOpen(false);
    try {
      playSound("trash");
      await api.delete(`/tasks/${t.id}`);
      toast.success(`Task "${t.title}" berhasil dihapus`);
      if (reload) await reload(true);
    } catch (err) {
      toast.error(errMsg(err, "Gagal menghapus task"));
    }
  };

  const handleCopyId = (e) => {
    e?.stopPropagation?.();
    setMenuOpen(false);
    const textToCopy = t.number_str || (t.number ? `#${t.number}` : t.id);
    navigator.clipboard.writeText(textToCopy);
    toast.success(`ID ${textToCopy} berhasil disalin`);
  };

  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={() => onOpen(t.id)}
      data-testid={`task-card-${t.id}`}
      className={`group relative w-full cursor-grab active:cursor-grabbing rounded-[26px] border border-slate-100/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 text-left shadow-[0_4px_20px_rgba(0,0,0,0.03)] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)] animate-card-fade ${
        isDragging ? "opacity-30 scale-95 shadow-none border-dashed border-brand" : "opacity-100 scale-100"
      }`}
      style={t.card_color ? { borderTop: `4px solid ${t.card_color}` } : undefined}
    >
      {/* Top Header: Updated X ago + icons */}
      <div className="flex items-center justify-between text-slate-400">
        <span className="text-[13px] font-medium tracking-tight text-[#64748B] dark:text-slate-400">
          {formatUpdatedAgo(t.updated_at || t.created_at)}
        </span>
        <div className="flex items-center gap-1 text-slate-400" onClick={(e) => e.stopPropagation()}>
          {/* Panah melingkar: Refresh button */}
          <button
            type="button"
            onClick={handleRefresh}
            className={`rounded-full p-1.5 transition-all cursor-pointer ${
              refreshing
                ? "text-brand bg-brand/10 scale-105"
                : "text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            }`}
            aria-label="Refresh task"
            title="Segarkan task"
            data-testid={`task-refresh-${t.id}`}
          >
            <RotateCw size={13} strokeWidth={2.2} className={refreshing ? "animate-spin text-brand" : ""} />
          </button>

          {/* Titik tiga: Dropdown menu for Delete / Archive */}
          <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                onClick={(e) => e.stopPropagation()}
                className={`rounded-full p-1.5 transition-colors cursor-pointer ${
                  menuOpen
                    ? "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    : "text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                }`}
                aria-label="Task options"
                title="Pilihan task"
                data-testid={`task-menu-btn-${t.id}`}
              >
                <MoreHorizontal size={15} strokeWidth={2.2} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 p-1.5 shadow-xl rounded-2xl" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuItem
                onClick={() => { setMenuOpen(false); onOpen(t.id); }}
                className="cursor-pointer gap-2.5 text-xs font-semibold py-2"
                data-testid={`task-menu-open-${t.id}`}
              >
                <ExternalLink size={14} className="text-sub" />
                <span>Buka Detail</span>
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={handleCopyId}
                className="cursor-pointer gap-2.5 text-xs font-semibold py-2"
                data-testid={`task-menu-copy-${t.id}`}
              >
                <Copy size={14} className="text-sub" />
                <span>Salin ID Task</span>
              </DropdownMenuItem>

              <DropdownMenuSeparator className="my-1" />

              <DropdownMenuItem
                onClick={handleArchive}
                className="cursor-pointer gap-2.5 text-xs font-semibold py-2 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                data-testid={`task-menu-archive-${t.id}`}
              >
                <Archive size={14} />
                <span>Arsipkan Task</span>
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={handleDelete}
                className="cursor-pointer gap-2.5 text-xs font-semibold py-2 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                data-testid={`task-menu-delete-${t.id}`}
              >
                <Trash2 size={14} />
                <span>Hapus Task</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Title */}
      <h3 className="mt-3.5 mb-2 text-[16px] font-bold leading-snug tracking-tight text-[#0F172A] dark:text-slate-100 line-clamp-2">
        <span className={done ? "line-through decoration-slate-400/80 text-slate-500 dark:text-slate-400 opacity-80" : ""}>
          {t.title}
        </span>
      </h3>

      {/* Item pill badge */}
      {t.item_type && (
        <div className="mb-2">
          <ItemChip name={t.item_type} small />
        </div>
      )}

      {/* IP / Brand Labels */}
      {t.label_ids?.length > 0 && (
        <div className="mb-3">
          <Labels ids={t.label_ids} small />
        </div>
      )}

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

export default function Board({ tasks, onOpen, onNew, reload, onMoveTask }) {
  const { statuses } = useApp();
  const [over, setOver] = useState(null);
  const [draggingId, setDraggingId] = useState(null);
  const dark = document.documentElement.classList.contains("dark");

  const drop = async (e, key) => {
    e.preventDefault();
    e.stopPropagation();
    const id = e.dataTransfer.getData("task") || draggingId;
    setOver(null);
    setDraggingId(null);

    const t = tasks.find((x) => x.id === id);
    if (!t || t.status === key) return;

    const prevStatus = t.status;
    const targetStatus = statuses.find((s) => s.key === key);

    // 1. Optimistic Update: pindahkan posisi kartu secara instan di UI
    if (onMoveTask) {
      onMoveTask(id, {
        status: key,
        updated_at: new Date().toISOString(),
        progress: key === "done" || targetStatus?.is_done ? 100 : t.progress
      });
    }

    // 2. Play sound feedback
    if (targetStatus?.is_done || key === "done") {
      playSound("task_done");
    } else {
      playSound("click");
    }

    // 3. Persist to API
    try {
      await api.patch(`/tasks/${id}`, { status: key });
      toast.success(`Dipindahkan ke ${targetStatus?.name || key}`);
      // Silent sync with backend
      if (reload) reload(true);
    } catch (er) {
      // Rollback if network failed
      if (onMoveTask) {
        onMoveTask(id, { status: prevStatus });
      }
      toast.error(errMsg(er, "Gagal memindahkan tugas"));
    }
  };

  const handleDragStart = (e, taskId) => {
    e.dataTransfer.setData("task", taskId);
    e.dataTransfer.effectAllowed = "move";
    setDraggingId(taskId);
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setOver(null);
  };

  return (
    <div
      className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:[grid-template-columns:repeat(var(--cols),minmax(0,1fr))]"
      style={{ "--cols": statuses.length }}
      data-testid="task-board"
    >
      {statuses.map((s) => {
        const col = tasks.filter((t) => t.status === s.key);
        const isColumnOver = over === s.key;
        return (
          <div
            key={s.key}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              if (over !== s.key) setOver(s.key);
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget)) {
                setOver(null);
              }
            }}
            onDrop={(e) => drop(e, s.key)}
            className={`flex min-w-0 flex-col rounded-3xl p-3 transition-all duration-200 ease-out ${
              isColumnOver
                ? "ring-2 ring-brand/80 scale-[1.01] shadow-lg"
                : "ring-0 scale-100 shadow-none"
            }`}
            style={{
              background: dark ? `${s.color}1A` : s.color
            }}
            data-testid={`kanban-column-${s.key}`}
          >
            {/* Column Header */}
            <div className="mb-3 flex items-center gap-2 px-1">
              <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-surface px-1.5 text-xs font-bold text-ink shadow-2xs">
                {col.length}
              </span>
              <span className="flex-1 font-bold text-ink text-sm sm:text-base capitalize">
                {s.name}
              </span>
              <button
                onClick={() => onNew(s.key)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-sub hover:bg-surface hover:text-ink transition-colors"
                aria-label={`Add task to ${s.name}`}
                data-testid={`kanban-add-${s.key}`}
              >
                <Plus size={16} />
              </button>
            </div>

            {/* Column Task List */}
            <div className="flex min-h-[120px] flex-1 flex-col gap-3">
              {col.map((t) => (
                <TaskCard
                  key={`${t.id}_${t.updated_at || t.created_at || '1'}`}
                  t={t}
                  onOpen={onOpen}
                  done={s.is_done}
                  draggable
                  isDragging={draggingId === t.id}
                  onDragStart={(e) => handleDragStart(e, t.id)}
                  onDragEnd={handleDragEnd}
                  reload={reload}
                />
              ))}

              {/* Drop Target Helper when dragging over empty column */}
              {isColumnOver && draggingId && !col.some((x) => x.id === draggingId) && (
                <div className="pointer-events-none rounded-2xl border-2 border-dashed border-brand/60 bg-brand/5 p-4 text-center text-xs font-bold text-brand animate-pulse">
                  Lepas untuk pindahkan ke {s.name}
                </div>
              )}

              <button
                onClick={() => onNew(s.key)}
                className="mt-1 flex h-11 items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-[color:var(--c-border)] text-sm font-semibold text-sub hover:bg-surface hover:text-ink transition-colors"
              >
                + Add task
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
