import { useState } from "react";
import { Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api, errMsg } from "../../lib/api";
import { useApp } from "../../context/AppContext";
import { Avatar } from "../../components/common";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../components/ui/dialog";

const COLORS = ["#F87171", "#FB923C", "#FACC15", "#4ADE80", "#60A5FA", "#A78BFA", "#F472B6", "#2DD4BF"];

export default function BoardDialog({ board, onClose, onSaved }) {
  const { users, me, isAdmin, isManager } = useApp();
  const [f, setF] = useState({
    name: board?.name || "",
    description: board?.description || "",
    color: board?.color || COLORS[4],
    department: board?.department || (isAdmin ? "Semua Divisi" : (me.department || "Semua Divisi")),
    member_ids: board?.member_ids || [me.user_id]
  });
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const depts = [...new Set(users.map((u) => u.department).filter(Boolean))].sort();
  const toggle = (id) => setF({ ...f, member_ids: f.member_ids.includes(id) ? f.member_ids.filter((x) => x !== id) : [...f.member_ids, id] });
  const addDept = (d) => setF({ ...f, member_ids: [...new Set([...f.member_ids, ...users.filter((u) => u.department === d).map((u) => u.user_id)])] });
  const list = users.filter((u) => !u.is_bot && u.name.toLowerCase().includes(q.toLowerCase()));

  const save = async () => {
    setBusy(true);
    try {
      const { data } = board?.id ? await api.patch(`/boards/${board.id}`, f) : await api.post("/boards", f);
      toast.success("Board berhasil disimpan");
      onSaved(data);
      onClose();
    } catch (e) {
      toast.error(errMsg(e));
    }
    setBusy(false);
  };

  const del = async () => {
    if (!board?.id) return;
    setBusy(true);
    try {
      await api.delete(`/boards/${board.id}`);
      toast.success("Board berhasil dihapus");
      onSaved(null);
      onClose();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
      setConfirmDelete(false);
    }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90dvh] max-w-lg overflow-y-auto rounded-3xl bg-surface" data-testid="board-dialog">
        <DialogHeader>
          <DialogTitle>{board?.id ? "Atur & Undang Board" : "Buat Board Baru"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-sub">Nama Board *</label>
            <input
              value={f.name}
              onChange={(e) => setF({ ...f, name: e.target.value })}
              placeholder="Nama board, mis. Sprint Engineering, UI Design"
              className="h-11 w-full rounded-xl border bg-surface2 px-3 text-sm outline-none"
              data-testid="board-name-input"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-sub">Divisi Board</label>
            <select
              value={f.department}
              onChange={(e) => setF({ ...f, department: e.target.value })}
              className="h-10 w-full rounded-xl border bg-surface2 px-3 text-sm font-medium outline-none text-ink"
              data-testid="board-department-select"
            >
              <option value="Semua Divisi">Semua Divisi (Terbuka untuk Seluruh Workspace)</option>
              {depts.map((d) => (
                <option key={d} value={d}>
                  Divisi: {d} (Khusus divisi ini & karyawan yang diundang)
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-sub">
              {f.department === "Semua Divisi"
                ? "Semua karyawan di workspace dapat melihat dan membuka board ini."
                : `Karyawan divisi ${f.department} otomatis bisa mengakses board ini. Karyawan divisi lain hanya bisa mengakses jika diundang di bawah.`}
            </p>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-sub">Deskripsi (Opsional)</label>
            <input
              value={f.description}
              onChange={(e) => setF({ ...f, description: e.target.value })}
              placeholder="Tujuan atau fokus pekerjaan board ini"
              className="h-10 w-full rounded-xl border bg-surface2 px-3 text-sm outline-none"
              data-testid="board-description-input"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-sub">Warna Tema Board</label>
            <div className="flex gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setF({ ...f, color: c })}
                  className={`h-7 w-7 rounded-full transition-transform hover:scale-110 ${
                    f.color === c ? "ring-2 ring-offset-2 ring-brand" : ""
                  }`}
                  style={{ background: c }}
                  aria-label={`Warna ${c}`}
                  data-testid={`board-color-${c.slice(1)}`}
                />
              ))}
            </div>
          </div>

          <div className="pt-2 border-t">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-sm font-semibold">
                Anggota & Karyawan Diundang ({f.member_ids.length})
              </p>
              <span className="text-[11px] text-sub font-medium">Bisa undang lintas divisi</span>
            </div>

            {depts.length > 0 && (
              <div className="mb-2 flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-sub">Undang per divisi:</span>
                {depts.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => addDept(d)}
                    className="rounded-full border bg-surface2 px-2.5 py-0.5 text-xs font-medium hover:bg-surface hover:border-brand transition-colors"
                    data-testid={`board-add-dept-${d.replace(/\s/g, "-")}`}
                  >
                    + {d}
                  </button>
                ))}
              </div>
            )}

            <div className="flex h-9 items-center gap-2 rounded-xl border bg-surface2 px-3">
              <Search size={14} className="text-sub" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Cari karyawan untuk diundang ke board..."
                className="flex-1 bg-transparent text-sm outline-none"
                data-testid="board-member-search"
              />
            </div>

            <div className="mt-2 max-h-52 space-y-1 overflow-y-auto pr-1">
              {list.map((u) => {
                const isSelected = f.member_ids.includes(u.user_id);
                const isCrossDept = f.department !== "Semua Divisi" && u.department !== f.department;
                return (
                  <label
                    key={u.user_id}
                    className={`flex cursor-pointer items-center gap-2.5 rounded-xl p-2 transition-colors ${
                      isSelected ? "bg-brand/5 border border-brand/20" : "hover:bg-surface2"
                    }`}
                    data-testid={`board-member-${u.user_id}`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggle(u.user_id)}
                      className="h-4 w-4 accent-brand rounded"
                    />
                    <Avatar user={u} size={28} showStatus={false} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-semibold text-ink">{u.name}</span>
                      <span className="block truncate text-[11px] text-sub">{u.job_title}</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="rounded-md bg-surface2 px-1.5 py-0.5 text-[10px] font-bold text-sub">
                        {u.department}
                      </span>
                      {isCrossDept && isSelected && (
                        <span className="rounded-md bg-brand/10 text-brand px-1.5 py-0.5 text-[10px] font-bold">
                          Diundang
                        </span>
                      )}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 pt-4 border-t">
          {board?.id ? (
            confirmDelete ? (
              <div className="flex items-center gap-1.5 bg-rose-50 dark:bg-rose-950/30 p-1 rounded-xl">
                <span className="text-xs text-rose-600 font-bold px-1">Yakin hapus?</span>
                <button
                  type="button"
                  onClick={del}
                  disabled={busy}
                  className="rounded-full bg-rose-500 px-3 py-1 text-xs font-semibold text-white hover:bg-rose-600 disabled:opacity-50"
                  data-testid="board-delete-confirm"
                >
                  Ya
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="rounded-full border bg-surface px-3 py-1 text-xs font-semibold hover:bg-surface2"
                >
                  Batal
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                disabled={busy}
                className="btn-ghost flex h-11 items-center gap-1.5 rounded-full border px-4 text-xs font-semibold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 disabled:opacity-50"
                data-testid="board-delete-btn"
              >
                <Trash2 size={14} /> Hapus
              </button>
            )
          ) : <div />}
          <button
            type="button"
            onClick={save}
            disabled={busy || !f.name.trim()}
            className="btn-accent h-11 flex-1 rounded-full font-semibold text-sm disabled:opacity-50"
            data-testid="board-save-btn"
          >
            {busy ? "Menyimpan..." : "Simpan & Terapkan Anggota"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
