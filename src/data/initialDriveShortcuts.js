export const INITIAL_DRIVE_SHORTCUTS = [
  {
    id: "drv_1",
    name: "Brand Guidelines & Creative Assets",
    description: "Logo resmi ASLI RI, template presentasi, font, dan aset desain kreatif seluruh produk.",
    drive_url: "https://drive.google.com/drive/folders/1asli-brand-guidelines-2026",
    folder_id: "1asli-brand-guidelines-2026",
    category: "Design",
    badge: "Official",
    color: "#FF5364",
    icon: "palette",
    pinned: true,
    show_on_dashboard: true,
    access_type: "all",
    allowed_user_ids: ["user_admin1", "user_superadmin_saeful", "user_budi", "user_siti", "user_dian"],
    allowed_departments: ["Design", "Marketing", "Product", "Management", "Engineering"],
    owner_id: "user_admin1",
    created_at: "2026-11-01T08:00:00.000Z",
    updated_at: "2026-11-10T08:00:00.000Z"
  },
  {
    id: "drv_2",
    name: "Sprint Engineering & Architecture",
    description: "Dokumentasi API, arsitektur sistem, skema database, dan catatan deployment teknis.",
    drive_url: "https://drive.google.com/drive/folders/1asli-engineering-architecture",
    folder_id: "1asli-engineering-architecture",
    category: "Engineering",
    badge: "Tech Docs",
    color: "#3B82F6",
    icon: "code",
    pinned: true,
    show_on_dashboard: true,
    access_type: "custom",
    allowed_user_ids: ["user_admin1", "user_superadmin_saeful", "user_siti", "user_budi"],
    allowed_departments: ["Engineering", "Product"],
    owner_id: "user_siti",
    created_at: "2026-11-02T09:00:00.000Z",
    updated_at: "2026-11-10T08:30:00.000Z"
  },
  {
    id: "drv_3",
    name: "Product Roadmap & PRD 2026",
    description: "Master PRD, riset pengguna, wireframe, dan perencanaan kuartal produk.",
    drive_url: "https://drive.google.com/drive/folders/1asli-product-roadmap-prd",
    folder_id: "1asli-product-roadmap-prd",
    category: "Product",
    badge: "Q4 2026",
    color: "#8B5CF6",
    icon: "layers",
    pinned: true,
    show_on_dashboard: true,
    access_type: "custom",
    allowed_user_ids: ["user_admin1", "user_superadmin_saeful", "user_budi", "user_dian"],
    allowed_departments: ["Product", "Design"],
    owner_id: "user_budi",
    created_at: "2026-11-03T10:00:00.000Z",
    updated_at: "2026-11-10T09:00:00.000Z"
  },
  {
    id: "drv_4",
    name: "Campaign Marketing & Social Media Kit",
    description: "Kalender konten, materi iklan digital, press release, dan laporan performa kampanye.",
    drive_url: "https://drive.google.com/drive/folders/1asli-marketing-campaign-kit",
    folder_id: "1asli-marketing-campaign-kit",
    category: "Marketing",
    badge: "Active",
    color: "#10B981",
    icon: "megaphone",
    pinned: true,
    show_on_dashboard: true,
    access_type: "all",
    allowed_user_ids: ["user_admin1", "user_superadmin_saeful", "user_budi", "user_siti", "user_dian"],
    allowed_departments: ["Marketing", "Design", "Management"],
    owner_id: "user_admin1",
    created_at: "2026-11-04T11:00:00.000Z",
    updated_at: "2026-11-10T09:15:00.000Z"
  },
  {
    id: "drv_5",
    name: "Dokumen Legal, Kontrak & NDA",
    description: "Arsip perjanjian kerja sama klien, NDA vendor, dan dokumen legalitas perusahaan.",
    drive_url: "https://drive.google.com/drive/folders/1asli-legal-contracts-nda",
    folder_id: "1asli-legal-contracts-nda",
    category: "Legal",
    badge: "Confidential",
    color: "#F59E0B",
    icon: "shield",
    pinned: false,
    show_on_dashboard: true,
    access_type: "custom",
    allowed_user_ids: ["user_admin1", "user_superadmin_saeful"],
    allowed_departments: ["Management", "Legal"],
    owner_id: "user_superadmin_saeful",
    created_at: "2026-11-05T12:00:00.000Z",
    updated_at: "2026-11-10T09:30:00.000Z"
  },
  {
    id: "drv_6",
    name: "SOP Perusahaan & Onboarding HRGA",
    description: "Panduan karyawan baru, peraturan perusahaan, klaim reimbursement, dan kebijakan cuti.",
    drive_url: "https://drive.google.com/drive/folders/1asli-hrga-sop-onboarding",
    folder_id: "1asli-hrga-sop-onboarding",
    category: "HRGA",
    badge: "Wajib Baca",
    color: "#06B6D4",
    icon: "book",
    pinned: false,
    show_on_dashboard: true,
    access_type: "all",
    allowed_user_ids: ["user_admin1", "user_superadmin_saeful", "user_budi", "user_siti", "user_dian"],
    allowed_departments: ["HRGA", "Management", "Engineering", "Product", "Design", "Marketing"],
    owner_id: "user_admin1",
    created_at: "2026-11-06T13:00:00.000Z",
    updated_at: "2026-11-10T09:45:00.000Z"
  }
];

let MEMORY_DRIVE_SHORTCUTS = null;

export function getCachedDriveShortcuts() {
  if (Array.isArray(MEMORY_DRIVE_SHORTCUTS) && MEMORY_DRIVE_SHORTCUTS.length > 0) {
    return MEMORY_DRIVE_SHORTCUTS;
  }
  try {
    const raw = localStorage.getItem("circle_drive_shortcuts_cache");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        MEMORY_DRIVE_SHORTCUTS = parsed;
        return parsed;
      }
    }
  } catch {}
  MEMORY_DRIVE_SHORTCUTS = INITIAL_DRIVE_SHORTCUTS;
  return INITIAL_DRIVE_SHORTCUTS;
}

export function setCachedDriveShortcuts(list) {
  if (!Array.isArray(list)) return;
  MEMORY_DRIVE_SHORTCUTS = list;
  try {
    localStorage.setItem("circle_drive_shortcuts_cache", JSON.stringify(list));
  } catch {}
}

/**
 * Checks whether a user has access to a given Google Drive folder shortcut.
 * Evaluates explicit allowed_user_ids, department access, or "all" workspace access.
 */
export function hasShortcutAccess(shortcut, user) {
  if (!shortcut || !user) return false;
  const uid = user.user_id;
  const dept = user.department || "General";

  if (Array.isArray(shortcut.excluded_user_ids) && shortcut.excluded_user_ids.includes(uid)) {
    return false;
  }

  if (shortcut.access_type === "all") {
    // If allowed_user_ids is explicitly restricted even in "all" mode, respect it; otherwise all members have access
    return true;
  }

  if (shortcut.access_type === "department") {
    const depts = Array.isArray(shortcut.allowed_departments) ? shortcut.allowed_departments : [];
    const users = Array.isArray(shortcut.allowed_user_ids) ? shortcut.allowed_user_ids : [];
    return depts.includes(dept) || users.includes(uid);
  }

  // "custom" / restricted member list
  const allowedUsers = Array.isArray(shortcut.allowed_user_ids) ? shortcut.allowed_user_ids : [];
  return allowedUsers.includes(uid);
}
