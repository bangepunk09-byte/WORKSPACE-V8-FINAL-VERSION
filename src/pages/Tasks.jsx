import { useCallback, useEffect, useState, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { CheckSquare, Plus, Search, Download, KanbanSquare, List, GanttChart, CalendarDays, SlidersHorizontal, X, Settings2, Archive, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { api, errMsg, downloadFrom } from "../lib/api";
import { useApp } from "../context/AppContext";
import { PageHeader, AccentButton, GhostButton, Spinner, PRIORITY } from "../components/common";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../components/ui/dropdown-menu";
import Board from "./tasks/Board";
import ListView, { ColumnMenu, COLS, DEFAULT_HIDDEN } from "./tasks/ListView";
import { Timeline, Calendar } from "./tasks/TimelineCalendar";
import TaskCreate from "./tasks/TaskCreate";
import TaskDetail from "./tasks/TaskDetail";
import BoardDialog from "./tasks/BoardDialog";
import ArchiveView from "./tasks/ArchiveView";
import AutomationDialog from "./tasks/AutomationDialog";
import { Upload, Sparkles, FileSpreadsheet } from "lucide-react";

export const SAVED_VIEWS = [["all", "All Tasks"], ["active", "Active"], ["my", "My Tasks"], ["requested", "Requested by Me"], ["assigned", "Assigned to Me"], ["today", "Due Today"], ["upcoming", "Upcoming"], ["overdue", "Overdue"], ["issues", "Ada Kendala"], ["completed", "Completed"], ["archived", "Archived (Folder Bulanan)"]];
const VIEWS = [["board", "Board", KanbanSquare], ["list", "List", List], ["timeline", "Timeline", GanttChart], ["calendar", "Calendar", CalendarDays]];
const sel = "h-10 rounded-full border bg-surface text-sm font-medium text-ink shadow-sm transition-all hover:bg-surface2 focus:ring-2 focus:ring-brand/20 outline-none cursor-pointer";

const INITIAL_TASKS = [];
const DEFAULT_BOARDS = [{ id: "brd_1", name: "Main Board", color: "#2F7DE1", task_count: 0 }];

export const PRIMARY_SAVED_VIEWS = [
  ["all", "All Tasks"],
  ["active", "Active"],
  ["my", "My Tasks"],
  ["assigned", "Assigned to Me"],
];

export const MORE_SAVED_VIEWS = [
  ["today", "Due Today"],
  ["upcoming", "Upcoming"],
  ["overdue", "Overdue"],
  ["requested", "Requested by Me"],
  ["issues", "Ada Kendala"],
  ["completed", "Completed"],
  ["archived", "Archived (Folder Bulanan)"],
];

export function parseCSV(text) {
  const lines = [];
  let row = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      row.push(current.trim());
      current = "";
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && next === '\n') i++;
      row.push(current.trim());
      if (row.some((cell) => cell.length > 0)) {
        lines.push(row);
      }
      row = [];
      current = "";
    } else {
      current += char;
    }
  }
  if (current.length > 0 || row.length > 0) {
    row.push(current.trim());
    if (row.some((cell) => cell.length > 0)) {
      lines.push(row);
    }
  }

  if (lines.length < 2) return [];

  const headers = lines[0].map((h) => h.toLowerCase().replace(/[^a-z0-9_]/g, ""));
  const items = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i];
    const item = {};
    headers.forEach((header, idx) => {
      const val = values[idx] || "";
      if (!val) return;
      if (["title", "nama", "tugas", "name"].includes(header)) item.title = val;
      else if (["description", "deskripsi", "desc"].includes(header)) item.description = val;
      else if (["status"].includes(header)) item.status = val.toLowerCase().replace(/\s+/g, "_");
      else if (["priority", "prioritas"].includes(header)) item.priority = val.toLowerCase();
      else if (["assignee", "assignee_id", "petugas"].includes(header)) item.assignee_id = val;
      else if (["deadline", "tenggat", "due_date"].includes(header)) item.deadline = val;
      else if (["department", "divisi"].includes(header)) item.department = val;
      else if (["number", "number_str"].includes(header)) item.number_str = val;
    });

    if (!item.title && values.length >= 3) {
      if (headers[2] === "title" || headers[0] === "id") {
        item.title = values[2] || values[0];
      } else if (values[0]) {
        item.title = values[0];
      }
    }

    if (item.title) {
      items.push(item);
    }
  }

  return items;
}

let GLOBAL_TASKS_CACHE = null;

export function TaskWorkspace({ projectId, compactHeader }) {
  const { users, labels, statuses, subscribe, prefs, savePrefs, isManager, ws } = useApp();
  const [params, setParams] = useSearchParams();
  const [boards, setBoards] = useState(() => {
    try {
      const cached = localStorage.getItem("circle_boards_cache");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return DEFAULT_BOARDS;
  });
  const [boardId, setBoardId] = useState(params.get("board") || "");
  const [editBoard, setEditBoard] = useState(null);
  const [tasks, setTasks] = useState(() => {
    if (GLOBAL_TASKS_CACHE && Array.isArray(GLOBAL_TASKS_CACHE)) {
      return GLOBAL_TASKS_CACHE;
    }
    try {
      const cached = localStorage.getItem("circle_tasks_cache");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          GLOBAL_TASKS_CACHE = parsed;
          return parsed;
        }
      }
    } catch {}
    return INITIAL_TASKS;
  });
  const jsonInputRef = useRef(null);
  const csvInputRef = useRef(null);

  const importCSVTasks = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsedItems = parseCSV(text);
      if (!parsedItems.length) {
        return toast.error("File CSV tidak berisi data tugas yang valid. Pastikan header memiliki kolom Title/Judul.");
      }
      const { data } = await api.post("/tasks/import-csv", { items: parsedItems });
      toast.success(`Berhasil mengimpor ${data.count || parsedItems.length} kartu tugas dari file CSV!`);
      load();
    } catch (err) {
      toast.error(errMsg(err, "Gagal mengimpor file CSV"));
    } finally {
      e.target.value = "";
    }
  };

  const importJSONTasks = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const items = Array.isArray(parsed) ? parsed : (parsed.items || parsed.tasks || [parsed]);
      const { data } = await api.post("/tasks/import", { items });
      toast.success(`Berhasil mengimpor ${data.count || items.length} kartu tugas dari file JSON!`);
      load();
    } catch (err) {
      toast.error(errMsg(err, "Gagal mengimpor file JSON"));
    } finally {
      e.target.value = "";
    }
  };

  const [projects, setProjects] = useState({});
  const [saved, setSaved] = useState(params.get("view") || "all");
  const [view, setView] = useState(params.get("kanban") ? "board" : prefs.task_view || "board");
  const [f, setF] = useState({ q: "", label: params.get("label") || "", assignee_id: params.get("assignee") || "", priority: "", department: "" });
  const [groupBy, setGroupBy] = useState("none");
  const [selected, setSelected] = useState([]);
  const [create, setCreate] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const openId = params.get("task");
  const query = useCallback(() => ({
    view: saved,
    ...Object.fromEntries(Object.entries(f).filter(([, v]) => v)),
    ...(projectId ? { project_id: projectId } : {}),
    ...(boardId ? { board_id: boardId } : {})
  }), [saved, f, projectId, boardId]);
  const loadBoards = useCallback(() => api.get("/boards").then((r) => {
    if (Array.isArray(r.data) && r.data.length > 0) {
      setBoards(r.data);
      try { localStorage.setItem("circle_boards_cache", JSON.stringify(r.data)); } catch {}
    }
  }).catch(() => {}), []);
  useEffect(() => { loadBoards(); }, [loadBoards]);
  useEffect(() => subscribe((e) => e.type === "tasks:changed" && loadBoards()), [subscribe, loadBoards]);
  const pickBoard = (id) => { setBoardId(id); setSelected([]); if (id) params.set("board", id); else params.delete("board"); setParams(params); };
  const newTask = (extra = {}) => (boards?.length ? setCreate({ board_id: boardId, ...extra }) : toast.error("Kamu belum diundang ke board mana pun"));
  const load = useCallback(() => api.get("/tasks", { params: query() }).then((r) => {
    if (Array.isArray(r.data)) {
      setTasks(r.data);
      if (!Object.values(f).some(Boolean) && saved === "all" && !boardId && !projectId) {
        GLOBAL_TASKS_CACHE = r.data;
        try { localStorage.setItem("circle_tasks_cache", JSON.stringify(r.data)); } catch {}
      }
    }
  }).catch(() => {}), [query, f, saved, boardId, projectId]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { api.get("/projects").then((r) => setProjects(Object.fromEntries(r.data.map((p) => [p.id, p])))); }, []);
  useEffect(() => subscribe((e) => e.type === "tasks:changed" && load()), [subscribe, load]);
  const open = (id) => { params.set("task", id); setParams(params); };
  const close = () => { params.delete("task"); setParams(params); };
  const switchView = (v) => {
    setView(v);
    if (v === "archive") {
      setSaved("archived");
    } else if (saved === "archived") {
      setSaved("all");
    }
    savePrefs({ task_view: v }).catch(() => {});
  };
  const exp = async (format, ids) => {
    try {
      const res = await downloadFrom("/tasks/export", { ...query(), format, ...(ids ? { ids: ids.join(",") } : {}) }, `circle-tasks.${format}`);
      toast.success(`Exported ${res.headers["x-record-count"] || ""} tasks`.replace("  ", " "));
    } catch (e) { toast.error(errMsg(e, "Export failed")); }
  };
  const bulk = async (patch) => { try { const { data } = await api.post("/tasks/bulk", { ids: selected, patch }); toast.success(`Updated ${data.updated} tasks`); setSelected([]); load(); } catch (e) { toast.error(errMsg(e)); } };
  const depts = [...new Set(users.map((u) => u.department).filter(Boolean))];
  const active = Object.values(f).filter(Boolean).length;
  const activeMoreView = MORE_SAVED_VIEWS.find(([k]) => k === saved);

  return (
    <div className="space-y-4">
      {/* 1. Header with Compact Action Group */}
      {!compactHeader && (
        <PageHeader
          icon={CheckSquare}
          title="Tasks"
          subtitle="One shared task database across board, list, timeline and calendar."
          actions={
            <div className="flex items-center gap-2">
              <input type="file" ref={jsonInputRef} onChange={importJSONTasks} accept=".json,application/json" className="hidden" />
              <input type="file" ref={csvInputRef} onChange={importCSVTasks} accept=".csv,text/csv" className="hidden" />
              <AccentButton onClick={() => newTask()} className="h-10 rounded-full px-4 text-sm font-semibold shadow-xs" data-testid="new-task-btn">
                <Plus size={15} />
                <span>Tugas Baru</span>
              </AccentButton>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <GhostButton className="h-10 rounded-full px-4 text-sm font-medium" data-testid="export-menu-btn">
                    <Download size={15} />
                    <span>Ekspor / Impor</span>
                    <ChevronDown size={12} className="opacity-60 ml-0.5" />
                  </GhostButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="bg-surface min-w-[210px]" align="end">
                  <DropdownMenuItem onClick={() => exp("csv")} data-testid="export-csv-btn">
                    <Download size={13} className="mr-2" /> Ekspor CSV (Filter aktif)
                  </DropdownMenuItem>
                  {selected.length > 0 && (
                    <DropdownMenuItem onClick={() => exp("csv", selected)} data-testid="export-selected-btn">
                      <Download size={13} className="mr-2" /> Ekspor terpilih ({selected.length})
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => exp("json")} data-testid="export-json-btn">
                    <Download size={13} className="mr-2" /> Ekspor JSON
                  </DropdownMenuItem>
                  <div className="my-1 border-t opacity-50" />
                  <DropdownMenuItem onClick={() => csvInputRef.current?.click()} data-testid="import-csv-btn">
                    <FileSpreadsheet size={13} className="mr-2 text-emerald-600 dark:text-emerald-400" /> Impor File CSV (.csv)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => jsonInputRef.current?.click()} data-testid="import-json-btn">
                    <Upload size={13} className="mr-2 text-blue-600 dark:text-blue-400" /> Impor File JSON (.json)
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <GhostButton
                onClick={() => switchView("archive")}
                className={`h-10 rounded-full px-4 text-sm font-medium transition-all ${
                  view === "archive" || saved === "archived"
                    ? "bg-brand text-white font-bold shadow-xs"
                    : "bg-surface text-sub hover:text-ink hover:bg-surface2 border"
                }`}
                data-testid="archive-header-btn"
              >
                <Archive size={15} />
                <span>Arsip</span>
              </GhostButton>
            </div>
          }
        />
      )}

      {compactHeader && (
        <div className="mb-2 flex justify-end gap-2">
          <AccentButton onClick={() => newTask()} className="h-10 rounded-full px-4 text-sm font-semibold" data-testid="new-task-btn">
            <Plus size={15} /> Tugas Baru
          </AccentButton>
          <GhostButton onClick={() => exp("csv")} className="h-10 rounded-full px-4 text-sm font-medium" data-testid="export-csv-btn">
            <Download size={15} /> Ekspor/Impor
          </GhostButton>
          <GhostButton onClick={() => switchView("archive")} className="h-10 rounded-full px-4 text-sm font-medium border" data-testid="archive-header-btn">
            <Archive size={15} /> Arsip
          </GhostButton>
        </div>
      )}

      {editBoard && (
        <BoardDialog
          board={editBoard}
          onClose={() => setEditBoard(null)}
          onSaved={(b) => {
            loadBoards();
            load();
            if (!b && editBoard.id === boardId) pickBoard("");
          }}
        />
      )}

      {/* Unified Toolbar: Board Dropdown, Search, Filter, Columns (Left) + View Switcher (Right) */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        {/* Left Group: Board Dropdown + Search + Filter + Columns */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {!projectId && (
            <div className="flex items-center gap-1.5">
              <select
                value={boardId}
                onChange={(e) => pickBoard(e.target.value)}
                className="h-10 rounded-full border bg-surface px-4 text-xs sm:text-sm font-semibold text-ink shadow-xs outline-none hover:bg-surface2 cursor-pointer transition-all"
                data-testid="board-dropdown-select"
              >
                <option value="">Semua Board</option>
                {boards.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.task_count || 0})
                  </option>
                ))}
              </select>
              {isManager && (
                <button
                  onClick={() => setEditBoard({})}
                  className="flex h-10 w-10 items-center justify-center rounded-full border bg-surface text-brand hover:bg-brand/10 transition-colors shrink-0 shadow-xs"
                  title="Buat Board Baru"
                  data-testid="board-new-btn"
                >
                  <Plus size={16} />
                </button>
              )}
            </div>
          )}

          <div className="relative flex h-10 min-w-[200px] flex-1 sm:w-64 sm:flex-none items-center rounded-full border bg-surface px-4 shadow-xs transition-all focus-within:ring-2 focus-within:ring-brand/20 focus-within:border-brand">
            <Search size={16} className="text-sub mr-2 shrink-0" />
            <input
              value={f.q}
              onChange={(e) => setF({ ...f, q: e.target.value })}
              placeholder="Cari tugas atau ID..."
              className="w-full bg-transparent text-xs sm:text-sm outline-none placeholder:text-sub text-ink"
              data-testid="task-search-input"
            />
            {f.q && (
              <button onClick={() => setF({ ...f, q: "" })} className="text-sub hover:text-ink p-1 rounded-full" aria-label="Hapus pencarian">
                <X size={13} />
              </button>
            )}
          </div>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex h-10 items-center gap-2 rounded-full border px-4 text-xs sm:text-sm font-semibold transition-all shadow-xs ${
              showFilters || active > 0
                ? "bg-brand text-white border-transparent font-bold"
                : "bg-surface text-sub hover:text-ink hover:bg-surface2"
            }`}
            data-testid="mobile-filters-btn"
          >
            <SlidersHorizontal size={15} />
            <span>Filter</span>
            {active > 0 && (
              <span className={`flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[11px] font-extrabold ${
                showFilters || active > 0 ? "bg-white text-brand" : "bg-brand text-white"
              }`}>
                {active}
              </span>
            )}
          </button>

          {view === "list" && (() => {
            const allCols = [...COLS, ...(ws.task_fields || []).map((field) => [field.key, field.name, 10])];
            const sheetCols = [...((prefs.task_sheet?.order || [])).map((k) => allCols.find((c) => c[0] === k)).filter(Boolean), ...allCols.filter((c) => !((prefs.task_sheet?.order || [])).includes(c[0]))];
            return <ColumnMenu cols={sheetCols} cfg={prefs.task_sheet || { hidden: DEFAULT_HIDDEN }} save={(c) => savePrefs({ task_sheet: c })} />;
          })()}
        </div>

        {/* Display Modes (Board, List, Timeline, Calendar, Arsip) on Right */}
        <div className="flex h-10 items-center gap-0.5 rounded-full border bg-surface p-1 shadow-2xs shrink-0 self-start sm:self-auto" data-testid="view-switcher">
          {VIEWS.map(([k, l, I]) => (
            <button
              key={k}
              onClick={() => switchView(k)}
              className={`flex h-8 items-center gap-1.5 rounded-full px-3 md:px-3.5 text-xs sm:text-sm font-semibold transition-all ${
                view === k
                  ? "bg-brand text-white shadow-xs font-bold"
                  : "text-sub hover:text-ink hover:bg-surface2"
              }`}
              data-testid={`view-${k}`}
            >
              <I size={14} />
              <span className="hidden sm:inline">{l}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 4. Collapsible Clean Filter Bar (shown when toggled or when active filters exist) */}
      {(showFilters || active > 0) && (
        <div
          className="flex flex-wrap items-center gap-2 rounded-2xl border bg-surface p-2.5 shadow-2xs animate-subpage-enter"
          data-testid="filter-strip"
        >
          <span className="text-[11px] font-bold uppercase tracking-wider text-sub px-1">Filter:</span>
          <select
            value={saved}
            onChange={(e) => { setSaved(e.target.value); setSelected([]); }}
            className="h-8 rounded-lg border bg-surface2 px-2 text-xs font-medium text-ink outline-none hover:bg-surface transition-colors"
            data-testid="filter-saved-view"
          >
            <optgroup label="Tampilan Utama">
              {PRIMARY_SAVED_VIEWS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </optgroup>
            <optgroup label="Tampilan Lainnya">
              {MORE_SAVED_VIEWS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </optgroup>
          </select>
          <select
            value={f.label}
            onChange={(e) => setF({ ...f, label: e.target.value })}
            className="h-8 rounded-lg border bg-surface2 px-2 text-xs font-medium text-ink outline-none hover:bg-surface transition-colors"
            data-testid="filter-label"
          >
            <option value="">Semua Brand</option>
            {labels.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
          <select
            value={f.assignee_id}
            onChange={(e) => setF({ ...f, assignee_id: e.target.value })}
            className="h-8 rounded-lg border bg-surface2 px-2 text-xs font-medium text-ink outline-none hover:bg-surface transition-colors"
            data-testid="filter-assignee"
          >
            <option value="">Semua Assignee</option>
            {users.map((u) => <option key={u.user_id} value={u.user_id}>{u.name}</option>)}
          </select>
          <select
            value={f.priority}
            onChange={(e) => setF({ ...f, priority: e.target.value })}
            className="h-8 rounded-lg border bg-surface2 px-2 text-xs font-medium text-ink outline-none hover:bg-surface transition-colors"
            data-testid="filter-priority"
          >
            <option value="">Semua Prioritas</option>
            {Object.entries(PRIORITY).map(([k, p]) => <option key={k} value={k}>{p.name}</option>)}
          </select>
          <select
            value={f.department}
            onChange={(e) => setF({ ...f, department: e.target.value })}
            className="h-8 rounded-lg border bg-surface2 px-2 text-xs font-medium text-ink outline-none hover:bg-surface transition-colors"
            data-testid="filter-task-department"
          >
            <option value="">Semua Divisi</option>
            {depts.map((d) => <option key={d}>{d}</option>)}
          </select>
          {view === "list" && (
            <select
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value)}
              className="h-8 rounded-lg border bg-surface2 px-2 text-xs font-medium text-ink outline-none hover:bg-surface transition-colors"
              data-testid="group-by-select"
            >
              <option value="status">Group: Status</option>
              <option value="assignee">Group: Assignee</option>
              <option value="department">Group: Department</option>
              <option value="label">Group: IP / Brand</option>
              <option value="none">No grouping</option>
            </select>
          )}
          {active > 0 && (
            <button
              onClick={() => setF({ q: "", label: "", assignee_id: "", priority: "", department: "" })}
              className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors ml-auto"
              data-testid="clear-filters-btn"
            >
              <X size={13} /> Reset Filter
            </button>
          )}
        </div>
      )}
      {selected.length > 0 && (
        <div className="sticky top-16 md:top-2 z-30 mb-4 flex flex-wrap items-center gap-2 rounded-2xl border bg-surface p-2.5 shadow-lg" data-testid="bulk-actions-bar">
          <span className="px-2 text-sm font-semibold">{selected.length} selected</span>
          <select onChange={(e) => e.target.value && bulk({ status: e.target.value })} value="" className="h-9 rounded-full border bg-surface2 px-3 text-sm" data-testid="bulk-status"><option value="">Set status…</option>{statuses.map((s) => <option key={s.key} value={s.key}>{s.name}</option>)}</select>
          <select onChange={(e) => e.target.value && bulk({ priority: e.target.value })} value="" className="h-9 rounded-full border bg-surface2 px-3 text-sm" data-testid="bulk-priority"><option value="">Set priority…</option>{Object.entries(PRIORITY).map(([k, p]) => <option key={k} value={k}>{p.name}</option>)}</select>
          <select onChange={(e) => e.target.value && bulk({ assignee_id: e.target.value })} value="" className="h-9 rounded-full border bg-surface2 px-3 text-sm" data-testid="bulk-assignee"><option value="">Assign to…</option>{users.map((u) => <option key={u.user_id} value={u.user_id}>{u.name}</option>)}</select>
          <button onClick={() => bulk({ archived: saved !== "archived" })} className="h-9 rounded-full border px-3 text-sm font-medium" data-testid="bulk-archive">{saved === "archived" ? "Unarchive" : "Archive"}</button>
          <button onClick={() => exp("csv", selected)} className="h-9 rounded-full border px-3 text-sm font-medium" data-testid="bulk-export">Export</button>
          <button onClick={() => setSelected([])} className="ml-auto text-sub" aria-label="Clear selection"><X size={16} /></button>
        </div>
      )}
        <div key={view === "archive" || saved === "archived" ? "archive" : view} className="min-h-[350px]">
          {(view === "archive" || saved === "archived") ? <ArchiveView tasks={tasks} onOpen={open} reload={load} projects={projects} />
          : view === "board" ? <Board tasks={tasks} onOpen={open} onNew={(status) => newTask({ status })} reload={load} />
          : view === "list" ? <ListView tasks={tasks} projects={projects} onOpen={open} selected={selected} setSelected={setSelected} reload={load} groupBy={groupBy} boardId={boardId} />
          : view === "timeline" ? <Timeline tasks={tasks} onOpen={open} /> : <Calendar tasks={tasks} onOpen={open} />}
        </div>
      <TaskCreate open={!!create} onOpenChange={(v) => !v && setCreate(null)} defaults={{ ...create, project_id: projectId }} onCreated={load} />
      <TaskDetail id={openId} onClose={close} onChanged={load} />
    </div>
  );
}

export default function Tasks() {
  return <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-10 lg:py-10 animate-crossfade" data-testid="tasks-page"><TaskWorkspace /></div>;
}
