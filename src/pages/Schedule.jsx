import { useState, useEffect, useMemo } from "react";
import { Calendar as CalendarIcon, Clock, Video, Users, Plus, MapPin, CheckCircle2, AlertCircle, Trash2, ExternalLink, CalendarDays, ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { format, parseISO, addDays, startOfWeek, isSameDay } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { toast } from "sonner";
import { api, errMsg } from "../lib/api";
import { useApp } from "../context/AppContext";
import { Avatar, AccentButton, GhostButton, Spinner } from "../components/common";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "../components/ui/dialog";
import { playSound } from "../lib/sound";
import { listEvents, createEvent } from "../lib/calendar";

export default function Schedule() {
  const { me, users, userMap, t } = useApp();
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [createOpen, setCreateOpen] = useState(false);
  const [viewMode, setViewMode] = useState("all"); // "all", "today", "upcoming"
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [form, setForm] = useState({
    title: "",
    description: "",
    date: new Date().toISOString().slice(0, 10),
    start_time: "10:00",
    end_time: "11:00",
    location_type: "online", // "online" or "offline"
    location: "Google Meet",
    meet_link: "",
    attendee_ids: [],
    sync_gcal: true,
  });

  const loadMeetings = async () => {
    try {
      const [wsResult, gcalResult] = await Promise.allSettled([
        api.get("/meetings"),
        listEvents()
      ]);

      let workspaceMeetings = [];
      if (wsResult.status === "fulfilled" && Array.isArray(wsResult.value?.data)) {
        workspaceMeetings = wsResult.value.data;
      }

      let gcalMeetings = [];
      if (gcalResult.status === "fulfilled" && gcalResult.value?.items && Array.isArray(gcalResult.value.items)) {
        gcalMeetings = gcalResult.value.items.map((ev) => {
          const startDateStr = (ev.start?.dateTime || ev.start?.date || "").slice(0, 10);
          const startT = ev.start?.dateTime ? format(new Date(ev.start.dateTime), "HH:mm") : "09:00";
          const endT = ev.end?.dateTime ? format(new Date(ev.end.dateTime), "HH:mm") : "10:00";
          return {
            id: `gcal_${ev.id}`,
            title: ev.summary || "Google Calendar Event",
            description: ev.description || "",
            date: startDateStr || new Date().toISOString().slice(0, 10),
            start_time: startT,
            end_time: endT,
            location: ev.location || (ev.hangoutLink ? "Google Meet" : "Google Calendar"),
            meet_link: ev.hangoutLink || ev.htmlLink || "",
            attendee_ids: [],
            is_gcal: true,
            gcal_synced: true,
          };
        });
      }

      // Merge workspace meetings and Google Calendar events without duplicates
      const combined = [...workspaceMeetings];
      gcalMeetings.forEach((g) => {
        const alreadyExists = combined.some(
          (m) => m.gcal_event_id === g.id.replace("gcal_", "") || (m.title === g.title && m.date === g.date)
        );
        if (!alreadyExists) {
          combined.push(g);
        }
      });

      setMeetings(combined);
    } catch (e) {
      console.warn("Failed to load meetings:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMeetings();
  }, []);

  const openCreateDialog = (prefillDate) => {
    const d = prefillDate || new Date().toISOString().slice(0, 10);
    setForm({
      title: "",
      description: "",
      date: d,
      start_time: "10:00",
      end_time: "11:00",
      location_type: "online",
      location: "Google Meet",
      meet_link: `https://meet.google.com/asli-${Math.random().toString(36).substring(2, 6)}-${Math.random().toString(36).substring(2, 5)}`,
      attendee_ids: [me?.user_id].filter(Boolean),
      sync_gcal: true,
    });
    setCreateOpen(true);
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) {
      return toast.error("Judul meeting wajib diisi");
    }

    setSubmitting(true);
    let gcalSynced = false;
    let gcalEventId = null;
    let finalMeetLink = form.meet_link;

    if (form.sync_gcal) {
      try {
        const startIso = new Date(`${form.date}T${form.start_time}:00`).toISOString();
        const endIso = new Date(`${form.date}T${form.end_time}:00`).toISOString();
        const attendeesList = (form.attendee_ids || [])
          .map((uid) => userMap[uid]?.email)
          .filter(Boolean)
          .map((email) => ({ email }));

        const gcalRes = await createEvent({
          summary: form.title,
          description: `${form.description || ""}\n\nCIRCLE Workspace Scheduled Meeting`,
          location: form.location || "Google Meet",
          start: { dateTime: startIso, timeZone: "Asia/Jakarta" },
          end: { dateTime: endIso, timeZone: "Asia/Jakarta" },
          attendees: attendeesList,
        });

        if (gcalRes && gcalRes.id) {
          gcalSynced = true;
          gcalEventId = gcalRes.id;
          if (gcalRes.hangoutLink) {
            finalMeetLink = gcalRes.hangoutLink;
          }
          toast.success("Jadwal tersinkronisasi langsung ke Google Calendar! 📅");
        }
      } catch (err) {
        console.warn("Direct Google Calendar sync note:", err);
      }
    }

    try {
      const payload = {
        title: form.title,
        description: form.description,
        date: form.date,
        start_time: form.start_time,
        end_time: form.end_time,
        location: form.location,
        meet_link: finalMeetLink,
        attendee_ids: form.attendee_ids,
        gcal_synced: gcalSynced,
        gcal_event_id: gcalEventId,
      };

      await api.post("/meetings", payload);
      playSound("meeting");
      toast.success("Jadwal meeting berhasil disimpan!");
      setCreateOpen(false);
      loadMeetings();
    } catch (err) {
      toast.error(errMsg(err, "Gagal membuat jadwal meeting"));
    } finally {
      setSubmitting(false);
    }
  };

  const deleteMeeting = async (id, title, isGcal, e) => {
    e.stopPropagation();
    if (!window.confirm(`Hapus jadwal meeting "${title}"?`)) return;
    if (isGcal) {
      setMeetings((prev) => prev.filter((m) => m.id !== id));
      toast.success("Jadwal Google Calendar dihilangkan dari tampilan");
      return;
    }
    try {
      await api.delete(`/meetings/${id}`);
      playSound("click");
      toast.success("Jadwal meeting dihapus");
      loadMeetings();
    } catch (err) {
      toast.error(errMsg(err, "Gagal menghapus meeting"));
    }
  };

  const todayStr = new Date().toISOString().slice(0, 10);

  const filteredMeetings = useMemo(() => {
    return meetings.filter((m) => {
      if (viewMode === "today") return m.date === todayStr;
      if (viewMode === "upcoming") return m.date >= todayStr;
      return true;
    });
  }, [meetings, viewMode, todayStr]);

  // Generate 7-day mini calendar strip
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-10 lg:py-10 animate-rise" data-testid="schedule-page">
      {/* Header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl text-ink">
            {t("schedule_title")}
          </h1>
          <p className="mt-1 text-sm text-sub">
            {t("schedule_subtitle")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <AccentButton onClick={() => openCreateDialog()} data-testid="new-meeting-btn">
            <Plus size={16} />
            {t("schedule_new_meeting")}
          </AccentButton>
        </div>
      </div>

      {/* Mini Calendar Strip */}
      <div className="mb-6 rounded-3xl border bg-surface p-2 shadow-sm">
        <div className="mb-3 flex items-center justify-between px-1">
          <p className="text-sm font-bold text-ink">Minggu Ini</p>
          <div className="flex rounded-xl bg-surface2 p-1 text-xs">
            <button
              onClick={() => setViewMode("all")}
              className={`rounded-lg px-3 py-1 font-semibold transition-colors ${viewMode === "all" ? "bg-surface shadow text-ink" : "text-sub hover:text-ink"}`}
            >
              Semua
            </button>
            <button
              onClick={() => setViewMode("today")}
              className={`rounded-lg px-3 py-1 font-semibold transition-colors ${viewMode === "today" ? "bg-surface shadow text-ink" : "text-sub hover:text-ink"}`}
            >
              Hari Ini
            </button>
            <button
              onClick={() => setViewMode("upcoming")}
              className={`rounded-lg px-3 py-1 font-semibold transition-colors ${viewMode === "upcoming" ? "bg-surface shadow text-ink" : "text-sub hover:text-ink"}`}
            >
              Mendatang
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-2">
          {weekDays.map((d) => {
            const dateStr = d.toISOString().slice(0, 10);
            const isToday = dateStr === todayStr;
            const isSelected = dateStr === selectedDate;
            const count = meetings.filter((m) => m.date === dateStr).length;

            return (
              <button
                key={dateStr}
                onClick={() => setSelectedDate(dateStr)}
                className={`flex flex-col items-center justify-center rounded-2xl p-2.5 transition-all ${
                  isSelected
                    ? "bg-brand text-white shadow-md"
                    : isToday
                    ? "bg-soft-blue text-blue-900 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-200"
                    : "bg-surface2 text-sub hover:text-ink hover:bg-surface2/80"
                }`}
                data-testid={`calendar-day-${dateStr}`}
              >
                <span className="text-[11px] font-semibold">{format(d, "EEE", { locale: localeId })}</span>
                <span className="mt-1 text-lg font-extrabold">{format(d, "d")}</span>
                {count > 0 && (
                  <span
                    className={`mt-1 flex h-2 w-2 rounded-full ${isSelected ? "bg-white" : "bg-brand"}`}
                    title={`${count} meeting`}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Meetings List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-ink flex items-center gap-2">
            <span>Daftar Pertemuan</span>
            <span className="rounded-full bg-surface2 px-2.5 py-0.5 text-xs text-sub font-semibold">
              {filteredMeetings.length}
            </span>
          </h2>
          <button
            onClick={() => openCreateDialog(selectedDate)}
            className="flex items-center gap-1 text-xs font-semibold text-brand hover:underline"
          >
            <Plus size={13} /> Tambah untuk {selectedDate}
          </button>
        </div>

        {filteredMeetings.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed bg-surface p-12 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface2 text-sub">
              <CalendarIcon size={28} />
            </div>
            <h3 className="mt-4 text-base font-bold">Tidak ada meeting yang dijadwalkan</h3>
            <p className="mt-1 max-w-sm text-xs text-sub">
              Jadwalkan rapat bersama tim sekarang. Langsung terintegrasi dengan Google Calendar.
            </p>
            <button
              onClick={() => openCreateDialog()}
              className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-brand px-4 py-2 text-xs font-semibold text-white shadow hover:opacity-90 transition-opacity"
            >
              <Plus size={14} /> Buat Jadwal Rapat
            </button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredMeetings.map((m) => {
              const isToday = m.date === todayStr;
              let dateFormatted = m.date;
              try {
                dateFormatted = format(parseISO(`${m.date}T${m.start_time}`), "EEEE, d MMMM yyyy", { locale: localeId });
              } catch (e) {}

              return (
                <div
                  key={m.id}
                  className="flex flex-col justify-between rounded-3xl border bg-surface p-5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden"
                  data-testid={`meeting-card-${m.id}`}
                >
                  {/* Status header */}
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                            isToday ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" : "bg-surface2 text-sub"
                          }`}
                        >
                          {isToday ? "Hari Ini" : m.date}
                        </span>
                        {m.gcal_synced && (
                          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-600 dark:bg-blue-900/30 dark:text-blue-300">
                            Google Calendar
                          </span>
                        )}
                      </div>
                      <button
                        onClick={(e) => deleteMeeting(m.id, m.title, m.is_gcal, e)}
                        className="text-sub hover:text-rose-500 transition-colors p-1"
                        aria-label="Hapus meeting"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>

                    <h3 className="mt-3 text-base font-bold text-ink line-clamp-2">{m.title}</h3>
                    {m.description && (
                      <p className="mt-1 text-xs text-sub line-clamp-2">{m.description}</p>
                    )}

                    {/* Time & Location */}
                    <div className="mt-4 space-y-1.5 text-xs text-sub">
                      <div className="flex items-center gap-2">
                        <Clock size={13} className="text-sub" />
                        <span>
                          {m.start_time} - {m.end_time} WIB ({dateFormatted})
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin size={13} className="text-sub" />
                        <span className="truncate">{m.location || "Google Meet"}</span>
                      </div>
                    </div>

                    {/* Attendees Stack */}
                    {m.attendee_ids?.length > 0 && (
                      <div className="mt-4 flex items-center gap-2">
                        <span className="text-[11px] text-sub font-semibold">Peserta:</span>
                        <div className="flex -space-x-1.5">
                          {[...m.attendee_ids.slice(0, 4)].reverse().map((uid, idx) => (
                            <Avatar key={uid} user={userMap[uid]} size={24} showStatus={false} className="border-2 border-surface rounded-full relative" style={{ zIndex: idx }} />
                          ))}
                          {m.attendee_ids.length > 4 && (
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-surface2 text-[9px] font-bold text-sub border-2 border-surface relative" style={{ zIndex: 0 }}>
                              +{m.attendee_ids.length - 4}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="mt-5 border-t pt-4 flex items-center gap-2">
                    {m.meet_link ? (
                      <a
                        href={m.meet_link}
                        target="_blank"
                        rel="noreferrer"
                        className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-brand py-2 text-xs font-semibold text-white shadow-sm hover:opacity-90 transition-opacity"
                        data-testid={`join-meet-${m.id}`}
                      >
                        <Video size={14} /> Join Google Meet
                      </a>
                    ) : (
                      <div className="flex-1 text-center py-2 text-xs font-medium text-sub">
                        Pertemuan Tatap Muka
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal Create Meeting - Refactored to Horizontal Compact Layout to save safe space */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="w-[94vw] sm:max-w-3xl max-h-[90vh] overflow-y-auto bg-surface p-5 sm:p-6 rounded-3xl">
          <DialogHeader className="pb-3 border-b">
            <DialogTitle className="text-lg font-bold">Set Jadwal Meeting Baru</DialogTitle>
            <DialogDescription className="text-xs text-sub">
              Atur agenda dan waktu rapat. Jadwal disinkronkan langsung ke Google Calendar tim.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateSubmit} className="mt-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Kolom Kiri: Detail & Platform */}
              <div className="space-y-3.5">
                <div>
                  <label className="text-xs font-semibold text-sub">Judul Meeting *</label>
                  <input
                    required
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="Contoh: Sprint Planning & Sync Progress"
                    className="mt-1 h-9 w-full rounded-xl border bg-surface2 px-3 text-xs outline-none focus:ring-2 focus:ring-brand"
                    data-testid="meeting-title-input"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-sub">Deskripsi & Agenda</label>
                  <textarea
                    rows={3}
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="Tuliskan poin pembahasan atau agenda rapat..."
                    className="mt-1 w-full rounded-xl border bg-surface2 p-2.5 text-xs outline-none focus:ring-2 focus:ring-brand resize-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-sub">Lokasi & Platform</label>
                  <div className="mt-1 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, location_type: "online", location: "Google Meet" })}
                      className={`flex items-center justify-center gap-1.5 rounded-xl border p-2 text-xs font-semibold transition-colors ${
                        form.location_type === "online" ? "border-brand bg-brand/10 text-brand" : "bg-surface2 text-sub"
                      }`}
                    >
                      <Video size={13} /> Google Meet
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, location_type: "offline", location: "Ruang Rapat Utama" })}
                      className={`flex items-center justify-center gap-1.5 rounded-xl border p-2 text-xs font-semibold transition-colors ${
                        form.location_type === "offline" ? "border-brand bg-brand/10 text-brand" : "bg-surface2 text-sub"
                      }`}
                    >
                      <MapPin size={13} /> Tatap Muka
                    </button>
                  </div>
                </div>

                {form.location_type === "online" && (
                  <div>
                    <label className="text-xs font-semibold text-sub">Link Google Meet</label>
                    <input
                      value={form.meet_link}
                      onChange={(e) => setForm({ ...form, meet_link: e.target.value })}
                      placeholder="https://meet.google.com/..."
                      className="mt-1 h-9 w-full rounded-xl border bg-surface2 px-3 text-xs outline-none font-mono"
                    />
                  </div>
                )}
              </div>

              {/* Kolom Kanan: Waktu, Peserta & Sync Google Calendar */}
              <div className="space-y-3.5">
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-xs font-semibold text-sub">Tanggal</label>
                    <input
                      type="date"
                      required
                      value={form.date}
                      onChange={(e) => setForm({ ...form, date: e.target.value })}
                      className="mt-1 h-9 w-full rounded-xl border bg-surface2 px-2 text-xs outline-none"
                      data-testid="meeting-date-input"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-sub">Mulai</label>
                    <input
                      type="time"
                      required
                      value={form.start_time}
                      onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                      className="mt-1 h-9 w-full rounded-xl border bg-surface2 px-2 text-xs outline-none"
                      data-testid="meeting-start-input"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-sub">Selesai</label>
                    <input
                      type="time"
                      required
                      value={form.end_time}
                      onChange={(e) => setForm({ ...form, end_time: e.target.value })}
                      className="mt-1 h-9 w-full rounded-xl border bg-surface2 px-2 text-xs outline-none"
                      data-testid="meeting-end-input"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-sub">Undang Anggota Tim</label>
                  <div className="mt-1 max-h-32 space-y-1 overflow-y-auto rounded-xl border bg-surface2 p-2">
                    {users.map((u) => {
                      const isChecked = form.attendee_ids.includes(u.user_id);
                      return (
                        <label key={u.user_id} className="flex items-center gap-2 p-1 text-xs hover:bg-surface rounded-lg cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              const next = isChecked
                                ? form.attendee_ids.filter((id) => id !== u.user_id)
                                : [...form.attendee_ids, u.user_id];
                              setForm({ ...form, attendee_ids: next });
                            }}
                            className="rounded accent-brand"
                          />
                          <Avatar user={u} size={20} showStatus={false} />
                          <span className="font-medium text-ink truncate">{u.name}</span>
                          <span className="text-[10px] text-sub ml-auto truncate">{u.job_title}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-2xl border bg-brand/5 p-3 dark:bg-brand/10">
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.sync_gcal}
                      onChange={(e) => setForm({ ...form, sync_gcal: e.target.checked })}
                      className="mt-0.5 h-4 w-4 rounded accent-brand"
                      data-testid="sync-gcal-checkbox"
                    />
                    <div>
                      <p className="text-xs font-bold text-ink">Sinkronkan ke Google Calendar</p>
                      <p className="text-[11px] text-sub leading-tight mt-0.5">
                        Otomatis tersimpan ke kalender Google Workspace Anda.
                      </p>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            <DialogFooter className="pt-3 border-t gap-2 sm:gap-0">
              <GhostButton type="button" onClick={() => setCreateOpen(false)}>
                Batal
              </GhostButton>
              <AccentButton type="submit" disabled={submitting} data-testid="submit-meeting-btn">
                {submitting ? "Menyimpan..." : "Simpan Jadwal"}
              </AccentButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
