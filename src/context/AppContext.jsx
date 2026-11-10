import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { api, wsUrl } from "../lib/api";
import { applyTheme, buildTheme } from "../lib/theme";
import { getTranslation } from "../lib/i18n";
import { playSound } from "../lib/sound";
import { hydrateConversationsCache, appendMessageToCache, updateMessageInCache } from "../pages/chat/ChatView";
import { setCachedDriveShortcuts } from "../data/initialDriveShortcuts";

const AppCtx = createContext(null);
export const useApp = () => useContext(AppCtx);

const DEFAULT_USERS = [
  { user_id: "user_admin1", name: "Admin ASLI RI", email: "admin@asliri.local", role: "super_admin", job_title: "Super Admin", department: "Management", status: "active", online: true, avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80" },
  { user_id: "user_superadmin_saeful", name: "Saeful Rohman", email: "saeful@asliri.id", role: "super_admin", job_title: "Chief Executive Officer", department: "Management", status: "active", online: true, avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80" },
  { user_id: "user_budi", name: "Budi Santoso", email: "budi@asliri.id", role: "department_manager", job_title: "Head of Product", department: "Product", status: "active", online: true, avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80" },
  { user_id: "user_siti", name: "Siti Aminah", email: "siti@asliri.id", role: "department_manager", job_title: "VP of Engineering", department: "Engineering", status: "active", online: true, avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80" },
  { user_id: "user_dian", name: "Dian Sastro", email: "dian@asliri.id", role: "employee", job_title: "Lead UI/UX Designer", department: "Design", status: "active", online: true, avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&auto=format&fit=crop&q=80" }
];

const DEFAULT_SESSION = {
  user: DEFAULT_USERS[0],
  workspace: {
    name: "CIRCLE",
    subtitle: "CIRCLE Workspace",
    assistant_name: "Circle",
    assistant_avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=CircleWorkspace&backgroundColor=FF5364",
    task_statuses: ["todo", "in_progress", "in_review", "done"]
  },
  prefs: { theme_mode: "light" }
};

export function AppProvider({ children }) {
  const [session, setSession] = useState(() => {
    try {
      const cached = localStorage.getItem("circle_session_cache");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && parsed.user) return parsed;
      }
    } catch {}
    return DEFAULT_SESSION;
  });
  const [users, setUsers] = useState(() => {
    try {
      const cached = localStorage.getItem("circle_users_cache");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return DEFAULT_USERS;
  });
  const [labels, setLabels] = useState(() => {
    try {
      const cached = localStorage.getItem("circle_labels_cache");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [
      { id: "lbl_1", name: "Priority", color: "#FF5364" },
      { id: "lbl_2", name: "Engineering", color: "#3B82F6" },
      { id: "lbl_3", name: "Design", color: "#8B5CF6" }
    ];
  });
  const [online, setOnline] = useState(() => new Set(DEFAULT_USERS.map((u) => u.user_id)));
  const [unread, setUnread] = useState(0);
  const [themeDraft, setThemeDraft] = useState(null);
  const [topNotif, setTopNotif] = useState(null);
  const subs = useRef(new Set());
  const sock = useRef(null);

  const me = session?.user;
  const ws = session?.workspace;
  const prefs = useMemo(() => session?.prefs || {}, [session?.prefs]);

  const loadAll = useCallback(async () => {
    const [u, l, n, c, t, ds] = await Promise.all([
      api.get("/users").catch(() => ({ data: null })),
      api.get("/labels").catch(() => ({ data: null })),
      api.get("/notifications").catch(() => ({ data: null })),
      api.get("/conversations").catch(() => ({ data: null })),
      api.get("/tasks").catch(() => ({ data: null })),
      api.get("/drive-shortcuts").catch(() => ({ data: null }))
    ]);
    if (Array.isArray(u.data) && u.data.length > 0) {
      setUsers(u.data);
      setOnline(new Set(u.data.filter((x) => x.online).map((x) => x.user_id)));
      try { localStorage.setItem("circle_users_cache", JSON.stringify(u.data)); } catch {}
    }
    if (Array.isArray(l.data)) {
      setLabels(l.data);
      try { localStorage.setItem("circle_labels_cache", JSON.stringify(l.data)); } catch {}
    }
    if (n.data) {
      setUnread(n.data.unread || 0);
      try { localStorage.setItem("circle_notifications_cache", JSON.stringify(n.data)); } catch {}
    }
    if (Array.isArray(c.data)) {
      hydrateConversationsCache(c.data);
      try { localStorage.setItem("circle_cache_conversations", JSON.stringify(c.data)); } catch {}
    }
    if (Array.isArray(t.data)) {
      try {
        localStorage.setItem("circle_tasks_cache", JSON.stringify(t.data));
        localStorage.setItem("circle_cache_tasks", JSON.stringify(t.data));
      } catch {}
    }
    if (Array.isArray(ds.data)) {
      setCachedDriveShortcuts(ds.data);
    }
  }, []);

  const checkAuth = useCallback(async () => {
    let cachedPrefs = {};
    try {
      cachedPrefs = JSON.parse(localStorage.getItem("circle_user_prefs") || "{}");
    } catch {}
    try {
      const { data } = await api.get("/auth/me");
      const mergedPrefs = { ...cachedPrefs, ...(data.prefs || {}) };
      const nextSession = { user: data.user, workspace: data.workspace, prefs: mergedPrefs };
      setSession(nextSession);
      if (Array.isArray(data.users) && data.users.length > 0) {
        setUsers(data.users);
        setOnline(new Set(data.users.filter((x) => x.online).map((x) => x.user_id)));
        try { localStorage.setItem("circle_users_cache", JSON.stringify(data.users)); } catch {}
      }
      if (Array.isArray(data.labels) && data.labels.length > 0) {
        setLabels(data.labels);
        try { localStorage.setItem("circle_labels_cache", JSON.stringify(data.labels)); } catch {}
      }
      if (Array.isArray(data.drive_shortcuts)) {
        setCachedDriveShortcuts(data.drive_shortcuts);
      }
      try {
        localStorage.setItem("circle_session_cache", JSON.stringify(nextSession));
        localStorage.setItem("circle_user_prefs", JSON.stringify(mergedPrefs));
      } catch {}
    } catch {
      setSession(null);
      try { localStorage.removeItem("circle_session_cache"); } catch {}
    }
  }, []);

  useEffect(() => {
    if (window.location.hash?.includes("session_id=")) return;
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (me?.user_id) loadAll().catch(() => {});
  }, [me?.user_id, loadAll]);

  useEffect(() => {
    applyTheme(buildTheme(ws?.theme, prefs, themeDraft));
  }, [ws?.theme, prefs, themeDraft]);

  useEffect(() => {
    if (prefs.theme_mode !== "system") return undefined;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const fn = () => applyTheme(buildTheme(ws?.theme, prefs, themeDraft));
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, [prefs, ws?.theme, themeDraft]);

  const emit = (evt) => subs.current.forEach((fn) => fn(evt));

  useEffect(() => {
    if (!me?.user_id) return undefined;
    let closed = false;
    let timer;
    const connect = () => {
      const s = new WebSocket(wsUrl());
      sock.current = s;
      s.onmessage = (m) => {
        const evt = JSON.parse(m.data);
        if (evt.type === "presence") {
          setOnline((prev) => {
            const n = new Set(prev);
            evt.data.online ? n.add(evt.data.user_id) : n.delete(evt.data.user_id);
            return n;
          });
        }
        if (evt.type === "notification") {
          if (evt.data?.user_id && me?.user_id && evt.data.user_id !== me.user_id) return;
          setUnread((x) => x + 1);
          setTopNotif({
            id: evt.data.id || `notif_${Date.now()}`,
            title: evt.data.title,
            body: evt.data.body,
            type: evt.data.type,
            access_request: evt.data.access_request,
            conversation_id: evt.data.conversation_id,
            task_id: evt.data.task_id,
            sender: evt.data.sender
          });
          playSound("notification");
          if (document.hidden && window.Notification?.permission === "granted") new Notification(evt.data.title, { body: evt.data.body });
        }
        if (evt.type === "message:new" && evt.data) {
          // Always cache incoming messages immediately in memory & localStorage so opening any chat has 0ms delay
          appendMessageToCache(evt.data);
          if (evt.data.sender_id !== me?.user_id) {
            const isCurrentlyInThisChat = window.location.pathname === `/messages/${evt.data.conversation_id}`;
            if (!isCurrentlyInThisChat) {
              const userMapObj = Object.fromEntries(users.map((u) => [u.user_id, u]));
              const sender = userMapObj[evt.data.sender_id] || (evt.data.sender_id === "user_circle_assistant" ? { name: ws?.assistant_name || "Circle", avatar: ws?.assistant_avatar } : null);
              setTopNotif({
                id: `msg_notif_${Date.now()}`,
                title: `Pesan Baru dari ${sender?.name || 'Circle'}`,
                body: evt.data.text || "Mengirimkan pesan baru",
                type: evt.data.type || "dm",
                conversation_id: evt.data.conversation_id,
                sender,
                access_request: evt.data.access_request
              });
            }
          }
        }
        if (evt.type === "message:update" && evt.data) {
          updateMessageInCache(evt.data);
        }
        if (evt.type === "conversations:changed") {
          api.get("/conversations").then((r) => {
            if (Array.isArray(r.data)) hydrateConversationsCache(r.data);
          }).catch(() => {});
        }
        if (evt.type === "workspace:changed") {
          api.get("/workspace").then((r) => setSession((s) => (s ? { ...s, workspace: r.data } : s))).catch(() => {});
        }
        if (evt.type === "users:changed") {
          api.get("/users").then((r) => {
            setUsers(r.data);
            try { localStorage.setItem("circle_users_cache", JSON.stringify(r.data)); } catch {}
          }).catch(() => {});
        }
        if (evt.type === "drive_shortcuts:changed" && Array.isArray(evt.data)) {
          setCachedDriveShortcuts(evt.data);
        }
        emit(evt);
      };
      s.onclose = () => {
        if (!closed) timer = setTimeout(connect, 1500);
      };
    };
    connect();
    const ping = setInterval(() => sock.current?.readyState === 1 && sock.current.send('{"type":"ping"}'), 25000);
    return () => {
      closed = true;
      clearTimeout(timer);
      clearInterval(ping);
      sock.current?.close();
    };
  }, [me?.user_id]);

  const value = useMemo(() => {
    const userMap = Object.fromEntries(users.map((u) => [u.user_id, u]));
    const labelMap = Object.fromEntries(labels.map((l) => [l.id, l]));
    return {
      session, setSession, me, ws, prefs, users, userMap, labels, labelMap, online, unread, setUnread,
      topNotif, setTopNotif, showTopNotif: (d) => setTopNotif(d), closeTopNotif: () => setTopNotif(null),
      statuses: (ws?.task_statuses || ["todo", "in_progress", "in_review", "done"]).map((s) => typeof s === "string" ? { key: s, name: s.replace(/_/g, " "), color: "#F0F4FA", is_done: s === "done" } : s),
      isAdmin: ["super_admin", "workspace_admin"].includes(me?.role),
      isManager: ["super_admin", "workspace_admin", "department_manager", "project_manager"].includes(me?.role),
      isDemo: !!me?.is_demo,
      lang: "en",
      t: (key) => getTranslation(key, prefs?.custom_copywriting),
      themeDraft, setThemeDraft,
      reloadUsers: () => api.get("/users").then((r) => setUsers(r.data)),
      reloadLabels: () => api.get("/labels").then((r) => setLabels(r.data)),
      reloadWs: () => api.get("/workspace").then((r) => setSession((s) => ({ ...s, workspace: r.data }))),
      savePrefs: async (patch) => {
        setSession((s) => {
          const nextPrefs = { ...(s?.prefs || {}), ...patch };
          try {
            localStorage.setItem("circle_user_prefs", JSON.stringify(nextPrefs));
          } catch {}
          return { ...s, prefs: nextPrefs };
        });
        try {
          const { data } = await api.put("/prefs", patch);
          setSession((s) => {
            const synced = { ...(s?.prefs || {}), ...data };
            try {
              localStorage.setItem("circle_user_prefs", JSON.stringify(synced));
            } catch {}
            return { ...s, prefs: synced };
          });
        } catch (e) {
          console.warn("Server prefs sync warning:", e);
        }
      },
      subscribe: (fn) => {
        subs.current.add(fn);
        return () => subs.current.delete(fn);
      },
      send: (obj) => sock.current?.readyState === 1 && sock.current.send(JSON.stringify(obj)),
      logout: async () => {
        await api.post("/auth/logout").catch(() => {});
        setSession(null);
      },
      checkAuth,
    };
  }, [session, me, ws, prefs, users, labels, online, unread, themeDraft, checkAuth]);

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}
