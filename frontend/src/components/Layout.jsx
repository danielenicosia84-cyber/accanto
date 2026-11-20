import { useNavigate } from "react-router-dom";
import { Globe, LogOut, Crown, BookOpen } from "lucide-react";
import { useLang } from "@/context/LanguageContext";
import { useAuth } from "@/context/AuthContext";
import { useProfiles } from "@/context/ProfileContext";
import { TrialBanner } from "@/components/TrialBanner";
import { BottomNav } from "@/components/BottomNav";
import { LegalFooter } from "@/components/LegalFooter";

export function Layout({ children }) {
  const { t, lang, toggle } = useLang();
  const { logout, user } = useAuth();
  const { activeProfile } = useProfiles();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7]">
      <header className="pt-safe sticky top-0 z-40 border-b border-slate-200 bg-[#FDFBF7]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 md:px-8 py-3">
          <button onClick={() => navigate("/")} className="flex min-w-0 items-center gap-2 text-left" aria-label="Accanto home">
            <img src="/logo.png" alt="Accanto" className="h-9 w-9 flex-shrink-0 rounded-xl object-cover" />
            <div className="min-w-0 leading-tight">
              <p className="font-heading text-lg font-bold text-slate-900">Accanto</p>
              {activeProfile && (
                <p className="truncate text-xs text-[#2D6A4F]" data-testid="header-active-profile"><span className="hidden min-[400px]:inline">{t("active_profile")}: </span>{activeProfile.name}</p>
              )}
            </div>
          </button>
          <div className="flex flex-shrink-0 items-center gap-1">
            <button data-testid="guide-link" onClick={() => navigate("/guide")} aria-label={t("guide_title")} title={t("guide_title")} className="flex h-11 w-11 items-center justify-center rounded-full border border-[#E8F5E9] bg-[#E8F5E9] text-[#2D6A4F] transition-colors hover:bg-[#C8E6C9]">
              <BookOpen className="h-[18px] w-[18px]" />
            </button>
            {user?.is_owner && (
              <button data-testid="admin-link" onClick={() => navigate("/admin")} aria-label={t("admin_panel")} title={t("admin_panel")} className="flex h-11 w-11 items-center justify-center rounded-full border border-[#FDE68A] bg-[#FEF3C7] text-[#D97706] transition-colors hover:bg-[#FDE68A]">
                <Crown className="h-[18px] w-[18px]" />
              </button>
            )}
            <button data-testid="lang-toggle" onClick={toggle} aria-label="Lingua / Language" className="flex h-11 min-w-[44px] items-center justify-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50">
              <Globe className="hidden h-4 w-4 min-[400px]:block" /> {lang.toUpperCase()}
            </button>
            <button data-testid="logout-button" onClick={handleLogout} aria-label={t("logout")} className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50">
              <LogOut className="h-[18px] w-[18px]" />
            </button>
          </div>
        </div>
      </header>
      <TrialBanner />
      <main className="pb-nav mx-auto max-w-6xl px-4 md:px-8 pt-5">{children}<LegalFooter className="mt-6" /></main>
      <BottomNav />
    </div>
  );
}
