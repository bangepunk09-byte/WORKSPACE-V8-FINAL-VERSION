import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Plus, Search, MessageCircle, ShieldCheck } from "lucide-react";
import { useApp } from "../context/AppContext";
import { api } from "../lib/api";
import { Avatar, Empty, fmtTime, GroupIcon, Spinner } from "../components/common";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import ChatView, { hydrateConversationsCache, appendMessageToCache, updateMessageInCache } from "./chat/ChatView";

function NewDM({ open, onOpenChange }) {
  const { users, me } = useApp();
  const [q, setQ] = useState("");
  const navigate = useNavigate();
  const start = async (uid) => { const { data } = await api.post("/conversations/dm", { user_id: uid }); onOpenChange(false); navigate(`/messages/${data.id}`); };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-surface rounded-3xl max-w-md">
        <DialogHeader><DialogTitle>New message</DialogTitle></DialogHeader>
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a colleague…" className="h-11 rounded-xl border bg-surface2 px-3 text-sm outline-none" data-testid="new-dm-search" />
        <div className="max-h-80 overflow-y-auto">
          {users.filter((u) => u.user_id !== me.user_id && u.name.toLowerCase().includes(q.toLowerCase())).map((u) => (
            <button key={u.user_id} onClick={() => start(u.user_id)} className="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-surface2" data-testid={`new-dm-user-${u.user_id}`}>
              <Avatar user={u} size={34} /><span><span className="block text-sm font-semibold">{u.name}</span><span className="block text-xs text-sub">{u.job_title}</span></span>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

const DEFAULT_CONVS = [
  {
    id: "conv_circle_user_admin1",
    type: "dm",
    name: "Circle (Workspace Assistant)",
    member_ids: ["user_circle_assistant", "user_admin1"],
    unread: 0,
    last_message_preview: "Halo! Saya Circle, asisten workspace Anda.",
    last_message_at: new Date().toISOString()
  },
  { id: "group_official_marketing", type: "group", name: "Marketing", is_verified: true, member_ids: ["user_admin1"], unread: 0, last_message_preview: "No messages yet" },
  { id: "group_official_sales", type: "group", name: "Sales", is_verified: true, member_ids: ["user_admin1"], unread: 0, last_message_preview: "No messages yet" },
  { id: "group_official_it", type: "group", name: "IT", is_verified: true, member_ids: ["user_admin1"], unread: 0, last_message_preview: "No messages yet" },
  { id: "group_official_finance", type: "group", name: "Finance", is_verified: true, member_ids: ["user_admin1"], unread: 0, last_message_preview: "No messages yet" },
  { id: "group_official_legal", type: "group", name: "Legal", is_verified: true, member_ids: ["user_admin1"], unread: 0, last_message_preview: "No messages yet" },
  { id: "group_official_hrga", type: "group", name: "HRGA", is_verified: true, member_ids: ["user_admin1"], unread: 0, last_message_preview: "No messages yet" }
];

let CONVS_CACHE = DEFAULT_CONVS;
try {
  const saved = localStorage.getItem("circle_convs_cache");
  if (saved) {
    const parsed = JSON.parse(saved);
    if (Array.isArray(parsed) && parsed.length > 0) {
      CONVS_CACHE = parsed;
      hydrateConversationsCache(parsed);
    }
  }
} catch {}

export default function Messages() {
  const { cid } = useParams();
  const { me, userMap, subscribe } = useApp();
  const [convs, setConvs] = useState(() => {
    try {
      const saved = localStorage.getItem("circle_convs_cache");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return Array.isArray(CONVS_CACHE) && CONVS_CACHE.length > 0 ? CONVS_CACHE : DEFAULT_CONVS;
  });
  const [q, setQ] = useState("");
  const [tab, setTab] = useState("all");
  const [dm, setDm] = useState(false);
  const navigate = useNavigate();

  const load = () => api.get("/conversations").then((r) => {
    const arr = Array.isArray(r.data) ? r.data : (Array.isArray(r.data?.conversations) ? r.data.conversations : []);
    if (arr.length > 0) {
      setConvs(arr);
      CONVS_CACHE = arr;
      hydrateConversationsCache(arr);
    }
  }).catch(() => {});

  useEffect(() => { load(); }, [cid]);

  useEffect(() => subscribe((e) => { 
    if (e.type === "message:new") {
      const d = e.data;
      appendMessageToCache(d);
      setConvs((prev) => {
        const list = Array.isArray(prev) ? prev : [];
        const idx = list.findIndex((c) => c && c.id === d.conversation_id);
        if (idx !== -1) {
          const updated = {
            ...list[idx],
            last_message_preview: d.text || "Pesan baru",
            last_message_at: d.created_at || new Date().toISOString(),
            unread: d.sender_id !== me?.user_id && cid !== d.conversation_id ? (list[idx].unread || 0) + 1 : list[idx].unread
          };
          const next = [updated, ...list.filter((c) => c && c.id !== d.conversation_id)];
          CONVS_CACHE = next;
          try { localStorage.setItem("circle_convs_cache", JSON.stringify(next)); } catch {}
          return next;
        }
        return list;
      });
      load();
    } else if (e.type === "message:update") {
      updateMessageInCache(e.data);
    } else if (["read", "conversation:new", "conversations:changed", "access_requests:changed"].includes(e.type)) {
      load();
    }
  }), [subscribe, me?.user_id, cid]); // eslint-disable-line

  const { ws } = useApp();
  const safeConvs = Array.isArray(convs) ? convs : [];
  const named = useMemo(() => safeConvs.map((c) => {
    if (!c) return { id: `conv_${Math.random()}`, title: "Conversation", other: null };
    const mems = Array.isArray(c.member_ids) ? c.member_ids : (Array.isArray(c.members) ? c.members : []);
    const otherId = mems.find((x) => x !== me?.user_id) || me?.user_id;
    const botAvatar = ws?.assistant_avatar || "https://api.dicebear.com/7.x/bottts/svg?seed=CircleWorkspace&backgroundColor=FF5364";
    const botName = ws?.assistant_name || "Circle";

    const isBotDM = c.type === "dm" && (otherId === "user_circle_assistant" || c.id?.includes("circle"));
    const rawOther = userMap ? userMap[otherId] : null;
    const other = c.type === "dm" ? (
      isBotDM ? {
        ...(rawOther || {}),
        user_id: "user_circle_assistant",
        name: botName,
        job_title: "Workspace AI Assistant",
        avatar: botAvatar,
        picture: botAvatar
      } : rawOther
    ) : null;

    let title = c.name || "Group Chat";
    if (c.type === "dm") title = other?.name || botName;

    return {
      ...c,
      other,
      title
    };
  }), [safeConvs, userMap, me, ws?.assistant_name, ws?.assistant_avatar]);
  const list = named.filter((c) => (tab === "all" || (tab === "dm" ? c.type === "dm" : c.type === "group")) && (c.title || "").toLowerCase().includes(q.toLowerCase()));
  return (
    <div className={`flex ${cid ? "h-[100dvh]" : "h-[calc(100dvh-7.5rem)]"} md:h-screen animate-crossfade`} data-testid="messages-page">
      <aside className={`${cid ? "hidden lg:flex" : "flex"} w-full lg:w-[320px] shrink-0 flex-col border-r bg-surface`}>
        <div className="p-4 pb-2">
          <div className="flex items-center justify-between"><h1 className="text-2xl font-bold tracking-tight">Messages</h1>
            <button onClick={() => setDm(true)} className="btn-accent flex h-10 w-10 items-center justify-center" aria-label="New message" data-testid="new-message-btn"><Plus size={18} /></button></div>
          <div className="mt-3 flex items-center gap-2 rounded-xl border bg-surface2 px-3"><Search size={15} className="text-sub" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter conversations" className="h-10 flex-1 bg-transparent text-sm outline-none" data-testid="conversation-filter-input" /></div>
          <div className="mt-3 flex gap-1 rounded-xl bg-surface2 p-1 text-xs font-semibold">
            {[["all", "All"], ["dm", "Direct"], ["group", "Groups"]].map(([k, l]) => <button key={k} onClick={() => setTab(k)} className={`flex-1 rounded-lg py-1.5 transition-all duration-160 ease-out ${tab === k ? "bg-surface text-ink shadow-sm font-bold" : "text-sub hover:text-ink"}`} data-testid={`conv-tab-${k}`}>{l}</button>)}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-2 pb-2 scroll-thin">
          {list.map((c) => (
            <button key={c.id} onClick={() => navigate(`/messages/${c.id}`)} data-testid={`conversation-item-${c.id}`}
              className={`flex w-full items-center gap-3 rounded-2xl p-2.5 text-left transition-colors ${cid === c.id ? "bg-soft-red" : "hover:bg-surface2"}`}>
              {c.other ? <Avatar user={c.other} size={42} /> : <GroupIcon c={c} size={42} />}
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1 min-w-0">
                    <span className="truncate text-sm font-semibold">{c.title}</span>
                    {c.is_verified && <ShieldCheck size={13} className="shrink-0 text-blue-500 fill-blue-500/10" />}
                  </span>
                  <span className="shrink-0 text-[10px] text-sub">{fmtTime(c.last_message_at)}</span>
                </span>
                <span className="flex items-center justify-between gap-2"><span className="truncate text-xs text-sub">{c.last_message_preview || "No messages yet"}</span>{c.unread > 0 && <span className="rounded-full bg-brand px-1.5 text-[10px] font-bold text-white" data-testid="conversation-unread">{c.unread}</span>}</span>
              </span>
            </button>
          ))}
          {!list.length && <Empty icon={MessageCircle} title="No conversations" text="Start a direct message or join a group." />}
        </div>
      </aside>
      <section className={`${cid ? "flex" : "hidden lg:flex"} min-w-0 flex-1`}>
        {cid ? <ChatView cid={cid} onChange={load} /> : <div className="flex flex-1 items-center justify-center"><Empty icon={MessageCircle} title="Pick a conversation" text="Your messages stay private to the people in each conversation." /></div>}
      </section>
      <NewDM open={dm} onOpenChange={setDm} />
    </div>
  );
}
