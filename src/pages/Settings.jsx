import { useState, useEffect } from "react";
import { Settings as Cog, Sun, Moon, Monitor, Upload, Download, RotateCcw, FileSpreadsheet, Search, Check } from "lucide-react";
import { toast } from "sonner";
import { useApp } from "../context/AppContext";
import { PageHeader } from "../components/common";
import { Switch } from "../components/ui/switch";
import ThemeEditor from "./settings/ThemeEditor";
import BackgroundEditor from "./settings/BackgroundEditor";
import { UserProfileSettings } from "./settings/UserProfileSettings";
import { Card, AdminOverview, PeopleAccess, WorkspaceBranding, DivisionsAdmin, ItemTypesAdmin, WeeklyReportCard, LabelsAdmin, StatusesAdmin, ProfileFieldsAdmin, StickersAdmin, AssistantBranding } from "./settings/AdminPanels";
import { DEFAULT_COPYWRITING, generateCopywritingCsv, parseCopywritingCsv } from "../lib/i18n";

const CATS = [["messages", "Direct & group messages"], ["mentions", "Mentions"], ["calls", "Calls & missed calls"], ["tasks", "Task assignments, reviews & completion"], ["deadlines", "Upcoming & overdue deadlines"], ["polls", "New polls"], ["groups", "Group invitations"], ["org", "Organization changes"], ["beranda", "Beranda: balasan, like & mention"]];

function Appearance() {
  const { prefs, savePrefs, isAdmin } = useApp();
  const [scope, setScope] = useState("personal");
  return (
    <div className="space-y-5">
      <Card title="Mode" testid="theme-mode-card">
        <div className="grid grid-cols-3 gap-2">{[["light", "Light", Sun], ["dark", "Dark", Moon], ["system", "System", Monitor]].map(([k, l, I]) => <button key={k} onClick={() => savePrefs({ theme_mode: k })} className={`flex h-20 flex-col items-center justify-center gap-1.5 rounded-2xl border text-sm font-semibold ${(prefs.theme_mode || "light") === k ? "border-[var(--c-accent)] bg-soft-red" : ""}`} data-testid={`theme-mode-${k}`}><I size={20} />{l}</button>)}</div>
      </Card>
      <Card title="Theme editor" testid="theme-editor-card">
        {isAdmin && <div className="mb-4 flex rounded-full border p-1 text-sm font-semibold w-fit">{[["personal", "Personal theme"], ["workspace", "Workspace theme"]].map(([k, l]) => <button key={k} onClick={() => setScope(k)} className={`rounded-full px-4 py-1.5 ${scope === k ? "bg-ink text-[var(--c-surface)]" : "text-sub"}`} data-testid={`theme-scope-${k}`}>{l}</button>)}</div>}
        <ThemeEditor key={scope} scope={scope} />
      </Card>
    </div>
  );
}

function NotificationPrefs() {
  const { prefs, savePrefs } = useApp();
  const n = prefs.notifications || {};
  return (
    <Card title="Notification preferences" testid="notification-prefs">
      <div className="divide-y">{CATS.map(([k, l]) => <label key={k} className="flex items-center justify-between py-3 text-sm">{l}<Switch checked={n[k] !== false} onCheckedChange={(v) => savePrefs({ notifications: { ...n, [k]: v } })} data-testid={`notif-pref-${k}`} /></label>)}</div>
      <p className="mt-3 text-xs text-sub">Mute individual groups from the conversation details panel.</p>
    </Card>
  );
}

function CopywritingSettings() {
  const { prefs, savePrefs, t } = useApp();
  const custom = prefs.custom_copywriting || {};
  const [searchTerm, setSearchTerm] = useState("");
  const [draft, setDraft] = useState({ ...custom });
  const [saving, setSaving] = useState(false);

  // Sync draft if prefs change
  useEffect(() => {
    setDraft({ ...(prefs.custom_copywriting || {}) });
  }, [prefs.custom_copywriting]);

  const handleDownloadCsv = () => {
    const csvContent = generateCopywritingCsv(draft);
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "circle-copywriting-template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Template CSV berhasil diunduh!");
  };

  const handleUploadCsv = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = parseCopywritingCsv(text);
      const keysCount = Object.keys(parsed).length;
      if (keysCount === 0) {
        return toast.error("File CSV kosong atau format tidak sesuai.");
      }
      const updated = { ...draft, ...parsed };
      setDraft(updated);
      await savePrefs({ custom_copywriting: updated });
      toast.success(`Berhasil mengimpor ${keysCount} copywriting dari CSV! 🎉`);
    } catch (err) {
      toast.error("Gagal membaca file CSV. Pastikan format kolom: Key, Default_Text, Custom_Text");
    } finally {
      e.target.value = "";
    }
  };

  const handleSaveDraft = async () => {
    setSaving(true);
    try {
      await savePrefs({ custom_copywriting: draft });
      toast.success("Copywriting berhasil disimpan!");
    } catch (err) {
      toast.error("Gagal menyimpan copywriting");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!window.confirm("Kembalikan semua copywriting ke teks default aplikasi?")) return;
    try {
      setDraft({});
      await savePrefs({ custom_copywriting: {} });
      toast.success("Copywriting dikembalikan ke default!");
    } catch (err) {
      toast.error("Gagal mereset copywriting");
    }
  };

  const allKeys = Object.keys(DEFAULT_COPYWRITING);
  const filteredKeys = allKeys.filter(
    (k) =>
      k.toLowerCase().includes(searchTerm.toLowerCase()) ||
      DEFAULT_COPYWRITING[k].toLowerCase().includes(searchTerm.toLowerCase()) ||
      (draft[k] || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  const customCount = Object.keys(draft).filter((k) => draft[k]?.trim()).length;

  return (
    <Card title="Custom Copywriting & Teks Aplikasi (CSV Import)" testid="copywriting-card">
      <p className="text-xs text-sub mb-4">
        Sesuaikan semua label, tombol, salam, dan teks copywriting di seluruh aplikasi CIRCLE. Anda dapat mengedit langsung atau mengunggah file CSV.
      </p>

      {/* Action Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-surface2/60 border mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex items-center gap-1.5 cursor-pointer rounded-xl bg-brand px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:opacity-90 transition-opacity">
            <Upload size={14} /> Import CSV
            <input type="file" accept=".csv,text/csv" hidden onChange={handleUploadCsv} data-testid="upload-copywriting-csv" />
          </label>
          <button
            type="button"
            onClick={handleDownloadCsv}
            className="inline-flex items-center gap-1.5 rounded-xl border bg-surface px-3 py-2 text-xs font-semibold text-ink hover:bg-surface2 transition-colors shadow-xs"
            data-testid="download-copywriting-template"
          >
            <Download size={14} /> Download Template CSV
          </button>
        </div>

        <div className="flex items-center gap-2">
          {customCount > 0 && (
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-1 text-xs text-rose-500 hover:underline px-2 py-1"
            >
              <RotateCcw size={12} /> Reset ({customCount} Kustom)
            </button>
          )}
          <button
            type="button"
            disabled={saving}
            onClick={handleSaveDraft}
            className="inline-flex items-center gap-1.5 rounded-xl bg-ink text-[var(--c-surface)] px-4 py-2 text-xs font-bold shadow-sm hover:opacity-90 transition-opacity"
            data-testid="save-copywriting-btn"
          >
            <Check size={14} /> {saving ? "Menyimpan..." : "Simpan Copywriting"}
          </button>
        </div>
      </div>

      {/* Search Filter */}
      <div className="relative mb-3">
        <Search size={14} className="absolute left-3 top-3 text-sub" />
        <input
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Cari kata kunci atau copywriting (contoh: Home, Schedule, Task)..."
          className="h-9 w-full rounded-xl border bg-surface2 pl-9 pr-3 text-xs outline-none focus:ring-2 focus:ring-brand"
        />
      </div>

      {/* Keys Table / Editor */}
      <div className="max-h-96 overflow-y-auto rounded-2xl border divide-y bg-surface text-xs">
        {filteredKeys.length === 0 ? (
          <div className="p-6 text-center text-sub">Tidak ditemukan kata kunci yang cocok</div>
        ) : (
          filteredKeys.map((key) => {
            const defVal = DEFAULT_COPYWRITING[key];
            const currentVal = draft[key] || "";
            const isCustomized = !!currentVal.trim();

            return (
              <div key={key} className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-surface2/50 transition-colors">
                <div className="sm:w-1/3 min-w-0">
                  <span className="font-mono text-[10px] text-brand block truncate">{key}</span>
                  <span className="text-sub text-[11px] block mt-0.5">Default: "{defVal}"</span>
                </div>
                <div className="sm:w-2/3 flex items-center gap-2">
                  <input
                    value={currentVal}
                    onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
                    placeholder={defVal}
                    className={`h-8 w-full rounded-lg border px-2.5 text-xs outline-none transition-colors ${
                      isCustomized ? "border-brand bg-brand/5 text-ink font-semibold" : "bg-surface2 text-sub"
                    }`}
                  />
                  {isCustomized && (
                    <button
                      type="button"
                      title="Kembali ke default"
                      onClick={() => {
                        const next = { ...draft };
                        delete next[key];
                        setDraft(next);
                      }}
                      className="text-sub hover:text-rose-500 p-1 shrink-0"
                    >
                      <RotateCcw size={12} />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
}

export default function Settings() {
  const { isAdmin, isManager } = useApp();
  const tabs = [
    ["profile", "Data Diri Lengkap"],
    ["notifications", "Notifications"],
    ["appearance", "Appearance"],
    ...(isAdmin ? [["workspace", "Workspace"], ["admin", "Admin dashboard"], ["access", "People & access"]] : []),
    ...(isManager ? [["labels", "Labels"], ["statuses", "Task statuses"]] : []),
    ["copywriting", "Custom Copywriting (CSV)"],
    ["background", "Dashboard background"],
    ...(isAdmin ? [["fields", "Profile fields"], ["stickers", "Stickers"]] : [])
  ];
  const [tab, setTab] = useState("profile");
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-10 lg:py-10 animate-crossfade" data-testid="settings-page">
      <PageHeader icon={Cog} title="Settings" subtitle="Personalize CIRCLE and manage your workspace." />
      <div className="flex flex-col gap-6 lg:flex-row">
        <nav className="flex gap-1 overflow-x-auto no-scrollbar lg:w-56 lg:shrink-0 lg:flex-col">
          {tabs.map(([k, l]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`h-10 whitespace-nowrap rounded-xl px-3 text-left text-sm font-medium transition-colors ${
                tab === k ? "bg-surface shadow-sm text-ink border" : "text-sub hover:bg-surface2 hover:text-ink"
              }`}
              data-testid={`settings-tab-${k}`}
            >
              {l}
            </button>
          ))}
        </nav>
        <div className="min-w-0 flex-1 max-w-3xl">
          {tab === "profile" && <UserProfileSettings />}
          {tab === "appearance" && <Appearance />}
          {tab === "copywriting" && <CopywritingSettings />}
          {tab === "background" && <Card title="Dashboard background" testid="background-card"><BackgroundEditor /></Card>}
          {tab === "notifications" && <NotificationPrefs />}

          {tab === "labels" && <LabelsAdmin />}
          {tab === "statuses" && <StatusesAdmin />}
          {tab === "admin" && <AdminOverview />}
          {tab === "access" && <PeopleAccess />}
          {tab === "workspace" && <div className="space-y-5"><WorkspaceBranding /><AssistantBranding /><WeeklyReportCard /><DivisionsAdmin /><ItemTypesAdmin /></div>}
          {tab === "fields" && <ProfileFieldsAdmin />}
          {tab === "stickers" && <StickersAdmin />}
        </div>
      </div>
    </div>
  );
}

