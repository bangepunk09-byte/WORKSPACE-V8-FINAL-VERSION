import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Home,
  MessageCircle,
  Hash,
  Users,
  Network,
  CheckSquare,
  FolderKanban,
  Bell,
  Settings,
  Search,
  Moon,
  Sun,
  LogOut,
  Menu,
  ChevronsLeft,
  ChevronsRight,
  FlaskConical,
  Newspaper,
  CalendarDays,
  Volume2,
  VolumeX,
  HardDrive,
  ChevronRight
} from "lucide-react";
import { useApp } from "../context/AppContext";
import { Avatar, Logo, ROLE_NAMES } from "./common";
import SearchDialog from "./SearchDialog";
import { NotificationRail } from "./NotificationPanel";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "./ui/sheet";
import { isSoundEnabled, setSoundEnabled, playSound } from "../lib/sound";
import TopNotificationPopup from "./TopNotificationPopup";
import { PWAInstallButton, OfflineIndicator } from "./PWAInstallButton";

const NAV = [
  { to: "/", icon: Home, label: "Home", id: "home", group: "main" },
  { to: "/beranda", icon: Newspaper, label: "Beranda", id: "beranda", group: "main" },
  { to: "/messages", icon: MessageCircle, label: "Messages", id: "messages", group: "main" },
  { to: "/schedule", icon: CalendarDays, label: "Schedule", id: "schedule", group: "collab" },
  { to: "/groups", icon: Hash, label: "Groups", id: "groups", group: "collab" },
  { to: "/directory", icon: HardDrive, label: "Directory", id: "directory", group: "collab" },
  { to: "/employee", icon: Users, label: "Employee", id: "employee", group: "org" },
  { to: "/org", icon: Network, label: "Organization", id: "org", group: "org" },
  { to: "/tasks", icon: CheckSquare, label: "Tasks", id: "tasks", group: "main" },
  { to: "/projects", icon: FolderKanban, label: "Projects", id: "projects", group: "org" },
  { to: "/settings", icon: Settings, label: "Settings", id: "settings", group: "sys" },
];

const MOBILE_TABS = [
  { to: "/", icon: Home, label: "Home", id: "home" },
  { to: "/beranda", icon: Newspaper, label: "Beranda", id: "beranda" },
  { to: "/messages", icon: MessageCircle, label: "Pesan", id: "messages" },
  { to: "/tasks", icon: CheckSquare, label: "Tugas", id: "tasks" },
];

function NavItem({ item, compact, unread, onClick }) {
  const { t } = useApp();
  const Icon = item.icon;
  const label = t(`nav_${item.id}`) || item.label;
  return (
    <NavLink
      to={item.to}
      end={item.to === "/"}
      onClick={onClick}
      data-testid={`sidebar-${item.id}-link`}
      title={label}
      className={({ isActive }) =>
        `group relative flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors ${
          isActive ? "bg-surface2 text-ink font-semibold" : "text-sub hover:bg-surface2 hover:text-ink"
        } ${compact ? "justify-center px-0" : ""}`
      }
    >
      {({ isActive }) => (
        <>
          {isActive && <span className="absolute left-0 top-2 bottom-2 w-1 rounded-full bg-brand" />}
          <Icon size={18} className={isActive ? "text-brand" : ""} />
          {!compact && <span className="flex-1 truncate">{label}</span>}
          {item.id === "notifications" && unread > 0 && (
            <span
              className={`rounded-full bg-brand px-1.5 text-[10px] font-bold text-white ${
                compact ? "absolute right-1 top-1" : ""
              }`}
              data-testid="unread-count"
            >
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </>
      )}
    </NavLink>
  );
}

function Sidebar({ compact, setCompact, openSearch }) {
  const { me, ws, savePrefs, logout, unread, isDemo, t } = useApp();
  const [soundOn, setSoundOn] = useState(() => isSoundEnabled());
  const navigate = useNavigate();
  const dark = document.documentElement.classList.contains("dark");
  const toggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    setSoundEnabled(next);
    if (next) playSound("click");
  };
  return (
    <aside
      className={`hidden md:flex sticky top-0 h-screen shrink-0 flex-col border-r bg-sidebar transition-[width] duration-200 ${
        compact ? "w-[76px]" : "w-[248px]"
      }`}
      data-testid="sidebar"
    >
      <div className={`flex items-center gap-2.5 p-4 ${compact ? "justify-center" : ""}`}>
        <Logo ws={ws} />
        {!compact && (
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-extrabold tracking-tight" data-testid="workspace-brand">
              {ws?.brand_name || "CIRCLE"}
            </p>
            <p className="truncate text-xs text-sub" data-testid="workspace-name">
              {ws?.name}
              {isDemo && " · Demo"}
            </p>
          </div>
        )}
        <button
          onClick={() => setCompact(!compact)}
          className="btn-ghost hidden h-8 w-8 items-center justify-center lg:flex text-sub"
          aria-label="Toggle sidebar"
          data-testid="sidebar-collapse-btn"
        >
          {compact ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
        </button>
      </div>
      {isDemo && !compact && (
        <div
          className="mx-4 mb-2 flex items-center gap-2 rounded-xl bg-soft-yellow px-3 py-2 text-xs font-semibold text-amber-800 dark:text-amber-200"
          data-testid="demo-banner"
        >
          <FlaskConical size={14} />
          Demo mode · sample data
        </div>
      )}
      <div className="px-3">
        <button
          onClick={openSearch}
          className={`flex h-10 w-full items-center gap-2 rounded-xl border bg-surface2 px-3 text-sm text-sub ${
            compact ? "justify-center px-0" : ""
          }`}
          data-testid="sidebar-search-btn"
        >
          <Search size={16} />
          {!compact && (
            <>
              <span className="flex-1 text-left">{t("nav_search")}</span>
              <kbd className="rounded-md border bg-surface px-1.5 text-[10px]">Ctrl K</kbd>
            </>
          )}
        </button>
      </div>
      <nav className="mt-3 flex-1 space-y-0.5 overflow-y-auto px-3 scroll-thin">
        {NAV.map((n) => (
          <NavItem key={n.id} item={n} compact={compact} unread={unread} />
        ))}
      </nav>
      <div className="border-t p-3 space-y-2">
        <PWAInstallButton variant="sidebar" compact={compact} />
        <button
          onClick={() => navigate(`/people/${me.user_id}`)}
          className={`flex w-full items-center gap-3 rounded-2xl p-2 text-left hover:bg-surface2 transition-colors ${
            compact ? "justify-center p-1" : ""
          }`}
          data-testid="sidebar-profile-btn"
          title={me.name}
        >
          <Avatar user={me} size={compact ? 36 : 38} />
          {!compact && (
            <div className="min-w-0 flex-1">
              <span className="block truncate text-sm font-bold text-ink leading-tight">{me.name}</span>
              <span className="block truncate text-xs text-sub leading-tight mt-0.5">
                {ROLE_NAMES[me.role] || me.role}
              </span>
            </div>
          )}
        </button>
        <div
          className={`flex items-center ${
            compact ? "flex-col gap-1.5" : "justify-between rounded-xl bg-surface2/60 p-1"
          }`}
        >
          <button
            onClick={toggleSound}
            className="btn-ghost flex h-8 w-8 items-center justify-center rounded-lg text-sub hover:text-ink transition-colors"
            aria-label="Toggle sound"
            title={soundOn ? "Sound FX: Aktif" : "Sound FX: Mute"}
            data-testid="sound-toggle-btn"
          >
            {soundOn ? <Volume2 size={16} className="text-brand" /> : <VolumeX size={16} />}
          </button>
          <button
            onClick={() => savePrefs({ theme_mode: dark ? "light" : "dark" })}
            className="btn-ghost flex h-8 w-8 items-center justify-center rounded-lg text-sub hover:text-ink transition-colors"
            aria-label="Toggle theme"
            title={dark ? "Mode Terang" : "Mode Gelap"}
            data-testid="theme-toggle-btn"
          >
            {dark ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <button
            onClick={logout}
            className="btn-ghost flex h-8 w-8 items-center justify-center rounded-lg text-sub hover:text-rose-600 transition-colors"
            aria-label="Log out"
            title="Keluar"
            data-testid="logout-btn"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
}

function MobileNav({ openSearch }) {
  const [more, setMore] = useState(false);
  const [soundOn, setSoundOn] = useState(() => isSoundEnabled());
  const { unread, me, logout, ws, savePrefs, isDemo } = useApp();
  const loc = useLocation();
  const navigate = useNavigate();
  const dark = document.documentElement.classList.contains("dark");

  const toggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    setSoundEnabled(next);
    if (next) playSound("click");
  };

  const currentNav = NAV.find((n) => (n.to === "/" ? loc.pathname === "/" : loc.pathname.startsWith(n.to)));
  const activeTitle = currentNav?.label || ws?.brand_name || "CIRCLE";

  const collabItems = NAV.filter((n) => ["schedule", "directory", "groups"].includes(n.id));
  const orgItems = NAV.filter((n) => ["employee", "org", "projects"].includes(n.id));
  const sysItems = NAV.filter((n) => ["settings"].includes(n.id));

  return (
    <>
      {/* Mobile Top App Bar (56px height, clean 3-zone structure) */}
      <header
        className="md:hidden sticky top-0 z-30 flex h-14 items-center justify-between gap-2 border-b border-slate-200/80 dark:border-slate-800/80 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-3.5 pt-safe"
        data-testid="mobile-header"
      >
        <button
          type="button"
          onClick={() => navigate("/")}
          className="flex items-center gap-2.5 min-w-0 text-left"
        >
          <Logo size={28} ws={ws} />
          <div className="min-w-0">
            <span className="block truncate text-sm font-extrabold tracking-tight text-ink leading-tight">
              {ws?.brand_name || "CIRCLE"}
            </span>
            <span className="block truncate text-[11px] font-medium text-sub leading-tight">
              {activeTitle}
              {isDemo ? " · Demo" : ""}
            </span>
          </div>
        </button>

        <div className="flex items-center gap-1 shrink-0">
          <PWAInstallButton variant="mobile-header" />
          <button
            type="button"
            onClick={openSearch}
            className="btn-ghost flex h-11 w-11 items-center justify-center rounded-xl text-sub hover:text-ink"
            aria-label="Cari di Workspace"
            data-testid="mobile-search-btn"
          >
            <Search size={19} />
          </button>
          <NavLink
            to="/notifications"
            className="btn-ghost relative flex h-11 w-11 items-center justify-center rounded-xl text-sub hover:text-ink"
            aria-label="Notifikasi"
            data-testid="mobile-notifications-btn"
          >
            <Bell size={19} />
            {unread > 0 && (
              <span className="absolute right-2 top-2 min-w-[16px] rounded-full bg-brand px-1 text-center text-[9px] font-bold leading-4 text-white">
                {unread > 99 ? "99+" : unread}
              </span>
            )}
          </NavLink>
        </div>
      </header>

      {/* Mobile Fixed Bottom Navigation Bar (5 evenly spaced ergonomic touch targets) */}
      <nav
        className="md:hidden fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 items-center h-16 border-t border-slate-200/90 dark:border-slate-800/90 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md pb-safe"
        data-testid="mobile-bottom-nav"
      >
        {MOBILE_TABS.map((n) => (
          <NavLink
            key={n.id}
            to={n.to}
            end={n.to === "/"}
            data-testid={`mobile-nav-${n.id}`}
            className={({ isActive }) =>
              `relative flex h-full min-h-[44px] flex-col items-center justify-center gap-1 transition-colors ${
                isActive ? "text-brand font-bold" : "text-sub font-medium hover:text-ink"
              }`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <span className="absolute top-0 h-0.5 w-7 rounded-full bg-brand" />
                )}
                <n.icon size={20} strokeWidth={isActive ? 2.4 : 2} />
                <span className="text-[10px] tracking-tight leading-none">{n.label}</span>
              </>
            )}
          </NavLink>
        ))}
        <button
          type="button"
          onClick={() => setMore(true)}
          className={`relative flex h-full min-h-[44px] flex-col items-center justify-center gap-1 transition-colors ${
            more ? "text-brand font-bold" : "text-sub font-medium hover:text-ink"
          }`}
          data-testid="mobile-nav-more"
        >
          <Menu size={20} />
          <span className="text-[10px] tracking-tight leading-none">Menu</span>
        </button>
      </nav>

      {/* Structured Mobile Workspace Menu Sheet */}
      <Sheet open={more} onOpenChange={setMore}>
        <SheetContent
          side="bottom"
          className="max-h-[88dvh] overflow-y-auto rounded-t-3xl bg-surface px-4 pb-8 pt-3"
        >
          <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-slate-300 dark:bg-slate-700" />
          <SheetHeader className="text-left mb-3">
            <SheetTitle className="text-base font-extrabold text-ink">Menu Workspace</SheetTitle>
          </SheetHeader>

          <div className="space-y-4">
            {/* Profile Card */}
            <button
              type="button"
              onClick={() => {
                setMore(false);
                navigate(`/people/${me.user_id}`);
              }}
              className="flex w-full items-center justify-between gap-3 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-surface2/60 p-3 text-left hover:bg-surface2 transition-colors"
              data-testid="more-nav-profile"
            >
              <div className="flex items-center gap-3 min-w-0">
                <Avatar user={me} size={42} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-ink">{me.name}</p>
                  <p className="truncate text-xs text-sub">
                    {ROLE_NAMES[me.role] || me.role} · {me.department || "Management"}
                  </p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-brand shrink-0">
                Profil <ChevronRight size={14} />
              </span>
            </button>

            {/* PWA Install Banner inside Drawer */}
            <PWAInstallButton variant="card" />

            {/* Section 1: Kolaborasi & Direktori */}
            <div>
              <p className="mb-2 px-1 text-[11px] font-bold uppercase tracking-wider text-sub">
                Jadwal & Direktori Drive
              </p>
              <div className="grid grid-cols-3 gap-2">
                {collabItems.map((n) => (
                  <NavLink
                    key={n.id}
                    to={n.to}
                    onClick={() => setMore(false)}
                    data-testid={`more-nav-${n.id}`}
                    className={({ isActive }) =>
                      `flex min-h-[72px] flex-col items-center justify-center gap-1.5 rounded-2xl border p-2.5 text-xs font-semibold transition-colors ${
                        isActive
                          ? "border-brand bg-brand/10 text-brand"
                          : "border-slate-200/70 dark:border-slate-800 bg-surface2/60 text-ink hover:bg-surface2"
                      }`
                    }
                  >
                    <n.icon size={20} className="text-brand" />
                    <span className="truncate max-w-full">{n.label}</span>
                  </NavLink>
                ))}
              </div>
            </div>

            {/* Section 2: Organisasi & Proyek */}
            <div>
              <p className="mb-2 px-1 text-[11px] font-bold uppercase tracking-wider text-sub">
                Organisasi & Proyek
              </p>
              <div className="grid grid-cols-3 gap-2">
                {orgItems.map((n) => (
                  <NavLink
                    key={n.id}
                    to={n.to}
                    onClick={() => setMore(false)}
                    data-testid={`more-nav-${n.id}`}
                    className={({ isActive }) =>
                      `flex min-h-[72px] flex-col items-center justify-center gap-1.5 rounded-2xl border p-2.5 text-xs font-semibold transition-colors ${
                        isActive
                          ? "border-brand bg-brand/10 text-brand"
                          : "border-slate-200/70 dark:border-slate-800 bg-surface2/60 text-ink hover:bg-surface2"
                      }`
                    }
                  >
                    <n.icon size={20} className="text-brand" />
                    <span className="truncate max-w-full">{n.label}</span>
                  </NavLink>
                ))}
              </div>
            </div>

            {/* Section 3: Pengaturan & Preferensi */}
            <div>
              <p className="mb-2 px-1 text-[11px] font-bold uppercase tracking-wider text-sub">
                Pengaturan & Sistem
              </p>
              <div className="grid grid-cols-2 gap-2">
                {sysItems.map((n) => (
                  <NavLink
                    key={n.id}
                    to={n.to}
                    onClick={() => setMore(false)}
                    data-testid={`more-nav-${n.id}`}
                    className="flex h-12 items-center gap-2.5 rounded-2xl border border-slate-200/70 dark:border-slate-800 bg-surface2/60 px-3.5 text-xs font-semibold text-ink hover:bg-surface2"
                  >
                    <n.icon size={18} className="text-brand shrink-0" />
                    <span>Pengaturan</span>
                  </NavLink>
                ))}
                <button
                  type="button"
                  onClick={() => savePrefs({ theme_mode: dark ? "light" : "dark" })}
                  className="flex h-12 items-center gap-2.5 rounded-2xl border border-slate-200/70 dark:border-slate-800 bg-surface2/60 px-3.5 text-xs font-semibold text-ink hover:bg-surface2"
                >
                  {dark ? <Sun size={18} className="text-amber-500 shrink-0" /> : <Moon size={18} className="text-brand shrink-0" />}
                  <span>{dark ? "Mode Terang" : "Mode Gelap"}</span>
                </button>
                <button
                  type="button"
                  onClick={toggleSound}
                  className="flex h-12 items-center gap-2.5 rounded-2xl border border-slate-200/70 dark:border-slate-800 bg-surface2/60 px-3.5 text-xs font-semibold text-ink hover:bg-surface2"
                >
                  {soundOn ? <Volume2 size={18} className="text-emerald-600 shrink-0" /> : <VolumeX size={18} className="text-sub shrink-0" />}
                  <span>{soundOn ? "Suara: Aktif" : "Suara: Mute"}</span>
                </button>
                <button
                  type="button"
                  onClick={logout}
                  data-testid="more-nav-logout"
                  className="flex h-12 items-center gap-2.5 rounded-2xl border border-rose-200 dark:border-rose-900/50 bg-rose-50/60 dark:bg-rose-950/30 px-3.5 text-xs font-semibold text-rose-600 dark:text-rose-400"
                >
                  <LogOut size={18} className="shrink-0" />
                  <span>Keluar Akun</span>
                </button>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

export default function Shell() {
  const { prefs, topNotif, closeTopNotif } = useApp();
  const [search, setSearch] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [compact, setCompactState] = useState(() => window.innerWidth < 1024 || !!prefs.sidebar_compact);
  const loc = useLocation();
  const chatOpen = /^\/messages\/.+/.test(loc.pathname);
  useEffect(() => {
    const k = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearch(true);
      }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);
  useEffect(() => {
    const r = () => window.innerWidth < 1024 && setCompactState(true);
    window.addEventListener("resize", r);
    return () => window.removeEventListener("resize", r);
  }, []);
  const setCompact = setCompactState;
  return (
    <>
      <TopNotificationPopup notif={topNotif} onClose={closeTopNotif} />
      <OfflineIndicator />
      <div className="flex min-h-screen w-full bg-background overflow-x-hidden">
        <Sidebar compact={compact} setCompact={setCompact} openSearch={() => setSearch(true)} />
        <div className="flex min-w-0 flex-1 flex-col">
          {!chatOpen && <MobileNav openSearch={() => setSearch(true)} />}
          <main className={`min-w-0 flex-1 ${chatOpen ? "" : "pb-20 md:pb-0"}`}>
            <div className="min-h-full">
              <Outlet />
            </div>
          </main>
        </div>
        <NotificationRail open={notifOpen} setOpen={setNotifOpen} />
      </div>
      <SearchDialog open={search} onOpenChange={setSearch} />
    </>
  );
}
