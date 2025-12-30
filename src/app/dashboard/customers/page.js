'use client';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Plus, Trash2, Edit, CreditCard, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/lib/LanguageContext';
import DataTable from '@/components/DataTable';

export default function CustomersPage() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center p-20 font-bold opacity-50">Loading...</div>}>
            <CustomersContent />
        </Suspense>
    );
}

function CustomersContent() {
    const { t, dir } = useLanguage();
    const [mounted, setMounted] = useState(false);
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [formData, setFormData] = useState({ id: null, full_name: '', phone: '', email: '', uid: '' });

    const searchParams = useSearchParams();
    const uidFromUrl = searchParams.get('uid');

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (uidFromUrl && mounted) {
            setFormData(prev => ({ ...prev, uid: uidFromUrl }));
            setShowModal(true);
        }
    }, [uidFromUrl, mounted]);

    const fetchCustomers = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/customers?search=${encodeURIComponent(search)}`);
            const data = await res.json();
            setCustomers(data.data || []);
        } catch (e) {
            toast.error(t('error_loading'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const timeout = setTimeout(fetchCustomers, 300);
        return () => clearTimeout(timeout);
    }, [search]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        const isEdit = !!formData.id;
        try {
            const res = await fetch(isEdit ? `/api/customers/${formData.id}` : '/api/customers', {
                method: isEdit ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });
            if (res.ok) {
                setShowModal(false);
                setFormData({ id: null, full_name: '', phone: '', email: '', uid: '' });
                toast.success(t('save_success') || 'Success');
                fetchCustomers();
            } else {
                const error = await res.json();
                toast.error(error.message || t('save_error'));
            }
        } catch (err) {
            toast.error(t('network_error'));
        }
    };

    const handleDelete = async (id) => {
        if (!confirm(t('confirm_delete') || 'Are you sure?')) return;
        try {
            const res = await fetch(`/api/customers/${id}`, { method: 'DELETE' });
            if (res.ok) {
                toast.success(t('delete_success') || 'Deleted');
                fetchCustomers();
            }
        } catch (e) {
            toast.error(t('delete_error'));
        }
    };

    const columns = [
        {
            header: t('customer_name'),
            accessor: 'full_name',
            className: 'font-bold text-gray-900 dark:text-white'
        },
        { header: t('customer_phone'), accessor: 'phone' },
        { header: t('customer_email'), accessor: 'email' },
        {
            header: t('customer_points'),
            accessor: 'points_balance',
            cell: (row) => (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                    {row.points_balance}
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
                                full_name: row.full_name,
                                phone: row.phone || '',
                                email: row.email || '',
                                uid: '' // Card UID is usually not editable this way
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
                    className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl shadow-lg transition-all active:scale-95 font-bold flex items-center justify-center gap-2"
                >
                    <UserPlus size={20} />
                    {t('register_customer')}
                </button>
                <div>
                    <h1 className="text-3xl font-bold text-gray-800 dark:text-white flex items-center gap-3">
                        {t('nav_customers')}
                        <span className="text-sm font-normal text-gray-400 mt-1">Registry</span>
                    </h1>
                </div>
            </div>

            <DataTable
                columns={columns}
                data={customers}
                loading={loading}
                searchTerm={search}
                onSearchChange={setSearch}
                searchPlaceholder={t('search')}
            />

            {/* Modal - Modern & Bilingual */}
            {showModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 w-full max-w-md animate-in fade-in zoom-in duration-200">
                        <div className="flex items-center gap-2 mb-2 text-blue-600">
                            <UserPlus size={18} />
                            <span className="text-xs font-bold uppercase tracking-widest">New Member</span>
                        </div>
                        <h2 className={`text-2xl font-bold mb-6 dark:text-white text-start`}>
                            {formData.id ? t('edit') : t('register_customer')}
                        </h2>
                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div>
                                <label className={`block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2 text-start`}>
                                    {t('customer_name')}
                                </label>
                                <input
                                    type="text"
                                    required
                                    className={`w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl dark:text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all text-start`}
                                    value={formData.full_name}
                                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className={`block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2 text-start`}>
                                    {t('customer_phone')}
                                </label>
                                <input
                                    type="text"
                                    className={`w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl dark:text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all ${dir === 'rtl' ? 'text-right' : 'text-left'}`}
                                    value={formData.phone}
                                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className={`block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2 text-start`}>
                                    {t('customer_email')}
                                </label>
                                <input
                                    type="email"
                                    className={`w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl dark:text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all ${dir === 'rtl' ? 'text-right' : 'text-left'}`}
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className={`block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2 flex items-center gap-2 ${dir === 'rtl' ? 'flex-row-reverse' : ''}`}>
                                    <CreditCard size={14} className="text-blue-500" />
                                    {t('card_uid')}
                                </label>
                                <input
                                    type="text"
                                    className={`w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl dark:text-white outline-none focus:ring-2 focus:ring-blue-500 font-mono transition-all ${dir === 'rtl' ? 'text-right' : 'text-left'}`}
                                    value={formData.uid}
                                    onChange={(e) => setFormData({ ...formData, uid: e.target.value })}
                                    placeholder="e.g. AB:CD:12:34"
                                />
                                {uidFromUrl && <p className={`text-[10px] text-blue-500 mt-2 font-bold ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>Auto-filled from scan</p>}
                            </div>
                            <div className="flex gap-4 pt-4">
                                <button
                                    type="submit"
                                    className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-3.5 rounded-xl shadow-lg transition-all"
                                >
                                    {t('save')}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowModal(false);
                                        setFormData({ id: null, full_name: '', phone: '', email: '', uid: '' });
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
