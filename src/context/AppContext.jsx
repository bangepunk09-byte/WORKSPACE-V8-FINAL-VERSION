import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { api, wsUrl } from "../lib/api";
import { applyTheme, buildTheme } from "../lib/theme";
import { getTranslation } from "../lib/i18n";
import { playSound } from "../lib/sound";

const AppCtx = createContext(null);
export const useApp = () => useContext(AppCtx);

export function AppProvider({ children }) {
  const [session, setSession] = useState(undefined);
  const [users, setUsers] = useState(() => {
    try {
      const cached = localStorage.getItem("circle_users_cache");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [];
  });
  const [labels, setLabels] = useState(() => {
    try {
      const cached = localStorage.getItem("circle_labels_cache");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [];
  });
  const [online, setOnline] = useState(new Set());
  const [unread, setUnread] = useState(0);
  const [themeDraft, setThemeDraft] = useState(null);
  const [topNotif, setTopNotif] = useState(null);
  const subs = useRef(new Set());
  const sock = useRef(null);

  const me = session?.user;
  const ws = session?.workspace;
  const prefs = useMemo(() => session?.prefs || {}, [session?.prefs]);

  const loadAll = useCallback(async () => {
    const [u, l, n] = await Promise.all([api.get("/users"), api.get("/labels"), api.get("/notifications")]);
    setUsers(u.data);
    setLabels(l.data);
    setUnread(n.data.unread);
    setOnline(new Set(u.data.filter((x) => x.online).map((x) => x.user_id)));
    try {
      localStorage.setItem("circle_users_cache", JSON.stringify(u.data));
      localStorage.setItem("circle_labels_cache", JSON.stringify(l.data));
    } catch {}
  }, []);

  const checkAuth = useCallback(async () => {
    let cachedPrefs = {};
    try {
      cachedPrefs = JSON.parse(localStorage.getItem("circle_user_prefs") || "{}");
    } catch {}
    try {
      const { data } = await api.get("/auth/me");
      const mergedPrefs = { ...cachedPrefs, ...(data.prefs || {}) };
      setSession({ ...data, prefs: mergedPrefs });
      try {
        localStorage.setItem("circle_user_prefs", JSON.stringify(mergedPrefs));
      } catch {}
    } catch {
      setSession(null);
    }
  }, []);

  useEffect(() => {
    if (window.location.hash?.includes("session_id=")) return;
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (me) loadAll().catch(() => {});
  }, [me, loadAll]);

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
    if (!me) return undefined;
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
        if (evt.type === "message:new" && evt.data?.sender_id !== me?.user_id) {
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
        emit(evt);
      };
      s.onclose = () => {
        if (!closed) timer = setTimeout(connect, 2500);
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
  }, [me]);

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
          setSession((s) => ({ ...s, prefs: { ...s?.prefs, ...data } }));
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
