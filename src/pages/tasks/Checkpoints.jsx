import { useState } from "react";
import { MessageSquare, AlertTriangle, X, Plus, CheckCircle2, RotateCcw, Flag, Layers, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { api, errMsg } from "../../lib/api";
import { useApp } from "../../context/AppContext";
import { Avatar, rel } from "../../components/common";
import { UserSelect } from "./fields";
import { playSound } from "../../lib/sound";

export function ProgressBar({ value, small }) {
  const v = value ?? 0;
  const color = v === 100 ? "bg-emerald-500" : v >= 50 ? "bg-sky-500" : "bg-amber-500";
  return (
    <span className={`block w-full overflow-hidden rounded-full bg-surface2 ${small ? "h-1.5" : "h-2.5"}`}>
      <span
        className={`block h-full rounded-full transition-all duration-500 ${color}`}
        style={{ width: `${v}%` }}
      />
    </span>
  );
}

export function CommentItem({ c, t, reload, showCheckpoint }) {
  const { userMap } = useApp();
  const cp = showCheckpoint && c.checkpoint_id && (t.checkpoints || []).find((x) => x.id === c.checkpoint_id);
  const issue = c.kind === "issue";
  const toggle = () => api.patch(`/tasks/${t.id}/comments/${c.id}`, { resolved: !c.resolved }).then(reload).catch((e) => toast.error(errMsg(e)));
  return (
    <div className="mb-3 flex gap-2.5" data-testid={`comment-${c.id}`}>
      <Avatar user={userMap[c.author_id]} size={28} showStatus={false} />
      <div className={`min-w-0 flex-1 rounded-2xl px-3 py-2 ${issue && !c.resolved ? "border border-rose-300 bg-rose-50 dark:bg-rose-500/10" : "bg-surface2"}`}>
        <p className="flex flex-wrap items-center gap-x-1.5 text-xs">
          <b>{userMap[c.author_id]?.name}</b>
          <span className="text-sub">{rel(c.created_at)}</span>
          {cp && <span className="rounded-full bg-surface px-2 py-0.5 text-[10px] font-semibold text-sub">↳ {cp.title}</span>}
          {issue && (
            <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${c.resolved ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : "bg-rose-500 text-white"}`} data-testid={`comment-issue-badge-${c.id}`}>
              <AlertTriangle size={10} />{c.resolved ? "Kendala selesai" : "Kendala"}
            </span>
          )}
        </p>
        <p className="whitespace-pre-wrap text-sm">{c.text}</p>
        {issue && (
          <button onClick={toggle} className="mt-1 flex items-center gap-1 text-xs font-semibold text-brand hover:underline" data-testid={`comment-resolve-${c.id}`}>
            {c.resolved ? <><RotateCcw size={11} />Buka lagi</> : <><CheckCircle2 size={11} />Tandai selesai</>}
          </button>
        )}
      </div>
    </div>
  );
}

function Thread({ t, cp, reload }) {
  const [text, setText] = useState("");
  const [issue, setIssue] = useState(false);
  const list = (t.comments || []).filter((c) => c.checkpoint_id === cp.id);
  const send = async () => {
    try {
      await api.post(`/tasks/${t.id}/comments`, { text, checkpoint_id: cp.id, kind: issue ? "issue" : "update" });
      setText("");
      setIssue(false);
      reload();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };
  return (
    <div className="border-t bg-surface2/40 p-3" data-testid={`checkpoint-thread-${cp.id}`}>
      {list.map((c) => <CommentItem key={c.id} c={c} t={t} reload={reload} />)}
      {!list.length && <p className="mb-2 text-xs text-sub">Belum ada laporan untuk checkpoint ini.</p>}
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={issue ? "Ceritakan kendalanya…" : "Tulis progres atau diskusi…"}
        className="min-h-[60px] w-full rounded-xl border bg-surface p-2.5 text-sm outline-none focus:ring-1 focus:ring-brand"
        data-testid={`checkpoint-comment-input-${cp.id}`}
      />
      <div className="mt-2 flex items-center justify-between gap-2">
        <button
          onClick={() => setIssue(!issue)}
          className={`flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-colors ${issue ? "border-rose-400 bg-rose-500 text-white" : "text-sub hover:text-ink"}`}
          data-testid={`checkpoint-issue-toggle-${cp.id}`}
        >
          <Flag size={12} />Laporkan kendala
        </button>
        <button
          onClick={send}
          disabled={!text.trim()}
          className="btn-accent h-8 px-4 text-xs font-semibold disabled:opacity-40"
          data-testid={`checkpoint-comment-submit-${cp.id}`}
        >
          Kirim
        </button>
      </div>
    </div>
  );
}

export default function Checkpoints({ t, ro, patch, reload, members }) {
  const { userMap, me } = useApp();
  const rawCps = t.checkpoints || [];
  const cps = rawCps.map((c, i) => {
    if (typeof c === "string") return { id: `cp_${i}`, title: c, assignee_id: null, done: false };
    return { id: c.id || `cp_${i}`, title: c.title || "", assignee_id: c.assignee_id || null, done: !!c.done, done_at: c.done_at, done_by: c.done_by };
  });

  const [title, setTitle] = useState("");
  const [pic, setPic] = useState(null);
  const [open, setOpen] = useState(null);

  const save = (list) => patch({ checkpoints: list });
  const edit = (id, ch) => save(cps.map((c) => (c.id === id ? { ...c, ...ch } : c)));

  const add = () => {
    if (!title.trim()) return;
    save([...cps, { id: `cp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`, title: title.trim(), assignee_id: pic, done: false }]);
    setTitle("");
    setPic(null);
  };

  const presets = [
    {
      label: "🎬 Video Content",
      items: ["Pembuatan Script / Naskah", "Persiapan Aset Visual", "Shooting / Recording", "Editing & Post-Production"]
    },
    {
      label: "🎨 Graphic & Design",
      items: ["Brief & Riset Konsep", "Draft Desain Awal", "Review & Revisi", "Final Export Asset"]
    },
    {
      label: "💻 Web & Tech",
      items: ["Requirement & Wireframe", "UI/UX Design", "Frontend / Backend Dev", "QA & Final Testing"]
    }
  ];

  const applyPreset = (items) => {
    const newItems = items.map((itemTitle, idx) => ({
      id: `cp_preset_${Date.now()}_${idx}`,
      title: itemTitle,
      assignee_id: null,
      done: false
    }));
    save([...cps, ...newItems]);
  };

  const doneCount = cps.filter((c) => c.done).length;

  return (
    <section className="rounded-2xl border border-slate-200 bg-surface p-4 dark:border-slate-800" data-testid="task-checkpoints">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Layers size={16} className="text-brand" />
          <h4 className="text-sm font-bold">Checkpoints</h4>
        </div>
        <div className="flex items-center gap-2" data-testid="task-progress-label">
          <span className="rounded-full bg-brand/10 px-2.5 py-0.5 text-xs font-bold text-brand">
            {t.progress ?? 0}% Selesai
          </span>
          <span className="text-xs font-semibold text-sub">
            ({doneCount}/{cps.length} Checkpoint)
          </span>
        </div>
      </div>

      <ProgressBar value={t.progress} />

      {/* Preset shortcut if empty */}
      {cps.length === 0 && !ro && (
        <div className="mt-3 rounded-xl border border-dashed border-slate-300 bg-surface2/50 p-3 dark:border-slate-700">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-sub mb-2">
            <Sparkles size={13} className="text-brand" /> Tambah preset checkpoint instan:
          </p>
          <div className="flex flex-wrap gap-1.5">
            {presets.map((p) => (
              <button
                type="button"
                key={p.label}
                onClick={() => applyPreset(p.items)}
                className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-surface px-2.5 py-1 text-xs font-semibold hover:border-brand hover:text-brand dark:border-slate-700 transition-colors"
                data-testid={`preset-detail-btn-${p.label.toLowerCase().replace(/[^a-z0-9]/g, "-")}`}
              >
                <span>{p.label}</span>
                <span className="text-[10px] text-sub font-normal">+4 checkpoint</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* List of Checkpoints */}
      <div className="mt-3 space-y-2">
        {cps.map((c, i) => {
          const cm = (t.comments || []).filter((x) => x.checkpoint_id === c.id);
          const issues = cm.filter((x) => x.kind === "issue" && !x.resolved).length;
          return (
            <div
              key={c.id}
              className={`overflow-hidden rounded-2xl border transition-all ${
                c.done
                  ? "border-emerald-200 bg-emerald-50/40 dark:border-emerald-900/50 dark:bg-emerald-950/20"
                  : issues
                  ? "border-rose-300 bg-rose-50/40 dark:border-rose-900/50 dark:bg-rose-950/20"
                  : "border-slate-200 bg-surface dark:border-slate-800"
              }`}
              data-testid={`checkpoint-${c.id}`}
            >
              <div className="flex flex-wrap items-center gap-2 p-2.5 sm:flex-nowrap">
                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full font-bold text-[10px] ${
                  c.done ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-200" : "bg-surface2 text-sub"
                }`}>
                  {i + 1}
                </span>

                <button
                  type="button"
                  disabled={ro}
                  onClick={() => {
                    const isNowDone = !c.done;
                    if (isNowDone) playSound("task_done");
                    else playSound("click");
                    edit(c.id, {
                      done: isNowDone,
                      done_at: isNowDone ? new Date().toISOString() : null,
                      done_by: isNowDone ? me?.user_id : null
                    });
                  }}
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border transition-all cursor-pointer ${
                    c.done
                      ? "border-emerald-500 bg-emerald-500 text-white shadow-xs"
                      : "border-slate-300 bg-surface hover:border-emerald-500 hover:bg-emerald-50 dark:border-slate-700 dark:hover:bg-emerald-950/30"
                  }`}
                  aria-label="Conteng selesai checkpoint"
                  data-testid={`checkpoint-done-${c.id}`}
                >
                  {c.done ? <CheckCircle2 size={16} className="stroke-[2.5]" /> : <span className="h-2 w-2 rounded-full bg-slate-300 dark:bg-slate-600" />}
                </button>

                <input
                  defaultValue={c.title}
                  key={c.title}
                  disabled={ro}
                  onBlur={(e) => e.target.value.trim() && e.target.value !== c.title && edit(c.id, { title: e.target.value })}
                  className={`min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none ${
                    c.done ? "text-slate-400 dark:text-slate-500 line-through" : "text-slate-800 dark:text-slate-100"
                  }`}
                  data-testid={`checkpoint-title-${c.id}`}
                />

                <div className="w-full sm:w-36">
                  {ro ? (
                    <span className="text-xs text-sub truncate block">{userMap[c.assignee_id]?.name || "Tanpa PIC"}</span>
                  ) : (
                    <UserSelect
                      value={c.assignee_id}
                      ids={members}
                      onChange={(v) => edit(c.id, { assignee_id: v })}
                      placeholder="PIC"
                      testid={`checkpoint-pic-${c.id}`}
                    />
                  )}
                </div>

                <button
                  onClick={() => setOpen(open === c.id ? null : c.id)}
                  className={`flex h-8 items-center gap-1 rounded-full border px-2.5 text-xs font-semibold transition-colors ${
                    open === c.id ? "bg-ink text-[var(--c-surface)]" : "text-sub hover:bg-surface2"
                  }`}
                  data-testid={`checkpoint-discuss-${c.id}`}
                >
                  <MessageSquare size={12} />
                  {cm.length}
                  {issues > 0 && (
                    <span className="flex items-center gap-0.5 text-rose-500 font-bold">
                      <AlertTriangle size={12} />
                      {issues}
                    </span>
                  )}
                </button>

                {!ro && (
                  <button
                    onClick={() => save(cps.filter((x) => x.id !== c.id))}
                    className="text-sub hover:text-rose-500 p-1 transition-colors"
                    aria-label="Hapus checkpoint"
                    data-testid={`checkpoint-remove-${c.id}`}
                  >
                    <X size={15} />
                  </button>
                )}
              </div>

              {c.done && c.done_at && (
                <p className="-mt-1 px-10 pb-2 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                  ✓ Selesai {rel(c.done_at)}{c.done_by && userMap[c.done_by] ? ` oleh ${userMap[c.done_by].name}` : ""}
                </p>
              )}

              {open === c.id && <Thread t={t} cp={c} reload={reload} />}
            </div>
          );
        })}
      </div>

      {!ro && (
        <div className="mt-3 flex flex-wrap gap-2 sm:flex-nowrap">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())}
            placeholder="Tambah checkpoint baru (mis. Script, Editing, Revisi…)"
            className="h-10 min-w-0 flex-1 rounded-xl border bg-surface2 px-3 text-xs outline-none focus:ring-1 focus:ring-brand"
            data-testid="checkpoint-new-title"
          />
          <div className="w-full sm:w-36">
            <UserSelect value={pic} ids={members} onChange={setPic} placeholder="PIC" testid="checkpoint-new-pic" />
          </div>
          <button
            onClick={add}
            disabled={!title.trim()}
            className="btn-accent flex h-10 items-center gap-1 px-4 text-xs font-semibold disabled:opacity-40 shrink-0"
            data-testid="checkpoint-add-btn"
          >
            <Plus size={14} />
            Tambah
          </button>
        </div>
      )}
    </section>
  );
}

