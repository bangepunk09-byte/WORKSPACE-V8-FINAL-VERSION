import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Hash, CheckSquare, FolderKanban, BarChart3, MessageCircle, HardDrive } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "./ui/dialog";
import { api } from "../lib/api";
import { Avatar, StatusBadge } from "./common";
import { getCachedDriveShortcuts } from "../data/initialDriveShortcuts";

function Section({ title, children }) {
  return <div className="mb-3"><p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-sub">{title}</p>{children}</div>;
}
function Row({ onClick, children, testid }) {
  return <button onClick={onClick} data-testid={testid} className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left text-sm hover:bg-surface2">{children}</button>;
}

export default function SearchDialog({ open, onOpenChange }) {
  const [q, setQ] = useState("");
  const [res, setRes] = useState(null);
  const navigate = useNavigate();
  useEffect(() => {
    const qTrim = q.trim();
    if (!qTrim) { setRes(null); return undefined; }
    const ql = qTrim.toLowerCase();
    // Instant 0ms local search from cached data
    try {
      const users = JSON.parse(localStorage.getItem("circle_users_cache") || "[]");
      const tasks = JSON.parse(localStorage.getItem("circle_tasks_cache") || "[]");
      const groups = JSON.parse(localStorage.getItem("circle_groups_cache") || "[]");
      const projects = JSON.parse(localStorage.getItem("circle_projects_cache") || "[]");
      const driveShortcuts = getCachedDriveShortcuts() || [];
      setRes({
        drive_shortcuts: driveShortcuts.filter((d) => `${d.name} ${d.description || ""} ${d.category || ""}`.toLowerCase().includes(ql)).slice(0, 5),
        employees: users.filter((u) => !u.is_bot && `${u.name} ${u.job_title} ${u.department}`.toLowerCase().includes(ql)).slice(0, 5),
        tasks: tasks.filter((t) => `${t.title} ${t.number_str || ""}`.toLowerCase().includes(ql)).slice(0, 5),
        groups: groups.filter((g) => (g.name || "").toLowerCase().includes(ql)).slice(0, 5),
        messages: [],
        projects: projects.filter((p) => (p.name || "").toLowerCase().includes(ql)).slice(0, 5),
        polls: []
      });
    } catch {}
    const t = setTimeout(() => {
      api.get("/search", { params: { q: qTrim } }).then((r) => {
        if (r.data && typeof r.data === "object" && !Array.isArray(r.data)) {
          setRes(r.data);
        }
      }).catch(() => {});
    }, 80);
    return () => clearTimeout(t);
  }, [q]);
  const go = (path) => { onOpenChange(false); setQ(""); navigate(path); };
  const empty = res && typeof res === "object" && Object.values(res).every((a) => !Array.isArray(a) || !a.length);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl gap-0 overflow-hidden bg-surface p-0 rounded-3xl">
        <DialogTitle className="sr-only">Global search</DialogTitle>
        <div className="flex items-center gap-2 border-b px-4"><Search size={18} className="text-sub" />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search directory, employees, messages, groups, tasks, projects…" className="h-14 flex-1 bg-transparent text-[15px] outline-none" data-testid="global-search-input" />
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-2 scroll-thin" data-testid="global-search-results">
          {!res && <p className="p-6 text-center text-sm text-sub">Type to search across your workspace.</p>}
          {empty && <p className="p-6 text-center text-sm text-sub">No results for “{q}”.</p>}
          {res?.drive_shortcuts?.length > 0 && <Section title="Directory (Google Drive)">{res.drive_shortcuts.map((d) => <Row key={d.id} testid={`search-drive-${d.id}`} onClick={() => go(`/directory`)}><HardDrive size={16} className="text-brand" /><span className="flex-1 truncate font-medium">{d.name}</span><span className="text-xs text-sub">{d.category}</span></Row>)}</Section>}
          {res?.employees?.length > 0 && <Section title="Employee">{res.employees.map((e) => <Row key={e.user_id} testid={`search-employee-${e.user_id}`} onClick={() => go(`/people/${e.user_id}`)}><Avatar user={e} size={28} showStatus={false} /><span className="flex-1">{e.name}</span><span className="text-xs text-sub">{e.job_title}</span></Row>)}</Section>}
          {res?.tasks?.length > 0 && <Section title="Tasks">{res.tasks.map((t) => <Row key={t.id} testid={`search-task-${t.id}`} onClick={() => go(`/tasks?task=${t.id}`)}><CheckSquare size={16} className="text-sub" /><span className="text-xs text-sub">{t.number_str}</span><span className="flex-1 truncate">{t.title}</span><StatusBadge status={t.status} /></Row>)}</Section>}
          {res?.groups?.length > 0 && <Section title="Groups">{res.groups.map((g) => <Row key={g.id} onClick={() => go(`/messages/${g.id}`)}><Hash size={16} className="text-sub" /><span className="flex-1">{g.name}</span></Row>)}</Section>}
          {res?.messages?.length > 0 && <Section title="Messages">{res.messages.map((m) => <Row key={m.id} onClick={() => go(`/messages/${m.conversation_id}`)}><MessageCircle size={16} className="text-sub" /><span className="flex-1 truncate">{m.text}</span></Row>)}</Section>}
          {res?.projects?.length > 0 && <Section title="Projects">{res.projects.map((p) => <Row key={p.id} onClick={() => go(`/projects/${p.id}`)}><FolderKanban size={16} className="text-sub" /><span className="flex-1">{p.name}</span></Row>)}</Section>}
          {res?.polls?.length > 0 && <Section title="Polls">{res.polls.map((p) => <Row key={p.id} onClick={() => go(`/messages/${p.conversation_id}`)}><BarChart3 size={16} className="text-sub" /><span className="flex-1 truncate">{p.question}</span></Row>)}</Section>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
