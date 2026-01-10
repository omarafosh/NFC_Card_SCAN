'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSettings } from '@/lib/SettingsContext';
import { LayoutDashboard, Users, CreditCard, Tag, Settings, History, Scan, ShieldAlert, ShieldCheck, Megaphone, Monitor, Store } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';

const menuItems = [
  { name: 'nav_home', href: '/dashboard', icon: LayoutDashboard },
  { name: 'nav_scan', href: '/dashboard/scan', icon: Scan },
  { name: 'nav_customers', href: '/dashboard/customers', icon: Users },
  { name: 'nav_cards', href: '/dashboard/cards', icon: CreditCard },
  // { name: 'nav_discounts', href: '/dashboard/discounts', icon: Tag }, // REMOVED
  { name: 'nav_campaigns', href: '/dashboard/campaigns', icon: Megaphone },
  { name: 'nav_transactions', href: '/dashboard/transactions', icon: History },
  { name: 'nav_logs', href: '/dashboard/audit', icon: ShieldAlert },
  { name: 'nav_management', href: '/dashboard/management', icon: ShieldCheck },
  { name: 'nav_terminals', href: '/dashboard/terminals', icon: Monitor },
  { name: 'nav_settings', href: '/dashboard/settings', icon: Settings },
];

export default function Sidebar({ user }) {
  const { t, dir, language } = useLanguage();
  const { settings } = useSettings();
  const pathname = usePathname();
  const storeName = settings.store_name || 'NFC Discount';
  const logoUrl = settings.logo_url;

  return (
    <aside className="w-64 bg-slate-900 text-white flex flex-col h-screen border-r border-slate-800 flex-shrink-0">
      <div className={`p-6 border-b border-slate-800 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
        <div className="flex items-center gap-3 mb-1">
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" className="w-8 h-8 rounded-lg object-contain" />
          ) : (
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Store size={18} className="text-white" />
            </div>
          )}
          <h1 className="text-xl font-black bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500 truncate">
            {storeName}
          </h1>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1.5 overflow-hidden">
        {menuItems.filter(item => {
          if (['nav_settings', 'nav_terminals', 'nav_discounts', 'nav_logs', 'nav_management', 'nav_campaigns'].includes(item.name)) {
            return user?.role === 'admin' || user?.role === 'superadmin';
          }
          return true;
        }).map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 ${isActive
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
            >
              <Icon size={18} />
              <span className="font-bold text-sm tracking-wide">{t(item.name)}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-800">
        <div className="flex flex-col items-center">
          <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1">
            {t('build_status') || 'Build Status'}
          </span>
          <span className="text-[9px] font-bold text-slate-500 bg-white/5 border border-slate-800 px-3 py-1 rounded-full">
            {t('version_label') || 'VERSION'} 25
          </span>
        </div>
      </div>
    </aside>
  );
}
