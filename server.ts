import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import fs from 'fs';

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
      { id: "lbl_1", name: "High Priority", color: "#FF5364", description: "Urgent items" },
      { id: "lbl_2", name: "Feature", color: "#2F7DE1", description: "New features" }
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

  // Ensure demo users with different departments exist
  const demoUsers = [
    {
      user_id: "user_budi",
      email: "budi@asliri.local",
      name: "Budi Santoso",
      role: "department_manager",
      job_title: "Product Manager",
      department: "Product",
      online: true,
      is_demo: true,
      status: "active",
      avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80",
      picture: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80"
    },
    {
      user_id: "user_siti",
      email: "siti@asliri.local",
      name: "Siti Rahma",
      role: "employee",
      job_title: "Engineering Lead",
      department: "Engineering",
      online: true,
      is_demo: true,
      status: "active",
      avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&auto=format&fit=crop&q=80",
      picture: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&auto=format&fit=crop&q=80"
    },
    {
      user_id: "user_dian",
      email: "dian@asliri.local",
      name: "Dian Pratama",
      role: "employee",
      job_title: "UI/UX Designer",
      department: "Design",
      online: true,
      is_demo: true,
      status: "active",
      avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&auto=format&fit=crop&q=80",
      picture: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&auto=format&fit=crop&q=80"
    }
  ];

  demoUsers.forEach((du) => {
    if (!db.users.some((u: any) => u.user_id === du.user_id || u.email === du.email)) {
      db.users.push(du);
    }
  });

  // Ensure default boards have department and member_ids
  if (Array.isArray(db.boards)) {
    db.boards.forEach((b: any) => {
      if (!b.department) b.department = "Semua Divisi";
      if (!Array.isArray(b.member_ids)) b.member_ids = [];
    });
  }

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
      prefs: db.prefs[latestUser.user_id] || { theme_mode: "light" }
    });
  });

  app.post("/api/auth/google", (req, res) => {
    const { email, name, picture } = req.body || {};
    if (!email) return res.status(400).json({ detail: "Email is required" });

    let user = db.users.find((u: any) => u.email?.toLowerCase() === email.toLowerCase());

    // Super admin default email whitelist
    const isSuperAdminEmail = email.toLowerCase() === "be.creativestudio21@gmail.com" || email.toLowerCase() === "admin@asliri.local";

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

      db.notifications.push({
        id: `notif_${Date.now()}_${admin.user_id}`,
        user_id: admin.user_id,
        title: "Permintaan Akses Masuk Baru",
        body: `${name} (${department || 'General'}) mengajukan permohonan akses masuk`,
        type: "access_request",
        read: false,
        created_at: new Date().toISOString()
      });
      broadcast({ type: "notification:new" });
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
    const user = db.users.find((u: any) => u.user_id === req.params.id);
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
    saveDbToFile();
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
    res.json({ notifications: db.notifications, unread: db.notifications.filter((n: any) => !n.read).length });
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

    if (isArchiveView) {
      list = list.filter((t: any) => t.archived === true);
    } else {
      list = list.filter((t: any) => !t.archived);
      if (view === "active") list = list.filter((t: any) => t.status !== "done");
      if (view === "completed") list = list.filter((t: any) => t.status === "done");
      if (view === "my") list = list.filter((t: any) => t.assignee_id === currentSessionUser?.user_id);
      if (view === "assigned") list = list.filter((t: any) => t.assignee_id === currentSessionUser?.user_id);
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
    if (assignee_id) list = list.filter((t: any) => t.assignee_id === assignee_id);
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

    const t = {
      id: `tsk_${Date.now()}`,
      number_str: taskNum,
      comments: [],
      subtasks: [],
      attachments: [],
      checkpoints: cps,
      progress,
      archived: false,
      created_by: currentSessionUser?.user_id || "user_admin1",
      requestor_ids: reqIds,
      reviewer_ids: reqIds, // Reviewer otomatis sama dengan requestor
      approvals: {
        needed: 2,
        approved_by: [],
        status: "pending"
      },
      ...req.body,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    db.tasks.unshift(t);
    db.activity.unshift({
      id: `act_${Date.now()}`,
      actor_id: currentSessionUser?.user_id || "user_admin1",
      action: "created task",
      task_id: t.id,
      task_title: t.title,
      created_at: new Date().toISOString()
    });
    db.audit_logs.unshift({
      id: `log_${Date.now()}`,
      actor_id: currentSessionUser?.user_id || "user_admin1",
      actor_name: currentSessionUser?.name || "User",
      action: `membuat tugas baru: ${t.number_str} - ${t.title}`,
      created_at: new Date().toISOString()
    });
    broadcast({ type: "tasks:changed", task: t });
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
        assignee_id: item.assignee_id || currentSessionUser?.user_id || "user_admin1",
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
    res.json(t);
  });

  app.patch("/api/tasks/:id", (req, res) => {
    const t = db.tasks.find((x: any) => x.id === req.params.id);
    if (!t) return res.status(404).json({ detail: "Task not found" });

    // Reviewer otomatis sinkron dengan requestor
    if (req.body.requestor_ids) {
      req.body.reviewer_ids = req.body.requestor_ids;
    }

    // Checkpoint completion tracking
    if (Array.isArray(req.body.checkpoints)) {
      const oldCheckpoints = t.checkpoints || [];
      const newCheckpoints = req.body.checkpoints;

      newCheckpoints.forEach((newCp: any) => {
        const oldCp = oldCheckpoints.find((c: any) => c.id === newCp.id);
        // If checkpoint was newly completed
        if (newCp.done && (!oldCp || !oldCp.done)) {
          const act = {
            id: `act_${Date.now()}`,
            actor_id: currentSessionUser?.user_id || "user_admin1",
            action: `menyelesaikan checkpoint "${newCp.title || 'Poin Checklist'}" pada tugas`,
            task_id: t.id,
            task_title: t.title,
            created_at: new Date().toISOString()
          };
          db.activity.unshift(act);

          db.audit_logs.unshift({
            id: `log_${Date.now()}`,
            actor_id: currentSessionUser?.user_id || "user_admin1",
            actor_name: currentSessionUser?.name || "User",
            action: `menyelesaikan checkpoint "${newCp.title}" pada tugas ${t.number_str || t.title}`,
            created_at: new Date().toISOString()
          });

          t.activity = t.activity || [];
          t.activity.unshift(act);
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
    // If unarchived
    if (req.body.archived === false) {
      t.archived = false;
    }
    if (req.body.archived === true) {
      t.archived = true;
      t.archived_at = t.archived_at || new Date().toISOString();
      t.archived_month = t.archived_month || new Date().toISOString().slice(0, 7);
    }

    req.body.updated_at = new Date().toISOString();
    Object.assign(t, req.body);
    broadcast({ type: "tasks:changed", task: t });
    res.json(t);
  });

  app.delete("/api/tasks/:id", (req, res) => {
    const idx = db.tasks.findIndex((x: any) => x.id === req.params.id);
    if (idx === -1) return res.status(404).json({ detail: "Task not found" });
    const deleted = db.tasks.splice(idx, 1)[0];
    broadcast({ type: "tasks:changed", deleted_id: req.params.id });
    res.json({ success: true, task: deleted });
  });

  app.post("/api/tasks/:id/comments", (req, res) => {
    const t = db.tasks.find((x: any) => x.id === req.params.id);
    if (!t) return res.status(404).json({ detail: "Task not found" });
    t.comments = t.comments || [];
    const c = { id: `cmt_${Date.now()}`, user_id: currentSessionUser?.user_id, ...req.body, created_at: new Date().toISOString() };
    t.comments.push(c);
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
    res.json(db.groups);
  });

  app.post("/api/groups/:id/join", (req, res) => {
    const g = db.groups.find((x: any) => x.id === req.params.id);
    if (g) {
      g.is_member = true;
      g.member_count = (g.member_count || 1) + 1;
    }
    res.json({ success: true });
  });

  app.post("/api/groups", (req, res) => {
    const g = { id: `conv_${Date.now()}`, member_count: 1, is_member: true, ...req.body };
    db.groups.push(g);
    db.conversations.push(g);
    res.json(g);
  });

  // Team Stats Endpoint for MonthlyStats / TeamPerformance
  app.get("/api/stats/team", (req, res) => {
    const now = new Date();
    const dayOfWeek = (now.getDay() + 6) % 7; // 0 for Monday, 6 for Sunday
    const monday = new Date(now);
    monday.setDate(now.getDate() - dayOfWeek);
    const week = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return d.toISOString().slice(0, 10);
    });
    const todayStr = now.toISOString().slice(0, 10);
    const anchor = (req.query.anchor as string) || todayStr;

    // Real dynamic task stats
    const totalTasks = db.tasks.length;
    const doneTasks = db.tasks.filter((t: any) => t.status === "done" || t.archived);
    const overdueTasks = db.tasks.filter((t: any) => t.status !== "done" && !t.archived && t.deadline && new Date(t.deadline) < now);

    const onTimeRate = totalTasks > 0 ? Math.round(((totalTasks - overdueTasks.length) / totalTasks) * 100) : 100;

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

      // Realistic weekly progression
      const doneVal = matchedDone > 0 ? matchedDone : (doneTasks.length > 0 && idx <= dayOfWeek ? Math.max(0, doneTasks.length - Math.max(0, dayOfWeek - idx)) : 0);
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

    const people = db.users
      .filter((u: any) => !u.is_bot && u.role !== "assistant" && u.user_id !== "user_circle_assistant")
      .map((u: any) => {
      const userActiveTasks = db.tasks.filter((t: any) => t.assignee_id === u.user_id && t.status !== "done" && !t.archived);
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
      range: (req.query.range as string) || "7d",
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
    const newPost = {
      id: `pst_${Date.now()}`,
      author_id: currentSessionUser?.user_id || "user_admin1",
      text: text || "",
      attachments: attachments || [],
      poll_id: poll?.id || null,
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
    const list = db.conversations.map((c: any) => ({
      ...c,
      member_ids: c.member_ids || c.members || [],
      members: c.members || c.member_ids || []
    }));
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
    let c = db.conversations.find((x: any) => x.id === req.params.id);
    if (!c) {
      c = {
        id: req.params.id,
        type: "group",
        name: "General",
        member_ids: db.users.map((u: any) => u.user_id),
        admin_ids: ["user_admin1"],
        unread: 0,
        is_member: true
      };
      db.conversations.push(c);
    }
    const mems = c.member_ids || c.members || [];
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
    const { q, before } = req.query;
    let list = (db.messages || []).filter((m: any) => m.conversation_id === id);
    if (q) {
      const query = String(q).toLowerCase();
      list = list.filter((m: any) => (m.text || "").toLowerCase().includes(query));
    }
    if (before) {
      list = list.filter((m: any) => new Date(m.created_at) < new Date(String(before)));
    }
    list = list.map((m: any) => ({
      ...m,
      sender_id: m.sender_id || m.user_id || "user_admin1"
    }));
    res.json(list);
  });

  app.post("/api/conversations/:id/messages", (req, res) => {
    const { id } = req.params;
    const sender_id = currentSessionUser?.user_id || "user_admin1";

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

    const conv = db.conversations.find((x: any) => x.id === id);
    if (conv) {
      conv.last_message_preview = msg.type === "sticker" ? `[Stiker] ${stickerObj?.name || 'Stiker'}` : (msg.text || "Sent an attachment");
      conv.last_message_at = msg.created_at;
    }

    broadcast({ type: "message:new", data: msg });

    // Advanced AI Copilot auto-reply for Circle Assistant
    const isCircleDM = conv && conv.type === "dm" && (conv.member_ids?.includes("user_circle_assistant") || conv.members?.includes("user_circle_assistant"));
    if (isCircleDM && sender_id !== "user_circle_assistant") {
      setTimeout(() => {
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
      }, 600);
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
    const conv = db.conversations.find((x: any) => x.id === req.params.id);
    const userId = currentSessionUser?.user_id || "user_admin1";
    if (conv) {
      conv.member_ids = conv.member_ids || [];
      if (!conv.member_ids.includes(userId)) conv.member_ids.push(userId);
      conv.is_member = true;
    }
    res.json({ success: true });
  });

  app.post("/api/groups/:id/members", (req, res) => {
    const conv = db.conversations.find((x: any) => x.id === req.params.id);
    if (conv) {
      conv.member_ids = conv.member_ids || [];
      if (req.body.add) conv.member_ids = [...new Set([...conv.member_ids, ...req.body.add])];
      if (req.body.remove) conv.member_ids = conv.member_ids.filter((x: any) => !req.body.remove.includes(x));
      if (req.body.admin_id) {
        conv.admin_ids = conv.admin_ids || [];
        if (req.body.make_admin) conv.admin_ids.push(req.body.admin_id);
        else conv.admin_ids = conv.admin_ids.filter((x: any) => x !== req.body.admin_id);
      }
    }
    res.json({ success: true });
  });

  app.post("/api/groups/:id/leave", (req, res) => {
    const conv = db.conversations.find((x: any) => x.id === req.params.id);
    const userId = currentSessionUser?.user_id || "user_admin1";
    if (conv) {
      conv.member_ids = (conv.member_ids || []).filter((x: any) => x !== userId);
    }
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

  app.get("/api/polls/:id", (req, res) => {
    res.json({ id: req.params.id, question: "Polling", options: [], votes: {} });
  });

  app.post("/api/polls/:id/vote", (req, res) => {
    res.json({ success: true });
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

    db.activity.unshift({
      id: `act_${Date.now()}`,
      actor_id: currentSessionUser?.user_id || "user_admin1",
      action: `mengirimkan preview tugas ke grup untuk review & approval (status: In Review)`,
      task_id: task.id,
      task_title: task.title,
      created_at: new Date().toISOString()
    });

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

        db.activity.unshift({
          id: `act_${Date.now()}`,
          actor_id: userId,
          action: `memberikan approval final (2/2) untuk tugas. Tugas otomatis selesai (Done)!`,
          task_id: task.id,
          task_title: task.title,
          created_at: new Date().toISOString()
        });

        db.audit_logs.unshift({
          id: `log_${Date.now()}`,
          actor_id: userId,
          actor_name: currentSessionUser?.name || "User",
          action: `menyetujui approval final (2/2) tugas ${task.number_str} (status otomatis Done)`,
          created_at: new Date().toISOString()
        });
      } else {
        task.approvals.status = "partial";
        db.activity.unshift({
          id: `act_${Date.now()}`,
          actor_id: userId,
          action: `menyetujui tugas (1/2 approval terkumpul)`,
          task_id: task.id,
          task_title: task.title,
          created_at: new Date().toISOString()
        });
      }
    } else if (decision === "revise") {
      task.status = "in_progress";
      task.approvals.status = "revised";
      task.approvals.revised_by = userId;
      task.approvals.revision_note = note || "Mohon periksa kembali dan revisi.";

      db.activity.unshift({
        id: `act_${Date.now()}`,
        actor_id: userId,
        action: `meminta revisi pada tugas: "${note || 'Perlu perbaikan'}" (status kembali In Progress)`,
        task_id: task.id,
        task_title: task.title,
        created_at: new Date().toISOString()
      });

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

  app.put("/api/settings/task-config", (req, res) => {
    if (req.body.task_statuses) db.workspace.task_statuses = req.body.task_statuses;
    if (req.body.task_fields) db.workspace.task_fields = req.body.task_fields;
    saveDbToFile();
    res.json(db.workspace);
  });

  app.put("/api/settings/profile-fields", (req, res) => {
    if (req.body.fields) db.workspace.profile_fields = req.body.fields;
    if (req.body.field_visibility) db.workspace.field_visibility = req.body.field_visibility;
    saveDbToFile();
    res.json(db.workspace);
  });

  app.get("/api/workspace", (req, res) => {
    res.json(db.workspace);
  });

  app.patch("/api/workspace", (req, res) => {
    db.workspace = { ...db.workspace, ...req.body };
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
  });

  app.post("/api/item-types", (req, res) => {
    db.workspace.item_types = db.workspace.item_types || [];
    db.workspace.item_types.push(req.body);
    saveDbToFile();
    res.json(req.body);
  });

  app.put("/api/prefs", (req, res) => {
    const uid = currentSessionUser?.user_id || "default";
    db.prefs[uid] = { ...(db.prefs[uid] || {}), ...req.body };
    saveDbToFile();
    res.json(db.prefs[uid]);
  });

  app.get("/api/public/branding", (req, res) => {
    res.json({
      brand_name: db.workspace.name,
      tagline: db.workspace.tagline,
      logo_file_id: db.workspace.logo_file_id,
      login_image_file_id: db.workspace.login_image_file_id
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
