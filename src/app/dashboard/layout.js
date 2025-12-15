import Sidebar from '@/components/sidebar';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function DashboardLayout({ children }) {
    const session = await getSession();

    if (!session) {
        redirect('/login');
    }

    return (
        <div className="flex min-h-screen bg-gray-100 dark:bg-gray-900">
            <Sidebar user={session} />
            <main className="flex-1 p-8 overflow-y-auto">
                <div className="max-w-7xl mx-auto">
                    {children}
                </div>
            </main>
        </div>
    );
}
