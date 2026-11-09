import { useState, useMemo } from "react";
import { Folder, FolderOpen, Search, Filter, RotateCcw, Calendar, CheckCircle2, Zap, ArrowRight, X, Clock, User, ChevronDown, ChevronRight, Inbox } from "lucide-react";
import { format, parseISO } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { toast } from "sonner";
import { api, errMsg } from "../../lib/api";
import { useApp } from "../../context/AppContext";
import { Avatar, Labels, PriorityBadge, PRIORITY } from "../../components/common";
import { playSound } from "../../lib/sound";

const MONTH_NAMES = {
  "01": "Januari", "02": "Februari", "03": "Maret", "04": "April",
  "05": "Mei", "06": "Juni", "07": "Juli", "08": "Agustus",
  "09": "September", "10": "Oktober", "11": "November", "12": "Desember"
};

function formatMonthFolder(monthKey) {
  if (!monthKey || monthKey.length < 7) return "Lainnya / Tanpa Tanggal";
  const [year, month] = monthKey.split("-");
  return `${MONTH_NAMES[month] || month} ${year}`;
}

export default function ArchiveView({ tasks, onOpen, reload, projects }) {
  const { users, labels } = useApp();
  const [search, setSearch] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedAssignee, setSelectedAssignee] = useState("");
  const [selectedPriority, setSelectedPriority] = useState("");
  const [selectedDept, setSelectedDept] = useState("");
  const [openFolders, setOpenFolders] = useState({});
  const [syncing, setSyncing] = useState(false);

  // Filter tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (search) {
        const q = search.toLowerCase();
        const matchesTitle = (t.title || "").toLowerCase().includes(q);
        const matchesDesc = (t.description || "").toLowerCase().includes(q);
        const matchesNum = (t.number_str || "").toLowerCase().includes(q);
        if (!matchesTitle && !matchesDesc && !matchesNum) return false;
      }
      if (selectedMonth && (t.archived_month || (t.archived_at || t.completed_at || "").slice(0, 7)) !== selectedMonth) {
        return false;
      }
      if (selectedAssignee && t.assignee_id !== selectedAssignee) {
        return false;
      }
      if (selectedPriority && (t.priority || "").toLowerCase() !== selectedPriority.toLowerCase()) {
        return false;
      }
      if (selectedDept && t.department !== selectedDept) {
        return false;
      }
      return true;
    });
  }, [tasks, search, selectedMonth, selectedAssignee, selectedPriority, selectedDept]);

  // Group into monthly folders
  const monthlyFolders = useMemo(() => {
    const groups = {};
    filteredTasks.forEach((t) => {
      const monthKey = t.archived_month || (t.archived_at || t.completed_at || t.created_at || "").slice(0, 7) || "unknown";
      if (!groups[monthKey]) {
        groups[monthKey] = [];
      }
      groups[monthKey].push(t);
    });

    // Sort folders descending (latest month first)
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
  }, [filteredTasks]);

  // Available months from all tasks for the filter dropdown
  const allMonths = useMemo(() => {
    const m = new Set();
    tasks.forEach((t) => {
      const key = t.archived_month || (t.archived_at || t.completed_at || t.created_at || "").slice(0, 7);
      if (key && key.length === 7) m.add(key);
    });
    return Array.from(m).sort((a, b) => b.localeCompare(a));
  }, [tasks]);

  const toggleFolder = (key) => {
    setOpenFolders((prev) => ({
      ...prev,
      [key]: prev[key] === undefined ? false : !prev[key]
    }));
  };

  const isFolderOpen = (key) => {
    return openFolders[key] !== false; // Open by default
  };

  const unarchiveTask = async (id, e) => {
    e?.stopPropagation();
    try {
      await api.patch(`/tasks/${id}`, { archived: false, status: "todo" });
      playSound("click");
      toast.success("Tugas dipulihkan dan dikembalikan ke Board!");
      reload?.();
    } catch (err) {
      toast.error(errMsg(err, "Gagal memulihkan tugas"));
    }
  };

  const triggerAutoArchive = async () => {
    setSyncing(true);
    try {
      const res = await api.post("/tasks/auto-archive");
      playSound("task_done");
      toast.success(res.data?.message || "Auto-archive mingguan selesai diproses!");
      reload?.();
    } catch (err) {
      toast.error(errMsg(err, "Gagal memproses auto-archive"));
    } finally {
      setSyncing(false);
    }
  };

  const depts = [...new Set(users.map((u) => u.department).filter(Boolean))];

  return (
    <div className="space-y-5 animate-rise" data-testid="task-archive-view">
      {/* Auto-archive system banner */}
      <div className="flex flex-col gap-3 rounded-2xl border border-sky-200 bg-sky-50/70 p-4 text-sky-900 sm:flex-row sm:items-center sm:justify-between dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-200">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-sky-500 text-white shadow-sm">
            <Zap size={16} />
          </div>
          <div>
            <p className="text-sm font-bold">Auto-Archive Mingguan Aktif</p>
            <p className="text-xs text-sky-800/90 dark:text-sky-300/90">
              Kartu dengan status <b>Selesai (Done)</b> otomatis diarsipkan ke dalam folder bulanan setiap hari <b>Minggu pukul 23:00 WIB</b>.
            </p>
          </div>
        </div>
        <button
          onClick={triggerAutoArchive}
          disabled={syncing}
          className="flex shrink-0 items-center gap-1.5 rounded-xl bg-sky-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition-transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 dark:bg-sky-500"
          data-testid="trigger-auto-archive-btn"
        >
          <RotateCcw size={13} className={syncing ? "animate-spin" : ""} />
          {syncing ? "Memproses..." : "Arsipkan Kartu Selesai Sekarang"}
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center gap-2.5 rounded-2xl border bg-surface p-3 shadow-sm">
        <div className="flex min-w-[200px] flex-1 items-center gap-2 rounded-xl border bg-surface2 px-3">
          <Search size={15} className="text-sub" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari dalam arsip tugas (judul, ID, atau deskripsi)..."
            className="h-10 flex-1 bg-transparent text-sm outline-none placeholder:text-sub"
            data-testid="archive-search-input"
          />
          {search && (
            <button onClick={() => setSearch("")} className="text-sub hover:text-ink">
              <X size={14} />
            </button>
          )}
        </div>

        {/* Month Folder Filter */}
        <select
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="h-10 rounded-xl border bg-surface2 px-3 text-xs font-medium outline-none"
          data-testid="archive-filter-month"
        >
          <option value="">Semua Bulan Folder</option>
          {allMonths.map((m) => (
            <option key={m} value={m}>
              📁 {formatMonthFolder(m)}
            </option>
          ))}
        </select>

        {/* Assignee Filter */}
        <select
          value={selectedAssignee}
          onChange={(e) => setSelectedAssignee(e.target.value)}
          className="h-10 rounded-xl border bg-surface2 px-3 text-xs font-medium outline-none"
          data-testid="archive-filter-assignee"
        >
          <option value="">Semua PIC / Assignee</option>
          {users.map((u) => (
            <option key={u.user_id} value={u.user_id}>
              {u.name}
            </option>
          ))}
        </select>

        {/* Priority Filter */}
        <select
          value={selectedPriority}
          onChange={(e) => setSelectedPriority(e.target.value)}
          className="h-10 rounded-xl border bg-surface2 px-3 text-xs font-medium outline-none"
          data-testid="archive-filter-priority"
        >
          <option value="">Semua Prioritas</option>
          {Object.entries(PRIORITY).map(([k, p]) => (
            <option key={k} value={k}>
              {p.name}
            </option>
          ))}
        </select>

        {/* Department Filter */}
        {depts.length > 0 && (
          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="h-10 rounded-xl border bg-surface2 px-3 text-xs font-medium outline-none"
            data-testid="archive-filter-dept"
          >
            <option value="">Semua Divisi</option>
            {depts.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        )}

        {(search || selectedMonth || selectedAssignee || selectedPriority || selectedDept) && (
          <button
            onClick={() => {
              setSearch("");
              setSelectedMonth("");
              setSelectedAssignee("");
              setSelectedPriority("");
              setSelectedDept("");
            }}
            className="flex items-center gap-1 rounded-xl px-2 py-1.5 text-xs font-semibold text-brand hover:underline"
          >
            <X size={13} /> Reset Filter
          </button>
        )}
      </div>

      {/* Monthly Folders List */}
      <div className="space-y-4">
        {monthlyFolders.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed bg-surface p-12 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface2 text-sub">
              <Inbox size={28} />
            </div>
            <h4 className="mt-4 text-base font-bold">Tidak ada tugas dalam arsip</h4>
            <p className="mt-1 max-w-sm text-xs text-sub">
              {search || selectedMonth
                ? "Tidak ada tugas arsip yang cocok dengan kata kunci atau filter yang dipilih."
                : "Tugas yang selesai akan otomatis masuk ke folder arsip tiap Minggu pukul 23:00 WIB, atau klik tombol di atas untuk mengarsipkan sekarang."}
            </p>
          </div>
        ) : (
          monthlyFolders.map(([monthKey, folderTasks]) => {
            const isOpen = isFolderOpen(monthKey);
            const folderName = formatMonthFolder(monthKey);

            return (
              <div
                key={monthKey}
                className="overflow-hidden rounded-3xl border bg-surface shadow-sm transition-all"
                data-testid={`archive-folder-${monthKey}`}
              >
                {/* Folder Accordion Header */}
                <button
                  onClick={() => toggleFolder(monthKey)}
                  className="flex w-full items-center justify-between gap-3 border-b bg-surface2/60 px-5 py-4 text-left transition-colors hover:bg-surface2"
                  data-testid={`folder-toggle-${monthKey}`}
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-300">
                      {isOpen ? <FolderOpen size={18} /> : <Folder size={18} />}
                    </span>
                    <div>
                      <h3 className="text-base font-bold text-ink flex items-center gap-2">
                        {folderName}
                        <span className="rounded-full bg-surface px-2.5 py-0.5 text-xs font-bold text-sub shadow-sm">
                          {folderTasks.length} tugas
                        </span>
                      </h3>
                      <p className="text-[11px] text-sub">
                        Periode arsip otomatis bulanan · {folderTasks.filter((t) => t.status === "done").length} tugas selesai
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sub">
                    <span className="text-xs font-medium">{isOpen ? "Tutup Folder" : "Buka Folder"}</span>
                    {isOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                  </div>
                </button>

                {/* Folder Content / Tasks List */}
                {isOpen && (
                  <div className="divide-y p-1">
                    {folderTasks.map((task) => {
                      const user = users.find((u) => u.user_id === task.assignee_id);
                      const project = projects?.[task.project_id];

                      let completedTimeStr = "Selesai";
                      if (task.completed_at || task.archived_at) {
                        try {
                          const dateObj = new Date(task.completed_at || task.archived_at);
                          completedTimeStr = format(dateObj, "d MMM yyyy, HH:mm", { locale: localeId }) + " WIB";
                        } catch {
                          completedTimeStr = "Selesai";
                        }
                      }

                      return (
                        <div
                          key={task.id}
                          onClick={() => onOpen(task.id)}
                          className="group flex flex-col gap-3 rounded-2xl p-4 transition-colors hover:bg-surface2/80 sm:flex-row sm:items-center sm:justify-between cursor-pointer"
                          data-testid={`archive-task-${task.id}`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-xs font-bold text-sub w-16">{task.number_str || "TSK"}</span>
                              <PriorityBadge value={task.priority} />
                              {project && (
                                <span className="rounded-lg bg-surface2 px-2 py-0.5 text-[11px] font-semibold text-sub">
                                  📁 {project.name}
                                </span>
                              )}
                              <Labels ids={task.label_ids} small max={2} />
                            </div>
                            <h4 className="mt-1.5 text-sm font-bold text-ink group-hover:text-brand transition-colors">
                              {task.title}
                            </h4>
                            {task.description && (
                              <p className="mt-0.5 line-clamp-1 text-xs text-sub opacity-85">
                                {task.description.replace(/<[^>]*>?/gm, "")}
                              </p>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-4 text-xs text-sub sm:shrink-0">
                            <div className="flex items-center gap-2">
                              <Avatar user={user} size={24} showStatus={false} />
                              <span className="font-medium text-ink">{user?.name || "Unassigned"}</span>
                            </div>

                            <span className="flex items-center gap-1 text-[11px]" title="Waktu selesai/arsip">
                              <CheckCircle2 size={13} className="text-emerald-500" />
                              {completedTimeStr}
                            </span>

                            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={(e) => unarchiveTask(task.id, e)}
                                className="flex items-center gap-1 rounded-xl border bg-surface px-2.5 py-1 text-xs font-semibold text-sub hover:bg-surface2 hover:text-ink transition-colors"
                                title="Kembalikan tugas ini ke papan Kanban aktif"
                                data-testid={`unarchive-task-${task.id}`}
                              >
                                <RotateCcw size={12} />
                                Pulihkan
                              </button>
                              <button
                                onClick={() => onOpen(task.id)}
                                className="flex items-center gap-1 rounded-xl bg-surface2 px-2.5 py-1 text-xs font-semibold text-brand hover:underline"
                              >
                                Detail <ArrowRight size={12} />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
