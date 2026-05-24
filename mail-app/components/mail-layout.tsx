"use client";

import Image from "next/image";
import Link from "next/link";
import { ReactNode, useState, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Settings, LogOut, Inbox, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const WEBSITE_URL = "https://www.nexatech.edu.kg";

const navItems = [
  { href: "/inbox", icon: Inbox, label: "Inbox" },
  { href: "/settings/password", icon: Settings, label: "Settings" },
];

export default function MailLayout({ children, username }: { children: ReactNode; username: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    const supabase = createClient();
    const { error } = await supabase.auth.signOut();

    if (!error) {
      window.location.href = `${WEBSITE_URL}?mail_login=1`;
    }
  };

  const closeSidebar = useCallback(() => setIsOpen(false), []);

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-[#f8f9fa] relative overflow-x-hidden">
      {/* Mobile Header */}
      <header className="lg:hidden w-full bg-[#1a365d] text-white h-16 flex items-center justify-between px-4 border-b border-[#2d4a7a] z-40 sticky top-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsOpen(true)}
            className="p-1.5 rounded-md hover:bg-[#2d4a7a] transition-colors"
            aria-label="Open navigation"
          >
            <Menu className="w-6 h-6" />
          </button>
          <span className="text-sm font-semibold truncate max-w-[120px] text-[#cbd5e1]">{username}</span>
        </div>
        <Image
          src="/images/logo.png"
          alt="Nexatech Logo"
          width={110}
          height={37}
          className="h-10 w-auto"
          priority
        />
      </header>

      {/* Mobile Overlay Backdrop */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/60 z-40"
          onClick={closeSidebar}
        />
      )}

      {/* Sidebar Drawer */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 w-64 bg-[#1a365d] text-white flex flex-col z-50 transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:h-screen",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Sidebar Header */}
        <div className="p-6 border-b border-[#2d4a7a]">
          <div className="flex items-center justify-between gap-4">
            <Image
              src="/images/logo.png"
              alt="Nexatech University"
              width={160}
              height={54}
              className="h-14 w-auto"
              priority
            />
            <button
              className="lg:hidden p-1.5 rounded-md hover:bg-[#2d4a7a] text-[#a0aec0] hover:text-white transition-colors"
              onClick={closeSidebar}
              aria-label="Close navigation"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="mt-3">
            <span className="text-sm font-semibold text-[#e2e8f0] truncate block">{username}</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname?.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={closeSidebar}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-md text-sm font-medium transition-colors",
                  isActive
                    ? "bg-[#2d4a7a] text-white"
                    : "text-[#a0aec0] hover:bg-[#1e3d6b] hover:text-white"
                )}
              >
                <item.icon className="w-5 h-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="p-4 border-t border-[#2d4a7a]">
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 text-[#a0aec0] hover:text-white hover:bg-[#1e3d6b]"
            onClick={handleLogout}
          >
            <LogOut className="w-5 h-5" />
            Sign Out
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto max-w-full">
        {children}
      </main>
    </div>
  );
}
