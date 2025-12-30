'use client';
import { useState, useEffect } from 'react';
import { Plus, Building2, Zap, Trash2, Edit, Key, Monitor, Users, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/lib/LanguageContext';
import DataTable from '@/components/DataTable';

export default function ManagementPage() {
    const { t, dir } = useLanguage();
    const [activeTab, setActiveTab] = useState('branches');
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) return null;

    return (
        <div className="max-w-6xl mx-auto" suppressHydrationWarning>
            <div className={`flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4`}>
                <div>
                    <h1 className="text-3xl font-bold text-gray-800 dark:text-white flex items-center gap-3">
                        {t('enterprise_management')}
                        <span className="text-sm font-normal text-gray-400 mt-1">Enterprise</span>
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">{t('enterprise_desc')}</p>
                </div>
            </div>

            {/* Tabs - Modern & Bilingual */}
            <div className={`flex border-b border-gray-200 dark:border-gray-700 mb-8 bg-white dark:bg-gray-800 rounded-t-2xl overflow-hidden shadow-sm`}>
                <button
                    onClick={() => setActiveTab('branches')}
                    className={`flex items-center gap-2 px-8 py-5 transition-all ${activeTab === 'branches'
                        ? 'border-b-2 border-blue-600 text-blue-600 bg-blue-50/50 dark:bg-blue-900/10'
                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50'}`}
                >
                    <Building2 size={20} />
                    <span className="font-bold">{t('tabs_branches')}</span>
                </button>
                <button
                    onClick={() => setActiveTab('terminals')}
                    className={`flex items-center gap-2 px-8 py-5 transition-all ${activeTab === 'terminals'
                        ? 'border-b-2 border-blue-600 text-blue-600 bg-blue-50/50 dark:bg-blue-900/10'
                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50'}`}
                >
                    <Monitor size={20} />
                    <span className="font-bold">{t('tabs_terminals')}</span>
                </button>
                <button
                    onClick={() => setActiveTab('users')}
                    className={`flex items-center gap-2 px-8 py-5 transition-all ${activeTab === 'users'
                        ? 'border-b-2 border-blue-600 text-blue-600 bg-blue-50/50 dark:bg-blue-900/10'
                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50'}`}
                >
                    <Users size={20} />
                    <span className="font-bold">{t('tabs_users')}</span>
                </button>
            </div>

            {/* Content Area */}
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                {activeTab === 'branches' && <BranchManagement />}
                {activeTab === 'terminals' && <TerminalManagement />}
                {activeTab === 'users' && <UserManagement />}
            </div>
        </div>
    );
}

function BranchManagement() {
    const { t, dir } = useLanguage();
    const [branches, setBranches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [formData, setFormData] = useState({ id: null, name: '', location: '', is_active: true });

    const fetchBranches = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/branches');
            const data = await res.json();
            setBranches(data.data || []);
        } catch (e) {
            toast.error(t('error_loading'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchBranches();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        const isEdit = !!formData.id;
        try {
            const res = await fetch(isEdit ? `/api/branches/${formData.id}` : '/api/branches', {
                method: isEdit ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });
            if (res.ok) {
                toast.success(t('save_success') || 'Success');
                setShowModal(false);
                setFormData({ id: null, name: '', location: '', is_active: true });
                fetchBranches();
            }
        } catch (err) {
            toast.error(t('network_error'));
        }
    };

    const handleDelete = async (id) => {
        if (!confirm(t('confirm_delete') || 'Are you sure?')) return;
        try {
            const res = await fetch(`/api/branches?id=${id}`, { method: 'DELETE' });
            if (res.ok) {
                toast.success(t('delete_success'));
                fetchBranches();
            }
        } catch (e) {
            toast.error(t('delete_error'));
        }
    };

    const filteredBranches = branches.filter(b =>
        b.name.toLowerCase().includes(search.toLowerCase()) ||
        (b.location && b.location.toLowerCase().includes(search.toLowerCase()))
    );

    const columns = [
        {
            header: t('branch_name'),
            accessor: 'name',
            className: 'font-bold text-gray-900 dark:text-white'
        },
        {
            header: t('branch_location'),
            accessor: 'location',
            cell: (row) => (
                <div className={`flex items-center gap-2 ${dir === 'rtl' ? 'flex-row-reverse' : ''}`}>
                    <MapPin size={14} className="text-gray-400" />
                    <span>{row.location || '---'}</span>
                </div>
            )
        },
        {
            header: t('status'),
            accessor: 'is_active',
            cell: (row) => (
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${row.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    Active
                </span>
            )
        },
        {
            header: t('actions'),
            className: 'w-24',
            cell: (row) => (
                <div className={`flex gap-1 ${dir === 'rtl' ? 'justify-end' : 'justify-start'}`}>
                    <button
                        onClick={() => {
                            setFormData({
                                id: row.id,
                                name: row.name,
                                location: row.location || '',
                                is_active: row.is_active
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

    return (
        <div className="space-y-6">
            <DataTable
                columns={columns}
                data={filteredBranches}
                loading={loading}
                searchTerm={search}
                onSearchChange={setSearch}
                actions={
                    <button
                        onClick={() => setShowModal(true)}
                        className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl shadow-lg transition-all active:scale-95 font-bold flex items-center justify-center gap-2"
                    >
                        <Plus size={20} />
                        {t('add_branch')}
                    </button>
                }
            />

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 w-full max-w-md animate-in fade-in zoom-in duration-200">
                        <h2 className={`text-2xl font-bold mb-6 dark:text-white text-start`}>
                            {formData.id ? t('edit') : t('add_branch')}
                        </h2>
                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div>
                                <label className={`block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                                    {t('branch_name')}
                                </label>
                                <input
                                    type="text"
                                    required
                                    className={`w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl dark:text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all text-start`}
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className={`block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                                    {t('branch_location')}
                                </label>
                                <input
                                    type="text"
                                    className={`w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl dark:text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all text-start`}
                                    value={formData.location}
                                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                                />
                            </div>
                            <div className="flex gap-4 pt-4">
                                <button type="submit" className="flex-1 bg-blue-600 text-white font-bold py-3.5 rounded-xl shadow-lg">{t('save')}</button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowModal(false);
                                        setFormData({ id: null, name: '', location: '', is_active: true });
                                    }}
                                    className="flex-1 bg-gray-100 dark:bg-gray-700 py-3.5 rounded-xl font-bold font-bold text-gray-600 dark:text-gray-300"
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

function TerminalManagement() {
    const { t, dir } = useLanguage();
    const [terminals, setTerminals] = useState([]);
    const [branches, setBranches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [formData, setFormData] = useState({ id: null, branch_id: '', name: '', connection_url: 'cloud-sync', is_active: true });

    const fetchData = async () => {
        setLoading(true);
        try {
            const [tRes, bRes] = await Promise.all([
                fetch('/api/terminals'),
                fetch('/api/branches')
            ]);
            const tData = await tRes.json();
            const bData = await bRes.json();
            setTerminals(tData.data || []);
            setBranches(bData.data || []);
        } catch (e) {
            toast.error(t('error_loading'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        const isEdit = !!formData.id;
        try {
            const res = await fetch(isEdit ? `/api/terminals/${formData.id}` : '/api/terminals', {
                method: isEdit ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });
            if (res.ok) {
                toast.success(t('save_success'));
                setShowModal(false);
                setFormData({ id: null, branch_id: '', name: '', connection_url: 'cloud-sync', is_active: true });
                fetchData();
            }
        } catch (err) {
            toast.error(t('network_error'));
        }
    };

    const handleDelete = async (id) => {
        if (!confirm(t('confirm_delete'))) return;
        try {
            const res = await fetch(`/api/terminals?id=${id}`, { method: 'DELETE' });
            if (res.ok) {
                toast.success(t('delete_success'));
                fetchData();
            }
        } catch (e) {
            toast.error(t('delete_error'));
        }
    };

    const filteredTerminals = terminals.filter(t =>
        t.name.toLowerCase().includes(search.toLowerCase())
    );

    const columns = [
        {
            header: t('terminal_name'),
            accessor: 'name',
            className: 'font-bold text-gray-900 dark:text-white'
        },
        {
            header: t('terminal_branch'),
            accessor: 'branch_id',
            cell: (row) => branches.find(b => b.id === row.branch_id)?.name || '---'
        },
        {
            header: t('terminal_secret'),
            accessor: 'terminal_secret',
            cell: (row) => (
                <div className={`flex items-center gap-2 text-xs font-mono text-gray-400 bg-gray-50 dark:bg-gray-900 px-2 py-1 rounded border dark:border-gray-700 w-fit ${dir === 'rtl' ? 'flex-row-reverse' : ''}`}>
                    <Key size={12} />
                    <span>{row.terminal_secret.slice(0, 8)}...</span>
                </div>
            )
        },
        {
            header: t('status'),
            accessor: 'is_active',
            cell: (row) => (
                <div className="flex items-center gap-2 text-[10px] text-green-500 font-bold uppercase tracking-wider">
                    <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse"></div>
                    Online
                </div>
            )
        },
        {
            header: t('actions'),
            className: 'w-24',
            cell: (row) => (
                <div className={`flex gap-1 ${dir === 'rtl' ? 'justify-end' : 'justify-start'}`}>
                    <button
                        onClick={() => {
                            setFormData({
                                id: row.id,
                                branch_id: row.branch_id || '',
                                name: row.name,
                                connection_url: row.connection_url,
                                is_active: row.is_active
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

    return (
        <div className="space-y-6">
            <DataTable
                columns={columns}
                data={filteredTerminals}
                loading={loading}
                searchTerm={search}
                onSearchChange={setSearch}
                actions={
                    <button
                        onClick={() => setShowModal(true)}
                        className="w-full md:w-auto bg-purple-600 hover:bg-purple-700 text-white px-5 py-2.5 rounded-xl shadow-lg transition-all active:scale-95 font-bold flex items-center justify-center gap-2"
                    >
                        <Plus size={20} />
                        {t('add_terminal')}
                    </button>
                }
            />

            {/* Terminal Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 w-full max-w-md animate-in fade-in zoom-in duration-200">
                        <div className={`flex items-center gap-2 mb-2 text-purple-600 ${dir === 'rtl' ? 'justify-end' : ''}`}>
                            <Zap size={14} />
                            <span className="text-xs font-bold uppercase tracking-widest">Hardware Node</span>
                        </div>
                        <h2 className={`text-2xl font-bold mb-6 dark:text-white text-start`}>
                            {formData.id ? t('edit') : t('add_terminal')}
                        </h2>
                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div>
                                <label className={`block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                                    {t('terminal_branch')}
                                </label>
                                <select
                                    required
                                    className={`w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl dark:text-white outline-none focus:ring-2 focus:ring-purple-500 transition-all ${dir === 'rtl' ? 'text-right' : 'text-left'}`}
                                    value={formData.branch_id}
                                    onChange={(e) => setFormData({ ...formData, branch_id: e.target.value })}
                                >
                                    <option value="">-- {t('terminal_branch')} --</option>
                                    {branches.map(b => (
                                        <option key={b.id} value={b.id}>{b.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className={`block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                                    {t('terminal_name')}
                                </label>
                                <input
                                    type="text"
                                    required
                                    className={`w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl dark:text-white outline-none focus:ring-2 focus:ring-purple-500 transition-all text-start`}
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>
                            <div className="flex gap-4 pt-4">
                                <button type="submit" className="flex-1 bg-purple-600 text-white font-bold py-3.5 rounded-xl shadow-lg">{t('save')}</button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowModal(false);
                                        setFormData({ id: null, branch_id: '', name: '', connection_url: 'cloud-sync', is_active: true });
                                    }}
                                    className="flex-1 bg-gray-100 dark:bg-gray-700 py-3.5 rounded-xl font-bold text-gray-600 dark:text-gray-300"
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

function UserManagement() {
    const { t, dir } = useLanguage();
    const [users, setUsers] = useState([]);
    const [branches, setBranches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [formData, setFormData] = useState({ id: null, username: '', password: '', role: 'staff', branch_id: '' });

    const fetchData = async () => {
        setLoading(true);
        try {
            const [uRes, bRes] = await Promise.all([
                fetch('/api/users'),
                fetch('/api/branches')
            ]);
            const uData = await uRes.json();
            const bData = await bRes.json();
            setUsers(uData.data || []);
            setBranches(bData.data || []);
        } catch (e) {
            toast.error(t('error_loading'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        const isEdit = !!formData.id;
        try {
            const res = await fetch(isEdit ? `/api/users/${formData.id}` : '/api/users', {
                method: isEdit ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });
            const data = await res.json();
            if (res.ok) {
                toast.success(t('save_success'));
                setShowModal(false);
                setFormData({ id: null, username: '', password: '', role: 'staff', branch_id: '' });
                fetchData();
            }
            else {
                toast.error(data.message || 'Error');
            }
        } catch (err) {
            toast.error(t('network_error'));
        }
    };

    const handleDelete = async (id) => {
        if (!confirm(t('confirm_delete'))) return;
        try {
            const res = await fetch(`/api/users?id=${id}`, { method: 'DELETE' });
            if (res.ok) {
                toast.success(t('delete_success'));
                fetchData();
            } else {
                const data = await res.json();
                toast.error(data.message);
            }
        } catch (e) {
            toast.error(t('delete_error'));
        }
    };

    const filteredUsers = users.filter(u =>
        u.username.toLowerCase().includes(search.toLowerCase())
    );

    const columns = [
        {
            header: t('username'),
            accessor: 'username',
            className: 'font-bold text-gray-900 dark:text-white'
        },
        {
            header: t('role'),
            accessor: 'role',
            cell: (row) => (
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${row.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>
                    {t(row.role)}
                </span>
            )
        },
        {
            header: t('terminal_branch'),
            accessor: 'branch_id',
            cell: (row) => branches.find(b => b.id === row.branch_id)?.name || '---'
        },
        {
            header: t('date'),
            accessor: 'created_at',
            cell: (row) => <span className="text-gray-400 text-xs">{new Date(row.created_at).toLocaleDateString()}</span>
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
                                username: row.username,
                                password: '', // Reset password for security/privacy
                                role: row.role,
                                branch_id: row.branch_id || ''
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

    return (
        <div className="space-y-6">
            <DataTable
                columns={columns}
                data={filteredUsers}
                loading={loading}
                searchTerm={search}
                onSearchChange={setSearch}
                actions={
                    <button
                        onClick={() => setShowModal(true)}
                        className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl shadow-lg transition-all active:scale-95 font-bold flex items-center justify-center gap-2"
                    >
                        <Plus size={20} />
                        {t('add_user')}
                    </button>
                }
            />

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 w-full max-w-md animate-in fade-in zoom-in duration-200">
                        <h2 className={`text-2xl font-bold mb-6 dark:text-white text-start`}>
                            {formData.id ? t('edit') : t('add_user')}
                        </h2>
                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div>
                                <label className={`block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2 text-start`}>
                                    {t('username')}
                                </label>
                                <input
                                    type="text"
                                    required
                                    className={`w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl dark:text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all text-start`}
                                    value={formData.username}
                                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className={`block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2 text-start`}>
                                    {t('password')}
                                </label>
                                <input
                                    type="password"
                                    required={!formData.id}
                                    className={`w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl dark:text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all text-start`}
                                    value={formData.password}
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                />
                                {formData.id && <p className="text-[10px] text-gray-400 mt-1">Leave blank to keep current password</p>}
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={`block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2 text-start text-xs uppercase tracking-widest`}>
                                        {t('role')}
                                    </label>
                                    <select
                                        className={`w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl dark:text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all text-start`}
                                        value={formData.role}
                                        onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                                    >
                                        <option value="admin">{t('admin')}</option>
                                        <option value="staff">{t('staff')}</option>
                                    </select>
                                </div>
                                <div>
                                    <label className={`block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2 text-start text-xs uppercase tracking-widest`}>
                                        {t('terminal_branch')}
                                    </label>
                                    <select
                                        className={`w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl dark:text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all text-start`}
                                        value={formData.branch_id}
                                        onChange={(e) => setFormData({ ...formData, branch_id: e.target.value })}
                                    >
                                        <option value="">{t('all_branches')}</option>
                                        {branches.map(b => (
                                            <option key={b.id} value={b.id}>{b.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div className="flex gap-4 pt-4">
                                <button type="submit" className="flex-1 bg-blue-600 text-white font-bold py-3.5 rounded-xl shadow-lg">{t('save')}</button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowModal(false);
                                        setFormData({ id: null, username: '', password: '', role: 'staff', branch_id: '' });
                                    }}
                                    className="flex-1 bg-gray-100 dark:bg-gray-700 py-3.5 rounded-xl font-bold text-gray-600 dark:text-gray-300"
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
