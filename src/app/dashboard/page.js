import { Users, CreditCard, Tag, Activity } from 'lucide-react';
import pool from '@/lib/db';

async function getStats() {
    // In a real scenario, these would be parallel DB queries
    // For now, let's fetch real counts if tables exist, or default to 0
    try {
        const [[{ count: customerCount }]] = await pool.query('SELECT COUNT(*) as count FROM customers');
        const [[{ count: cardCount }]] = await pool.query('SELECT COUNT(*) as count FROM cards');
        const [[{ count: activeDiscounts }]] = await pool.query('SELECT COUNT(*) as count FROM discounts WHERE is_active = 1');
        // Transactions count
        const [[{ count: txCount }]] = await pool.query('SELECT COUNT(*) as count FROM transactions');

        return { customerCount, cardCount, activeDiscounts, txCount };
    } catch (e) {
        console.error("Error fetching stats:", e);
        return { customerCount: 0, cardCount: 0, activeDiscounts: 0, txCount: 0 };
    }
}

export default async function DashboardPage() {
    const stats = await getStats();

    const statCards = [
        { title: 'Total Customers', value: stats.customerCount, icon: Users, color: 'text-blue-500', bg: 'bg-blue-500/10' },
        { title: 'Registered Cards', value: stats.cardCount, icon: CreditCard, color: 'text-purple-500', bg: 'bg-purple-500/10' },
        { title: 'Active Discounts', value: stats.activeDiscounts, icon: Tag, color: 'text-green-500', bg: 'bg-green-500/10' },
        { title: 'Total Transactions', value: stats.txCount, icon: Activity, color: 'text-orange-500', bg: 'bg-orange-500/10' },
    ];

    return (
        <div>
            <h1 className="text-3xl font-bold mb-8 text-gray-800 dark:text-gray-100">Dashboard Overview</h1>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {statCards.map((stat, index) => {
                    const Icon = stat.icon;
                    return (
                        <div key={index} className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">{stat.title}</p>
                                    <h3 className="text-2xl font-bold mt-2 text-gray-900 dark:text-white">{stat.value}</h3>
                                </div>
                                <div className={`p-4 rounded-lg ${stat.bg}`}>
                                    <Icon className={stat.color} size={24} />
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="mt-8 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-8 text-center text-gray-500">
                <p>Recent transactions chart will appear here...</p>
            </div>
        </div>
    );
}
