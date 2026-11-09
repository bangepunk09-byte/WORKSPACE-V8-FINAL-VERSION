import { useEffect, useRef, useState } from "react";
import { Trash2, Plus, ArrowUp, ArrowDown, Upload } from "lucide-react";
import { toast } from "sonner";
import { useApp } from "../../context/AppContext";
import { api, errMsg, uploadFile } from "../../lib/api";
import { Avatar, LabelChip, ROLE_NAMES, rel, Logo } from "../../components/common";
import { Switch } from "../../components/ui/switch";
import { ItemChip } from "../tasks/fields";

const inp = "h-10 rounded-xl border bg-surface2 px-3 text-sm outline-none";
const run = async (fn, msg) => { try { await fn(); if (msg) toast.success(msg); return true; } catch (e) { toast.error(errMsg(e)); return false; } };
export const Card = ({ title, children, testid }) => <section className="card p-5" data-testid={testid}><h3 className="mb-4 font-bold">{title}</h3>{children}</section>;

const INITIAL_ADMIN_STATS = {
  total_employees: 5,
  active_employees: 4,
  pending_employees: 1,
  departments: 4,
  groups: 1,
  active_projects: 1,
  open_tasks: 1,
  overdue_tasks: 0
};

const INITIAL_AUDIT_LOGS = [
  { id: "log_1", actor_name: "Admin ASLI RI", action: "memperbarui konfigurasi workspace identity & logo portal", created_at: new Date(Date.now() - 7200000).toISOString() },
  { id: "log_2", actor_name: "Admin ASLI RI", action: "menghubungkan integrasi Google Workspace (Calendar & Meet)", created_at: new Date(Date.now() - 28800000).toISOString() },
  { id: "log_3", actor_name: "Siti Rahma", action: "menyetujui approval final (2/2) pada tugas TSK-002", created_at: new Date(Date.now() - 64800000).toISOString() },
  { id: "log_4", actor_name: "Budi Santoso", action: "menyelesaikan checkpoint 'Audit stats endpoint' pada tugas TSK-002", created_at: new Date(Date.now() - 86400000).toISOString() },
  { id: "log_5", actor_name: "Admin ASLI RI", action: "menerima permohonan bergabung karyawan baru Dian Pratama", created_at: new Date(Date.now() - 172800000).toISOString() }
];

let ADMIN_STATS_CACHE = null;
let AUDIT_LOGS_CACHE = null;
let USERS_CACHE = null;
let INVITES_CACHE = null;
let ACCESS_REQ_CACHE = null;

export function AdminOverview() {
  const [s, setS] = useState(ADMIN_STATS_CACHE || INITIAL_ADMIN_STATS);
  const [logs, setLogs] = useState(AUDIT_LOGS_CACHE || INITIAL_AUDIT_LOGS);
  const { userMap } = useApp();

  useEffect(() => {
    api.get("/admin/stats").then((r) => { if (r.data) { ADMIN_STATS_CACHE = r.data; setS(r.data); } }).catch(() => {});
    api.get("/admin/audit").then((r) => { if (Array.isArray(r.data) && r.data.length > 0) { AUDIT_LOGS_CACHE = r.data; setLogs(r.data); } }).catch(() => {});
  }, []);

  const stats = s ? [
    ["Total employees", s.total_employees],
    ["Active", s.active_employees],
    ["Pending approval", s.pending_employees],
    ["Departments", s.departments],
    ["Groups", s.groups],
    ["Active projects", s.active_projects],
    ["Open tasks", s.open_tasks],
    ["Overdue tasks", s.overdue_tasks]
  ] : [];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4" data-testid="admin-stats">
        {stats.map(([l, v], i) => (
          <div
            key={l}
            className={`rounded-3xl p-4 transition-all duration-200 hover:shadow-sm ${
              ["bg-soft-red", "bg-soft-blue", "bg-soft-yellow", "bg-soft-purple", "bg-soft-green"][i % 5]
            }`}
          >
            <p className="text-xs font-semibold text-sub">{l}</p>
            <p className="mt-2 text-3xl font-bold text-ink">{v}</p>
          </div>
        ))}
      </div>

      <Card title="Recent workspace activity (audit log)" testid="audit-log">
        <ul className="max-h-96 space-y-2.5 overflow-y-auto pr-1">
          {logs.map((l) => (
            <li key={l.id} className="flex items-center gap-2 text-sm py-1 border-b border-slate-100 dark:border-slate-800/60 last:border-0">
              <Avatar user={userMap[l.actor_id] || { name: l.actor_name }} size={24} showStatus={false} />
              <span className="font-bold text-ink">{l.actor_name}</span>
              <span className="text-sub truncate min-w-0 flex-1">{l.action}</span>
              <span className="ml-auto text-[11px] text-sub shrink-0">{rel(l.created_at)}</span>
            </li>
          ))}
          {!logs.length && <li className="text-sm text-sub">No admin actions yet.</li>}
        </ul>
      </Card>
    </div>
  );
}

export function PeopleAccess() {
  const { me, ws, reloadWs, reloadUsers, subscribe } = useApp();
  const [users, setUsers] = useState(USERS_CACHE || []);
  const [invites, setInvites] = useState(INVITES_CACHE || []);
  const [accessRequests, setAccessRequests] = useState(ACCESS_REQ_CACHE || []);
  const [reqFilter, setReqFilter] = useState("all");
  const [inv, setInv] = useState({ email: "", role: "employee" });
  const [domains, setDomains] = useState((ws.allowed_domains || []).join(", "));
  const [busyAction, setBusyAction] = useState(null);

  const load = () => {
    api.get("/admin/users").then((r) => { USERS_CACHE = r.data; setUsers(r.data); }).catch(() => {});
    api.get("/admin/invitations").then((r) => { INVITES_CACHE = r.data; setInvites(r.data); }).catch(() => {});
    api.get("/admin/access-requests").then((r) => { ACCESS_REQ_CACHE = r.data; setAccessRequests(r.data); }).catch(() => {});
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    return subscribe((e) => {
      if (e.type === "access_requests:changed" || e.type === "users:changed") {
        load();
      }
    });
  }, [subscribe]);

  const upd = (uid, body) => run(() => api.patch(`/admin/users/${uid}`, body), "Updated").then(() => { load(); reloadUsers(); });

  const approveRequest = async (id, role, department) => {
    setBusyAction(id);
    try {
      await api.post(`/admin/access-requests/${id}/approve`, { role, department });
      toast.success("Permintaan akses berhasil disetujui! Akun sekarang aktif.");
      load();
      reloadUsers();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusyAction(null);
    }
  };

  const rejectRequest = async (id) => {
    if (!window.confirm("Tolak permohonan akses ini?")) return;
    setBusyAction(id);
    try {
      await api.post(`/admin/access-requests/${id}/reject`);
      toast.info("Permintaan akses telah ditolak.");
      load();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusyAction(null);
    }
  };

  const pendingCount = accessRequests.filter((r) => r.status === "pending").length;
  const filteredRequests = accessRequests.filter((r) => {
    if (reqFilter === "pending") return r.status === "pending";
    if (reqFilter === "approved") return r.status === "approved";
    if (reqFilter === "rejected") return r.status === "rejected";
    return true;
  });

  return (
    <div className="space-y-5">
      {/* 1. Access Requests from "Circle" Assistant */}
      <Card title={`Permintaan Akses Masuk (${accessRequests.length})`} testid="access-requests-card">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
            <p className="text-xs text-sub leading-relaxed max-w-md">
              Karyawan baru atau akun Google yang belum terdaftar dapat mengajukan permintaan login. Permintaan diteruskan melalui Asisten <b className="text-ink">"Circle"</b> berupa Approval Card.
            </p>
            <div className="flex items-center gap-1.5 text-xs">
              <button
                onClick={() => setReqFilter("all")}
                className={`rounded-full px-3 py-1 font-semibold transition-all ${
                  reqFilter === "all" ? "bg-brand text-white shadow-2xs" : "bg-surface2 text-sub hover:text-ink"
                }`}
              >
                Semua ({accessRequests.length})
              </button>
              <button
                onClick={() => setReqFilter("pending")}
                className={`rounded-full px-3 py-1 font-semibold transition-all ${
                  reqFilter === "pending" ? "bg-amber-500 text-white shadow-2xs" : "bg-surface2 text-sub hover:text-ink"
                }`}
              >
                Menunggu ({pendingCount})
              </button>
              <button
                onClick={() => setReqFilter("approved")}
                className={`rounded-full px-3 py-1 font-semibold transition-all ${
                  reqFilter === "approved" ? "bg-emerald-600 text-white shadow-2xs" : "bg-surface2 text-sub hover:text-ink"
                }`}
              >
                Disetujui
              </button>
              <button
                onClick={() => setReqFilter("rejected")}
                className={`rounded-full px-3 py-1 font-semibold transition-all ${
                  reqFilter === "rejected" ? "bg-rose-500 text-white shadow-2xs" : "bg-surface2 text-sub hover:text-ink"
                }`}
              >
                Ditolak
              </button>
            </div>
          </div>

          {filteredRequests.length === 0 ? (
            <div className="py-6 text-center text-xs text-sub">
              {reqFilter === "pending"
                ? "Tidak ada permintaan akses yang sedang menunggu persetujuan."
                : "Belum ada riwayat permohonan akses masuk."}
            </div>
          ) : (
            <div className="divide-y">
              {filteredRequests.map((r) => {
                const isPending = r.status === "pending";
                const isApproved = r.status === "approved";
                const isRejected = r.status === "rejected";
                return (
                  <div key={r.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs" data-testid={`req-row-${r.id}`}>
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-ink">{r.name}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          isApproved
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                            : isRejected
                            ? "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300"
                            : "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                        }`}>
                          {isApproved ? "Disetujui" : isRejected ? "Ditolak" : "Menunggu"}
                        </span>
                      </div>
                      <p className="text-sub truncate">{r.email}</p>
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-sub pt-0.5">
                        <span className="font-medium text-ink">Divisi: <b className="text-brand">{r.department}</b></span>
                        <span>·</span>
                        <span>Jabatan: {r.job_title}</span>
                        {r.note && r.note !== "-" && (
                          <>
                            <span>·</span>
                            <span className="italic truncate max-w-xs">"{r.note}"</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                      {isPending ? (
                        <>
                          <button
                            disabled={busyAction === r.id}
                            onClick={() => approveRequest(r.id, "employee", r.department)}
                            className="rounded-full bg-emerald-600 px-3 py-1.5 font-bold text-white hover:bg-emerald-700 shadow-2xs transition-colors disabled:opacity-50"
                            data-testid={`admin-approve-req-${r.id}`}
                          >
                            Setujui (Employee)
                          </button>
                          <button
                            disabled={busyAction === r.id}
                            onClick={() => rejectRequest(r.id)}
                            className="rounded-full border border-rose-300 bg-rose-50 px-3 py-1.5 font-bold text-rose-700 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300 transition-colors disabled:opacity-50"
                            data-testid={`admin-reject-req-${r.id}`}
                          >
                            Tolak
                          </button>
                        </>
                      ) : (
                        <div className="text-[11px] text-sub text-right">
                          {isApproved ? `Disetujui oleh ${r.approved_by || "Admin"}` : `Ditolak oleh ${r.rejected_by || "Admin"}`}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Card>

      <Card title="Sign-in access" testid="access-settings">
        <label className="block text-xs font-semibold text-sub">Company email domains<input value={domains} onChange={(e) => setDomains(e.target.value)} className={`${inp} mt-1 w-full`} data-testid="allowed-domains-input" /></label>
        <label className="mt-3 flex items-center justify-between text-sm">Company-domain accounts join automatically<Switch checked={ws.auto_join_domain !== false} onCheckedChange={(v) => run(() => api.patch("/workspace", { auto_join_domain: v })).then(reloadWs)} data-testid="auto-join-switch" /></label>
        <label className="mt-3 flex items-center justify-between text-sm">Other accounts go to an approval queue (otherwise rejected)<Switch checked={ws.require_approval !== false} onCheckedChange={(v) => run(() => api.patch("/workspace", { require_approval: v })).then(reloadWs)} data-testid="require-approval-switch" /></label>
        <button onClick={() => run(() => api.patch("/workspace", { allowed_domains: domains.split(",") }), "Saved").then(reloadWs)} className="btn-accent mt-3 h-10 px-4 text-sm font-semibold" data-testid="save-domains-btn">Save domains</button>
      </Card>

      <Card title="Invite employee" testid="invite-card">
        <div className="flex flex-wrap gap-2"><input value={inv.email} onChange={(e) => setInv({ ...inv, email: e.target.value })} placeholder="name@company.com" className={`${inp} min-w-[200px] flex-1`} data-testid="invite-email-input" />
          <select value={inv.role} onChange={(e) => setInv({ ...inv, role: e.target.value })} className={inp} data-testid="invite-role-select">{Object.entries(ROLE_NAMES).filter(([k]) => me.role === "super_admin" || !["super_admin", "workspace_admin"].includes(k)).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          <button onClick={() => run(() => api.post("/admin/invitations", inv), "Invitation saved — they can now sign in with Google").then((ok) => { if (ok) { setInv({ email: "", role: "employee" }); load(); } })} className="btn-accent h-10 px-4 text-sm font-semibold" data-testid="invite-submit-btn">Invite</button></div>
        <ul className="mt-3 space-y-1">{invites.map((i) => <li key={i.id} className="flex items-center gap-2 text-sm"><span className="flex-1">{i.email}</span><span className="text-xs text-sub">{ROLE_NAMES[i.role]} · {i.used ? "joined" : "pending"}</span><button onClick={() => run(() => api.delete(`/admin/invitations/${i.id}`)).then(load)} className="text-sub" aria-label="Delete invitation"><Trash2 size={14} /></button></li>)}</ul>
      </Card>

      <Card title={`Employees & roles (${users.filter((u) => !u.is_bot).length})`} testid="users-admin">
        <div className="divide-y">{users.filter((u) => !u.is_bot).map((u) => (
          <div key={u.user_id} className="flex flex-wrap items-center gap-2 py-2.5" data-testid={`admin-user-${u.user_id}`}>
            <Avatar user={u} size={32} showStatus={false} /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{u.name}</span><span className="block truncate text-xs text-sub">{u.email} · Divisi: {u.department || "General"}</span></span>
            <select value={u.role} onChange={(e) => upd(u.user_id, { role: e.target.value })} className="h-9 rounded-lg border bg-surface2 px-2 text-xs" data-testid={`role-select-${u.user_id}`}>{Object.entries(ROLE_NAMES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
            <select value={u.status} onChange={(e) => upd(u.user_id, { status: e.target.value })} disabled={u.user_id === me.user_id} className={`h-9 rounded-lg border px-2 text-xs ${u.status === "pending" ? "bg-soft-yellow" : u.status === "inactive" ? "bg-soft-red" : "bg-surface2"}`} data-testid={`status-select-${u.user_id}`}><option value="active">Active</option><option value="pending">Pending</option><option value="inactive">Deactivated</option></select>
          </div>))}</div>
      </Card>
    </div>
  );
}

export function WeeklyReportCard() {
  const [busy, setBusy] = useState(false);
  const test = async () => { setBusy(true); try { const { data } = await api.post("/reports/weekly/test"); toast.success(`Contoh laporan dikirim ke ${data.sent_to}`); } catch (e) { toast.error(errMsg(e)); } setBusy(false); };
  return (
    <Card title="Laporan progres mingguan" testid="weekly-report-card">
      <p className="text-sm text-sub">Setiap Senin jam 09.00 WIB, admin dan manager menerima email berisi progres checkpoint dan kendala yang belum selesai di tiap board yang bisa mereka akses.</p>
      <button onClick={test} disabled={busy} className="btn-ghost mt-3 h-10 border px-4 text-sm font-semibold disabled:opacity-50" data-testid="weekly-report-test-btn">{busy ? "Mengirim…" : "Kirim contoh ke email saya"}</button>
    </Card>
  );
}

export function WorkspaceBranding() {
  const { ws, reloadWs } = useApp();
  const [f, setF] = useState({ brand_name: ws?.brand_name || "", name: ws?.name || "", tagline: ws?.tagline || "", description: ws?.description || "", org_levels: (ws?.org_levels || []).join(", ") });

  useEffect(() => {
    setF({
      brand_name: ws?.brand_name || "",
      name: ws?.name || "",
      tagline: ws?.tagline || "",
      description: ws?.description || "",
      org_levels: (ws?.org_levels || []).join(", ")
    });
  }, [ws]);
  const logo = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const up = await uploadFile(file);
      await api.patch("/workspace", { logo_file_id: up.id });
      toast.success("Foto profil workspace berhasil diperbarui!");
      reloadWs();
    } catch (er) {
      toast.error(errMsg(er, "Gagal mengupload logo workspace"));
    }
  };
  const loginImg = async (e) => {
    const fl = e.target.files[0];
    if (!fl) return;
    if (!fl.type.startsWith("image/")) return toast.error("Pilih file gambar");
    try {
      const up = await uploadFile(fl);
      await api.patch("/workspace", { login_image_file_id: up.id });
      toast.success("Gambar halaman login berhasil diperbarui!");
      reloadWs();
    } catch (er) {
      toast.error(errMsg(er, "Gagal mengupload gambar login"));
    }
  };
  return (
    <Card title="Workspace Identity & Branding" testid="workspace-branding">
      <div className="mb-5 flex flex-wrap items-center gap-4 rounded-2xl border bg-surface2/50 p-4">
        <Logo ws={ws} size={56} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">Foto Profil / Logo Workspace</p>
          <p className="text-xs text-sub">Tampil di header sidebar, login, dan seluruh workspace CIRCLE.</p>
          <div className="mt-2 flex items-center gap-3">
            <label className="cursor-pointer rounded-xl bg-brand px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:opacity-90 transition-opacity">
              Ubah Foto Profil Workspace
              <input type="file" accept="image/*" hidden onChange={logo} data-testid="logo-upload-input" />
            </label>
            {ws.logo_file_id && (
              <button onClick={() => run(() => api.patch("/workspace", { logo_file_id: null }), "Logo dihapus").then(reloadWs)} className="text-xs text-rose-500 hover:underline">
                Hapus Logo Kustom
              </button>
            )}
          </div>
        </div>
      </div>
      <div className="mb-5 flex flex-wrap items-center gap-4 rounded-2xl border bg-surface2/50 p-4" data-testid="login-image-setting">
        <img
          src={ws.login_image_file_id && ws.login_image_file_id !== "default_login_bg" ? `/api/public/login-image/${ws.login_image_file_id}` : "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=400&auto=format&fit=crop&q=80"}
          alt="Gambar login"
          onError={(e) => { e.currentTarget.src = "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=400&auto=format&fit=crop&q=80"; }}
          className="h-16 w-28 rounded-xl object-cover shadow-sm border"
          data-testid="login-image-preview"
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">Gambar Halaman Login (Hero Cover)</p>
          <p className="text-xs text-sub">Background ilustrasi di sisi kiri halaman masuk (Login).</p>
          <div className="mt-2 flex items-center gap-3">
            <label className="cursor-pointer rounded-xl bg-brand px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:opacity-90 transition-opacity">
              Ubah Gambar Login
              <input type="file" accept="image/*" hidden onChange={loginImg} data-testid="login-image-upload-input" />
            </label>
            {ws.login_image_file_id && (
              <button onClick={() => run(() => api.patch("/workspace", { login_image_file_id: null }), "Kembali ke gambar default").then(reloadWs)} className="text-xs text-sub hover:underline" data-testid="login-image-reset">
                Pakai Default
              </button>
            )}
          </div>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {[["brand_name", "App name"], ["name", "Workspace name"], ["tagline", "Tagline"], ["description", "Description"], ["org_levels", "Organization levels (comma separated)"]].map(([k, l]) => <label key={k} className="text-xs font-semibold text-sub">{l}<input value={f[k] || ""} onChange={(e) => setF({ ...f, [k]: e.target.value })} className={`${inp} mt-1 w-full`} data-testid={`ws-${k}-input`} /></label>)}
      </div>
      <button onClick={() => run(() => api.patch("/workspace", { ...f, org_levels: f.org_levels.split(",").map((x) => x.trim()).filter(Boolean) }), "Workspace saved").then(reloadWs)} className="btn-accent mt-4 h-10 px-5 text-sm font-semibold" data-testid="ws-save-btn">Save</button>
    </Card>
  );
}

export function DivisionsAdmin() {
  const { reloadWs } = useApp();
  const [list, setList] = useState(null);
  const [n, setN] = useState("");
  useEffect(() => { api.get("/workspace").then((r) => setList(r.data.divisions || [])); }, []);
  const save = (l) => run(() => api.patch("/workspace", { divisions: l }), "Divisi disimpan").then((ok) => { if (ok) { setList(l); reloadWs(); } });
  const add = () => { if (n.trim() && !list.includes(n.trim())) { save([...list, n.trim()]); setN(""); } };
  if (!list) return null;
  return (
    <Card title="Daftar divisi (form profil karyawan baru)" testid="divisions-admin">
      <div className="flex gap-2"><input value={n} onChange={(e) => setN(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} placeholder="Nama divisi" className={`${inp} flex-1`} data-testid="division-name-input" /><button onClick={add} className="btn-accent h-10 px-4 text-sm font-semibold" data-testid="division-add-btn"><Plus size={14} /></button></div>
      <div className="mt-3 flex flex-wrap gap-2">{list.map((d) => <span key={d} className="flex items-center gap-1.5 rounded-full bg-surface2 px-3 py-1.5 text-sm" data-testid={`division-item-${d.replace(/\s/g, "-")}`}>{d}<button onClick={() => save(list.filter((x) => x !== d))} className="text-sub hover:text-rose-500" aria-label={`Hapus ${d}`} data-testid={`division-remove-${d.replace(/\s/g, "-")}`}><Trash2 size={12} /></button></span>)}{!list.length && <span className="text-sm text-sub">Belum ada divisi.</span>}</div>
    </Card>
  );
}

function ColorSwatch({ value, onSave, testid }) {
  const [c, setC] = useState(value);
  const timer = useRef(null);
  useEffect(() => { setC(value); }, [value]);
  const change = (v) => { setC(v); clearTimeout(timer.current); timer.current = setTimeout(() => v.toLowerCase() !== value.toLowerCase() && onSave(v), 600); };
  return <input type="color" value={c} onChange={(e) => change(e.target.value)} className="h-8 w-8" aria-label="Warna item" data-testid={testid} />;
}

export function ItemTypesAdmin() {
  const { ws, reloadWs } = useApp();
  const [n, setN] = useState("");
  const list = ws.item_types || [];
  const save = (l, msg) => run(() => api.patch("/workspace", { item_types: l }), msg).then(reloadWs);
  const add = () => n.trim() && run(() => api.post("/item-types", { name: n.trim() }), "Item ditambahkan").then(() => { setN(""); reloadWs(); });
  return (
    <Card title="Jenis item task (kolom Item)" testid="item-types-admin">
      <p className="mb-3 text-xs text-sub">Semua orang bisa menambah item baru dari tabel task. Di sini admin bisa mengubah warna atau menghapusnya.</p>
      <div className="flex gap-2"><input value={n} onChange={(e) => setN(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} placeholder="Nama item" className={`${inp} flex-1`} data-testid="item-type-name-input" /><button onClick={add} className="btn-accent h-10 px-4 text-sm font-semibold" data-testid="item-type-add-btn"><Plus size={14} /></button></div>
      <div className="mt-3 divide-y">{list.map((it, i) => (
        <div key={it.name} className="flex items-center gap-3 py-2" data-testid={`item-type-row-${it.name.replace(/\s/g, "-")}`}>
          <ColorSwatch value={it.color} onSave={(c) => save(list.map((x, j) => (j === i ? { ...x, color: c } : x)), "Warna disimpan")} testid={`item-type-color-${it.name.replace(/\s/g, "-")}`} />
          <span className="flex-1"><ItemChip name={it.name} /></span>
          <button onClick={() => save(list.filter((_, j) => j !== i), "Item dihapus")} className="text-sub hover:text-rose-500" aria-label={`Hapus ${it.name}`} data-testid={`item-type-remove-${it.name.replace(/\s/g, "-")}`}><Trash2 size={14} /></button>
        </div>))}</div>
    </Card>
  );
}

export function LabelsAdmin() {
  const { labels, reloadLabels, isManager } = useApp();
  const [n, setN] = useState({ name: "", color: "#2F7DE1", description: "" });
  return (
    <Card title="IP / Brand labels" testid="labels-admin">
      <div className="mb-4 flex flex-wrap gap-2"><input value={n.name} onChange={(e) => setN({ ...n, name: e.target.value })} placeholder="Label name" className={`${inp} flex-1`} data-testid="label-name-input" /><input type="color" value={n.color} onChange={(e) => setN({ ...n, color: e.target.value })} className="h-10 w-12" aria-label="Color" /><input value={n.description} onChange={(e) => setN({ ...n, description: e.target.value })} placeholder="Description" className={`${inp} flex-1`} />
        <button onClick={() => run(() => api.post("/labels", n), "Label created").then((ok) => { if (ok) { setN({ name: "", color: "#2F7DE1", description: "" }); reloadLabels(); } })} className="btn-accent h-10 px-4 text-sm font-semibold" data-testid="label-create-btn"><Plus size={14} /></button></div>
      <div className="divide-y">{labels.map((l) => (
        <div key={l.id} className="flex flex-wrap items-center gap-2 py-2" data-testid={`label-row-${l.id}`}>
          <input type="color" value={l.color} disabled={!isManager} onChange={(e) => run(() => api.patch(`/labels/${l.id}`, { color: e.target.value })).then(reloadLabels)} className="h-8 w-8" aria-label="Label color" data-testid={`label-color-${l.id}`} />
          <input defaultValue={l.name} disabled={!isManager} onBlur={(e) => e.target.value !== l.name && run(() => api.patch(`/labels/${l.id}`, { name: e.target.value }), "Renamed").then(reloadLabels)} className="h-9 w-40 rounded-lg border bg-surface2 px-2 text-sm" data-testid={`label-name-${l.id}`} />
          <LabelChip label={l} small /><span className="flex-1 truncate text-xs text-sub">{l.description}</span>
          {isManager && <><button onClick={() => run(() => api.patch(`/labels/${l.id}`, { archived: !l.archived }), l.archived ? "Restored" : "Archived").then(reloadLabels)} className="text-xs font-semibold text-sub" data-testid={`label-archive-${l.id}`}>{l.archived ? "Restore" : "Archive"}</button>
            <button onClick={() => run(() => api.delete(`/labels/${l.id}`), "Deleted").then(reloadLabels)} className="text-rose-500" aria-label="Delete label" data-testid={`label-delete-${l.id}`}><Trash2 size={14} /></button></>}
        </div>))}</div>
    </Card>
  );
}

export function StatusesAdmin() {
  const { ws, reloadWs } = useApp();
  const [list, setList] = useState((ws.task_statuses || []).map((s) => typeof s === "string" ? { key: s, name: s.replace(/_/g, " "), color: "#F0F4FA", is_done: s === "done" } : { key: s.key || `st_${Math.random()}`, name: s.name || "Status", color: s.color || "#F0F4FA", is_done: !!s.is_done }));
  const mv = (i, d) => { const l = [...list]; [l[i], l[i + d]] = [l[i + d], l[i]]; setList(l); };
  return (
    <Card title="Task statuses" testid="statuses-admin">
      <div className="space-y-2">{list.map((s, i) => (
        <div key={s.key || i} className="flex flex-wrap items-center gap-2"><input type="color" value={s.color} onChange={(e) => setList(list.map((x, j) => (j === i ? { ...x, color: e.target.value } : x)))} className="h-9 w-9" aria-label="Status color" />
          <input value={s.name} onChange={(e) => setList(list.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} className={`${inp} flex-1`} data-testid={`status-name-${s.key || i}`} />
          <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={s.is_done} onChange={(e) => setList(list.map((x, j) => (j === i ? { ...x, is_done: e.target.checked } : x)))} className="accent-[var(--c-accent)]" />Done</label>
          <button disabled={!i} onClick={() => mv(i, -1)} className="text-sub disabled:opacity-30" aria-label="Up"><ArrowUp size={14} /></button><button disabled={i === list.length - 1} onClick={() => mv(i, 1)} className="text-sub disabled:opacity-30" aria-label="Down"><ArrowDown size={14} /></button>
          <button onClick={() => setList(list.filter((_, j) => j !== i))} className="text-rose-500" aria-label="Remove status"><Trash2 size={14} /></button></div>))}</div>
      <div className="mt-3 flex gap-2"><button onClick={() => setList([...list, { key: `st_${Date.now().toString(36)}`, name: "New status", color: "#EEE6FF", is_done: false }])} className="btn-ghost h-10 border px-4 text-sm font-semibold" data-testid="add-status-btn">Add status</button>
        <button onClick={() => run(() => api.put("/settings/task-config", { task_statuses: list }), "Statuses saved").then(reloadWs)} className="btn-accent h-10 px-4 text-sm font-semibold" data-testid="save-statuses-btn">Save</button></div>
    </Card>
  );
}

const TYPES = ["short_text", "long_text", "email", "phone", "date", "dropdown", "multi_select", "url", "boolean", "location"];
export function ProfileFieldsAdmin() {
  const { ws, reloadWs } = useApp();
  const [fields, setFields] = useState(ws.profile_fields || []);
  const [vis, setVis] = useState(ws.field_visibility || {});
  const upd = (i, p) => setFields(fields.map((f, j) => (j === i ? { ...f, ...p } : f)));
  const mv = (i, d) => { const l = [...fields]; [l[i], l[i + d]] = [l[i + d], l[i]]; setFields(l); };
  const V = ({ value, onChange, testid }) => <select value={value} onChange={(e) => onChange(e.target.value)} className="h-9 rounded-lg border bg-surface2 px-2 text-xs" data-testid={testid}><option value="everyone">Everyone</option><option value="managers">Managers</option><option value="admins">Admins only</option></select>;
  return (
    <Card title="Employee profile fields" testid="profile-fields-admin">
      <p className="mb-2 text-xs font-semibold text-sub">Standard field visibility</p>
      <div className="mb-5 grid gap-2 sm:grid-cols-2">{["email", "phone", "employee_id", "employment_status", "join_date"].map((k) => <div key={k} className="flex items-center justify-between rounded-xl bg-surface2 px-3 py-2 text-sm">{k.replace("_", " ")}<V value={vis[k] || "everyone"} onChange={(v) => setVis({ ...vis, [k]: v })} testid={`vis-${k}`} /></div>)}</div>
      <p className="mb-2 text-xs font-semibold text-sub">Custom fields</p>
      <div className="space-y-2">{fields.map((f, i) => (
        <div key={f.key} className="flex flex-wrap items-center gap-2 rounded-xl border p-2">
          <input value={f.name} onChange={(e) => upd(i, { name: e.target.value })} className="h-9 flex-1 rounded-lg border bg-surface2 px-2 text-sm" data-testid={`cf-name-${i}`} />
          <select value={f.type} onChange={(e) => upd(i, { type: e.target.value })} className="h-9 rounded-lg border bg-surface2 px-2 text-xs">{TYPES.map((t) => <option key={t} value={t}>{t.replace("_", " ")}</option>)}</select>
          {["dropdown", "multi_select"].includes(f.type) && <input defaultValue={(f.options || []).join(", ")} onBlur={(e) => upd(i, { options: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) })} placeholder="Options, comma separated" className="h-9 rounded-lg border bg-surface2 px-2 text-xs" />}
          <V value={f.visibility} onChange={(v) => upd(i, { visibility: v })} />
          <button disabled={!i} onClick={() => mv(i, -1)} className="text-sub disabled:opacity-30" aria-label="Up"><ArrowUp size={14} /></button>
          <button onClick={() => setFields(fields.filter((_, j) => j !== i))} className="text-rose-500" aria-label="Remove field"><Trash2 size={14} /></button>
        </div>))}</div>
      <div className="mt-3 flex gap-2"><button onClick={() => setFields([...fields, { name: "New field", type: "short_text", visibility: "everyone", options: [] }])} className="btn-ghost h-10 border px-4 text-sm font-semibold" data-testid="add-profile-field-btn">Add field</button>
        <button onClick={() => run(() => api.put("/settings/profile-fields", { fields, field_visibility: vis }), "Fields saved").then(reloadWs)} className="btn-accent h-10 px-4 text-sm font-semibold" data-testid="save-profile-fields-btn">Save</button></div>
    </Card>
  );
}

export function StickersAdmin() {
  const [name, setName] = useState("");
  const [data, setData] = useState(null);
  const load = () => api.get("/stickers").then((r) => setData(r.data));
  useEffect(() => { load(); }, []);

  const handleCreatePack = async () => {
    if (!name.trim()) return toast.error("Ketik nama paket stiker");
    try {
      await api.post("/sticker-packs", { name: name.trim(), category: name.trim() });
      toast.success(`Paket stiker "${name.trim()}" berhasil dibuat`);
      setName("");
      load();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  const handleDeleteSticker = async (stkId) => {
    try {
      await api.delete(`/stickers/${stkId}`);
      toast.success("Stiker berhasil dihapus");
      load();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  return (
    <Card title="Paket & Perpustakaan Stiker Workspace" testid="stickers-admin">
      <div className="space-y-4">
        <p className="text-xs text-sub leading-relaxed">
          Kelola paket stiker dan perpustakaan stiker workspace CIRCLE. Anggota tim juga dapat membuat stiker custom sendiri secara langsung dari sticker picker di obrolan chat.
        </p>

        <div className="flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nama paket stiker baru (mis. Marketing Memes, Squad Reactions)"
            className={`${inp} flex-1 text-xs`}
            data-testid="pack-name-input"
          />
          <button
            type="button"
            onClick={handleCreatePack}
            className="btn-accent h-10 px-4 text-xs font-bold shrink-0"
            data-testid="pack-create-btn"
          >
            Buat Paket
          </button>
        </div>

        <div>
          <h4 className="text-xs font-bold text-sub mb-2">Paket Stiker Aktif ({data?.packs?.length || 0}):</h4>
          <ul className="grid gap-2 sm:grid-cols-2">
            {(data?.packs || []).map((p) => {
              const count = (data?.stickers || []).filter((s) => s.pack_id === p.id || s.category === p.category).length;
              return (
                <li key={p.id} className="rounded-xl border bg-surface2 px-3 py-2 text-xs flex items-center justify-between">
                  <div>
                    <span className="font-bold text-ink">{p.name}</span>
                    <span className="ml-1.5 text-[11px] text-sub">({count} stiker)</span>
                  </div>
                  <span className="text-[10px] font-semibold text-sub rounded-full bg-surface px-2 py-0.5 border">
                    {p.workspace_id === "global" ? "Bawaan Sistem" : "Paket Custom"}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Custom Stickers Section */}
        <div>
          <h4 className="text-xs font-bold text-sub mb-2">Total Stiker Tersedia ({(data?.stickers || []).length}):</h4>
          <div className="flex flex-wrap gap-2 max-h-60 overflow-y-auto p-2 rounded-xl border bg-surface2/30">
            {(data?.stickers || []).map((s) => (
              <div key={s.id} className="relative group flex items-center justify-center p-1.5 rounded-xl border bg-surface shadow-2xs">
                <span className="text-2xl">{s.emoji || "✨"}</span>
                <span className="text-[9px] font-extrabold max-w-[70px] truncate ml-1 text-ink">{s.name}</span>
                {s.category === "Custom" && (
                  <button
                    type="button"
                    onClick={() => handleDeleteSticker(s.id)}
                    className="ml-1 text-sub hover:text-rose-500 text-xs font-bold"
                    title="Hapus stiker"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}

export function AssistantBranding() {
  const { ws, reloadWs, isAdmin } = useApp();
  const [name, setName] = useState(ws.assistant_name || "Circle");
  const [avatar, setAvatar] = useState(ws.assistant_avatar || "");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    setName(ws.assistant_name || "Circle");
    setAvatar(ws.assistant_avatar || "");
  }, [ws]);

  if (!isAdmin) return null;

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const res = await uploadFile(file);
      const fileId = res.id || res.file_id || res.data?.id;
      if (!fileId) throw new Error("ID file tidak ditemukan.");
      const uploadedUrl = fileUrl(fileId);
      setAvatar(uploadedUrl);
      await api.patch("/workspace", { assistant_avatar: uploadedUrl });
      toast.success("Foto profil chatbot berhasil diperbarui & disimpan!");
      reloadWs();
    } catch (e) {
      toast.error(errMsg(e, "Gagal mengunggah foto"));
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleReset = async () => {
    setAvatar("");
    try {
      await api.patch("/workspace", { assistant_avatar: "" });
      toast.success("Foto profil dikembalikan ke default");
      reloadWs();
    } catch (e) {
      toast.error(errMsg(e, "Gagal mereset foto profil"));
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      await api.patch("/workspace", { assistant_name: name, assistant_avatar: avatar });
      toast.success("Pengaturan Circle Assistant berhasil disimpan!");
      reloadWs();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setSaving(false);
    }
  };

  const defaultAvatar = "https://api.dicebear.com/7.x/bottts/svg?seed=CircleWorkspace&backgroundColor=FF5364";
  const displayAvatar = avatar || defaultAvatar;

  return (
    <Card title="Pengaturan Circle Assistant (AI Bot)" testid="assistant-branding-card">
      {/* Bot Avatar Section - Matches Workspace Identity & Branding card style */}
      <div className="mb-5 flex flex-wrap items-center gap-4 rounded-2xl border bg-surface2/50 p-4">
        <img
          src={displayAvatar}
          alt={name}
          className="h-14 w-14 rounded-2xl object-cover shadow-sm border bg-surface"
          onError={(e) => { e.currentTarget.src = defaultAvatar; }}
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">Foto Profil / Avatar Assistant</p>
          <p className="text-xs text-sub">Foto profil asisten AI yang muncul pada obrolan pesan, notifikasi, dan tugas.</p>
          <div className="mt-2 flex items-center gap-3">
            <input type="file" ref={fileInputRef} onChange={handleUpload} accept="image/*" className="hidden" />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="cursor-pointer rounded-xl bg-brand px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:opacity-90 transition-opacity disabled:opacity-50"
              data-testid="upload-bot-avatar-btn"
            >
              {uploading ? "Mengunggah..." : "Ubah Foto Profil Bot"}
            </button>
            {avatar && (
              <button
                type="button"
                onClick={handleReset}
                className="text-xs text-sub hover:underline"
                data-testid="reset-bot-avatar-btn"
              >
                Pakai Default
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Bot Name & Save Settings */}
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-xs font-semibold text-sub">Nama Circle Assistant</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Mis. Circle, Assistant, Soni"
            className="h-10 w-full rounded-xl border bg-surface2 px-3 text-sm outline-none font-medium"
            data-testid="assistant-name-input"
          />
        </div>
        <button
          onClick={save}
          disabled={saving || uploading}
          className="btn-accent h-10 px-5 rounded-xl text-xs font-bold disabled:opacity-50"
          data-testid="assistant-save-btn"
        >
          {saving ? "Menyimpan..." : "Simpan Perubahan Assistant"}
        </button>
      </div>
    </Card>
  );
}
