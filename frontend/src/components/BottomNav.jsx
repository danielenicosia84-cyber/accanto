import { NavLink } from "react-router-dom";
import { Home, FolderClock, BellRing, Users, HeartPulse } from "lucide-react";
import { useLang } from "@/context/LanguageContext";

const navItems = [
  { to: "/", icon: Home, key: "nav_home", tid: "nav-home", end: true },
  { to: "/archive", icon: FolderClock, key: "nav_archive", tid: "nav-archive" },
  { to: "/care", icon: HeartPulse, key: "nav_care", tid: "nav-care" },
  { to: "/reminders", icon: BellRing, key: "nav_reminders", tid: "nav-reminders" },
  { to: "/profiles", icon: Users, key: "nav_profile", tid: "nav-profile" },
];

export const BottomNav = () => {
  const { t } = useLang();
  return (
    <nav className="pb-safe fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200 bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-xl items-stretch justify-around px-1 py-2">
        {navItems.map(({ to, icon: Icon, key, tid, end }) => (
          <NavLink
            key={to} to={to} end={end} data-testid={tid}
            className={({ isActive }) => `flex flex-1 flex-col items-center gap-1 rounded-xl py-2 text-[11px] font-semibold transition-colors ${isActive ? "text-[#2D6A4F]" : "text-slate-400 hover:text-slate-600"}`}
          >
            {({ isActive }) => (
              <>
                <span className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors ${isActive ? "bg-[#E8F5E9]" : ""}`}>
                  <Icon className="h-5 w-5" />
                </span>
                {t(key)}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
};
