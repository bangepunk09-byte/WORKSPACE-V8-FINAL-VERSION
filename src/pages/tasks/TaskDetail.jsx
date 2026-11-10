import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Archive, Share2, Paperclip, CheckCircle2, RotateCcw, Send, MessageSquare, History, Link2, Pencil, X } from "lucide-react";
import { toast } from "sonner";
import { api, errMsg } from "../../lib/api";
import { useApp } from "../../context/AppContext";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "../../components/ui/sheet";
import { Avatar, Spinner, fmtDate, rel, dueInfo } from "../../components/common";
import RichEditor, { RichView } from "../../components/RichEditor";
import { inp, UserSelect, MultiUserSelect, PrioritySelect, LabelPicker, ItemPicker, ColorPicker, AttachmentList, useUploader, ListEditor } from "./fields";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../../components/ui/select";
import { toDeadline } from "./TaskCreate";
import Checkpoints, { CommentItem } from "./Checkpoints";
import { playSound } from "../../lib/sound";
import { INITIAL_TASKS } from "../../data/initialTasks";

function Row({ label, children }) {
  return <div className="grid items-center gap-1 sm:grid-cols-[120px_1fr] sm:gap-3"><span className="text-xs font-semibold text-sub">{label}</span><div className="min-w-0">{children}</div></div>;
}

function Comments({ t, reload }) {
  const { users } = useApp();
  const [text, setText] = useState("");
  const send = async () => {
    const full = users.filter((u) => text.includes(`@${u.name}`));
    const ids = (full.length ? full : users.filter((u) => new RegExp(`@${u.name.split(" ")[0]}(?![\\w])`).test(text) && users.filter((x) => x.name.split(" ")[0] === u.name.split(" ")[0]).length === 1)).map((u) => u.user_id);
    try { await api.post(`/tasks/${t.id}/comments`, { text, mention_ids: ids }); setText(""); reload(); } catch (e) { toast.error(errMsg(e)); }
  };
  return (
    <div data-testid="task-comments">
      {(t.comments || []).map((c) => <CommentItem key={c.id} c={c} t={t} reload={reload} showCheckpoint />)}
      <div className="flex gap-2"><textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Write a comment… use @Name to mention" className="min-h-[44px] flex-1 rounded-xl border bg-surface2 p-2.5 text-sm outline-none" data-testid="task-comment-input" />
        <button onClick={send} disabled={!text.trim()} className="btn-accent flex h-11 w-11 items-center justify-center disabled:opacity-40" aria-label="Send comment" data-testid="task-comment-submit"><Send size={16} /></button></div>
    </div>
  );
}

export default function TaskDetail({ id, onClose, onChanged }) {
  const { me, statuses, userMap, isManager } = useApp();
  const [t, setT] = useState(null);
  const [projects, setProjects] = useState([]);
  const [boards, setBoards] = useState([]);
  const [editDesc, setEditDesc] = useState(false);
  const [desc, setDesc] = useState("");
  const [tab, setTab] = useState("comments");
  const [groups, setGroups] = useState(null);
  const navigate = useNavigate();
  const load = () => {
    api.get(`/tasks/${id}`)
      .then((r) => setT(r.data))
      .catch(() => {
        const local = INITIAL_TASKS.find((x) => x.id === id);
        if (local) {
          setT(local);
        } else {
          toast.error("Task not found");
          onClose();
        }
      });
  };
  useEffect(() => { if (id) { setT(null); setEditDesc(false); load(); api.get("/projects").then((r) => setProjects(r.data)); api.get("/boards").then((r) => setBoards(r.data)); } }, [id]); // eslint-disable-line
  const patch = async (body, msg) => {
    try {
      const { data } = await api.patch(`/tasks/${id}`, body);
      setT(data);
      if (body.status === "done" || statuses.find((s) => s.key === body.status)?.is_done) {
        playSound("task_done");
      } else {
        playSound("click");
      }
      onChanged?.();
      if (msg) toast.success(msg);
    } catch (e) {
      toast.error(errMsg(e));
    }
  };
  const setAtt = (fn) => patch({ attachments: fn(t.attachments) });
  const { pick, input } = useUploader(setAtt);
  const share = async (cid) => { try { await api.patch(`/tasks/${id}`, { status: "in_review" }); await api.post(`/tasks/${id}/share`, { conversation_id: cid }); toast.success("Preview dikirim ke grup dan status diubah ke In Review"); setGroups(null); load(); } catch (e) { toast.error(errMsg(e)); } };
  const done = statuses.find((s) => s.key === t?.status)?.is_done;
  const ro = t ? t.can_edit === false : false;
  const d = t && dueInfo(t.deadline, done);
  const reqIds = t?.requestor_ids && t.requestor_ids.length ? t.requestor_ids : (t?.requestor_id ? [t.requestor_id] : []);
  const revIds = t?.reviewer_ids && t.reviewer_ids.length ? t.reviewer_ids : reqIds;
  const reviewer = t && me?.user_id && (revIds.includes(me.user_id) || reqIds.includes(me.user_id));
  const members = t?.board?.member_ids || [];
  return (
    <Sheet open={!!id} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full overflow-y-auto bg-surface p-0 sm:max-w-2xl" data-testid="task-detail-panel">
        <SheetHeader className="flex flex-row items-center justify-between border-b px-6 py-4">
          <SheetTitle className="text-base font-bold">Detail Tugas</SheetTitle>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-sub hover:bg-surface2 hover:text-ink transition-colors cursor-pointer"
            aria-label="Tutup detail"
            data-testid="task-detail-close-btn"
          >
            <X size={18} />
          </button>
        </SheetHeader>
        {!t ? <Spinner /> : (
          <div className="animate-task-reveal pb-10">
            <div className="h-2" style={{ background: t.card_color || "transparent" }} />
            <div className="space-y-5 p-5 sm:p-6">
              <div>
                <p className="text-xs font-semibold text-sub" data-testid="task-detail-id">{t.number_str}{t.archived && " · Archived"}{done && t.completed_at && <span className="text-emerald-600"> · Completed {fmtDate(t.completed_at, "d MMM yyyy HH:mm")} by {userMap[t.completed_by]?.name}</span>}</p>
                <input defaultValue={t.title} key={t.updated_at} disabled={ro} onBlur={(e) => e.target.value.trim() && e.target.value !== t.title && patch({ title: e.target.value })} className="mt-1 w-full bg-transparent text-2xl font-bold outline-none" data-testid="task-detail-title" />
              </div>
              
              {/* Approval status banner */}
              {t.status === "in_review" && (
                <div className="rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-800 p-4 space-y-3" data-testid="review-actions">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-amber-800 dark:text-amber-200">
                      Menunggu Approval (Minimal 2 Orang untuk 100% Selesai)
                    </span>
                    <span className="rounded-full bg-amber-200/60 dark:bg-amber-900/40 px-2.5 py-0.5 text-xs font-bold text-amber-900 dark:text-amber-200">
                      {t.approval?.approved_by?.length || 0}/2 Disetujui ({Math.min(100, Math.round(((t.approval?.approved_by?.length || 0) / 2) * 100))}%)
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-amber-200/50">
                    <div
                      className="h-full bg-emerald-500 transition-all duration-300"
                      style={{ width: `${Math.min(100, ((t.approval?.approved_by?.length || 0) / 2) * 100)}%` }}
                    />
                  </div>
                  {t.approval?.approved_by?.length > 0 && (
                    <div className="flex items-center gap-1.5 text-xs text-amber-800 dark:text-amber-300">
                      <span>Telah disetujui oleh:</span>
                      <b>{t.approval.approved_by.map((uid) => userMap[uid]?.name?.split(" ")[0] || uid).join(", ")}</b>
                    </div>
                  )}
                  {(reviewer || isManager) && (
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={async () => {
                          const note = window.prompt("Catatan revisi (opsional):", "");
                          if (note === null) return;
                          try {
                            await api.post(`/tasks/${id}/approval`, { decision: "revise", note });
                            toast.success("Catatan revisi dikirim, status kembali ke In Progress");
                            load();
                            onChanged?.();
                          } catch (err) { toast.error(errMsg(err)); }
                        }}
                        className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl border border-amber-300 bg-surface px-4 text-xs font-bold text-amber-800 hover:bg-amber-100 dark:bg-surface2"
                        data-testid="request-revision-btn"
                      >
                        <RotateCcw size={14} /> Revisi
                      </button>
                      <button
                        onClick={async () => {
                          try {
                            const res = await api.post(`/tasks/${id}/approval`, { decision: "approve" });
                            if (res.data?.status === "done") {
                              playSound("task_done");
                              toast.success("Task disetujui 2 orang (100%) dan otomatis dipindah ke Done!");
                            } else {
                              playSound("click");
                              toast.success("Disetujui 1/2. Menunggu 1 persetujuan lagi.");
                            }
                            load();
                            onChanged?.();
                          } catch (err) { toast.error(errMsg(err)); }
                        }}
                        className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-500 px-4 text-xs font-bold text-white shadow-sm hover:bg-emerald-600"
                        data-testid="approve-task-btn"
                      >
                        <CheckCircle2 size={14} /> Setuju
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-3">
                <Row label="Board">
                  <Select value={t.board_id || ""} disabled={ro} onValueChange={(val) => patch({ board_id: val }, "Task dipindah ke board lain")}>
                    <SelectTrigger className="w-full bg-surface2 border-slate-200 dark:border-slate-800 rounded-xl" data-testid="task-detail-board">
                      <SelectValue placeholder="Pilih board..." />
                    </SelectTrigger>
                    <SelectContent>
                      {!boards.some((b) => b.id === t.board_id) && t.board && (
                        <SelectItem key={t.board.id} value={t.board.id}>{t.board.name}</SelectItem>
                      )}
                      {boards.map((b) => (
                        <SelectItem key={b.id} value={b.id} data-testid={`board-option-${b.id}`}>{b.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Row>
                <Row label="Status">
                  <Select value={t.status} disabled={ro} onValueChange={(val) => patch({ status: val })}>
                    <SelectTrigger className="w-full bg-surface2 border-slate-200 dark:border-slate-800 rounded-xl" data-testid="task-detail-status">
                      <SelectValue placeholder="Pilih status..." />
                    </SelectTrigger>
                    <SelectContent>
                      {statuses.map((s) => (
                        <SelectItem key={s.key} value={s.key} data-testid={`status-option-${s.key}`}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Row>

                {/* Multi Requestor with Auto Reviewer */}
                <Row label="Requestor">
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {reqIds.map((uid) => (
                        <span key={uid} className="inline-flex items-center gap-1.5 rounded-full border bg-surface2 px-2.5 py-1 text-xs font-semibold">
                          <Avatar user={userMap[uid]} size={18} showStatus={false} />
                          {userMap[uid]?.name || "User"}
                          {!ro && reqIds.length > 1 && (
                            <button
                              type="button"
                              onClick={() => {
                                const next = reqIds.filter((x) => x !== uid);
                                patch({ requestor_ids: next, reviewer_ids: next }, "Requestor diperbarui");
                              }}
                              className="ml-0.5 text-slate-400 hover:text-rose-500"
                              title="Hapus requestor"
                            >
                              ×
                            </button>
                          )}
                        </span>
                      ))}
                      {!ro && (
                        <select
                          value=""
                          onChange={(e) => {
                            if (e.target.value && !reqIds.includes(e.target.value)) {
                              const next = [...reqIds, e.target.value];
                              patch({ requestor_ids: next, reviewer_ids: next }, "Requestor ditambah");
                            }
                          }}
                          className="h-7 rounded-full border bg-surface px-2 text-xs font-medium"
                        >
                          <option value="">+ Tambah Requestor</option>
                          {Object.values(userMap).filter((u) => !reqIds.includes(u.user_id)).map((u) => (
                            <option key={u.user_id} value={u.user_id}>{u.name}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>
                </Row>

                {/* Auto Reviewers */}
                <Row label="Reviewer">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {revIds.map((uid) => (
                        <span key={uid} className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                          <Avatar user={userMap[uid]} size={18} showStatus={false} />
                          {userMap[uid]?.name || "Reviewer"}
                        </span>
                      ))}
                    </div>
                    <p className="text-[11px] text-slate-400">Reviewer otomatis tersinkronisasi dari daftar requestor.</p>
                  </div>
                </Row>

                <Row label="Assignee">
                  <MultiUserSelect
                    value={t.assignee_ids && t.assignee_ids.length ? t.assignee_ids : (t.assignee_id ? [t.assignee_id] : [])}
                    ids={members}
                    onChange={(ids) => {
                      const nextIds = Array.isArray(ids) ? ids : [];
                      patch({
                        assignee_ids: nextIds,
                        assignee_id: nextIds[0] || null
                      });
                    }}
                    testid="task-detail-assignee"
                  />
                </Row>
                <Row label="Priority"><PrioritySelect value={t.priority} onChange={(v) => patch({ priority: v })} testid="task-detail-priority" /></Row>
                <Row label="Deadline"><div className="flex items-center gap-2"><input type="datetime-local" disabled={ro} defaultValue={t.deadline ? fmtDate(t.deadline, "yyyy-MM-dd'T'HH:mm") : ""} key={t.deadline} onBlur={(e) => { const v = e.target.value ? new Date(e.target.value).toISOString() : null; if (v !== t.deadline) patch({ deadline: v }); }} className={inp} data-testid="task-detail-deadline" />{d && <span className={`whitespace-nowrap text-xs ${d.cls}`}>{d.state === "overdue" ? "Overdue" : d.state === "today" ? "Due today" : ""}</span>}</div></Row>
                <Row label="Start date"><input type="date" disabled={ro} defaultValue={t.start_date || ""} key={`s${t.start_date}`} onBlur={(e) => e.target.value !== (t.start_date || "") && patch({ start_date: e.target.value || null })} className={inp} /></Row>
                <Row label="IP / Brand"><LabelPicker value={t.label_ids} onChange={(v) => patch({ label_ids: v })} testid="task-detail-labels" /></Row>
                <Row label="Item"><ItemPicker value={t.item_type} onChange={(v) => patch({ item_type: v })} testid="task-detail-item" /></Row>
                <Row label="Link file/folder"><input disabled={ro} defaultValue={t.link_url || ""} key={`l${t.link_url}`} onBlur={(e) => e.target.value.trim() !== (t.link_url || "") && patch({ link_url: e.target.value.trim() })} placeholder="https://…" className={inp} data-testid="task-detail-link" /></Row>
                <Row label="Submit date"><input type="date" disabled={ro} defaultValue={t.submit_date || ""} key={`sd${t.submit_date}`} onChange={(e) => e.target.value !== (t.submit_date || "") && patch({ submit_date: e.target.value || null })} className={inp} data-testid="task-detail-submit-date" /></Row>
                <Row label="Project">
                  <Select value={t.project_id || "none"} disabled={ro} onValueChange={(val) => patch({ project_id: val === "none" ? null : val })}>
                    <SelectTrigger className="w-full bg-surface2 border-slate-200 dark:border-slate-800 rounded-xl" data-testid="task-detail-project">
                      <SelectValue placeholder="No project" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No project</SelectItem>
                      {projects.map((p) => (
                        <SelectItem key={p.id} value={p.id} data-testid={`project-option-${p.id}`}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Row>
                <Row label="Department"><input defaultValue={t.department || ""} disabled={ro} onBlur={(e) => e.target.value !== (t.department || "") && patch({ department: e.target.value })} className={inp} /></Row>
                <Row label="Card color"><ColorPicker value={t.card_color} onChange={(v) => patch({ card_color: v })} style={t.card_style} onStyle={(v) => patch({ card_style: v })} /></Row>
                {t.estimate && <Row label="Estimate"><span className="text-sm">{t.estimate}</span></Row>}
              </div>
              <Checkpoints t={t} ro={ro} patch={patch} reload={load} members={members} />
              <section>
                <div className="mb-2 flex items-center justify-between"><h4 className="text-sm font-bold">Brief</h4>{!ro && <button onClick={() => { if (editDesc) patch({ description: desc }, "Description saved"); else setDesc(t.description || ""); setEditDesc(!editDesc); }} className="flex items-center gap-1 text-xs font-semibold text-brand" data-testid="task-edit-description-btn"><Pencil size={12} />{editDesc ? "Save" : "Edit"}</button>}</div>
                {editDesc ? <RichEditor value={desc} onChange={setDesc} testid="task-detail-editor" /> : <RichView html={t.description} className="rounded-2xl bg-surface2 p-4" />}
              </section>
              {t.links?.length > 0 && <section><h4 className="mb-2 text-sm font-bold">Reference links</h4>{t.links.map((l, i) => <a key={`${l}-${i}`} href={l} target="_blank" rel="noreferrer" className="flex items-center gap-2 py-0.5 text-sm text-brand"><Link2 size={13} /><span className="truncate">{l}</span></a>)}</section>}
              <section><div className="mb-2 flex items-center justify-between"><h4 className="text-sm font-bold">Attachments ({(t.attachments || []).length})</h4>{!ro && <button onClick={pick} className="flex items-center gap-1 text-xs font-semibold text-brand" data-testid="task-detail-add-attachment"><Paperclip size={12} />Add</button>}{input}</div><AttachmentList items={t.attachments || []} onRemove={ro ? null : (a) => setAtt((x) => x.filter((y) => y.id !== a.id))} /></section>

              <div className="flex flex-wrap gap-2">
                <button onClick={() => (groups ? setGroups(null) : api.get("/conversations").then((r) => setGroups(r.data.filter((c) => c.type === "group"))))} className="btn-accent flex h-10 items-center gap-1.5 px-4 text-sm font-semibold shadow-sm" data-testid="task-share-btn"><Share2 size={15} />Kirim Preview ke Group</button>
                {t.conversation_id && <button onClick={() => navigate(`/messages/${t.conversation_id}`)} className="btn-ghost flex h-10 items-center gap-1.5 border px-4 text-sm font-semibold" data-testid="task-open-conversation"><MessageSquare size={14} />Open conversation</button>}
                {(isManager || (me?.user_id && reqIds.includes(me.user_id))) && <button onClick={() => patch({ archived: !t.archived }, t.archived ? "Restored" : "Archived")} className="btn-ghost flex h-10 items-center gap-1.5 border px-4 text-sm font-semibold" data-testid="task-archive-btn"><Archive size={14} />{t.archived ? "Unarchive" : "Archive"}</button>}
              </div>
              {groups && (
                <div className="rounded-2xl border bg-surface2/60 p-3 space-y-2">
                  <p className="text-xs font-bold text-sub">Pilih group untuk kirim card preview & approval (otomatis ubah status ke In Review):</p>
                  <div className="grid gap-1 sm:grid-cols-2">
                    {groups.map((g) => (
                      <button
                        key={g.id}
                        onClick={() => share(g.id)}
                        className="flex items-center gap-2 rounded-xl border bg-surface p-2.5 text-left text-sm font-medium hover:border-brand transition-colors"
                        data-testid={`share-to-${g.id}`}
                      >
                        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-soft-purple text-xs font-bold">#</span>
                        <span className="truncate">{g.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <section>
                <div className="mb-3 flex gap-1 border-b text-sm font-semibold">{[["comments", MessageSquare, `Comments (${(t.comments || []).length})`], ["activity", History, "Activity"]].map(([k, I, l]) => <button key={k} onClick={() => setTab(k)} className={`flex items-center gap-1.5 border-b-2 px-3 py-2 ${tab === k ? "border-[var(--c-accent)]" : "border-transparent text-sub"}`} data-testid={`task-tab-${k}`}><I size={14} />{l}</button>)}</div>
                {tab === "comments" ? <Comments t={t} reload={load} /> : (
                  <ul className="space-y-3" data-testid="task-activity">{(t.activity || []).map((a, i) => <li key={a.id || `act_${i}`} className="flex gap-2.5 text-sm"><Avatar user={userMap[a.actor_id]} size={24} showStatus={false} /><span><b>{userMap[a.actor_id]?.name}</b> <span className="text-sub">{a.action}</span>{a.changes?.from !== undefined && a.changes?.to !== undefined && typeof a.changes.to !== "object" && a.changes.to !== null && <span className="text-sub"> → <b className="text-ink">{userMap[a.changes.to]?.name || statuses.find((s) => s.key === a.changes.to)?.name || String(a.changes.to).slice(0, 40)}</b></span>}<span className="block text-[11px] text-sub">{fmtDate(a.created_at, "d MMM yyyy, HH:mm")}</span></span></li>)}</ul>
                )}
              </section>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
