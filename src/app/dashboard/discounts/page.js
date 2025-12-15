'use client';
import { useState, useEffect } from 'react';
import { Plus, Tag, Percent, DollarSign, Gift } from 'lucide-react';

export default function DiscountsPage() {
    const [discounts, setDiscounts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [formData, setFormData] = useState({ name: '', type: 'percentage', value: '', points_required: 0 });

    const fetchDiscounts = async () => {
        setLoading(true);
        const res = await fetch('/api/discounts');
        const data = await res.json();
        setDiscounts(data);
        setLoading(false);
    };

    useEffect(() => {
        fetchDiscounts();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        const res = await fetch('/api/discounts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData),
        });
        if (res.ok) {
            setShowModal(false);
            setFormData({ name: '', type: 'percentage', value: '', points_required: 0 });
            fetchDiscounts();
        }
    };

    const getTypeIcon = (type) => {
        switch (type) {
            case 'percentage': return <Percent size={18} />;
            case 'fixed_amount': return <DollarSign size={18} />;
            case 'gift': return <Gift size={18} />;
            default: return <Tag size={18} />;
        }
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Discounts</h1>
                <button
                    onClick={() => setShowModal(true)}
                    className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-md"
                >
                    <Plus size={20} />
                    New Discount
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {loading ? (
                    <div className="col-span-full text-center py-10 text-gray-500">Loading discounts...</div>
                ) : discounts.length === 0 ? (
                    <div className="col-span-full text-center py-10 text-gray-500">No discounts active.</div>
                ) : (
                    discounts.map((discount) => (
                        <div key={discount.id} className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{discount.name}</h3>
                                    <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-4">
                                        <span className={`p-1 rounded ${discount.type === 'percentage' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
                                            {getTypeIcon(discount.type)}
                                        </span>
                                        <span className="capitalize">{discount.type.replace('_', ' ')}</span>
                                    </div>
                                    <div className="text-3xl font-bold text-green-600 mb-2">
                                        {discount.type === 'percentage' ? `${discount.value}%` : `$${discount.value}`}
                                        <span className="text-xs text-gray-400 font-normal ml-1">OFF</span>
                                    </div>
                                    {discount.points_required > 0 && (
                                        <div className="text-xs text-purple-600 font-semibold mt-2">
                                            Requires {discount.points_required} Points
                                        </div>
                                    )}
                                </div>
                                <div className={`px-2 py-1 rounded text-xs font-semibold ${discount.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                    {discount.is_active ? 'Active' : 'Inactive'}
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
                        <h2 className="text-xl font-bold mb-4 dark:text-white">Create Discount</h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Discount Name</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-green-500 outline-none"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Type</label>
                                    <select
                                        className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-green-500 outline-none"
                                        value={formData.type}
                                        onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                                    >
                                        <option value="percentage">Percentage (%)</option>
                                        <option value="fixed_amount">Fixed Amount ($)</option>
                                        <option value="gift">Gift Item</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Value</label>
                                    <input
                                        type="number"
                                        required
                                        className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-green-500 outline-none"
                                        value={formData.value}
                                        onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Points Required (Optional)</label>
                                <input
                                    type="number"
                                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-green-500 outline-none"
                                    value={formData.points_required}
                                    onChange={(e) => setFormData({ ...formData, points_required: e.target.value })}
                                />
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
                                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-500 transition-colors"
                                >
                                    Create Discount
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
