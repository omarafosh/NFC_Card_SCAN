'use client';
import { useState, useEffect } from 'react';
import { Plus, Tag, Percent, DollarSign, Gift, Calendar, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export default function DiscountsClient() {
    const [discounts, setDiscounts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        type: 'percentage',
        value: '',
        points_required: 0,
        start_date: '',
        end_date: ''
    });

    const fetchDiscounts = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/discounts');
            const data = await res.json();
            setDiscounts(data);
        } catch (e) {
            toast.error('Failed to fetch discounts');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDiscounts();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const res = await fetch('/api/discounts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });
            if (res.ok) {
                toast.success('Discount created');
                setShowModal(false);
                setFormData({ name: '', type: 'percentage', value: '', points_required: 0, start_date: '', end_date: '' });
                fetchDiscounts();
            } else {
                toast.error('Failed to create discount');
            }
        } catch (err) {
            toast.error('Network error');
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
                        <div key={discount.id} className="relative bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow">
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
                                        <div className="text-xs text-purple-600 font-semibold mt-2 flex items-center gap-1">
                                            <Tag size={12} /> Requires {discount.points_required} Points
                                        </div>
                                    )}
                                    {(discount.start_date || discount.end_date) && (
                                        <div className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                                            <Calendar size={12} />
                                            {discount.start_date ? new Date(discount.start_date).toLocaleDateString() : 'Now'}
                                            {' -> '}
                                            {discount.end_date ? new Date(discount.end_date).toLocaleDateString() : 'Forever'}
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
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 w-full max-w-lg mx-4 overflow-y-auto max-h-[90vh] animate-in fade-in zoom-in duration-200">
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

                            {/* Points Requirement */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Points Required (Redemption Cost)</label>
                                <input
                                    type="number"
                                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-green-500 outline-none"
                                    value={formData.points_required}
                                    onChange={(e) => setFormData({ ...formData, points_required: e.target.value })}
                                    placeholder="0 for automatic discount"
                                />
                                <p className="text-xs text-gray-500 mt-1">If set to 0, this discount is applied automatically if valid. If &gt; 0, it requires point redemption.</p>
                            </div>

                            {/* Date Range */}
                            <div className="grid grid-cols-2 gap-4 border-t pt-4 border-gray-100 dark:border-gray-700">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Start Date (Optional)</label>
                                    <input
                                        type="datetime-local"
                                        className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-green-500 outline-none"
                                        value={formData.start_date || ''}
                                        onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">End Date (Optional)</label>
                                    <input
                                        type="datetime-local"
                                        className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-green-500 outline-none"
                                        value={formData.end_date || ''}
                                        onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                                    />
                                </div>
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
