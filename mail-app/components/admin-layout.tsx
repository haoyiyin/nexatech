"use client";

import Image from "next/image";
import Link from "next/link";
import { ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, Users, UserPlus, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const WEBSITE_URL = "https://www.nexatech.edu.kg";

const navItems = [
  { href: "/admin", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/admin/mailboxes", icon: Users, label: "Mailboxes" },
  { href: "/admin/mailboxes/new", icon: UserPlus, label: "Create Mailbox" },
];

export default function AdminLayout({ children, username }: { children: ReactNode; username: string }) {
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
      <aside className="w-72 bg-[#1a365d] text-white flex flex-col">
        <div className="p-6 border-b border-[#2d4a7a] space-y-3">
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
          <div>
            <span className="text-xs text-[#cbd5e1]">Admin Console</span>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`);

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

      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
