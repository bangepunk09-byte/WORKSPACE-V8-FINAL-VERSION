import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { id as localeId } from "date-fns/locale";
import {
  CheckSquare,
  Clock,
  Video,
  ChevronRight,
  Plus,
  MessageSquare,
  CalendarDays,
  CheckCircle2,
  Image,
  ExternalLink,
  Sparkles,
  BarChart3,
  Flame,
  Zap,
  TrendingUp,
  Settings2,
  SlidersHorizontal,
  Eye,
  EyeOff,
  ArrowLeft,
  ArrowRight,
  RotateCcw,
  LayoutGrid,
  Columns,
  Maximize2,
  Check,
  Move
} from "lucide-react";
import { toast } from "sonner";
import { useApp } from "../context/AppContext";
import { api, errMsg, fileUrl } from "../lib/api";
import { bgLayer } from "../lib/theme";
import { Avatar, AvatarStack, AccentButton, GhostButton, dueInfo, fmtDate } from "../components/common";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "../components/ui/sheet";
import BackgroundEditor from "./settings/BackgroundEditor";
import TaskCreate from "./tasks/TaskCreate";
import TaskDetail from "./tasks/TaskDetail";
import MonthlyStats from "./dashboard/MonthlyStats";
import { playSound } from "../lib/sound";

const DEFAULT_WIDGET_CONFIG = {
  columns: ["meetings", "tasks", "messages"],
  visible: {
    meetings: true,
    tasks: true,
    messages: true,
    performance: true,
    personnel: true
  },
  gridStyle: "3col", // '3col' | '2col' | 'focus'
  density: "spacious" // 'spacious' | 'normal' | 'compact'
};

const WIDGET_LABELS = {
  meetings: {
    title: "Jadwal Meeting Mendatang",
    desc: "Agenda rapat Google Calendar & Google Meet",
    icon: Video,
    color: "emerald"
  },
  tasks: {
    title: "Tugas Prioritas Hari Ini",
    desc: "Checklist tugas operasional & deadline aktif",
    icon: CheckSquare,
    color: "amber"
  },
  messages: {
    title: "Pesan & Diskusi Tim",
    desc: "Feed pengumuman BoD & channel obrolan",
    icon: MessageSquare,
    color: "purple"
  }
};

import { INITIAL_TASKS } from "../data/initialTasks";

export default function Dashboard() {
  const { me, prefs, userMap, statuses, t, lang } = useApp();
  // Dashboard Data Caching & Hydration
  const [tasks, setTasks] = useState(() => {
    try {
      const saved = localStorage.getItem("circle_cache_tasks");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return INITIAL_TASKS.slice(0, 8);
  });
  const [meetings, setMeetings] = useState(() => {
    try {
      const saved = localStorage.getItem("circle_cache_meetings");
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [posts, setPosts] = useState(() => {
    try {
      const saved = localStorage.getItem("circle_cache_posts");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [
      {
        id: "pst_init_1",
        author_id: "user_admin1",
        text: "Selamat datang di workspace internal ASLI RI! 🎉 Silakan gunakan Beranda ini untuk update info & diskusi.",
        created_at: new Date(Date.now() - 3600000 * 5).toISOString()
      }
    ];
  });
  const [conversations, setConversations] = useState(() => {
    try {
      const saved = localStorage.getItem("circle_cache_conversations");
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  const [loading, setLoading] = useState(false);
  const [bgOpen, setBgOpen] = useState(false);
  const [layoutOpen, setLayoutOpen] = useState(false);
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [reactionCounts, setReactionCounts] = useState({
    "😍": 14,
    "❤️": 28,
    "🔥": 35,
    "⚡": 19,
    "🤝": 22
  });
  const [userReacted, setUserReacted] = useState({});
  const navigate = useNavigate();

  // Widget Layout Configuration
  const [widgetLayout, setWidgetLayout] = useState(() => {
    try {
      const saved = localStorage.getItem("circle_dashboard_layout_v2");
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...DEFAULT_WIDGET_CONFIG,
          ...parsed,
          visible: { ...DEFAULT_WIDGET_CONFIG.visible, ...(parsed.visible || {}) }
        };
      }
    } catch (e) {
      // ignore
    }
    return DEFAULT_WIDGET_CONFIG;
  });

  const updateLayout = (updater) => {
    setWidgetLayout((prev) => {
      const next = typeof updater === "function" ? updater(prev) : { ...prev, ...updater };
      try {
        localStorage.setItem("circle_dashboard_layout_v2", JSON.stringify(next));
      } catch (e) {
        // ignore
      }
      return next;
    });
  };

  const moveColumn = (colKey, direction) => {
    playSound("click");
    updateLayout((prev) => {
      const cols = [...prev.columns];
      const idx = cols.indexOf(colKey);
      if (idx === -1) return prev;
      const targetIdx = idx + direction;
      if (targetIdx < 0 || targetIdx >= cols.length) return prev;
      const temp = cols[idx];
      cols[idx] = cols[targetIdx];
      cols[targetIdx] = temp;
      return { ...prev, columns: cols };
    });
  };

  const toggleWidget = (widgetKey) => {
    playSound("click");
    updateLayout((prev) => ({
      ...prev,
      visible: {
        ...prev.visible,
        [widgetKey]: !prev.visible[widgetKey]
      }
    }));
  };

  const resetLayout = () => {
    playSound("click");
    updateLayout(DEFAULT_WIDGET_CONFIG);
    toast.success("Tata letak dikembalikan ke pengaturan default.");
  };

  const loadData = async () => {
    try {
      const [tRes, mRes, pRes, cRes] = await Promise.all([
        api.get("/tasks"),
        api.get("/meetings").catch(() => ({ data: [] })),
        api.get("/posts").catch(() => ({ data: [] })),
        api.get("/conversations").catch(() => ({ data: [] }))
      ]);

      setTasks(tRes.data || []);
      setMeetings(mRes.data || []);
      setPosts(pRes.data || []);
      setConversations(cRes.data || []);

      // Update Cache
      localStorage.setItem("circle_cache_tasks", JSON.stringify(tRes.data || []));
      localStorage.setItem("circle_cache_meetings", JSON.stringify(mRes.data || []));
      localStorage.setItem("circle_cache_posts", JSON.stringify(pRes.data || []));
      localStorage.setItem("circle_cache_conversations", JSON.stringify(cRes.data || []));
    } catch (e) {
      console.warn("Failed to load dashboard data:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const toggleTaskDone = async (t, e) => {
    e.stopPropagation();
    const isDone = t.status === "done";
    const nextStatus = isDone ? "in_progress" : "done";
    try {
      if (!isDone) {
        playSound("task_done");
      } else {
        playSound("click");
      }
      setTasks((prev) =>
        prev.map((item) => (item.id === t.id ? { ...item, status: nextStatus, progress: !isDone ? 100 : 50 } : item))
      );
      await api.patch(`/tasks/${t.id}`, { status: nextStatus });
      toast.success(isDone ? `Tugas dikembalikan ke In Progress` : `Tugas selesai! (100%)`);
    } catch (err) {
      toast.error(errMsg(err));
      loadData();
    }
  };

  const handleReactionClick = (emoji) => {
    playSound("click");
    const active = userReacted[emoji];
    setUserReacted((prev) => ({ ...prev, [emoji]: !active }));
    setReactionCounts((prev) => ({
      ...prev,
      [emoji]: (prev[emoji] || 0) + (active ? -1 : 1)
    }));
  };

  const layer = bgLayer(prefs.background, prefs.background?.file_id ? fileUrl(prefs.background.file_id) : null);
  const hour = new Date().getHours();
  const greet = lang === "en"
    ? (hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening")
    : (hour < 11 ? "Selamat pagi" : hour < 15 ? "Selamat siang" : hour < 18 ? "Selamat sore" : "Selamat malam");

  // Data for Column 1: Meetings
  const displayMeetings = meetings.slice(0, 3);

  // Data for Column 2: Today's Priority Tasks
  const todayTasks = tasks.slice(0, 3);

  // Data for Column 3: Last Conversation
  const sortedConversations = [...conversations].sort((a, b) => new Date(b.last_message_at || 0) - new Date(a.last_message_at || 0));
  const lastConversation = sortedConversations[0] || {
    id: "conv_1",
    name: "General",
    last_message_preview: "Belum ada pesan terbaru",
    unread: 0
  };

  // Density Spacing Presets (Extra spacious by default to prevent cramping)
  const densityStyles = {
    spacious: {
      outer: "space-y-10 py-8 px-4 sm:px-6 lg:px-8",
      gridGap: "gap-8",
      cardPadding: "p-7 sm:p-8",
      cardHeader: "pb-5 mb-5",
      itemSpacing: "space-y-4",
      itemPadding: "p-4 sm:p-5",
      footerMargin: "mt-7 pt-5"
    },
    normal: {
      outer: "space-y-8 py-6 px-4 sm:px-6 lg:px-8",
      gridGap: "gap-6",
      cardPadding: "p-6 sm:p-7",
      cardHeader: "pb-5 mb-4",
      itemSpacing: "space-y-3.5",
      itemPadding: "p-4",
      footerMargin: "mt-6 pt-4"
    },
    compact: {
      outer: "space-y-6 py-4 px-4 sm:px-5 lg:px-6",
      gridGap: "gap-4 sm:gap-5",
      cardPadding: "p-5",
      cardHeader: "pb-4 mb-3",
      itemSpacing: "space-y-2.5",
      itemPadding: "p-3.5",
      footerMargin: "mt-5 pt-3.5"
    }
  }[widgetLayout.density || "spacious"];

  // Filter visible columns
  const visibleColumns = widgetLayout.columns.filter((c) => widgetLayout.visible[c] !== false);

  // Compute Grid Classes based on count & layout mode
  let gridColsClass = "grid grid-cols-1 gap-6 lg:grid-cols-3";
  if (widgetLayout.gridStyle === "focus" || visibleColumns.length === 1) {
    gridColsClass = "grid grid-cols-1 max-w-4xl mx-auto";
  } else if (widgetLayout.gridStyle === "2col" || visibleColumns.length === 2) {
    gridColsClass = "grid grid-cols-1 md:grid-cols-2";
  } else {
    gridColsClass = "grid grid-cols-1 lg:grid-cols-3";
  }

  // Column Renderer: Upcoming Meetings
  const renderMeetingsColumn = () => (
    <div
      key="meetings"
      className={`flex flex-col justify-between rounded-[28px] border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 ${densityStyles.cardPadding} shadow-[0_4px_24px_rgba(0,0,0,0.03)] hover:shadow-md transition-all duration-200`}
    >
      <div>
        {/* Header */}
        <div className={`flex items-center justify-between border-b border-slate-100 dark:border-slate-800 ${densityStyles.cardHeader}`}>
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 px-3.5 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-300 shadow-xs">
            <Video size={14} className="text-emerald-600 dark:text-emerald-400" />
            <span>Jadwal Rapat Mendatang</span>
          </span>
          <Link
            to="/schedule"
            className="inline-flex items-center gap-1 text-xs font-bold text-sky-600 hover:text-sky-700 dark:text-sky-400 transition-colors"
          >
            Lihat Semua <ChevronRight size={14} />
          </Link>
        </div>

        {/* Cards List */}
        <div className={densityStyles.itemSpacing}>
          {loading ? (
            <div className="flex h-32 items-center justify-center"><span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-emerald-500" /></div>
          ) : displayMeetings.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-6 text-center rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-dashed">
              <CalendarDays size={24} className="text-sub mb-2 opacity-50" />
              <p className="text-xs font-semibold text-ink">Tidak ada meeting hari ini</p>
              <p className="text-[11px] text-sub mt-0.5">Jadwal baru akan muncul di sini</p>
            </div>
          ) : (
            displayMeetings.map((m) => (
              <div
                key={m.id}
                className={`group rounded-2xl border border-slate-100 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-800/40 ${densityStyles.itemPadding} transition-all hover:border-slate-300 dark:hover:border-slate-700 hover:bg-white dark:hover:bg-slate-800`}
              >
                {/* Time pill & Date */}
                <div className="flex items-center justify-between gap-3 mb-2.5">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 dark:border-emerald-800/60 bg-emerald-100/70 dark:bg-emerald-950/60 px-3 py-1 text-xs font-bold text-emerald-800 dark:text-emerald-200">
                    <Clock size={11} strokeWidth={2.4} />
                    <span>{m.start_time} — {m.end_time}</span>
                  </span>
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    {m.date}
                  </span>
                </div>

                {/* Title & Location */}
                <h4 className="mt-2 text-base font-bold text-ink leading-snug line-clamp-1">
                  {m.title}
                </h4>
                <p className="mt-1.5 text-xs text-sub truncate">
                  {m.location || "Google Calendar / Google Meet"}
                </p>

                {/* Footer: Attendees & Join button */}
                <div className="mt-4 flex items-center justify-between pt-3 border-t border-slate-200/60 dark:border-slate-800/60">
                  <div className="flex items-center gap-2 text-xs font-medium text-sub">
                    <AvatarStack ids={m.attendee_ids || [me?.user_id]} max={2} size={22} />
                    <span className="text-slate-600 dark:text-slate-300 font-semibold">
                      {(m.attendee_ids?.length || 1)} peserta
                    </span>
                  </div>
                  <a
                    href={m.meet_link || "https://meet.google.com"}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-1.5 text-xs font-bold shadow-sm transition-all hover:scale-102 active:scale-98"
                  >
                    <Video size={13} />
                    <span>Gabung</span>
                    <ExternalLink size={11} />
                  </a>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Bottom Actions (Clean label with single icon, no redundant ++Jadwal) */}
      <div className={`${densityStyles.footerMargin} flex items-center justify-between border-t border-slate-100 dark:border-slate-800 px-1`}>
        <button
          onClick={() => navigate("/schedule")}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 transition-colors py-1"
        >
          <Plus size={15} /> Jadwal Baru
        </button>
        <Link
          to="/schedule"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white transition-colors py-1"
        >
          <CalendarDays size={15} /> Buka Kalender
        </Link>
      </div>
    </div>
  );

  // Column Renderer: Today's Priority Tasks
  const renderTasksColumn = () => (
    <div
      key="tasks"
      className={`flex flex-col justify-between rounded-[28px] border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 ${densityStyles.cardPadding} shadow-[0_4px_24px_rgba(0,0,0,0.03)] hover:shadow-md transition-all duration-200`}
    >
      <div>
        {/* Header */}
        <div className={`flex items-center justify-between border-b border-slate-100 dark:border-slate-800 ${densityStyles.cardHeader}`}>
          <span className="inline-flex items-center gap-2 rounded-full border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 px-3.5 py-1 text-xs font-bold text-amber-700 dark:text-amber-300 shadow-xs">
            <CheckSquare size={14} className="text-amber-600 dark:text-amber-400" />
            <span>Tugas Prioritas Hari Ini</span>
          </span>
          <Link
            to="/tasks?kanban=1"
            className="inline-flex items-center gap-1 text-xs font-bold text-rose-600 hover:text-rose-700 dark:text-rose-400 transition-colors"
          >
            Lihat Kanban <ChevronRight size={14} />
          </Link>
        </div>

        {/* Tasks List */}
        <div className={densityStyles.itemSpacing}>
          {loading ? (
            <div className="flex h-32 items-center justify-center"><span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-amber-500" /></div>
          ) : todayTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-6 text-center rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-dashed">
              <CheckSquare size={24} className="text-sub mb-2 opacity-50" />
              <p className="text-xs font-semibold text-ink">Semua tugas selesai</p>
              <p className="text-[11px] text-sub mt-0.5">Belum ada tugas prioritas aktif</p>
            </div>
          ) : (
            todayTasks.map((t) => {
            const isDone = t.status === "done";
            const checkpointTotal = t.checkpoints?.length || t.checkpoints_total || 3;
            const checkpointDone = t.checkpoints?.filter((c) => c.done).length ?? (isDone ? checkpointTotal : 0);

            return (
              <div
                key={t.id}
                onClick={() => setSelectedTaskId(t.id)}
                className={`group cursor-pointer rounded-2xl border ${densityStyles.itemPadding} transition-all duration-200 ${
                  isDone
                    ? "border-emerald-200 bg-emerald-50/30 dark:border-emerald-900/40 dark:bg-emerald-950/20"
                    : "border-slate-100 bg-slate-50/70 hover:border-slate-300 hover:bg-white dark:border-slate-800/80 dark:bg-slate-800/40 dark:hover:bg-slate-800"
                }`}
              >
                {/* Badges + Check toggle */}
                <div className="flex items-center justify-between gap-3 mb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-sky-100 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-sky-700 dark:text-sky-300">
                      {t.priority || "MEDIUM"}
                    </span>
                    <span className="rounded-full bg-purple-100 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800 px-2.5 py-0.5 text-[10px] font-bold text-purple-700 dark:text-purple-300">
                      {t.label || "General"}
                    </span>
                  </div>

                  {/* Circular Done Checkbox Button */}
                  <button
                    type="button"
                    onClick={(e) => toggleTaskDone(t, e)}
                    className={`flex h-6 w-6 items-center justify-center rounded-full transition-all duration-200 ${
                      isDone
                        ? "bg-emerald-500 text-white shadow-xs"
                        : "border-2 border-slate-300 hover:border-emerald-500 dark:border-slate-600"
                    }`}
                    title={isDone ? "Tandai belum selesai" : "Tandai selesai"}
                  >
                    {isDone && <CheckCircle2 size={16} strokeWidth={2.5} />}
                  </button>
                </div>

                {/* Task Title */}
                <h4
                  className={`text-[15px] font-bold tracking-tight text-ink leading-snug line-clamp-1 group-hover:text-brand transition-colors ${
                    isDone ? "line-through text-slate-400 dark:text-slate-500" : ""
                  }`}
                >
                  {t.title}
                </h4>

                {/* Footer: Deadline & Checklist info */}
                <div className="mt-3.5 flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400 pt-2.5 border-t border-slate-200/50 dark:border-slate-800/60">
                  <span className="flex items-center gap-1.5">
                    <Clock size={12} />
                    <span>Deadline: {t.deadline ? t.deadline.slice(0, 10) : "2026-11-13"}</span>
                  </span>
                  <span>
                    {checkpointDone}/{checkpointTotal} Checklist
                  </span>
                </div>
              </div>
            );
          })
          )}
        </div>
      </div>

      {/* Bottom Add Task Button */}
      <div className={`${densityStyles.footerMargin} border-t border-slate-100 dark:border-slate-800`}>
        <button
          onClick={() => setNewTaskOpen(true)}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-full border border-slate-200/90 dark:border-slate-700 bg-surface px-4 text-xs sm:text-sm font-bold text-sub hover:text-ink hover:border-slate-400 dark:hover:border-slate-500 shadow-xs transition-all hover:scale-[1.01] active:scale-[0.99]"
        >
          <Plus size={15} className="text-rose-500" />
          <span>Tambah Item Tugas Baru</span>
        </button>
      </div>
    </div>
  );

  // Column Renderer: Team Messages & Feed
  const renderMessagesColumn = () => (
    <div
      key="messages"
      className={`flex flex-col justify-between rounded-[28px] border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 ${densityStyles.cardPadding} shadow-[0_4px_24px_rgba(0,0,0,0.03)] hover:shadow-md transition-all duration-200`}
    >
      <div>
        {/* Header */}
        <div className={`flex items-center justify-between border-b border-slate-100 dark:border-slate-800 ${densityStyles.cardHeader}`}>
          <span className="inline-flex items-center gap-2 rounded-full border border-purple-300 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/40 px-3.5 py-1 text-xs font-bold text-purple-700 dark:text-purple-300 shadow-xs">
            <MessageSquare size={14} className="text-purple-600 dark:text-purple-400" />
            <span>Pesan & Diskusi Tim</span>
          </span>
          <Link
            to="/beranda"
            className="inline-flex items-center gap-1 text-xs font-bold text-rose-600 hover:text-rose-700 dark:text-rose-400 transition-colors"
          >
            Buka Feed <ChevronRight size={14} />
          </Link>
        </div>

        {/* Feed Card: Latest Post or Empty State */}
        {loading ? (
            <div className="flex h-32 items-center justify-center"><span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-purple-500" /></div>
        ) : posts.length === 0 ? (
          <div className={`rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 ${densityStyles.itemPadding} text-center py-6`}>
            <MessageSquare size={22} className="mx-auto text-sub mb-2 opacity-50" />
            <p className="text-xs font-semibold text-ink">Belum ada postingan di Feed</p>
            <p className="text-[11px] text-sub mt-0.5">Bagikan kabar terbaru kepada seluruh tim.</p>
          </div>
        ) : (() => {
          const latestPost = posts[0];
          const author = userMap[latestPost.author_id] || { name: "Saeful Rohman", role: "super_admin" };
          return (
            <div className={`rounded-2xl border border-slate-100 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-800/40 ${densityStyles.itemPadding} space-y-3.5`}>
              {/* Author Row */}
              <div className="flex items-center gap-3">
                <Avatar user={author} size={38} showStatus={false} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-sm text-ink truncate">{author.name}</span>
                    <span className="rounded bg-rose-100 dark:bg-rose-950/60 px-1.5 py-0.2 text-[10px] font-black text-rose-700 dark:text-rose-300">
                      {author.role === "super_admin" ? "BoD" : "Tim"}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 truncate mt-0.5">
                    {latestPost.created_at ? latestPost.created_at.slice(0, 10) : "Hari ini"} • {author.email || "saeful.rohman@asli.id"}
                  </p>
                </div>
              </div>

              {/* Post Quote */}
              <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-200 leading-relaxed font-medium">
                &ldquo;{latestPost.text}&rdquo;
              </p>

              {/* Interactive Reactions Bar */}
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200/50 dark:border-slate-800/60">
                {Object.entries(reactionCounts).map(([emoji, count]) => {
                  const isSelected = userReacted[emoji];
                  return (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => handleReactionClick(emoji)}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-all ${
                        isSelected
                          ? "border-rose-400 bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 scale-105 shadow-xs"
                          : "border-slate-200 dark:border-slate-700 bg-surface hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200"
                      }`}
                    >
                      <span>{emoji}</span>
                      <span className="text-[11px]">{count}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* Feed Card 2: Last Conversation */}
        {lastConversation && (
          <div
            onClick={() => navigate(`/messages/${lastConversation.id}`)}
            className="mt-4 flex cursor-pointer items-center justify-between gap-3.5 rounded-2xl border border-blue-200 dark:border-blue-900 bg-blue-50/70 dark:bg-blue-950/30 p-4 transition-all hover:border-blue-400 hover:shadow-sm"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-xs font-extrabold text-white shadow-xs">
                {lastConversation.type === "dm" ? "💬" : "#"}
              </div>
              <div className="min-w-0">
                <p className="font-bold text-sm text-ink truncate">
                  {lastConversation.type === "dm"
                    ? (userMap?.[(lastConversation.member_ids || []).find((id) => id !== me?.user_id)]?.name || lastConversation.name || "Direct Message")
                    : `#${lastConversation.name}`}
                </p>
                <p className="text-xs text-sub truncate mt-0.5">{lastConversation.last_message_preview || "Belum ada pesan"}</p>
              </div>
            </div>
            {lastConversation.unread > 0 && (
              <span className="rounded-full bg-blue-600 px-3 py-1 text-xs font-bold text-white shadow-xs shrink-0">
                {lastConversation.unread} Baru
              </span>
            )}
          </div>
        )}
      </div>

      {/* Bottom Action: Big Red Accent Pill Button (matching New Task button) */}
      <div className={`${densityStyles.footerMargin} border-t border-slate-100 dark:border-slate-800`}>
        <Link
          to="/messages"
          className="btn-accent inline-flex h-12 w-full items-center justify-center gap-2 rounded-full text-white font-bold text-sm shadow-md shadow-rose-500/25 transition-all hover:scale-[1.01] active:scale-[0.99]"
        >
          <MessageSquare size={16} className="text-white fill-white" />
          <span>Buka Obrolan Tim</span>
        </Link>
      </div>
    </div>
  );

  return (
    <div className="relative min-h-full animate-crossfade" data-testid="dashboard-page">
      {/* Background Layer */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-0" style={layer.base} />
        <div className="absolute inset-0" style={layer.overlay} />
      </div>

      <div className={`relative z-10 mx-auto max-w-[1520px] ${densityStyles.outer}`}>
        {/* Top Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-sub" data-testid="dashboard-date">
              {format(new Date(), "EEEE, d MMMM yyyy")}
            </p>
            <h1 className="mt-1 text-3xl sm:text-4xl font-extrabold tracking-tight text-ink" data-testid="dashboard-greeting">
              {greet}, {me?.name?.split(" ")[0]} 👋
            </h1>
          </div>

          {/* Action Buttons in Top Right: Replaced Settings with Customize Tata Letak */}
          <div className="flex flex-wrap items-center gap-3">
            <AccentButton onClick={() => setNewTaskOpen(true)} data-testid="dashboard-new-task-btn">
              <Plus size={16} /> {t("dash_new_task")}
            </AccentButton>

            <GhostButton onClick={() => setBgOpen(true)} data-testid="dashboard-background-btn">
              <Image size={16} /> {t("dash_background")}
            </GhostButton>

            <GhostButton
              onClick={() => {
                playSound("click");
                setLayoutOpen(true);
              }}
              data-testid="dashboard-customize-layout-btn"
              className="border-slate-200 dark:border-slate-700 font-semibold shadow-xs hover:border-slate-300 dark:hover:border-slate-600"
            >
              <SlidersHorizontal size={16} className="text-rose-500" />
              <span>{t("dash_customize_layout")}</span>
            </GhostButton>
          </div>
        </div>

        {/* ============================================================ */}
        {/* TEAM WORKLOAD & MONTHLY PERFORMANCE SECTION (MOVED TO TOP)   */}
        {/* ============================================================ */}
        {(widgetLayout.visible.performance !== false || widgetLayout.visible.personnel !== false) && (
          <div className="mb-8">
            <MonthlyStats
              showPerformance={widgetLayout.visible.performance !== false}
              showPersonnel={widgetLayout.visible.personnel !== false}
            />
          </div>
        )}

        {/* ============================================================ */}
        {/* DYNAMIC 3-COLUMN DASHBOARD LAYOUT (CONFIGURABLE & SPACIOUS)  */}
        {/* ============================================================ */}
        {visibleColumns.length > 0 ? (
          <div className={`${gridColsClass} ${densityStyles.gridGap}`} data-testid="main-3-columns">
            {visibleColumns.map((colKey) => {
              if (colKey === "meetings") return renderMeetingsColumn();
              if (colKey === "tasks") return renderTasksColumn();
              if (colKey === "messages") return renderMessagesColumn();
              return null;
            })}
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed border-slate-300 dark:border-slate-700 p-12 text-center bg-white/50 dark:bg-slate-900/50">
            <LayoutGrid size={32} className="mx-auto text-sub mb-3" />
            <h3 className="font-bold text-ink text-lg">Semua widget utama disembunyikan</h3>
            <p className="text-sub text-sm mt-1 max-w-md mx-auto">
              Anda dapat mengaktifkan kembali widget melalui menu Customize Tata Letak di pojok kanan atas.
            </p>
            <button
              onClick={resetLayout}
              className="btn-accent mt-5 px-5 py-2.5 text-sm font-semibold inline-flex items-center gap-2"
            >
              <RotateCcw size={15} /> Reset ke Tampilan Standar
            </button>
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* WIDGET LAYOUT CUSTOMIZER DRAWER (SHEET)                      */}
      {/* ============================================================ */}
      <Sheet open={layoutOpen} onOpenChange={setLayoutOpen}>
        <SheetContent className="w-full overflow-y-auto bg-surface sm:max-w-lg p-6 space-y-7">
          <SheetHeader className="pb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2.5">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400">
                <SlidersHorizontal size={20} />
              </span>
              <div>
                <SheetTitle className="text-lg font-bold">Customize Tata Letak Widget</SheetTitle>
                <SheetDescription className="text-xs text-sub mt-0.5">
                  Atur urutan kartu, visibilitas widget, dan kerapatan tampilan dashboard Anda.
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>

          {/* Section 1: Kerapatan & Jarak Tampilan (Spacing Audit) */}
          <div className="space-y-3">
            <label className="block text-xs font-bold uppercase tracking-wider text-sub">
              Kerapatan Margin & Spacing (Anti-Mepet)
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              {[
                { id: "spacious", label: "Lega & Luas", desc: "Margin lega (Rekomendasi)", badge: "Lega" },
                { id: "normal", label: "Standar", desc: "Proporsional", badge: "Normal" },
                { id: "compact", label: "Kompak", desc: "Hemat ruang", badge: "Padat" }
              ].map((d) => {
                const active = (widgetLayout.density || "spacious") === d.id;
                return (
                  <button
                    key={d.id}
                    onClick={() => {
                      playSound("click");
                      updateLayout({ density: d.id });
                    }}
                    className={`flex flex-col items-center justify-center rounded-2xl border p-3 text-center transition-all ${
                      active
                        ? "border-rose-500 bg-rose-50/50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 ring-2 ring-rose-500/20"
                        : "border-slate-200 dark:border-slate-800 bg-surface2/50 hover:bg-surface2 text-sub"
                    }`}
                  >
                    <span className="text-xs font-bold text-ink">{d.label}</span>
                    <span className="text-[10px] text-sub mt-0.5">{d.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 2: Format Tata Letak Grid */}
          <div className="space-y-3">
            <label className="block text-xs font-bold uppercase tracking-wider text-sub">
              Format Kolom Grid
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              {[
                { id: "3col", label: "3 Kolom", icon: LayoutGrid, desc: "Seimbang" },
                { id: "2col", label: "2 Kolom", icon: Columns, desc: "Lebar" },
                { id: "focus", label: "1 Kolom", icon: Maximize2, desc: "Fokus" }
              ].map((style) => {
                const active = (widgetLayout.gridStyle || "3col") === style.id;
                const Icon = style.icon;
                return (
                  <button
                    key={style.id}
                    onClick={() => {
                      playSound("click");
                      updateLayout({ gridStyle: style.id });
                    }}
                    className={`flex flex-col items-center justify-center rounded-2xl border p-3 text-center transition-all ${
                      active
                        ? "border-rose-500 bg-rose-50/50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 ring-2 ring-rose-500/20"
                        : "border-slate-200 dark:border-slate-800 bg-surface2/50 hover:bg-surface2 text-sub"
                    }`}
                  >
                    <Icon size={18} className={active ? "text-rose-500" : "text-sub"} />
                    <span className="text-xs font-bold text-ink mt-1.5">{style.label}</span>
                    <span className="text-[10px] text-sub">{style.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 3: Urutan & Visibilitas 3 Widget Utama */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold uppercase tracking-wider text-sub">
                Urutan & Visibilitas 3 Widget Utama
              </label>
              <span className="text-[11px] text-sub">Geser urutan posisi:</span>
            </div>

            <div className="space-y-2.5">
              {widgetLayout.columns.map((colKey, index) => {
                const meta = WIDGET_LABELS[colKey];
                const Icon = meta.icon;
                const isVisible = widgetLayout.visible[colKey] !== false;
                const isFirst = index === 0;
                const isLast = index === widgetLayout.columns.length - 1;

                return (
                  <div
                    key={colKey}
                    className={`flex items-center justify-between rounded-2xl border p-3.5 transition-all ${
                      isVisible
                        ? "border-slate-200 dark:border-slate-700 bg-surface shadow-xs"
                        : "border-slate-200/60 dark:border-slate-800/60 bg-surface2/40 opacity-60"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs">
                        {index + 1}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <Icon size={14} className="text-slate-500 shrink-0" />
                          <p className="text-xs sm:text-sm font-bold text-ink truncate">{meta.title}</p>
                        </div>
                        <p className="text-[11px] text-sub truncate mt-0.5">{meta.desc}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      {/* Move Up/Left */}
                      <button
                        onClick={() => moveColumn(colKey, -1)}
                        disabled={isFirst}
                        className="flex h-8 w-8 items-center justify-center rounded-xl border bg-surface hover:bg-surface2 text-sub disabled:opacity-30 disabled:pointer-events-none"
                        title="Pindah ke kiri / atas"
                      >
                        <ArrowLeft size={14} />
                      </button>

                      {/* Move Down/Right */}
                      <button
                        onClick={() => moveColumn(colKey, 1)}
                        disabled={isLast}
                        className="flex h-8 w-8 items-center justify-center rounded-xl border bg-surface hover:bg-surface2 text-sub disabled:opacity-30 disabled:pointer-events-none"
                        title="Pindah ke kanan / bawah"
                      >
                        <ArrowRight size={14} />
                      </button>

                      {/* Toggle Visibility */}
                      <button
                        onClick={() => toggleWidget(colKey)}
                        className={`flex h-8 px-2.5 items-center gap-1.5 rounded-xl border text-xs font-semibold transition-all ${
                          isVisible
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                            : "border-slate-200 bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                        }`}
                      >
                        {isVisible ? <Eye size={13} /> : <EyeOff size={13} />}
                        <span>{isVisible ? "Tampil" : "Hidden"}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section 4: Widget Analitik & Tim */}
          <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <label className="block text-xs font-bold uppercase tracking-wider text-sub">
              Widget Analitik & Performa Tim
            </label>
            <div className="space-y-2.5">
              {[
                {
                  key: "performance",
                  title: "Performa & Monitoring Bulanan",
                  desc: "Grafik tugas selesai, overdue, dan ketepatan waktu",
                  icon: TrendingUp
                },
                {
                  key: "personnel",
                  title: "Kapasitas & Beban Kerja Personel",
                  desc: "Kartu beban kerja anggota tim dan indikator tekanan",
                  icon: BarChart3
                }
              ].map((item) => {
                const Icon = item.icon;
                const isVisible = widgetLayout.visible[item.key] !== false;
                return (
                  <div
                    key={item.key}
                    className={`flex items-center justify-between rounded-2xl border p-3.5 transition-all ${
                      isVisible
                        ? "border-slate-200 dark:border-slate-700 bg-surface shadow-xs"
                        : "border-slate-200/60 dark:border-slate-800/60 bg-surface2/40 opacity-60"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400">
                        <Icon size={16} />
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs sm:text-sm font-bold text-ink truncate">{item.title}</p>
                        <p className="text-[11px] text-sub truncate mt-0.5">{item.desc}</p>
                      </div>
                    </div>

                    <button
                      onClick={() => toggleWidget(item.key)}
                      className={`flex h-8 px-2.5 items-center gap-1.5 rounded-xl border text-xs font-semibold transition-all shrink-0 ml-2 ${
                        isVisible
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                          : "border-slate-200 bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                      }`}
                    >
                      {isVisible ? <Eye size={13} /> : <EyeOff size={13} />}
                      <span>{isVisible ? "Tampil" : "Hidden"}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Bottom Actions */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
            <button
              onClick={resetLayout}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-sub hover:text-ink px-3 py-2 rounded-xl transition-colors"
            >
              <RotateCcw size={14} /> Reset Default
            </button>
            <button
              onClick={() => {
                playSound("click");
                setLayoutOpen(false);
                toast.success("Tata letak widget berhasil disimpan!");
              }}
              className="btn-accent px-5 py-2.5 text-xs font-bold shadow-md inline-flex items-center gap-2"
            >
              <Check size={14} /> Simpan & Terapkan
            </button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Background Customizer Drawer */}
      <Sheet open={bgOpen} onOpenChange={setBgOpen}>
        <SheetContent className="w-full overflow-y-auto bg-surface sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Dashboard background</SheetTitle>
          </SheetHeader>
          <BackgroundEditor />
        </SheetContent>
      </Sheet>

      {/* Task Creation & Detail Sheets */}
      <TaskCreate open={newTaskOpen} onOpenChange={setNewTaskOpen} onCreated={loadData} />
      {selectedTaskId && (
        <TaskDetail id={selectedTaskId} onClose={() => setSelectedTaskId(null)} onChanged={loadData} />
      )}
    </div>
  );
}
