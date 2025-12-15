'use client';
import { useState, useEffect } from 'react';
import { History } from 'lucide-react';

export default function TransactionsPage() {
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchTx() {
            setLoading(true);
            const res = await fetch('/api/transactions');
            const data = await res.json();
            setTransactions(data);
            setLoading(false);
        }
        fetchTx();
    }, []);

    return (
        <div>
            <h1 className="text-3xl font-bold mb-8 text-gray-800 dark:text-gray-100 flex items-center gap-3">
                <History /> Transaction History
            </h1>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left bg-white dark:bg-gray-800">
                        <thead className="bg-gray-50 dark:bg-gray-900/50 text-gray-500 dark:text-gray-400 font-medium">
                            <tr>
                                <th className="p-4">ID</th>
                                <th className="p-4">Customer</th>
                                <th className="p-4">Discount Applied</th>
                                <th className="p-4">Status</th>
                                <th className="p-4 text-right">Date</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {loading ? (
                                <tr><td colSpan="5" className="p-8 text-center text-gray-500">Loading...</td></tr>
                            ) : transactions.length === 0 ? (
                                <tr><td colSpan="5" className="p-8 text-center text-gray-500">No transactions yet</td></tr>
                            ) : (
                                transactions.map((tx) => (
                                    <tr key={tx.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                        <td className="p-4 font-mono text-xs text-gray-400">#{tx.id}</td>
                                        <td className="p-4 font-medium text-gray-900 dark:text-white">{tx.customer_name || 'Unknown'}</td>
                                        <td className="p-4">
                                            {tx.discount_name ? (
                                                <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold">{tx.discount_name}</span>
                                            ) : (
                                                <span className="text-gray-400 text-sm">-</span>
                                            )}
                                        </td>
                                        <td className="p-4">
                                            <span className={`px-2 py-1 rounded text-xs font-semibold ${tx.status === 'success' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>
                                                {tx.status}
                                            </span>
                                        </td>
                                        <td className="p-4 text-right text-gray-500 text-sm">
                                            {new Date(tx.created_at).toLocaleString()}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
