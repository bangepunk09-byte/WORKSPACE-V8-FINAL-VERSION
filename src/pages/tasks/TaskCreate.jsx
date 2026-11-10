import { useEffect, useState } from "react";
import { Paperclip, Link2, X, Plus, Layers } from "lucide-react";
import { toast } from "sonner";
import { api, errMsg } from "../../lib/api";
import { useApp } from "../../context/AppContext";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "../../components/ui/sheet";
import RichEditor from "../../components/RichEditor";
import { inp, UserSelect, MultiUserSelect, PrioritySelect, LabelPicker, ItemPicker, ColorPicker, AttachmentList, useUploader, ListEditor } from "./fields";
import { playSound } from "../../lib/sound";

const blank = (me, d = {}) => ({
  title: "",
  description: "",
  requestor_ids: me?.user_id ? [me.user_id] : ["user_admin1"],
  assignee_id: null,
  assignee_ids: [],
  priority: "medium",
  deadline_date: "",
  deadline_time: "",
  start_date: "",
  project_id: d?.project_id || "",
  department: me?.department || "",
  board_id: d?.board_id || "brd_1",
  label_ids: d?.label_ids || [],
  item_type: null,
  link_url: "",
  collaborator_ids: [],
  checkpoints: d?.checkpoints || [],
  checklist: [],
  subtasks: [],
  links: [],
  attachments: [],
  estimate: "",
  card_color: null,
  card_style: "accent",
  custom: {},
  status: d?.status || "todo"
});

function Row({ label, children, hint }) {
  return (
    <div className="grid items-start gap-1 sm:grid-cols-[130px_1fr] sm:gap-3">
      <div className="pt-2">
        <span className="block text-xs font-semibold text-sub">{label}</span>
        {hint && <span className="block text-[10px] text-slate-400 leading-tight">{hint}</span>}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function toDeadline(date, time) {
  if (!date) return null;
  return new Date(`${date}T${time || "17:00"}`).toISOString();
}

function CheckpointCreator({ checkpoints = [], onChange, members }) {
  const [title, setTitle] = useState("");
  const [pic, setPic] = useState(null);

  const presets = [
    {
      label: "🎬 Video Content",
      items: [
        "Pembuatan Script / Naskah",
        "Persiapan Aset Visual",
        "Shooting / Recording",
        "Editing & Post-Production"
      ]
    },
    {
      label: "🎨 Graphic & Design",
      items: [
        "Brief & Riset Konsep",
        "Draft Desain Awal",
        "Review & Revisi",
        "Final Export Asset"
      ]
    },
    {
      label: "💻 Web & Tech",
      items: [
        "Requirement & Wireframe",
        "UI/UX Design",
        "Frontend / Backend Dev",
        "QA & Final Testing"
      ]
    }
  ];

  const applyPreset = (items) => {
    const newItems = items.map((t, idx) => ({
      id: `cp_preset_${Date.now()}_${idx}`,
      title: t,
      assignee_id: null,
      done: false
    }));
    onChange([...checkpoints, ...newItems]);
  };

  const add = () => {
    if (!title.trim()) return;
    onChange([
      ...checkpoints,
      {
        id: `cp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        title: title.trim(),
        assignee_id: pic || null,
        done: false
      }
    ]);
    setTitle("");
    setPic(null);
  };

  const remove = (id) => {
    onChange(checkpoints.filter((c) => (c.id || c) !== id));
  };

  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-surface2/60 p-3.5 dark:border-slate-800" data-testid="task-create-checkpoints">
      {/* Preset template quick actions */}
      <div>
        <span className="block text-[11px] font-semibold text-sub mb-1.5">Template Instan Checkpoint (Preset Workflow):</span>
        <div className="flex flex-wrap gap-1.5">
          {presets.map((p) => (
            <button
              type="button"
              key={p.label}
              onClick={() => applyPreset(p.items)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-surface px-2.5 py-1 text-xs font-semibold hover:border-brand hover:text-brand dark:border-slate-700 transition-colors shadow-xs"
              data-testid={`preset-btn-${p.label.toLowerCase().replace(/[^a-z0-9]/g, "-")}`}
            >
              <span>{p.label}</span>
              <span className="text-[10px] text-sub font-normal">+4 checkpoint</span>
            </button>
          ))}
        </div>
      </div>

      {/* Added Checkpoints List */}
      {checkpoints.length > 0 && (
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center justify-between text-xs font-semibold text-sub">
            <span className="flex items-center gap-1 text-brand"><Layers size={13} /> Checkpoint Aktif ({checkpoints.length}):</span>
            <button
              type="button"
              onClick={() => onChange([])}
              className="text-[11px] text-rose-500 hover:underline"
            >
              Hapus Semua
            </button>
          </div>
          <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
            {checkpoints.map((c, idx) => (
              <div
                key={c.id || idx}
                className="flex items-center gap-2 rounded-xl border border-slate-200 bg-surface px-3 py-2 text-xs dark:border-slate-800 shadow-sm"
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand/10 font-bold text-brand text-[10px]">
                  {idx + 1}
                </span>
                <span className="flex-1 font-medium text-slate-800 dark:text-slate-200 truncate">
                  {c.title}
                </span>
                <div className="w-32 shrink-0">
                  <UserSelect
                    value={c.assignee_id}
                    ids={members}
                    onChange={(v) =>
                      onChange(
                        checkpoints.map((item, i) =>
                          i === idx ? { ...item, assignee_id: v } : item
                        )
                      )
                    }
                    placeholder="PIC"
                    testid={`task-create-cp-pic-${idx}`}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => remove(c.id || idx)}
                  className="text-sub hover:text-rose-500 p-0.5 transition-colors"
                  aria-label="Remove checkpoint"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Input new checkpoint */}
      <div className="flex flex-wrap gap-2 sm:flex-nowrap pt-1">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder="Tambah checkpoint, misal: Scripting, Visual, Shooting..."
          className="h-10 min-w-0 flex-1 rounded-xl border bg-surface px-3 text-xs outline-none focus:ring-1 focus:ring-brand"
          data-testid="task-create-checkpoint-input"
        />
        <div className="w-full sm:w-32">
          <UserSelect
            value={pic}
            ids={members}
            onChange={setPic}
            placeholder="PIC"
            testid="task-create-checkpoint-pic"
          />
        </div>
        <button
          type="button"
          onClick={add}
          disabled={!title.trim()}
          className="btn-accent flex h-10 items-center gap-1 px-3 text-xs font-semibold disabled:opacity-40 shrink-0"
          data-testid="task-create-checkpoint-add-btn"
        >
          <Plus size={13} />
          Tambah
        </button>
      </div>
    </div>
  );
}

export default function TaskCreate({ open, onOpenChange, preset, defaults, onCreated }) {
  const { me, ws, users, statuses } = useApp();
  const [f, setF] = useState(() => blank(me, defaults));
  const [projects, setProjects] = useState([]);
  const [boards, setBoards] = useState([]);
  const [link, setLink] = useState("");
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const setAtt = (fn) => setF((x) => ({ ...x, attachments: fn(x.attachments) }));
  const { pick, input } = useUploader(setAtt);

  const humanUsers = (users || []).filter(
    (u) => u && !u.is_bot && u.role !== "assistant" && u.user_id !== "user_circle_assistant"
  );

  useEffect(() => {
    if (open) {
      const initial = { ...blank(me, defaults), ...(preset || {}) };
      if (!initial.status) initial.status = statuses?.[0]?.key || "todo";
      setF(initial);
      setMore(false);
      api.get("/projects").then((r) => setProjects(Array.isArray(r.data) ? r.data : [])).catch(() => {});
      api.get("/boards").then((r) => {
        const list = Array.isArray(r.data) ? r.data : [];
        setBoards(list);
        setF((x) => ({ ...x, board_id: x.board_id || list[0]?.id || "brd_1" }));
      }).catch(() => {});
    }
  }, [open]); // eslint-disable-line

  const boardMemberIds = boards.find((b) => b.id === f.board_id)?.member_ids || [];
  const members = boardMemberIds.length > 0 ? boardMemberIds : humanUsers.map((u) => u.user_id);
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v?.target ? v.target.value : v }));

  const toggleRequestor = (uid) => {
    const curr = f.requestor_ids || [];
    if (curr.includes(uid)) {
      if (curr.length === 1) return toast.error("Minimal harus ada 1 requestor");
      setF((x) => ({ ...x, requestor_ids: curr.filter((id) => id !== uid) }));
    } else {
      setF((x) => ({ ...x, requestor_ids: [...curr, uid] }));
    }
  };

  const submit = async (e) => {
    e?.preventDefault();
    if (!f.title.trim()) return toast.error("Judul tugas wajib diisi");
    setBusy(true);
    try {
      const assigneeIds = Array.isArray(f.assignee_ids) && f.assignee_ids.length
        ? f.assignee_ids.filter(Boolean)
        : (f.assignee_id ? [f.assignee_id] : []);
      const primaryAssigneeId = assigneeIds[0] || null;
      const myUserId = me?.user_id || "user_admin1";
      const reqIds = f.requestor_ids && f.requestor_ids.length ? f.requestor_ids : [myUserId];

      const { deadline_date, deadline_time, ...rest } = f;
      const { data } = await api.post("/tasks", {
        ...rest,
        status: f.status || statuses?.[0]?.key || "todo",
        board_id: f.board_id || boards[0]?.id || "brd_1",
        assignee_id: primaryAssigneeId,
        assignee_ids: assigneeIds,
        requestor_ids: reqIds,
        reviewer_ids: reqIds,
        project_id: f.project_id || null,
        deadline: toDeadline(deadline_date, deadline_time),
        deadline_has_time: !!deadline_time,
        start_date: f.start_date || null,
        estimate: f.estimate || null
      });
      toast.success(`Tugas ${data.number_str || ""} berhasil dibuat!`);
      playSound("task_create");
      onOpenChange(false);
      onCreated?.(data);
    } catch (er) { toast.error(errMsg(er)); }
    setBusy(false);
  };
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto bg-surface p-0 sm:max-w-2xl" data-testid="task-create-panel">
        <form onSubmit={submit} className="flex min-h-full flex-col">
          <SheetHeader className="border-b p-5"><SheetTitle>Buat Tugas Baru</SheetTitle></SheetHeader>
          <div className="flex-1 space-y-4 p-5">
            <input autoFocus value={f.title} onChange={set("title")} placeholder="Judul tugas..." className="w-full bg-transparent text-2xl font-bold outline-none placeholder:text-sub" data-testid="task-title-input" />
            <RichEditor value={f.description} onChange={set("description")} testid="task-description-editor" />
            
            {/* Multiple Requestors with Auto Reviewers */}
            <Row label="Requestor" hint="Reviewer otomatis dari requestor">
              <div className="space-y-2">
                <div className="flex flex-wrap gap-1.5" data-testid="task-requestor-list">
                  {humanUsers.map((u) => {
                    const isSelected = (f.requestor_ids || []).includes(u.user_id);
                    return (
                      <button
                        type="button"
                        key={u.user_id}
                        onClick={() => toggleRequestor(u.user_id)}
                        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all cursor-pointer ${
                          isSelected
                            ? "border-[var(--c-accent)] bg-brand text-white shadow-sm"
                            : "border-slate-200 bg-surface hover:bg-surface2 text-slate-700 dark:text-slate-200"
                        }`}
                        data-testid={`requestor-toggle-${u.user_id}`}
                      >
                        <span>{u.name.split(" ")[0]}</span>
                        {u.user_id === me?.user_id && <span className="opacity-80 text-[10px]">(You)</span>}
                        {isSelected && <span>✓</span>}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                  ✓ Reviewer otomatis diset ke requestor yang dipilih (approval 2 orang saat review)
                </p>
              </div>
            </Row>

            <Row label="Board">
              <select
                value={f.board_id || ""}
                onChange={(e) => setF((x) => ({ ...x, board_id: e.target.value }))}
                className={inp}
                data-testid="task-board-select"
              >
                {!boards.length && <option value="brd_1">General Board</option>}
                {boards.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </Row>

            <Row label="Status">
              <select
                value={f.status || "todo"}
                onChange={set("status")}
                className={inp}
                data-testid="task-status-select"
              >
                {(statuses && statuses.length ? statuses : [{ key: "todo", name: "To Do" }]).map((s) => (
                  <option key={s.key} value={s.key}>{s.name}</option>
                ))}
              </select>
            </Row>

            <Row label="Assignee" hint="Klik nama di bawah atau pilih PIC (bisa >1 orang)">
              <MultiUserSelect
                value={f.assignee_ids || (f.assignee_id ? [f.assignee_id] : [])}
                onChange={(ids) => setF((prev) => ({ ...prev, assignee_ids: ids, assignee_id: ids[0] || null }))}
                ids={members}
                testid="task-assignee-select"
              />
            </Row>
            <Row label="Priority"><PrioritySelect value={f.priority} onChange={set("priority")} testid="task-priority-select" /></Row>
            <Row label="Deadline"><div className="flex gap-2"><input type="date" value={f.deadline_date} onChange={set("deadline_date")} className={inp} data-testid="task-deadline-input" /><input type="time" value={f.deadline_time} onChange={set("deadline_time")} className={`${inp} w-32`} data-testid="task-deadline-time-input" /></div></Row>

            {/* Checkpoints */}
            <Row label="Checkpoint" hint="Ukur progres task per checkpoint">
              <CheckpointCreator
                checkpoints={f.checkpoints}
                onChange={set("checkpoints")}
                members={members}
              />
            </Row>

            <Row label="IP / Brand"><LabelPicker value={f.label_ids} onChange={set("label_ids")} testid="task-label-picker" /></Row>
            <Row label="Item"><ItemPicker value={f.item_type} onChange={set("item_type")} testid="task-item-picker" /></Row>
            <Row label="Link file/folder"><input value={f.link_url} onChange={set("link_url")} placeholder="https://…" className={inp} data-testid="task-link-input" /></Row>
            <Row label="Attachments"><div className="space-y-2"><AttachmentList items={f.attachments} onRemove={(a) => setAtt((x) => x.filter((y) => y.id !== a.id))} /><button type="button" onClick={pick} className="flex items-center gap-1.5 text-sm font-semibold text-brand" data-testid="task-add-attachment-btn"><Paperclip size={14} />Add images or documents</button>{input}</div></Row>
            {!more ? <button type="button" onClick={() => setMore(true)} className="text-sm font-semibold text-sub hover:text-ink" data-testid="task-more-fields-btn">+ More fields (dates, project, checklist, links…)</button> : <>
              <Row label="Start date"><input type="date" value={f.start_date} onChange={set("start_date")} className={inp} data-testid="task-start-input" /></Row>
              <Row label="Project"><select value={f.project_id} onChange={set("project_id")} className={inp} data-testid="task-project-select"><option value="">No project</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Row>
              <Row label="Department"><input value={f.department} onChange={set("department")} className={inp} list="depts" data-testid="task-department-input" /><datalist id="depts">{[...new Set(humanUsers.map((u) => u.department).filter(Boolean))].map((d) => <option key={d} value={d} />)}</datalist></Row>
              <Row label="Collaborators"><div className="flex flex-wrap gap-1">{humanUsers.map((u) => { const on = f.collaborator_ids.includes(u.user_id); return <button type="button" key={u.user_id} onClick={() => set("collaborator_ids")(on ? f.collaborator_ids.filter((x) => x !== u.user_id) : [...f.collaborator_ids, u.user_id])} className={`rounded-full border px-2.5 py-1 text-xs ${on ? "border-[var(--c-accent)] bg-soft-red" : ""}`}>{u.name.split(" ")[0]}</button>; })}</div></Row>
              <Row label="Checklist"><ListEditor items={f.checklist} onChange={set("checklist")} placeholder="Add checklist item" testid="task-checklist-editor" /></Row>
              <Row label="Subtasks"><ListEditor items={f.subtasks} onChange={set("subtasks")} field="title" placeholder="Add subtask" testid="task-subtasks-editor" /></Row>
              <Row label="Reference links"><div>{f.links.map((l, i) => <div key={`${l}-${i}`} className="flex items-center gap-2 py-0.5 text-sm"><Link2 size={13} className="text-sub" /><a href={l} target="_blank" rel="noreferrer" className="flex-1 truncate text-brand">{l}</a><button type="button" onClick={() => set("links")(f.links.filter((x) => x !== l))} aria-label="Remove link"><X size={13} /></button></div>)}
                <div className="flex gap-1"><input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://…" className={inp} data-testid="task-link-input" /><button type="button" onClick={() => { if (/^https?:\/\//.test(link)) { set("links")([...f.links, link]); setLink(""); } else toast.error("Enter a valid URL"); }} className="rounded-xl border px-3 text-sm" data-testid="task-add-link-btn">Add</button></div></div></Row>
              <Row label="Estimated effort"><input value={f.estimate} onChange={set("estimate")} placeholder="e.g. 4h, 2 days" className={inp} /></Row>
              <Row label="Card color"><ColorPicker value={f.card_color} onChange={set("card_color")} style={f.card_style} onStyle={set("card_style")} /></Row>
              {(ws?.task_fields || []).map((cf) => <Row key={cf.key} label={cf.name}><input value={f.custom[cf.key] || ""} onChange={(e) => set("custom")({ ...f.custom, [cf.key]: e.target.value })} className={inp} /></Row>)}
            </>}
          </div>
          <div className="sticky bottom-0 flex items-center gap-3 border-t bg-surface px-6 py-5 pb-8 sm:px-6 sm:py-5 sm:pb-7 shadow-lg">
            <button type="button" onClick={() => onOpenChange(false)} className="btn-ghost h-11 flex-1 border font-semibold text-sm">Cancel</button>
            <button disabled={busy} className="btn-accent h-11 flex-[2] font-semibold text-sm disabled:opacity-50" data-testid="task-create-submit-btn">Create task</button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

