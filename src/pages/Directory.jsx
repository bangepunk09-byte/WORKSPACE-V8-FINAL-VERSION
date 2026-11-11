import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users,
  Search,
  MessageCircle,
  MapPin,
  Folder,
  FolderKanban,
  FolderLock,
  FolderGit2,
  FolderHeart,
  HardDrive,
  FileSpreadsheet,
  FileCode2,
  Briefcase,
  Sparkles,
  Plus,
  ExternalLink,
  ShieldCheck,
  Lock,
  Globe,
  Building2,
  Pencil,
  Trash2,
  Pin,
  Check,
  Copy,
  RefreshCw,
  FolderPlus,
  SlidersHorizontal,
  LayoutDashboard,
  CheckCircle2,
  X
} from "lucide-react";
import { toast } from "sonner";
import { useApp } from "../context/AppContext";
import { api, errMsg } from "../lib/api";
import { Avatar, AvatarStack, PageHeader, Empty, AccentButton, GhostButton } from "../components/common";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import {
  getCachedDriveShortcuts,
  setCachedDriveShortcuts,
  hasShortcutAccess
} from "../data/initialDriveShortcuts";
import {
  parseDriveFolderInput,
  getStoredDriveToken,
  ensureDriveToken,
  listGoogleDriveFolders,
  createGoogleDriveFolder
} from "../lib/drive";

export const DRIVE_ICON_MAP = {
  Folder,
  FolderKanban,
  FolderLock,
  FolderGit2,
  FolderHeart,
  HardDrive,
  FileSpreadsheet,
  FileCode2,
  Briefcase,
  Sparkles
};

export const DRIVE_COLOR_PRESETS = [
  "#FF5364",
  "#2563EB",
  "#10B981",
  "#8B5CF6",
  "#F59E0B",
  "#EC4899",
  "#06B6D4",
  "#F97316",
  "#4F46E5",
  "#1E293B"
];

export function DriveIcon({ name, size = 20, className = "", style }) {
  const IconComp = DRIVE_ICON_MAP[name] || Folder;
  return <IconComp size={size} className={className} style={style} />;
}

export function DriveShortcutDialog({
  open,
  onOpenChange,
  initialData,
  users = [],
  divisions = [],
  me,
  onSave,
  onOpenDriveBrowser
}) {
  const isEdit = !!initialData?.id;
  const [name, setName] = useState("");
  const [driveInput, setDriveInput] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("General");
  const [customCategory, setCustomCategory] = useState("");
  const [badge, setBadge] = useState("Google Drive");
  const [color, setColor] = useState("#FF5364");
  const [icon, setIcon] = useState("Folder");
  const [cardStyle, setCardStyle] = useState("accent_top");
  const [pinned, setPinned] = useState(true);
  const [showOnDashboard, setShowOnDashboard] = useState(true);
  const [accessType, setAccessType] = useState("custom");
  const [allowedDepartments, setAllowedDepartments] = useState([]);
  const [allowedUserIds, setAllowedUserIds] = useState([]);
  const [memberSearch, setMemberSearch] = useState("");

  useEffect(() => {
    if (!open) return;
    if (initialData) {
      setName(initialData.name || "");
      setDriveInput(initialData.drive_url || initialData.drive_folder_id || "");
      setDescription(initialData.description || "");
      const cat = initialData.category || "General";
      const knownCats = ["General", "Management", "Engineering", "Design", "Product", "Operations", "Marketing", ...divisions];
      if (knownCats.includes(cat)) {
        setCategory(cat);
        setCustomCategory("");
      } else {
        setCategory("__custom__");
        setCustomCategory(cat);
      }
      setBadge(initialData.badge || "Google Drive");
      setColor(initialData.color || "#FF5364");
      setIcon(initialData.icon || "Folder");
      setCardStyle(initialData.card_style || "accent_top");
      setPinned(initialData.pinned !== false);
      setShowOnDashboard(initialData.show_on_dashboard !== false);
      setAccessType(initialData.access_type || "custom");
      setAllowedDepartments(Array.isArray(initialData.allowed_departments) ? initialData.allowed_departments : []);
      setAllowedUserIds(
        Array.isArray(initialData.allowed_user_ids) && initialData.allowed_user_ids.length > 0
          ? initialData.allowed_user_ids
          : [me?.user_id || "user_admin1"]
      );
    } else {
      setName("");
      setDriveInput("");
      setDescription("");
      setCategory(me?.department || "General");
      setCustomCategory("");
      setBadge("Google Drive");
      setColor("#FF5364");
      setIcon("Folder");
      setCardStyle("accent_top");
      setPinned(true);
      setShowOnDashboard(true);
      setAccessType("custom");
      setAllowedDepartments(me?.department ? [me.department] : []);
      setAllowedUserIds(me?.user_id ? [me.user_id] : ["user_admin1"]);
    }
    setMemberSearch("");
  }, [open, initialData, me, divisions]);

  const humanUsers = useMemo(
    () => users.filter((u) => !u.is_bot && u.role !== "assistant" && u.user_id !== "user_circle_assistant"),
    [users]
  );

  const filteredMembers = useMemo(
    () =>
      humanUsers.filter((u) =>
        `${u.name} ${u.email || ""} ${u.department || ""} ${u.job_title || ""}`
          .toLowerCase()
          .includes(memberSearch.toLowerCase())
      ),
    [humanUsers, memberSearch]
  );

  const allCategories = useMemo(
    () => [...new Set(["General", "Management", "Engineering", "Design", "Product", "Operations", "Marketing", ...divisions])],
    [divisions]
  );

  const toggleMember = (uid) => {
    setAllowedUserIds((prev) => (prev.includes(uid) ? prev.filter((x) => x !== uid) : [...prev, uid]));
  };

  const toggleDept = (dept) => {
    setAllowedDepartments((prev) => (prev.includes(dept) ? prev.filter((x) => x !== dept) : [...prev, dept]));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Nama shortcut folder wajib diisi");
      return;
    }
    const parsedDrive = parseDriveFolderInput(driveInput);
    const finalCategory = category === "__custom__" ? (customCategory.trim() || "General") : category;
    const finalUserIds =
      accessType === "all"
        ? humanUsers.map((u) => u.user_id)
        : allowedUserIds.length > 0
        ? allowedUserIds
        : me?.user_id
        ? [me.user_id]
        : [];

    onSave({
      ...(initialData || {}),
      name: name.trim(),
      drive_folder_id: parsedDrive.folderId,
      drive_url: parsedDrive.url,
      description: description.trim(),
      category: finalCategory,
      badge: badge.trim() || "Google Drive",
      color,
      icon,
      card_style: cardStyle,
      pinned,
      show_on_dashboard: showOnDashboard,
      access_type: accessType,
      allowed_departments: allowedDepartments,
      allowed_user_ids: finalUserIds
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-6">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-ink">
            {isEdit ? "Customize Shortcut Folder Google Drive" : "Tambah Shortcut Folder Google Drive"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 mt-2">
          {/* Live Card Preview */}
          <div className="rounded-2xl border bg-surface2/50 p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-sub">Live Preview Kartu Shortcut</span>
              <span className="text-[11px] font-medium text-sub">
                {accessType === "all"
                  ? "Akses: Semua Member"
                  : accessType === "department"
                  ? `Akses: Divisi (${allowedDepartments.join(", ") || "Pilih Divisi"})`
                  : `Akses: ${allowedUserIds.length} Member Terpilih`}
              </span>
            </div>
            <div
              className="relative overflow-hidden rounded-2xl border bg-surface p-4 shadow-xs transition-all"
              style={{
                borderTopWidth: cardStyle === "accent_top" ? "4px" : "1px",
                borderTopColor: cardStyle === "accent_top" ? color : undefined,
                backgroundColor: cardStyle === "soft_tint" ? `${color}0D` : undefined
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white shadow-xs"
                    style={{ backgroundColor: color }}
                  >
                    <DriveIcon name={icon} size={20} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <h4 className="truncate text-base font-bold text-ink">{name || "Nama Folder Google Drive"}</h4>
                      {badge && (
                        <span
                          className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                          style={{ backgroundColor: `${color}18`, color }}
                        >
                          {badge}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-sub">
                      {description || "Deskripsi singkat isi folder Google Drive..."}
                    </p>
                  </div>
                </div>
                <span className="rounded-full border bg-surface2 px-2.5 py-1 text-[11px] font-semibold text-sub shrink-0">
                  {category === "__custom__" ? customCategory || "Custom" : category}
                </span>
              </div>
            </div>
          </div>

          {/* Direct Google Drive Link or Picker */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-ink">Link / URL Folder Google Drive atau Folder ID *</label>
                {onOpenDriveBrowser && (
                  <button
                    type="button"
                    onClick={() => {
                      onOpenChange(false);
                      onOpenDriveBrowser();
                    }}
                    className="inline-flex items-center gap-1 text-xs font-bold text-brand hover:underline"
                  >
                    <HardDrive size={13} /> Pilih / Buat Langsung dari Google Drive
                  </button>
                )}
              </div>
              <input
                value={driveInput}
                onChange={(e) => setDriveInput(e.target.value)}
                placeholder="https://drive.google.com/drive/folders/1A2B3C... atau tempel Folder ID"
                className="h-10 w-full rounded-xl border bg-surface px-3.5 text-sm outline-none focus:border-brand"
                data-testid="shortcut-drive-url-input"
              />
              <p className="mt-1 text-[11px] text-sub">
                Mendukung URL folder Google Drive langsung, Shared Drive link, atau ID folder Google Drive.
              </p>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-bold text-ink">Nama Shortcut Folder *</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Contoh: Engineering Architecture &PRD"
                className="h-10 w-full rounded-xl border bg-surface px-3.5 text-sm outline-none focus:border-brand"
                required
                data-testid="shortcut-name-input"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-bold text-ink">Label Badge Custom</label>
              <input
                value={badge}
                onChange={(e) => setBadge(e.target.value)}
                placeholder="Contoh: Official, Tech Docs, Confidential"
                className="h-10 w-full rounded-xl border bg-surface px-3.5 text-sm outline-none focus:border-brand"
                data-testid="shortcut-badge-input"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-bold text-ink">Kategori / Divisi</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="h-10 w-full rounded-xl border bg-surface px-3 text-sm outline-none focus:border-brand"
                data-testid="shortcut-category-select"
              >
                {allCategories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
                <option value="__custom__">+ Kategori Custom Baru...</option>
              </select>
            </div>

            {category === "__custom__" ? (
              <div>
                <label className="mb-1.5 block text-xs font-bold text-ink">Nama Kategori Custom</label>
                <input
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  placeholder="Ketik kategori baru..."
                  className="h-10 w-full rounded-xl border bg-surface px-3.5 text-sm outline-none focus:border-brand"
                />
              </div>
            ) : (
              <div>
                <label className="mb-1.5 block text-xs font-bold text-ink">Gaya Tampilan Kartu</label>
                <select
                  value={cardStyle}
                  onChange={(e) => setCardStyle(e.target.value)}
                  className="h-10 w-full rounded-xl border bg-surface px-3 text-sm outline-none focus:border-brand"
                >
                  <option value="accent_top">Garis Aksen Atas (Accent Bar)</option>
                  <option value="soft_tint">Latar Berwarna Lembut (Soft Tint)</option>
                  <option value="minimal">Minimalis Bersih (Clean Card)</option>
                </select>
              </div>
            )}

            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-xs font-bold text-ink">Deskripsi Folder</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="Jelaskan isi dokumen atau panduan penggunaan folder ini..."
                className="w-full rounded-xl border bg-surface p-3 text-sm outline-none focus:border-brand"
                data-testid="shortcut-desc-input"
              />
            </div>
          </div>

          {/* Color & Icon Full Customization */}
          <div className="grid gap-4 sm:grid-cols-2 rounded-2xl border bg-surface2/40 p-4">
            <div>
              <label className="mb-2 block text-xs font-bold text-ink">Warna Tema Folder (Full Customize)</label>
              <div className="flex flex-wrap items-center gap-2">
                {DRIVE_COLOR_PRESETS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`h-7 w-7 rounded-full transition-transform ${
                      color.toLowerCase() === c.toLowerCase() ? "scale-110 ring-2 ring-offset-2 ring-ink" : "hover:scale-105"
                    }`}
                    style={{ backgroundColor: c }}
                    title={c}
                  />
                ))}
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border bg-surface px-2.5 py-1 text-xs font-semibold text-sub hover:text-ink">
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="h-4 w-4 cursor-pointer border-0 bg-transparent p-0"
                  />
                  <span>Custom</span>
                </label>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-xs font-bold text-ink">Pilih Ikon Folder</label>
              <div className="flex flex-wrap gap-1.5">
                {Object.keys(DRIVE_ICON_MAP).map((iconKey) => {
                  const active = icon === iconKey;
                  return (
                    <button
                      key={iconKey}
                      type="button"
                      onClick={() => setIcon(iconKey)}
                      className={`flex h-8 w-8 items-center justify-center rounded-xl border transition-all ${
                        active
                          ? "bg-brand text-white border-brand shadow-xs"
                          : "bg-surface text-sub hover:text-ink"
                      }`}
                      title={iconKey}
                    >
                      <DriveIcon name={iconKey} size={15} />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Visibility & Pin Options */}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex cursor-pointer items-center justify-between rounded-xl border bg-surface p-3.5 hover:bg-surface2/50">
              <div>
                <p className="text-xs font-bold text-ink">Tampilkan di Dashboard</p>
                <p className="text-[11px] text-sub">Muncul di Dashboard hanya bagi member yang punya akses</p>
              </div>
              <input
                type="checkbox"
                checked={showOnDashboard}
                onChange={(e) => setShowOnDashboard(e.target.checked)}
                className="h-4 w-4 accent-[#FF5364]"
              />
            </label>

            <label className="flex cursor-pointer items-center justify-between rounded-xl border bg-surface p-3.5 hover:bg-surface2/50">
              <div>
                <p className="text-xs font-bold text-ink">Sematkan di Urutan Teratas</p>
                <p className="text-[11px] text-sub">Prioritaskan shortcut folder ini di atas</p>
              </div>
              <input
                type="checkbox"
                checked={pinned}
                onChange={(e) => setPinned(e.target.checked)}
                className="h-4 w-4 accent-[#FF5364]"
              />
            </label>
          </div>

          {/* Access Control Configuration */}
          <div className="rounded-2xl border bg-surface p-4 space-y-4">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h4 className="text-sm font-bold text-ink flex items-center gap-1.5">
                  <ShieldCheck size={16} className="text-brand" /> Pengaturan Akses Member
                </h4>
                <p className="text-xs text-sub">
                  Hanya member yang diberikan akses di bawah ini yang dapat melihat folder ini di Dashboard mereka.
                </p>
              </div>
            </div>

            {/* 3 Mode Buttons */}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {[
                {
                  id: "custom",
                  label: "Member Terpilih",
                  desc: "Pilih siapa saja yang punya akses",
                  icon: Lock
                },
                {
                  id: "department",
                  label: "Per Divisi & Member",
                  desc: "Akses otomatis sesuai divisi",
                  icon: Building2
                },
                {
                  id: "all",
                  label: "Semua Member",
                  desc: "Seluruh anggota workspace",
                  icon: Globe
                }
              ].map((m) => {
                const Icon = m.icon;
                const active = accessType === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setAccessType(m.id)}
                    className={`flex flex-col items-start rounded-xl border p-3 text-left transition-all ${
                      active
                        ? "border-brand bg-brand/5 ring-2 ring-brand/20"
                        : "bg-surface hover:bg-surface2/60"
                    }`}
                    data-testid={`access-mode-${m.id}`}
                  >
                    <div className="flex items-center gap-2">
                      <Icon size={15} className={active ? "text-brand" : "text-sub"} />
                      <span className="text-xs font-bold text-ink">{m.label}</span>
                    </div>
                    <span className="mt-1 text-[11px] text-sub">{m.desc}</span>
                  </button>
                );
              })}
            </div>

            {accessType === "department" && (
              <div className="space-y-2 pt-1">
                <label className="block text-xs font-bold text-ink">Pilih Divisi yang Memiliki Akses:</label>
                <div className="flex flex-wrap gap-2">
                  {allCategories
                    .filter((d) => d !== "General")
                    .map((dept) => {
                      const on = allowedDepartments.includes(dept);
                      return (
                        <button
                          key={dept}
                          type="button"
                          onClick={() => toggleDept(dept)}
                          className={`h-8 rounded-full px-3.5 text-xs font-semibold transition-colors ${
                            on ? "bg-brand text-white" : "border bg-surface2 text-sub hover:text-ink"
                          }`}
                        >
                          {dept}
                        </button>
                      );
                    })}
                </div>
              </div>
            )}

            {accessType !== "all" && (
              <div className="space-y-2.5 pt-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="text-xs font-bold text-ink">
                    Pilih Member yang Memiliki Akses ({allowedUserIds.length} dipilih):
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setAllowedUserIds(humanUsers.map((u) => u.user_id))}
                      className="text-xs font-semibold text-brand hover:underline"
                    >
                      Pilih Semua
                    </button>
                    <span className="text-sub">·</span>
                    <button
                      type="button"
                      onClick={() => setAllowedUserIds(me?.user_id ? [me.user_id] : [])}
                      className="text-xs font-semibold text-sub hover:text-ink"
                    >
                      Hanya Saya
                    </button>
                  </div>
                </div>

                <div className="flex h-9 items-center gap-2 rounded-xl border bg-surface2/60 px-3">
                  <Search size={14} className="text-sub" />
                  <input
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                    placeholder="Cari nama atau divisi member..."
                    className="flex-1 bg-transparent text-xs outline-none"
                  />
                </div>

                <div className="max-h-48 overflow-y-auto divide-y rounded-xl border bg-surface">
                  {filteredMembers.map((u) => {
                    const checked = allowedUserIds.includes(u.user_id);
                    return (
                      <label
                        key={u.user_id}
                        className="flex cursor-pointer items-center justify-between px-3.5 py-2.5 hover:bg-surface2/50"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Avatar user={u} size={30} showStatus={false} />
                          <div className="min-w-0">
                            <p className="truncate text-xs font-bold text-ink">{u.name}</p>
                            <p className="truncate text-[11px] text-sub">
                              {u.job_title || "Member"} · {u.department || "General"}
                            </p>
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleMember(u.user_id)}
                          className="h-4 w-4 accent-[#FF5364]"
                        />
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <GhostButton type="button" onClick={() => onOpenChange(false)}>
              Batal
            </GhostButton>
            <AccentButton type="submit" data-testid="save-shortcut-btn">
              <Check size={15} /> {isEdit ? "Simpan Perubahan" : "Tambahkan ke Direktori"}
            </AccentButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function DriveAccessDialog({ open, onOpenChange, shortcut, users = [], divisions = [], me, onSaveAccess }) {
  const [accessType, setAccessType] = useState("custom");
  const [allowedDepartments, setAllowedDepartments] = useState([]);
  const [allowedUserIds, setAllowedUserIds] = useState([]);
  const [search, setSearch] = useState("");

  const humanUsers = useMemo(
    () => users.filter((u) => !u.is_bot && u.role !== "assistant" && u.user_id !== "user_circle_assistant"),
    [users]
  );

  useEffect(() => {
    if (!open || !shortcut) return;
    setAccessType(shortcut.access_type || "custom");
    setAllowedDepartments(Array.isArray(shortcut.allowed_departments) ? shortcut.allowed_departments : []);
    setAllowedUserIds(
      Array.isArray(shortcut.allowed_user_ids)
        ? shortcut.allowed_user_ids
        : humanUsers.map((u) => u.user_id)
    );
    setSearch("");
  }, [open, shortcut, humanUsers]);

  if (!shortcut) return null;

  const allDepts = [...new Set(["Management", "Engineering", "Design", "Product", "Operations", "Marketing", ...divisions])];

  const toggleUser = (uid) => {
    setAllowedUserIds((prev) => (prev.includes(uid) ? prev.filter((x) => x !== uid) : [...prev, uid]));
  };

  const toggleDept = (d) => {
    setAllowedDepartments((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
  };

  const filteredUsers = humanUsers.filter((u) =>
    `${u.name} ${u.department || ""} ${u.job_title || ""}`.toLowerCase().includes(search.toLowerCase())
  );

  const handleSave = () => {
    const finalUsers =
      accessType === "all"
        ? humanUsers.map((u) => u.user_id)
        : allowedUserIds;
    onSaveAccess(shortcut.id, {
      access_type: accessType,
      allowed_departments: allowedDepartments,
      allowed_user_ids: finalUsers
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-bold text-ink">
            <ShieldCheck size={19} className="text-brand" />
            <span>Atur Akses Member — {shortcut.name}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <p className="text-xs text-sub">
            Tentukan siapa saja member yang memiliki akses ke folder Google Drive ini. Hanya member yang memiliki akses yang akan melihat shortcut ini di Dashboard.
          </p>

          <div className="grid grid-cols-3 gap-2">
            {[
              { id: "custom", label: "Member Terpilih", icon: Lock },
              { id: "department", label: "Per Divisi", icon: Building2 },
              { id: "all", label: "Semua Member", icon: Globe }
            ].map((item) => {
              const Icon = item.icon;
              const active = accessType === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setAccessType(item.id)}
                  className={`flex flex-col items-center justify-center rounded-xl border p-3 text-center transition-all ${
                    active ? "bg-brand text-white border-brand shadow-xs" : "bg-surface text-sub hover:text-ink"
                  }`}
                >
                  <Icon size={16} />
                  <span className="mt-1 text-xs font-bold">{item.label}</span>
                </button>
              );
            })}
          </div>

          {accessType === "department" && (
            <div className="space-y-2">
              <label className="block text-xs font-bold text-ink">Divisi yang Diizinkan:</label>
              <div className="flex flex-wrap gap-1.5">
                {allDepts.map((d) => {
                  const on = allowedDepartments.includes(d);
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => toggleDept(d)}
                      className={`h-8 rounded-full px-3 text-xs font-semibold transition-colors ${
                        on ? "bg-brand text-white" : "border bg-surface2 text-sub hover:text-ink"
                      }`}
                    >
                      {d}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {accessType !== "all" && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-ink">
                  Daftar Member ({allowedUserIds.length} memiliki akses)
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setAllowedUserIds(humanUsers.map((u) => u.user_id))}
                    className="text-xs font-semibold text-brand hover:underline"
                  >
                    Pilih Semua
                  </button>
                  <span className="text-sub">·</span>
                  <button
                    type="button"
                    onClick={() => setAllowedUserIds(me?.user_id ? [me.user_id] : [])}
                    className="text-xs font-semibold text-sub hover:text-ink"
                  >
                    Reset
                  </button>
                </div>
              </div>

              <div className="flex h-9 items-center gap-2 rounded-xl border bg-surface2/60 px-3">
                <Search size={14} className="text-sub" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Cari member..."
                  className="flex-1 bg-transparent text-xs outline-none"
                />
              </div>

              <div className="max-h-60 overflow-y-auto divide-y rounded-xl border bg-surface">
                {filteredUsers.map((u) => {
                  const checked = allowedUserIds.includes(u.user_id);
                  return (
                    <label
                      key={u.user_id}
                      className="flex cursor-pointer items-center justify-between px-3.5 py-2.5 hover:bg-surface2/50"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Avatar user={u} size={32} showStatus={false} />
                        <div className="min-w-0">
                          <p className="truncate text-xs font-bold text-ink">{u.name}</p>
                          <p className="truncate text-[11px] text-sub">
                            {u.job_title || "Member"} · {u.department || "General"}
                          </p>
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleUser(u.user_id)}
                        className="h-4 w-4 accent-[#FF5364]"
                      />
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <GhostButton type="button" onClick={() => onOpenChange(false)}>
              Batal
            </GhostButton>
            <AccentButton type="button" onClick={handleSave} data-testid="save-member-access-btn">
              <Check size={15} /> Simpan Akses Member
            </AccentButton>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function GoogleDriveBrowserDialog({ open, onOpenChange, onSelectDriveFolder }) {
  const [driveToken, setDriveToken] = useState(() => getStoredDriveToken());
  const [folders, setFolders] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [newFolderName, setNewFolderName] = useState("");
  const [busy, setBusy] = useState(false);

  const fetchFolders = async (tokenToUse, q = "") => {
    if (!tokenToUse) return;
    setBusy(true);
    try {
      const files = await listGoogleDriveFolders(tokenToUse, q);
      setFolders(files);
    } catch (e) {
      toast.error(e.message || "Gagal memuat folder dari Google Drive");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (open && driveToken) {
      fetchFolders(driveToken, searchQuery);
    }
  }, [open, driveToken]);

  const handleConnectDrive = async () => {
    try {
      const token = await ensureDriveToken(true);
      setDriveToken(token);
      toast.success("Berhasil terhubung langsung ke Google Drive!");
      fetchFolders(token, searchQuery);
    } catch (e) {
      toast.error(e.message || "Gagal menghubungkan akun Google Drive");
    }
  };

  const handleCreateFolderOnDrive = async (e) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    try {
      const token = driveToken || (await ensureDriveToken(true));
      setDriveToken(token);
      setBusy(true);
      const created = await createGoogleDriveFolder(token, newFolderName.trim());
      toast.success(`Folder "${created.name}" berhasil dibuat di Google Drive!`);
      setNewFolderName("");
      onSelectDriveFolder({
        name: created.name,
        drive_folder_id: created.id,
        drive_url: created.webViewLink || `https://drive.google.com/drive/folders/${created.id}`
      });
      onOpenChange(false);
    } catch (err) {
      toast.error(err.message || "Gagal membuat folder di Google Drive");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-bold text-ink">
            <HardDrive size={19} className="text-brand" />
            <span>Koneksi Langsung Google Drive</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border bg-surface2/50 p-3.5">
            <div className="flex items-center gap-2.5">
              <div className={`h-2.5 w-2.5 rounded-full ${driveToken ? "bg-emerald-500" : "bg-amber-500"}`} />
              <div>
                <p className="text-xs font-bold text-ink">
                  {driveToken ? "Terhubung ke Akun Google Drive Anda" : "Hubungkan Akun Google Drive"}
                </p>
                <p className="text-[11px] text-sub">
                  Pilih folder dari Google Drive atau buat folder baru langsung dari workspace.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleConnectDrive}
              className="h-9 rounded-full bg-brand px-4 text-xs font-bold text-white shadow-xs hover:opacity-95"
            >
              {driveToken ? "Sinkronkan Ulang" : "Connect Google Drive"}
            </button>
          </div>

          {/* Buat Folder Baru di Google Drive */}
          <form onSubmit={handleCreateFolderOnDrive} className="rounded-2xl border bg-surface p-3.5 space-y-2">
            <label className="block text-xs font-bold text-ink">
              Buat Folder Baru Langsung di Google Drive & Jadikan Shortcut:
            </label>
            <div className="flex gap-2">
              <input
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Ketik nama folder baru di Google Drive..."
                className="h-9 flex-1 rounded-xl border bg-surface2/50 px-3 text-xs outline-none focus:border-brand"
              />
              <button
                type="submit"
                disabled={busy || !newFolderName.trim()}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-brand px-3.5 text-xs font-bold text-white disabled:opacity-50"
              >
                <FolderPlus size={14} /> Buat & Tambah
              </button>
            </div>
          </form>

          {/* Daftar Folder Google Drive */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-ink">Pilih Folder dari Google Drive:</span>
              <div className="flex items-center gap-1.5">
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && driveToken && fetchFolders(driveToken, searchQuery)}
                  placeholder="Cari nama folder..."
                  className="h-8 rounded-xl border bg-surface px-3 text-xs outline-none"
                />
                {driveToken && (
                  <button
                    type="button"
                    onClick={() => fetchFolders(driveToken, searchQuery)}
                    className="flex h-8 w-8 items-center justify-center rounded-xl border bg-surface text-sub hover:text-ink"
                    title="Refresh"
                  >
                    <RefreshCw size={13} />
                  </button>
                )}
              </div>
            </div>

            <div className="max-h-60 overflow-y-auto divide-y rounded-2xl border bg-surface">
              {!driveToken ? (
                <div className="p-6 text-center">
                  <HardDrive size={24} className="mx-auto text-sub mb-2 opacity-60" />
                  <p className="text-xs font-bold text-ink">Belum terhubung ke Google Drive</p>
                  <p className="text-[11px] text-sub mt-0.5">
                    Klik tombol &ldquo;Connect Google Drive&rdquo; di atas atau langsung tempel URL folder pada form tambah shortcut.
                  </p>
                </div>
              ) : folders.length === 0 ? (
                <div className="p-6 text-center">
                  <Folder size={24} className="mx-auto text-sub mb-2 opacity-60" />
                  <p className="text-xs font-bold text-ink">
                    {busy ? "Memuat daftar folder..." : "Belum ada folder yang terdeteksi"}
                  </p>
                  <p className="text-[11px] text-sub mt-0.5">
                    Buat folder baru di atas atau tempel URL folder Google Drive Anda secara langsung.
                  </p>
                </div>
              ) : (
                folders.map((f) => (
                  <div
                    key={f.id}
                    className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-surface2/50"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Folder size={18} className="text-brand shrink-0" />
                      <div className="min-w-0">
                        <p className="truncate text-xs font-bold text-ink">{f.name}</p>
                        <p className="truncate text-[11px] text-sub">ID: {f.id}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        onSelectDriveFolder({
                          name: f.name,
                          drive_folder_id: f.id,
                          drive_url: f.webViewLink || `https://drive.google.com/drive/folders/${f.id}`
                        });
                        onOpenChange(false);
                      }}
                      className="h-8 rounded-full bg-brand px-3.5 text-xs font-bold text-white shrink-0"
                    >
                      Pilih Folder
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Directory() {
  const { users, me, subscribe } = useApp();

  // 0ms Instant Hydrated Drive Shortcuts State
  const [shortcuts, setShortcuts] = useState(() => getCachedDriveShortcuts());
  const [driveSearch, setDriveSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [accessFilter, setAccessFilter] = useState("accessible"); // "accessible" | "all"
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);

  // Modals State
  const [shortcutModalOpen, setShortcutModalOpen] = useState(false);
  const [editingShortcut, setEditingShortcut] = useState(null);
  const [accessModalShortcut, setAccessModalShortcut] = useState(null);
  const [driveBrowserOpen, setDriveBrowserOpen] = useState(false);
  const [deleteConfirmShortcut, setDeleteConfirmShortcut] = useState(null);

  const humanUsers = useMemo(
    () => users.filter((u) => !u.is_bot && u.role !== "assistant" && u.user_id !== "user_circle_assistant"),
    [users]
  );
  const divisions = useMemo(
    () => [...new Set(humanUsers.map((u) => u.department || "Lainnya"))].sort(),
    [humanUsers]
  );

  // Background sync with server + realtime WebSocket subscription
  useEffect(() => {
    api
      .get("/drive-shortcuts")
      .then((r) => {
        if (Array.isArray(r.data)) {
          setShortcuts(r.data);
          setCachedDriveShortcuts(r.data);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(
    () =>
      subscribe((evt) => {
        if (evt.type === "drive_shortcuts:changed" && Array.isArray(evt.data)) {
          setShortcuts(evt.data);
          setCachedDriveShortcuts(evt.data);
        }
      }),
    [subscribe]
  );

  const syncShortcutsState = (updater) => {
    setShortcuts((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      setCachedDriveShortcuts(next);
      return next;
    });
  };

  // Save (Create or Update) Drive Shortcut in 0ms Optimistic UI
  const handleSaveShortcut = (payload) => {
    const isExisting = shortcuts.some((s) => s.id === payload.id);
    if (isExisting) {
      const updatedItem = { ...payload, updated_at: new Date().toISOString() };
      syncShortcutsState((prev) => prev.map((s) => (s.id === payload.id ? updatedItem : s)));
      toast.success(`Shortcut "${payload.name}" berhasil diperbarui`);
      api.patch(`/drive-shortcuts/${payload.id}`, updatedItem).catch((e) => toast.error(errMsg(e)));
    } else {
      const newItem = {
        ...payload,
        id: `drv_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
        created_by: me?.user_id || "user_admin1",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      syncShortcutsState((prev) => [newItem, ...prev]);
      toast.success(`Shortcut folder "${newItem.name}" ditambahkan ke Direktori`);
      api.post("/drive-shortcuts", newItem).catch((e) => toast.error(errMsg(e)));
    }
  };

  // Update Member Access in 0ms Optimistic UI
  const handleSaveMemberAccess = (shortcutId, patch) => {
    syncShortcutsState((prev) =>
      prev.map((s) => (s.id === shortcutId ? { ...s, ...patch, updated_at: new Date().toISOString() } : s))
    );
    toast.success("Akses member pada folder berhasil diperbarui");
    api.patch(`/drive-shortcuts/${shortcutId}`, patch).catch((e) => toast.error(errMsg(e)));
  };

  // Toggle Pin / Show on Dashboard in 0ms
  const handleQuickPatch = (shortcut, patch, msg) => {
    syncShortcutsState((prev) =>
      prev.map((s) => (s.id === shortcut.id ? { ...s, ...patch, updated_at: new Date().toISOString() } : s))
    );
    if (msg) toast.success(msg);
    api.patch(`/drive-shortcuts/${shortcut.id}`, patch).catch((e) => toast.error(errMsg(e)));
  };

  // Confirm Delete Shortcut in 0ms
  const handleConfirmDelete = () => {
    if (!deleteConfirmShortcut) return;
    const target = deleteConfirmShortcut;
    setDeleteConfirmShortcut(null);
    syncShortcutsState((prev) => prev.filter((s) => s.id !== target.id));
    toast.success(`Shortcut "${target.name}" dihapus dari Direktori`);
    api.delete(`/drive-shortcuts/${target.id}`).catch((e) => toast.error(errMsg(e)));
  };

  // Categories for Drive Shortcuts Filter
  const shortcutCategories = useMemo(() => {
    const cats = new Set([
      ...shortcuts.map((s) => s.category || "General"),
      ...divisions
    ]);
    return ["ALL", ...Array.from(cats)];
  }, [shortcuts, divisions]);

  const accessibleShortcutsCount = useMemo(
    () => shortcuts.filter((s) => hasShortcutAccess(s, me)).length,
    [shortcuts, me]
  );

  const filteredShortcuts = useMemo(() => {
    return shortcuts
      .filter((s) => {
        if (accessFilter.trim() === "accessible" && !hasShortcutAccess(s, me)) return false;
        if (selectedCategory !== "ALL" && (s.category || "General") !== selectedCategory) return false;
        if (driveSearch.trim()) {
          const hay = `${s.name} ${s.description || ""} ${s.category || ""} ${s.badge || ""}`.toLowerCase();
          if (!hay.includes(driveSearch.toLowerCase())) return false;
        }
        return true;
      })
      .sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned));
  }, [shortcuts, accessFilter, selectedCategory, driveSearch, me]);

  const chip = (on) =>
    `h-10 whitespace-nowrap rounded-full px-4 text-sm font-semibold transition-colors ${
      on ? "bg-brand text-white shadow-xs" : "border bg-surface text-sub hover:text-ink"
    }`;

  // Resolve member IDs with access for display on each card
  const getAccessibleMemberIds = (shortcut) => {
    if (shortcut.access_type === "all") return humanUsers.map((u) => u.user_id);
    const setIds = new Set(Array.isArray(shortcut.allowed_user_ids) ? shortcut.allowed_user_ids : []);
    if (shortcut.access_type === "department" && Array.isArray(shortcut.allowed_departments)) {
      humanUsers.forEach((u) => {
        if (shortcut.allowed_departments.includes(u.department)) setIds.add(u.user_id);
      });
    }
    return Array.from(setIds);
  };

  return (
    <div
      className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-10 lg:py-10 animate-crossfade"
      data-testid="directory-page"
    >
      <PageHeader
        icon={HardDrive}
        title="Directory"
        subtitle={`${accessibleShortcutsCount} shortcut folder Google Drive dapat Anda akses · Terhubung langsung ke Google Drive & otomatis tampil di Dashboard sesuai hak akses member`}
      />

      {/* 1 Line Toolbar on Desktop, Responsive Structured Grid/Wrap on Mobile:
          Order: 1. Tambah Shortcut, 2. Connect ke GDrive, 3. Filter, 4. Cari Folder */}
      <div
        className="relative mb-6 flex flex-wrap md:flex-nowrap items-center gap-2 sm:gap-2.5"
        data-testid="drive-action-search-row"
      >
        {/* 1. Tambah Shortcut */}
        <AccentButton
          onClick={() => {
            setEditingShortcut(null);
            setShortcutModalOpen(true);
          }}
          className="h-10 shrink-0 whitespace-nowrap text-xs sm:text-sm px-3.5 sm:px-4"
          data-testid="add-drive-shortcut-btn"
        >
          <Plus size={15} /> Tambah Shortcut
        </AccentButton>

        {/* 2. Connect ke GDrive */}
        <GhostButton
          onClick={() => setDriveBrowserOpen(true)}
          className="h-10 shrink-0 whitespace-nowrap text-xs sm:text-sm px-3.5 sm:px-4"
          data-testid="connect-google-drive-btn"
        >
          <HardDrive size={15} className="text-brand" /> Connect Google Drive
        </GhostButton>

        {/* 3. Filter (Berisi Semua Kategori, Divisi, & Akses Saya / Semua Folder) */}
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setFilterMenuOpen((prev) => !prev)}
            className={`inline-flex h-10 items-center gap-1.5 sm:gap-2 whitespace-nowrap rounded-full px-3.5 sm:px-4 text-xs sm:text-sm font-semibold transition-colors ${
              selectedCategory !== "ALL" || accessFilter === "all" || filterMenuOpen
                ? "bg-brand text-white shadow-xs"
                : "border bg-surface text-sub hover:text-ink"
            }`}
            data-testid="drive-filter-btn"
          >
            <SlidersHorizontal size={15} />
            <span>
              Filter
              {selectedCategory !== "ALL" ? `: ${selectedCategory}` : ""}
              {accessFilter === "all" ? " · Semua Folder" : ""}
            </span>
          </button>

          {filterMenuOpen && (
            <>
              <div
                className="fixed inset-0 z-30"
                onClick={() => setFilterMenuOpen(false)}
              />
              <div
                className="fixed sm:absolute left-4 right-4 sm:left-0 sm:right-auto top-36 sm:top-12 z-40 sm:w-96 rounded-2xl border bg-surface p-4 shadow-xl space-y-4"
                data-testid="drive-filter-popover"
              >
                <div className="flex items-center justify-between border-b pb-2.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-ink">
                    Filter Shortcut Folder
                  </span>
                  {(selectedCategory !== "ALL" || accessFilter !== "accessible") && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCategory("ALL");
                        setAccessFilter("accessible");
                      }}
                      className="text-xs font-bold text-brand hover:underline"
                    >
                      Reset Filter
                    </button>
                  )}
                </div>

                {/* Kategori / Divisi */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-sub">Kategori / Divisi</label>
                  <div className="flex flex-wrap gap-1.5" data-testid="drive-directory-filters">
                    {shortcutCategories.map((cat) => {
                      const active = selectedCategory === cat;
                      return (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setSelectedCategory(cat)}
                          className={`h-8 whitespace-nowrap rounded-full px-3.5 text-xs font-semibold transition-colors ${
                            active
                              ? "bg-brand text-white shadow-xs"
                              : "border bg-surface2/60 text-sub hover:text-ink"
                          }`}
                          data-testid={`drive-cat-${cat}`}
                        >
                          {cat === "ALL" ? "Semua Kategori" : cat}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Hak Akses Folder */}
                <div className="space-y-2 pt-1 border-t">
                  <label className="block text-xs font-bold text-sub">Tampilan Hak Akses</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setAccessFilter("accessible")}
                      className={`h-9 rounded-full px-3 text-xs font-bold transition-colors ${
                        accessFilter.trim() === "accessible"
                          ? "bg-brand text-white shadow-xs"
                          : "border bg-surface2/60 text-sub hover:text-ink"
                      }`}
                      data-testid="filter-my-access"
                    >
                      Akses Saya ({accessibleShortcutsCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => setAccessFilter("all")}
                      className={`h-9 rounded-full px-3 text-xs font-bold transition-colors ${
                        accessFilter === "all"
                          ? "bg-brand text-white shadow-xs"
                          : "border bg-surface2/60 text-sub hover:text-ink"
                      }`}
                      data-testid="filter-all-shortcuts"
                    >
                      Semua Folder ({shortcuts.length})
                    </button>
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={() => setFilterMenuOpen(false)}
                    className="btn-accent h-8 rounded-full px-4 text-xs font-bold text-white"
                  >
                    Terapkan
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* 4. Cari Folder */}
        <div className="flex h-10 w-full md:w-auto min-w-[200px] flex-1 items-center gap-2 rounded-full border bg-surface px-4">
          <Search size={15} className="shrink-0 text-sub" />
          <input
            value={driveSearch}
            onChange={(e) => setDriveSearch(e.target.value)}
            placeholder="Cari folder Google Drive…"
            className="w-full bg-transparent text-sm outline-none"
            data-testid="drive-shortcut-search"
          />
          {driveSearch && (
            <button
              type="button"
              onClick={() => setDriveSearch("")}
              className="text-sub hover:text-ink"
              title="Bersihkan pencarian"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Grid of Google Drive Folder Shortcuts */}
      {!filteredShortcuts.length ? (
        <Empty
          icon={HardDrive}
          title="Belum ada shortcut folder pada filter ini"
          description="Tambahkan shortcut folder Google Drive baru atau sesuaikan hak akses member."
          action={
            <AccentButton
              onClick={() => {
                setEditingShortcut(null);
                setShortcutModalOpen(true);
              }}
            >
              <Plus size={15} /> Tambah Shortcut Google Drive
            </AccentButton>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredShortcuts.map((s) => {
            const userHasAccess = hasShortcutAccess(s, me);
            const memberIds = getAccessibleMemberIds(s);
            const accentColor = s.color || "#FF5364";
            const cardStyle = s.card_style || "accent_top";

            return (
              <div
                key={s.id}
                className="card group relative flex flex-col justify-between overflow-hidden p-5 transition-all hover:shadow-md"
                style={{
                  borderTopWidth: cardStyle === "accent_top" ? "4px" : undefined,
                  borderTopColor: cardStyle === "accent_top" ? accentColor : undefined,
                  backgroundColor: cardStyle === "soft_tint" ? `${accentColor}08` : undefined
                }}
                data-testid={`drive-shortcut-card-${s.id}`}
              >
                <div>
                  {/* Top Row: Folder Icon, Title, Category & Quick Actions */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white shadow-xs transition-transform group-hover:scale-105"
                        style={{ backgroundColor: accentColor }}
                      >
                        <DriveIcon name={s.icon} size={22} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <h3 className="truncate font-bold text-ink text-base">{s.name}</h3>
                          {s.pinned && (
                            <Pin size={13} className="text-brand shrink-0 fill-current" title="Disematkan" />
                          )}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                          <span className="rounded-full bg-surface2 px-2.5 py-0.5 font-semibold text-sub">
                            {s.category || "General"}
                          </span>
                          {s.badge && (
                            <span
                              className="rounded-full px-2.5 py-0.5 font-bold"
                              style={{ backgroundColor: `${accentColor}1A`, color: accentColor }}
                            >
                              {s.badge}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Edit & Delete Buttons */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingShortcut(s);
                          setShortcutModalOpen(true);
                        }}
                        className="flex h-8 w-8 items-center justify-center rounded-xl border bg-surface text-sub hover:text-ink"
                        title="Customize Shortcut"
                        data-testid={`edit-shortcut-${s.id}`}
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteConfirmShortcut(s)}
                        className="flex h-8 w-8 items-center justify-center rounded-xl border bg-surface text-sub hover:text-rose-600"
                        title="Hapus Shortcut"
                        data-testid={`delete-shortcut-${s.id}`}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="mt-3.5 line-clamp-2 text-sm text-sub leading-relaxed">
                    {s.description || "Folder Google Drive terhubung langsung untuk kolaborasi dokumen tim."}
                  </p>

                  {/* Access & Dashboard Status Info Box */}
                  <div className="mt-4 rounded-2xl border bg-surface2/50 p-3 space-y-2.5">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="inline-flex items-center gap-1.5 font-bold text-ink">
                        {s.access_type === "all" ? (
                          <>
                            <Globe size={13} className="text-emerald-600" /> Semua Member
                          </>
                        ) : s.access_type === "department" ? (
                          <>
                            <Building2 size={13} className="text-brand" /> Divisi:{" "}
                            {(s.allowed_departments || []).join(", ") || "Custom"}
                          </>
                        ) : (
                          <>
                            <Lock size={13} className="text-brand" /> {memberIds.length} Member Punya Akses
                          </>
                        )}
                      </span>

                      <button
                        type="button"
                        onClick={() =>
                          handleQuickPatch(
                            s,
                            { show_on_dashboard: s.show_on_dashboard === false },
                            s.show_on_dashboard === false
                              ? "Ditampilkan di Dashboard member yang punya akses"
                              : "Disembunyikan dari Dashboard"
                          )
                        }
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold transition-colors ${
                          userHasAccess && s.show_on_dashboard !== false
                            ? "bg-soft-green text-emerald-700 dark:text-emerald-300"
                            : "bg-surface text-sub"
                        }`}
                        title="Klik untuk toggle tampil di Dashboard"
                      >
                        <LayoutDashboard size={11} />
                        {userHasAccess && s.show_on_dashboard !== false
                          ? "Tampil di Dashboard"
                          : !userHasAccess
                          ? "Tidak Ada Akses"
                          : "Off di Dashboard"}
                      </button>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-200/60 dark:border-slate-800">
                      <div className="flex items-center gap-2 min-w-0">
                        <AvatarStack ids={memberIds} max={5} size={24} />
                        <span className="truncate text-[11px] font-medium text-sub">
                          {memberIds.length} member memiliki akses
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setAccessModalShortcut(s)}
                        className="inline-flex items-center gap-1 rounded-xl border bg-surface px-2.5 py-1 text-xs font-bold text-brand hover:bg-brand hover:text-white transition-colors shrink-0"
                        data-testid={`manage-access-${s.id}`}
                      >
                        <ShieldCheck size={13} /> Atur Akses
                      </button>
                    </div>
                  </div>
                </div>

                {/* Card Footer Actions: Buka Folder Google Drive + Salin Link */}
                <div className="mt-4 flex items-center gap-2">
                  {userHasAccess ? (
                    <a
                      href={s.drive_url || "https://drive.google.com"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-accent flex h-10 flex-1 items-center justify-center gap-1.5 text-sm font-semibold"
                      data-testid={`open-drive-shortcut-${s.id}`}
                    >
                      <ExternalLink size={14} /> Buka Google Drive
                    </a>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setAccessModalShortcut(s)}
                      className="btn-ghost flex h-10 flex-1 items-center justify-center gap-1.5 border text-sm font-semibold text-sub"
                    >
                      <Lock size={14} /> Minta / Atur Akses
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(s.drive_url || "");
                      toast.success("Link Google Drive berhasil disalin");
                    }}
                    className="btn-ghost flex h-10 w-10 shrink-0 items-center justify-center border"
                    title="Salin Link Folder Google Drive"
                  >
                    <Copy size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Full Customize Shortcut Dialog */}
      <DriveShortcutDialog
        open={shortcutModalOpen}
        onOpenChange={setShortcutModalOpen}
        initialData={editingShortcut}
        users={humanUsers}
        divisions={divisions}
        me={me}
        onSave={handleSaveShortcut}
        onOpenDriveBrowser={() => setDriveBrowserOpen(true)}
      />

      {/* Dedicated Member Access Dialog */}
      <DriveAccessDialog
        open={!!accessModalShortcut}
        onOpenChange={(v) => !v && setAccessModalShortcut(null)}
        shortcut={accessModalShortcut}
        users={humanUsers}
        divisions={divisions}
        me={me}
        onSaveAccess={handleSaveMemberAccess}
      />

      {/* Direct Google Drive Folder Browser & Creator Dialog */}
      <GoogleDriveBrowserDialog
        open={driveBrowserOpen}
        onOpenChange={setDriveBrowserOpen}
        onSelectDriveFolder={(folderData) => {
          setEditingShortcut({
            name: folderData.name,
            drive_folder_id: folderData.drive_folder_id,
            drive_url: folderData.drive_url,
            category: me?.department || "General",
            badge: "Google Drive",
            color: "#FF5364",
            icon: "Folder",
            pinned: true,
            show_on_dashboard: true,
            access_type: "custom",
            allowed_departments: me?.department ? [me.department] : [],
            allowed_user_ids: me?.user_id ? [me.user_id] : ["user_admin1"]
          });
          setShortcutModalOpen(true);
        }}
      />

      {/* Delete Confirmation Modal */}
      <Dialog open={!!deleteConfirmShortcut} onOpenChange={(v) => !v && setDeleteConfirmShortcut(null)}>
        <DialogContent className="max-w-md p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-ink">Hapus Shortcut Folder Google Drive?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-sub mt-1">
            Apakah Anda yakin ingin menghapus shortcut{" "}
            <span className="font-bold text-ink">&ldquo;{deleteConfirmShortcut?.name}&rdquo;</span> dari Direktori? Folder asli di Google Drive Anda tetap aman dan tidak terhapus.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <GhostButton type="button" onClick={() => setDeleteConfirmShortcut(null)}>
              Batal
            </GhostButton>
            <AccentButton type="button" onClick={handleConfirmDelete} data-testid="confirm-delete-shortcut-btn">
              <Trash2 size={14} /> Hapus Shortcut
            </AccentButton>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
