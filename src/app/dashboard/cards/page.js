'use client';
import { useState, useEffect } from 'react';
import { Plus, CreditCard, Link as LinkIcon, AlertCircle } from 'lucide-react';

export default function CardsPage() {
    const [cards, setCards] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [formData, setFormData] = useState({ uid: '', customer_id: '' });
    const [error, setError] = useState('');

    const fetchData = async () => {
        setLoading(true);
        const [cardsRes, customersRes] = await Promise.all([
            fetch('/api/cards'),
            fetch('/api/customers')
        ]);
        const cardsData = await cardsRes.json();
        const customersData = await customersRes.json();

        setCards(cardsData);
        setCustomers(customersData);
        setLoading(false);
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        const res = await fetch('/api/cards', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData),
        });

        const data = await res.json();

        if (res.ok) {
            setShowModal(false);
            setFormData({ uid: '', customer_id: '' });
            fetchData();
        } else {
            setError(data.message);
        }
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Cards</h1>
                <button
                    onClick={() => setShowModal(true)}
                    className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-md"
                >
                    <Plus size={20} />
                    Register Card
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {loading ? (
                    <div className="col-span-full text-center py-10 text-gray-500">Loading cards...</div>
                ) : cards.length === 0 ? (
                    <div className="col-span-full text-center py-10 text-gray-500">No cards registered yet.</div>
                ) : (
                    cards.map((card) => (
                        <div key={card.id} className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                <CreditCard size={100} />
                            </div>
                            <div className="relative z-10">
                                <h3 className="text-lg font-mono font-bold text-gray-800 dark:text-gray-200 tracking-wider">{card.uid}</h3>
                                <div className="mt-4 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                                    <LinkIcon size={14} />
                                    <span>
                                        {card.customer_name ? (
                                            <span className="text-blue-500 font-medium">{card.customer_name}</span>
                                        ) : (
                                            <span className="text-red-400 italic">Unassigned</span>
                                        )}
                                    </span>
                                </div>
                                <div className="mt-2 text-xs text-gray-400">
                                    Registered: {new Date(card.created_at).toLocaleDateString()}
                                </div>
                                <div className={`mt-4 inline-block px-2 py-1 rounded text-xs font-semibold ${card.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                    {card.is_active ? 'ACTIVE' : 'INACTIVE'}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Add Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 w-full max-w-md mx-4 animate-in fade-in zoom-in duration-200">
                        <h2 className="text-xl font-bold mb-4 dark:text-white">Register New Card</h2>

                        {error && (
                            <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg text-sm flex items-center gap-2">
                                <AlertCircle size={16} />
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">UID (Scan or Type)</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="e.g. 04 A1 B2 C3"
                                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none font-mono"
                                    value={formData.uid}
                                    onChange={(e) => setFormData({ ...formData, uid: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Assign to Customer (Optional)</label>
                                <select
                                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none"
                                    value={formData.customer_id}
                                    onChange={(e) => setFormData({ ...formData, customer_id: e.target.value })}
                                >
                                    <option value="">-- No Assignment --</option>
                                    {customers.map(c => (
                                        <option key={c.id} value={c.id}>{c.full_name} ({c.phone})</option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex justify-end gap-3 mt-6">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors dark:text-gray-400 dark:hover:bg-gray-700"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-500 transition-colors"
                                >
                                    Register Card
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
