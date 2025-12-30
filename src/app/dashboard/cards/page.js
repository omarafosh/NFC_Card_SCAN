'use client';
import { useState, useEffect } from 'react';
import { Plus, CreditCard, Link as LinkIcon, AlertCircle, Edit, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/lib/LanguageContext';
import DataTable from '@/components/DataTable';

export default function CardsPage() {
    const { t, dir } = useLanguage();
    const [mounted, setMounted] = useState(false);
    const [cards, setCards] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [formData, setFormData] = useState({ id: null, uid: '', customer_id: '' });
    const [error, setError] = useState('');

    useEffect(() => {
        setMounted(true);
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [cardsRes, customersRes] = await Promise.all([
                fetch('/api/cards'),
                fetch('/api/customers')
            ]);
            const cardsData = await cardsRes.json();
            const customersData = await customersRes.json();

            setCards(cardsData.data || []);
            setCustomers(customersData.data || []);
        } catch (e) {
            toast.error(t('error_loading'));
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        const isEdit = !!formData.id;
        try {
            const res = await fetch(isEdit ? `/api/cards/${formData.id}` : '/api/cards', {
                method: isEdit ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });
            const data = await res.json();
            if (res.ok) {
                setShowModal(false);
                setFormData({ id: null, uid: '', customer_id: '' });
                toast.success(isEdit ? t('save_success') : (t('save_success') || 'Card registered'));
                fetchData();
            } else {
                setError(data.message || t('save_error'));
            }
        } catch (err) {
            toast.error(t('network_error'));
        }
    };

    const handleDelete = async (id) => {
        if (!confirm(t('confirm_delete'))) return;
        try {
            const res = await fetch(`/api/cards/${id}`, { method: 'DELETE' });
            if (res.ok) {
                toast.success(t('delete_success'));
                fetchData();
            }
        } catch (e) {
            toast.error(t('delete_error'));
        }
    };

    const filteredCards = cards.filter(card =>
        card.uid.toLowerCase().includes(search.toLowerCase()) ||
        (card.customer_name && card.customer_name.toLowerCase().includes(search.toLowerCase()))
    );

    const columns = [
        {
            header: t('card_uid'),
            accessor: 'uid',
            className: 'font-mono font-bold text-blue-600 dark:text-blue-400'
        },
        {
            header: t('customer_name'),
            accessor: 'customer_name',
            cell: (row) => row.customer_name ? (
                <span className="font-medium text-gray-900 dark:text-white">{row.customer_name}</span>
            ) : (
                <span className="text-gray-400 italic text-xs">{t('no_data')}</span>
            )
        },
        {
            header: t('status'),
            accessor: 'is_active',
            cell: (row) => (
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${row.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {row.is_active ? t('connected') : t('disconnected')}
                </span>
            )
        },
        {
            header: t('actions'),
            className: 'w-24',
            cell: (row) => (
                <div className={`flex gap-1`}>
                    <button
                        onClick={() => {
                            setFormData({
                                id: row.id,
                                uid: row.uid,
                                customer_id: row.customer_id || ''
                            });
                            setShowModal(true);
                        }}
                        className="p-2 text-gray-400 hover:text-blue-500 transition-colors rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20"
                    >
                        <Edit size={16} />
                    </button>
                    <button
                        onClick={() => handleDelete(row.id)}
                        className="p-2 text-gray-400 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                        <Trash2 size={16} />
                    </button>
                </div>
            )
        }
    ];

    if (!mounted) return null;

    return (
        <div className="space-y-6" suppressHydrationWarning>
            <div className={`flex flex-col md:flex-row justify-between items-start md:items-center gap-4`}>
                <button
                    onClick={() => setShowModal(true)}
                    className="w-full md:w-auto bg-purple-600 hover:bg-purple-700 text-white px-5 py-2.5 rounded-xl shadow-lg transition-all active:scale-95 font-bold flex items-center justify-center gap-2"
                >
                    <Plus size={20} />
                    {t('link_card')}
                </button>
                <div>
                    <h1 className="text-3xl font-bold text-gray-800 dark:text-white flex items-center gap-3">
                        {t('nav_cards')}
                        <span className="text-sm font-normal text-gray-400 mt-1">NFC Assets</span>
                    </h1>
                </div>
            </div>

            <DataTable
                columns={columns}
                data={filteredCards}
                loading={loading}
                searchTerm={search}
                onSearchChange={setSearch}
                searchPlaceholder={t('search')}
            />

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 w-full max-w-md animate-in fade-in zoom-in duration-200">
                        <div className="flex items-center gap-2 mb-2 text-purple-600">
                            <CreditCard size={18} />
                            <span className="text-xs font-bold uppercase tracking-widest">NFC Registry</span>
                        </div>
                        <h2 className={`text-2xl font-bold mb-6 dark:text-white text-start`}>
                            {formData.id ? t('edit') : t('link_card')}
                        </h2>

                        {error && (
                            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-xl text-sm flex items-center gap-3 animate-shake">
                                <AlertCircle size={18} />
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div>
                                <label className={`block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2 text-start`}>
                                    {t('card_uid')}
                                </label>
                                <input
                                    type="text"
                                    required
                                    className={`w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl dark:text-white outline-none focus:ring-2 focus:ring-purple-500 font-mono transition-all text-start`}
                                    value={formData.uid}
                                    onChange={(e) => setFormData({ ...formData, uid: e.target.value })}
                                    placeholder="e.g. 04 A1 B2 C3"
                                />
                            </div>
                            <div>
                                <label className={`block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2 text-start`}>
                                    {t('customer_name')}
                                </label>
                                <select
                                    className={`w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl dark:text-white outline-none focus:ring-2 focus:ring-purple-500 transition-all text-start`}
                                    value={formData.customer_id}
                                    onChange={(e) => setFormData({ ...formData, customer_id: e.target.value })}
                                >
                                    <option value="">{t('no_data')}</option>
                                    {customers.map(c => (
                                        <option key={c.id} value={c.id}>{c.full_name} ({c.phone})</option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex gap-4 pt-4">
                                <button
                                    type="submit"
                                    className="flex-1 bg-purple-600 hover:bg-purple-500 text-white font-bold py-3.5 rounded-xl shadow-lg transition-all"
                                >
                                    {t('save')}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowModal(false);
                                        setFormData({ id: null, uid: '', customer_id: '' });
                                    }}
                                    className="flex-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 py-3.5 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-all font-bold"
                                >
                                    {t('cancel')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
