import { useState } from "react";
import { Camera, Save } from "lucide-react";
import { toast } from "sonner";
import { useApp } from "../../context/AppContext";
import { api, errMsg, uploadFile, fileUrl } from "../../lib/api";
import { Card } from "./AdminPanels";

const DEPARTMENTS = ["Engineering", "Product", "Operations", "Design", "Marketing", "General"];

export function UserProfileSettings() {
  const { me, setSession, reloadUsers } = useApp();
  const [f, setF] = useState({
    name: me.name || "",
    job_title: me.job_title || "",
    department: me.department || "Engineering",
    phone: me.phone || "",
    bio: me.bio || "",
    avatar: me.avatar || me.picture || ""
  });
  const [busy, setBusy] = useState(false);

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("Pilih file gambar untuk foto profil");
    try {
      const up = await uploadFile(file);
      const url = fileUrl(up.id);
      setF((prev) => ({ ...prev, avatar: url, picture: url }));

      // Auto-save user photo to backend and sync session state immediately
      const { data } = await api.patch(`/users/${me.user_id}`, { avatar: url, picture: url });
      setSession((s) => ({
        ...s,
        user: { ...s.user, ...data, avatar: url, picture: url }
      }));
      reloadUsers();
      toast.success("Foto profil berhasil diperbarui!");
    } catch (err) {
      toast.error(errMsg(err, "Gagal mengupload foto profil"));
    } finally {
      e.target.value = "";
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!f.name.trim()) {
      return toast.error("Nama lengkap wajib diisi.");
    }
    setBusy(true);
    try {
      const payload = {
        ...f,
        avatar: f.avatar || f.picture || "",
        picture: f.avatar || f.picture || ""
      };
      const { data } = await api.patch(`/users/${me.user_id}`, payload);
      setSession((s) => ({
        ...s,
        user: { ...s.user, ...data, avatar: data.avatar || data.picture, picture: data.avatar || data.picture }
      }));
      reloadUsers();
      toast.success("Data diri lengkap berhasil disimpan!");
    } catch (err) {
      toast.error(errMsg(err, "Gagal menyimpan data diri"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title="Data Diri Lengkap (Profil Pengguna)" testid="user-profile-settings-card">
      <form onSubmit={handleSave} className="space-y-4 pt-1">
        <p className="text-xs text-sub leading-relaxed">
          Ubah informasi profil dan data diri Anda yang akan dilihat oleh rekan kerja di seluruh workspace CIRCLE.
        </p>

        {/* Avatar Upload */}
        <div className="flex items-center gap-4 py-2">
          <div className="relative">
            <img
              src={f.avatar || "https://api.dicebear.com/7.x/initials/svg?seed=" + encodeURIComponent(f.name)}
              alt="Avatar preview"
              className="h-20 w-20 rounded-full object-cover border-2 border-brand/30 shadow-sm"
              onError={(e) => { e.currentTarget.src = "https://api.dicebear.com/7.x/initials/svg?seed=User"; }}
            />
            <label className="absolute bottom-0 right-0 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-brand text-white shadow-md hover:bg-brand/90 transition-colors" title="Ubah foto profil">
              <Camera size={13} />
              <input type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
            </label>
          </div>
          <div>
            <h4 className="text-sm font-bold text-ink">{f.name || "Nama Pengguna"}</h4>
            <p className="text-xs text-sub">{me.email}</p>
            <p className="mt-1 text-[11px] font-semibold text-brand">Role: {me.role?.replace(/_/g, " ").toUpperCase()}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-sub">Nama Lengkap *</label>
            <input
              required
              value={f.name}
              onChange={(e) => setF({ ...f, name: e.target.value })}
              placeholder="Nama lengkap Anda"
              className="h-10 w-full rounded-xl border bg-surface2 px-3 text-xs outline-none focus:border-brand"
              data-testid="profile-name-input"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-sub">Alamat Email (Login)</label>
            <input
              disabled
              value={me.email || ""}
              className="h-10 w-full rounded-xl border bg-surface2/50 px-3 text-xs text-sub cursor-not-allowed"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-sub">Divisi / Departemen</label>
            <select
              value={f.department}
              onChange={(e) => setF({ ...f, department: e.target.value })}
              className="h-10 w-full rounded-xl border bg-surface2 px-2.5 text-xs font-medium outline-none text-ink"
              data-testid="profile-dept-select"
            >
              {DEPARTMENTS.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-sub">Jabatan / Posisi (Job Title)</label>
            <input
              value={f.job_title}
              onChange={(e) => setF({ ...f, job_title: e.target.value })}
              placeholder="Mis. Senior Software Engineer"
              className="h-10 w-full rounded-xl border bg-surface2 px-3 text-xs outline-none focus:border-brand"
              data-testid="profile-title-input"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold text-sub">Nomor Telepon / WhatsApp</label>
          <input
            value={f.phone || ""}
            onChange={(e) => setF({ ...f, phone: e.target.value })}
            placeholder="+62 812-3456-7890"
            className="h-10 w-full rounded-xl border bg-surface2 px-3 text-xs outline-none focus:border-brand"
            data-testid="profile-phone-input"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold text-sub">Bio / Tentang Saya</label>
          <textarea
            rows={3}
            value={f.bio || ""}
            onChange={(e) => setF({ ...f, bio: e.target.value })}
            placeholder="Tuliskan sedikit tentang keahlian atau fokus kerja Anda..."
            className="w-full rounded-xl border bg-surface2 p-3 text-xs outline-none focus:border-brand resize-none"
            data-testid="profile-bio-input"
          />
        </div>

        <div className="flex justify-end pt-2 border-t">
          <button
            type="submit"
            disabled={busy}
            className="btn-accent flex h-10 items-center gap-2 rounded-full px-5 text-xs font-semibold shadow-xs disabled:opacity-50"
            data-testid="profile-save-btn"
          >
            <Save size={14} />
            <span>{busy ? "Menyimpan..." : "Simpan Perubahan Profil"}</span>
          </button>
        </div>
      </form>
    </Card>
  );
}
