"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { auth } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import Link from "next/link";
import { 
  LayoutDashboard, 
  FileText, 
  ListChecks, 
  BarChart, 
  Settings, 
  LogOut,
  Loader2,
  BookOpenCheck,
  MonitorPlay,
  UsersRound
} from "lucide-react";
import clsx from "clsx";

const baseNavigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Ujian", href: "/dashboard/exams", icon: FileText },
  { name: "Soal", href: "/dashboard/questions", icon: ListChecks },
  { name: "Monitor", href: "/dashboard/monitor", icon: MonitorPlay },
  { name: "Hasil", href: "/dashboard/results", icon: BarChart },
];

export default function TeacherLayout({ children }) {
  const { user, loading, isAdmin } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/");
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  const navigation = [...baseNavigation];
  if (isAdmin) {
    navigation.push({ name: "Kelola Guru", href: "/dashboard/teachers", icon: UsersRound });
  }
  navigation.push({ name: "Pengaturan", href: "/dashboard/settings", icon: Settings });

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-r border-gray-200 fixed h-full z-10">
        <div className="h-16 flex items-center px-6 border-b border-gray-200">
          <BookOpenCheck className="w-8 h-8 text-indigo-600 mr-2" />
          <span className="text-xl font-bold text-gray-900 tracking-tight">RemedialCBT</span>
        </div>
        <div className="flex-1 overflow-y-auto py-4">
          <nav className="space-y-1 px-3">
            {navigation.map((item) => {
              const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={clsx(
                    isActive
                      ? "bg-indigo-50 text-indigo-700"
                      : "text-gray-700 hover:bg-gray-100",
                    "group flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-colors"
                  )}
                >
                  <item.icon
                    className={clsx(
                      isActive ? "text-indigo-600" : "text-gray-400 group-hover:text-gray-500",
                      "flex-shrink-0 -ml-1 mr-3 h-5 w-5"
                    )}
                  />
                  <span className="truncate">{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="p-4 border-t border-gray-200">
          <button
            onClick={handleLogout}
            className="w-full group flex items-center px-3 py-2 text-sm font-medium rounded-lg text-red-600 hover:bg-red-50 transition-colors"
          >
            <LogOut className="flex-shrink-0 -ml-1 mr-3 h-5 w-5 text-red-500 group-hover:text-red-600" />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 md:ml-64 pb-16 md:pb-0">
        <div className="md:hidden bg-white h-14 border-b border-gray-200 flex items-center px-4 sticky top-0 z-10 justify-between">
          <div className="flex items-center">
            <BookOpenCheck className="w-6 h-6 text-indigo-600 mr-2" />
            <span className="font-bold text-gray-900">RemedialCBT</span>
          </div>
          <button onClick={handleLogout} className="text-red-600 p-2">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 md:p-8 max-w-7xl mx-auto">
          {children}
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 w-full bg-white border-t border-gray-200 z-20 pb-safe overflow-x-auto">
        <div className="flex items-center h-16 px-2">
          {navigation.map((item) => {
             const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
             return (
              <Link
                key={item.name}
                href={item.href}
                className={clsx(
                  "flex-shrink-0 flex flex-col items-center justify-center w-16 h-full space-y-1 transition-colors mx-1",
                  isActive ? "text-indigo-600" : "text-gray-500 hover:text-gray-900"
                )}
              >
                <item.icon className={clsx("h-6 w-6", isActive ? "text-indigo-600" : "text-gray-500")} />
                <span className="text-[10px] font-medium leading-none truncate w-full text-center px-1">{item.name}</span>
              </Link>
             );
          })}
        </div>
      </nav>
    </div>
  );
}
