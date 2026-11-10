// i18n Translation & Custom Copywriting System

export const DEFAULT_COPYWRITING = {
  // Navigation
  nav_home: "Home",
  nav_beranda: "Feed",
  nav_messages: "Messages",
  nav_schedule: "Schedule",
  nav_groups: "Groups",
  nav_directory: "Directory",
  nav_employee: "Employee",
  nav_org: "Organization",
  nav_tasks: "Tasks",
  nav_projects: "Projects",
  nav_settings: "Settings",
  nav_search: "Search…",
  nav_logout: "Log out",
  nav_profile: "Profile",

  // Dashboard
  dash_greeting_morning: "Good morning",
  dash_greeting_afternoon: "Good afternoon",
  dash_greeting_evening: "Good evening",
  dash_greeting_night: "Good night",
  dash_new_task: "New Task",
  dash_background: "Background",
  dash_customize_layout: "Customize Layout",
  dash_meetings_title: "Upcoming Meetings",
  dash_tasks_title: "Today's Priority Tasks",
  dash_messages_title: "Team Messages & Feed",
  dash_open_chat: "Open Team Chat",
  dash_open_calendar: "Open Calendar",
  dash_view_all: "View All",
  dash_view_kanban: "View Kanban",
  dash_view_feed: "Open Feed",
  dash_new_schedule: "New Schedule",
  dash_add_task_item: "Add New Task Item",
  dash_perf_title: "Team Performance & Workload",
  dash_perf_subtitle: "Monitoring task completions and operational punctuality.",
  dash_personnel_title: "Personnel Capacity & Workload",
  dash_personnel_subtitle: "Monitoring active task distribution and workload pressure.",

  // Tasks & Management
  tasks_page_title: "Task Management",
  tasks_new_btn: "New Task",
  tasks_tab_board: "Kanban Board",
  tasks_tab_list: "List Table",
  tasks_tab_timeline: "Timeline Calendar",
  tasks_tab_archive: "Archive & History",
  tasks_automation: "Automation",
  tasks_export_csv: "Export CSV",
  tasks_import_csv: "Import CSV",

  // Schedule
  schedule_title: "Schedule & Meetings",
  schedule_subtitle: "Manage and view team meeting schedules synced with Google Calendar and Google Meet.",
  schedule_new_meeting: "Set Meeting Schedule",

  // Feed / Beranda
  beranda_composer_placeholder: "What is happening?",
  beranda_post_btn: "Post",
  beranda_reply_btn: "Reply",
  beranda_trending_title: "Trending Hashtags",

  // Settings
  settings_title: "Settings",
  settings_copywriting_title: "Custom Copywriting & Text",
  settings_copywriting_desc: "Upload and import CSV to customize all copywriting, labels, and text across the application.",
  settings_saved: "Preferences saved successfully"
};

export function getTranslation(key, customCopywriting = {}) {
  if (customCopywriting && typeof customCopywriting === "object" && customCopywriting[key]) {
    return customCopywriting[key];
  }
  return DEFAULT_COPYWRITING[key] || key;
}

/**
 * Generate CSV text from current copywriting keys and custom overrides
 */
export function generateCopywritingCsv(customCopywriting = {}) {
  const headers = ["Key", "Default_Text", "Custom_Text"];
  const escapeCsv = (str) => {
    if (str === null || str === undefined) return '""';
    const s = String(str).replace(/"/g, '""');
    return `"${s}"`;
  };

  const rows = Object.entries(DEFAULT_COPYWRITING).map(([k, defaultVal]) => {
    const customVal = customCopywriting[k] || "";
    return [escapeCsv(k), escapeCsv(defaultVal), escapeCsv(customVal)].join(",");
  });

  return [headers.join(","), ...rows].join("\n");
}

/**
 * Parse CSV text into a key-value dictionary of custom copywriting
 */
export function parseCopywritingCsv(csvText) {
  if (!csvText || typeof csvText !== "string") return {};
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length <= 1) return {};

  const dict = {};

  // Simple CSV line parser respecting quotes
  const parseLine = (line) => {
    const values = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"' && (i === 0 || line[i - 1] !== "\\")) {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++; // skip escaped quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === "," && !inQuotes) {
        values.push(current);
        current = "";
      } else {
        current += char;
      }
    }
    values.push(current);
    return values;
  };

  // Skip header line
  for (let i = 1; i < lines.length; i++) {
    const parts = parseLine(lines[i]);
    if (parts.length >= 2) {
      const key = parts[0].trim().replace(/^"|"$/g, "");
      // If 3 columns (Key, Default, Custom), custom is parts[2] if non-empty, else parts[1]
      let val = "";
      if (parts.length >= 3 && parts[2]?.trim()) {
        val = parts[2].trim().replace(/^"|"$/g, "");
      } else if (parts[1]?.trim()) {
        val = parts[1].trim().replace(/^"|"$/g, "");
      }
      if (key && val) {
        dict[key] = val;
      }
    }
  }

  return dict;
}
