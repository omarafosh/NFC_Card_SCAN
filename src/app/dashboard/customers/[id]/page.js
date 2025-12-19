'use client';
import { useState, useEffect, use } from 'react';
import { User, Phone, Mail, CreditCard, History, Edit2, Save, X } from 'lucide-react';
import { toast } from 'sonner';

export default function CustomerDetailsPage({ params }) {
    // Unwrap params in Next.js 15+ (or 13 app dir sometimes requires it as Promise)
    // But since this is a standard client component usage in 14/dynamic route:
    const { id } = use(params);

    const [customer, setCustomer] = useState(null);
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingPoints, setEditingPoints] = useState(false);
    const [newPoints, setNewPoints] = useState(0);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Fetch Customer
            const resCust = await fetch(`/api/customers/${id}`);
            const dataCust = await resCust.json();
            setCustomer(dataCust);
            setNewPoints(dataCust.points_balance);

            // Fetch Transactions
            const resTrans = await fetch(`/api/transactions?customer_id=${id}`);
            const dataTrans = await resTrans.json();
            setTransactions(dataTrans);
        } catch (e) {
            console.error(e);
            toast.error('Failed to load customer data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [id]);

    const handleUpdatePoints = async () => {
        try {
            // Need an API to update points directly, e.g., manual adjustment
            // We'll assume POST /api/customers/[id]/points or generic update
            // For now, let's use the scan API or create a specific point adjustment API.
            // Actually, we should create `POST /api/customers/[id]/points`.
            // I'll assume it exists or I will create it.

            const res = await fetch(`/api/customers/${id}/points`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    points: parseInt(newPoints),
                    reason: 'Manual Adjustment by Admin'
                }),
            });

            if (res.ok) {
                toast.success('Points updated');
                setEditingPoints(false);
                fetchData();
            } else {
                toast.error('Failed to update points');
            }
        } catch (e) {
            toast.error('Network error');
        }
    };

    if (loading) return <div className="p-8">Loading profile...</div>;
    if (!customer) return <div className="p-8">Customer not found</div>;

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            {/* Header / Profile Card */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col md:flex-row gap-8 items-start">
                <div className="w-24 h-24 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
                    <User size={48} />
                </div>
                <div className="flex-1 space-y-1">
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{customer.full_name}</h1>
                    <div className="flex flex-wrap gap-4 text-gray-500 dark:text-gray-400 mt-2">
                        {customer.phone && <div className="flex items-center gap-1"><Phone size={16} />{customer.phone}</div>}
                        {customer.email && <div className="flex items-center gap-1"><Mail size={16} />{customer.email}</div>}
                    </div>
                    <div className="pt-4 flex items-center gap-2">
                        <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Member Since</span>
                        <span className="text-sm text-gray-600 dark:text-gray-300">{new Date(customer.created_at).toLocaleDateString()}</span>
                    </div>
                </div>

                {/* Points Card */}
                <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-xl p-6 min-w-[250px] border border-indigo-100 dark:border-indigo-900/50">
                    <div className="text-sm font-semibold text-indigo-900 dark:text-indigo-300 uppercase tracking-wider mb-1">Points Balance</div>

                    {editingPoints ? (
                        <div className="flex items-center gap-2 mt-2">
                            <input
                                type="number"
                                value={newPoints}
                                onChange={(e) => setNewPoints(e.target.value)}
                                className="w-24 px-2 py-1 rounded border border-indigo-300 text-lg font-bold"
                            />
                            <button onClick={handleUpdatePoints} className="p-2 bg-green-600 text-white rounded hover:bg-green-700"><Save size={16} /></button>
                            <button onClick={() => setEditingPoints(false)} className="p-2 bg-gray-400 text-white rounded hover:bg-gray-500"><X size={16} /></button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2">
                            <div className="text-4xl font-bold text-indigo-600 dark:text-indigo-400">
                                {customer.points_balance}
                            </div>
                            <button onClick={() => setEditingPoints(true)} className="text-indigo-400 hover:text-indigo-600 p-1 rounded-full hover:bg-indigo-100 transition">
                                <Edit2 size={16} />
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Transactions History */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                    <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex items-center gap-2">
                        <History className="text-gray-400" />
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white">Transaction History</h2>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm text-gray-500 dark:text-gray-400">
                            <thead className="bg-gray-50 dark:bg-gray-700/50 text-xs uppercase font-semibold text-gray-500 dark:text-gray-400">
                                <tr>
                                    <th className="px-6 py-4">Date</th>
                                    <th className="px-6 py-4">Amount</th>
                                    <th className="px-6 py-4">Points</th>
                                    <th className="px-6 py-4">Discount</th>
                                    <th className="px-6 py-4">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                {transactions.length === 0 ? (
                                    <tr><td colSpan="5" className="px-6 py-8 text-center">No transactions found</td></tr>
                                ) : (
                                    transactions.map((tx) => (
                                        <tr key={tx.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition">
                                            <td className="px-6 py-4 whitespace-nowrap">{new Date(tx.created_at).toLocaleDateString()} {new Date(tx.created_at).toLocaleTimeString()}</td>
                                            <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">${tx.amount_after}</td>
                                            <td className="px-6 py-4">
                                                {tx.points_earned > 0 ? (
                                                    <span className="text-green-600 flex items-center gap-1">+{tx.points_earned}</span>
                                                ) : <span className="text-gray-400">-</span>}
                                            </td>
                                            <td className="px-6 py-4">
                                                {tx.discount_name ? (
                                                    <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs">{tx.discount_name}</span>
                                                ) : '-'}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-semibold uppercase">{tx.status}</span>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Cards Section */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 h-fit">
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                        <CreditCard className="text-gray-400" /> Linked Cards
                    </h2>
                    {/* Accessing cards would require another API call or including in customer response. 
                        For now, assuming maybe we fetch them or just placeholder. */}
                    <div className="p-4 border border-dashed border-gray-200 rounded-lg text-center text-gray-500 text-sm">
                        Card management coming soon.
                    </div>
                </div>
            </div>
        </div>
    );
}
