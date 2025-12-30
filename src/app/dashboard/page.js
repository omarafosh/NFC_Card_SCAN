'use client';

import { useState, useEffect } from 'react';
import { Users, Coins, CreditCard, Activity, ArrowRight } from 'lucide-react';
import StatsCard from '@/components/analytics/StatsCard';
import TransactionsChart from '@/components/analytics/TransactionsChart';
import { toast } from 'sonner';

export default function Dashboard() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/analytics/dashboard')
            .then(res => res.json())
            .then(json => {
                if (json.data) {
                    setData(json.data);
                } else {
                    toast.error('Failed to load dashboard data');
                }
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                toast.error('Network error');
                setLoading(false);
            });
    }, []);

    if (loading) {
        return <div className="p-8 text-center text-gray-500">Loading Dashboard...</div>;
    }

    if (!data) return null;

    return (
        <div className="space-y-8 animate-in fade-in duration-500" suppressHydrationWarning>
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Dashboard Overview</h1>
                    <p className="text-gray-500 mt-1">Real-time statistics and recent activity.</p>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatsCard
                    title="Total Customers"
                    value={data.totalCustomers}
                    icon={Users}
                    color="blue"
                />
                <StatsCard
                    title="Total Points"
                    value={data.totalPoints.toLocaleString()}
                    icon={Coins}
                    color="orange"
                />
                <StatsCard
                    title="Total Transactions"
                    value={data.totalTransactions}
                    icon={CreditCard}
                    color="purple"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Chart Section */}
                <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                            <Activity className="w-5 h-5 text-blue-500" />
                            Transaction History
                        </h3>
                        <span className="text-xs text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">Last 7 Days</span>
                    </div>
                    <TransactionsChart data={data.chartData} />
                </div>

                {/* Recent Activity Section */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Recent Activity</h3>
                    <div className="space-y-6">
                        {data.recentActivity && data.recentActivity.length > 0 ? (
                            data.recentActivity.map((tx) => (
                                <div key={tx.id} className="flex items-start gap-4">
                                    <div className={`p-2 rounded-full ${tx.points > 0 ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                                        <Coins className="w-4 h-4" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                            {tx.customers?.full_name}
                                        </p>
                                        <p className="text-xs text-gray-500 truncate">{tx.reason || 'Transaction'}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className={`text-sm font-bold ${tx.points > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                            {tx.points > 0 ? '+' : ''}{tx.points}
                                        </p>
                                        <p className="text-xs text-gray-400">
                                            {new Date(tx.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p className="text-sm text-gray-500 text-center py-4">No recent activity</p>
                        )}

                        {data.recentActivity.length > 0 && (
                            <button className="w-full mt-4 text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center justify-center gap-1 transition-colors">
                                View All Transactions <ArrowRight className="w-3 h-3" />
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
