import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Reply, Smile, Pencil, Trash2, Pin, CheckSquare, FileText, MoreHorizontal, Check, CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { api, errMsg, fileUrl } from "../../lib/api";
import { useApp } from "../../context/AppContext";
import { Avatar, StatusBadge, PriorityBadge, fmtTime } from "../../components/common";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../../components/ui/dropdown-menu";
import PollCard from "./PollCard";
import { StickerTile } from "./Composer";

function TaskPreview({ m }) {
  const { userMap, me, isManager, subscribe } = useApp();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [task, setTask] = useState(m.task || {});
  useEffect(() => subscribe((e) => e.type === "tasks:changed" && e.task?.id === task.id && setTask(e.task)), [subscribe, task.id]);
  
  const t = task || {};
  const approval = t.approval || { needed: 2, approved_by: [], status: t.status === "done" ? "approved" : "pending" };
  const approvedCount = (approval.approved_by || []).length;
  const isApprovedFull = approvedCount >= 2 || approval.status === "approved" || t.status === "done";
  const reqIds = t.requestor_ids || (t.requestor_id ? [t.requestor_id] : []);
  const revIds = t.reviewer_ids && t.reviewer_ids.length ? t.reviewer_ids : reqIds;
  const can = isManager || revIds.includes(me.user_id) || reqIds.includes(me.user_id);
  const alreadyApproved = (approval.approved_by || []).includes(me.user_id);

  const decide = async (decision) => {
    let note = "";
    if (decision === "revise") {
      const p = window.prompt("Catatan revisi:", "");
      if (p === null) return;
      note = p;
    }
    setBusy(true);
    try {
      const res = await api.post(`/tasks/${t.id}/approval`, {
        decision,
        note,
        message_id: m.id
      });
      if (decision === "approve") {
        if (res.data?.status === "done") {
          toast.success("Persetujuan tercapai 100%! Task otomatis dipindah ke Done.");
        } else {
          toast.success("Persetujuan dicatat (1/2). Menunggu 1 orang lagi.");
        }
      } else {
        toast.info("Catatan revisi terkirim. Task dikembalikan ke In Progress.");
      }
    } catch (e) {
      toast.error(errMsg(e));
    }
    setBusy(false);
  };

  return (
    <div className="w-80 max-w-full rounded-2xl border border-slate-200/80 bg-surface p-4 text-left text-ink shadow-sm" data-testid={`message-task-card-${t.id}`}>
      <button onClick={() => navigate(`/tasks?task=${t.id}`)} className="block w-full text-left group">
        <div className="flex items-center justify-end text-sub mb-1">
          <span className="text-xs font-semibold text-slate-500">{t.number_str || `T-${t.number}`}</span>
        </div>
        <p className="font-bold text-sm text-ink group-hover:text-brand transition-colors line-clamp-2">{t.title}</p>
        <div className="mt-2 flex flex-wrap gap-1.5 items-center">
          <StatusBadge status={t.status} />
          <PriorityBadge value={t.priority} />
        </div>
      </button>

      {/* 2-Person Approval Progress */}
      <div className="mt-3.5 pt-3 border-t">
        <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
          <span className="text-slate-500">Progress Approval (min. 2 orang)</span>
          <span className={`font-bold ${isApprovedFull ? "text-emerald-600" : "text-amber-600"}`}>
            {isApprovedFull ? "100% Selesai (2/2)" : `${approvedCount}/2 Disetujui`}
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <div
            className={`h-full transition-all duration-500 ${isApprovedFull ? "bg-emerald-500" : "bg-amber-500"}`}
            style={{ width: `${isApprovedFull ? 100 : (approvedCount / 2) * 100}%` }}
          />
        </div>

        {approval.approved_by?.length > 0 && (
          <p className="mt-2 text-[11px] text-slate-500">
            Disetujui: <b className="text-ink">{approval.approved_by.map((uid) => userMap[uid]?.name?.split(" ")[0] || uid).join(", ")}</b>
          </p>
        )}
      </div>

      {/* Action buttons */}
      {!isApprovedFull ? (
        can ? (
          <div className="mt-3.5 grid grid-cols-2 gap-2">
            <button
              disabled={busy || alreadyApproved}
              onClick={() => decide("approve")}
              className="h-9 rounded-xl bg-emerald-500 text-xs font-bold text-white shadow-sm hover:bg-emerald-600 disabled:opacity-50 transition-colors"
              data-testid={`task-preview-approve-${m.id}`}
            >
              {alreadyApproved ? "Sudah Setuju ✓" : "Setuju"}
            </button>
            <button
              disabled={busy}
              onClick={() => decide("revise")}
              className="h-9 rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/30 text-xs font-bold text-amber-700 dark:text-amber-300 hover:bg-amber-100 disabled:opacity-50 transition-colors"
              data-testid={`task-preview-revise-${m.id}`}
            >
              Revisi
            </button>
          </div>
        ) : (
          <p className="mt-3 text-center text-xs text-sub">Menunggu persetujuan dari requestor/manager.</p>
        )
      ) : (
        <div className="mt-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 p-2 text-center text-xs font-bold text-emerald-700 dark:text-emerald-300">
          ✓ Disetujui 100% · Status: Done
        </div>
      )}
    </div>
  );
}

function AccessRequestCard({ m }) {
  const { me, isManager, isAdmin, subscribe } = useApp();
  const [busy, setBusy] = useState(false);
  const [req, setReq] = useState(m.access_request || {});
  const [assignedRole, setAssignedRole] = useState(req.assigned_role || req.job_title || "employee");

  useEffect(() => {
    if (m.access_request) setReq(m.access_request);
  }, [m.access_request]);

  useEffect(() => {
    return subscribe((e) => {
      if (e.type === "access_requests:changed") {
        api.get("/admin/access-requests").then((res) => {
          const found = (res.data || []).find((x) => x.id === req.id);
          if (found) setReq(found);
        }).catch(() => {});
      }
    });
  }, [subscribe, req.id]);

  const canApprove = isAdmin || isManager;
  const isPending = req.status === "pending";
  const isApproved = req.status === "approved";
  const isRejected = req.status === "rejected";

  const handleApprove = async () => {
    const prevReq = req;
    const optimistic = {
      ...req,
      status: "approved",
      approved_by: me?.name || "Admin",
      approved_at: new Date().toISOString(),
      assigned_role: assignedRole
    };
    setReq(optimistic);
    setBusy(true);
    try {
      await api.post(`/admin/access-requests/${req.id}/approve`, {
        role: assignedRole,
        department: req.department
      });
      toast.success(`Akses untuk ${req.name} berhasil disetujui!`);
    } catch (e) {
      setReq(prevReq);
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const handleReject = async () => {
    if (!window.confirm(`Tolak permohonan akses dari ${req.name}?`)) return;
    const prevReq = req;
    const optimistic = {
      ...req,
      status: "rejected",
      rejected_by: me?.name || "Admin",
      rejected_at: new Date().toISOString()
    };
    setReq(optimistic);
    setBusy(true);
    try {
      await api.post(`/admin/access-requests/${req.id}/reject`);
      toast.info(`Permintaan akses ${req.name} ditolak.`);
    } catch (e) {
      setReq(prevReq);
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="w-88 max-w-full rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-surface p-4 text-left text-ink shadow-md" data-testid={`access-request-card-${req.id}`}>
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-brand to-rose-400 text-white font-bold text-xs shadow-xs">
            🤖
          </div>
          <div>
            <h4 className="text-xs font-bold text-ink leading-tight">Permintaan Akses Masuk</h4>
            <p className="text-[10px] text-sub font-medium">Asisten Workspace: Circle</p>
          </div>
        </div>
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
          isApproved
            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
            : isRejected
            ? "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300"
            : "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
        }`}>
          {isApproved ? "✓ Disetujui" : isRejected ? "✕ Ditolak" : "⏳ Menunggu"}
        </span>
      </div>

      {/* Requester Info */}
      <div className="mt-3 space-y-2 text-xs">
        <div className="flex items-start gap-2.5 rounded-xl bg-surface2/60 p-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand font-bold text-sm">
            {req.name ? req.name.charAt(0).toUpperCase() : "U"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-bold text-ink text-sm truncate">{req.name}</p>
            <p className="text-sub truncate text-[11px]">{req.email}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-[11.5px]">
          <div className="rounded-lg border bg-surface2/40 px-2.5 py-1.5">
            <span className="block text-[10px] uppercase font-bold text-sub tracking-wider">Divisi</span>
            <span className="font-semibold text-ink">{req.department || "General"}</span>
          </div>
          <div className="rounded-lg border bg-surface2/40 px-2.5 py-1.5">
            <span className="block text-[10px] uppercase font-bold text-sub tracking-wider">Jabatan / Posisi</span>
            <span className="font-semibold text-ink truncate block">{req.job_title || "Employee"}</span>
          </div>
        </div>

        {req.note && req.note !== "-" && (
          <div className="rounded-lg border bg-surface2/30 p-2 text-[11.5px]">
            <span className="block text-[10px] uppercase font-bold text-sub tracking-wider mb-0.5">Alasan / Catatan:</span>
            <p className="text-ink/80 italic font-medium">"{req.note}"</p>
          </div>
        )}

        <p className="text-[10px] text-sub text-right pt-1">
          Diajukan: {fmtTime(req.created_at)}
        </p>
      </div>

      {/* Status or Action Buttons */}
      <div className="mt-3.5 pt-3 border-t">
        {isPending ? (
          canApprove ? (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-[11px] text-sub font-medium">Tetapkan Role:</span>
                <select
                  value={assignedRole}
                  onChange={(e) => setAssignedRole(e.target.value)}
                  className="h-7 flex-1 rounded-md border bg-surface px-2 text-xs font-semibold text-ink outline-none"
                  data-testid="access-role-select"
                >
                  <option value="employee">Employee</option>
                  <option value="project_manager">Project Manager</option>
                  <option value="department_manager">Department Manager</option>
                  <option value="workspace_admin">Workspace Admin</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  disabled={busy}
                  onClick={handleApprove}
                  className="flex h-9 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 font-bold text-xs text-white shadow-xs hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                  data-testid={`approve-access-btn-${req.id}`}
                >
                  Setujui Akses
                </button>
                <button
                  disabled={busy}
                  onClick={handleReject}
                  className="flex h-9 items-center justify-center gap-1 rounded-xl border border-rose-300 bg-rose-50 dark:bg-rose-950/30 font-bold text-xs text-rose-700 dark:text-rose-300 hover:bg-rose-100 disabled:opacity-50 transition-colors"
                  data-testid={`reject-access-btn-${req.id}`}
                >
                  Tolak
                </button>
              </div>
            </div>
          ) : (
            <p className="text-center text-xs text-sub italic">
              Menunggu persetujuan dari Super Admin / Manager.
            </p>
          )
        ) : isApproved ? (
          <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 p-2 text-center text-xs font-bold text-emerald-700 dark:text-emerald-300">
            ✓ Akses Disetujui oleh {req.approved_by || "Admin"}
          </div>
        ) : (
          <div className="rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 p-2 text-center text-xs font-bold text-rose-700 dark:text-rose-300">
            ✕ Permintaan Ditolak oleh {req.rejected_by || "Admin"}
          </div>
        )}
      </div>
    </div>
  );
}

const QUICK = ["👍", "❤️", "😂", "🎉", "🙏", "👀"];

function renderText(text, userMap) {
  const parts = text.split(/(https?:\/\/[^\s]+|@[A-Z][\w]*(?: [A-Z][\w]*)?)/g);
  return parts.map((p, i) => {
    if (/^https?:\/\//.test(p)) return <a key={i} href={p} target="_blank" rel="noreferrer" className="underline break-all">{p}</a>;
    if (p.startsWith("@") && Object.values(userMap).some((u) => `@${u.name}` === p || p.startsWith(`@${u.name.split(" ")[0]}`))) return <span key={i} className="rounded bg-soft-blue px-1 font-semibold">{p}</span>;
    return p;
  });
}

export default function MessageItem({ m, mine, grouped, conv, onReply, onCreateTask, readBy }) {
  const { userMap, me } = useApp();
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(m.text);
  const navigate = useNavigate();
  const sender = userMap[m.sender_id];
  const act = (fn) => async () => { try { await fn(); } catch (e) { toast.error(errMsg(e)); } };
  const react = (emoji) => act(() => api.post(`/messages/${m.id}/react`, { emoji }))();
  const save = act(async () => { await api.patch(`/messages/${m.id}`, { text: val }); setEditing(false); });


  const bubble = mine ? "bg-brand text-white rounded-br-md" : "bg-surface border rounded-bl-md";
  const images = (m.attachments || []).filter((a) => a.content_type?.startsWith("image/"));
  const docs = (m.attachments || []).filter((a) => !a.content_type?.startsWith("image/"));
  const plain = m.type === "sticker" || m.type === "poll" || m.type === "task" || m.type === "approval_card" || m.type === "access_request_card";
  return (
    <div className={`group flex gap-2.5 ${mine ? "flex-row-reverse" : ""} ${grouped ? "mt-0.5" : "mt-4"}`} data-testid={`message-${m.id}`}>
      <div className="w-8 shrink-0">{!grouped && !mine && <Avatar user={sender} size={32} />}</div>
      <div className={`flex min-w-0 max-w-[82%] sm:max-w-[70%] flex-col ${mine ? "items-end" : "items-start"}`}>
        {!grouped && <p className="mb-1 px-1 text-[11px] text-sub"><b className="font-semibold text-ink">{mine ? "You" : sender?.name}</b> · {fmtTime(m.created_at)}{m.pinned && <Pin size={10} className="ml-1 inline text-brand" />}</p>}
        {m.reply_to && <div className={`mb-1 max-w-full truncate rounded-xl border-l-4 border-[var(--c-accent)] bg-surface2 px-2.5 py-1 text-xs text-sub`}>{userMap[m.reply_to.sender_id]?.name}: {m.reply_to.text}</div>}
        <div className="flex items-center gap-1">
          <div className={`min-w-0 ${mine ? "order-2" : ""}`}>
            {m.deleted ? <div className="rounded-2xl border border-dashed px-3 py-2 text-sm italic text-sub">Message deleted</div> : (<>
              {m.type === "sticker" && m.sticker && <StickerTile s={m.sticker} size={120} />}
              {m.type === "poll" && <PollCard pollId={m.poll_id} />}
              {(m.type === "task" || m.type === "approval_card") && m.task && <TaskPreview m={m} />}
              {m.type === "access_request_card" && (m.access_request || m.data) && <AccessRequestCard m={m} />}
              {(m.text && m.type !== "poll" && m.type !== "access_request_card") && (editing ? (
                <div className="flex flex-col gap-1"><textarea value={val} onChange={(e) => setVal(e.target.value)} className="w-72 max-w-full rounded-xl border bg-surface p-2 text-sm text-ink" data-testid="edit-message-input" />
                  <div className="flex gap-2 text-xs"><button onClick={save} className="font-semibold text-brand" data-testid="save-edit-btn">Save</button><button onClick={() => setEditing(false)} className="text-sub">Cancel</button></div></div>
              ) : <div className={`${plain ? "mt-1 text-sm" : `rounded-2xl px-3.5 py-2 text-[14.5px] leading-relaxed ${bubble}`} whitespace-pre-wrap break-words`}>{renderText(m.text, userMap)}{m.edited && <span className="ml-1 text-[10px] opacity-70">(edited)</span>}</div>)}
              {images.length > 0 && <div className="mt-1 grid grid-cols-2 gap-1">{images.map((a) => <a key={a.id} href={fileUrl(a.id)} target="_blank" rel="noreferrer"><img src={fileUrl(a.id)} alt={a.name} loading="lazy" className="h-36 w-36 sm:h-44 sm:w-44 rounded-xl object-cover" /></a>)}</div>}
              {docs.map((a) => <a key={a.id} href={fileUrl(a.id)} target="_blank" rel="noreferrer" className="mt-1 flex items-center gap-2 rounded-xl border bg-surface px-3 py-2 text-sm text-ink" data-testid={`message-file-${a.id}`}><FileText size={16} className="text-brand" /><span className="max-w-[200px] truncate">{a.name}</span><span className="text-[10px] text-sub">{Math.ceil(a.size / 1024)} KB</span></a>)}
            </>)}
          </div>
          {!m.deleted && !editing && (
            <div className={`flex items-center opacity-100 md:opacity-0 transition-opacity group-hover:opacity-100 ${mine ? "order-1" : ""}`}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild><button className="flex h-8 w-8 items-center justify-center rounded-full text-sub hover:bg-surface2" aria-label="Message actions" data-testid={`message-actions-${m.id}`}><MoreHorizontal size={16} /></button></DropdownMenuTrigger>
                <DropdownMenuContent align={mine ? "end" : "start"} className="bg-surface">
                  <div className="flex gap-0.5 p-1">{QUICK.map((e) => <DropdownMenuItem key={e} onClick={() => react(e)} className="h-8 w-8 justify-center rounded-lg p-0 text-lg" data-testid={`react-${e}`}>{e}</DropdownMenuItem>)}</div>
                  <DropdownMenuItem onClick={() => onReply(m)} data-testid="action-reply"><Reply size={14} className="mr-2" />Reply</DropdownMenuItem>
                  <DropdownMenuItem onClick={act(() => api.post(`/messages/${m.id}/pin`))} data-testid="action-pin"><Pin size={14} className="mr-2" />{m.pinned ? "Unpin" : "Pin"}</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onCreateTask(m)} data-testid="action-create-task"><CheckSquare size={14} className="mr-2" />Create task</DropdownMenuItem>
                  {mine && m.type === "text" && <DropdownMenuItem onClick={() => setEditing(true)} data-testid="action-edit"><Pencil size={14} className="mr-2" />Edit</DropdownMenuItem>}
                  {(mine || conv?.admin_ids?.includes(me?.user_id) || conv?.type === "dm" || conv?.type === "group_message") && <DropdownMenuItem onClick={act(() => api.delete(`/messages/${m.id}`))} className="text-rose-600" data-testid="action-delete"><Trash2 size={14} className="mr-2" />Delete</DropdownMenuItem>}
                </DropdownMenuContent>
              </DropdownMenu>
              <button onClick={() => react("👍")} className="hidden h-8 w-8 items-center justify-center rounded-full text-sub hover:bg-surface2 md:flex" aria-label="React"><Smile size={15} /></button>
            </div>
          )}
        </div>
        {Object.keys(m.reactions || {}).length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">{Object.entries(m.reactions).map(([e, us]) => <button key={e} onClick={() => react(e)} title={us.map((u) => userMap[u]?.name).join(", ")} className={`rounded-full border px-2 py-0.5 text-xs ${us.includes(me.user_id) ? "border-[var(--c-accent)] bg-soft-red" : "bg-surface"}`} data-testid={`reaction-${e}`}>{e} {us.length}</button>)}</div>
        )}
        {mine && readBy !== undefined && <span className="mt-0.5 flex items-center gap-0.5 text-[10px] text-sub" data-testid="read-receipt">{readBy > 0 ? <><CheckCheck size={12} className="text-blue-500" />Read{conv.type === "group" ? ` by ${readBy}` : ""}</> : <><Check size={12} />Delivered</>}</span>}
      </div>
    </div>
  );
}
