'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, Users, CreditCard, Tag, Settings, LogOut, History, Scan, ShieldAlert, ShieldCheck, Languages } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';

const menuItems = [
  { name: 'nav_home', href: '/dashboard', icon: LayoutDashboard },
  { name: 'nav_scan', href: '/dashboard/scan', icon: Scan },
  { name: 'nav_customers', href: '/dashboard/customers', icon: Users },
  { name: 'nav_cards', href: '/dashboard/cards', icon: CreditCard },
  { name: 'nav_discounts', href: '/dashboard/discounts', icon: Tag },
  { name: 'nav_transactions', href: '/dashboard/transactions', icon: History },
  { name: 'nav_logs', href: '/dashboard/logs', icon: ShieldAlert },
  { name: 'nav_management', href: '/dashboard/management', icon: ShieldCheck },
  { name: 'nav_settings', href: '/dashboard/settings', icon: Settings },
];

export default function Sidebar({ user }) {
  const { t, language, toggleLanguage, dir } = useLanguage();
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.refresh();
    router.push('/login');
  };

  return (
    <aside className="w-64 bg-slate-900 text-white flex flex-col h-screen sticky top-0 border-r border-slate-800">
      <div className={`p-6 border-b border-slate-800 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
        <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
          NFC Discount
        </h1>
        <p className="text-xs text-slate-400 mt-1">{t('welcome')}، {user?.username}</p>
      </div>

      <nav className="flex-1 p-4 space-y-2">
        {menuItems.filter(item => {
          // Hide Admin-only items if user is not admin
          if (['nav_settings', 'nav_discounts', 'nav_logs', 'nav_management'].includes(item.name)) {
            return user?.role === 'admin';
          }
          return true;
        }).map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive
                ? 'bg-blue-600 text-white shadow-lg'
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
            >
              <Icon size={20} />
              <span className="font-medium">{t(item.name)}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-800 space-y-2">
        <button
          onClick={toggleLanguage}
          className={`flex items-center gap-3 px-4 py-3 w-full rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition-colors`}
        >
          <Languages size={20} />
          <span className="font-medium">{language === 'ar' ? 'English' : 'العربية'}</span>
        </button>

        <button
          onClick={handleLogout}
          className={`flex items-center gap-3 px-4 py-3 w-full rounded-lg text-red-400 hover:bg-red-900/20 hover:text-red-300 transition-colors`}
        >
          <LogOut size={20} />
          <span className="font-medium">{t('logout')}</span>
        </button>

        <div className="pt-2 flex justify-center">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest bg-black/20 px-2 py-0.5 rounded border border-slate-800">
            Version 0.2.0
          </span>
        </div>
      </div>
    </aside>
  );
}
