import { useEffect, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { ShieldCheck, Sparkles, MessageCircle, CheckSquare, Users, Eye, EyeOff, Mail, Lock, User, Building2, Briefcase, CheckCircle2, ArrowRight, ShieldAlert, Check } from "lucide-react";
import { toast } from "sonner";
import { useApp } from "../context/AppContext";
import { api, errMsg } from "../lib/api";
import { Avatar } from "../components/common";
import { googleSignIn } from "../lib/auth";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";

const STATUS_MSG = {
  pending: "Akun Anda sedang dalam proses peninjauan & approval oleh Super Admin. Anda akan bisa masuk setelah akun disetujui.",
  inactive: "Akun Anda telah dinonaktifkan. Silakan hubungi Workspace Administrator.",
  not_allowed: "Akun ini tidak memiliki izin untuk bergabung dengan workspace.",
  error: "Proses masuk gagal. Silakan coba beberapa saat lagi.",
};

const DEFAULT_LOGIN_IMG = "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1200&auto=format&fit=crop&q=80";

const PRESET_AVATARS = [
  "https://api.dicebear.com/7.x/pixel-art/svg?seed=Cat1",
  "https://api.dicebear.com/7.x/pixel-art/svg?seed=Cat2",
  "https://api.dicebear.com/7.x/pixel-art/svg?seed=Cat3",
  "https://api.dicebear.com/7.x/pixel-art/svg?seed=Cat4",
  "https://api.dicebear.com/7.x/pixel-art/svg?seed=Cat5",
  "https://api.dicebear.com/7.x/pixel-art/svg?seed=Cat6",
];

function Floating({ image }) {
  const src = image ? `/api/public/login-image/${image}` : DEFAULT_LOGIN_IMG;
  return (
    <div className="relative hidden lg:flex flex-1 overflow-hidden rounded-[32px] bg-[#20283B] p-10 text-white" data-testid="login-hero">
      <img src={src} alt="Login background" onError={(e) => { e.currentTarget.src = DEFAULT_LOGIN_IMG; }} className="absolute inset-0 h-full w-full object-cover" data-testid="login-hero-image" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#20283B]/90 via-[#20283B]/30 to-transparent" />
      <div className="relative z-10 flex w-full flex-col justify-between">
        <span className="inline-flex w-fit items-center gap-2 rounded-full bg-white/20 px-4 py-1.5 text-sm font-medium backdrop-blur"><Sparkles size={14} />Your Team. One Circle.</span>
        <div>
          <h2 className="max-w-md text-5xl font-extrabold leading-[1.05] tracking-tight">Connect people. Move work forward.</h2>
          <p className="mt-4 max-w-md text-white/85">One workspace to connect your people, manage your work, and keep everything moving.</p>
          <div className="mt-10 grid max-w-lg grid-cols-3 gap-3">
            {[[MessageCircle, "Chat & calls"], [CheckSquare, "Tasks & projects"], [Users, "People & org"]].map(([I, t], i) => (
              <div key={t} className="animate-float rounded-3xl bg-white/90 p-4 text-[#20283B] shadow-xl" style={{ animationDelay: `${i * 0.8}s` }}>
                <I size={20} className="text-[#FF5364]" /><p className="mt-6 text-sm font-semibold">{t}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Login() {
  const { session, setSession } = useApp();
  const [params] = useSearchParams();
  const [brand, setBrand] = useState({});
  const navigate = useNavigate();
  const status = params.get("status");

  // Mode: 'login' | 'signup'
  const [mode, setMode] = useState("login");

  // Login form state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busyLogin, setBusyLogin] = useState(false);
  const [loginAlert, setLoginAlert] = useState(null);

  // Sign Up form state
  const [signupForm, setSignupForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    department: "Engineering",
    job_title: "",
    note: "",
    avatar: PRESET_AVATARS[0]
  });
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [busySignup, setBusySignup] = useState(false);

  // Success dialog state for signup/access request
  const [successDialog, setSuccessDialog] = useState(false);
  const [registeredData, setRegisteredData] = useState(null);

  useEffect(() => {
    api.get("/public/branding").then((r) => setBrand(r.data)).catch(() => {});
  }, []);

  if (session) return <Navigate to="/" replace />;

  // Submit Login
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    if (!loginEmail.trim() || !loginPassword) {
      return toast.error("Email dan password wajib diisi.");
    }
    setBusyLogin(true);
    setLoginAlert(null);
    try {
      const { data } = await api.post("/auth/login", {
        email: loginEmail,
        password: loginPassword,
      });
      setSession(data);
      toast.success("Berhasil masuk ke workspace!");
      navigate("/");
    } catch (err) {
      const respData = err?.response?.data;
      if (respData?.status === "pending") {
        setLoginAlert(respData.detail || "Akun Anda sedang dalam proses peninjauan & approval oleh Super Admin.");
        toast.warning("Akun Anda sedang menunggu persetujuan Super Admin.");
      } else {
        const message = respData?.detail || errMsg(err, "Gagal masuk");
        setLoginAlert(message);
        toast.error(message);
      }
    } finally {
      setBusyLogin(false);
    }
  };

  // Submit Signup
  const handleSignupSubmit = async (e) => {
    e.preventDefault();
    if (!signupForm.name.trim() || !signupForm.email.trim() || !signupForm.password) {
      return toast.error("Nama lengkap, email, dan password wajib diisi.");
    }

    if (signupForm.password.length < 4) {
      return toast.error("Password minimal 4 karakter.");
    }

    if (signupForm.password !== signupForm.confirmPassword) {
      return toast.error("Konfirmasi password tidak cocok dengan password yang dimasukkan.");
    }

    setBusySignup(true);
    try {
      const res = await api.post("/auth/register", signupForm);
      setRegisteredData({ ...signupForm });
      setSuccessDialog(true);
      toast.success(res.data?.detail || "Pendaftaran akun berhasil diajukan!");
      // Reset form
      setSignupForm({
        name: "",
        email: "",
        password: "",
        confirmPassword: "",
        department: "Engineering",
        job_title: "",
        note: "",
        avatar: PRESET_AVATARS[0]
      });
    } catch (err) {
      toast.error(err?.response?.data?.detail || errMsg(err, "Pendaftaran gagal"));
    } finally {
      setBusySignup(false);
    }
  };

  // Google Sign-In
  const google = async () => {
    try {
      const res = await googleSignIn();
      if (res?.user) {
        try {
          const { data } = await api.post("/auth/google", {
            email: res.user.email,
            name: res.user.displayName,
            picture: res.user.photoURL,
          });
          setSession(data);
          navigate("/");
          toast.success("Berhasil masuk menggunakan Google");
        } catch (errPost) {
          const statusResp = errPost?.response?.data?.status;
          if (statusResp === "need_access_request") {
            setMode("signup");
            setSignupForm((prev) => ({
              ...prev,
              name: res.user.displayName || "",
              email: res.user.email || "",
              avatar: res.user.photoURL || prev.avatar,
              note: "Sign Up via Google OAuth"
            }));
            toast.info("Email Google Anda belum terdaftar. Silakan lengkapi formulir pendaftaran.");
          } else if (statusResp === "pending") {
            toast.warning(errPost?.response?.data?.detail || "Akun Anda sedang menunggu persetujuan Super Admin.");
          } else {
            toast.error(errMsg(errPost));
          }
        }
      }
    } catch (e) {
      toast.error(errMsg(e, "Google sign-in gagal"));
    }
  };

  return (
    <div className="flex min-h-screen bg-background p-3 sm:p-5">
      <Floating image={brand.login_image_file_id} />
      <div className="flex flex-1 items-center justify-center px-4 py-8 lg:max-w-[620px] overflow-y-auto">
        <div className="w-full max-w-md py-8 animate-rise">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-ink mb-8">
            {mode === "login" ? "Selamat Datang Kembali" : "Daftar Akun Baru"}
          </h1>

          {/* Tab Switcher: Login vs Sign Up */}
          <div className="flex rounded-2xl bg-surface2 p-1.5 border mb-6 shadow-xs" data-testid="auth-tab-group">
            <button
              type="button"
              onClick={() => { setMode("login"); setLoginAlert(null); }}
              className={`flex-1 rounded-xl py-2.5 text-xs font-bold transition-all ${
                mode === "login"
                  ? "bg-surface text-ink shadow-sm"
                  : "text-sub hover:text-ink"
              }`}
              data-testid="tab-login"
            >
              Masuk (Login)
            </button>
            <button
              type="button"
              onClick={() => setMode("signup")}
              className={`flex-1 rounded-xl py-2.5 text-xs font-bold transition-all ${
                mode === "signup"
                  ? "bg-surface text-ink shadow-sm"
                  : "text-sub hover:text-ink"
              }`}
              data-testid="tab-signup"
            >
              Daftar Akun (Sign Up)
            </button>
          </div>

          {/* URL Status Message if present */}
          {status && (
            <div className="mb-5 rounded-2xl border bg-soft-yellow p-3.5 text-xs text-amber-900 dark:text-amber-100 flex items-start gap-2.5 leading-relaxed" data-testid="login-status-message">
              <ShieldAlert size={17} className="shrink-0 mt-0.5 text-amber-600" />
              <span>{STATUS_MSG[status] || STATUS_MSG.error}</span>
            </div>
          )}

          {/* Alert Message for Login */}
          {loginAlert && (
            <div className="mb-5 rounded-2xl border border-amber-300 bg-amber-50 dark:bg-amber-950/40 p-3.5 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2.5 leading-relaxed animate-fadeIn">
              <ShieldAlert size={17} className="shrink-0 mt-0.5 text-amber-600" />
              <span>{loginAlert}</span>
            </div>
          )}

          {/* FORM 1: LOGIN (Email & Password) */}
          {mode === "login" && (
            <form onSubmit={handleLoginSubmit} className="space-y-4 animate-fadeIn" data-testid="login-form">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-sub">Alamat Email *</label>
                <div className="relative flex items-center">
                  <Mail size={16} className="absolute left-3.5 text-sub" />
                  <input
                    type="email"
                    required
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="nama@asliri.id atau email perusahaan"
                    className="h-11 w-full rounded-2xl border bg-surface pl-10 pr-4 text-xs text-ink outline-none transition-colors focus:border-brand"
                    data-testid="login-email-input"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-sub">Password *</label>
                  <span className="text-[11px] text-sub">Minimal 4 karakter</span>
                </div>
                <div className="relative flex items-center">
                  <Lock size={16} className="absolute left-3.5 text-sub" />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="Masukkan password"
                    className="h-11 w-full rounded-2xl border bg-surface pl-10 pr-10 text-xs text-ink outline-none transition-colors focus:border-brand"
                    data-testid="login-password-input"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 text-sub hover:text-ink cursor-pointer"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={busyLogin}
                className="btn-accent h-11 w-full rounded-2xl text-xs font-bold shadow-md transition-all hover:shadow-lg disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer mt-2"
                data-testid="login-submit-btn"
              >
                {busyLogin ? "Memproses..." : "Masuk ke Workspace"}
                <ArrowRight size={15} />
              </button>
            </form>
          )}

          {/* FORM 2: SIGN UP (Email & Create Password & Avatar Selection) */}
          {mode === "signup" && (
            <form onSubmit={handleSignupSubmit} className="space-y-4 animate-fadeIn" data-testid="signup-form">
              {/* Avatar selection */}
              <div className="rounded-2xl border bg-surface2 p-3.5">
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-xs font-semibold text-sub">Foto Profil (Avatar)</span>
                  <span className="text-[10px] text-sub">Bisa diubah lagi di Setting</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="relative shrink-0">
                    <img
                      src={signupForm.avatar}
                      alt="Selected Avatar"
                      className="h-12 w-12 rounded-full object-cover border-2 border-brand shadow-sm"
                    />
                    <div className="absolute -bottom-1 -right-1 bg-brand text-white rounded-full p-0.5">
                      <Check size={10} strokeWidth={3} />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5 mb-2">
                      {PRESET_AVATARS.map((avUrl, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setSignupForm({ ...signupForm, avatar: avUrl })}
                          className={`h-7 w-7 rounded-full overflow-hidden border-2 transition-transform hover:scale-110 cursor-pointer ${
                            signupForm.avatar === avUrl ? "border-brand ring-2 ring-brand/30 scale-105" : "border-transparent opacity-65 hover:opacity-100"
                          }`}
                        >
                          <img src={avUrl} alt={`Avatar ${idx}`} className="h-full w-full object-cover" />
                        </button>
                      ))}
                    </div>
                    <input
                      type="url"
                      value={signupForm.avatar}
                      onChange={(e) => setSignupForm({ ...signupForm, avatar: e.target.value })}
                      placeholder="Atau tempel URL gambar..."
                      className="h-7 w-full rounded-lg border bg-surface px-2 text-[10px] text-ink outline-none focus:border-brand"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-sub">Nama Lengkap *</label>
                <div className="relative flex items-center">
                  <User size={16} className="absolute left-3.5 text-sub" />
                  <input
                    type="text"
                    required
                    value={signupForm.name}
                    onChange={(e) => setSignupForm({ ...signupForm, name: e.target.value })}
                    placeholder="Contoh: Saeful Hidayat"
                    className="h-10 w-full rounded-2xl border bg-surface pl-10 pr-4 text-xs text-ink outline-none transition-colors focus:border-brand"
                    data-testid="signup-name-input"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-sub">Alamat Email *</label>
                <div className="relative flex items-center">
                  <Mail size={16} className="absolute left-3.5 text-sub" />
                  <input
                    type="email"
                    required
                    value={signupForm.email}
                    onChange={(e) => setSignupForm({ ...signupForm, email: e.target.value })}
                    placeholder="email.anda@asliri.id atau domain kantor"
                    className="h-10 w-full rounded-2xl border bg-surface pl-10 pr-4 text-xs text-ink outline-none transition-colors focus:border-brand"
                    data-testid="signup-email-input"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-sub">Password *</label>
                  <div className="relative flex items-center">
                    <Lock size={15} className="absolute left-3 text-sub" />
                    <input
                      type={showSignupPassword ? "text" : "password"}
                      required
                      value={signupForm.password}
                      onChange={(e) => setSignupForm({ ...signupForm, password: e.target.value })}
                      placeholder="Password"
                      className="h-10 w-full rounded-2xl border bg-surface pl-9 pr-8 text-xs text-ink outline-none transition-colors focus:border-brand"
                      data-testid="signup-password-input"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSignupPassword(!showSignupPassword)}
                      className="absolute right-2.5 text-sub hover:text-ink cursor-pointer"
                    >
                      {showSignupPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-sub">Konfirmasi Password *</label>
                  <div className="relative flex items-center">
                    <Lock size={15} className="absolute left-3 text-sub" />
                    <input
                      type={showSignupPassword ? "text" : "password"}
                      required
                      value={signupForm.confirmPassword}
                      onChange={(e) => setSignupForm({ ...signupForm, confirmPassword: e.target.value })}
                      placeholder="Ulangi"
                      className="h-10 w-full rounded-2xl border bg-surface pl-9 pr-3 text-xs text-ink outline-none transition-colors focus:border-brand"
                      data-testid="signup-confirmpassword-input"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-sub">Divisi</label>
                  <div className="relative flex items-center">
                    <Building2 size={15} className="absolute left-3 text-sub pointer-events-none" />
                    <select
                      value={signupForm.department}
                      onChange={(e) => setSignupForm({ ...signupForm, department: e.target.value })}
                      className="h-10 w-full rounded-2xl border bg-surface pl-9 pr-3 text-xs font-medium text-ink outline-none focus:border-brand cursor-pointer"
                      data-testid="signup-dept-select"
                    >
                      <option value="Engineering">Engineering</option>
                      <option value="Product">Product</option>
                      <option value="Operations">Operations</option>
                      <option value="Design">Design</option>
                      <option value="Marketing">Marketing</option>
                      <option value="Management">Management</option>
                      <option value="HR">HR & Finance</option>
                      <option value="General">General</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-sub">Jabatan / Posisi</label>
                  <div className="relative flex items-center">
                    <Briefcase size={15} className="absolute left-3 text-sub pointer-events-none" />
                    <input
                      type="text"
                      value={signupForm.job_title}
                      onChange={(e) => setSignupForm({ ...signupForm, job_title: e.target.value })}
                      placeholder="Mis. Senior Specialist"
                      className="h-10 w-full rounded-2xl border bg-surface pl-9 pr-3 text-xs text-ink outline-none transition-colors focus:border-brand"
                      data-testid="signup-title-input"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-sub">Catatan (Opsional)</label>
                <textarea
                  rows={2}
                  value={signupForm.note}
                  onChange={(e) => setSignupForm({ ...signupForm, note: e.target.value })}
                  placeholder="Keterangan singkat keperluan bergabung..."
                  className="w-full rounded-2xl border bg-surface p-2.5 text-xs text-ink outline-none focus:border-brand resize-none"
                  data-testid="signup-note-input"
                />
              </div>

              <div className="rounded-xl border border-amber-200 dark:border-amber-800/50 bg-amber-50/70 dark:bg-amber-950/30 p-2.5 text-[11px] text-amber-900 dark:text-amber-200 leading-relaxed">
                <span className="font-semibold">⚠️ Catatan Approval:</span> Akun yang baru didaftarkan akan berstatus <b>pending</b> dan memerlukan persetujuan dari Super Admin sebelum dapat masuk.
              </div>

              <button
                type="submit"
                disabled={busySignup}
                className="btn-accent h-11 w-full rounded-2xl text-xs font-bold shadow-md transition-all hover:shadow-lg disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer mt-2"
                data-testid="signup-submit-btn"
              >
                {busySignup ? "Mengirim Pendaftaran..." : "Daftar & Minta Approval Super Admin"}
              </button>
            </form>
          )}

          {/* SECONDARY METHODS DIVIDER */}
          <div className="my-6 flex items-center gap-3">
            <div className="h-[1px] flex-1 bg-border" />
            <span className="text-[11px] font-medium text-sub">atau opsi sekunder</span>
            <div className="h-[1px] flex-1 bg-border" />
          </div>

          {/* SECONDARY METHOD: Google Sign-In */}
          <button
            onClick={google}
            className="flex h-11 w-full items-center justify-center gap-3 rounded-2xl border bg-surface text-xs font-semibold shadow-xs transition-transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
            data-testid="login-google-button"
          >
            <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>
            Continue with Google
          </button>

          <p className="mt-3.5 flex items-center justify-center gap-1.5 text-[11px] text-sub text-center">
            <ShieldCheck size={13} className="shrink-0 text-emerald-600 dark:text-emerald-400" />
            Semua permohonan akun ditinjau langsung oleh Super Admin workspace.
          </p>
        </div>
      </div>

      {/* Success Registration Dialog */}
      <Dialog open={successDialog} onOpenChange={setSuccessDialog}>
        <DialogContent className="max-w-md rounded-3xl bg-surface p-6 shadow-xl" data-testid="signup-success-dialog">
          <DialogHeader>
            <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
              <CheckCircle2 size={32} />
            </div>
            <DialogTitle className="text-center text-lg font-bold text-ink">Pendaftaran Akun Berhasil!</DialogTitle>
          </DialogHeader>

          <div className="py-2 text-center space-y-3">
            <p className="text-xs text-sub leading-relaxed max-w-xs mx-auto">
              Permohonan pendaftaran akun Anda telah diterima. Asisten <b className="text-ink">Circle</b> telah meneruskan Approval Card ke Super Admin.
            </p>

            {registeredData && (
              <div className="rounded-2xl border bg-surface2 p-3 text-left text-xs space-y-1.5 flex items-center gap-3">
                <Avatar user={{ name: registeredData.name, avatar: registeredData.avatar }} size={42} showStatus={false} />
                <div className="min-w-0 flex-1">
                  <p><span className="text-sub font-medium">Nama:</span> <b className="text-ink">{registeredData.name}</b></p>
                  <p><span className="text-sub font-medium">Email:</span> <b className="text-ink">{registeredData.email}</b></p>
                  <p><span className="text-sub font-medium">Divisi:</span> <b className="text-ink">{registeredData.department}</b></p>
                </div>
              </div>
            )}

            <button
              onClick={() => {
                setSuccessDialog(false);
                setMode("login");
                if (registeredData?.email) {
                  setLoginEmail(registeredData.email);
                }
              }}
              className="btn-accent h-10 w-full rounded-full text-xs font-semibold cursor-pointer"
              data-testid="signup-done-btn"
            >
              Kembali ke Halaman Login
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
