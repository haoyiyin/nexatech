"use client";

import Image from "next/image";
import Link from "next/link";
import { ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Settings, LogOut, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const WEBSITE_URL = "https://www.nexatech.edu.kg";

const navItems = [
  { href: "/inbox", icon: Inbox, label: "Inbox" },
  { href: "/settings/password", icon: Settings, label: "Settings" },
];

export default function MailLayout({ children, username }: { children: ReactNode; username: string }) {
  const router = useRouter();
  const pathname = usePathname();

  const handleLogout = async () => {
    const supabase = createClient();
    const { error } = await supabase.auth.signOut();

    if (!error) {
      window.location.href = `${WEBSITE_URL}?mail_login=1`;
    }
  };

  return (
    <div className="min-h-screen flex bg-[#f8f9fa]">
      {/* Sidebar */}
      <aside className="w-64 bg-[#1a365d] text-white flex flex-col">
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
            <span className="text-sm font-semibold text-[#e2e8f0] truncate">{username}</span>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname?.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
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

      {/* Main content */}
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
