import { useState } from "react";
import { Download, Smartphone, Share, PlusSquare, CheckCircle2, WifiOff, X } from "lucide-react";
import { usePWAInstall, useOnlineStatus } from "../hooks/usePWAInstall";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { toast } from "sonner";

export function PWAInstallButton({ variant = "default", compact = false }) {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled) {
    if (variant === "card") {
      return (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/70 dark:bg-emerald-950/30 p-3.5">
          <CheckCircle2 size={20} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-ink">Aplikasi PWA Terpasang</p>
            <p className="text-[11px] text-sub">CIRCLE berjalan dalam mode aplikasi mandiri (Standalone).</p>
          </div>
        </div>
      );
    }
    return null;
  }

  const handleInstallClick = async () => {
    if (isInstallable) {
      const accepted = await install();
      if (accepted) {
        toast.success("Aplikasi CIRCLE berhasil dipasang ke perangkat Anda!");
      }
    } else {
      setShowGuide(true);
    }
  };

  return (
    <>
      {variant === "mobile-header" ? (
        <button
          type="button"
          onClick={handleInstallClick}
          className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-brand px-3 text-xs font-bold text-white shadow-xs active:scale-95 transition-transform shrink-0"
          aria-label="Install Aplikasi PWA"
          data-testid="pwa-install-mobile-btn"
        >
          <Download size={14} />
          <span>Install</span>
        </button>
      ) : variant === "sidebar" ? (
        <button
          type="button"
          onClick={handleInstallClick}
          title="Install Aplikasi CIRCLE (PWA)"
          className={`flex w-full items-center gap-2.5 rounded-xl border border-brand/30 bg-brand/10 text-brand hover:bg-brand hover:text-white transition-colors font-semibold text-xs ${
            compact ? "h-10 w-10 justify-center p-0 mx-auto" : "h-10 px-3"
          }`}
          data-testid="pwa-install-sidebar-btn"
        >
          <Download size={16} className="shrink-0" />
          {!compact && <span className="truncate">Install Aplikasi PWA</span>}
        </button>
      ) : variant === "card" ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-surface2/60 p-3.5">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand text-white shadow-xs">
              <Smartphone size={19} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-ink">Pasang CIRCLE di Layar Utama</p>
              <p className="text-[11px] text-sub">Akses lebih cepat, layar penuh, dan dukungan offline.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleInstallClick}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-brand px-4 text-xs font-bold text-white shadow-xs hover:opacity-95 active:scale-95 transition-all shrink-0"
            data-testid="pwa-install-card-btn"
          >
            <Download size={14} />
            <span>Install App</span>
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={handleInstallClick}
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand px-4 text-xs font-bold text-white shadow-xs hover:opacity-95 active:scale-95 transition-all shrink-0"
          data-testid="pwa-install-btn"
        >
          <Download size={15} />
          <span>{isIOS ? "Install di iOS" : "Install App"}</span>
        </button>
      )}

      <Dialog open={showGuide} onOpenChange={setShowGuide}>
        <DialogContent className="max-w-sm rounded-3xl bg-surface p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2.5 text-base font-bold text-ink">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand text-white">
                <Smartphone size={18} />
              </div>
              <span>Install Aplikasi CIRCLE (PWA)</span>
            </DialogTitle>
          </DialogHeader>

          <div className="mt-2 space-y-4 text-sm">
            <p className="text-xs text-sub leading-relaxed">
              Pasang <strong>CIRCLE Workspace</strong> langsung di perangkat Anda untuk pengalaman aplikasi penuh (fullscreen), notifikasi instan, dan akses cepat tanpa bar browser.
            </p>

            {isIOS ? (
              <div className="space-y-2.5 rounded-2xl border bg-surface2/60 p-3.5">
                <p className="text-xs font-bold text-ink">Panduan untuk iPhone / iPad (Safari):</p>
                <div className="flex items-start gap-2.5 text-xs text-sub">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand text-[11px] font-bold text-white">1</span>
                  <p>Ketuk ikon <strong>Bagikan (Share)</strong> <Share size={13} className="inline text-brand mx-0.5" /> di bilah bawah Safari.</p>
                </div>
                <div className="flex items-start gap-2.5 text-xs text-sub">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand text-[11px] font-bold text-white">2</span>
                  <p>Gulir ke bawah dan pilih <strong>Tambah ke Layar Utama (Add to Home Screen)</strong> <PlusSquare size={13} className="inline text-brand mx-0.5" />.</p>
                </div>
                <div className="flex items-start gap-2.5 text-xs text-sub">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand text-[11px] font-bold text-white">3</span>
                  <p>Ketuk <strong>Tambah (Add)</strong> di pojok kanan atas.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-2.5 rounded-2xl border bg-surface2/60 p-3.5">
                <p className="text-xs font-bold text-ink">Panduan untuk Android / Chrome / Desktop:</p>
                <div className="flex items-start gap-2.5 text-xs text-sub">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand text-[11px] font-bold text-white">1</span>
                  <p>Buka aplikasi di tab browser penuh (di luar pratinjau jendela jika ada).</p>
                </div>
                <div className="flex items-start gap-2.5 text-xs text-sub">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand text-[11px] font-bold text-white">2</span>
                  <p>Ketuk menu browser <strong>(⋮)</strong> atau ikon <strong>Install</strong> di kolom URL atas.</p>
                </div>
                <div className="flex items-start gap-2.5 text-xs text-sub">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand text-[11px] font-bold text-white">3</span>
                  <p>Pilih <strong>Install Aplikasi (Install App / Tambahkan ke Layar Utama)</strong>.</p>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowGuide(false)}
              className="h-10 w-full rounded-xl bg-brand text-xs font-bold text-white shadow-xs hover:opacity-95"
              data-testid="pwa-guide-close-btn"
            >
              Mengerti
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function OfflineIndicator() {
  const isOnline = useOnlineStatus();
  const [dismissed, setDismissed] = useState(false);

  if (isOnline || dismissed) return null;

  return (
    <div
      className="fixed bottom-20 md:bottom-4 left-4 right-4 md:right-auto z-50 flex items-center justify-between gap-3 rounded-2xl bg-amber-600 px-4 py-2.5 text-xs font-semibold text-white shadow-lg"
      data-testid="offline-indicator"
    >
      <div className="flex items-center gap-2">
        <WifiOff size={15} className="shrink-0" />
        <span>Mode Offline — Menggunakan data tersimpan (Cache PWA).</span>
      </div>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="rounded-lg p-1 hover:bg-white/20"
        aria-label="Tutup"
      >
        <X size={14} />
      </button>
    </div>
  );
}
