import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import fs from 'fs';
import { INITIAL_TASKS } from './src/data/initialTasks.js';
import { INITIAL_DRIVE_SHORTCUTS } from './src/data/initialDriveShortcuts.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function startServer() {
  const app = express();
  const server = createServer(app);
  const wss = new WebSocketServer({ server, path: '/api/ws' });

  const broadcast = (data: any) => {
    const msg = JSON.stringify(data);
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(msg);
      }
    });
  };

  const createNotification = (params: { 
    user_id: string, 
    title: string, 
    body?: string, 
    type?: string, 
    category?: string, 
    actor_id?: string,
    link?: string,
    access_request?: any,
    task_id?: string,
    conversation_id?: string
  }) => {
    const notif = {
      id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      read: false,
      created_at: new Date().toISOString(),
      category: params.category || "general",
      ...params
    };
    if (!db.notifications) db.notifications = [];
    db.notifications.unshift(notif);
    // Keep only last 100 notifications per user or overall
    if (db.notifications.length > 1000) db.notifications = db.notifications.slice(0, 1000);
    
    broadcast({ type: "notification", data: notif });
    return notif;
  };

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 15 * 1024 * 1024 }
  });

  app.use(express.json());

  const initialServerTasks: any[] = [];

  // In-memory mock data store for CIRCLE Workspace with explicit any/Record types
  const db: Record<string, any> = {
    files: {},
    meetings: [],
    workspace: {
      id: "ws_main",
      name: "CIRCLE Workspace",
      tagline: "Enterprise Collaboration & Management",
      logo_file_id: null,
      login_image_file_id: "default_login_bg",
      theme: { primary: "#2F7DE1", mode: "light" },
      task_statuses: ["todo", "in_progress", "in_review", "done"],
      task_fields: [{ name: "priority" }],
      divisions: ["Engineering", "Product", "Operations", "Design"],
      item_types: [],
    },
    users: [
      {
        user_id: "user_admin1",
        email: "admin@asliri.local",
        name: "Admin ASLI RI",
        role: "super_admin",
        job_title: "Workspace Administrator",
        department: "Engineering",
        online: true,
        is_demo: false,
        status: "active",
        avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80",
        picture: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80"
      }
    ],
    labels: [
      { id: "lbl_asliri", name: "ASLI RI", color: "#EF4444", description: "IP / Brand ASLI RI" },
      { id: "lbl_tixfly", name: "TIXFLY", color: "#8B5CF6", description: "IP / Brand TIXFLY" },
      { id: "lbl_bankabdi", name: "BANK ABDI", color: "#0EA5E9", description: "IP / Brand BANK ABDI" },
      { id: "lbl_tommy", name: "TOMMY FONDY", color: "#F97316", description: "IP / Brand TOMMY FONDY" },
      { id: "lbl_trinity", name: "TRINITY", color: "#EC4899", description: "IP / Brand TRINITY" },
      { id: "lbl_beezy", name: "BEEZY", color: "#EAB308", description: "IP / Brand BEEZY" },
      { id: "lbl_internal", name: "INTERNAL", color: "#1E293B", description: "IP / Brand INTERNAL" }
    ],
    notifications: [],
    tasks: [],
    projects: [],
    boards: [
      { id: "brd_1", name: "Main Board", description: "Main tasks" }
    ],
    conversations: [],
    groups: [],
    messages: [],
    posts: [],
    org_units: [],
    activity: [],
    reminders: [],
    polls: [],
    task_automations: [],
    audit_logs: [],
    invitations: [],
    drive_shortcuts: [],
    prefs: {}
  };

  const DB_FILE = path.join(__dirname, '.circle_workspace_db.json');

  function loadDbFromFile() {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          Object.keys(parsed).forEach((key) => {
            db[key] = parsed[key];
          });
          console.log('Successfully loaded CIRCLE workspace database from disk.');
        }
      }
    } catch (e) {
      console.warn('Failed to load DB file, using initial data:', e);
    }
  }

  function saveDbToFile() {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
    } catch (e) {
      console.warn('Failed to save DB file to disk:', e);
    }
  }

  // Load persistent DB state on startup
  loadDbFromFile();

  // Clean up any historical approval/rejection text messages so only clean approval cards remain
  if (Array.isArray(db.messages)) {
    db.messages = db.messages.filter((m: any) => 
      !m.id?.startsWith('msg_approved_') && 
      !m.id?.startsWith('msg_rejected_') && 
      !m.text?.startsWith('✅ Permintaan akses') && 
      !m.text?.startsWith('❌ Permintaan akses')
    );
  }

  // Ensure access_requests array exists
  if (!Array.isArray(db.access_requests)) {
    db.access_requests = [];
  }

  // Ensure Circle Assistant Bot user exists
  const CIRCLE_BOT_ID = "user_circle_assistant";
  let circleBot = db.users.find((u: any) => u.user_id === CIRCLE_BOT_ID);
  if (!circleBot) {
    circleBot = {
      user_id: CIRCLE_BOT_ID,
      email: "circle-bot@asliri.local",
      name: db.workspace.assistant_name || "Circle",
      role: "assistant",
      job_title: "Workspace AI Assistant",
      department: "System",
      online: true,
      is_demo: false,
      is_bot: true,
      status: "active",
      avatar: db.workspace.assistant_avatar || "https://api.dicebear.com/7.x/bottts/svg?seed=CircleWorkspace&backgroundColor=FF5364",
      picture: db.workspace.assistant_avatar || "https://api.dicebear.com/7.x/bottts/svg?seed=CircleWorkspace&backgroundColor=FF5364"
    };
    db.users.push(circleBot);
  } else {
    circleBot.name = db.workspace.assistant_name || circleBot.name || "Circle";
    if (db.workspace.assistant_avatar) {
      circleBot.avatar = db.workspace.assistant_avatar;
      circleBot.picture = db.workspace.assistant_avatar;
    }
  }

  // Ensure Super Admin user saeful@asliri.id exists
  let saefulAdmin = db.users.find((u: any) => u.email?.toLowerCase() === "saeful@asliri.id");
  if (!saefulAdmin) {
    saefulAdmin = {
      user_id: "user_superadmin_saeful",
      email: "saeful@asliri.id",
      password: "AsliRi2026!",
      name: "Saeful",
      role: "super_admin",
      job_title: "Super Administrator",
      department: "Management",
      online: true,
      is_demo: false,
      status: "active",
      avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80",
      picture: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80"
    };
    db.users.push(saefulAdmin);
  } else {
    saefulAdmin.role = "super_admin";
    saefulAdmin.status = "active";
    if (!saefulAdmin.password) saefulAdmin.password = "AsliRi2026!";
  }

  // Production cleanup: clear all tasks and remove non-super-admin accounts
  if (!db.prod_clean_v2) {
    db.users = (db.users || []).filter(
      (u: any) => u.role === "super_admin" || u.user_id === CIRCLE_BOT_ID || u.is_bot || u.role === "assistant"
    );
    const validIds = new Set(db.users.map((u: any) => u.user_id));
    const validHumanIds = db.users
      .filter((u: any) => !u.is_bot && u.role !== "assistant" && u.user_id !== CIRCLE_BOT_ID)
      .map((u: any) => u.user_id);

    db.tasks = [];
    db.access_requests = [];
    db.invitations = [];
    db.notifications = [];
    db.activity = [];

    if (Array.isArray(db.messages)) {
      db.messages = db.messages.filter(
        (m: any) =>
          !m.id?.startsWith("msg_req_") &&
          !m.access_request &&
          validIds.has(m.sender_id)
      );
    }

    if (Array.isArray(db.conversations)) {
      db.conversations = db.conversations
        .filter((c: any) => {
          if (c.type === "dm") {
            const mems = Array.isArray(c.member_ids) ? c.member_ids : [];
            return mems.every((id: string) => validIds.has(id));
          }
          return true;
        })
        .map((c: any) => {
          const next = { ...c };
          if (Array.isArray(next.member_ids)) {
            next.member_ids = next.member_ids.filter((id: string) => validIds.has(id));
          }
          if (Array.isArray(next.members)) {
            next.members = next.members.filter((id: string) => validIds.has(id));
          }
          if (next.last_message?.id?.startsWith("msg_req_") || next.last_message?.access_request) {
            next.last_message = null;
          }
          return next;
        });
    }

    if (Array.isArray(db.groups)) {
      db.groups.forEach((g: any) => {
        g.member_ids = [...validHumanIds];
        g.members = [...validHumanIds];
        g.member_count = validHumanIds.length;
      });
    }

    if (Array.isArray(db.boards)) {
      db.boards.forEach((b: any) => {
        b.member_ids = [...validHumanIds];
      });
    }

    if (Array.isArray(db.projects)) {
      db.projects.forEach((p: any) => {
        if (!validIds.has(p.owner_id)) p.owner_id = "user_admin1";
        p.member_ids = [...validHumanIds];
      });
    }

    if (Array.isArray(db.meetings)) {
      db.meetings.forEach((m: any) => {
        if (!validIds.has(m.created_by)) m.created_by = "user_admin1";
        m.attendee_ids = Array.isArray(m.attendee_ids)
          ? m.attendee_ids.filter((id: string) => validIds.has(id))
          : [...validHumanIds];
        if (m.attendee_ids.length === 0) m.attendee_ids = [...validHumanIds];
      });
    }

    if (Array.isArray(db.posts)) {
      db.posts = db.posts
        .filter((p: any) => validIds.has(p.author_id))
        .map((p: any) => ({
          ...p,
          likes: Array.isArray(p.likes) ? p.likes.filter((id: string) => validIds.has(id)) : [],
          like_count: Array.isArray(p.likes) ? p.likes.filter((id: string) => validIds.has(id)).length : 0,
          reactions: { "👍": ["user_admin1"] },
          replies_preview: Array.isArray(p.replies_preview)
            ? p.replies_preview.filter((r: any) => validIds.has(r.author_id))
            : [],
          reply_count: Array.isArray(p.replies_preview)
            ? p.replies_preview.filter((r: any) => validIds.has(r.author_id)).length
            : 0
        }));
    }

    if (Array.isArray(db.org_units)) {
      db.org_units.forEach((u: any) => {
        if (u.head_id && !validIds.has(u.head_id)) {
          u.head_id = "user_admin1";
        }
      });
    }

    if (Array.isArray(db.drive_shortcuts)) {
      db.drive_shortcuts.forEach((s: any) => {
        if (!validIds.has(s.owner_id)) s.owner_id = "user_admin1";
        s.allowed_user_ids = [...validHumanIds];
      });
    }

    if (!validIds.has(db.session_user_id)) {
      db.session_user_id = "user_admin1";
    }

    db.prod_clean_v2 = true;
    saveDbToFile();
  }

  // Ensure default boards have department and all human workspace users in member_ids
  const humanUserIds = (db.users || [])
    .filter((u: any) => !u.is_bot && u.role !== "assistant" && u.user_id !== CIRCLE_BOT_ID)
    .map((u: any) => u.user_id);

  if (Array.isArray(db.boards)) {
    db.boards.forEach((b: any) => {
      if (!b.department) b.department = "Semua Divisi";
      const existingMembers = Array.isArray(b.member_ids)
        ? b.member_ids.filter((id: string) => id !== CIRCLE_BOT_ID && humanUserIds.includes(id))
        : [];
      b.member_ids = Array.from(new Set([...existingMembers, ...humanUserIds]));
    });
  }

  // Ensure all tasks have valid status, board_id, and synced assignee_ids
  if (Array.isArray(db.tasks)) {
    const defaultBoardId = db.boards?.[0]?.id || "brd_1";
    db.tasks.forEach((t: any) => {
      if (!t.status) t.status = "todo";
      if (!t.board_id) t.board_id = defaultBoardId;
      if (!t.priority) t.priority = "medium";
      let aIds = Array.isArray(t.assignee_ids) ? [...t.assignee_ids] : [];
      if (t.assignee_id && !aIds.includes(t.assignee_id)) aIds.unshift(t.assignee_id);
      aIds = aIds.filter((id: string) => Boolean(id) && id !== CIRCLE_BOT_ID);
      t.assignee_ids = aIds;
      t.assignee_id = aIds[0] || null;
    });
  }

  // Helper for color contrast
  function isDarkColor(hex: string): boolean {
    if (!hex || typeof hex !== 'string') return false;
    const c = hex.replace('#', '');
    if (c.length !== 6) return false;
    const r = parseInt(c.slice(0, 2), 16);
    const g = parseInt(c.slice(2, 4), 16);
    const b = parseInt(c.slice(4, 6), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance < 0.55;
  }

  // 16 Standard Item Types from user requirements
  const DEFAULT_WORKSPACE_ITEM_TYPES = [
    { name: "Article Asset", color: "#FFE4E6", text_color: "#BE123C", border_color: "#FECDD3" },
    { name: "Article Copywriting", color: "#FFEDD5", text_color: "#C2410C", border_color: "#FED7AA" },
    { name: "SocMed Asset", color: "#FEF08A", text_color: "#854D0E", border_color: "#FDE047" },
    { name: "SocMed Copywriting", color: "#DCFCE7", text_color: "#15803D", border_color: "#BBF7D0" },
    { name: "Video Storyline", color: "#BAE6FD", text_color: "#0369A1", border_color: "#7DD3FC" },
    { name: "Video Storyboard", color: "#CCFBF1", text_color: "#0F766E", border_color: "#99F6E4" },
    { name: "Video Editing", color: "#F3E8FF", text_color: "#7E22CE", border_color: "#E9D5FF" },
    { name: "Deck Copywriting", color: "#2563EB", text_color: "#FFFFFF", border_color: "#1D4ED8" },
    { name: "Deck Asset", color: "#DDD6FE", text_color: "#4C1D95", border_color: "#C4B5FD" },
    { name: "Documentation", color: "#F1F5F9", text_color: "#334155", border_color: "#CBD5E1" },
    { name: "Leads", color: "#94A3B8", text_color: "#0F172A", border_color: "#64748B" },
    { name: "UI/UX", color: "#581C87", text_color: "#FFFFFF", border_color: "#3B0764" },
    { name: "Shooting", color: "#047857", text_color: "#FFFFFF", border_color: "#065F46" },
    { name: "Video Motion", color: "#78350F", text_color: "#FFFFFF", border_color: "#451A03" },
    { name: "Request HR", color: "#6B21A8", text_color: "#FFFFFF", border_color: "#581C87" },
    { name: "Other", color: "#E2E8F0", text_color: "#1E293B", border_color: "#CBD5E1" }
  ];

  if (!db.workspace) db.workspace = {};
  if (!Array.isArray(db.workspace.item_types) || db.workspace.item_types.length === 0) {
    db.workspace.item_types = [...DEFAULT_WORKSPACE_ITEM_TYPES];
  } else {
    DEFAULT_WORKSPACE_ITEM_TYPES.forEach((def) => {
      const found = db.workspace.item_types.find((x: any) => x.name.toLowerCase() === def.name.toLowerCase());
      if (!found) {
        db.workspace.item_types.push(def);
      } else {
        if (!found.text_color) found.text_color = def.text_color;
        if (!found.border_color) found.border_color = def.border_color;
      }
    });
  }

  // Ensure default IP/Brand labels exist
  const DEFAULT_LABELS = [
    { id: "lbl_asliri", name: "ASLI RI", color: "#EF4444", description: "IP / Brand ASLI RI" },
    { id: "lbl_tixfly", name: "TIXFLY", color: "#8B5CF6", description: "IP / Brand TIXFLY" },
    { id: "lbl_bankabdi", name: "BANK ABDI", color: "#0EA5E9", description: "IP / Brand BANK ABDI" },
    { id: "lbl_tommy", name: "TOMMY FONDY", color: "#F97316", description: "IP / Brand TOMMY FONDY" },
    { id: "lbl_trinity", name: "TRINITY", color: "#EC4899", description: "IP / Brand TRINITY" },
    { id: "lbl_beezy", name: "BEEZY", color: "#EAB308", description: "IP / Brand BEEZY" },
    { id: "lbl_internal", name: "INTERNAL", color: "#1E293B", description: "IP / Brand INTERNAL" }
  ];

  if (!Array.isArray(db.labels)) {
    db.labels = [...DEFAULT_LABELS];
  } else {
    DEFAULT_LABELS.forEach((dl) => {
      const found = db.labels.find((l: any) => l.name.toLowerCase() === dl.name.toLowerCase() || l.id === dl.id);
      if (!found) {
        db.labels.push(dl);
      } else {
        if (!found.color) found.color = dl.color;
      }
    });
  }

  // Ensure official department groups exist
  const officialGroups = [
    { name: "Marketing", description: "Official channel for Marketing department discussions" },
    { name: "Sales", description: "Official channel for Sales department discussions" },
    { name: "IT", description: "Official channel for IT department discussions" },
    { name: "Finance", description: "Official channel for Finance department discussions" },
    { name: "Legal", description: "Official channel for Legal department discussions" },
    { name: "HRGA", description: "Official channel for HRGA department discussions" },
  ];

  officialGroups.forEach((og) => {
    const groupId = `group_official_${og.name.toLowerCase()}`;
    let g = db.groups.find((x: any) => x.id === groupId || (x.name === og.name && x.is_verified));
    
    if (g) {
      g.id = groupId;
      g.name = og.name;
      g.is_verified = true;
      g.type = "group";
      g.member_ids = (Array.isArray(g.member_ids) ? g.member_ids : humanUserIds).filter((id: string) => id !== CIRCLE_BOT_ID);
    } else {
      g = {
        id: groupId,
        name: og.name,
        description: og.description,
        group_type: "department",
        is_verified: true,
        created_at: new Date().toISOString(),
        member_ids: [...humanUserIds],
        type: "group"
      };
      db.groups.push(g);
    }

    const convIdx = db.conversations.findIndex((c: any) => c.id === g.id || (c.name === og.name && c.is_verified));
    if (convIdx === -1) {
      db.conversations.push(g);
    } else {
      const c = db.conversations[convIdx];
      c.id = g.id;
      c.name = g.name;
      c.is_verified = true;
      c.type = "group";
      const baseMems = Array.isArray(c.member_ids) ? c.member_ids : g.member_ids;
      c.member_ids = baseMems.filter((id: string) => id !== CIRCLE_BOT_ID);
      if (Array.isArray(c.members)) {
        c.members = c.members.filter((id: string) => id !== CIRCLE_BOT_ID);
      }
    }
  });

  // Remove Circle Assistant from ALL group conversations and groups (Circle is strictly a DM chat bot)
  if (Array.isArray(db.groups)) {
    db.groups.forEach((g: any) => {
      if (Array.isArray(g.member_ids)) {
        g.member_ids = g.member_ids.filter((id: string) => id !== CIRCLE_BOT_ID);
      }
      if (Array.isArray(g.members)) {
        g.members = g.members.filter((id: string) => id !== CIRCLE_BOT_ID);
      }
      g.member_count = (g.member_ids || []).length;
    });
  }
  if (Array.isArray(db.conversations)) {
    db.conversations.forEach((c: any) => {
      if (c && (c.type === "group" || c.group_type || String(c.id || "").startsWith("group_"))) {
        if (Array.isArray(c.member_ids)) {
          c.member_ids = c.member_ids.filter((id: string) => id !== CIRCLE_BOT_ID);
        }
        if (Array.isArray(c.members)) {
          c.members = c.members.filter((id: string) => id !== CIRCLE_BOT_ID);
        }
      }
    });
  }
  saveDbToFile();

  // Ensure default posts exist so Beranda has active trending hashtags and feed content
  if (!Array.isArray(db.posts) || db.posts.length === 0) {
    const h2 = new Date(Date.now() - 3600000 * 5).toISOString();
    db.posts = [
      {
        id: "pst_init_1",
        author_id: "user_admin1",
        text: "Selamat datang di workspace internal ASLI RI! 🎉 Silakan gunakan Beranda ini untuk update info, obrolan santai, atau diskusi lintas divisi. Jangan ragu menyematkan #welcome dan #update.",
        attachments: [],
        likes: ["user_admin1", "user_superadmin_saeful"],
        like_count: 2,
        liked: true,
        reactions: { "🎉": ["user_superadmin_saeful"], "👍": ["user_admin1"] },
        reply_count: 0,
        replies_preview: [],
        created_at: h2
      }
    ];
  }

  // Keep tasks array initialized without re-seeding dummy tasks when cleared
  if (!Array.isArray(db.tasks)) {
    db.tasks = [];
  }

  // Ensure default project exists if empty
  if (!Array.isArray(db.projects) || db.projects.length === 0) {
    db.projects = [
      {
        id: "prj_1",
        name: "Enterprise Workspace Migration",
        description: "Migrasi sistem kolaborasi internal ASLI RI ke platform terpadu.",
        status: "active",
        progress: 0,
        owner_id: "user_admin1",
        member_ids: ["user_admin1", "user_superadmin_saeful"],
        label_ids: ["lbl_1", "lbl_2"]
      }
    ];
  }

  // Ensure default meetings exist if empty
  if (!Array.isArray(db.meetings) || db.meetings.length === 0) {
    const todayStr = new Date().toISOString().slice(0, 10);
    db.meetings = [
      {
        id: "mtg_seed_1",
        title: "Sprint Planning & Backlog Review",
        description: "Review sprint backlog, prioritasi tiket, dan pembagian tugas antar divisi.",
        date: todayStr,
        start_time: "10:00",
        end_time: "11:30",
        location: "Google Meet",
        meet_link: "https://meet.google.com/asli-sprint-sync",
        attendee_ids: ["user_admin1", "user_superadmin_saeful"],
        gcal_synced: false,
        created_by: "user_admin1",
        created_at: new Date(Date.now() - 86400000).toISOString()
      }
    ];
  }

  // Ensure default org units and member mappings exist if empty
  if (!Array.isArray(db.org_units) || db.org_units.length === 0) {
    db.org_units = [
      { id: "unit_exec", name: "Board of Directors & Management", level: "Executive", head_id: "user_superadmin_saeful", parent_id: null },
      { id: "unit_eng", name: "Engineering & IT", level: "Department", head_id: "user_admin1", parent_id: "unit_exec" },
      { id: "unit_prod", name: "Product & Design", level: "Department", head_id: "user_superadmin_saeful", parent_id: "unit_exec" },
      { id: "unit_ops", name: "Operations & Infrastructure", level: "Department", head_id: "user_admin1", parent_id: "unit_exec" },
      { id: "unit_mkt", name: "Marketing & Growth", level: "Department", head_id: null, parent_id: "unit_exec" }
    ];

    const mapping: Record<string, { unit: string, manager?: string }> = {
      "user_superadmin_saeful": { unit: "unit_exec" },
      "user_admin1": { unit: "unit_ops", manager: "user_superadmin_saeful" }
    };
    (db.users || []).forEach((u: any) => {
      if (mapping[u.user_id]) {
        u.org_unit_id = mapping[u.user_id].unit;
        if (mapping[u.user_id].manager) u.manager_id = mapping[u.user_id].manager;
      }
    });
  }

  if (!Array.isArray(db.drive_shortcuts) || db.drive_shortcuts.length === 0) {
    db.drive_shortcuts = [...INITIAL_DRIVE_SHORTCUTS];
  }

  saveDbToFile();

  // Auto-save DB on any data-modifying HTTP request
  app.use((req, res, next) => {
    res.on('finish', () => {
      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) && res.statusCode >= 200 && res.statusCode < 300) {
        saveDbToFile();
      }
    });
    next();
  });

  let currentSessionUser: any = (db.session_user_id && db.users.find((u: any) => u.user_id === db.session_user_id)) || db.users[0];

  // API Routes
  app.post("/api/admin/reset-data", (req, res) => {
    db.tasks = [];
    db.messages = [];
    db.posts = [];
    db.conversations = [];
    db.activity = [];
    db.audit_logs = [];
    // Reset workspace branding
    db.workspace.logo_file_id = null;
    db.workspace.login_image_file_id = null;
    
    saveDbToFile();
    console.log('Database state reset successfully.');
    res.json({ success: true });
  });

  app.get("/api/auth/me", (req, res) => {
    if (!currentSessionUser) {
      currentSessionUser = db.users[0];
    }
    const latestUser = db.users.find((u: any) => u.user_id === currentSessionUser?.user_id) || currentSessionUser || db.users[0];
    currentSessionUser = latestUser;
    db.session_user_id = latestUser.user_id;
    res.json({
      user: latestUser,
      workspace: db.workspace,
      prefs: db.prefs[latestUser.user_id] || { theme_mode: "light" },
      users: db.users,
      labels: db.labels,
      drive_shortcuts: db.drive_shortcuts || []
    });
  });

  // Email & Password Login
  app.post("/api/auth/login", (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ detail: "Email dan password wajib diisi." });
    }

    const cleanEmail = email.toLowerCase().trim();
    const user = db.users.find((u: any) => u.email?.toLowerCase() === cleanEmail);

    if (!user) {
      return res.status(401).json({ detail: "Akun dengan email tersebut belum terdaftar. Silakan lakukan pendaftaran terlebih dahulu." });
    }

    if (user.password && user.password !== password) {
      return res.status(401).json({ detail: "Password yang Anda masukkan salah. Silakan periksa kembali." });
    }

    if (user.status === "pending") {
      return res.status(403).json({
        status: "pending",
        detail: "Akun Anda sedang dalam proses peninjauan & approval oleh Super Admin. Mohon tunggu persetujuan."
      });
    }

    if (user.status === "inactive" || user.status === "rejected") {
      return res.status(403).json({
        status: "inactive",
        detail: "Akun Anda dinonaktifkan atau ditolak. Silakan hubungi Super Admin."
      });
    }

    currentSessionUser = user;
    db.session_user_id = user.user_id;
    saveDbToFile();

    res.json({
      user,
      workspace: db.workspace,
      prefs: db.prefs[user.user_id] || { theme_mode: "light" }
    });
  });

  // Email & Password Registration / Signup
  app.post("/api/auth/register", (req, res) => {
    const { name, email, password, department, job_title, note, avatar } = req.body || {};
    if (!email || !password || !name) {
      return res.status(400).json({ detail: "Nama lengkap, email, dan password wajib diisi." });
    }

    if (password.length < 4) {
      return res.status(400).json({ detail: "Password minimal 4 karakter." });
    }

    const cleanEmail = email.toLowerCase().trim();
    const existingUser = db.users.find((u: any) => u.email?.toLowerCase() === cleanEmail);

    if (existingUser && existingUser.status === "active") {
      return res.status(400).json({ detail: "Email ini sudah memiliki akun aktif. Silakan langsung masuk (login)." });
    }

    if (existingUser && existingUser.status === "pending") {
      return res.status(400).json({ detail: "Pendaftaran untuk email ini sudah diajukan dan sedang menunggu approval Super Admin." });
    }

    const reqId = `req_${Date.now()}`;
    const newUserId = existingUser ? existingUser.user_id : `user_${Date.now()}`;

    let newUserObj: any = null;
    const defaultAvatar = avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}`;
    if (!existingUser) {
      newUserObj = {
        user_id: newUserId,
        email: cleanEmail,
        password: password,
        name: name.trim(),
        role: "employee",
        job_title: job_title || "Staff Member",
        department: department || "General",
        status: "pending",
        online: false,
        is_demo: false,
        avatar: defaultAvatar,
        picture: defaultAvatar
      };
      db.users.push(newUserObj);
    } else {
      existingUser.password = password;
      existingUser.name = name.trim();
      if (department) existingUser.department = department;
      if (job_title) existingUser.job_title = job_title;
      existingUser.avatar = defaultAvatar;
      existingUser.picture = defaultAvatar;
      existingUser.status = "pending";
      newUserObj = existingUser;
    }

    const accessReq = {
      id: reqId,
      name: name.trim(),
      email: cleanEmail,
      department: department || "General",
      job_title: job_title || "Staff Member",
      note: note || "Pendaftaran akun baru via Email & Password",
      status: "pending",
      created_at: new Date().toISOString()
    };
    db.access_requests.unshift(accessReq);

    // Notify Super Admins / Managers
    const approvers = db.users.filter((u: any) => 
      u.role === "super_admin" || 
      u.role === "workspace_admin" || 
      (u.role === "department_manager" && (!department || u.department === department || u.department === "General"))
    );
    const targetApprovers = approvers.length > 0 ? approvers : [db.users[0]];

    targetApprovers.forEach((admin: any) => {
      let conv = db.conversations.find((c: any) => 
        c.type === "dm" && 
        (c.member_ids || []).includes(CIRCLE_BOT_ID) && 
        (c.member_ids || []).includes(admin.user_id)
      );

      if (!conv) {
        conv = {
          id: `conv_circle_${admin.user_id}`,
          type: "dm",
          name: "Circle (Workspace Assistant)",
          admin_ids: [],
          members: [CIRCLE_BOT_ID, admin.user_id],
          member_ids: [CIRCLE_BOT_ID, admin.user_id],
          unread: 1,
          last_message_preview: `Pendaftaran akun baru dari ${name}`,
          last_message_at: new Date().toISOString()
        };
        db.conversations.unshift(conv);
      } else {
        conv.unread = (conv.unread || 0) + 1;
        conv.last_message_preview = `Pendaftaran akun baru dari ${name}`;
        conv.last_message_at = new Date().toISOString();
      }

      const msg = {
        id: `msg_req_${reqId}_${admin.user_id}`,
        conversation_id: conv.id,
        sender_id: CIRCLE_BOT_ID,
        user_id: CIRCLE_BOT_ID,
        text: `Halo ${admin.name.split(' ')[0]}! Ada pendaftaran akun baru (${cleanEmail}) untuk divisi ${department || 'General'}. Silakan tinjau card approval di bawah ini:`,
        type: "access_request_card",
        access_request: accessReq,
        created_at: new Date().toISOString()
      };
      db.messages.push(msg);
      broadcast({ type: "message:new", data: msg });

      createNotification({
        user_id: admin.user_id,
        title: "Pendaftaran Akun Baru",
        body: `${name} (${cleanEmail}) mendaftar akun baru dan menunggu persetujuan Super Admin`,
        type: "access_request",
        category: "system",
        access_request: accessReq
      });
    });

    saveDbToFile();
    broadcast({ type: "access_requests:changed" });
    broadcast({ type: "conversations:changed" });

    res.json({
      success: true,
      status: "pending",
      detail: "Pendaftaran berhasil! Akun Anda sedang dalam proses peninjauan & approval oleh Super Admin."
    });
  });

  app.post("/api/auth/google", (req, res) => {
    const { email, name, picture } = req.body || {};
    if (!email) return res.status(400).json({ detail: "Email is required" });

    let user = db.users.find((u: any) => u.email?.toLowerCase() === email.toLowerCase());

    // Super admin default email whitelist
    const isSuperAdminEmail = email.toLowerCase() === "be.creativestudio21@gmail.com" || email.toLowerCase() === "admin@asliri.local" || email.toLowerCase() === "saeful@asliri.id";

    if (!user) {
      if (isSuperAdminEmail) {
        user = {
          user_id: `user_superadmin_google`,
          email,
          name: name || "Super Admin",
          role: "super_admin",
          job_title: "Workspace Administrator",
          department: "Engineering",
          online: true,
          is_demo: false,
          status: "active",
          avatar: picture || ""
        };
        db.users.push(user);
      } else {
        // Unknown email! Requires access request flow
        return res.status(403).json({
          status: "need_access_request",
          detail: "Email belum memiliki akses ke workspace ini. Silakan kirim permohonan akses.",
          email,
          name: name || "",
          picture: picture || ""
        });
      }
    } else if (user.status === "pending") {
      return res.status(403).json({
        status: "pending",
        detail: "Permintaan akses untuk akun Anda sedang ditinjau oleh Super Admin / Manager.",
        email,
        name: user.name
      });
    } else if (user.status === "inactive") {
      return res.status(403).json({
        status: "inactive",
        detail: "Akun Anda dinonaktifkan. Silakan hubungi Workspace Administrator."
      });
    }

    currentSessionUser = user;
    res.json({
      user,
      workspace: db.workspace,
      prefs: db.prefs[user.user_id] || { theme_mode: "light" }
    });
  });

  // 1. Submit Access Request
  app.post("/api/auth/request-access", (req, res) => {
    const { name, email, department, job_title, note } = req.body || {};
    if (!email || !name) {
      return res.status(400).json({ detail: "Nama dan email wajib diisi." });
    }

    const cleanEmail = email.toLowerCase().trim();
    const existingUser = db.users.find((u: any) => u.email?.toLowerCase() === cleanEmail);
    if (existingUser && existingUser.status === "active") {
      return res.status(400).json({ detail: "Email ini sudah memiliki akun aktif. Silakan langsung login." });
    }

    const existingReq = (db.access_requests || []).find((r: any) => r.email?.toLowerCase() === cleanEmail && r.status === "pending");
    if (existingReq) {
      return res.status(400).json({ detail: "Permintaan akses untuk email ini sudah diajukan dan sedang menunggu persetujuan." });
    }

    const reqId = `req_${Date.now()}`;
    const accessReq = {
      id: reqId,
      name: name.trim(),
      email: cleanEmail,
      department: department || "General",
      job_title: job_title || "Employee",
      note: note || "-",
      status: "pending",
      created_at: new Date().toISOString()
    };
    db.access_requests.unshift(accessReq);

    // Also register as pending user if not present
    if (!existingUser) {
      db.users.push({
        user_id: `user_${Date.now()}`,
        email: cleanEmail,
        name: name.trim(),
        role: "employee",
        job_title: job_title || "Employee",
        department: department || "General",
        status: "pending",
        online: false,
        is_demo: false,
        avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}`
      });
    } else {
      existingUser.status = "pending";
    }

    // "Circle" Assistant sends approval card message to Super Admins & Managers
    const approvers = db.users.filter((u: any) => 
      u.role === "super_admin" || 
      u.role === "workspace_admin" || 
      (u.role === "department_manager" && (!department || u.department === department || u.department === "General"))
    );
    const targetApprovers = approvers.length > 0 ? approvers : [db.users[0]];

    targetApprovers.forEach((admin: any) => {
      // Find or create DM with Circle Assistant
      let conv = db.conversations.find((c: any) => 
        c.type === "dm" && 
        (c.member_ids || []).includes(CIRCLE_BOT_ID) && 
        (c.member_ids || []).includes(admin.user_id)
      );

      if (!conv) {
        conv = {
          id: `conv_circle_${admin.user_id}`,
          type: "dm",
          name: "Circle (Workspace Assistant)",
          admin_ids: [],
          members: [CIRCLE_BOT_ID, admin.user_id],
          member_ids: [CIRCLE_BOT_ID, admin.user_id],
          unread: 1,
          last_message_preview: `Permintaan akses baru dari ${name}`,
          last_message_at: new Date().toISOString()
        };
        db.conversations.unshift(conv);
      } else {
        conv.unread = (conv.unread || 0) + 1;
        conv.last_message_preview = `Permintaan akses baru dari ${name}`;
        conv.last_message_at = new Date().toISOString();
      }

      const msg = {
        id: `msg_req_${reqId}_${admin.user_id}`,
        conversation_id: conv.id,
        sender_id: CIRCLE_BOT_ID,
        user_id: CIRCLE_BOT_ID,
        text: `Halo ${admin.name.split(' ')[0]}! Ada permohonan akses login baru ke workspace dari ${name} (${cleanEmail}) untuk divisi ${department || 'General'}. Silakan tinjau card approval di bawah ini:`,
        type: "access_request_card",
        access_request: accessReq,
        created_at: new Date().toISOString()
      };
      db.messages.push(msg);
      broadcast({ type: "message:new", data: msg });

      createNotification({
        user_id: admin.user_id,
        title: "Permintaan Akses Masuk Baru",
        body: `${name} (${department || 'General'}) mengajukan permohonan akses masuk`,
        type: "access_request",
        category: "system",
        access_request: accessReq
      });
    });

    saveDbToFile();
    broadcast({ type: "access_requests:changed" });
    broadcast({ type: "conversations:changed" });

    res.json({
      success: true,
      message: "Permintaan akses berhasil dikirim! Asisten Circle telah meneruskan ke Super Admin / Manager.",
      request_id: reqId
    });
  });

  // 2. Get Access Requests
  app.get("/api/admin/access-requests", (req, res) => {
    res.json(db.access_requests || []);
  });

  // 3. Approve Access Request
  app.post("/api/admin/access-requests/:id/approve", (req, res) => {
    const { role, department } = req.body || {};
    const accessReq = (db.access_requests || []).find((r: any) => r.id === req.params.id);
    if (!accessReq) return res.status(404).json({ detail: "Permintaan akses tidak ditemukan." });

    accessReq.status = "approved";
    accessReq.approved_by = currentSessionUser?.name || "Admin";
    accessReq.approved_at = new Date().toISOString();
    if (role) accessReq.assigned_role = role;
    if (department) accessReq.assigned_department = department;

    // Activate user in db.users
    let user = db.users.find((u: any) => u.email?.toLowerCase() === accessReq.email.toLowerCase());
    if (user) {
      user.status = "active";
      if (role) user.role = role;
      if (department) user.department = department;
    } else {
      user = {
        user_id: `user_${Date.now()}`,
        email: accessReq.email,
        name: accessReq.name,
        role: role || "employee",
        job_title: accessReq.job_title || "Employee",
        department: department || accessReq.department || "General",
        status: "active",
        online: true,
        is_demo: false,
        avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(accessReq.name)}`
      };
      db.users.push(user);
    }

    // Update all card messages in db.messages and broadcast update
    db.messages.forEach((m: any) => {
      if (m.access_request && m.access_request.id === accessReq.id) {
        m.access_request.status = "approved";
        m.access_request.approved_by = currentSessionUser?.name || "Admin";
        m.access_request.approved_at = accessReq.approved_at;
        m.access_request.assigned_role = role || accessReq.assigned_role;
        broadcast({ type: "message:update", data: m });
      }
    });

    saveDbToFile();
    broadcast({ type: "access_requests:changed" });
    broadcast({ type: "users:changed" });

    // Notify user of approval
    createNotification({
      user_id: user.user_id,
      title: "Selamat! Akses Kamu Telah Disetujui",
      body: `Permohonan akses kamu ke CIRCLE Workspace telah disetujui oleh Super Admin.`,
      type: "access_approved",
      category: "system"
    });

    res.json({ success: true, user, access_request: accessReq });
  });

  // 4. Reject Access Request
  app.post("/api/admin/access-requests/:id/reject", (req, res) => {
    const accessReq = (db.access_requests || []).find((r: any) => r.id === req.params.id);
    if (!accessReq) return res.status(404).json({ detail: "Permintaan akses tidak ditemukan." });

    accessReq.status = "rejected";
    accessReq.rejected_by = currentSessionUser?.name || "Admin";
    accessReq.rejected_at = new Date().toISOString();

    let user = db.users.find((u: any) => u.email?.toLowerCase() === accessReq.email.toLowerCase());
    if (user && user.status === "pending") {
      user.status = "inactive";
    }

    db.messages.forEach((m: any) => {
      if (m.access_request && m.access_request.id === accessReq.id) {
        m.access_request.status = "rejected";
        m.access_request.rejected_by = currentSessionUser?.name || "Admin";
        m.access_request.rejected_at = accessReq.rejected_at;
        broadcast({ type: "message:update", data: m });
      }
    });

    saveDbToFile();
    broadcast({ type: "access_requests:changed" });
    broadcast({ type: "users:changed" });

    res.json({ success: true, access_request: accessReq });
  });

  app.get("/api/auth/demo-users", (req, res) => {
    res.json({
      enabled: true,
      users: db.users.filter((u: any) => u.is_demo || u.role === "super_admin")
    });
  });

  app.post("/api/auth/demo", (req, res) => {
    const { user_id } = req.body;
    const user = db.users.find((u: any) => u.user_id === user_id);
    if (!user) return res.status(404).json({ detail: "User not found" });
    currentSessionUser = user;
    res.json({
      user,
      workspace: db.workspace,
      prefs: db.prefs[user.user_id] || { theme_mode: "light" }
    });
  });

  app.post("/api/auth/logout", (req, res) => {
    currentSessionUser = null;
    res.json({ success: true });
  });

  app.get("/api/users", (req, res) => {
    res.json(db.users);
  });

  app.get("/api/users/:id", (req, res) => {
    const user = db.users.find((u: any) => u.user_id === req.params.id);
    if (!user) return res.status(404).json({ detail: "User not found" });
    res.json(user);
  });

  app.patch("/api/users/:id", (req, res) => {
    let user = db.users.find((u: any) => u.user_id === req.params.id);
    if (!user && (req.params.id === "me" || currentSessionUser)) {
      user = db.users.find((u: any) => u.user_id === currentSessionUser?.user_id) || currentSessionUser || db.users[0];
    }
    if (!user) return res.status(404).json({ detail: "User not found" });
    if (req.body.avatar && !req.body.picture) req.body.picture = req.body.avatar;
    if (req.body.picture && !req.body.avatar) req.body.avatar = req.body.picture;
    Object.assign(user, req.body);
    if (currentSessionUser?.user_id === user.user_id) {
      currentSessionUser = { ...currentSessionUser, ...req.body };
    }
    saveDbToFile();
    broadcast({ type: "users:changed", user });
    res.json(user);
  });

  app.patch("/api/admin/users/:id", (req, res) => {
    const user = db.users.find((u: any) => u.user_id === req.params.id);
    if (!user) return res.status(404).json({ detail: "User not found" });
    Object.assign(user, req.body);
    if (currentSessionUser?.user_id === user.user_id) {
      currentSessionUser = { ...currentSessionUser, ...req.body };
    }
    saveDbToFile();
    broadcast({ type: "users:changed", user });
    res.json(user);
  });

  app.post("/api/me/onboarding", (req, res) => {
    if (currentSessionUser) {
      const wasFirstTime = !currentSessionUser.onboarded;
      Object.assign(currentSessionUser, req.body, { onboarded: true });
      const u = db.users.find((x: any) => x.user_id === currentSessionUser.user_id);
      if (u) Object.assign(u, req.body, { onboarded: true });

      if (wasFirstTime) {
        const botId = "user_circle_assistant";
        const userId = currentSessionUser.user_id;
        let conv = db.conversations.find((c: any) => 
          c.type === "dm" && 
          (c.member_ids || []).includes(botId) && 
          (c.member_ids || []).includes(userId)
        );
        if (!conv) {
          conv = {
            id: `conv_circle_${userId}`,
            type: "dm",
            name: "Circle (Workspace Assistant)",
            admin_ids: [],
            members: [botId, userId],
            member_ids: [botId, userId],
            unread: 1,
            last_message_preview: `Selamat datang di CIRCLE Workspace!`,
            last_message_at: new Date().toISOString()
          };
          db.conversations.unshift(conv);
        }
        const welcomeMsg = {
          id: `msg_welcome_${Date.now()}`,
          conversation_id: conv.id,
          sender_id: botId,
          user_id: botId,
          text: `Halo ${currentSessionUser.name.split(' ')[0]}! Selamat datang di CIRCLE Workspace 🎉\n\nProfil dan divisimu (${currentSessionUser.department || req.body.department || 'General'}) telah berhasil diatur. Kamu sekarang dapat:\n- Melihat tugas dan board di divisimu\n- Berkolaborasi dengan rekan kerja\n- Bertanya atau membuat tugas otomatis padaku kapan saja!\n\nSemoga harimu produktif!`,
          type: "text",
          created_at: new Date().toISOString()
        };
        db.messages.push(welcomeMsg);
        conv.last_message_preview = welcomeMsg.text;
        conv.last_message_at = welcomeMsg.created_at;
        broadcast({ type: "message:new", data: welcomeMsg });
        broadcast({ type: "conversations:changed" });
      }

      saveDbToFile();
      return res.json(currentSessionUser);
    }
    res.status(401).json({ detail: "Not authenticated" });
  });

  app.get("/api/labels", (req, res) => {
    res.json(db.labels);
  });

  app.post("/api/labels", (req, res) => {
    const { name, color, description } = req.body;
    const lbl = { id: `lbl_${Date.now()}`, name, color, description };
    db.labels.push(lbl);
    res.json(lbl);
  });

  app.patch("/api/labels/:id", (req, res) => {
    const l = db.labels.find((x: any) => x.id === req.params.id);
    if (l) Object.assign(l, req.body);
    res.json(l || { success: true });
  });

  app.delete("/api/labels/:id", (req, res) => {
    db.labels = db.labels.filter((l: any) => l.id !== req.params.id);
    res.json({ success: true });
  });

  app.get("/api/notifications", (req, res) => {
    const list = db.notifications || [];
    const myNotifs = list.filter((n: any) => n.user_id === currentSessionUser?.user_id);
    res.json({ 
      items: myNotifs, 
      unread: myNotifs.filter((n: any) => !n.read).length 
    });
  });

  app.post("/api/notifications/:id/read", (req, res) => {
    const n = (db.notifications || []).find((x: any) => x.id === req.params.id);
    if (n) n.read = true;
    res.json({ success: true });
  });

  app.post("/api/notifications/read-all", (req, res) => {
    (db.notifications || []).forEach((n: any) => {
      if (n.user_id === currentSessionUser?.user_id) n.read = true;
    });
    res.json({ success: true });
  });

  app.post("/api/notifications/test", (req, res) => {
    const userId = currentSessionUser?.user_id || "user_admin1";
    const mode = req.body?.mode || "access_request"; // access_request, message, task

    let notif: any;
    if (mode === "access_request") {
      const demoReq = {
        id: `req_test_${Date.now()}`,
        name: "Jessica Iskandar",
        email: "jessica@asliri.id",
        department: "Marketing",
        job_title: "Brand Specialist",
        note: "Permohonan akses internal divisi Marketing untuk monitoring campaign.",
        status: "pending",
        created_at: new Date().toISOString()
      };
      if (!Array.isArray(db.access_requests)) db.access_requests = [];
      db.access_requests.unshift(demoReq);

      notif = createNotification({
        user_id: userId,
        title: "Permintaan Akses Masuk Baru",
        body: `${demoReq.name} (${demoReq.department}) mengajukan permohonan akses masuk`,
        type: "access_request",
        category: "system",
        access_request: demoReq
      });
    } else if (mode === "message") {
      notif = createNotification({
        user_id: userId,
        title: "Pesan Baru dari Saeful",
        body: "Halo! Apakah dokumen spesifikasi proyek sudah siap di-review?",
        type: "dm",
        category: "messages",
        conversation_id: "conv_circle_user_admin1",
        actor_id: "user_superadmin_saeful"
      });
    } else {
      notif = createNotification({
        user_id: userId,
        title: "Tugas Baru Ditugaskan",
        body: "Saeful menugaskan 'Review Dokumen Desain UI/UX' kepadamu.",
        type: "task_assigned",
        category: "tasks",
        task_id: "",
        actor_id: "user_superadmin_saeful"
      });
    }

    saveDbToFile();
    res.json({ success: true, notif });
  });

  // Auto-Archive Function: Kartu yang berstatus 'done' langsung di-auto-archive tiap minggu jam 23.00 WIB
  function autoArchiveCheck() {
    const now = new Date();
    // Convert to WIB (UTC+7)
    const utcMs = now.getTime() + (now.getTimezoneOffset() * 60000);
    const wibDate = new Date(utcMs + (7 * 3600000));
    const day = wibDate.getDay(); // 0 is Sunday
    const hour = wibDate.getHours();

    // Check done cards. If it's Sunday 23:00 WIB or card was completed prior to the last Sunday 23:00 WIB, archive it.
    let count = 0;
    db.tasks.forEach((t: any) => {
      if (t.status === "done" && !t.archived) {
        // If completed date exists and has passed the weekly archive cut-off
        const completedAt = t.completed_at ? new Date(t.completed_at) : (t.updated_at ? new Date(t.updated_at) : now);
        const compUtc = completedAt.getTime() + (completedAt.getTimezoneOffset() * 60000);
        const compWib = new Date(compUtc + (7 * 3600000));
        
        // Sunday 23:00 WIB trigger or older done task
        const isSundayPast23 = day === 0 && hour >= 23;
        const isPastWeek = (now.getTime() - completedAt.getTime()) > (86400000 * 3);

        if (isSundayPast23 || isPastWeek) {
          t.archived = true;
          t.archived_at = t.archived_at || now.toISOString();
          t.archived_month = t.archived_month || completedAt.toISOString().slice(0, 7);
          count++;
        }
      }
    });
    return count;
  }

  app.get("/api/tasks", (req, res) => {
    autoArchiveCheck();
    let list = [...db.tasks];
    const { view, project_id, board_id, assignee_id, priority, label, department, q, month, archived } = req.query;

    const isArchiveView = view === "archived" || archived === "true";

    const isTaskAssignedToUser = (t: any, uid: string) => {
      if (!uid) return false;
      if (Array.isArray(t.assignee_ids) && t.assignee_ids.includes(uid)) return true;
      if (t.assignee_id === uid) return true;
      return false;
    };

    if (isArchiveView) {
      list = list.filter((t: any) => t.archived === true);
    } else {
      list = list.filter((t: any) => !t.archived);
      if (view === "active") list = list.filter((t: any) => t.status !== "done");
      if (view === "completed") list = list.filter((t: any) => t.status === "done");
      if (view === "my" || view === "assigned") list = list.filter((t: any) => isTaskAssignedToUser(t, currentSessionUser?.user_id));
      if (view === "requested") list = list.filter((t: any) => t.created_by === currentSessionUser?.user_id);
      if (view === "today") {
        const todayStr = new Date().toISOString().slice(0, 10);
        list = list.filter((t: any) => t.deadline && t.deadline.slice(0, 10) === todayStr);
      }
      if (view === "overdue") {
        const now = new Date();
        list = list.filter((t: any) => t.status !== "done" && t.deadline && new Date(t.deadline) < now);
      }
    }

    if (project_id) list = list.filter((t: any) => t.project_id === project_id);
    if (board_id) list = list.filter((t: any) => t.board_id === board_id);
    if (assignee_id) list = list.filter((t: any) => isTaskAssignedToUser(t, String(assignee_id)));
    if (priority) list = list.filter((t: any) => (t.priority || "").toLowerCase() === String(priority).toLowerCase());
    if (label) list = list.filter((t: any) => (t.label_ids || []).includes(label));
    if (department) list = list.filter((t: any) => t.department === department);
    if (month) list = list.filter((t: any) => (t.archived_month || (t.archived_at || t.completed_at || "").slice(0, 7)) === month);

    if (q) {
      const query = String(q).toLowerCase();
      list = list.filter((t: any) => 
        (t.title || "").toLowerCase().includes(query) ||
        (t.description || "").toLowerCase().includes(query) ||
        (t.number_str || "").toLowerCase().includes(query)
      );
    }

    // Access control: Non-super_admin users only see tasks from accessible boards
    const user = currentSessionUser;
    if (user && user.role !== "super_admin" && user.role !== "workspace_admin") {
      const accessibleBoardIds = new Set(
        (db.boards || [])
          .filter((b: any) => {
            if (!b.department || b.department === "Semua Divisi" || b.department === "General" || b.department === "All") return true;
            if (user.department && b.department.toLowerCase() === user.department.toLowerCase()) return true;
            if (Array.isArray(b.member_ids) && b.member_ids.includes(user.user_id)) return true;
            return false;
          })
          .map((b: any) => b.id)
      );
      list = list.filter((t: any) => !t.board_id || accessibleBoardIds.has(t.board_id));
    }

    res.json(list);
  });

  app.post("/api/tasks", (req, res) => {
    const taskNum = `TSK-${String(db.tasks.length + 1).padStart(3, '0')}`;
    const reqIds = req.body.requestor_ids || [currentSessionUser?.user_id || "user_admin1"];
    const cps = req.body.checkpoints || [];
    const doneCount = cps.filter((c: any) => c.done).length;
    const progress = cps.length > 0 ? Math.round((doneCount / cps.length) * 100) : (req.body.progress ?? (req.body.status === "done" ? 100 : 0));

    // Normalize assignee_ids and assignee_id
    let assigneeIds = Array.isArray(req.body.assignee_ids) ? [...req.body.assignee_ids] : [];
    if (req.body.assignee_id && !assigneeIds.includes(req.body.assignee_id)) {
      assigneeIds.unshift(req.body.assignee_id);
    }
    assigneeIds = assigneeIds.filter(Boolean);
    const primaryAssigneeId = assigneeIds[0] || null;

    const creatorId = currentSessionUser?.user_id || "user_admin1";
    const initAct = {
      id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      actor_id: creatorId,
      action: `membuat tugas baru "${req.body.title || taskNum}"`,
      detail: req.body.description ? `Brief awal: "${String(req.body.description).replace(/<[^>]*>?/gm, "").trim().slice(0, 120)}"` : undefined,
      task_id: `tsk_${Date.now()}`,
      task_title: req.body.title,
      created_at: new Date().toISOString()
    };

    const validStatuses = (db.workspace?.task_statuses || []).map((s: any) => s.key);
    const resolvedStatus = req.body.status && (validStatuses.length === 0 || validStatuses.includes(req.body.status))
      ? req.body.status
      : (validStatuses[0] || "todo");
    const resolvedBoardId = req.body.board_id || db.boards?.[0]?.id || "brd_1";

    const t = {
      id: initAct.task_id,
      number_str: taskNum,
      comments: [],
      subtasks: [],
      attachments: [],
      checkpoints: cps,
      activity: [initAct],
      progress,
      archived: false,
      created_by: creatorId,
      requestor_ids: reqIds,
      reviewer_ids: reqIds, // Reviewer otomatis sama dengan requestor
      approvals: {
        needed: 2,
        approved_by: [],
        status: "pending"
      },
      ...req.body,
      status: resolvedStatus,
      priority: req.body.priority || "medium",
      board_id: resolvedBoardId,
      assignee_id: primaryAssigneeId,
      assignee_ids: assigneeIds,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    if (!Array.isArray(t.activity) || t.activity.length === 0) {
      t.activity = [initAct];
    }
    db.tasks.unshift(t);
    db.activity.unshift(initAct);
    db.audit_logs.unshift({
      id: `log_${Date.now()}`,
      actor_id: creatorId,
      actor_name: currentSessionUser?.name || "User",
      action: `membuat tugas baru: ${t.number_str} - ${t.title}`,
      created_at: new Date().toISOString()
    });
    saveDbToFile();
    broadcast({ type: "tasks:changed", task: t });

    // Notify all assigned users
    assigneeIds.forEach((uid: string) => {
      if (uid && uid !== currentSessionUser?.user_id) {
        createNotification({
          user_id: uid,
          title: "Tugas Baru Ditugaskan",
          body: `${currentSessionUser?.name || "Seseorang"} menugaskan "${t.title}" kepadamu.`,
          type: "task_assigned",
          category: "tasks",
          actor_id: currentSessionUser?.user_id,
          link: `/tasks?task=${t.id}`,
          task_id: t.id
        });
      }
    });

    res.json(t);
  });

  // CSV & JSON Task Import Endpoint
  const handleTaskImport = (req: any, res: any) => {
    let items = req.body;
    if (items && !Array.isArray(items) && Array.isArray(items.items)) {
      items = items.items;
    }
    if (items && !Array.isArray(items) && Array.isArray(items.tasks)) {
      items = items.tasks;
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ detail: "Tidak ada data task yang valid untuk diimport." });
    }
    const createdList: any[] = [];
    items.forEach((item, idx) => {
      if (!item || !item.title || !String(item.title).trim()) return;
      const taskNum = item.number_str || `TSK-${String(db.tasks.length + 1).padStart(3, '0')}`;
      const reqIds = item.requestor_ids || [currentSessionUser?.user_id || "user_admin1"];
      const t = {
        id: `tsk_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
        number_str: taskNum,
        title: String(item.title).trim(),
        description: item.description || "",
        status: item.status || "todo",
        priority: item.priority || "medium",
        assignee_id: (Array.isArray(item.assignee_ids) && item.assignee_ids[0]) || item.assignee_id || currentSessionUser?.user_id || "user_admin1",
        assignee_ids: Array.isArray(item.assignee_ids) && item.assignee_ids.length ? item.assignee_ids : [item.assignee_id || currentSessionUser?.user_id || "user_admin1"],
        board_id: item.board_id || "brd_1",
        project_id: item.project_id || null,
        label_ids: Array.isArray(item.label_ids) ? item.label_ids : ["lbl_1"],
        deadline: item.deadline || new Date(Date.now() + 86400000 * 3).toISOString(),
        requestor_ids: reqIds,
        reviewer_ids: reqIds,
        approvals: { needed: 2, approved_by: [], status: "pending" },
        checkpoints: Array.isArray(item.checkpoints) ? item.checkpoints : [],
        progress: item.progress || 0,
        archived: false,
        comments: [],
        subtasks: [],
        attachments: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      db.tasks.unshift(t);
      createdList.push(t);
    });

    db.audit_logs.unshift({
      id: `log_${Date.now()}`,
      actor_id: currentSessionUser?.user_id || "user_admin1",
      actor_name: currentSessionUser?.name || "User",
      action: `mengimpor ${createdList.length} kartu tugas`,
      created_at: new Date().toISOString()
    });

    saveDbToFile();
    broadcast({ type: "tasks:changed" });
    res.json({ success: true, count: createdList.length, tasks: createdList });
  };

  app.post("/api/tasks/import-csv", handleTaskImport);
  app.post("/api/tasks/import", handleTaskImport);

  // Manual Trigger or Periodic Auto-Archive endpoint
  app.post("/api/tasks/auto-archive", (req, res) => {
    const now = new Date();
    let archivedCount = 0;
    db.tasks.forEach((t: any) => {
      if (t.status === "done" && !t.archived) {
        t.archived = true;
        t.archived_at = t.archived_at || now.toISOString();
        t.archived_month = t.archived_month || now.toISOString().slice(0, 7);
        archivedCount++;
      }
    });
    broadcast({ type: "tasks:changed" });
    res.json({
      success: true,
      message: `Auto-archive mingguan berhasil dijalankan. ${archivedCount} kartu done diarsipkan.`,
      archived_count: archivedCount,
      schedule: "Setiap Minggu pukul 23:00 WIB"
    });
  });

  app.post("/api/tasks/bulk", (req, res) => {
    const { ids, patch } = req.body;
    let updated = 0;
    if (Array.isArray(ids)) {
      ids.forEach((id: string) => {
        const t = db.tasks.find((x: any) => x.id === id);
        if (t) {
          if (patch.assignee_id && !patch.assignee_ids) {
            patch.assignee_ids = [patch.assignee_id];
          } else if (patch.assignee_ids && !patch.assignee_id) {
            patch.assignee_id = patch.assignee_ids[0] || null;
          }
          Object.assign(t, patch);
          if (patch.archived) {
            t.archived_at = t.archived_at || new Date().toISOString();
            t.archived_month = t.archived_month || new Date().toISOString().slice(0, 7);
          }
          t.updated_at = new Date().toISOString();
          updated++;
        }
      });
    }
    saveDbToFile();
    broadcast({ type: "tasks:changed" });
    res.json({ updated });
  });

  app.get("/api/tasks/export", (req, res) => {
    const list = db.tasks.filter((t: any) => !t.archived);
    res.setHeader("X-Record-Count", list.length);
    if (req.query.format === "json") {
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Content-Disposition", 'attachment; filename="circle-tasks.json"');
      return res.send(JSON.stringify(list, null, 2));
    }
    const headers = "ID,Number,Title,Status,Priority,Assignee,Deadline\n";
    const rows = list.map((t: any) => `"${t.id}","${t.number_str || ''}","${(t.title || '').replace(/"/g, '""')}","${t.status}","${t.priority}","${t.assignee_id || ''}","${t.deadline || ''}"`).join("\n");
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", 'attachment; filename="circle-tasks.csv"');
    res.send(headers + rows);
  });

  app.get("/api/tasks/:id", (req, res) => {
    const t = db.tasks.find((x: any) => x.id === req.params.id);
    if (!t) return res.status(404).json({ detail: "Task not found" });
    const board = db.boards?.find((b: any) => b.id === t.board_id) || db.boards?.[0] || null;
    res.json({ ...t, board });
  });

  app.patch("/api/tasks/:id", (req, res) => {
    const t = db.tasks.find((x: any) => x.id === req.params.id);
    if (!t) return res.status(404).json({ detail: "Task not found" });

    const actorId = currentSessionUser?.user_id || "user_admin1";
    const actorName = currentSessionUser?.name || "User";
    const getUserName = (uid: string | null | undefined) => {
      if (!uid) return "Unassigned";
      return db.users.find((u: any) => u.user_id === uid)?.name || uid;
    };
    const getStatusName = (key: string | null | undefined) => {
      if (!key) return "—";
      return db.statuses?.find((s: any) => s.key === key)?.name || key;
    };
    const getBoardName = (bid: string | null | undefined) => {
      if (!bid) return "—";
      return db.boards?.find((b: any) => b.id === bid)?.name || bid;
    };
    const getProjectName = (pid: string | null | undefined) => {
      if (!pid) return "No project";
      return db.projects?.find((p: any) => p.id === pid)?.name || pid;
    };
    const getLabelNames = (lids: string[] | undefined) => {
      if (!Array.isArray(lids) || !lids.length) return "Kosong";
      return lids.map((id) => db.labels?.find((l: any) => l.id === id)?.name || id).join(", ");
    };
    const stripHtml = (html: string | undefined | null) => String(html || "").replace(/<[^>]*>?/gm, "").trim();

    const recordTaskActivity = (action: string, detail?: string, changes?: { field?: string; from?: any; to?: any }) => {
      const nowIso = new Date().toISOString();
      const act = {
        id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        actor_id: actorId,
        action,
        detail,
        changes,
        task_id: t.id,
        task_title: t.title,
        created_at: nowIso
      };
      t.activity = Array.isArray(t.activity) ? t.activity : [];
      t.activity.unshift(act);
      db.activity.unshift(act);
      db.audit_logs.unshift({
        id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        actor_id: actorId,
        actor_name: actorName,
        action: `${action} (${t.number_str || t.title})${detail ? ` — ${detail}` : ""}`,
        created_at: nowIso
      });
    };

    // Reviewer otomatis sinkron dengan requestor
    if (req.body.requestor_ids) {
      req.body.reviewer_ids = req.body.requestor_ids;
    }

    // 1. Title change
    if (req.body.title !== undefined && req.body.title !== t.title) {
      recordTaskActivity(
        `mengubah judul tugas`,
        `Dari "${t.title || "—"}" menjadi "${req.body.title}"`,
        { field: "title", from: t.title, to: req.body.title }
      );
    }

    // 2. Brief / Description change
    if (req.body.description !== undefined && req.body.description !== t.description) {
      const oldBrief = stripHtml(t.description);
      const newBrief = stripHtml(req.body.description);
      if (oldBrief !== newBrief) {
        const summaryText = newBrief
          ? (oldBrief ? `Dari: "${oldBrief.slice(0, 100)}${oldBrief.length > 100 ? "…" : ""}" → Menjadi: "${newBrief.slice(0, 140)}${newBrief.length > 140 ? "…" : ""}"` : `Isi brief: "${newBrief.slice(0, 150)}${newBrief.length > 150 ? "…" : ""}"`)
          : "Brief dikosongkan";
        recordTaskActivity(
          oldBrief ? `mengubah brief tugas` : `menulis brief tugas`,
          summaryText,
          { field: "description", from: oldBrief || "Kosong", to: newBrief || "Kosong" }
        );
      }
    }

    // 3. Status change
    if (req.body.status !== undefined && req.body.status !== t.status) {
      recordTaskActivity(
        `mengubah status tugas dari "${getStatusName(t.status)}" ke "${getStatusName(req.body.status)}"`,
        undefined,
        { field: "status", from: getStatusName(t.status), to: getStatusName(req.body.status) }
      );
    }

    // 4. Priority change
    if (req.body.priority !== undefined && req.body.priority !== t.priority) {
      recordTaskActivity(
        `mengubah prioritas tugas dari "${t.priority || "medium"}" ke "${req.body.priority}"`,
        undefined,
        { field: "priority", from: t.priority, to: req.body.priority }
      );
    }

    // 5. Board change
    if (req.body.board_id !== undefined && req.body.board_id !== t.board_id) {
      recordTaskActivity(
        `memindahkan tugas dari board "${getBoardName(t.board_id)}" ke "${getBoardName(req.body.board_id)}"`,
        undefined,
        { field: "board_id", from: getBoardName(t.board_id), to: getBoardName(req.body.board_id) }
      );
    }

    // 6. Project change
    if (req.body.project_id !== undefined && req.body.project_id !== t.project_id) {
      recordTaskActivity(
        `mengubah project dari "${getProjectName(t.project_id)}" ke "${getProjectName(req.body.project_id)}"`,
        undefined,
        { field: "project_id", from: getProjectName(t.project_id), to: getProjectName(req.body.project_id) }
      );
    }

    // 7. Department change
    if (req.body.department !== undefined && req.body.department !== (t.department || "")) {
      recordTaskActivity(
        `mengubah departemen dari "${t.department || "Kosong"}" ke "${req.body.department || "Kosong"}"`,
        undefined,
        { field: "department", from: t.department || "Kosong", to: req.body.department || "Kosong" }
      );
    }

    // 8. Item type change
    if (req.body.item_type !== undefined && req.body.item_type !== (t.item_type || "")) {
      recordTaskActivity(
        `mengubah tipe item dari "${t.item_type || "Kosong"}" ke "${req.body.item_type || "Kosong"}"`,
        undefined,
        { field: "item_type", from: t.item_type || "Kosong", to: req.body.item_type || "Kosong" }
      );
    }

    // 9. Link file/folder change
    if (req.body.link_url !== undefined && req.body.link_url !== (t.link_url || "")) {
      recordTaskActivity(
        req.body.link_url ? `memperbarui link file/folder` : `menghapus link file/folder`,
        req.body.link_url ? `Link: ${req.body.link_url}` : `Sebelumnya: ${t.link_url}`,
        { field: "link_url", from: t.link_url || "Kosong", to: req.body.link_url || "Kosong" }
      );
    }

    // 10. Deadline change
    if (req.body.deadline !== undefined && req.body.deadline !== t.deadline) {
      const oldDl = t.deadline ? String(t.deadline).slice(0, 16).replace("T", " ") : "Kosong";
      const newDl = req.body.deadline ? String(req.body.deadline).slice(0, 16).replace("T", " ") : "Kosong";
      recordTaskActivity(
        `mengubah tenggat waktu (deadline) dari "${oldDl}" ke "${newDl}"`,
        undefined,
        { field: "deadline", from: oldDl, to: newDl }
      );
    }

    // 11. Start date change
    if (req.body.start_date !== undefined && req.body.start_date !== (t.start_date || null)) {
      recordTaskActivity(
        `mengubah tanggal mulai (start date) dari "${t.start_date || "Kosong"}" ke "${req.body.start_date || "Kosong"}"`,
        undefined,
        { field: "start_date", from: t.start_date || "Kosong", to: req.body.start_date || "Kosong" }
      );
    }

    // 12. Submit date change
    if (req.body.submit_date !== undefined && req.body.submit_date !== (t.submit_date || null)) {
      recordTaskActivity(
        `mengubah tanggal submit dari "${t.submit_date || "Kosong"}" ke "${req.body.submit_date || "Kosong"}"`,
        undefined,
        { field: "submit_date", from: t.submit_date || "Kosong", to: req.body.submit_date || "Kosong" }
      );
    }

    // 13. IP / Brand labels change
    if (Array.isArray(req.body.label_ids)) {
      const oldL = JSON.stringify([...(t.label_ids || [])].sort());
      const newL = JSON.stringify([...req.body.label_ids].sort());
      if (oldL !== newL) {
        recordTaskActivity(
          `mengubah IP / Brand label`,
          `Dari [${getLabelNames(t.label_ids)}] menjadi [${getLabelNames(req.body.label_ids)}]`,
          { field: "label_ids", from: getLabelNames(t.label_ids), to: getLabelNames(req.body.label_ids) }
        );
      }
    }

    // 14. Card color / style change
    if (req.body.card_color !== undefined && req.body.card_color !== t.card_color) {
      recordTaskActivity(
        req.body.card_color ? `mengubah warna kartu menjadi ${req.body.card_color}` : `mereset warna kartu`,
        undefined,
        { field: "card_color", from: t.card_color || "Default", to: req.body.card_color || "Default" }
      );
    }
    if (req.body.card_style !== undefined && req.body.card_style !== t.card_style) {
      recordTaskActivity(
        `mengubah gaya tampilan warna kartu ke "${req.body.card_style}"`,
        undefined,
        { field: "card_style", from: t.card_style || "bar", to: req.body.card_style }
      );
    }

    // 15. Requestor / Reviewer change
    if (Array.isArray(req.body.requestor_ids)) {
      const oldReq = (t.requestor_ids || []).map(getUserName).join(", ") || "Kosong";
      const newReq = req.body.requestor_ids.map(getUserName).join(", ") || "Kosong";
      if (oldReq !== newReq) {
        recordTaskActivity(
          `memperbarui daftar Requestor & Reviewer`,
          `Dari [${oldReq}] menjadi [${newReq}]`,
          { field: "requestor_ids", from: oldReq, to: newReq }
        );
      }
    }

    // 16. Attachments change
    if (Array.isArray(req.body.attachments)) {
      const oldAtt = t.attachments || [];
      const newAtt = req.body.attachments;
      if (newAtt.length > oldAtt.length) {
        const added = newAtt.filter((na: any) => !oldAtt.some((oa: any) => oa.id === na.id));
        const names = added.map((a: any) => a.name || "File").join(", ");
        recordTaskActivity(`menambahkan lampiran file "${names}"`, `Total lampiran: ${newAtt.length}`);
      } else if (newAtt.length < oldAtt.length) {
        const removed = oldAtt.filter((oa: any) => !newAtt.some((na: any) => na.id === oa.id));
        const names = removed.map((a: any) => a.name || "File").join(", ");
        recordTaskActivity(`menghapus lampiran file "${names}"`, `Total lampiran: ${newAtt.length}`);
      }
    }

    // 17. Checkpoint granular tracking (add, delete, rename, PIC change, done/undone)
    if (Array.isArray(req.body.checkpoints)) {
      const oldCheckpoints = t.checkpoints || [];
      const newCheckpoints = req.body.checkpoints;

      // Added checkpoints
      const addedCps = newCheckpoints.filter((nc: any) => !oldCheckpoints.some((oc: any) => oc.id === nc.id));
      if (addedCps.length === 1) {
        recordTaskActivity(
          `menambahkan checkpoint baru "${addedCps[0].title || 'Checkpoint'}"`,
          addedCps[0].assignee_id ? `PIC: ${getUserName(addedCps[0].assignee_id)}` : undefined
        );
      } else if (addedCps.length > 1) {
        recordTaskActivity(
          `menambahkan ${addedCps.length} checkpoint baru`,
          addedCps.map((c: any) => c.title).join(", ")
        );
      }

      // Removed checkpoints
      const removedCps = oldCheckpoints.filter((oc: any) => !newCheckpoints.some((nc: any) => nc.id === oc.id));
      removedCps.forEach((rc: any) => {
        recordTaskActivity(`menghapus checkpoint "${rc.title || 'Checkpoint'}"`);
      });

      // Modified existing checkpoints
      newCheckpoints.forEach((newCp: any) => {
        const oldCp = oldCheckpoints.find((c: any) => c.id === newCp.id);
        if (!oldCp) return;

        if (newCp.done && !oldCp.done) {
          recordTaskActivity(`menyelesaikan checkpoint "${newCp.title || 'Poin Checklist'}" pada tugas`);
        } else if (!newCp.done && oldCp.done) {
          recordTaskActivity(`membuka kembali (uncheck) checkpoint "${newCp.title || 'Poin Checklist'}"`);
        }

        if (newCp.title !== oldCp.title) {
          recordTaskActivity(
            `mengubah nama checkpoint`,
            `Dari "${oldCp.title}" menjadi "${newCp.title}"`,
            { field: "checkpoint_title", from: oldCp.title, to: newCp.title }
          );
        }

        if ((newCp.assignee_id || null) !== (oldCp.assignee_id || null)) {
          recordTaskActivity(
            `mengubah PIC checkpoint "${newCp.title}"`,
            `Dari ${getUserName(oldCp.assignee_id)} ke ${getUserName(newCp.assignee_id)}`,
            { field: "checkpoint_pic", from: getUserName(oldCp.assignee_id), to: getUserName(newCp.assignee_id) }
          );
        }
      });

      // Recalculate progress percentage
      const doneTotal = newCheckpoints.filter((c: any) => c.done).length;
      req.body.progress = newCheckpoints.length > 0 ? Math.round((doneTotal / newCheckpoints.length) * 100) : (t.status === "done" ? 100 : 0);
    }
    
    // If status changed to done, mark completed_at and progress 100
    if (req.body.status === "done" && t.status !== "done") {
      req.body.completed_at = new Date().toISOString();
      if (!req.body.checkpoints) req.body.progress = 100;
    }
    // Archive / Unarchive tracking
    if (req.body.archived === false && t.archived === true) {
      t.archived = false;
      recordTaskActivity(`memulihkan (unarchive) tugas kembali ke board aktif`);
    }
    if (req.body.archived === true && !t.archived) {
      t.archived = true;
      t.archived_at = t.archived_at || new Date().toISOString();
      t.archived_month = t.archived_month || new Date().toISOString().slice(0, 7);
      recordTaskActivity(`mengarsipkan tugas ke folder ${t.archived_month}`);
    }

    const oldAssignees: string[] = Array.isArray(t.assignee_ids) && t.assignee_ids.length ? t.assignee_ids : (t.assignee_id ? [t.assignee_id] : []);
    if (Array.isArray(req.body.assignee_ids)) {
      req.body.assignee_ids = req.body.assignee_ids.filter(Boolean);
      req.body.assignee_id = req.body.assignee_ids[0] || null;
    } else if (req.body.assignee_id !== undefined && !req.body.assignee_ids) {
      req.body.assignee_ids = req.body.assignee_id ? [req.body.assignee_id] : [];
    }

    if (req.body.assignee_ids !== undefined) {
      const oldNames = oldAssignees.map(getUserName).join(", ") || "Unassigned";
      const newNames = (req.body.assignee_ids || []).map(getUserName).join(", ") || "Unassigned";
      if (oldNames !== newNames) {
        recordTaskActivity(
          `mengubah Assignee tugas`,
          `Dari [${oldNames}] menjadi [${newNames}]`,
          { field: "assignee_ids", from: oldNames, to: newNames }
        );
      }
    }

    const oldStatus = t.status;
    req.body.updated_at = new Date().toISOString();
    Object.assign(t, req.body);

    // Notify newly assigned users
    if (Array.isArray(t.assignee_ids)) {
      const newlyAssigned = t.assignee_ids.filter((uid: string) => !oldAssignees.includes(uid));
      newlyAssigned.forEach((userId: string) => {
        if (userId !== currentSessionUser?.user_id) {
          createNotification({
            user_id: userId,
            title: "Tugas Ditugaskan Kepadamu",
            body: `${currentSessionUser?.name || "Seseorang"} menugaskan "${t.title}" kepadamu.`,
            type: "task_assigned",
            category: "tasks",
            actor_id: currentSessionUser?.user_id,
            link: `/tasks?task=${t.id}`,
            task_id: t.id
          });
        }
      });
    }
    
    // Notify requestors if status changed
    if (req.body.status && req.body.status !== oldStatus) {
      const requestors = Array.isArray(t.requestor_ids) ? t.requestor_ids : [t.created_by];
      requestors.forEach((userId: string) => {
        if (userId === currentSessionUser?.user_id) return;
        createNotification({
          user_id: userId,
          title: "Update Status Tugas",
          body: `Status "${t.title}" berubah menjadi ${t.status}.`,
          type: "task_status",
          category: "tasks",
          actor_id: currentSessionUser?.user_id,
          link: `/tasks?id=${t.id}`,
          task_id: t.id
        });
      });
    }

    saveDbToFile();
    broadcast({ type: "tasks:changed", task: t });
    const board = db.boards?.find((b: any) => b.id === t.board_id) || db.boards?.[0] || null;
    res.json({ ...t, board });
  });

  app.delete("/api/tasks/:id", (req, res) => {
    const idx = db.tasks.findIndex((x: any) => x.id === req.params.id);
    if (idx === -1) return res.status(404).json({ detail: "Task not found" });
    const deleted = db.tasks.splice(idx, 1)[0];
    saveDbToFile();
    broadcast({ type: "tasks:changed", deleted_id: req.params.id });
    res.json({ success: true, task: deleted });
  });

  app.post("/api/tasks/:id/comments", (req, res) => {
    const t = db.tasks.find((x: any) => x.id === req.params.id);
    if (!t) return res.status(404).json({ detail: "Task not found" });
    t.comments = t.comments || [];
    const actorId = currentSessionUser?.user_id || "user_admin1";
    const c = {
      id: `cmt_${Date.now()}`,
      user_id: actorId,
      author_id: actorId,
      ...req.body,
      created_at: new Date().toISOString()
    };
    t.comments.push(c);

    const cp = c.checkpoint_id ? (t.checkpoints || []).find((x: any) => x.id === c.checkpoint_id) : null;
    const isIssue = c.kind === "issue";
    const act = {
      id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      actor_id: actorId,
      action: isIssue
        ? `melaporkan kendala${cp ? ` pada checkpoint "${cp.title}"` : ""}`
        : `menambahkan komentar${cp ? ` pada checkpoint "${cp.title}"` : ""}`,
      detail: c.text ? `"${String(c.text).slice(0, 140)}"` : undefined,
      task_id: t.id,
      task_title: t.title,
      created_at: new Date().toISOString()
    };
    t.activity = Array.isArray(t.activity) ? t.activity : [];
    t.activity.unshift(act);
    db.activity.unshift(act);

    // Notify task creator and assignee
    const usersToNotify = new Set([t.created_by, t.assignee_id].filter(id => id && id !== actorId));
    usersToNotify.forEach(userId => {
      createNotification({
        user_id: userId as string,
        title: isIssue ? "Kendala Dilaporkan pada Tugas" : "Komentar Baru pada Tugas",
        body: `${currentSessionUser?.name || "Seseorang"} berkomentar di "${t.title}": ${c.text || "Pesan"}`,
        type: "task_comment",
        category: "tasks",
        actor_id: actorId,
        link: `/tasks?id=${t.id}`,
        task_id: t.id
      });
    });

    broadcast({ type: "tasks:changed", task: t });
    res.json(c);
  });

  app.patch("/api/tasks/:id/comments/:commentId", (req, res) => {
    const t = db.tasks.find((x: any) => x.id === req.params.id);
    if (!t) return res.status(404).json({ detail: "Task not found" });
    const c = (t.comments || []).find((x: any) => x.id === req.params.commentId);
    if (!c) return res.status(404).json({ detail: "Comment not found" });

    const actorId = currentSessionUser?.user_id || "user_admin1";
    Object.assign(c, req.body);

    const cp = c.checkpoint_id ? (t.checkpoints || []).find((x: any) => x.id === c.checkpoint_id) : null;
    if (req.body.resolved !== undefined) {
      const act = {
        id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        actor_id: actorId,
        action: req.body.resolved
          ? `menandai kendala selesai${cp ? ` pada checkpoint "${cp.title}"` : ""}`
          : `membuka kembali kendala${cp ? ` pada checkpoint "${cp.title}"` : ""}`,
        detail: c.text ? `"${String(c.text).slice(0, 120)}"` : undefined,
        task_id: t.id,
        task_title: t.title,
        created_at: new Date().toISOString()
      };
      t.activity = Array.isArray(t.activity) ? t.activity : [];
      t.activity.unshift(act);
      db.activity.unshift(act);
    }

    broadcast({ type: "tasks:changed", task: t });
    res.json(c);
  });


  app.get("/api/projects", (req, res) => {
    const list = db.projects.map((p: any) => {
      const tasks = db.tasks.filter((t: any) => t.project_id === p.id);
      const task_done = tasks.filter((t: any) => t.status === "done").length;
      const task_total = tasks.length;
      const progress = task_total > 0 ? Math.round((task_done / task_total) * 100) : (p.progress || 0);
      return {
        ...p,
        member_ids: p.member_ids || [],
        label_ids: p.label_ids || [],
        status: p.status || "active",
        task_done,
        task_total,
        progress
      };
    });
    res.json(list);
  });

  app.get("/api/projects/:id", (req, res) => {
    const p = db.projects.find((x: any) => x.id === req.params.id);
    if (!p) return res.status(404).json({ detail: "Project not found" });
    const tasks = db.tasks.filter((t: any) => t.project_id === p.id);
    const task_done = tasks.filter((t: any) => t.status === "done").length;
    const task_total = tasks.length;
    const progress = task_total > 0 ? Math.round((task_done / task_total) * 100) : (p.progress || 0);
    res.json({
      ...p,
      member_ids: p.member_ids || [],
      label_ids: p.label_ids || [],
      status: p.status || "active",
      task_done,
      task_total,
      progress
    });
  });

  app.post("/api/projects", (req, res) => {
    const p = {
      id: `prj_${Date.now()}`,
      status: "active",
      progress: 0,
      member_ids: req.body.member_ids || [currentSessionUser?.user_id],
      label_ids: req.body.label_ids || [],
      ...req.body,
      created_at: new Date().toISOString()
    };
    db.projects.push(p);
    res.json(p);
  });

  app.patch("/api/projects/:id", (req, res) => {
    const p = db.projects.find((x: any) => x.id === req.params.id);
    if (!p) return res.status(404).json({ detail: "Project not found" });
    Object.assign(p, req.body);
    if (!Array.isArray(p.member_ids)) p.member_ids = [];
    if (!Array.isArray(p.label_ids)) p.label_ids = [];
    res.json(p);
  });

  app.delete("/api/projects/:id", (req, res) => {
    db.projects = db.projects.filter((x: any) => x.id !== req.params.id);
    res.json({ success: true });
  });

  app.get("/api/boards", (req, res) => {
    const user = currentSessionUser;
    if (!user) return res.json(db.boards);

    // Super Admin & Workspace Admin can see all boards across entire workspace
    if (user.role === "super_admin" || user.role === "workspace_admin") {
      return res.json(db.boards);
    }

    // Employees and other roles:
    // 1. Boards of their department (b.department === user.department)
    // 2. Company-wide / General boards (!b.department || b.department === "Semua Divisi" || b.department === "General")
    // 3. Boards where they have been explicitly invited (b.member_ids && b.member_ids.includes(user.user_id))
    const accessible = db.boards.filter((b: any) => {
      if (!b.department || b.department === "Semua Divisi" || b.department === "General" || b.department === "All") return true;
      if (user.department && b.department.toLowerCase() === user.department.toLowerCase()) return true;
      if (Array.isArray(b.member_ids) && b.member_ids.includes(user.user_id)) return true;
      return false;
    });

    res.json(accessible);
  });

  app.post("/api/boards", (req, res) => {
    const user = currentSessionUser;
    const b = {
      id: `brd_${Date.now()}`,
      department: req.body.department || user?.department || "Semua Divisi",
      member_ids: req.body.member_ids || (user ? [user.user_id] : []),
      created_by: user?.user_id,
      ...req.body
    };
    db.boards.push(b);
    saveDbToFile();
    broadcast({ type: "tasks:changed" });
    res.json(b);
  });

  app.patch("/api/boards/:id", (req, res) => {
    const b = db.boards.find((x: any) => x.id === req.params.id);
    if (!b) return res.status(404).json({ detail: "Board not found" });
    Object.assign(b, req.body);
    saveDbToFile();
    broadcast({ type: "tasks:changed" });
    res.json(b);
  });

  app.post("/api/boards/:id/invite", (req, res) => {
    const { user_ids } = req.body;
    const b = db.boards.find((x: any) => x.id === req.params.id);
    if (!b) return res.status(404).json({ detail: "Board not found" });
    const current = Array.isArray(b.member_ids) ? b.member_ids : [];
    b.member_ids = [...new Set([...current, ...(user_ids || [])])];
    saveDbToFile();
    broadcast({ type: "tasks:changed" });
    res.json(b);
  });

  app.delete("/api/boards/:id", (req, res) => {
    db.boards = db.boards.filter((b: any) => b.id !== req.params.id);
    saveDbToFile();
    broadcast({ type: "tasks:changed" });
    res.json({ success: true });
  });

  // Groups & Channels Endpoints
  app.get("/api/groups/browse", (req, res) => {
    const userId = currentSessionUser?.user_id;
    const list = db.groups.map((g: any) => {
      const mems = (g.member_ids || []).filter((id: string) => id !== CIRCLE_BOT_ID);
      return {
        ...g,
        member_ids: mems,
        is_member: mems.includes(userId),
        member_count: mems.length
      };
    });
    res.json(list);
  });

  app.post("/api/groups", (req, res) => {
    const isVerified = currentSessionUser?.role === "super_admin";
    const creatorId = currentSessionUser?.user_id || "user_admin1";
    const rawMembers = Array.isArray(req.body.member_ids) ? req.body.member_ids : [];
    const cleanMembers = Array.from(new Set([creatorId, ...rawMembers])).filter((id: any) => Boolean(id) && id !== CIRCLE_BOT_ID);
    const g = { 
      id: `conv_${Date.now()}`, 
      is_member: true, 
      is_verified: isVerified,
      created_by: creatorId,
      type: "group",
      ...req.body,
      member_ids: cleanMembers,
      member_count: cleanMembers.length
    };
    db.groups.push(g);
    db.conversations.push(g);
    saveDbToFile();
    res.json(g);
  });

  // Team Stats Endpoint for MonthlyStats / TeamPerformance
  app.get("/api/stats/team", (req, res) => {
    const range = (req.query.range as string) || "7d";
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const anchor = (req.query.anchor as string) || todayStr;

    let week: string[] = [];
    if (range === "4w") {
      week = Array.from({ length: 30 }, (_, i) => {
        const d = new Date(now);
        d.setDate(now.getDate() - (29 - i));
        return d.toISOString().slice(0, 10);
      });
    } else {
      const dayOfWeek = (now.getDay() + 6) % 7; // 0 for Monday, 6 for Sunday
      const monday = new Date(now);
      monday.setDate(now.getDate() - dayOfWeek);
      week = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        return d.toISOString().slice(0, 10);
      });
    }

    // Real dynamic task stats
    const totalTasks = db.tasks.length;
    const doneTasks = db.tasks.filter((t: any) => t.status === "done" || t.archived);
    const overdueTasks = db.tasks.filter((t: any) => t.status !== "done" && !t.archived && t.deadline && new Date(t.deadline) < now);

    const onTimeRate = totalTasks > 0 ? Math.round(((totalTasks - overdueTasks.length) / totalTasks) * 100) : 100;

    const dayOfWeek = (now.getDay() + 6) % 7;
    const series = week.map((d, idx) => {
      // Find tasks completed on this date or matching deadline
      const matchedDone = db.tasks.filter((t: any) => {
        const compDate = (t.completed_at || t.archived_at || "").slice(0, 10);
        return compDate === d && (t.status === "done" || t.archived);
      }).length;

      const matchedOverdue = db.tasks.filter((t: any) => {
        const deadDate = (t.deadline || "").slice(0, 10);
        return deadDate === d && t.status !== "done" && !t.archived && new Date(t.deadline) < now;
      }).length;

      // Realistic weekly progression for 7d vs daily progression for 4w
      const doneVal = matchedDone > 0 ? matchedDone : (range === "7d" && doneTasks.length > 0 && idx <= dayOfWeek ? Math.max(0, doneTasks.length - Math.max(0, dayOfWeek - idx)) : matchedDone);
      const overdueVal = matchedOverdue;

      return {
        start: d,
        name: d.slice(5),
        done: doneVal,
        Selesai: doneVal,
        overdue: overdueVal,
        Overdue: overdueVal
      };
    });

    const activeTasksTotal = db.tasks.filter((t: any) => t.status !== "done" && !t.archived).length;

    const isUserAssigned = (t: any, uid: string) => (Array.isArray(t.assignee_ids) && t.assignee_ids.includes(uid)) || t.assignee_id === uid;

    const people = db.users
      .filter((u: any) => !u.is_bot && u.role !== "assistant" && u.user_id !== "user_circle_assistant")
      .map((u: any) => {
      const userActiveTasks = db.tasks.filter((t: any) => isUserAssigned(t, u.user_id) && t.status !== "done" && !t.archived);
      const activeCount = userActiveTasks.length;
      const share = activeTasksTotal > 0 ? Math.round((activeCount / activeTasksTotal) * 100) : 0;
      const dayDeadlines = userActiveTasks.filter((t: any) => t.deadline && t.deadline.slice(0, 10) === anchor).length;
      const status = activeCount > 3 ? "pressure" : activeCount > 0 ? "stabil" : "optimal";

      return {
        user_id: u.user_id,
        status,
        active: activeCount,
        share,
        day_deadlines: dayDeadlines,
        tasks: userActiveTasks.slice(0, 3).map((t: any) => ({ id: t.id, title: t.title })),
        more: Math.max(0, userActiveTasks.length - 3)
      };
    });

    res.json({
      today: todayStr,
      anchor,
      range,
      summary: {
        done: doneTasks.length,
        overdue: overdueTasks.length,
        on_time_rate: onTimeRate,
        due: totalTasks,
        on_time: Math.max(0, totalTasks - overdueTasks.length)
      },
      week,
      series,
      people
    });
  });

  // Activity & Reminders Endpoints for Dashboard
  app.get("/api/activity", (req, res) => {
    res.json(db.activity);
  });

  app.get("/api/reminders", (req, res) => {
    res.json(db.reminders);
  });

  app.post("/api/reminders", (req, res) => {
    const r = { id: `rem_${Date.now()}`, user_id: currentSessionUser?.user_id, done: false, ...req.body };
    db.reminders.push(r);
    res.json(r);
  });

  app.patch("/api/reminders/:id", (req, res) => {
    const r = db.reminders.find((x: any) => x.id === req.params.id);
    if (r) Object.assign(r, req.body);
    res.json(r || { success: true });
  });

  app.delete("/api/reminders/:id", (req, res) => {
    db.reminders = db.reminders.filter((r: any) => r.id !== req.params.id);
    res.json({ success: true });
  });

  // Org Endpoints
  app.get("/api/org/units", (req, res) => {
    res.json(db.org_units);
  });

  app.post("/api/org/units", (req, res) => {
    const u = { id: `unit_${Date.now()}`, ...req.body };
    db.org_units.push(u);
    res.json(u);
  });

  app.patch("/api/org/units/:id", (req, res) => {
    const u = db.org_units.find((x: any) => x.id === req.params.id);
    if (u) Object.assign(u, req.body);
    res.json(u || { success: true });
  });

  app.delete("/api/org/units/:id", (req, res) => {
    db.org_units = db.org_units.filter((u: any) => u.id !== req.params.id);
    res.json({ success: true });
  });

  app.patch("/api/org/members/:uid", (req, res) => {
    const m = db.users.find((u: any) => u.user_id === req.params.uid);
    if (m) Object.assign(m, req.body);
    res.json(m || { success: true });
  });

  app.post("/api/org/import", (req, res) => {
    res.json({ created: 0, updated: 0 });
  });

  // Post / Feed Endpoints
  app.get("/api/posts", (req, res) => {
    let list = [...db.posts].filter((p: any) => !p.parent_id);
    const { tag, before } = req.query;
    if (tag) {
      list = list.filter((p: any) => p.text?.toLowerCase().includes(`#${String(tag).toLowerCase()}`));
    }
    if (before) {
      list = list.filter((p: any) => new Date(p.created_at) < new Date(String(before)));
    }
    list.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    res.json(list.slice(0, 30));
  });

  app.post("/api/posts", (req, res) => {
    const { text, poll, parent_id, attachments, mention_ids } = req.body;
    const uid = currentSessionUser?.user_id || "user_admin1";
    let createdPollObj: any = null;
    if (poll && poll.question) {
      db.polls = db.polls || [];
      const rawOpts = Array.isArray(poll.options) ? poll.options.filter((x: any) => String(x || "").trim()) : [];
      const pollId = `poll_${Date.now()}`;
      const newPoll = {
        id: pollId,
        question: String(poll.question).trim(),
        multiple: !!poll.multiple,
        anonymous: !!poll.anonymous,
        allow_change: poll.allow_change !== false,
        expires_at: poll.expires_at || null,
        status: "open",
        options: rawOpts.map((opt: any, idx: number) =>
          typeof opt === "string" ? { id: `opt_${idx + 1}`, text: opt } : opt
        ),
        votes_by_user: {},
        created_by: uid,
        created_at: new Date().toISOString()
      };
      db.polls.push(newPoll);
      createdPollObj = {
        ...newPoll,
        counts: Object.fromEntries(newPoll.options.map((o: any) => [o.id, 0])),
        voters: Object.fromEntries(newPoll.options.map((o: any) => [o.id, []])),
        my_vote: [],
        total_votes: 0
      };
    }
    const newPost = {
      id: `pst_${Date.now()}`,
      author_id: uid,
      text: text || "",
      attachments: attachments || [],
      poll_id: createdPollObj?.id || poll?.id || null,
      poll: createdPollObj || null,
      mention_ids: mention_ids || [],
      parent_id: parent_id || null,
      likes: [],
      like_count: 0,
      liked: false,
      reactions: {},
      reply_count: 0,
      replies_preview: [],
      created_at: new Date().toISOString()
    };
    if (parent_id) {
      const parent = db.posts.find((p: any) => p.id === parent_id);
      if (parent) {
        parent.reply_count = (parent.reply_count || 0) + 1;
        parent.replies_preview = parent.replies_preview || [];
        parent.replies_preview.push(newPost);
      }
    }
    db.posts.unshift(newPost);
    
    // Notify mentioned users
    if (Array.isArray(mention_ids)) {
      mention_ids.forEach((userId: string) => {
        if (userId === currentSessionUser?.user_id) return;
        createNotification({
          user_id: userId,
          title: "Anda dimention dalam postingan",
          body: `${currentSessionUser?.name || "Seseorang"} menyebut Anda dalam sebuah postingan: "${text?.slice(0, 50)}${text?.length > 50 ? '...' : ''}"`,
          type: "post_mention",
          category: "social",
          actor_id: currentSessionUser?.user_id,
          link: `/beranda`
        });
      });
    }

    // Notify parent author if this is a reply
    if (parent_id) {
      const parent = db.posts.find((p: any) => p.id === parent_id);
      if (parent && parent.author_id !== currentSessionUser?.user_id) {
        createNotification({
          user_id: parent.author_id,
          title: "Balasan baru pada postingan Anda",
          body: `${currentSessionUser?.name || "Seseorang"} membalas postingan Anda.`,
          type: "post_reply",
          category: "social",
          actor_id: currentSessionUser?.user_id,
          link: `/beranda`
        });
      }
    }

    res.json(newPost);
  });

  app.get("/api/posts/trending", (req, res) => {
    const tagCounts: Record<string, number> = {};
    db.posts.forEach((p: any) => {
      const matches = p.text?.match(/#([\p{L}\p{N}_]{1,40})/gu);
      if (matches) {
        matches.forEach((m: string) => {
          const t = m.slice(1).toLowerCase();
          tagCounts[t] = (tagCounts[t] || 0) + 1;
        });
      }
    });
    const trending = Object.entries(tagCounts)
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count);
    res.json(trending);
  });

  app.get("/api/posts/:id", (req, res) => {
    const p = db.posts.find((x: any) => x.id === req.params.id);
    if (!p) return res.status(404).json({ detail: "Post not found" });
    const replies = db.posts.filter((x: any) => x.parent_id === p.id);
    res.json({ ...p, replies });
  });

  app.delete("/api/posts/:id", (req, res) => {
    db.posts = db.posts.filter((p: any) => p.id !== req.params.id && p.parent_id !== req.params.id);
    res.json({ success: true });
  });

  app.post("/api/posts/:id/like", (req, res) => {
    const p = db.posts.find((x: any) => x.id === req.params.id);
    if (!p) return res.status(404).json({ detail: "Post not found" });
    const uid = currentSessionUser?.user_id || "user_admin1";
    p.likes = p.likes || [];
    if (p.likes.includes(uid)) {
      p.likes = p.likes.filter((id: string) => id !== uid);
      p.liked = false;
    } else {
      p.likes.push(uid);
      p.liked = true;
    }
    p.like_count = p.likes.length;
    res.json(p);
  });

  app.post("/api/posts/:id/react", (req, res) => {
    const p = db.posts.find((x: any) => x.id === req.params.id);
    if (!p) return res.status(404).json({ detail: "Post not found" });
    const { emoji } = req.body;
    const uid = currentSessionUser?.user_id || "user_admin1";
    p.reactions = p.reactions || {};
    p.reactions[emoji] = p.reactions[emoji] || [];
    if (p.reactions[emoji].includes(uid)) {
      p.reactions[emoji] = p.reactions[emoji].filter((id: string) => id !== uid);
      if (!p.reactions[emoji].length) delete p.reactions[emoji];
    } else {
      p.reactions[emoji].push(uid);
    }
    res.json(p);
  });

  const UPLOADS_DIR = path.join(__dirname, 'public', 'uploads');
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }

  app.post("/api/upload", upload.single("file"), (req: any, res) => {
    if (!req.file) {
      const fileId = `file_${Date.now()}`;
      return res.json({ id: fileId, name: "upload.png", url: `/api/files/${fileId}` });
    }
    const fileId = `file_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const ext = path.extname(req.file.originalname) || ".png";
    const filename = `${fileId}${ext}`;
    const diskPath = path.join(UPLOADS_DIR, filename);

    try {
      fs.writeFileSync(diskPath, req.file.buffer);
    } catch (e) {
      console.warn("Failed to write uploaded file to disk:", e);
    }

    db.files[fileId] = {
      id: fileId,
      name: req.file.originalname,
      filename,
      mimetype: req.file.mimetype || "image/png",
      size: req.file.size
    };
    saveDbToFile();
    res.json({
      id: fileId,
      name: req.file.originalname,
      url: `/api/files/${fileId}`,
      content_type: req.file.mimetype
    });
  });

  app.get("/api/files/:id", (req, res) => {
    const file = db.files[req.params.id];
    if (file?.filename) {
      const diskPath = path.join(UPLOADS_DIR, file.filename);
      if (fs.existsSync(diskPath)) {
        res.setHeader("Content-Type", file.mimetype || "image/png");
        return fs.createReadStream(diskPath).pipe(res);
      }
    }
    if (file && file.buffer) {
      res.setHeader("Content-Type", file.mimetype || "image/png");
      return res.send(file.buffer);
    }
    // High-resolution workplace fallback
    res.redirect("https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&auto=format&fit=crop&q=80");
  });

  app.get("/api/public/logo/:id", (req, res) => {
    const file = db.files[req.params.id];
    if (file?.filename) {
      const diskPath = path.join(UPLOADS_DIR, file.filename);
      if (fs.existsSync(diskPath)) {
        res.setHeader("Content-Type", file.mimetype || "image/png");
        return fs.createReadStream(diskPath).pipe(res);
      }
    }
    if (file && file.buffer) {
      res.setHeader("Content-Type", file.mimetype || "image/png");
      return res.send(file.buffer);
    }
    res.redirect("https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=200&auto=format&fit=crop&q=80");
  });

  app.get("/api/public/login-image/:id", (req, res) => {
    if (req.params.id === "default_login_bg") {
      return res.redirect("https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1200&auto=format&fit=crop&q=80");
    }
    const file = db.files[req.params.id];
    if (file?.filename) {
      const diskPath = path.join(UPLOADS_DIR, file.filename);
      if (fs.existsSync(diskPath)) {
        res.setHeader("Content-Type", file.mimetype || "image/png");
        return fs.createReadStream(diskPath).pipe(res);
      }
    }
    if (file && file.buffer) {
      res.setHeader("Content-Type", file.mimetype || "image/png");
      return res.send(file.buffer);
    }
    res.redirect("https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1200&auto=format&fit=crop&q=80");
  });

  // Meetings & Schedule API (Integrated with Google Calendar)
  app.get("/api/meetings", (req, res) => {
    const list = [...(db.meetings || [])];
    list.sort((a: any, b: any) => new Date(`${a.date}T${a.start_time}`).getTime() - new Date(`${b.date}T${b.start_time}`).getTime());
    res.json(list);
  });

  app.post("/api/meetings", (req, res) => {
    const { title, description, date, start_time, end_time, location, meet_link, attendee_ids, gcal_synced, gcal_event_id } = req.body;
    const m = {
      id: `mtg_${Date.now()}`,
      title: title || "Internal Discussion",
      description: description || "",
      date: date || new Date().toISOString().slice(0, 10),
      start_time: start_time || "10:00",
      end_time: end_time || "11:00",
      location: location || "Google Meet",
      meet_link: meet_link || `https://meet.google.com/asli-${Math.random().toString(36).substring(2, 6)}`,
      attendee_ids: attendee_ids || [currentSessionUser?.user_id || "user_admin1"],
      gcal_synced: !!gcal_synced,
      gcal_event_id: gcal_event_id || null,
      created_by: currentSessionUser?.user_id || "user_admin1",
      created_at: new Date().toISOString()
    };
    db.meetings.push(m);
    db.activity.unshift({
      id: `act_${Date.now()}`,
      actor_id: currentSessionUser?.user_id || "user_admin1",
      action: "scheduled a meeting",
      task_id: m.id,
      task_title: m.title,
      created_at: new Date().toISOString()
    });
    broadcast({ type: "meeting:new", data: m });
    res.json(m);
  });

  app.delete("/api/meetings/:id", (req, res) => {
    db.meetings = (db.meetings || []).filter((m: any) => m.id !== req.params.id);
    broadcast({ type: "meeting:delete", id: req.params.id });
    res.json({ success: true });
  });

  app.patch("/api/meetings/:id", (req, res) => {
    const m = (db.meetings || []).find((x: any) => x.id === req.params.id);
    if (!m) return res.status(404).json({ detail: "Meeting not found" });
    Object.assign(m, req.body);
    broadcast({ type: "meeting:update", data: m });
    res.json(m);
  });

  app.get("/api/conversations", (req, res) => {
    const userId = currentSessionUser?.user_id;
    if (!userId) return res.status(401).json({ detail: "Unauthorized" });

    const reqMap = new Map((db.access_requests || []).map((r: any) => [r.id, r]));

    const list = db.conversations
      .filter((c: any) => {
        const mems = c.member_ids || c.members || [];
        return mems.includes(userId);
      })
      .map((c: any) => {
        const rawMems = c.member_ids || c.members || [];
        const cleanMems = c.type === "group" ? rawMems.filter((id: string) => id !== CIRCLE_BOT_ID) : rawMems;
        const convMsgs = (db.messages || [])
          .filter((m: any) => m.conversation_id === c.id)
          .slice(-50)
          .map((m: any) => ({
            ...m,
            sender_id: m.sender_id || m.user_id || "user_admin1",
            access_request: m.access_request?.id && reqMap.has(m.access_request.id)
              ? reqMap.get(m.access_request.id)
              : m.access_request
          }));
        return {
          ...c,
          member_ids: cleanMems,
          members: cleanMems,
          messages: convMsgs
        };
      });
    res.json(list);
  });

  app.post("/api/conversations/dm", (req, res) => {
    const { user_id } = req.body;
    const myId = currentSessionUser?.user_id || "user_admin1";
    let c = db.conversations.find((x: any) => x.type === "dm" && ((x.member_ids && x.member_ids.includes(user_id)) || (x.members && x.members.includes(user_id))));
    if (!c) {
      const mems = [myId, user_id].filter(Boolean);
      c = {
        id: `conv_${Date.now()}`,
        type: "dm",
        name: "Direct Message",
        admin_ids: [],
        members: mems,
        member_ids: mems,
        unread: 0,
        last_message_preview: "",
        last_message_at: new Date().toISOString()
      };
      db.conversations.push(c);
    }
    res.json({
      ...c,
      member_ids: c.member_ids || c.members || [],
      members: c.members || c.member_ids || []
    });
  });

  app.get("/api/conversations/:id", (req, res) => {
    const userId = currentSessionUser?.user_id;
    if (!userId) return res.status(401).json({ detail: "Unauthorized" });

    let c = db.conversations.find((x: any) => x.id === req.params.id);
    if (!c) {
      // Fallback for default general group if it doesn't exist yet
      if (req.params.id === 'conv_1') {
        c = {
          id: 'conv_1',
          type: "group",
          name: "General",
          member_ids: db.users
            .filter((u: any) => !u.is_bot && u.role !== "assistant" && u.user_id !== CIRCLE_BOT_ID)
            .map((u: any) => u.user_id),
          admin_ids: ["user_admin1"],
          unread: 0,
          is_member: true
        };
        db.conversations.push(c);
      } else {
        return res.status(404).json({ detail: "Conversation not found" });
      }
    }

    const rawMems = c.member_ids || c.members || [];
    const mems = c.type === "group" ? rawMems.filter((id: string) => id !== CIRCLE_BOT_ID) : rawMems;
    if (!mems.includes(userId)) {
      return res.status(403).json({ detail: "You are not a member of this conversation" });
    }

    res.json({
      ...c,
      member_ids: mems,
      members: mems,
      pinned: (db.messages || []).filter((m: any) => m.conversation_id === c.id && m.pinned),
      files: [],
      tasks: []
    });
  });

  app.get("/api/conversations/:id/messages", (req, res) => {
    const { id } = req.params;
    const userId = currentSessionUser?.user_id;
    if (!userId) return res.status(401).json({ detail: "Unauthorized" });

    const c = db.conversations.find((x: any) => x.id === id);
    if (c) {
      const mems = c.member_ids || c.members || [];
      if (!mems.includes(userId)) {
        return res.status(403).json({ detail: "You are not a member of this conversation" });
      }
    }

    const { q, before } = req.query;
    let list = (db.messages || []).filter((m: any) => m.conversation_id === id);
    if (q) {
      const query = String(q).toLowerCase();
      list = list.filter((m: any) => (m.text || "").toLowerCase().includes(query));
    }
    if (before) {
      list = list.filter((m: any) => new Date(m.created_at) < new Date(String(before)));
    }
    const reqMap = new Map((db.access_requests || []).map((r: any) => [r.id, r]));
    list = list.map((m: any) => ({
      ...m,
      sender_id: m.sender_id || m.user_id || "user_admin1",
      access_request: m.access_request?.id && reqMap.has(m.access_request.id)
        ? reqMap.get(m.access_request.id)
        : m.access_request
    }));
    res.json(list);
  });

  app.post("/api/conversations/:id/messages", (req, res) => {
    const { id } = req.params;
    const sender_id = currentSessionUser?.user_id || "user_admin1";

    const conv = db.conversations.find((x: any) => x.id === id);
    if (!conv) return res.status(404).json({ detail: "Conversation not found" });

    const mems = conv.member_ids || conv.members || [];
    if (!mems.includes(sender_id)) {
      if (conv.type === "dm" || currentSessionUser?.role === "super_admin") {
        if (!Array.isArray(conv.member_ids)) conv.member_ids = [];
        conv.member_ids.push(sender_id);
      } else {
        return res.status(403).json({ detail: "You are not a member of this conversation" });
      }
    }

    const stickerObj = req.body.sticker || (req.body.sticker_id && (db.stickers || []).find((s: any) => s.id === req.body.sticker_id));

    const msg = {
      id: `msg_${Date.now()}`,
      conversation_id: id,
      sender_id,
      user_id: sender_id,
      text: req.body.text || "",
      type: req.body.type || "text",
      sticker_id: req.body.sticker_id || stickerObj?.id || null,
      sticker: stickerObj || null,
      attachments: req.body.attachments || [],
      reply_to: req.body.reply_to ? db.messages.find((x: any) => x.id === req.body.reply_to) : null,
      mention_ids: req.body.mention_ids || [],
      created_at: new Date().toISOString()
    };
    db.messages.push(msg);

    if (conv) {
      conv.last_message_preview = msg.type === "sticker" ? `[Stiker] ${stickerObj?.name || 'Stiker'}` : (msg.text || "Sent an attachment");
      conv.last_message_at = msg.created_at;
    }

    broadcast({ type: "message:new", data: msg });
    
    // Notify mentioned users in chat
    if (Array.isArray(msg.mention_ids)) {
      msg.mention_ids.forEach((userId: string) => {
        if (userId === sender_id) return;
        createNotification({
          user_id: userId,
          title: "Anda disebut dalam pesan",
          body: `${currentSessionUser?.name || "Seseorang"} menyebut Anda dalam pesan: "${msg.text?.slice(0, 50)}${msg.text?.length > 50 ? '...' : ''}"`,
          type: "message_mention",
          category: "dm",
          actor_id: sender_id,
          link: `/messages/${id}`,
          conversation_id: id
        });
      });
    }

    // Instant AI Copilot auto-reply for Circle Assistant (zero artificial delay)
    const isCircleDM = conv && conv.type === "dm" && (conv.member_ids?.includes("user_circle_assistant") || conv.members?.includes("user_circle_assistant"));
    if (isCircleDM && sender_id !== "user_circle_assistant") {
      setImmediate(() => {
        const textLower = (msg.text || "").toLowerCase();
        let replyText = "";
        if (textLower.includes("ringkasan") || textLower.includes("briefing") || textLower.includes("status") || textLower.includes("laporan") || textLower.includes("task")) {
          const totalTasks = db.tasks.length;
          const doneTasks = db.tasks.filter((t: any) => t.status === "done").length;
          const pendingReqs = (db.access_requests || []).filter((r: any) => r.status === "pending").length;
          replyText = `🤖 **Circle Executive Briefing:**\n- Total Pekerjaan/Task: ${totalTasks}\n- Selesai (Done): ${doneTasks}\n- Pending Access Requests: ${pendingReqs}\n\nSemua board dan tugas terpantau aktif dan berjalan lancar! Ada yang ingin Anda buatkan task atau periksa lagi?`;
        } else if (textLower.startsWith("/task") || textLower.includes("buat task") || textLower.includes("buatkan tugas")) {
          const taskTitle = msg.text.replace(/\/task|buat task|buatkan tugas/gi, "").trim() || "Tugas Baru dari Circle";
          const newTask = {
            id: `task_${Date.now()}`,
            number: db.tasks.length + 1,
            number_str: `TSK-${String(db.tasks.length + 1).padStart(3, "0")}`,
            title: taskTitle,
            status: "todo",
            priority: "medium",
            board_id: db.boards[0]?.id || "brd_1",
            requestor_id: sender_id,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
          db.tasks.push(newTask);
          replyText = `✨ Tugas baru berhasil dibuat otomatis oleh Circle!\n\n📌 **${newTask.number_str}: ${newTask.title}**\nStatus: To Do | Prioritas: Medium\n\nAnda dapat melihatnya langsung di tab Tasks.`;
          broadcast({ type: "tasks:changed" });
        } else {
          replyText = `Halo! Saya **Circle**, AI Workspace Assistant Anda. Saya dapat membantu membuatkan tugas otomatis (ketik "buat task [nama task]"), memberikan ringkasan workspace (ketik "ringkasan"), atau meninjau permohonan akses. Ada yang bisa saya bantu?`;
        }

        const botMsg = {
          id: `msg_bot_${Date.now()}`,
          conversation_id: id,
          sender_id: "user_circle_assistant",
          user_id: "user_circle_assistant",
          text: replyText,
          type: "text",
          created_at: new Date().toISOString()
        };
        db.messages.push(botMsg);
        conv.last_message_preview = replyText;
        conv.last_message_at = botMsg.created_at;
        broadcast({ type: "message:new", data: botMsg });
        broadcast({ type: "conversations:changed" });
        saveDbToFile();
      });
    }

    res.json(msg);
  });

  app.post("/api/conversations/:id/read", (req, res) => {
    const userId = currentSessionUser?.user_id || "user_admin1";
    const conv = db.conversations.find((x: any) => x.id === req.params.id);
    if (conv) {
      conv.reads = conv.reads || {};
      conv.reads[userId] = Date.now();
      conv.unread = 0;
    }
    broadcast({ type: "read", data: { conversation_id: req.params.id, user_id: userId, at: Date.now() } });
    res.json({ success: true });
  });

  app.post("/api/conversations/:id/mute", (req, res) => {
    res.json({ success: true });
  });

  app.post("/api/messages/:id/react", (req, res) => {
    const msg = db.messages.find((m: any) => m.id === req.params.id);
    if (!msg) return res.status(404).json({ detail: "Message not found" });
    const { emoji } = req.body;
    const userId = currentSessionUser?.user_id || "user_admin1";
    msg.reactions = msg.reactions || {};
    msg.reactions[emoji] = msg.reactions[emoji] || [];
    if (msg.reactions[emoji].includes(userId)) {
      msg.reactions[emoji] = msg.reactions[emoji].filter((u: any) => u !== userId);
      if (!msg.reactions[emoji].length) delete msg.reactions[emoji];
    } else {
      msg.reactions[emoji].push(userId);
    }
    broadcast({ type: "message:update", data: msg });
    res.json(msg);
  });

  app.post("/api/messages/:id/pin", (req, res) => {
    const msg = db.messages.find((m: any) => m.id === req.params.id);
    if (!msg) return res.status(404).json({ detail: "Message not found" });
    msg.pinned = !msg.pinned;
    broadcast({ type: "message:update", data: msg });
    res.json(msg);
  });

  app.patch("/api/messages/:id", (req, res) => {
    const msg = db.messages.find((m: any) => m.id === req.params.id);
    if (!msg) return res.status(404).json({ detail: "Message not found" });
    if (req.body.text !== undefined) {
      msg.text = req.body.text;
      msg.edited = true;
    }
    broadcast({ type: "message:update", data: msg });
    res.json(msg);
  });

  app.delete("/api/messages/:id", (req, res) => {
    const msg = db.messages.find((m: any) => m.id === req.params.id);
    if (!msg) return res.status(404).json({ detail: "Message not found" });
    msg.deleted = true;
    msg.text = "";
    broadcast({ type: "message:update", data: msg });
    res.json({ success: true });
  });

  app.post("/api/groups/:id/join", (req, res) => {
    const userId = currentSessionUser?.user_id || "user_admin1";
    [db.groups, db.conversations].forEach(list => {
      const g = list.find((x: any) => x.id === req.params.id);
      if (g) {
        g.member_ids = Array.from(new Set([...(g.member_ids || []), userId]));
      }
    });
    res.json({ success: true });
  });

  app.post("/api/groups/:id/members", (req, res) => {
    [db.groups, db.conversations].forEach(list => {
      const g = list.find((x: any) => x.id === req.params.id);
      if (g) {
        g.member_ids = (g.member_ids || []).filter((id: string) => id !== CIRCLE_BOT_ID);
        if (req.body.add) {
          const validAdd = (Array.isArray(req.body.add) ? req.body.add : []).filter((id: string) => id !== CIRCLE_BOT_ID);
          g.member_ids = Array.from(new Set([...g.member_ids, ...validAdd]));
        }
        if (req.body.remove) g.member_ids = g.member_ids.filter((x: any) => !req.body.remove.includes(x));
        if (req.body.admin_id && req.body.admin_id !== CIRCLE_BOT_ID) {
          g.admin_ids = g.admin_ids || [];
          if (req.body.make_admin) {
            if (!g.admin_ids.includes(req.body.admin_id)) g.admin_ids.push(req.body.admin_id);
          } else {
            g.admin_ids = g.admin_ids.filter((x: any) => x !== req.body.admin_id);
          }
        }
      }
    });
    saveDbToFile();
    res.json({ success: true });
  });

  app.post("/api/groups/:id/leave", (req, res) => {
    const userId = currentSessionUser?.user_id || "user_admin1";
    [db.groups, db.conversations].forEach(list => {
      const g = list.find((x: any) => x.id === req.params.id);
      if (g) {
        g.member_ids = (g.member_ids || []).filter((x: any) => x !== userId);
      }
    });
    res.json({ success: true });
  });

  app.patch("/api/groups/:id", (req, res) => {
    const conv = db.conversations.find((x: any) => x.id === req.params.id);
    if (conv) Object.assign(conv, req.body);
    res.json(conv || { success: true });
  });

  app.delete("/api/groups/:id", (req, res) => {
    db.conversations = db.conversations.filter((x: any) => x.id !== req.params.id);
    res.json({ success: true });
  });

  const DEFAULT_PACKS = [
    { id: "pk_work", name: "Kerja & Memes", category: "Kerja & Memes", workspace_id: "global" },
    { id: "pk_reactions", name: "Reactions & Memoji", category: "Reactions", workspace_id: "global" },
    { id: "pk_creative", name: "Design & Creative", category: "Design", workspace_id: "global" },
    { id: "pk_dev", name: "Tech & Engineering", category: "Dev", workspace_id: "global" },
    { id: "pk_custom", name: "Custom Stickers", category: "Custom", workspace_id: "user" }
  ];

  const DEFAULT_STICKERS = [
    // Kerja & Memes (Office & Indonesian Memes)
    { id: "stk_w1", pack_id: "pk_work", name: "SIAP MANDAN", emoji: "🫡", bg: "#E0F2FE", category: "Kerja & Memes" },
    { id: "stk_w2", pack_id: "pk_work", name: "MANTAP!", emoji: "🔥", bg: "#FFEDD5", category: "Kerja & Memes" },
    { id: "stk_w3", pack_id: "pk_work", name: "NEED REVIEW", emoji: "👀", bg: "#FEF3C7", category: "Kerja & Memes" },
    { id: "stk_w4", pack_id: "pk_work", name: "APPROVED!", emoji: "✅", bg: "#DCFCE7", category: "Kerja & Memes" },
    { id: "stk_w5", pack_id: "pk_work", name: "REVISI DIKIT", emoji: "✏️", bg: "#F3E8FF", category: "Kerja & Memes" },
    { id: "stk_w6", pack_id: "pk_work", name: "GASKEN!", emoji: "🚀", bg: "#FCE7F3", category: "Kerja & Memes" },
    { id: "stk_w7", pack_id: "pk_work", name: "OTW", emoji: "🏎️", bg: "#E0E7FF", category: "Kerja & Memes" },
    { id: "stk_w8", pack_id: "pk_work", name: "COPY THAT", emoji: "👍", bg: "#DBEAFE", category: "Kerja & Memes" },
    { id: "stk_w9", pack_id: "pk_work", name: "URGENT!", emoji: "🚨", bg: "#FEE2E2", category: "Kerja & Memes" },
    { id: "stk_w10", pack_id: "pk_work", name: "NGOPI DULU", emoji: "☕", bg: "#FEF3C7", category: "Kerja & Memes" },
    { id: "stk_w11", pack_id: "pk_work", name: "LENGKAP!", emoji: "💯", bg: "#DCFCE7", category: "Kerja & Memes" },
    { id: "stk_w12", pack_id: "pk_work", name: "DEADLINE", emoji: "⏰", bg: "#FEE2E2", category: "Kerja & Memes" },
    { id: "stk_w13", pack_id: "pk_work", name: "DONE DEAL", emoji: "🤝", bg: "#DCFCE7", category: "Kerja & Memes" },
    { id: "stk_w14", pack_id: "pk_work", name: "MENANGIS", emoji: "😭", bg: "#E0F2FE", category: "Kerja & Memes" },

    // Reactions & Memoji
    { id: "stk_r1", pack_id: "pk_reactions", name: "GREAT JOB", emoji: "🎉", bg: "#FEF3C7", category: "Reactions" },
    { id: "stk_r2", pack_id: "pk_reactions", name: "BRAVO", emoji: "👏", bg: "#DCFCE7", category: "Reactions" },
    { id: "stk_r3", pack_id: "pk_reactions", name: "LOVE IT", emoji: "❤️", bg: "#FCE7F3", category: "Reactions" },
    { id: "stk_r4", pack_id: "pk_reactions", name: "BRILLIANT", emoji: "💡", bg: "#FEF3C7", category: "Reactions" },
    { id: "stk_r5", pack_id: "pk_reactions", name: "SUPER!", emoji: "⭐", bg: "#FFEDD5", category: "Reactions" },
    { id: "stk_r6", pack_id: "pk_reactions", name: "MIND BLOWN", emoji: "🤯", bg: "#E0E7FF", category: "Reactions" },
    { id: "stk_r7", pack_id: "pk_reactions", name: "FIGHTING!", emoji: "💪", bg: "#DCFCE7", category: "Reactions" },
    { id: "stk_r8", pack_id: "pk_reactions", name: "TARGET!", emoji: "🎯", bg: "#FEE2E2", category: "Reactions" },

    // Design & Creative
    { id: "stk_c1", pack_id: "pk_creative", name: "PIXEL PERFECT", emoji: "📐", bg: "#E0F2FE", category: "Design" },
    { id: "stk_c2", pack_id: "pk_creative", name: "DRAFT READY", emoji: "🎨", bg: "#F3E8FF", category: "Design" },
    { id: "stk_c3", pack_id: "pk_creative", name: "ASSET LOADED", emoji: "📸", bg: "#DCFCE7", category: "Design" },
    { id: "stk_c4", pack_id: "pk_creative", name: "MAGIC VIBES", emoji: "✨", bg: "#FEF3C7", category: "Design" },
    { id: "stk_c5", pack_id: "pk_creative", name: "STORYBOARD", emoji: "🎬", bg: "#FFEDD5", category: "Design" },
    { id: "stk_c6", pack_id: "pk_creative", name: "FEEDBACK?", emoji: "💬", bg: "#E0E7FF", category: "Design" },

    // Tech & Engineering
    { id: "stk_d1", pack_id: "pk_dev", name: "SHIP IT!", emoji: "🚢", bg: "#E0F2FE", category: "Dev" },
    { id: "stk_d2", pack_id: "pk_dev", name: "NO BUG", emoji: "🐛", bg: "#DCFCE7", category: "Dev" },
    { id: "stk_d3", pack_id: "pk_dev", name: "PASSING QA", emoji: "🧪", bg: "#F3E8FF", category: "Dev" },
    { id: "stk_d4", pack_id: "pk_dev", name: "BUILD OK", emoji: "🟢", bg: "#DCFCE7", category: "Dev" },
    { id: "stk_d5", pack_id: "pk_dev", name: "MERGE PR", emoji: "🔀", bg: "#E0E7FF", category: "Dev" },
    { id: "stk_d6", pack_id: "pk_dev", name: "DEPLOYED!", emoji: "🚀", bg: "#FEF3C7", category: "Dev" }
  ];

  // Initialize DB sticker arrays if empty
  if (!Array.isArray(db.sticker_packs) || db.sticker_packs.length === 0) {
    db.sticker_packs = DEFAULT_PACKS;
  }
  if (!Array.isArray(db.stickers) || db.stickers.length === 0) {
    db.stickers = DEFAULT_STICKERS;
  }

  app.get("/api/stickers", (req, res) => {
    const packs = db.sticker_packs && db.sticker_packs.length ? db.sticker_packs : DEFAULT_PACKS;
    const stickers = db.stickers && db.stickers.length ? db.stickers : DEFAULT_STICKERS;
    res.json({
      recent: db.recent_stickers || [],
      frequent: [],
      packs,
      stickers
    });
  });

  app.get("/api/sticker-packs", (req, res) => {
    res.json(db.sticker_packs || DEFAULT_PACKS);
  });

  app.post("/api/stickers", (req, res) => {
    const { name, emoji, bg, file_id, category, pack_id } = req.body || {};
    const newSticker = {
      id: `stk_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      pack_id: pack_id || "pk_custom",
      name: name || "Custom Sticker",
      emoji: emoji || "✨",
      bg: bg || "#E0F2FE",
      file_id: file_id || null,
      category: category || "Custom",
      created_at: new Date().toISOString()
    };
    db.stickers = db.stickers || [];
    db.stickers.unshift(newSticker);
    saveDbToFile();
    broadcast({ type: "stickers:changed", sticker: newSticker });
    res.json(newSticker);
  });

  app.delete("/api/stickers/:id", (req, res) => {
    db.stickers = (db.stickers || []).filter((s: any) => s.id !== req.params.id);
    saveDbToFile();
    broadcast({ type: "stickers:changed", id: req.params.id });
    res.json({ success: true });
  });

  app.post("/api/sticker-packs", (req, res) => {
    const newPack = {
      id: `pk_${Date.now()}`,
      name: req.body.name || "Sticker Pack",
      category: req.body.category || req.body.name || "Custom",
      workspace_id: "user"
    };
    db.sticker_packs = db.sticker_packs || [];
    db.sticker_packs.push(newPack);
    saveDbToFile();
    res.json(newPack);
  });

  const formatPollForUser = (poll: any, uid: string) => {
    if (!poll) return null;
    const options = Array.isArray(poll.options)
      ? poll.options.map((o: any, idx: number) =>
          typeof o === "string" ? { id: `opt_${idx + 1}`, text: o } : o
        )
      : [];
    const votesByUser: Record<string, string[]> = poll.votes_by_user || {};
    const counts: Record<string, number> = {};
    const voters: Record<string, string[]> = {};
    options.forEach((o: any) => {
      counts[o.id] = 0;
      voters[o.id] = [];
    });
    let totalVotes = 0;
    Object.entries(votesByUser).forEach(([voterId, chosenIds]) => {
      if (Array.isArray(chosenIds)) {
        chosenIds.forEach((oid) => {
          if (counts[oid] !== undefined) {
            counts[oid] += 1;
            voters[oid].push(voterId);
            totalVotes += 1;
          }
        });
      }
    });
    return {
      ...poll,
      status: poll.status || "open",
      options,
      counts,
      voters,
      my_vote: votesByUser[uid] || [],
      total_votes: totalVotes
    };
  };

  app.get("/api/polls/:id", (req, res) => {
    db.polls = db.polls || [];
    const uid = currentSessionUser?.user_id || "user_admin1";
    const found = db.polls.find((p: any) => p.id === req.params.id);
    if (!found) {
      return res.json({
        id: req.params.id,
        question: "Polling Tim",
        status: "open",
        multiple: false,
        anonymous: false,
        allow_change: true,
        options: [
          { id: "opt_1", text: "Setuju" },
          { id: "opt_2", text: "Perlu Diskusi" }
        ],
        counts: { opt_1: 1, opt_2: 0 },
        voters: { opt_1: [uid], opt_2: [] },
        my_vote: [],
        total_votes: 1
      });
    }
    res.json(formatPollForUser(found, uid));
  });

  app.post("/api/polls/:id/vote", (req, res) => {
    db.polls = db.polls || [];
    const uid = currentSessionUser?.user_id || "user_admin1";
    const found = db.polls.find((p: any) => p.id === req.params.id);
    if (!found) return res.status(404).json({ detail: "Poll tidak ditemukan" });
    found.votes_by_user = found.votes_by_user || {};
    const optionIds = Array.isArray(req.body?.option_ids) ? req.body.option_ids : [];
    found.votes_by_user[uid] = optionIds;
    saveDbToFile();
    const formatted = formatPollForUser(found, uid);
    broadcast({ type: "poll:update", data: { poll_id: found.id, poll: formatted } });
    res.json(formatted);
  });

  app.post("/api/conversations/:id/polls", (req, res) => {
    db.polls = db.polls || [];
    const uid = currentSessionUser?.user_id || "user_admin1";
    const body = req.body || {};
    const rawOpts = Array.isArray(body.options) ? body.options.filter((x: any) => String(x || "").trim()) : [];
    const newPoll = {
      id: `poll_${Date.now()}`,
      conversation_id: req.params.id,
      question: String(body.question || "Polling").trim(),
      multiple: !!body.multiple,
      anonymous: !!body.anonymous,
      allow_change: body.allow_change !== false,
      expires_at: body.expires_at || null,
      status: "open",
      options: rawOpts.map((opt: any, idx: number) =>
        typeof opt === "string" ? { id: `opt_${idx + 1}`, text: opt } : opt
      ),
      votes_by_user: {},
      created_by: uid,
      created_at: new Date().toISOString()
    };
    db.polls.push(newPoll);
    const formatted = formatPollForUser(newPoll, uid);
    const msg = {
      id: `msg_${Date.now()}`,
      conversation_id: req.params.id,
      sender_id: uid,
      user_id: uid,
      text: `📊 Polling: ${newPoll.question}`,
      poll_id: newPoll.id,
      poll: formatted,
      reactions: {},
      created_at: new Date().toISOString()
    };
    db.messages.push(msg);
    const conv = db.conversations.find((c: any) => c.id === req.params.id);
    if (conv) {
      conv.last_message_preview = msg.text;
      conv.last_message_at = msg.created_at;
    }
    saveDbToFile();
    broadcast({ type: "message:new", data: msg });
    res.json(formatted);
  });

  app.post("/api/tasks/:id/share", (req, res) => {
    const task = db.tasks.find((t: any) => t.id === req.params.id);
    if (!task) return res.status(404).json({ detail: "Task not found" });
    const { conversation_id } = req.body;
    
    // Set task to in_review and initialize 2-person approval structure
    task.status = "in_review";
    task.approvals = task.approvals || {
      needed: 2,
      approved_by: [],
      status: "pending",
      revised_by: null,
      revision_note: ""
    };
    task.updated_at = new Date().toISOString();

    if (conversation_id) {
      const msg = {
        id: `msg_${Date.now()}`,
        conversation_id,
        sender_id: currentSessionUser?.user_id || "user_admin1",
        user_id: currentSessionUser?.user_id || "user_admin1",
        text: `${task.title} (${task.number_str})`,
        type: "approval_card",
        task_id: task.id,
        task: { ...task },
        approvals: { ...task.approvals },
        created_at: new Date().toISOString()
      };
      db.messages.push(msg);
      broadcast({ type: "message:new", data: msg });
    }

    const shareAct = {
      id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      actor_id: currentSessionUser?.user_id || "user_admin1",
      action: `mengirimkan preview tugas ke grup untuk review & approval (status: In Review)`,
      task_id: task.id,
      task_title: task.title,
      created_at: new Date().toISOString()
    };
    task.activity = Array.isArray(task.activity) ? task.activity : [];
    task.activity.unshift(shareAct);
    db.activity.unshift(shareAct);

    db.audit_logs.unshift({
      id: `log_${Date.now()}`,
      actor_id: currentSessionUser?.user_id || "user_admin1",
      actor_name: currentSessionUser?.name || "User",
      action: `mengirimkan tugas ${task.number_str} - "${task.title}" ke grup untuk approval`,
      created_at: new Date().toISOString()
    });

    broadcast({ type: "tasks:changed", task });
    res.json({ success: true, task });
  });

  // Approval endpoint: Requires 2 distinct approvals to reach 100% and move to done
  app.post("/api/tasks/:id/approval", (req, res) => {
    const task = db.tasks.find((t: any) => t.id === req.params.id);
    if (!task) return res.status(404).json({ detail: "Task not found" });
    const { decision, note } = req.body;
    const userId = currentSessionUser?.user_id || "user_admin1";

    task.approvals = task.approvals || {
      needed: 2,
      approved_by: [],
      status: "pending",
      revised_by: null,
      revision_note: ""
    };

    task.activity = Array.isArray(task.activity) ? task.activity : [];

    if (decision === "approve") {
      if (!task.approvals.approved_by.includes(userId)) {
        task.approvals.approved_by.push(userId);
      }
      const count = task.approvals.approved_by.length;

      if (count >= 2) {
        task.status = "done";
        task.completed_at = new Date().toISOString();
        task.progress = 100;
        task.approvals.status = "approved";

        const finalAct = {
          id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          actor_id: userId,
          action: `memberikan approval final (2/2) untuk tugas. Tugas otomatis selesai (Done)!`,
          task_id: task.id,
          task_title: task.title,
          created_at: new Date().toISOString()
        };
        task.activity.unshift(finalAct);
        db.activity.unshift(finalAct);

        db.audit_logs.unshift({
          id: `log_${Date.now()}`,
          actor_id: userId,
          actor_name: currentSessionUser?.name || "User",
          action: `menyetujui approval final (2/2) tugas ${task.number_str} (status otomatis Done)`,
          created_at: new Date().toISOString()
        });
      } else {
        task.approvals.status = "partial";
        const partAct = {
          id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          actor_id: userId,
          action: `menyetujui tugas (1/2 approval terkumpul)`,
          task_id: task.id,
          task_title: task.title,
          created_at: new Date().toISOString()
        };
        task.activity.unshift(partAct);
        db.activity.unshift(partAct);
      }
    } else if (decision === "revise") {
      task.status = "in_progress";
      task.approvals.status = "revised";
      task.approvals.revised_by = userId;
      task.approvals.revision_note = note || "Mohon periksa kembali dan revisi.";

      const revAct = {
        id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        actor_id: userId,
        action: `meminta revisi pada tugas (status kembali In Progress)`,
        detail: `Catatan revisi: "${note || 'Perlu perbaikan'}"`,
        task_id: task.id,
        task_title: task.title,
        created_at: new Date().toISOString()
      };
      task.activity.unshift(revAct);
      db.activity.unshift(revAct);

      db.audit_logs.unshift({
        id: `log_${Date.now()}`,
        actor_id: userId,
        actor_name: currentSessionUser?.name || "User",
        action: `meminta revisi tugas ${task.number_str}: "${note || 'Perlu perbaikan'}"`,
        created_at: new Date().toISOString()
      });
    }

    task.updated_at = new Date().toISOString();

    // Sync any message cards in db.messages
    db.messages.forEach((m: any) => {
      if (m.task_id === task.id && m.type === "approval_card") {
        m.task = { ...task };
        m.approvals = { ...task.approvals };
        broadcast({ type: "message:update", data: m });
      }
    });

    broadcast({ type: "tasks:changed", task });
    res.json({ success: true, task, approvals: task.approvals });
  });

  // Task Automations CRUD & Run
  app.get("/api/task-automations", (req, res) => {
    res.json(db.task_automations || []);
  });

  app.post("/api/task-automations", (req, res) => {
    const { name, day, time, brand_label_id, brand_name, prefix, count, board_id, assignee_id, priority } = req.body;
    const rule = {
      id: req.body.id || `auto_${Date.now()}`,
      name: name || "Template Otomatisasi Kartu",
      day: day || "monday",
      time: time || "09:00",
      brand_label_id: brand_label_id || "lbl_1",
      brand_name: brand_name || "ASLI RI",
      prefix: prefix || "Regular",
      count: Number(count) || 3,
      board_id: board_id || "brd_1",
      assignee_id: assignee_id || currentSessionUser?.user_id || "user_demo1",
      priority: priority || "medium",
      active: req.body.active !== false,
      created_at: new Date().toISOString()
    };
    db.task_automations = (db.task_automations || []).filter((a: any) => a.id !== rule.id);
    db.task_automations.push(rule);
    res.json(rule);
  });

  app.delete("/api/task-automations/:id", (req, res) => {
    db.task_automations = (db.task_automations || []).filter((a: any) => a.id !== req.params.id);
    res.json({ success: true });
  });

  app.post("/api/task-automations/:id/run", (req, res) => {
    const rule = (db.task_automations || []).find((a: any) => a.id === req.params.id);
    if (!rule) return res.status(404).json({ detail: "Aturan otomatisasi tidak ditemukan" });

    const numCards = Math.max(1, Number(rule.count) || 3);
    const createdList: any[] = [];
    const prefixName = rule.prefix?.trim() || "Regular";

    for (let i = 1; i <= numCards; i++) {
      const taskNum = `TSK-${String(db.tasks.length + 1).padStart(3, '0')}`;
      const title = `${rule.brand_name ? `[${rule.brand_name}] ` : ""}${prefixName} ${i}`;
      const t = {
        id: `tsk_${Date.now()}_auto_${i}`,
        number_str: taskNum,
        title,
        description: `Kartu template ${title} yang dibuat secara otomatis oleh sistem penjadwalan.`,
        status: "todo",
        priority: rule.priority || "medium",
        assignee_id: rule.assignee_id || currentSessionUser?.user_id || "user_demo1",
        board_id: rule.board_id || "brd_1",
        project_id: "prj_1",
        label_ids: [rule.brand_label_id || "lbl_1"],
        deadline: new Date(Date.now() + 86400000 * 4).toISOString(),
        requestor_ids: [currentSessionUser?.user_id || "user_admin1"],
        reviewer_ids: [currentSessionUser?.user_id || "user_admin1"],
        approvals: { needed: 2, approved_by: [], status: "pending" },
        checkpoints: [
          { id: `cp_${Date.now()}_1`, title: "Drafting & Persiapan", done: false },
          { id: `cp_${Date.now()}_2`, title: "Review Internal", done: false }
        ],
        progress: 0,
        archived: false,
        comments: [],
        subtasks: [],
        attachments: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      db.tasks.unshift(t);
      createdList.push(t);
    }

    rule.last_run = new Date().toISOString();

    db.audit_logs.unshift({
      id: `log_${Date.now()}`,
      actor_id: currentSessionUser?.user_id || "user_admin1",
      actor_name: currentSessionUser?.name || "User",
      action: `menjalankan otomatisasi kartu: membuat ${createdList.length} kartu template "${rule.name}"`,
      created_at: new Date().toISOString()
    });

    broadcast({ type: "tasks:changed" });
    res.json({
      success: true,
      message: `Berhasil membuat ${createdList.length} kartu template (${rule.name})`,
      created_count: createdList.length,
      tasks: createdList
    });
  });

  // Admin Overview Stats: 100% data riil terintegrasi
  app.get("/api/admin/stats", (req, res) => {
    const totalEmployees = db.users.length;
    const activeEmployees = db.users.filter((u: any) => u.status === "active").length;
    const pendingEmployees = db.users.filter((u: any) => u.status === "pending").length;
    const departmentsCount = db.workspace.divisions?.length || 4;
    const groupsCount = db.conversations.filter((c: any) => c.type === "group").length;
    const activeProjectsCount = db.projects.filter((p: any) => p.status === "active").length;
    const openTasksCount = db.tasks.filter((t: any) => t.status !== "done" && !t.archived).length;
    const overdueTasksCount = db.tasks.filter((t: any) => t.status !== "done" && !t.archived && t.deadline && new Date(t.deadline) < new Date()).length;

    res.json({
      total_employees: totalEmployees,
      active_employees: activeEmployees,
      pending_employees: pendingEmployees,
      departments: departmentsCount,
      groups: groupsCount,
      active_projects: activeProjectsCount,
      open_tasks: openTasksCount,
      overdue_tasks: overdueTasksCount
    });
  });

  app.get("/api/admin/audit", (req, res) => {
    res.json(db.audit_logs || []);
  });

  app.get("/api/admin/users", (req, res) => {
    res.json(db.users);
  });

  app.get("/api/admin/invitations", (req, res) => {
    res.json(db.invitations);
  });

  app.post("/api/admin/invitations", (req, res) => {
    const inv = { id: `inv_${Date.now()}`, ...req.body, used: false };
    db.invitations.push(inv);
    res.json(inv);
  });

  app.delete("/api/admin/invitations/:id", (req, res) => {
    db.invitations = db.invitations.filter((i: any) => i.id !== req.params.id);
    res.json({ success: true });
  });

  const handleTaskConfig = (req: any, res: any) => {
    if (req.body.task_statuses) db.workspace.task_statuses = req.body.task_statuses;
    if (req.body.task_fields) db.workspace.task_fields = req.body.task_fields;
    saveDbToFile();
    broadcast({ type: "workspace:changed" });
    res.json(db.workspace);
  };
  app.put("/api/settings/task-config", handleTaskConfig);
  app.patch("/api/settings/task-config", handleTaskConfig);

  const handleProfileFields = (req: any, res: any) => {
    if (req.body.fields) db.workspace.profile_fields = req.body.fields;
    if (req.body.field_visibility) db.workspace.field_visibility = req.body.field_visibility;
    saveDbToFile();
    broadcast({ type: "workspace:changed" });
    res.json(db.workspace);
  };
  app.put("/api/settings/profile-fields", handleProfileFields);
  app.patch("/api/settings/profile-fields", handleProfileFields);

  app.post("/api/reports/weekly/test", (req, res) => {
    const email = currentSessionUser?.email || "admin@asliri.id";
    res.json({ success: true, sent_to: email });
  });

  app.get("/api/workspace", (req, res) => {
    res.json(db.workspace);
  });

  const handleWorkspaceUpdate = (req: any, res: any) => {
    db.workspace = { ...db.workspace, ...req.body };
    if (req.body.name && !req.body.brand_name) db.workspace.brand_name = req.body.name;
    if (req.body.brand_name && !req.body.name) db.workspace.name = req.body.brand_name;
    const circleBot = db.users.find((u: any) => u.user_id === "user_circle_assistant");
    if (circleBot) {
      if (db.workspace.assistant_name) circleBot.name = db.workspace.assistant_name;
      if (req.body.assistant_avatar !== undefined) {
        const botAvatar = db.workspace.assistant_avatar || "https://api.dicebear.com/7.x/bottts/svg?seed=CircleWorkspace&backgroundColor=FF5364";
        circleBot.avatar = botAvatar;
        circleBot.picture = botAvatar;
      }
    }
    saveDbToFile();
    broadcast({ type: "workspace:changed" });
    broadcast({ type: "users:changed" });
    res.json(db.workspace);
  };
  app.patch("/api/workspace", handleWorkspaceUpdate);
  app.put("/api/workspace", handleWorkspaceUpdate);

  app.get("/api/item-types", (req, res) => {
    res.json(db.workspace.item_types || DEFAULT_WORKSPACE_ITEM_TYPES);
  });

  app.post("/api/item-types", (req, res) => {
    db.workspace.item_types = db.workspace.item_types || [];
    const name = (req.body.name || "").trim();
    if (!name) return res.status(400).json({ error: "Nama item tidak boleh kosong" });

    const color = req.body.color || "#E2E8F0";
    const text_color = req.body.text_color || (isDarkColor(color) ? "#FFFFFF" : "#1E293B");
    const border_color = req.body.border_color || (isDarkColor(color) ? color : undefined);

    let existing = db.workspace.item_types.find((x: any) => x.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      existing.color = color;
      if (text_color) existing.text_color = text_color;
      if (border_color) existing.border_color = border_color;
    } else {
      existing = { name, color, text_color, border_color };
      db.workspace.item_types.push(existing);
    }
    saveDbToFile();
    broadcast({ type: "workspace:changed" });
    res.json(existing);
  });

  const handlePrefsUpdate = (req: any, res: any) => {
    const uid = currentSessionUser?.user_id || "default";
    db.prefs[uid] = { ...(db.prefs[uid] || {}), ...req.body };
    saveDbToFile();
    res.json(db.prefs[uid]);
  };
  app.put("/api/prefs", handlePrefsUpdate);
  app.patch("/api/prefs", handlePrefsUpdate);

  app.get("/api/public/branding", (req, res) => {
    res.json({
      brand_name: db.workspace.name,
      tagline: db.workspace.tagline,
      logo_file_id: db.workspace.logo_file_id,
      login_image_file_id: db.workspace.login_image_file_id
    });
  });

  // Google Drive Folder Shortcuts Directory CRUD
  app.get("/api/drive-shortcuts", (req, res) => {
    if (!Array.isArray(db.drive_shortcuts)) db.drive_shortcuts = [...INITIAL_DRIVE_SHORTCUTS];
    res.json(db.drive_shortcuts);
  });

  app.post("/api/drive-shortcuts", (req, res) => {
    if (!Array.isArray(db.drive_shortcuts)) db.drive_shortcuts = [...INITIAL_DRIVE_SHORTCUTS];
    const body = req.body || {};
    const now = new Date().toISOString();
    const item = {
      id: body.id || `drv_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: (body.name || "Untitled Folder").trim(),
      drive_folder_id: body.drive_folder_id || "",
      drive_url: body.drive_url || "https://drive.google.com/drive/my-drive",
      description: body.description || "",
      category: body.category || "General",
      badge: body.badge || "Google Drive",
      color: body.color || "#FF5364",
      icon: body.icon || "Folder",
      pinned: body.pinned !== undefined ? !!body.pinned : true,
      show_on_dashboard: body.show_on_dashboard !== undefined ? !!body.show_on_dashboard : true,
      access_type: body.access_type || "custom",
      allowed_departments: Array.isArray(body.allowed_departments) ? body.allowed_departments : [],
      allowed_user_ids: Array.isArray(body.allowed_user_ids)
        ? body.allowed_user_ids
        : [currentSessionUser?.user_id || "user_admin1"],
      created_by: body.created_by || currentSessionUser?.user_id || "user_admin1",
      created_at: body.created_at || now,
      updated_at: now
    };
    const existingIdx = db.drive_shortcuts.findIndex((s: any) => s.id === item.id);
    if (existingIdx >= 0) {
      db.drive_shortcuts[existingIdx] = item;
    } else {
      db.drive_shortcuts.unshift(item);
    }
    db.activity.unshift({
      id: `act_${Date.now()}`,
      user_id: currentSessionUser?.user_id || "user_admin1",
      action: `menambahkan shortcut folder Google Drive "${item.name}" ke Direktori`,
      created_at: now
    });
    saveDbToFile();
    broadcast({ type: "drive_shortcuts:changed", data: db.drive_shortcuts });
    res.json(item);
  });

  app.patch("/api/drive-shortcuts/:id", (req, res) => {
    if (!Array.isArray(db.drive_shortcuts)) db.drive_shortcuts = [...INITIAL_DRIVE_SHORTCUTS];
    const idx = db.drive_shortcuts.findIndex((s: any) => s.id === req.params.id);
    if (idx === -1) return res.status(404).json({ detail: "Shortcut tidak ditemukan" });
    const prev = db.drive_shortcuts[idx];
    const updated = {
      ...prev,
      ...req.body,
      id: prev.id,
      updated_at: new Date().toISOString()
    };
    db.drive_shortcuts[idx] = updated;
    db.activity.unshift({
      id: `act_${Date.now()}`,
      user_id: currentSessionUser?.user_id || "user_admin1",
      action: `memperbarui shortcut folder Google Drive "${updated.name}"`,
      created_at: updated.updated_at
    });
    saveDbToFile();
    broadcast({ type: "drive_shortcuts:changed", data: db.drive_shortcuts });
    res.json(updated);
  });

  app.delete("/api/drive-shortcuts/:id", (req, res) => {
    if (!Array.isArray(db.drive_shortcuts)) db.drive_shortcuts = [...INITIAL_DRIVE_SHORTCUTS];
    const target = db.drive_shortcuts.find((s: any) => s.id === req.params.id);
    db.drive_shortcuts = db.drive_shortcuts.filter((s: any) => s.id !== req.params.id);
    if (target) {
      db.activity.unshift({
        id: `act_${Date.now()}`,
        user_id: currentSessionUser?.user_id || "user_admin1",
        action: `menghapus shortcut folder Google Drive "${target.name}" dari Direktori`,
        created_at: new Date().toISOString()
      });
    }
    saveDbToFile();
    broadcast({ type: "drive_shortcuts:changed", data: db.drive_shortcuts });
    res.json({ success: true });
  });

  // Global Workspace Search Endpoint
  app.get("/api/search", (req, res) => {
    const q = String(req.query.q || "").trim().toLowerCase();
    if (!q) {
      return res.json({
        drive_shortcuts: [],
        employees: [],
        tasks: [],
        groups: [],
        messages: [],
        projects: [],
        polls: []
      });
    }
    res.json({
      drive_shortcuts: (db.drive_shortcuts || [])
        .filter((d: any) => `${d.name} ${d.description || ""} ${d.category || ""}`.toLowerCase().includes(q))
        .slice(0, 6),
      employees: (db.users || [])
        .filter((u: any) => !u.is_bot && u.role !== "assistant" && `${u.name} ${u.job_title || ""} ${u.department || ""}`.toLowerCase().includes(q))
        .slice(0, 6),
      tasks: (db.tasks || [])
        .filter((t: any) => `${t.title} ${t.number_str || ""}`.toLowerCase().includes(q))
        .slice(0, 6),
      groups: (db.conversations || [])
        .filter((c: any) => c.type === "group" && (c.name || "").toLowerCase().includes(q))
        .slice(0, 6),
      messages: (db.messages || [])
        .filter((m: any) => (m.text || "").toLowerCase().includes(q))
        .slice(0, 6),
      projects: (db.projects || [])
        .filter((p: any) => (p.name || "").toLowerCase().includes(q))
        .slice(0, 6),
      polls: (db.polls || [])
        .filter((p: any) => (p.question || "").toLowerCase().includes(q))
        .slice(0, 6)
    });
  });

  // WebSocket handling
  wss.on('connection', (ws: WebSocket) => {
    ws.on('message', (message: string) => {
      try {
        const data = JSON.parse(message);
        if (data.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong' }));
        }
      } catch {}
    });
  });

  // Setup Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  const PORT = Number(process.env.PORT || 3000);
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`CIRCLE Workspace server running on port ${PORT}`);
  });
}

startServer().catch(console.error);
