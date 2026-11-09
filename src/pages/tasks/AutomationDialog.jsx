import { useEffect, useState } from "react";
import { Play, Trash2, Plus, Sparkles, X, Clock, Calendar, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { api, errMsg } from "../../lib/api";
import { useApp } from "../../context/AppContext";
import { playSound } from "../../lib/sound";

const DAYS = [
  { val: "monday", label: "Senin" },
  { val: "tuesday", label: "Selasa" },
  { val: "wednesday", label: "Rabu" },
  { val: "thursday", label: "Kamis" },
  { val: "friday", label: "Jumat" },
  { val: "saturday", label: "Sabtu" },
  { val: "sunday", label: "Minggu" }
];

export default function AutomationDialog({ open, onClose, onGenerated }) {
  const { labels } = useApp();
  const [automations, setAutomations] = useState([]);
  const [boards, setBoards] = useState([]);
  const [loading, setLoading] = useState(false);
  const [runningId, setRunningId] = useState(null);

  // Form states
  const [brandName, setBrandName] = useState("ASLI RI");
  const [templatePrefix, setTemplatePrefix] = useState("Regular");
  const [cardCount, setCardCount] = useState(3);
  const [dayOfWeek, setDayOfWeek] = useState("monday");
  const [time, setTime] = useState("09:00");
  const [boardId, setBoardId] = useState("");
  const [checkpointsText, setCheckpointsText] = useState("Riset & Konsep, Draft Awal, Review Requestor, Finalisasi");

  const load = async () => {
    try {
      const [resAuto, resBoards] = await Promise.all([
        api.get("/task-automations"),
        api.get("/boards")
      ]);
      setAutomations(resAuto.data || []);
      setBoards(resBoards.data || []);
      if (resBoards.data?.length && !boardId) {
        setBoardId(resBoards.data[0].id);
      }
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  useEffect(() => {
    if (open) {
      load();
    }
  }, [open]);

  if (!open) return null;

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!brandName.trim()) return toast.error("Nama brand diperlukan");
    if (cardCount < 1) return toast.error("Jumlah kartu minimal 1");

    const cps = checkpointsText
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    setLoading(true);
    try {
      await api.post("/task-automations", {
        brand: brandName.trim(),
        prefix: templatePrefix.trim() || "Regular",
        count: Number(cardCount),
        schedule_day: dayOfWeek,
        schedule_time: time,
        board_id: boardId || boards[0]?.id,
        checkpoints: cps
      });
      toast.success("Otomatisasi jadwal berhasil disimpan!");
      load();
    } catch (err) {
      toast.error(errMsg(err));
    }
    setLoading(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Hapus aturan otomatisasi ini?")) return;
    try {
      await api.delete(`/task-automations/${id}`);
      toast.success("Otomatisasi dihapus");
      load();
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  const handleRunNow = async (id) => {
    setRunningId(id);
    try {
      const res = await api.post(`/task-automations/${id}/run`);
      playSound("task_create");
      toast.success(`Berhasil membuat ${res.data?.created?.length || 0} card otomatis!`);
      onGenerated?.();
    } catch (err) {
      toast.error(errMsg(err));
    }
    setRunningId(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border border-slate-200 bg-surface p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b pb-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand/10 text-brand">
              <Sparkles size={20} />
            </span>
            <div>
              <h3 className="text-lg font-bold text-ink">Card Creation Automation</h3>
              <p className="text-xs text-sub">Buat kartu template otomatis terjadwal (mis. tiap Senin 09:00 WIB untuk ASLI RI Regular 1, 2, 3).</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-sub hover:bg-surface2"
            aria-label="Tutup"
          >
            <X size={18} />
          </button>
        </div>

        {/* Existing Automations */}
        <div className="mt-5 space-y-3">
          <h4 className="text-xs font-bold text-sub uppercase tracking-wider">Aturan Otomatisasi Tersimpan</h4>
          {automations.length === 0 ? (
            <p className="rounded-2xl border border-dashed p-4 text-center text-xs text-sub">
              Belum ada otomatisasi. Konfigurasi template di bawah untuk menjadwalkan card otomatis.
            </p>
          ) : (
            <div className="space-y-2">
              {automations.map((a) => (
                <div
                  key={a.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-surface2/40 p-4 transition-all hover:bg-surface2/70"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-brand/15 px-2.5 py-0.5 text-xs font-bold text-brand">
                        {a.brand}
                      </span>
                      <span className="font-bold text-sm text-ink truncate">
                        {a.prefix} (1..{a.count})
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-xs text-sub">
                      <span className="flex items-center gap-1">
                        <Calendar size={13} />
                        Tiap {DAYS.find((d) => d.val === a.schedule_day)?.label || a.schedule_day}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock size={13} />
                        {a.schedule_time} WIB
                      </span>
                      <span>· {a.count} Kartu</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleRunNow(a.id)}
                      disabled={runningId === a.id}
                      className="btn-accent flex h-9 items-center gap-1.5 px-3.5 text-xs font-semibold shadow-sm"
                      title="Generate kartu sekarang"
                    >
                      <Play size={12} fill="currentColor" />
                      {runningId === a.id ? "Membuat…" : "Jalankan Sekarang"}
                    </button>
                    <button
                      onClick={() => handleDelete(a.id)}
                      className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-sub hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/30"
                      aria-label="Hapus otomatisasi"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Create new automation form */}
        <form onSubmit={handleCreate} className="mt-6 rounded-2xl border bg-surface2/30 p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Plus size={16} className="text-brand" />
            <h4 className="text-sm font-bold text-ink">Tambah Otomatisasi Baru</h4>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-bold text-sub mb-1">Brand / Klien</label>
              <input
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
                placeholder="Contoh: ASLI RI"
                className="h-10 w-full rounded-xl border bg-surface px-3 text-sm font-semibold outline-none focus:border-brand"
                list="brand-suggestions"
              />
              <datalist id="brand-suggestions">
                <option value="ASLI RI" />
                {labels.map((l) => (
                  <option key={l.id} value={l.name} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="block text-xs font-bold text-sub mb-1">Prefix / Template Judul</label>
              <input
                value={templatePrefix}
                onChange={(e) => setTemplatePrefix(e.target.value)}
                placeholder="Contoh: Regular"
                className="h-10 w-full rounded-xl border bg-surface px-3 text-sm font-semibold outline-none focus:border-brand"
              />
              <span className="text-[10px] text-slate-400">Akan membuat: {templatePrefix} 1, {templatePrefix} 2, dst.</span>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-bold text-sub mb-1">Jumlah Card</label>
              <input
                type="number"
                min="1"
                max="20"
                value={cardCount}
                onChange={(e) => setCardCount(Math.max(1, parseInt(e.target.value) || 1))}
                className="h-10 w-full rounded-xl border bg-surface px-3 text-sm font-semibold outline-none focus:border-brand"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-sub mb-1">Jadwal Hari</label>
              <select
                value={dayOfWeek}
                onChange={(e) => setDayOfWeek(e.target.value)}
                className="h-10 w-full rounded-xl border bg-surface px-3 text-sm font-medium outline-none focus:border-brand"
              >
                {DAYS.map((d) => (
                  <option key={d.val} value={d.val}>{d.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-sub mb-1">Jam (WIB)</label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="h-10 w-full rounded-xl border bg-surface px-3 text-sm font-medium outline-none focus:border-brand"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-sub mb-1">Target Board</label>
            <select
              value={boardId}
              onChange={(e) => setBoardId(e.target.value)}
              className="h-10 w-full rounded-xl border bg-surface px-3 text-sm font-medium outline-none focus:border-brand"
            >
              {boards.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-sub mb-1">Checkpoint Bawaan (pisahkan koma)</label>
            <input
              value={checkpointsText}
              onChange={(e) => setCheckpointsText(e.target.value)}
              placeholder="Riset, Draft Desain, Review, Selesai"
              className="h-10 w-full rounded-xl border bg-surface px-3 text-xs outline-none focus:border-brand"
            />
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={loading}
              className="btn-accent flex h-10 items-center gap-1.5 px-5 text-sm font-bold shadow-md disabled:opacity-50"
            >
              <Plus size={15} /> Simpan Aturan Otomatisasi
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
