'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { CreditCard, Wifi, WifiOff, Loader2, User, CheckCircle2, XCircle, Settings, Save, Delete, UserPlus, Zap, Receipt, Wallet, ArrowUpCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useLanguage } from '@/lib/LanguageContext';

export default function ScanPage() {
    const { t, dir } = useLanguage();
    const [selectedRewardId, setSelectedRewardId] = useState('');
    const [manualDiscount, setManualDiscount] = useState('');
    const [manualType, setManualType] = useState('percentage'); // 'percentage' or 'fixed'
    const [status, setStatus] = useState('disconnected');
    const [scanResult, setScanResult] = useState(null);
    const [showSettings, setShowSettings] = useState(false);
    const [pageSettings, setPageSettings] = useState({ currency_symbol: '$' });

    const [branches, setBranches] = useState([]);
    const [terminals, setTerminals] = useState([]);
    const [selectedBranch, setSelectedBranch] = useState('');
    const [selectedTerminal, setSelectedTerminal] = useState('');
    const [retryKey, setRetryKey] = useState(0);

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

        console.log(`[Realtime] Attempting to subscribe for Terminal: ${selectedTerminal}`);
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
                    console.log('[Realtime] Scan event detected:', payload);
                    if (payload.new && payload.new.uid && isMounted.current) {
                        processScan(payload.new.uid);
                    }
                }
            )
            .subscribe((status, err) => {
                console.log(`[Realtime] Subscription status for Terminal ${selectedTerminal}:`, status);

                if (status === 'SUBSCRIBED') {
                    setStatus('connected');
                    console.log('[Realtime] Successfully subscribed to changes.');
                } else if (status === 'CLOSED') {
                    setStatus('disconnected');
                    console.log('[Realtime] Subscription closed.');
                } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                    setStatus('error');
                    console.error(`[Realtime] Subscription Error (${status}):`, err);
                    // No automatic retry here to avoid loops, but we show an error UI
                } else {
                    setStatus('disconnected');
                    console.warn(`[Realtime] Unexpected status: ${status}`);
                }
            });

        return () => {
            console.log(`[Realtime] Cleaning up subscription for Terminal ${selectedTerminal}`);
            isMounted.current = false;
            supabase.removeChannel(channel);
        };
    }, [selectedTerminal, retryKey]);

    const handleTerminalSelect = (terminalId) => {
        const terminal = terminals.find(t => t.id.toString() === terminalId);
        if (terminal) {
            console.log(`[UI] Selecting terminal: ${terminalId}`);
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
        <div className="max-w-6xl mx-auto relative antialiased" suppressHydrationWarning>
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
                        : status === 'error'
                            ? 'bg-red-500 text-white'
                            : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        }`}>
                        {status === 'connected' || status === 'processing' ? <Zap size={18} className="fill-current" /> : <WifiOff size={18} />}
                        {status === 'connected' || status === 'processing' ? t('connected') : status === 'error' ? 'Connection Error' : t('disconnected')}
                        {status === 'error' && (
                            <button
                                onClick={() => setRetryKey(k => k + 1)}
                                className="ms-2 underline text-[10px] font-bold"
                            >
                                Reconnect
                            </button>
                        )}
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

            <div className={`flex flex-col gap-8`}>
                {/* Always visible Scan Area when no result */}
                {!scanResult && (
                    <div className={`bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 p-12 flex flex-col items-center justify-center text-center min-h-[500px]`}>
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
                                <p className="text-gray-500 dark:text-gray-400 max-w-xs leading-relaxed text-sm">
                                    {t('scan_desc')}
                                </p>
                            </div>
                        )}
                    </div>
                )}

                {/* Scanned Result (Full Width Split Layout) */}
                {scanResult && (
                    <div className="w-full">
                        {scanResult.status === 'success' ? (
                            (() => {
                                const rawRewards = Array.isArray(scanResult.availableRewards) ? scanResult.availableRewards : [];
                                // Expert Logic: Sort by "Value Score" (Percentage is usually better than fixed amount of same value)
                                const rewardsArray = [...rawRewards].sort((a, b) => {
                                    const valA = a.type === 'percentage' ? a.value * 10 : a.value;
                                    const valB = b.type === 'percentage' ? b.value * 10 : b.value;
                                    return valB - valA;
                                });
                                return (
                                    <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] shadow-2xl border border-green-100 dark:border-green-900/10 overflow-hidden animate-in slide-in-from-bottom-8 duration-500">
                                        <div className={`bg-green-500/10 p-5 border-b border-green-100 dark:border-green-900/50 flex items-center justify-between px-8`}>
                                            <div className="flex items-center gap-4">
                                                <div className="h-8 w-8 rounded-lg bg-green-500 text-white flex items-center justify-center shadow-lg shadow-green-200 dark:shadow-none">
                                                    <CheckCircle2 size={18} />
                                                </div>
                                                <div>
                                                    <h3 className="text-base font-black text-gray-900 dark:text-white lowercase tracking-tight leading-none">Verified Member</h3>
                                                    <p className="text-[10px] font-bold text-green-600 dark:text-green-400 uppercase tracking-widest mt-1">{t('connected')}</p>
                                                </div>
                                            </div>
                                            <button onClick={() => setScanResult(null)} className="p-2 hover:bg-white/50 rounded-full transition-colors text-gray-400 hover:text-red-500"><XCircle size={24} /></button>
                                        </div>

                                        <div className="p-8 flex flex-col lg:flex-row gap-8">
                                            {/* Left Side: Identity & Wallet */}
                                            <div className="flex-[0.7] space-y-6">
                                                <div className="flex items-center gap-6">
                                                    <div className="h-20 w-20 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-xl shadow-blue-200 dark:shadow-none ring-4 ring-blue-50 dark:ring-blue-900/20">
                                                        <User size={40} />
                                                    </div>
                                                    <div className={dir === 'rtl' ? 'text-right' : 'text-left'}>
                                                        <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1 block">{t('customer_name')}</label>
                                                        <p className="text-3xl font-black text-gray-900 dark:text-white tracking-tighter leading-none mb-2">{scanResult.customer.full_name}</p>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[9px] font-bold text-gray-400 bg-gray-50 dark:bg-gray-900 px-2.5 py-1 rounded-full border border-gray-100 dark:border-gray-800">Card ID: {scanResult.card.uid}</span>
                                                            <span className="text-[9px] font-bold text-green-600 bg-green-50 dark:bg-green-900/20 px-2.5 py-1 rounded-full border border-green-100 dark:border-green-900/30">Active Status</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-3xl border border-gray-100 dark:border-gray-800 relative overflow-hidden group">
                                                        <div className="absolute -right-2 -top-2 text-blue-500/5 group-hover:scale-110 transition-transform duration-500"><Zap size={80} /></div>
                                                        <label className="text-[8px] font-bold text-gray-400 uppercase tracking-widest mb-1 block">{t('customer_points')}</label>
                                                        <div className="flex items-baseline gap-2">
                                                            <p className="text-3xl font-black text-blue-600 dark:text-blue-400 tracking-tighter leading-none">{scanResult.customer.points_balance}</p>
                                                            <span className="text-[8px] font-bold text-blue-400 uppercase tracking-widest">pts</span>
                                                        </div>
                                                    </div>
                                                    <div className="bg-gradient-to-br from-blue-600 to-blue-700 p-4 rounded-3xl text-white shadow-xl shadow-blue-200 dark:shadow-none border-b-2 border-blue-800 relative overflow-hidden group">
                                                        <div className="absolute -right-2 -top-2 text-white/5 group-hover:scale-110 transition-transform duration-500"><Wallet size={80} /></div>
                                                        <label className="text-[8px] font-bold uppercase tracking-widest opacity-70 block mb-1">{t('wallet_balance')}</label>
                                                        <div className="flex items-baseline gap-0.5">
                                                            <span className="text-sm opacity-80 font-bold">{pageSettings.currency_symbol}</span>
                                                            <span className="text-3xl font-black tracking-tighter leading-none">{parseFloat(scanResult.customer.balance || 0).toFixed(2)}</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="bg-gray-50 dark:bg-gray-900/30 p-4 rounded-3xl border-2 border-dashed border-gray-100 dark:border-gray-800">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <h4 className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Quick Insights</h4>
                                                        <span className="text-[10px] font-bold text-blue-600 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-full">{scanResult.customer.points_balance > 500 ? 'Platinum Member' : scanResult.customer.points_balance > 100 ? 'Gold Member' : 'Member'}</span>
                                                    </div>

                                                    {/* Expert Proposal: Immediate Offer Highlight */}
                                                    {rewardsArray.length > 0 && (
                                                        <div className="mb-3 p-2 bg-blue-600/5 rounded-xl border border-blue-100 dark:border-blue-900/20">
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <div className="h-4 w-4 rounded bg-blue-600 text-white flex items-center justify-center"><Zap size={10} /></div>
                                                                <span className="text-[9px] font-black text-blue-600 uppercase tracking-tighter">Best Offer Available</span>
                                                            </div>
                                                            <p className="text-[10px] text-gray-700 dark:text-gray-300 font-bold leading-tight">
                                                                {rewardsArray[0].name} ({rewardsArray[0].type === 'percentage' ? `${rewardsArray[0].value}% OFF` : `-${pageSettings.currency_symbol}${rewardsArray[0].value}`})
                                                            </p>
                                                        </div>
                                                    )}

                                                    <div className="h-1 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                                                        <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min(100, (scanResult.customer.points_balance / 1000) * 100)}%` }}></div>
                                                    </div>
                                                    <p className="text-[8px] text-gray-400 mt-2 italic flex items-center gap-1">
                                                        <CheckCircle2 size={10} /> {t('scan_desc').split('.')[0]}
                                                    </p>
                                                </div>

                                                {/* Recent Customer History */}
                                                <div className="bg-white dark:bg-gray-800/50 rounded-3xl border border-gray-100 dark:border-gray-700 p-4">
                                                    <div className="flex items-center justify-between mb-3">
                                                        <h4 className="text-[9px] font-black text-gray-900 dark:text-white uppercase tracking-widest">{t('nav_transactions')}</h4>
                                                    </div>
                                                    <div className="space-y-2">
                                                        {scanResult.recentTransactions && scanResult.recentTransactions.length > 0 ? (
                                                            scanResult.recentTransactions.map(tx => (
                                                                <div key={tx.id} className="flex items-center justify-between py-2 border-b border-gray-50 dark:border-gray-800 last:border-0">
                                                                    <div>
                                                                        <p className="text-[10px] font-bold text-gray-800 dark:text-white leading-none mb-1">
                                                                            {tx.discounts?.name || 'Standard Purchase'}
                                                                        </p>
                                                                        <p className="text-[8px] text-gray-400 uppercase font-bold tracking-tighter">
                                                                            {new Date(tx.created_at).toLocaleDateString()}
                                                                        </p>
                                                                    </div>
                                                                    <div className="text-right">
                                                                        <p className="text-[10px] font-black text-gray-900 dark:text-white leading-none mb-1">
                                                                            {pageSettings.currency_symbol}{tx.amount_after}
                                                                        </p>
                                                                        <p className="text-[8px] text-blue-600 font-bold">
                                                                            +{tx.points_earned} PTS
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                            ))
                                                        ) : (
                                                            <p className="text-[9px] text-gray-400 italic py-2 text-center">{t('no_data')}</p>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Divider Line */}
                                            <div className="hidden lg:block w-px bg-gray-100 dark:bg-gray-800" />

                                            {/* Right Side: Form & Actions */}
                                            <div className="flex-1 bg-white dark:bg-gray-800/50">
                                                <div className="mb-8">
                                                    <h3 className="text-xl font-black text-gray-900 dark:text-white tracking-tight leading-none mb-2">New Transaction</h3>
                                                    <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Choose amount and rewards</p>
                                                </div>
                                                <CheckoutForm
                                                    customer={scanResult.customer}
                                                    card={scanResult.card}
                                                    rewards={scanResult.availableRewards}
                                                    currency={pageSettings.currency_symbol}
                                                    onComplete={() => setScanResult(null)}
                                                    onUpdate={(updatedData) => {
                                                        setScanResult(prev => ({
                                                            ...prev,
                                                            customer: {
                                                                ...prev.customer,
                                                                ...updatedData
                                                            }
                                                        }));
                                                    }}
                                                    selectedRewardId={selectedRewardId}
                                                    setSelectedRewardId={setSelectedRewardId}
                                                    manualDiscount={manualDiscount}
                                                    setManualDiscount={setManualDiscount}
                                                    manualType={manualType}
                                                    setManualType={setManualType}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()) : (
                            <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] shadow-sm border border-red-100 dark:border-red-900/50 p-16 text-center animate-shake">
                                <div className="mx-auto h-24 w-24 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center text-red-500 mb-8 border-4 border-red-100">
                                    <XCircle size={56} />
                                </div>
                                <h3 className="text-4xl font-black text-gray-900 dark:text-white mb-4 tracking-tighter">
                                    {scanResult.status === 'unknown_card' ? 'Unregistered Link' : scanResult.message}
                                </h3>
                                <p className="text-gray-500 mb-10 font-mono text-lg bg-gray-50 dark:bg-gray-900 py-3 px-6 rounded-2xl border dark:border-gray-700 tracking-widest inline-block">
                                    UID: {scanResult.uid}
                                </p>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-lg mx-auto">
                                    {scanResult.status === 'unknown_card' && (
                                        <button
                                            onClick={() => router.push(`/dashboard/customers?uid=${scanResult.uid}`)}
                                            className="flex items-center justify-center gap-3 bg-blue-600 text-white px-8 py-5 rounded-3xl hover:bg-blue-700 transition font-black text-xl shadow-2xl shadow-blue-200 dark:shadow-none"
                                        >
                                            <UserPlus size={24} />
                                            {t('register_customer')}
                                        </button>
                                    )}

                                    <button onClick={() => setScanResult(null)} className="flex items-center justify-center bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 px-8 py-5 rounded-3xl hover:bg-gray-200 transition font-black text-xl uppercase tracking-widest">
                                        {t('cancel')}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

function CheckoutForm({ customer, card, rewards, currency, onComplete, onUpdate, selectedRewardId, setSelectedRewardId, manualDiscount, setManualDiscount, manualType, setManualType }) {
    const { t, dir } = useLanguage();
    const [amount, setAmount] = useState('');
    const [loading, setLoading] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState('CASH');
    const [isRecharge, setIsRecharge] = useState(false);

    const rewardsArray = Array.isArray(rewards) ? rewards : [];

    // Expert Logic: Auto-select the best available reward upon mount (Square/Clover style)
    useEffect(() => {
        if (rewardsArray.length > 0 && !selectedRewardId) {
            // Filter to only unlocked rewards the customer can afford
            const unlockedRewards = rewardsArray.filter(r => (customer.points_balance || 0) >= (r.points_required || 0));

            // Sort by value (assuming percentage for simplicity, or just pick first)
            const bestReward = [...unlockedRewards].sort((a, b) => b.value - a.value)[0];
            if (bestReward) {
                setSelectedRewardId(bestReward.id.toString());
                toast.info(`Smart Apply: ${bestReward.name}`, {
                    description: 'The best available reward has been pre-selected.',
                    icon: <Zap size={16} className="text-blue-500" />
                });
            }
        }
    }, [rewardsArray, customer.points_balance]);

    const selectedReward = rewardsArray.find(r => r.id.toString() === selectedRewardId);

    const finalAmount = () => {
        let amt = parseFloat(amount) || 0;

        // Apply Predefined Reward first (Expert Rule: Chain loyalty rewards)
        if (selectedReward) {
            if (selectedReward.type === 'percentage') amt = amt - (amt * (selectedReward.value / 100));
            else if (selectedReward.type === 'fixed_amount') amt = amt - selectedReward.value;
        }

        // Apply Manual Discount (Expert Rule: Agents apply adjustment on subtotal after loyalty)
        const manVal = parseFloat(manualDiscount) || 0;
        if (manualType === 'percentage') amt = amt - (amt * (manVal / 100));
        else amt = amt - manVal;

        return Math.max(0, amt);
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
                    manual_discount: parseFloat(manualDiscount) || 0,
                    manual_discount_type: manualType,
                    amount: parseFloat(amount),
                    payment_method: paymentMethod,
                    is_topup: isRecharge
                })
            });
            const data = await res.json();
            if (res.ok) {
                if (isRecharge) {
                    toast.success(t('topup_success'));
                } else {
                    toast.success(`Success: ${currency}${data.amount_after} | +${data.points_earned} pts`);
                }

                if (data.updated_customer && onUpdate) {
                    // Persistence Rule: Update customer data but keep the UI open
                    onUpdate(data.updated_customer);
                } else if (!isRecharge) {
                    onComplete();
                }

                // Clear inputs but keep settings
                setAmount('');
                if (!isRecharge) {
                    setSelectedRewardId('');
                    setManualDiscount('');
                }
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
        <div className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Amount Input */}
                <div className={`relative`}>
                    <div className={`absolute -top-2 ${dir === 'rtl' ? 'right-3' : 'left-3'} bg-white dark:bg-gray-800 px-2 text-[8px] font-bold text-blue-600 uppercase tracking-widest z-10`}>{t('invoice_val')}</div>
                    <div className={`flex items-center justify-end w-full bg-gray-50 dark:bg-gray-900 border-2 border-gray-100 dark:border-gray-700 rounded-xl px-4 py-2 h-16 focus-within:border-blue-500 transition-all ${dir === 'rtl' ? 'flex-row' : 'flex-row-reverse'}`}>
                        <input
                            type="number"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder="0.00"
                            className="w-full bg-transparent text-end text-3xl font-black font-mono tracking-tighter text-gray-900 dark:text-white outline-none placeholder:text-gray-200"
                        />
                        <span className="text-sm text-gray-400 ms-2 font-black">{currency}</span>
                    </div>
                </div>

                {/* Checkout/Recharge Toggle */}
                <div className="flex bg-gray-100 dark:bg-gray-900 p-1 rounded-xl h-16">
                    <button
                        onClick={() => { setIsRecharge(false); setPaymentMethod('CASH'); }}
                        className={`flex-1 flex items-center justify-center gap-2 rounded-lg text-xs font-bold transition-all ${!isRecharge ? 'bg-white dark:bg-gray-800 shadow-sm text-blue-600' : 'text-gray-400'}`}
                    >
                        <Receipt size={14} />
                        {t('checkout')}
                    </button>
                    <button
                        onClick={() => { setIsRecharge(true); setPaymentMethod('CASH'); }}
                        className={`flex-1 flex items-center justify-center gap-2 rounded-lg text-xs font-bold transition-all ${isRecharge ? 'bg-white dark:bg-gray-800 shadow-sm text-blue-600' : 'text-gray-400'}`}
                    >
                        <ArrowUpCircle size={14} />
                        {t('recharge')}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Manual Discount & Quick Adds */}
                <div className="space-y-3">
                    {/* Manual Discount Field (Expert Proposal: Ad-hoc adjustment) */}
                    {!isRecharge && (
                        <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded-xl border border-gray-100 dark:border-gray-800">
                            <label className="text-[8px] font-black text-gray-400 uppercase tracking-widest block mb-2">Agent Override / Manual Discount</label>
                            <div className="flex items-center gap-2">
                                <div className="flex-1 relative">
                                    <input
                                        type="number"
                                        value={manualDiscount}
                                        onChange={(e) => setManualDiscount(e.target.value)}
                                        placeholder="Add discount..."
                                        className="w-full bg-white dark:bg-gray-800 border-none px-3 py-1.5 rounded-lg text-xs font-bold outline-none ring-1 ring-gray-100 dark:ring-gray-700 focus:ring-blue-500"
                                    />
                                </div>
                                <div className="flex bg-white dark:bg-gray-800 rounded-lg p-0.5 ring-1 ring-gray-100 dark:ring-gray-700">
                                    <button onClick={() => setManualType('percentage')} className={`px-2 py-1 rounded-md text-[9px] font-bold ${manualType === 'percentage' ? 'bg-blue-600 text-white' : 'text-gray-400'}`}>%</button>
                                    <button onClick={() => setManualType('fixed')} className={`px-2 py-1 rounded-md text-[9px] font-bold ${manualType === 'fixed' ? 'bg-blue-600 text-white' : 'text-gray-400'}`}>{currency}</button>
                                </div>
                            </div>
                            {/* Quick Percentages (Expert POS Tip) */}
                            {manualType === 'percentage' && (
                                <div className="flex gap-1 mt-2">
                                    {[5, 10, 15, 20].map(p => (
                                        <button
                                            key={p}
                                            onClick={() => setManualDiscount(p.toString())}
                                            className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 px-2 py-0.5 rounded text-[8px] font-bold hover:bg-blue-50 transition-colors"
                                        >
                                            {p}%
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    <div className="grid grid-cols-4 gap-2">
                        {[10, 20, 50, 100].map(amt => (
                            <button key={amt} onClick={() => setAmount(prev => (parseFloat(prev || 0) + amt).toString())} className="bg-gray-50 dark:bg-gray-900 hover:bg-white hover:shadow-md py-2 rounded-xl text-[10px] font-black transition-all border border-gray-100 dark:border-gray-800">+{amt}</button>
                        ))}
                    </div>

                    {!isRecharge && (
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                onClick={() => setPaymentMethod('CASH')}
                                className={`flex items-center gap-2 p-2 rounded-xl border-2 transition-all ${paymentMethod === 'CASH' ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-900/20' : 'border-gray-50 dark:border-gray-800'}`}
                            >
                                <div className={`p-1.5 rounded-lg ${paymentMethod === 'CASH' ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-400'}`}>
                                    <CreditCard size={14} />
                                </div>
                                <span className={`text-[10px] font-bold ${paymentMethod === 'CASH' ? 'text-blue-600' : 'text-gray-400'}`}>{t('cash')}</span>
                            </button>
                            <button
                                onClick={() => setPaymentMethod('WALLET')}
                                className={`flex items-center gap-2 p-2 rounded-xl border-2 transition-all ${paymentMethod === 'WALLET' ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-900/20' : 'border-gray-50 dark:border-gray-800'}`}
                            >
                                <div className={`p-1.5 rounded-lg ${paymentMethod === 'WALLET' ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-400'}`}>
                                    <Wallet size={14} />
                                </div>
                                <span className={`text-[10px] font-bold ${paymentMethod === 'WALLET' ? 'text-blue-600' : 'text-gray-400'}`}>{t('wallet')}</span>
                            </button>
                        </div>
                    )}
                </div>

                {/* Rewards Table */}
                {!isRecharge && (
                    <div className="bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 overflow-hidden h-[120px] overflow-y-auto scrollbar-hide">
                        <table className="w-full text-[10px] text-start">
                            <thead className="bg-gray-100 dark:bg-gray-800 text-gray-400 uppercase font-black sticky top-0 z-10">
                                <tr>
                                    <th className="px-3 py-1.5 text-start">{t('discount_name')}</th>
                                    <th className="px-3 py-1.5 text-center">{t('actions')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                {rewardsArray.length === 0 ? (
                                    <tr>
                                        <td colSpan="2" className="px-3 py-4 text-center text-gray-400 italic">{t('no_data')}</td>
                                    </tr>
                                ) : (
                                    rewardsArray.map(reward => {
                                        const isLocked = (customer.points_balance || 0) < (reward.points_required || 0);
                                        const pointsNeeded = (reward.points_required || 0) - (customer.points_balance || 0);

                                        return (
                                            <tr key={reward.id} className={`hover:bg-white dark:hover:bg-gray-800 transition-colors ${selectedRewardId === reward.id.toString() ? 'bg-blue-50/50' : ''} ${isLocked ? 'opacity-60 cursor-not-allowed grayscale-[0.5]' : ''}`}>
                                                <td className="px-3 py-2 font-bold text-gray-700 dark:text-gray-300">
                                                    <div className="flex items-center gap-2">
                                                        <div className={`h-2 w-2 rounded-full ${selectedRewardId === reward.id.toString() ? 'bg-blue-600 animate-pulse' : (isLocked ? 'bg-gray-400' : 'bg-gray-200')}`} />
                                                        <div className="flex flex-col">
                                                            <div className="flex items-center gap-1">
                                                                <span>{reward.name}</span>
                                                                {isLocked && <span className="text-[7px] bg-red-100/50 dark:bg-red-900/20 text-red-600 px-1 rounded flex items-center gap-0.5"><Settings size={8} /> Locked</span>}
                                                            </div>
                                                            <span className="text-[7px] text-green-600 font-black uppercase tracking-widest border-b border-dashed border-green-200 w-fit">
                                                                -{reward.type === 'percentage' ? `${reward.value}%` : `${currency}${reward.value}`} {isLocked ? `(Unlock at ${reward.points_required} pts)` : 'Instant Coupon'}
                                                            </span>
                                                            {isLocked && (
                                                                <div className="mt-1 w-20 h-0.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                                                    <div
                                                                        className="h-full bg-red-400"
                                                                        style={{ width: `${Math.min(100, (customer.points_balance / reward.points_required) * 100)}%` }}
                                                                    />
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-3 py-2 text-center">
                                                    {isLocked ? (
                                                        <div className="flex flex-col items-center">
                                                            <span className="text-[7px] text-red-500 font-black">+{pointsNeeded} PTS</span>
                                                            <span className="text-[6px] text-gray-400 uppercase">Needed</span>
                                                        </div>
                                                    ) : (
                                                        <button
                                                            onClick={() => setSelectedRewardId(selectedRewardId === reward.id.toString() ? '' : reward.id.toString())}
                                                            className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase transition-all ${selectedRewardId === reward.id.toString()
                                                                ? 'bg-blue-600 text-white shadow-md shadow-blue-100 ring-2 ring-blue-100'
                                                                : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}
                                                        >
                                                            {selectedRewardId === reward.id.toString() ? t('cancel') : 'Apply'}
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Compact Action Bar (Expert Proposal: Savings Visualization) */}
            <div className={`pt-4 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between gap-4`}>
                <div className="flex flex-col">
                    <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest leading-none mb-1">{isRecharge ? t('amount') : 'Total Due'}</span>
                    <div className="flex items-baseline gap-2">
                        {/* Strikethrough for Savings transparency (Odoo Inspired) */}
                        {!isRecharge && (selectedReward || manualDiscount) && parseFloat(amount) > 0 && (
                            <span className="text-xs text-gray-300 line-through font-bold">{currency}{parseFloat(amount).toFixed(2)}</span>
                        )}
                        <span className="text-sm font-bold text-gray-400">{currency}</span>
                        <span className="text-3xl font-black text-gray-900 dark:text-white tracking-tighter leading-none">{isRecharge ? amount || '0.00' : finalAmount().toFixed(2)}</span>
                    </div>
                    {/* Visual Savings Badge */}
                    {!isRecharge && (parseFloat(amount) - finalAmount() > 0) && (
                        <span className="text-[9px] font-black text-green-600 bg-green-50 px-2 py-0.5 rounded-full mt-1 w-fit border border-green-100 animate-bounce-subtle">
                            You Saved {currency}{(parseFloat(amount) - finalAmount()).toFixed(2)}!
                        </span>
                    )}
                </div>
                <button
                    onClick={handleCheckout}
                    disabled={loading || !amount}
                    className={`flex-1 h-16 text-white rounded-xl font-black text-lg disabled:opacity-50 transition-all shadow-xl active:scale-95 flex items-center justify-center gap-2 ${isRecharge ? 'bg-green-600 hover:bg-green-700 shadow-green-100' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-100'} dark:shadow-none`}
                >
                    {loading ? <Loader2 className="animate-spin size={20}" /> : (isRecharge ? <ArrowUpCircle size={22} /> : <Receipt size={22} />)}
                    {isRecharge ? t('recharge') : t('checkout')}
                </button>
            </div>
        </div>
    );
}
