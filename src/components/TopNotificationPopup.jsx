import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { X, MessageSquare, Send, Bell, ArrowRight, Clock, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { api, errMsg } from "../lib/api";
import { Avatar } from "./common";
import { playSound } from "../lib/sound";

export default function TopNotificationPopup({ notif, onClose }) {
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(100);
  const [paused, setPaused] = useState(false);
  const navigate = useNavigate();

  const DURATION = 10000; // 10 seconds auto-dismiss

  const isPaused = paused || busy || replyOpen;

  useEffect(() => {
    if (!notif || isPaused) return undefined;
    const interval = 100;
    const step = (interval / DURATION) * 100;

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev <= step) {
          clearInterval(timer);
          onClose();
          return 0;
        }
        return prev - step;
      });
    }, interval);

    return () => clearInterval(timer);
  }, [isPaused, notif, onClose]);

  if (!notif) return null;

  const { title, body, type, sender, access_request, conversation_id, task_id } = notif;

  const handleApprove = async () => {
    if (!access_request?.id) return;
    setBusy(true);
    try {
      await api.post(`/admin/access-requests/${access_request.id}/approve`, {
        role: access_request.assigned_role || "employee",
        department: access_request.department || "General"
      });
      playSound("click");
      toast.success(`Akses untuk ${access_request.name || "karyawan"} berhasil disetujui!`);
      onClose();
    } catch (e) {
      toast.error(errMsg(e, "Gagal menyetujui akses"));
    } finally {
      setBusy(false);
    }
  };

  const handleReject = async () => {
    if (!access_request?.id) return;
    setBusy(true);
    try {
      await api.post(`/admin/access-requests/${access_request.id}/reject`);
      toast.info(`Permintaan akses ditolak.`);
      onClose();
    } catch (e) {
      toast.error(errMsg(e, "Gagal menolak akses"));
    } finally {
      setBusy(false);
    }
  };

  const handleSendReply = async (e) => {
    e.preventDefault();
    if (!replyText.trim() || !conversation_id) return;
    setBusy(true);
    try {
      await api.post(`/conversations/${conversation_id}/messages`, {
        text: replyText.trim()
      });
      playSound("message");
      toast.success("Balasan pesan terkirim!");
      onClose();
    } catch (e) {
      toast.error(errMsg(e, "Gagal membalas pesan"));
    } finally {
      setBusy(false);
    }
  };

  const isAccessReq = type === "access_request" || !!access_request;
  const isMessage = type === "message" || type === "dm" || !!conversation_id;

  return (
    <div
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => !replyOpen && setPaused(false)}
      className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] w-[94%] max-w-lg rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-surface/95 dark:bg-slate-900/95 backdrop-blur-md p-4 shadow-2xl text-ink transition-all animate-in fade-in slide-in-from-top-4 duration-300"
      data-testid="top-notification-popup"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {sender ? (
            <Avatar user={sender} size={40} />
          ) : (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand/10 text-brand font-bold">
              {isAccessReq ? <ShieldCheck size={20} /> : <Bell size={20} />}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h4 className="text-sm font-bold text-ink truncate leading-tight">{title || "Notifikasi Baru"}</h4>
            <p className="text-xs text-sub truncate mt-0.5">{body || "Ada pembaruan di CIRCLE Workspace."}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClose?.();
          }}
          className="rounded-full p-1.5 text-sub hover:bg-surface2 hover:text-ink transition-colors cursor-pointer"
          title="Tutup Notifikasi"
          data-testid="close-top-notif-btn"
        >
          <X size={16} />
        </button>
      </div>

      {/* Quick Action Area */}
      <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800">
        {/* Case 1: Access Request Approval Quick Actions */}
        {isAccessReq && (
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-sub font-medium flex items-center gap-1">
              <Clock size={12} /> Permintaan Akses Masuk
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={busy}
                onClick={handleReject}
                className="h-8 rounded-xl border border-rose-200 bg-rose-50 dark:bg-rose-950/30 px-3 text-xs font-bold text-rose-600 hover:bg-rose-100 transition-colors disabled:opacity-50 cursor-pointer"
                data-testid="notif-quick-reject-btn"
              >
                Tolak
              </button>
              <button
                disabled={busy}
                onClick={handleApprove}
                className="h-8 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-3 text-xs font-bold text-white shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
                data-testid="notif-quick-approve-btn"
              >
                Setujui Akses
              </button>
            </div>
          </div>
        )}

        {/* Case 2: Message / Chat Quick Actions */}
        {isMessage && !isAccessReq && (
          <div className="space-y-2">
            {!replyOpen ? (
              <div className="flex items-center justify-between gap-2">
                <button
                  onClick={() => {
                    setReplyOpen(true);
                    setPaused(true);
                  }}
                  className="flex h-8 items-center gap-1.5 rounded-xl bg-surface2 px-3 text-xs font-semibold text-brand hover:bg-brand/10 transition-colors cursor-pointer"
                  data-testid="notif-quick-reply-toggle"
                >
                  <MessageSquare size={13} /> Balas Chat Cepat
                </button>
                <button
                  onClick={() => {
                    if (conversation_id) navigate(`/messages/${conversation_id}`);
                    else navigate("/messages");
                    onClose();
                  }}
                  className="flex h-8 items-center gap-1 text-xs font-bold text-ink hover:text-brand transition-colors cursor-pointer"
                  data-testid="notif-open-chat-btn"
                >
                  Buka Chat <ArrowRight size={13} />
                </button>
              </div>
            ) : (
              <form onSubmit={handleSendReply} className="flex items-center gap-2">
                <input
                  autoFocus
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Ketik balasan pesan..."
                  className="h-9 flex-1 rounded-xl border bg-surface2 px-3 text-xs text-ink outline-none focus:border-brand"
                  data-testid="notif-reply-input"
                />
                <button
                  type="submit"
                  disabled={busy || !replyText.trim()}
                  className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand text-white font-bold disabled:opacity-50 hover:bg-brand/90 transition-colors cursor-pointer"
                  data-testid="notif-send-reply-btn"
                >
                  <Send size={14} />
                </button>
              </form>
            )}
          </div>
        )}

        {/* Case 3: Task Quick Actions */}
        {task_id && !isAccessReq && !isMessage && (
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={() => {
                navigate(`/tasks?task=${task_id}`);
                onClose();
              }}
              className="h-8 rounded-xl bg-brand text-white px-3 text-xs font-bold shadow-xs hover:bg-brand/90 transition-colors cursor-pointer"
              data-testid="notif-open-task-btn"
            >
              Lihat Tugas
            </button>
          </div>
        )}
      </div>

      {/* 10-Second Auto Dismiss Progress Bar */}
      <div className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
        <div
          className="h-full bg-brand transition-all duration-100 ease-linear"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
