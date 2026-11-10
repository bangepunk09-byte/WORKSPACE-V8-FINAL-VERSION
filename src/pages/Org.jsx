import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Network,
  ChevronRight,
  ChevronDown,
  Plus,
  Pencil,
  Trash2,
  Download,
  Upload,
  Search,
  GripVertical,
  Crown,
  ArrowUp,
  ArrowDown,
  RefreshCw,
  Users,
  Check,
  Building2,
  UserPlus
} from "lucide-react";
import { toast } from "sonner";
import { useApp } from "../context/AppContext";
import { api, errMsg, downloadFrom } from "../lib/api";
import { Avatar, PageHeader, GhostButton } from "../components/common";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";

export const INITIAL_UNITS = [
  { id: "unit_mgmt", name: "Management", division: "Management", description: "Board of Directors & Executive Leadership", level: "Executive", color: "#FF5364", head_id: "user_superadmin_saeful", parent_id: null, order: 0 },
  { id: "unit_eng", name: "Engineering", division: "Engineering", description: "Software Engineering, Architecture & DevOps", level: "Division", color: "#3B82F6", head_id: "user_admin1", parent_id: "unit_mgmt", order: 1 },
  { id: "unit_prod", name: "Product", division: "Product", description: "Product Management, Strategy & Research", level: "Division", color: "#8B5CF6", head_id: "user_superadmin_saeful", parent_id: "unit_mgmt", order: 2 },
  { id: "unit_design", name: "Design", division: "Design", description: "UI/UX Design, Brand & Creative Assets", level: "Division", color: "#EC4899", head_id: null, parent_id: "unit_mgmt", order: 3 },
  { id: "unit_mkt", name: "Marketing", division: "Marketing", description: "Brand Marketing, Campaign & Social Media Growth", level: "Division", color: "#10B981", head_id: null, parent_id: "unit_mgmt", order: 4 },
  { id: "unit_sales", name: "Sales", division: "Sales", description: "Enterprise Sales, Partnership & Business Development", level: "Division", color: "#F59E0B", head_id: null, parent_id: "unit_mgmt", order: 5 },
  { id: "unit_it", name: "IT", division: "IT", description: "IT Infrastructure, Security & Internal Support", level: "Division", color: "#06B6D4", head_id: "user_admin1", parent_id: "unit_mgmt", order: 6 },
  { id: "unit_fin", name: "Finance", division: "Finance", description: "Financial Planning, Accounting & Treasury", level: "Division", color: "#14B8A6", head_id: null, parent_id: "unit_mgmt", order: 7 },
  { id: "unit_legal", name: "Legal", division: "Legal", description: "Corporate Legal, Compliance & Contracts", level: "Division", color: "#6366F1", head_id: null, parent_id: "unit_mgmt", order: 8 },
  { id: "unit_hrga", name: "HRGA", division: "HRGA", description: "Human Resources, Talent & General Affairs", level: "Division", color: "#F97316", head_id: null, parent_id: "unit_mgmt", order: 9 },
  { id: "unit_ops", name: "Operations", division: "Operations", description: "Business Operations & Quality Assurance", level: "Division", color: "#64748B", head_id: "user_admin1", parent_id: "unit_mgmt", order: 10 }
];

const UNIT_COLORS = [
  "#FF5364",
  "#3B82F6",
  "#8B5CF6",
  "#EC4899",
  "#10B981",
  "#F59E0B",
  "#06B6D4",
  "#14B8A6",
  "#6366F1",
  "#F97316",
  "#64748B"
];

let ORG_UNITS_CACHE = INITIAL_UNITS;
try {
  const saved = localStorage.getItem("circle_org_units_cache");
  if (saved) {
    const parsed = JSON.parse(saved);
    if (Array.isArray(parsed) && parsed.length > 0) ORG_UNITS_CACHE = parsed;
  }
} catch {}

function UnitDialog({ state, setState, units, levels, humanUsers, divisions, onDone }) {
  const [f, setF] = useState({});
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!state) return;
    if (state.unit) {
      setF({
        ...state.unit,
        division: state.unit.division || state.unit.name || "",
        color: state.unit.color || "#FF5364"
      });
      setSelectedMembers(
        humanUsers
          .filter((u) => u.org_unit_id === state.unit.id)
          .map((u) => u.user_id)
      );
    } else {
      setF({
        name: "",
        division: "",
        description: "",
        level: state.parent_id ? (levels[1] || "Division") : (levels[0] || "Executive"),
        color: UNIT_COLORS[units.length % UNIT_COLORS.length],
        parent_id: state.parent_id || "",
        head_id: ""
      });
      setSelectedMembers([]);
    }
  }, [state, humanUsers, levels, units.length]);

  if (!state) return null;

  const toggleMember = (uid) => {
    setSelectedMembers((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]
    );
  };

  const save = async () => {
    const cleanName = String(f.name || "").trim();
    if (!cleanName) return toast.error("Nama unit / divisi wajib diisi");
    setSaving(true);
    try {
      const payload = {
        name: cleanName,
        division: String(f.division || cleanName).trim(),
        description: String(f.description || "").trim(),
        level: f.level || "Division",
        color: f.color || "#FF5364",
        head_id: f.head_id || null,
        parent_id: f.parent_id || null,
        member_ids: selectedMembers,
        sync_division: true
      };
      if (state.unit) {
        await api.patch(`/org/units/${state.unit.id}`, payload);
        toast.success(`Unit "${cleanName}" berhasil diperbarui!`);
      } else {
        await api.post("/org/units", payload);
        toast.success(`Unit "${cleanName}" berhasil ditambahkan!`);
      }
      setState(null);
      onDone();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setSaving(false);
    }
  };

  const inp = "h-10 w-full rounded-xl border bg-surface2 px-3 text-sm outline-none focus:border-brand";
  const allDivisionOptions = Array.from(
    new Set([...(divisions || []), f.division, f.name].filter(Boolean))
  );

  return (
    <Dialog open onOpenChange={() => setState(null)}>
      <DialogContent className="bg-surface rounded-3xl max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{state.unit ? "Edit Unit & Divisi Organisasi" : "Tambah Unit / Divisi Baru"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3.5 pt-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-sub">Nama Unit / Divisi *</label>
              <input
                value={f.name || ""}
                onChange={(e) =>
                  setF((prev) => ({
                    ...prev,
                    name: e.target.value,
                    division: !prev.division || prev.division === prev.name ? e.target.value : prev.division
                  }))
                }
                placeholder="Mis. Engineering, Marketing"
                className={inp}
                data-testid="unit-name-input"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-sub">Tag Divisi Terhubung</label>
              <input
                list="org-divisions-datalist"
                value={f.division || ""}
                onChange={(e) => setF({ ...f, division: e.target.value })}
                placeholder="Nama divisi (otomatis disinkronkan)"
                className={inp}
                data-testid="unit-division-input"
              />
              <datalist id="org-divisions-datalist">
                {allDivisionOptions.map((d) => (
                  <option key={d} value={d} />
                ))}
              </datalist>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-sub">Deskripsi Fokus Unit</label>
            <input
              value={f.description || ""}
              onChange={(e) => setF({ ...f, description: e.target.value })}
              placeholder="Deskripsi singkat tanggung jawab divisi / unit..."
              className={inp}
              data-testid="unit-desc-input"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-sub">Level Hierarki</label>
              <select
                value={f.level || ""}
                onChange={(e) => setF({ ...f, level: e.target.value })}
                className={inp}
                data-testid="unit-level-select"
              >
                {levels.map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-sub">Unit Induk (Parent Unit)</label>
              <select
                value={f.parent_id || ""}
                onChange={(e) => setF({ ...f, parent_id: e.target.value })}
                className={inp}
                data-testid="unit-parent-select"
              >
                <option value="">Tanpa Induk (Top Level / Root)</option>
                {units
                  .filter((u) => u.id !== state.unit?.id)
                  .map((u) => (
                    <option key={u.id} value={u.id}>{u.name} ({u.level})</option>
                  ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-sub">Kepala Unit / Pimpinan (Head)</label>
              <select
                value={f.head_id || ""}
                onChange={(e) => setF({ ...f, head_id: e.target.value })}
                className={inp}
                data-testid="unit-head-select"
              >
                <option value="">Belum ditentukan</option>
                {humanUsers.map((u) => (
                  <option key={u.user_id} value={u.user_id}>{u.name} ({u.job_title || u.department})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-sub">Warna Identitas Unit</label>
              <div className="flex items-center gap-1.5 h-10">
                {UNIT_COLORS.slice(0, 7).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setF({ ...f, color: c })}
                    className={`h-6 w-6 rounded-full border transition-transform ${
                      f.color === c ? "scale-110 ring-2 ring-ink ring-offset-1" : "opacity-80 hover:opacity-100"
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
                <input
                  type="color"
                  value={f.color || "#FF5364"}
                  onChange={(e) => setF({ ...f, color: e.target.value })}
                  className="h-7 w-7 cursor-pointer rounded-lg border bg-surface2 p-0.5"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="mb-1.5 flex items-center justify-between text-xs font-semibold text-sub">
              <span>Anggota Unit ({selectedMembers.length} dipilih)</span>
              <span className="text-[11px] font-normal">Otomatis menyelaraskan divisi anggota</span>
            </label>
            <div className="max-h-40 overflow-y-auto rounded-2xl border bg-surface2/60 p-2 space-y-1">
              {humanUsers.map((u) => {
                const checked = selectedMembers.includes(u.user_id);
                return (
                  <label
                    key={u.user_id}
                    className={`flex items-center justify-between gap-2 rounded-xl px-2.5 py-1.5 text-xs cursor-pointer transition-colors ${
                      checked ? "bg-brand/10 text-ink font-semibold" : "hover:bg-surface"
                    }`}
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleMember(u.user_id)}
                        className="accent-[var(--c-accent)]"
                      />
                      <Avatar user={u} size={22} showStatus={false} />
                      <span className="truncate">{u.name}</span>
                    </span>
                    <span className="text-[11px] text-sub truncate">{u.department || "—"}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <button
              type="button"
              onClick={() => setState(null)}
              className="btn-ghost h-10 border px-4 text-sm font-semibold"
            >
              Batal
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={save}
              className="btn-accent h-10 px-5 text-sm font-semibold disabled:opacity-50"
              data-testid="unit-save-btn"
            >
              {saving ? "Menyimpan..." : "Simpan Unit"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DeleteDialog({ unit, setUnit, units, counts, onDone }) {
  const [to, setTo] = useState("");
  const [removeDiv, setRemoveDiv] = useState(true);
  if (!unit) return null;
  const nonEmpty = counts.kids || counts.members;
  const del = async () => {
    try {
      await api.delete(`/org/units/${unit.id}`, {
        params: {
          ...(nonEmpty && to ? { reassign_to: to } : {}),
          remove_division: removeDiv
        }
      });
      toast.success(`Unit "${unit.name}" berhasil dihapus`);
      setUnit(null);
      onDone();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };
  return (
    <Dialog open onOpenChange={() => setUnit(null)}>
      <DialogContent className="bg-surface rounded-3xl max-w-md">
        <DialogHeader><DialogTitle>Hapus Unit “{unit.name}”?</DialogTitle></DialogHeader>
        {nonEmpty ? (
          <>
            <p className="text-sm text-sub">
              Unit ini memiliki {counts.kids} sub-unit dan {counts.members} anggota. Pilih unit tujuan pemindahan agar tidak ada anggota yang kehilangan unit:
            </p>
            <select
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="h-10 rounded-xl border bg-surface2 px-3 text-sm"
              data-testid="reassign-select"
            >
              <option value="">Pilih unit tujuan…</option>
              {units
                .filter((u) => u.id !== unit.id)
                .map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
            </select>
          </>
        ) : (
          <p className="text-sm text-sub">Unit ini kosong dan dapat dihapus dengan aman.</p>
        )}
        <label className="flex items-center gap-2 text-xs text-sub cursor-pointer pt-1">
          <input
            type="checkbox"
            checked={removeDiv}
            onChange={(e) => setRemoveDiv(e.target.checked)}
            className="accent-[var(--c-accent)]"
          />
          Hapus juga dari daftar divisi apabila tidak dipakai unit lain
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={() => setUnit(null)} className="btn-ghost h-10 border px-4 text-sm font-semibold">Batal</button>
          <button
            onClick={del}
            disabled={nonEmpty && !to}
            className="h-10 rounded-full bg-rose-500 px-5 text-sm font-semibold text-white disabled:opacity-40"
            data-testid="confirm-delete-unit-btn"
          >
            Hapus Unit
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Node({ unit, siblingsIndex, siblingsCount, tree, members, depth, ctx }) {
  const [open, setOpen] = useState(depth < 2);
  const { userMap } = useApp();
  const navigate = useNavigate();
  const kids = tree[unit.id] || [];
  const mem = members[unit.id] || [];
  const total = ctx.totals[unit.id] || 0;
  const head = userMap[unit.head_id];
  const hit =
    ctx.q &&
    (unit.name?.toLowerCase().includes(ctx.q) ||
      (unit.division || "").toLowerCase().includes(ctx.q) ||
      mem.some((u) => u.name.toLowerCase().includes(ctx.q)));

  useEffect(() => {
    if (ctx.q && ctx.hasHit(unit.id)) setOpen(true);
  }, [ctx.q]); // eslint-disable-line

  const drop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    const d = JSON.parse(e.dataTransfer.getData("text/plain") || "{}");
    try {
      if (d.unit && d.unit !== unit.id) {
        await api.patch(`/org/units/${d.unit}`, { parent_id: unit.id });
      } else if (d.user) {
        await api.patch(`/org/members/${d.user}`, {
          org_unit_id: unit.id,
          department: unit.division || unit.name
        });
      } else {
        return;
      }
      toast.success("Struktur berhasil diperbarui");
      ctx.reload();
    } catch (er) {
      toast.error(errMsg(er));
    }
  };

  const accentColor = unit.color || "#FF5364";

  return (
    <div className={depth ? "ml-4 sm:ml-7 border-l pl-3 sm:pl-5" : ""}>
      <div
        draggable={ctx.admin}
        onDragStart={(e) => e.dataTransfer.setData("text/plain", JSON.stringify({ unit: unit.id }))}
        onDragOver={(e) => ctx.canMove && e.preventDefault()}
        onDrop={drop}
        className={`group my-2 flex flex-wrap sm:flex-nowrap items-center gap-2.5 rounded-2xl border bg-surface p-3.5 shadow-xs transition-all hover:shadow-sm ${
          hit ? "ring-2 ring-[var(--c-accent)]" : ""
        }`}
        data-testid={`org-unit-${unit.id}`}
      >
        {ctx.admin && <GripVertical size={15} className="hidden cursor-grab text-sub sm:block" />}
        <button
          onClick={() => setOpen(!open)}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl hover:bg-surface2"
          aria-label="Expand"
          data-testid={`org-toggle-${unit.id}`}
        >
          {kids.length || mem.length ? (
            open ? <ChevronDown size={16} /> : <ChevronRight size={16} />
          ) : (
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: accentColor }} />
          )}
        </button>

        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white font-bold text-xs shadow-2xs"
          style={{ backgroundColor: accentColor }}
        >
          {(unit.name || "U").slice(0, 2).toUpperCase()}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate font-bold text-ink">{unit.name}</p>
            <span className="rounded-full bg-surface2 px-2.5 py-0.5 text-[11px] font-semibold text-sub">
              {unit.level}
            </span>
            {unit.division && unit.division !== unit.name && (
              <span className="rounded-full bg-soft-blue px-2.5 py-0.5 text-[11px] font-semibold">
                Divisi: {unit.division}
              </span>
            )}
          </div>
          <p className="text-xs text-sub truncate mt-0.5">
            {unit.description ? `${unit.description} · ` : ""}
            {total} anggota{kids.length ? ` · ${kids.length} sub-unit` : ""}
          </p>
        </div>

        {head && (
          <span className="hidden items-center gap-1.5 rounded-full bg-soft-yellow px-3 py-1 text-xs font-semibold sm:flex">
            <Crown size={12} />
            {head.name}
          </span>
        )}

        {ctx.admin && (
          <div className="flex items-center gap-1 ml-auto">
            <button
              type="button"
              disabled={siblingsIndex === 0}
              onClick={() => ctx.reorder(unit.id, "up")}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-sub hover:bg-surface2 disabled:opacity-30"
              title="Geser ke atas"
              data-testid={`org-up-${unit.id}`}
            >
              <ArrowUp size={14} />
            </button>
            <button
              type="button"
              disabled={siblingsIndex === siblingsCount - 1}
              onClick={() => ctx.reorder(unit.id, "down")}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-sub hover:bg-surface2 disabled:opacity-30"
              title="Geser ke bawah"
              data-testid={`org-down-${unit.id}`}
            >
              <ArrowDown size={14} />
            </button>
            <button
              type="button"
              onClick={() => ctx.add(unit.id)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-sub hover:bg-surface2"
              title="Tambah sub-unit di bawah unit ini"
              data-testid={`org-add-${unit.id}`}
            >
              <Plus size={15} />
            </button>
            <button
              type="button"
              onClick={() => ctx.edit(unit)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-sub hover:bg-surface2"
              title="Edit unit & anggota"
              data-testid={`org-edit-${unit.id}`}
            >
              <Pencil size={14} />
            </button>
            <button
              type="button"
              onClick={() => ctx.del(unit)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-rose-500 hover:bg-surface2"
              title="Hapus unit"
              data-testid={`org-delete-${unit.id}`}
            >
              <Trash2 size={14} />
            </button>
          </div>
        )}
      </div>

      {open && (
        <>
          {mem.length > 0 && (
            <div className="ml-4 sm:ml-7 flex flex-wrap gap-2 border-l pl-3 sm:pl-5 py-1.5">
              {mem.map((u) => (
                <button
                  key={u.user_id}
                  draggable={ctx.canMove}
                  onDragStart={(e) => {
                    e.stopPropagation();
                    e.dataTransfer.setData("text/plain", JSON.stringify({ user: u.user_id }));
                  }}
                  onClick={() => navigate(`/people/${u.user_id}`)}
                  className={`flex items-center gap-2 rounded-full border bg-surface py-1 pl-1 pr-3.5 text-left shadow-2xs hover:border-brand transition-colors ${
                    ctx.q && u.name.toLowerCase().includes(ctx.q) ? "ring-2 ring-[var(--c-accent)]" : ""
                  }`}
                  data-testid={`org-member-${u.user_id}`}
                >
                  <Avatar user={u} size={28} />
                  <span>
                    <span className="block text-xs font-bold text-ink">{u.name}</span>
                    <span className="block text-[10px] text-sub">
                      {u.job_title || u.department}
                      {userMap[u.manager_id] ? ` · ↑ ${userMap[u.manager_id].name.split(" ")[0]}` : ""}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
          {kids.map((k, idx) => (
            <Node
              key={k.id}
              unit={k}
              siblingsIndex={idx}
              siblingsCount={kids.length}
              tree={tree}
              members={members}
              depth={depth + 1}
              ctx={ctx}
            />
          ))}
        </>
      )}
    </div>
  );
}

function Table({ units, humanUsers, divisions, reload, canMove }) {
  const [drafts, setDrafts] = useState({});
  const [savingId, setSavingId] = useState(null);

  useEffect(() => {
    const initial = {};
    humanUsers.forEach((u) => {
      initial[u.user_id] = {
        job_title: u.job_title || "",
        department: u.department || "Management",
        org_unit_id: u.org_unit_id || "",
        manager_id: u.manager_id || ""
      };
    });
    setDrafts(initial);
  }, [humanUsers]);

  const setField = (uid, key, val) => {
    setDrafts((prev) => {
      const current = prev[uid] || {};
      const next = { ...current, [key]: val };
      // Automatically align unit <-> division when one is changed in the table
      if (key === "org_unit_id" && val) {
        const matchedUnit = units.find((u) => u.id === val);
        if (matchedUnit) next.department = matchedUnit.division || matchedUnit.name;
      } else if (key === "department" && val) {
        const matchedUnit = units.find(
          (u) => (u.division || u.name || "").toLowerCase() === String(val).toLowerCase()
        );
        if (matchedUnit) next.org_unit_id = matchedUnit.id;
      }
      return { ...prev, [uid]: next };
    });
  };

  const saveRow = async (uid, patchOverride) => {
    const payload = patchOverride || drafts[uid];
    if (!payload) return;
    setSavingId(uid);
    try {
      await api.patch(`/org/members/${uid}`, {
        job_title: payload.job_title,
        department: payload.department,
        org_unit_id: payload.org_unit_id || null,
        manager_id: payload.manager_id || null
      });
      toast.success("Data organisasi karyawan berhasil disimpan!");
      reload();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setSavingId(null);
    }
  };

  const allDivisions = Array.from(
    new Set([
      ...(divisions || []),
      ...units.map((u) => u.division || u.name).filter(Boolean),
      ...humanUsers.map((u) => u.department).filter(Boolean)
    ])
  );

  return (
    <div className="card overflow-x-auto" data-testid="org-management-table">
      <table className="w-full min-w-[820px] text-sm">
        <thead>
          <tr className="border-b text-left text-xs font-bold uppercase tracking-wider text-sub">
            <th className="p-3.5">Karyawan</th>
            <th className="p-3.5">Jabatan (Job Title)</th>
            <th className="p-3.5">Divisi</th>
            <th className="p-3.5">Unit Organisasi</th>
            <th className="p-3.5">Atasan Langsung (Manager)</th>
            {canMove && <th className="p-3.5 text-right">Aksi</th>}
          </tr>
        </thead>
        <tbody>
          {humanUsers.map((u) => {
            const d = drafts[u.user_id] || {
              job_title: u.job_title || "",
              department: u.department || "",
              org_unit_id: u.org_unit_id || "",
              manager_id: u.manager_id || ""
            };
            return (
              <tr key={u.user_id} className="border-b last:border-0 hover:bg-surface2/40 transition-colors">
                <td className="p-3.5">
                  <span className="flex items-center gap-2.5">
                    <Avatar user={u} size={32} showStatus={false} />
                    <span>
                      <span className="block font-bold text-ink">{u.name}</span>
                      <span className="block text-xs text-sub">{u.email}</span>
                    </span>
                  </span>
                </td>
                <td className="p-3.5">
                  {canMove ? (
                    <input
                      value={d.job_title}
                      onChange={(e) => setField(u.user_id, "job_title", e.target.value)}
                      placeholder="Jabatan..."
                      className="h-9 w-full rounded-xl border bg-surface2 px-2.5 text-xs outline-none focus:border-brand"
                    />
                  ) : (
                    u.job_title || "—"
                  )}
                </td>
                <td className="p-3.5">
                  <select
                    disabled={!canMove}
                    value={d.department || ""}
                    onChange={(e) => setField(u.user_id, "department", e.target.value)}
                    className="h-9 w-full rounded-xl border bg-surface2 px-2.5 text-xs outline-none focus:border-brand"
                    data-testid={`table-dept-${u.user_id}`}
                  >
                    {allDivisions.map((divName) => (
                      <option key={divName} value={divName}>{divName}</option>
                    ))}
                  </select>
                </td>
                <td className="p-3.5">
                  <select
                    disabled={!canMove}
                    value={d.org_unit_id || ""}
                    onChange={(e) => setField(u.user_id, "org_unit_id", e.target.value)}
                    className="h-9 w-full rounded-xl border bg-surface2 px-2.5 text-xs outline-none focus:border-brand"
                    data-testid={`table-unit-${u.user_id}`}
                  >
                    <option value="">Belum ditugaskan</option>
                    {units.map((x) => (
                      <option key={x.id} value={x.id}>{x.name} ({x.level})</option>
                    ))}
                  </select>
                </td>
                <td className="p-3.5">
                  <select
                    disabled={!canMove}
                    value={d.manager_id || ""}
                    onChange={(e) => setField(u.user_id, "manager_id", e.target.value)}
                    className="h-9 w-full rounded-xl border bg-surface2 px-2.5 text-xs outline-none focus:border-brand"
                    data-testid={`table-manager-${u.user_id}`}
                  >
                    <option value="">Tidak ada (Top Level)</option>
                    {humanUsers
                      .filter((x) => x.user_id !== u.user_id)
                      .map((x) => (
                        <option key={x.user_id} value={x.user_id}>{x.name}</option>
                      ))}
                  </select>
                </td>
                {canMove && (
                  <td className="p-3.5 text-right">
                    <button
                      type="button"
                      disabled={savingId === u.user_id}
                      onClick={() => saveRow(u.user_id)}
                      className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-brand px-3.5 text-xs font-bold text-white shadow-2xs hover:opacity-90 disabled:opacity-50 cursor-pointer"
                      data-testid={`table-save-${u.user_id}`}
                    >
                      <Check size={13} />
                      {savingId === u.user_id ? "Menyimpan..." : "Simpan"}
                    </button>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function Org() {
  const { users, ws, isAdmin, isManager, reloadUsers, reloadWs, subscribe } = useApp();
  const [units, setUnits] = useState(ORG_UNITS_CACHE);
  const [view, setView] = useState("chart");
  const [q, setQ] = useState("");
  const [dlg, setDlg] = useState(null);
  const [delUnit, setDelUnit] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const fileRef = useRef(null);

  const humanUsers = useMemo(
    () => (users || []).filter((u) => !u.is_bot && u.role !== "assistant" && u.user_id !== "user_circle_assistant"),
    [users]
  );

  const load = () =>
    api
      .get("/org/units")
      .then((r) => {
        if (Array.isArray(r.data)) {
          ORG_UNITS_CACHE = r.data;
          setUnits(r.data);
          try {
            localStorage.setItem("circle_org_units_cache", JSON.stringify(r.data));
          } catch {}
        }
      })
      .catch(() => {});

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    return subscribe((evt) => {
      if (evt.type === "org:changed" || evt.type === "workspace:changed" || evt.type === "users:changed") {
        load();
      }
    });
  }, [subscribe]);

  const reload = () => {
    load();
    reloadUsers();
    reloadWs();
  };

  const handleSyncDivisions = async () => {
    setSyncing(true);
    try {
      const { data } = await api.post("/org/sync-divisions");
      if (Array.isArray(data?.units)) {
        ORG_UNITS_CACHE = data.units;
        setUnits(data.units);
        localStorage.setItem("circle_org_units_cache", JSON.stringify(data.units));
      }
      reloadUsers();
      reloadWs();
      toast.success("Struktur organisasi & daftar divisi berhasil diselaraskan!");
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setSyncing(false);
    }
  };

  const handleReorder = async (unitId, direction) => {
    try {
      const { data } = await api.post("/org/units/reorder", { unit_id: unitId, direction });
      if (Array.isArray(data)) {
        ORG_UNITS_CACHE = data;
        setUnits(data);
        localStorage.setItem("circle_org_units_cache", JSON.stringify(data));
      }
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  const { tree, members, totals, roots } = useMemo(() => {
    const tr = {};
    const mem = {};
    const tot = {};
    const unitIds = new Set((units || []).map((u) => u.id));
    (units || []).forEach((u) => {
      const pid = u.parent_id && unitIds.has(u.parent_id) ? u.parent_id : "root";
      (tr[pid] = tr[pid] || []).push(u);
    });
    humanUsers.forEach((u) => {
      if (u.org_unit_id && unitIds.has(u.org_unit_id)) {
        (mem[u.org_unit_id] = mem[u.org_unit_id] || []).push(u);
      }
    });
    const count = (id) =>
      (tot[id] = (mem[id] || []).length + (tr[id] || []).reduce((a, k) => a + count(k.id), 0));
    (tr.root || []).forEach((r) => count(r.id));
    return { tree: tr, members: mem, totals: tot, roots: tr.root || [] };
  }, [units, humanUsers]);

  const ql = q.toLowerCase();
  const hasHit = (id) =>
    (members[id] || []).some((u) => u.name.toLowerCase().includes(ql)) ||
    (tree[id] || []).some((k) => k.name?.toLowerCase().includes(ql) || hasHit(k.id));

  const ctx = {
    admin: isAdmin,
    canMove: isManager,
    totals,
    q: ql,
    hasHit,
    reload,
    reorder: handleReorder,
    add: (pid) => setDlg({ parent_id: pid }),
    edit: (u) => setDlg({ unit: u }),
    del: setDelUnit
  };

  const unitIdsSet = useMemo(() => new Set((units || []).map((u) => u.id)), [units]);
  const unassigned = humanUsers.filter((u) => !u.org_unit_id || !unitIdsSet.has(u.org_unit_id));

  const quickAssignMember = async (uid, unitId) => {
    if (!unitId) return;
    const targetUnit = units.find((u) => u.id === unitId);
    try {
      await api.patch(`/org/members/${uid}`, {
        org_unit_id: unitId,
        department: targetUnit ? targetUnit.division || targetUnit.name : undefined
      });
      toast.success("Anggota berhasil ditempatkan ke unit!");
      reload();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  const importCsv = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    e.target.value = "";
    try {
      const { data } = await api.post("/org/import", fd);
      toast.success(`Berhasil mengimpor CSV: ${data.created} unit baru, ${data.updated} diperbarui`);
      reload();
    } catch (er) {
      toast.error(errMsg(er));
    }
  };

  const levels = ws?.org_levels?.length
    ? ws.org_levels
    : ["Executive", "Division", "Department", "Team"];

  return (
    <div
      className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-10 lg:py-10 animate-crossfade"
      data-testid="org-page"
    >
      <PageHeader
        icon={Network}
        title="Organization Structure"
        subtitle="Struktur organisasi yang selaras otomatis dengan seluruh divisi aktif di workspace. Tambah, edit, geser urutan, atau atur penempatan anggota."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {isAdmin && (
              <GhostButton
                onClick={handleSyncDivisions}
                disabled={syncing}
                data-testid="org-sync-divisions-btn"
              >
                <RefreshCw size={15} className={syncing ? "animate-spin" : ""} />
                Selaraskan Divisi
              </GhostButton>
            )}
            {isManager && (
              <GhostButton
                onClick={() =>
                  downloadFrom("/org/export", {}, "organization.csv").then(() =>
                    toast.success("File CSV struktur organisasi berhasil diunduh")
                  )
                }
                data-testid="org-export-btn"
              >
                <Download size={15} />
                Export CSV
              </GhostButton>
            )}
            {isAdmin && (
              <>
                <GhostButton onClick={() => fileRef.current.click()} data-testid="org-import-btn">
                  <Upload size={15} />
                  Import CSV
                </GhostButton>
                <input ref={fileRef} type="file" accept=".csv" hidden onChange={importCsv} />
                <button
                  onClick={() => setDlg({ parent_id: roots[0]?.id || "" })}
                  className="btn-accent flex h-10 items-center gap-2 px-4 text-sm font-semibold cursor-pointer"
                  data-testid="org-add-unit-btn"
                >
                  <Plus size={16} />
                  Tambah Unit / Divisi
                </button>
              </>
            )}
          </div>
        }
      />

      {/* Summary Bar */}
      <div className="mb-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-2xl border bg-surface p-3.5">
          <p className="text-xs font-semibold text-sub">Total Unit & Divisi</p>
          <p className="mt-1 text-2xl font-extrabold text-ink">{units.length}</p>
        </div>
        <div className="rounded-2xl border bg-surface p-3.5">
          <p className="text-xs font-semibold text-sub">Divisi Terdaftar</p>
          <p className="mt-1 text-2xl font-extrabold text-ink">{(ws?.divisions || []).length}</p>
        </div>
        <div className="rounded-2xl border bg-surface p-3.5">
          <p className="text-xs font-semibold text-sub">Personel Aktif</p>
          <p className="mt-1 text-2xl font-extrabold text-ink">{humanUsers.length}</p>
        </div>
        <div className="rounded-2xl border bg-surface p-3.5">
          <p className="text-xs font-semibold text-sub">Level Hierarki</p>
          <p className="mt-1 text-sm font-bold text-ink truncate">{levels.join(" → ")}</p>
        </div>
      </div>

      {/* View Switcher & Search */}
      <div className="mb-5 flex flex-wrap items-center gap-2.5">
        <div className="flex rounded-full border bg-surface p-1 text-sm font-semibold">
          {[
            ["chart", "Bagan Hierarki (Tree)"],
            ["grid", "Kartu Divisi (Grid)"],
            ["table", "Tabel Manajemen & Penempatan"]
          ].map(([v, label]) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`rounded-full px-4 py-1.5 transition-colors cursor-pointer ${
                view === v ? "bg-brand text-white shadow-xs" : "text-sub hover:text-ink"
              }`}
              data-testid={`org-view-${v}`}
            >
              {label}
            </button>
          ))}
        </div>

        {view !== "table" && (
          <div className="flex h-10 flex-1 min-w-[220px] items-center gap-2 rounded-full border bg-surface px-4">
            <Search size={15} className="text-sub" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Cari divisi, unit, atau nama personel..."
              className="flex-1 bg-transparent text-sm outline-none"
              data-testid="org-search-input"
            />
          </div>
        )}
      </div>

      {view === "chart" && (
        <>
          {roots.map((r, idx) => (
            <Node
              key={r.id}
              unit={r}
              siblingsIndex={idx}
              siblingsCount={roots.length}
              tree={tree}
              members={members}
              depth={0}
              ctx={ctx}
            />
          ))}
          {unassigned.length > 0 && (
            <div className="mt-6 rounded-2xl border border-dashed bg-surface/60 p-4">
              <p className="mb-3 flex items-center gap-2 text-sm font-bold text-ink">
                <UserPlus size={16} className="text-brand" />
                Belum Ditugaskan ke Unit ({unassigned.length})
              </p>
              <div className="flex flex-wrap gap-2.5">
                {unassigned.map((u) => (
                  <div
                    key={u.user_id}
                    draggable={isManager}
                    onDragStart={(e) =>
                      e.dataTransfer.setData("text/plain", JSON.stringify({ user: u.user_id }))
                    }
                    className="flex items-center gap-2 rounded-2xl border bg-surface px-3 py-1.5 text-xs shadow-2xs"
                  >
                    <Avatar user={u} size={26} showStatus={false} />
                    <div>
                      <span className="font-bold text-ink block">{u.name}</span>
                      <span className="text-[10px] text-sub block">{u.department || "Tanpa divisi"}</span>
                    </div>
                    {isManager && (
                      <select
                        defaultValue=""
                        onChange={(e) => quickAssignMember(u.user_id, e.target.value)}
                        className="ml-2 h-7 rounded-lg border bg-surface2 px-2 text-[11px] font-semibold outline-none"
                      >
                        <option value="" disabled>Pilih Unit...</option>
                        {units.map((unit) => (
                          <option key={unit.id} value={unit.id}>{unit.name}</option>
                        ))}
                      </select>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {view === "grid" && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {units
            .filter(
              (u) =>
                !ql ||
                u.name?.toLowerCase().includes(ql) ||
                (u.division || "").toLowerCase().includes(ql) ||
                (u.description || "").toLowerCase().includes(ql)
            )
            .map((unit) => {
              const unitMembers = members[unit.id] || [];
              const parentUnit = units.find((x) => x.id === unit.parent_id);
              const headUser = humanUsers.find((x) => x.user_id === unit.head_id);
              return (
                <div
                  key={unit.id}
                  className="card flex flex-col justify-between p-5 transition-shadow hover:shadow-md"
                  data-testid={`org-grid-card-${unit.id}`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-white font-bold text-sm shadow-xs"
                          style={{ backgroundColor: unit.color || "#FF5364" }}
                        >
                          {(unit.name || "U").slice(0, 2).toUpperCase()}
                        </span>
                        <div className="min-w-0">
                          <h4 className="font-bold text-ink truncate">{unit.name}</h4>
                          <p className="text-xs text-sub">
                            {unit.level}
                            {parentUnit ? ` · Induk: ${parentUnit.name}` : " · Root Unit"}
                          </p>
                        </div>
                      </div>
                      {isAdmin && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => setDlg({ unit })}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-sub hover:bg-surface2"
                            title="Edit unit"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => setDelUnit(unit)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-rose-500 hover:bg-surface2"
                            title="Hapus unit"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                    </div>

                    {unit.description && (
                      <p className="mt-3 text-xs text-sub leading-relaxed">{unit.description}</p>
                    )}

                    <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
                      <span className="inline-flex items-center gap-1 rounded-full bg-surface2 px-2.5 py-1 font-semibold text-ink">
                        <Building2 size={12} />
                        Divisi: {unit.division || unit.name}
                      </span>
                      {headUser && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-soft-yellow px-2.5 py-1 font-semibold">
                          <Crown size={12} />
                          {headUser.name}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t pt-3.5 text-xs">
                    <span className="flex items-center gap-1.5 font-semibold text-sub">
                      <Users size={14} />
                      {unitMembers.length} anggota langsung ({totals[unit.id] || 0} total)
                    </span>
                    {isAdmin && (
                      <button
                        onClick={() => setDlg({ unit })}
                        className="font-bold text-brand hover:underline cursor-pointer"
                      >
                        Atur Anggota →
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
        </div>
      )}

      {view === "table" && (
        <Table
          units={units}
          humanUsers={humanUsers}
          divisions={ws?.divisions || []}
          reload={reload}
          canMove={isManager}
        />
      )}

      <UnitDialog
        state={dlg}
        setState={setDlg}
        units={units}
        levels={levels}
        humanUsers={humanUsers}
        divisions={ws?.divisions || []}
        onDone={reload}
      />

      <DeleteDialog
        unit={delUnit}
        setUnit={setDelUnit}
        units={units}
        counts={{
          kids: (tree[delUnit?.id] || []).length,
          members: (members[delUnit?.id] || []).length
        }}
        onDone={reload}
      />
    </div>
  );
}
