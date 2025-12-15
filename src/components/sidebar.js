'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, Users, CreditCard, Tag, Settings, LogOut, History, Scan } from 'lucide-react';

const menuItems = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Scan Terminal', href: '/dashboard/scan', icon: Scan },
  { name: 'Customers', href: '/dashboard/customers', icon: Users },
  { name: 'Cards', href: '/dashboard/cards', icon: CreditCard },
  { name: 'Discounts', href: '/dashboard/discounts', icon: Tag },
  { name: 'Transactions', href: '/dashboard/transactions', icon: History },
];

export default function Sidebar({ user }) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.refresh();
    router.push('/login');
  };

  return (
    <aside className="w-64 bg-slate-900 text-white flex flex-col h-screen sticky top-0 border-r border-slate-800">
      <div className="p-6 border-b border-slate-800">
        <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
          NFC Discount
        </h1>
        <p className="text-xs text-slate-400 mt-1">Logged as {user?.username}</p>
      </div>

      <nav className="flex-1 p-4 space-y-2">
        {menuItems.map((item) => {
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
              <span className="font-medium">{item.name}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-800">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-4 py-3 w-full rounded-lg text-red-400 hover:bg-red-900/20 hover:text-red-300 transition-colors"
        >
          <LogOut size={20} />
          <span className="font-medium">Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
