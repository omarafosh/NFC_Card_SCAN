'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { CreditCard, Wifi, WifiOff, Loader2, User, CheckCircle2, XCircle, Settings, Save, Delete, UserPlus, Zap, Receipt } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useLanguage } from '@/lib/LanguageContext';

export default function ScanPage() {
    const { t, dir } = useLanguage();
    const [status, setStatus] = useState('disconnected');
    const [scanResult, setScanResult] = useState(null);
    const [showSettings, setShowSettings] = useState(false);
    const [pageSettings, setPageSettings] = useState({ currency_symbol: '$' });

    const [branches, setBranches] = useState([]);
    const [terminals, setTerminals] = useState([]);
    const [selectedBranch, setSelectedBranch] = useState('');
    const [selectedTerminal, setSelectedTerminal] = useState('');

    const router = useRouter();
    const isMounted = useRef(true);
    const audioContextRef = useRef(null);

    // Initial load: Settings and Branches
    useEffect(() => {
        const savedBranch = localStorage.getItem('selected_branch');
        const savedTerminal = localStorage.getItem('selected_terminal');

        if (savedBranch) setSelectedBranch(savedBranch);
        if (savedTerminal) setSelectedTerminal(savedTerminal);

        fetch('/api/settings')
            .then(res => res.json())
            .then(data => setPageSettings(data.data || { currency_symbol: '$' }))
            .catch(err => console.error('Failed to load settings', err));

        fetch('/api/branches')
            .then(res => res.json())
            .then(data => setBranches(data.data || []))
            .catch(err => console.error('Failed to load branches', err));
    }, []);

    // Load Terminals when Branch changes
    useEffect(() => {
        if (!selectedBranch) {
            setTerminals([]);
            return;
        }
        fetch(`/api/terminals?branch_id=${selectedBranch}`)
            .then(res => res.json())
            .then(data => setTerminals(data.data || []))
            .catch(err => console.error('Failed to load terminals', err));
    }, [selectedBranch]);

    // Supabase Realtime Subscription
    useEffect(() => {
        if (!selectedTerminal) return;

        console.log(`Subscribing to realtime events for Terminal: ${selectedTerminal}`);
        isMounted.current = true;

        const channel = supabase
            .channel(`terminal-${selectedTerminal}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'scan_events',
                    filter: `terminal_id=eq.${selectedTerminal}`
                },
                (payload) => {
                    console.log('Realtime scan detected:', payload);
                    if (payload.new && payload.new.uid) {
                        processScan(payload.new.uid);
                    }
                }
            )
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    setStatus('connected');
                } else {
                    setStatus('disconnected');
                }
            });

        return () => {
            isMounted.current = false;
            supabase.removeChannel(channel);
        };
    }, [selectedTerminal]);

    const handleTerminalSelect = (terminalId) => {
        const terminal = terminals.find(t => t.id.toString() === terminalId);
        if (terminal) {
            setSelectedTerminal(terminalId);
            localStorage.setItem('selected_terminal', terminalId);
            localStorage.setItem('selected_branch', selectedBranch);
            toast.success(t('connected'));
        }
    };

    const playSound = (type) => {
        try {
            if (!audioContextRef.current) {
                audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
            }
            const ctx = audioContextRef.current;
            const oscillator = ctx.createOscillator();
            const gainNode = ctx.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(ctx.destination);

            if (type === 'success') {
                oscillator.type = 'sine';
                oscillator.frequency.setValueAtTime(800, ctx.currentTime);
                oscillator.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.1);
                gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
                oscillator.start();
                oscillator.stop(ctx.currentTime + 0.3);
            } else if (type === 'error') {
                oscillator.type = 'sawtooth';
                oscillator.frequency.setValueAtTime(150, ctx.currentTime);
                oscillator.frequency.linearRampToValueAtTime(100, ctx.currentTime + 0.2);
                gainNode.gain.setValueAtTime(0.2, ctx.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
                oscillator.start();
                oscillator.stop(ctx.currentTime + 0.3);
            }
        } catch (e) {
            console.error('Audio play failed', e);
        }
    };

    const processScan = async (uid) => {
        setStatus('processing');
        setScanResult(null);
        toast.dismiss();
        toast.info(t('processing'));

        try {
            const res = await fetch('/api/scan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ uid }),
            });
            const data = await res.json();
            setScanResult(data);

            if (data.status === 'success') {
                toast.success(`${t('connected')}: ${data.customer.full_name}`);
                playSound('success');
            } else {
                playSound('error');
            }
        } catch (err) {
            toast.error(t('network_error'));
            playSound('error');
        } finally {
            setStatus('connected');
        }
    };

    return (
        <div className="max-w-4xl mx-auto relative antialiased" suppressHydrationWarning>
            <div className={`flex items-center justify-between mb-8`}>
                <div className="flex gap-2">
                    <button
                        onClick={() => setShowSettings(!showSettings)}
                        className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg dark:text-gray-400 dark:hover:bg-gray-800 transition"
                    >
                        <Settings size={20} />
                    </button>
                    <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${status === 'connected' || status === 'processing'
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        }`}>
                        {status === 'connected' || status === 'processing' ? <Zap size={18} className="fill-current" /> : <WifiOff size={18} />}
                        {status === 'connected' || status === 'processing' ? t('connected') : t('disconnected')}
                    </div>
                </div>
            </div>

            {/* Connection Settings - Bilingual */}
            {showSettings && (
                <div className={`absolute top-16 start-0 z-50 w-80 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 p-6 animate-in slide-in-from-top-2 duration-200`}>
                    <h3 className={`font-bold text-gray-900 dark:text-white mb-4 text-start`}>Reader Connection</h3>
                    <div className="space-y-4">
                        <div>
                            <label className={`block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 text-start`}>{t('terminal_branch')}</label>
                            <select
                                value={selectedBranch}
                                onChange={(e) => {
                                    setSelectedBranch(e.target.value);
                                    setSelectedTerminal('');
                                }}
                                className={`w-full px-4 py-2.5 text-sm border-none bg-gray-50 dark:bg-gray-900 rounded-xl dark:text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all text-start`}
                            >
                                <option value="">{t('tabs_branches')}...</option>
                                {branches.map(b => (
                                    <option key={b.id} value={b.id}>{b.name}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className={`block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('tabs_terminals')}</label>
                            <select
                                value={selectedTerminal}
                                onChange={(e) => handleTerminalSelect(e.target.value)}
                                disabled={!selectedBranch}
                                className={`w-full px-4 py-2.5 text-sm border-none bg-gray-50 dark:bg-gray-900 rounded-xl dark:text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all disabled:opacity-50 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}
                            >
                                <option value="">{t('tabs_terminals')}...</option>
                                {terminals.map(t => (
                                    <option key={t.id} value={t.id}>{t.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>
            )}

            <div className={`grid grid-cols-1 md:grid-cols-2 gap-8`}>
                {/* Left: Scan Area */}
                <div className={`bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 p-12 flex flex-col items-center justify-center text-center min-h-[450px]`}>
                    {status === 'processing' ? (
                        <div className="animate-pulse flex flex-col items-center">
                            <div className="h-32 w-32 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center mb-8">
                                <Loader2 className="animate-spin text-blue-600 dark:text-blue-400" size={64} />
                            </div>
                            <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{t('processing')}</h3>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center">
                            <div className={`h-32 w-32 rounded-full flex items-center justify-center mb-8 transition-all ${status === 'connected'
                                ? 'bg-blue-600 text-white shadow-xl shadow-blue-200 dark:shadow-none animate-pulse'
                                : 'bg-gray-100 dark:bg-gray-700 text-gray-400'
                                }`}>
                                <CreditCard size={64} />
                            </div>
                            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                                {t('waiting_card')}
                            </h3>
                            <p className="text-gray-500 dark:text-gray-400 max-w-xs leading-relaxed">
                                {t('scan_desc')}
                            </p>
                            <div className="mt-8 text-[10px] font-bold text-blue-500 uppercase tracking-widest bg-blue-50 dark:bg-blue-900/30 px-4 py-1.5 rounded-full">
                                {t('realtime_enabled')}
                            </div>
                        </div>
                    )}
                </div>

                {/* Right: Result Area */}
                <div className="space-y-6">
                    {scanResult ? (
                        scanResult.status === 'success' ? (
                            <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl border border-green-100 dark:border-green-900/50 overflow-hidden animate-in zoom-in-95 duration-300">
                                <div className={`bg-green-500/10 p-8 border-b border-green-100 dark:border-green-900/50 flex items-center gap-6`}>
                                    <div className="h-16 w-16 rounded-2xl bg-green-500 text-white flex items-center justify-center shadow-lg shadow-green-200 dark:shadow-none">
                                        <CheckCircle2 size={32} />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-black text-gray-900 dark:text-white lowercase tracking-tight">Verified Member</h3>
                                        <p className="text-sm font-bold text-green-600 dark:text-green-400 uppercase tracking-widest">{t('connected')}</p>
                                    </div>
                                </div>
                                <div className="p-8 space-y-6">
                                    <div className={`flex justify-between items-start`}>
                                        <div className={dir === 'rtl' ? 'text-right' : 'text-left'}>
                                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 block">{t('customer_name')}</label>
                                            <p className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">{scanResult.customer.full_name}</p>
                                        </div>
                                        <div className={dir === 'rtl' ? 'text-left' : 'text-right'}>
                                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 block">{t('customer_points')}</label>
                                            <p className="text-3xl font-black text-blue-600 dark:text-blue-400 tracking-tighter">{scanResult.customer.points_balance}</p>
                                        </div>
                                    </div>

                                    <hr className="border-gray-100 dark:border-gray-700" />

                                    <CheckoutForm
                                        customer={scanResult.customer}
                                        card={scanResult.card}
                                        rewards={scanResult.availableRewards}
                                        currency={pageSettings.currency_symbol}
                                        onComplete={() => setScanResult(null)}
                                    />
                                </div>
                            </div>
                        ) : (
                            <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-red-100 dark:border-red-900/50 p-12 text-center animate-shake">
                                <div className="mx-auto h-20 w-20 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center text-red-500 mb-6">
                                    <XCircle size={48} />
                                </div>
                                <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-3">
                                    {scanResult.status === 'unknown_card' ? 'Unregistered Link' : scanResult.message}
                                </h3>
                                <p className="text-gray-500 mb-8 font-mono text-sm bg-gray-50 dark:bg-gray-900 py-2 rounded-xl border dark:border-gray-700">
                                    UID: {scanResult.uid}
                                </p>

                                {scanResult.status === 'unknown_card' && (
                                    <button
                                        onClick={() => router.push(`/dashboard/customers?uid=${scanResult.uid}`)}
                                        className="w-full mb-4 flex items-center justify-center gap-3 bg-blue-600 text-white px-8 py-4 rounded-2xl hover:bg-blue-700 transition font-black text-lg shadow-xl shadow-blue-200 dark:shadow-none"
                                    >
                                        <UserPlus size={24} />
                                        {t('register_customer')}
                                    </button>
                                )}

                                <button onClick={() => setScanResult(null)} className="w-full px-8 py-3 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-2xl hover:bg-gray-200 transition font-bold">
                                    {t('cancel')}
                                </button>
                            </div>
                        )
                    ) : (
                        <div className="bg-gray-50 dark:bg-gray-900/30 rounded-3xl border-2 border-dashed border-gray-100 dark:border-gray-800 h-full min-h-[450px] flex flex-col items-center justify-center text-gray-400 p-8 text-center">
                            <div className="h-16 w-16 rounded-2xl border-2 border-gray-100 dark:border-gray-800 flex items-center justify-center mb-6">
                                <User size={32} className="opacity-30" />
                            </div>
                            <p className="max-w-[200px] font-bold text-sm leading-relaxed uppercase tracking-widest opacity-40">Scan card to begin identify workflow</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function CheckoutForm({ customer, card, rewards, currency, onComplete }) {
    const { t, dir } = useLanguage();
    const [amount, setAmount] = useState('');
    const [selectedRewardId, setSelectedRewardId] = useState('');
    const [loading, setLoading] = useState(false);

    const rewardsArray = Array.isArray(rewards) ? rewards : [];
    const selectedReward = rewardsArray.find(r => r.id.toString() === selectedRewardId);

    const finalAmount = () => {
        const amt = parseFloat(amount) || 0;
        if (!selectedReward) return amt;
        if (selectedReward.type === 'percentage') return Math.max(0, amt - (amt * (selectedReward.value / 100)));
        if (selectedReward.type === 'fixed_amount') return Math.max(0, amt - selectedReward.value);
        return amt;
    };

    const handleCheckout = async () => {
        if (!amount || parseFloat(amount) <= 0) return;
        setLoading(true);
        try {
            const res = await fetch('/api/transactions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    customer_id: customer.id,
                    card_id: card.id,
                    discount_id: selectedRewardId || null,
                    amount: parseFloat(amount)
                })
            });
            const data = await res.json();
            if (res.ok) {
                toast.success(`Success: ${currency}${data.amount_after} | +${data.points_earned} pts`);
                onComplete();
            } else {
                toast.error(data.message || 'Error');
            }
        } catch (err) {
            toast.error(t('network_error'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-8">
            <div className="relative">
                <div className={`absolute -top-3 ${dir === 'rtl' ? 'right-4' : 'left-4'} bg-white dark:bg-gray-800 px-2 text-[10px] font-black text-blue-600 uppercase tracking-widest z-10`}>{t('invoice_val')}</div>
                <div className={`flex items-center justify-end w-full bg-gray-50 dark:bg-gray-900 border-2 border-gray-100 dark:border-gray-700 rounded-3xl px-8 py-8 h-32 focus-within:border-blue-500 transition-all ${dir === 'rtl' ? 'flex-row' : 'flex-row-reverse'}`}>
                    <span className="text-6xl font-black font-mono tracking-tighter text-gray-900 dark:text-white">
                        {amount || '0.00'}
                    </span>
                    <span className="text-3xl text-gray-300 ml-4 font-black">{currency}</span>
                </div>
            </div>

            <div className="grid grid-cols-4 gap-3">
                {[10, 20, 50, 100].map(amt => (
                    <button key={amt} onClick={() => setAmount(prev => (parseFloat(prev || 0) + amt).toString())} className="bg-gray-50 dark:bg-gray-900 hover:bg-gray-100 py-3 rounded-2xl text-sm font-black transition-all border border-gray-100 dark:border-gray-800">+{amt}</button>
                ))}
            </div>

            <div className="space-y-4">
                <label className={`block text-[10px] font-bold text-gray-400 uppercase tracking-widest text-start`}>{t('nav_discounts')}</label>
                <div className="bg-gray-50 dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
                    <table className="w-full text-xs text-start">
                        <thead className="bg-gray-100 dark:bg-gray-800 text-gray-500 uppercase font-black">
                            <tr>
                                <th className="px-4 py-2 text-start">{t('discount_name')}</th>
                                <th className="px-4 py-2 text-start">{t('discount_value')}</th>
                                <th className="px-4 py-2 text-center">{t('actions')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                            {rewardsArray.length === 0 ? (
                                <tr>
                                    <td colSpan="3" className="px-4 py-4 text-center text-gray-400 italic">{t('no_data')}</td>
                                </tr>
                            ) : (
                                rewardsArray.map(reward => (
                                    <tr key={reward.id} className={`hover:bg-white dark:hover:bg-gray-800 transition-colors ${selectedRewardId === reward.id.toString() ? 'bg-blue-50/50 dark:bg-blue-900/20' : ''}`}>
                                        <td className="px-4 py-3 font-bold">{reward.name}</td>
                                        <td className="px-4 py-3">
                                            <span className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-2 py-0.5 rounded-full font-bold">
                                                {reward.type === 'percentage' ? `${reward.value}%` : `${currency}${reward.value}`}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <button
                                                onClick={() => setSelectedRewardId(selectedRewardId === reward.id.toString() ? '' : reward.id.toString())}
                                                className={`px-3 py-1 rounded-lg text-[10px] font-black tracking-widest uppercase transition-all ${selectedRewardId === reward.id.toString()
                                                    ? 'bg-blue-600 text-white shadow-lg'
                                                    : 'bg-gray-200 dark:bg-gray-700 text-gray-500'
                                                    }`}
                                            >
                                                {selectedRewardId === reward.id.toString() ? t('cancel') : 'Apply'}
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className={`pt-6 border-t border-gray-100 dark:border-gray-700 flex flex-col gap-6`}>
                <div className={`flex justify-between items-end ${dir === 'rtl' ? 'flex-row-reverse' : ''}`}>
                    <span className="text-gray-400 font-bold uppercase tracking-widest text-xs">Total Due</span>
                    <span className="text-4xl font-black text-gray-900 dark:text-white tracking-tighter">{currency}{finalAmount().toFixed(2)}</span>
                </div>
                <button
                    onClick={handleCheckout}
                    disabled={loading || !amount}
                    className="w-full py-5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-xl disabled:opacity-50 transition-all shadow-xl shadow-blue-200 dark:shadow-none active:scale-95 flex items-center justify-center gap-3"
                >
                    {loading ? <Loader2 className="animate-spin" /> : <Receipt size={24} />}
                    {t('checkout')}
                </button>
            </div>
        </div>
    );
}
