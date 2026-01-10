'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { CreditCard, Wifi, WifiOff, Loader2, User, CheckCircle2, XCircle, Settings, Save, Delete, UserPlus, Zap, Receipt, Wallet, ArrowUpCircle, Gift, Percent, Store, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useLanguage } from '@/lib/LanguageContext';

export default function ScanPage() {
    const { t, dir, language } = useLanguage();
    const [selectedRewardId, setSelectedRewardId] = useState('');
    const [manualDiscount, setManualDiscount] = useState('');
    const [manualType, setManualType] = useState('percentage'); // 'percentage' or 'fixed'
    const [status, setStatus] = useState('disconnected');
    const [scanResult, setScanResult] = useState(null);
    const [showSettings, setShowSettings] = useState(false);
    const [showDangerZone, setShowDangerZone] = useState(false);
    const [pageSettings, setPageSettings] = useState({ currency_symbol: '$' });

    const [branches, setBranches] = useState([]);
    const [terminals, setTerminals] = useState([]);
    const [selectedBranch, setSelectedBranch] = useState('');
    const [selectedTerminal, setSelectedTerminal] = useState('');
    const [retryKey, setRetryKey] = useState(0);
    const [flashEffect, setFlashEffect] = useState(null); // 'success', 'error', or null
    const [loading, setLoading] = useState(false);
    const currency = pageSettings?.currency_symbol || '$';

    const router = useRouter();
    const isMounted = useRef(true);
    const audioContextRef = useRef(null);

    const processingRef = useRef(false);

    // Initial load: Settings and Branches
    useEffect(() => {
        // Reset lock on mount to prevent stale states
        console.log('[ScanPage] Mounted. Resetting processingRef.');
        processingRef.current = false;

        return () => {
            console.log('[ScanPage] UNMOUNTING (Lifecycle Cleanup)');
        };
    }, []);

    // Initial load: Settings and Branches
    useEffect(() => {
        const checkSession = async () => {
            try {
                const res = await fetch('/api/auth/me');
                if (res.status === 401) {
                    toast.error(t('session_expired') || 'Session expired. Please login again.');
                    router.push('/login');
                }
            } catch (err) {
                console.error('[checkSession] Error:', err);
            }
        };

        checkSession();

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
                    console.log('[Realtime] Scan event received:', payload);
                    const uid = payload.new ? payload.new.uid : null;
                    const eventId = payload.new ? payload.new.id : 'unknown';

                    if (uid && isMounted.current) {
                        console.log(`[Realtime] Processing UID: ${uid} (Event ID: ${eventId})`);

                        // Check if we are already busy
                        if (processingRef.current) {
                            console.warn('[Realtime] IGNORED: Already busy processing another scan.');
                            return;
                        }

                        // Process immediately
                        processScan(uid);

                        // Update processed status in background
                        supabase
                            .from('scan_events')
                            .update({ processed: true })
                            .eq('id', eventId)
                            .then(({ error }) => {
                                if (error) console.error('[Realtime] Failed to mark as processed:', error);
                                else console.log(`[Realtime] Marked Event ${eventId} as processed.`);
                            });
                    } else {
                        console.error('[Realtime] ERROR: Event payload missing UID or component unmounted.', {
                            hasUid: !!uid,
                            isMounted: isMounted.current
                        });
                    }
                }
            )
            .subscribe((status) => {
                console.log(`[Realtime] Subscription status for Terminal ${selectedTerminal}:`, status);
                if (status === 'SUBSCRIBED') {
                    setStatus('connected');
                    console.log('[Realtime] Successfully subscribed to changes.');
                } else if (status === 'CLOSED') {
                    setStatus('disconnected');
                    console.log('[Realtime] Subscription closed.');
                } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                    setStatus('error');
                    console.error(`[Realtime] Subscription Error (${status})`);
                    toast.error(`${t('connection_error') || 'Connection Error'}: ${status}`);
                } else {
                    setStatus('disconnected');
                    console.warn(`[Realtime] Unexpected status: ${status}`);
                }
            });

        return () => {
            console.log(`[Realtime] Cleaning up subscription for Terminal ${selectedTerminal}`);
            isMounted.current = false;
            channel.unsubscribe();
            supabase.removeChannel(channel);
        };
    }, [selectedTerminal, retryKey]);

    // Polling Fallback (Backup for WebSocket)
    useEffect(() => {
        if (!selectedTerminal) return;

        const pollInterval = setInterval(async () => {
            // Only poll if we are not already processing something
            if (status === 'processing' || processingRef.current) return;

            try {
                // Fetch the latest unprocessed scan event for this terminal
                const { data, error } = await supabase
                    .from('scan_events')
                    .select('id, uid')
                    .eq('terminal_id', selectedTerminal)
                    .eq('processed', false)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                if (data && data.uid && isMounted.current) {
                    console.log('[Polling] Detected unprocessed event:', data);

                    // Double check busy state before proceeding
                    if (processingRef.current) return;

                    // Mark as processed immediately to prevent duplicate processing
                    await supabase
                        .from('scan_events')
                        .update({ processed: true })
                        .eq('id', data.id);

                    processScan(data.uid);
                }
            } catch (err) {
                console.error('[Polling] Error:', err);
            }
        }, 5000); // Poll every 5 seconds

        return () => clearInterval(pollInterval);
    }, [selectedTerminal, status]);

    // Keyboard Shortcuts (Enter to confirm, Escape to cancel)
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Enter' && scanResult && !loading) {
                if (status === 'connected') {
                    // Logic for quick confirm using Enter
                    // 1. Check if there's a payment button for wallet
                    const walletBtn = document.querySelector('[data-type="wallet-pay"]');
                    if (walletBtn && !walletBtn.disabled) {
                        walletBtn.click();
                    }
                }
            }
            if (e.key === 'Escape') {
                resetScan();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [scanResult, loading, status]);

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
            } else if (type === 'recharge') {
                oscillator.type = 'triangle';
                oscillator.frequency.setValueAtTime(400, ctx.currentTime);
                oscillator.frequency.linearRampToValueAtTime(1000, ctx.currentTime + 0.05);
                oscillator.frequency.linearRampToValueAtTime(800, ctx.currentTime + 0.1);
                oscillator.frequency.linearRampToValueAtTime(1200, ctx.currentTime + 0.15);
                gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
                oscillator.start();
                oscillator.stop(ctx.currentTime + 0.5);
            }
        } catch (e) {
            console.error('Audio play failed', e);
        }
    };

    const processScan = async (uid) => {
        console.log(`[processScan] START for UID: ${uid}`);

        // Prevent concurrent processing
        if (processingRef.current) {
            console.warn('[processScan] ABORT: Already busy.');
            return;
        }

        processingRef.current = true;
        setStatus('processing');
        setScanResult(null);
        toast.dismiss();
        toast.info(t('processing'));

        try {
            console.log(`[processScan] Fetching /api/scan for ${uid}...`);
            const res = await fetch('/api/scan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ uid }),
            });

            console.log(`[processScan] API Response Status: ${res.status}`);

            if (res.status === 401) {
                toast.error(t('session_expired') || 'Session expired');
                router.push('/login');
                return;
            }

            const data = await res.json();
            console.log('[processScan] API Data received:', data);

            setScanResult(data);

            if (data.status === 'success') {
                toast.success(`${t('connected')}: ${data.customer.full_name}`);
                playSound('success');
                setFlashEffect('success');
            } else {
                console.warn('[processScan] Scan result error status:', data.status);
                playSound('error');
                setFlashEffect('error');
            }

            // Auto-clear flash
            setTimeout(() => setFlashEffect(null), 1000);
        } catch (err) {
            console.error('[processScan] FATAL ERROR:', err);
            toast.error(t('network_error'));
            playSound('error');
            setFlashEffect('error');
            setTimeout(() => setFlashEffect(null), 1000);

            // Release lock on error since no result modal is shown
            processingRef.current = false;
        } finally {
            console.log('[processScan] FINISHED. Status reset to connected.');
            setStatus('connected');
        }
    };

    const handleReset = async (type) => {
        const msg = type === 'BALANCE' ? t('confirm_reset_balance') :
            type === 'COUPONS' ? t('confirm_clear_packages') :
                t('reset_confirm_title');

        if (!confirm(msg)) return;

        setLoading(true);
        try {
            const res = await fetch(`/api/customers/${scanResult.customer.id}/reset`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type })
            });
            const data = await res.json();
            if (res.ok) {
                toast.success(t('reset_success'));
                refreshData();
                setShowDangerZone(false);
            } else {
                toast.error(data.message || t('reset_failed'));
            }
        } catch (err) {
            toast.error(t('network_error'));
        } finally {
            setLoading(false);
        }
    };

    const resetScan = () => {
        setScanResult(null);
        setAmount('');
        setShowDangerZone(false);
        processingRef.current = false;
    };

    const refreshData = async () => {
        if (scanResult?.card?.uid) {
            processingRef.current = true;
            try {
                const res = await fetch('/api/scan', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        uid: scanResult.card.uid,
                        refresh: true,
                        _t: Date.now() // Cache busting
                    }),
                });
                const data = await res.json();
                if (data.status === 'success') {
                    console.log("[refreshData] Success. Coupons count:", data.coupons?.length);
                    setScanResult(data);
                }
            } catch (err) {
                console.error("[refreshData] Error:", err);
            } finally {
                processingRef.current = false;
            }
        }
    };

    return (
        <div className="h-[calc(100vh-120px)] max-w-7xl mx-auto relative antialiased flex flex-col" suppressHydrationWarning>
            {/* Full-screen Flash Overlay */}
            {flashEffect && (
                <div className={`fixed inset-0 z-[9999] pointer-events-none transition-opacity duration-300 ${flashEffect === 'success' ? 'bg-emerald-500/20' : 'bg-red-500/20'} animate-pulse`} />
            )}

            {/* Compact Header */}
            <div className="flex items-center justify-between mb-4 flex-shrink-0">
                <div className="flex gap-3">
                    <button
                        onClick={() => setShowSettings(!showSettings)}
                        aria-label={t('reader_settings')}
                        aria-expanded={showSettings}
                        className="p-2.5 bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl text-slate-400 hover:text-blue-400 hover:border-blue-500/50 transition-all min-w-[44px] min-h-[44px] flex items-center justify-center"
                    >
                        <Settings size={18} />
                    </button>

                    <div
                        className={`flex items-center gap-2 px-4 py-2 rounded-full border backdrop-blur-sm transition-all ${status === 'connected' || status === 'processing'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            : status === 'error'
                                ? 'bg-red-500/10 text-red-400 border-red-500/30 animate-pulse'
                                : 'bg-slate-800/50 text-slate-400 border-slate-700/50'
                            }`}
                        role="status"
                        aria-live="polite"
                    >
                        {status === 'connected' || status === 'processing' ? <Zap size={16} className="fill-current" aria-hidden="true" /> : <WifiOff size={16} aria-hidden="true" />}
                        <span className="text-xs font-bold uppercase tracking-wider">
                            {status === 'connected' || status === 'processing' ? t('connected') : status === 'error' ? (t('connection_error') || 'خطأ') : t('disconnected')}
                        </span>
                    </div>

                    {status === 'error' && (
                        <button
                            onClick={() => setRetryKey(k => k + 1)}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-all text-[11px] font-black uppercase tracking-tighter"
                        >
                            <ArrowUpCircle className="w-3.5 h-3.5" />
                            {t('reconnect') || 'إعادة اتصال'}
                        </button>
                    )}
                </div>
            </div>

            {/* Connection Settings */}
            {showSettings && (
                <div className="absolute top-14 start-0 z-50 w-80 bg-slate-800/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-700/50 p-5 animate-in slide-in-from-top-2 duration-200" role="dialog" aria-label={t('reader_settings')}>
                    <h3 className="font-bold text-white mb-4">{t('reader_settings')}</h3>
                    <div className="space-y-3">
                        <div>
                            <label htmlFor="branch-select" className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">{t('terminal_branch')}</label>
                            <select
                                id="branch-select"
                                value={selectedBranch}
                                onChange={(e) => {
                                    setSelectedBranch(e.target.value);
                                    setSelectedTerminal('');
                                }}
                                className="w-full px-3 py-2 text-sm border-none bg-slate-900/80 rounded-xl text-white outline-none focus:ring-2 focus:ring-blue-500/50 transition-all min-h-[44px]"
                                aria-label={t('terminal_branch')}
                            >
                                <option value="">{t('tabs_branches')}...</option>
                                {branches.map(b => (
                                    <option key={b.id} value={b.id}>{b.name}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label htmlFor="terminal-select" className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">{t('tabs_terminals')}</label>
                            <select
                                id="terminal-select"
                                value={selectedTerminal}
                                onChange={(e) => handleTerminalSelect(e.target.value)}
                                disabled={!selectedBranch}
                                className="w-full px-3 py-2 text-sm border-none bg-slate-900/80 rounded-xl text-white outline-none focus:ring-2 focus:ring-blue-500/50 transition-all disabled:opacity-50 min-h-[44px]"
                                aria-label={t('tabs_terminals')}
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

            {/* Main Content Area - Fixed Height */}
            <div className="flex-1 flex flex-col min-h-0">
                {/* Waiting State */}
                {!scanResult && (
                    <div className={`h-full bg-gradient-to-br from-slate-900/50 to-slate-800/30 backdrop-blur-sm rounded-3xl border flex flex-col items-center justify-center text-center transition-all ${status === 'error' ? 'border-red-500/30 bg-red-900/10' : 'border-slate-700/50'
                        }`}>
                        {status === 'processing' ? (
                            <div className="flex flex-col items-center">
                                <div className="h-24 w-24 rounded-full bg-blue-500/10 backdrop-blur-sm flex items-center justify-center mb-6 border border-blue-500/30">
                                    <Loader2 className="animate-spin text-blue-400" size={48} />
                                </div>
                                <h3 className="text-xl font-bold text-white">{t('processing')}</h3>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center">
                                <div className={`h-24 w-24 rounded-full flex items-center justify-center mb-6 transition-all ${status === 'connected'
                                    ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30 animate-pulse animate-scan-glow'
                                    : 'bg-slate-800/50 text-slate-500 border border-slate-700/50'
                                    }`}>
                                    <CreditCard size={48} />
                                </div>
                                <h3 className="text-xl font-bold text-white mb-3">
                                    {t('waiting_card')}
                                </h3>
                                <p className="text-slate-400 max-w-xs text-sm">
                                    {t('scan_desc')}
                                </p>
                            </div>
                        )}
                    </div>
                )}

                {/* Scanned Result - Optimized Layout */}
                {scanResult && (
                    <div className="h-full flex flex-col items-center justify-center min-h-0 p-4">
                        {scanResult.status === 'success' ? (
                            <div className="w-full max-w-5xl h-auto max-h-[65vh] bg-gradient-to-br from-white to-gray-50 dark:from-black/90 dark:to-slate-900/95 backdrop-blur-sm rounded-3xl border border-gray-200 dark:border-slate-600/50 overflow-hidden flex flex-col shadow-2xl transition-all">

                                {/* Compact Header */}
                                <div className="p-4 border-b border-gray-200 dark:border-slate-600/50 flex items-center justify-between bg-gray-50/50 dark:bg-black/40 backdrop-blur-sm flex-shrink-0">
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/20">
                                            <User size={20} />
                                        </div>
                                        <div className="flex flex-col">
                                            <div className="flex items-center gap-3 mb-1">
                                                <h3 className="text-lg font-bold text-gray-900 dark:text-white leading-none">{scanResult.customer.full_name}</h3>
                                                <button
                                                    onClick={() => setShowDangerZone(!showDangerZone)}
                                                    className={`p-1 rounded-lg transition-colors ${showDangerZone ? 'bg-red-500/10 text-red-500' : 'text-slate-400 hover:text-red-500 hover:bg-red-500/5'}`}
                                                    title={t('admin_controls')}
                                                >
                                                    <Zap size={14} className={showDangerZone ? 'fill-current' : ''} />
                                                </button>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className="flex items-center gap-2 px-3 py-1 bg-white dark:bg-slate-900/50 rounded-xl border-2 border-slate-200 dark:border-slate-700/50 shadow-sm group-hover:border-blue-500/30 transition-all">
                                                    <CreditCard size={12} className="text-blue-500/70" />
                                                    <span className="text-xs font-black text-slate-700 dark:text-blue-400 uppercase tracking-[0.1em] font-mono">{scanResult.card.uid}</span>
                                                </div>
                                                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl border border-emerald-500/20 shadow-sm">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                                    <span className="text-[10px] font-black uppercase tracking-wider">{t('active_status')}</span>
                                                </div>
                                                {showDangerZone && (
                                                    <div className="flex items-center gap-1 ml-2 animate-in fade-in slide-in-from-left-2">
                                                        <button
                                                            onClick={() => handleReset('BALANCE')}
                                                            className="px-2 py-1 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white text-[9px] font-black rounded-lg border border-red-500/20 transition-all uppercase"
                                                        >
                                                            {t('admin_reset_balance')}
                                                        </button>
                                                        <button
                                                            onClick={() => handleReset('COUPONS')}
                                                            className="px-2 py-1 bg-orange-500/10 hover:bg-orange-500 text-orange-500 hover:text-white text-[9px] font-black rounded-lg border border-orange-500/20 transition-all uppercase"
                                                        >
                                                            {t('admin_clear_packages')}
                                                        </button>
                                                    </div>
                                                )}
                                                {/* Removed Total Savings Pill as requested */}
                                            </div>
                                        </div>
                                    </div>
                                    <button onClick={resetScan} className="p-2 hover:bg-gray-200 dark:hover:bg-slate-700/50 rounded-xl transition-colors text-gray-500 dark:text-slate-400 hover:text-red-500 dark:hover:text-red-400">
                                        <XCircle size={22} />
                                    </button>
                                </div>

                                {/* Content - Scrollable if needed */}
                                <div className="flex-1 p-5 overflow-y-auto min-h-0">
                                    <CheckoutForm
                                        customer={scanResult.customer}
                                        card={scanResult.card}
                                        rewards={scanResult.availableRewards}
                                        coupons={scanResult.coupons}
                                        manualCampaigns={scanResult.manualCampaigns}
                                        campaignProgress={scanResult.campaignProgress}
                                        availableBundles={scanResult.availableBundles}
                                        currency={pageSettings.currency_symbol}
                                        onComplete={resetScan}
                                        onRefresh={refreshData}
                                        onGrantSuccess={(newCoupon) => {
                                            toast.success('Reward Granted!');
                                            refreshData();
                                        }}
                                        playSound={playSound}
                                        setFlashEffect={setFlashEffect}
                                        loading={loading}
                                        setLoading={setLoading}
                                    />
                                </div>
                            </div>
                        ) : (
                            // Error state
                            <div className="h-full bg-gradient-to-br from-red-900/20 to-slate-900/50 backdrop-blur-sm rounded-3xl border border-red-500/30 flex flex-col items-center justify-center text-center p-8">
                                <div className="h-16 w-16 rounded-full flex items-center justify-center mb-4 bg-red-500/10 text-red-400 border border-red-500/30">
                                    <XCircle size={32} />
                                </div>
                                <h3 className="text-xl font-bold text-white mb-2">{scanResult.message}</h3>
                                <button onClick={resetScan} className="mt-4 text-sm font-bold text-slate-400 hover:text-white transition-colors">{t('cancel')}</button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

function CheckoutForm({ customer, card, rewards, coupons, manualCampaigns, campaignProgress, availableBundles, currency, onComplete, onRefresh, playSound, setFlashEffect, loading, setLoading }) {
    const { t, dir, language } = useLanguage();
    const [amount, setAmount] = useState('');
    const [selectedCouponId, setSelectedCouponId] = useState(null);
    const [manualAmount, setManualAmount] = useState('');

    // Top-up / Buy Package Modal
    const [showStore, setShowStore] = useState(false);

    const customerCoupons = Array.isArray(coupons) ? coupons : [];

    // Filter valid coupons (Group by Campaign)
    const groupedCoupons = customerCoupons.reduce((acc, coupon) => {
        const campId = coupon.campaign_id;
        if (!acc[campId]) {
            acc[campId] = { ...coupon, count: 0, allIds: [] };
        }
        acc[campId].count += 1;
        acc[campId].allIds.push(coupon.id);
        return acc;
    }, {});
    const walletItems = Object.values(groupedCoupons);

    // Purchase Package Logic
    const handleBuyPackage = async (bundle) => {
        const confirmMsg = t('purchase_confirm')
            .replace('{name}', bundle.name)
            .replace('{price}', `${currency}${bundle.price}`);

        if (!confirm(confirmMsg)) return;

        setLoading(true);
        try {
            // 1. Create Transaction (Charge)
            const res = await fetch('/api/transactions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    customer_id: customer.id,
                    card_id: card.id,
                    amount: parseFloat(bundle.price),
                    campaign_id: bundle.id, // Explicitly send bundle ID
                    discount_id: null,
                    coupon_id: null,
                    payment_method: 'CASH', // Assuming Cash payment for package
                    is_topup: false
                })
            });

            if (res.ok) {
                const data = await res.json();
                toast.success(t('topup_success') || 'Package Purchased Successfully');
                playSound('recharge'); // Added recharge sound
                setShowStore(false);
                if (onRefresh) onRefresh();
                else onComplete();
            } else {
                toast.error(t('coupon_use_failed') || 'Purchase Failed');
            }
        } catch (e) {
            toast.error(t('network_error'));
        } finally {
            setLoading(false);
        }
    };

    // Direct Cash Top-up Logic
    const handleDirectTopUp = async () => {
        const val = parseFloat(manualAmount);
        if (!val || val <= 0) {
            toast.error(t('error_invalid_amount'));
            return;
        }

        setLoading(true);
        try {
            const res = await fetch('/api/transactions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    customer_id: customer.id,
                    card_id: card.id,
                    amount: val,
                    is_topup: true,
                    payment_method: 'CASH'
                })
            });

            if (res.ok) {
                toast.success(t('topup_success'));
                playSound('recharge');
                setManualAmount('');
                if (onRefresh) onRefresh();
            } else {
                toast.error(t('error_general'));
            }
        } finally {
            setLoading(false);
        }
    };

    // Pay from Wallet Balance (Monetary)
    const handlePayFromWallet = async () => {
        const val = parseFloat(amount);
        if (!val || val <= 0) {
            toast.error(t('error_invalid_amount'));
            return;
        }

        if (parseFloat(customer?.balance || 0) < val) {
            toast.error(t('insufficient_balance'));
            return;
        }

        if (!confirm(`${t('confirm_use_btn')}: ${currency}${val} ${t('pay_with_wallet')}?`)) return;

        setLoading(true);
        try {
            const res = await fetch('/api/transactions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    customer_id: customer.id,
                    card_id: card.id,
                    amount: val,
                    payment_method: 'WALLET',
                    is_topup: false
                })
            });

            if (res.ok) {
                toast.success(t('topup_success'));
                playSound('success');
                setAmount('');
                setFlashEffect('success');
                setTimeout(() => setFlashEffect(null), 1000);
                if (onRefresh) onRefresh();
            } else {
                const err = await res.json();
                toast.error(err.message || t('error_general'));
            }
        } catch (e) {
            toast.error(t('network_error'));
        } finally {
            setLoading(false);
        }
    };

    // Use Coupon / Checkout Logic
    // Use Coupon / Checkout Logic (Modified for Quick Use)
    const handleUseCoupon = async (specificCouponId = null) => {
        const couponId = specificCouponId || selectedCouponId;
        if (!couponId) return;
        setLoading(true);

        const val = parseFloat(amount) || 0;

        try {
            const res = await fetch('/api/transactions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    customer_id: customer.id,
                    card_id: card.id,
                    amount: val,
                    coupon_id: couponId,
                    payment_method: 'CASH'
                })
            });

            if (res.ok) {
                const data = await res.json();
                playSound('success');
                // Savings Celebration
                const amount_after = data.transaction?.amount_after_discount || 0;
                const amount_before = data.transaction?.amount_before_discount || 0;
                const savings = amount_before - amount_after;
                const savingsMsg = t('saving_value').replace('{value}', `${currency}${savings > 0 ? savings.toFixed(2) : '0.00'}`);
                toast.success(t('coupon_used') || 'Coupon Used Successfully!', {
                    description: savingsMsg,
                    duration: 5000,
                });

                // Visual Flash
                setFlashEffect('success');
                setTimeout(() => setFlashEffect(null), 1000);

                if (onRefresh) onRefresh();
                else onComplete();
            } else {
                toast.error(t('coupon_use_failed') || 'Failed to use coupon');
            }
        } catch (e) { toast.error(t('network_error')); }
        finally { setLoading(false); }
    };

    // Delete Coupon Logic
    const handleDeleteCoupon = async (couponId, e) => {
        e.stopPropagation(); // Prevent card selection
        if (!confirm('هل أنت متأكد من حذف هذا الكوبون نهائياً؟')) return;

        setLoading(true);
        try {
            const res = await fetch(`/api/coupons/${couponId}`, { method: 'DELETE' });
            if (res.ok) {
                toast.success(t('delete_success') || 'تم الحذف بنجاح');
                if (onRefresh) onRefresh();
                else onComplete();
            } else {
                toast.error(t('error_general') || 'فشل الحذف');
            }
        } catch (err) {
            console.error(err);
            toast.error(t('network_error') || 'خطأ في الاتصال');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-full relative">

            {/* --- TOP-UP STORE MODAL --- */}
            {showStore && (
                <div className="absolute inset-0 z-50 bg-slate-900/95 backdrop-blur-md rounded-3xl p-6 flex flex-col animate-in slide-in-from-bottom-5">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h2 className="text-2xl font-black text-white">{t('topup_modal_title') || 'Package Store'}</h2>
                            <p className="text-slate-400 text-sm">{t('topup_select_package') || 'Select a package to add to customer wallet'}</p>
                        </div>
                        <button onClick={() => setShowStore(false)} className="p-2 bg-slate-800 rounded-full text-slate-400 hover:text-white">
                            <XCircle size={24} />
                        </button>
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 overflow-y-auto pr-2 custom-scrollbar" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                        <style jsx>{`
                            .custom-scrollbar::-webkit-scrollbar { display: none; }
                        `}</style>
                        {/* Direct Top-up Card (More compact) */}
                        <div className="bg-emerald-500/5 border border-emerald-500/20 p-4 rounded-2xl flex flex-col justify-between shadow-sm relative overflow-hidden group h-full">
                            <div className="absolute -top-6 -right-6 w-16 h-16 bg-emerald-500/10 rounded-full blur-xl group-hover:bg-emerald-500/20 transition-all pointer-events-none" />
                            <div>
                                <h3 className="text-base font-black text-emerald-400 mb-1">{t('manual_topup')}</h3>
                                <p className="text-[10px] text-slate-500 leading-tight mb-3">{t('manual_topup_desc')}</p>
                            </div>

                            <div className="space-y-2">
                                <div className="relative">
                                    <input
                                        type="number"
                                        placeholder="0.00"
                                        value={manualAmount}
                                        onChange={(e) => setManualAmount(e.target.value)}
                                        className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-3 py-2 text-lg font-black text-white outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all pr-12"
                                    />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-500 font-bold">{currency}</span>
                                </div>
                                <button
                                    onClick={handleDirectTopUp}
                                    disabled={loading || !manualAmount}
                                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-2.5 rounded-xl font-black text-xs transition-all shadow-lg shadow-emerald-600/20 active:scale-95 disabled:opacity-50"
                                >
                                    {loading ? <Loader2 className="animate-spin mx-auto" size={16} /> : t('recharge_btn')}
                                </button>
                            </div>
                        </div>

                        {availableBundles && availableBundles.length > 0 ? (
                            availableBundles.map(bundle => (
                                <button
                                    key={bundle.id}
                                    disabled={loading}
                                    onClick={() => handleBuyPackage(bundle)}
                                    className="group relative bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 hover:border-blue-500 p-4 rounded-2xl text-start transition-all hover:scale-[1.02] shadow-xl h-full flex flex-col justify-between"
                                >
                                    <div className="absolute top-2 right-2 bg-blue-500/10 text-blue-400 text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                                        1 {t('credit_unit')}
                                    </div>
                                    <div>
                                        <h3 className="text-base font-bold text-white group-hover:text-blue-400 mb-1 line-clamp-1">{bundle.name}</h3>
                                        <div className="flex items-baseline gap-1">
                                            <span className="text-xl font-black text-white">{currency}{bundle.price}</span>
                                            <span className="text-[10px] text-slate-500 line-through">{currency}{(bundle.price * 1.2).toFixed(0)}</span>
                                        </div>
                                    </div>
                                    <div className="mt-3 flex flex-col gap-1.5">
                                        <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                                            <CheckCircle2 size={10} className="text-emerald-500" />
                                            <span>{bundle.validity_days} {t('days_label')}</span>
                                        </div>
                                        {bundle.reward_config?.type === 'PERCENTAGE' && (
                                            <div className="bg-amber-500/10 text-amber-500 text-[9px] font-black px-2 py-0.5 rounded-lg border border-amber-500/20 w-fit">
                                                +{bundle.reward_config.value}% {t('discount') || 'Discount'}
                                            </div>
                                        )}
                                    </div>
                                </button>
                            ))
                        ) : (
                            <div className="col-span-full flex flex-col items-center justify-center py-12 text-slate-500">
                                <Store size={48} className="mb-4 opacity-50" />
                                <h3 className="text-lg font-bold text-white mb-2">{t('no_packages_title') || 'No Packages Available'}</h3>
                                <p className="text-sm text-center max-w-xs">{t('no_packages_desc') || 'Please create new packages in the Package Manager to see them here.'}</p>
                            </div>
                        )}
                    </div>
                </div>
            )}


            {/* --- MAIN WALLET VIEW --- */}
            <div className="flex-1 overflow-y-auto">
                {/* Header Actions */}
                <div className="flex justify-between items-end mb-8 gap-4 h-20">
                    {/* Left Actions */}
                    <div className="flex items-end gap-4 h-full">
                        <button
                            onClick={() => setShowStore(true)}
                            className="h-14 bg-[#c5e14d] hover:bg-[#b5d13d] text-slate-900 px-6 rounded-2xl font-black text-sm flex items-center gap-2 shadow-xl shadow-[#c5e14d]/20 transition-all active:scale-95"
                        >
                            <UserPlus size={20} />
                            {t('topup_btn')}
                        </button>

                        <div className="h-10 w-px bg-slate-200/5 mt-auto mb-1 mx-1" />

                        <div className="flex items-end gap-4 h-full">
                            {/* Pay Button - Same Height */}
                            <button
                                onClick={handlePayFromWallet}
                                disabled={loading || !amount}
                                data-type="wallet-pay"
                                className="h-14 bg-[#75c4b1] hover:bg-[#65b4a1] text-white px-6 rounded-2xl font-black text-sm flex items-center gap-2 shadow-xl shadow-[#75c4b1]/20 transition-all active:scale-95 disabled:opacity-50"
                            >
                                <ArrowUpCircle size={18} />
                                {t('pay_with_wallet')}
                            </button>

                            {/* Bill Amount - Integrated Badge Style */}
                            <div className="bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/50 rounded-2xl px-4 h-14 flex flex-col justify-center min-w-[150px] items-center relative group focus-within:ring-2 focus-within:ring-blue-500/40 transition-all">
                                <span className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] mb-0.5 leading-none">{t('bill_amount')}</span>
                                <div className="flex items-baseline justify-center gap-1 w-full">
                                    <span className="text-[10px] font-black text-slate-400 dark:text-slate-600 uppercase pt-1">{currency}</span>
                                    <input
                                        type="number"
                                        placeholder="0.00"
                                        value={amount}
                                        onChange={(e) => setAmount(e.target.value)}
                                        className="bg-transparent border-none text-2xl font-black text-slate-900 dark:text-white outline-none text-center placeholder:text-slate-300 dark:placeholder:text-slate-800 font-mono tracking-tighter w-24"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Balances - Also Matching Height for symmetry */}
                    <div className="flex items-end gap-3 h-full">
                        {/* Credits Badge */}
                        <div className="bg-purple-500/10 border border-purple-500/20 rounded-2xl px-6 h-14 flex flex-col justify-center min-w-[110px] items-center">
                            <span className="text-[9px] font-black text-purple-500/60 uppercase tracking-[0.2em] mb-0.5">{t('credit_unit')}</span>
                            <span className="text-xl font-black text-purple-500 font-mono">
                                {walletItems.reduce((acc, g) => acc + g.count, 0)}
                            </span>
                        </div>

                        {/* Money Balance Badge */}
                        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl px-8 h-14 flex flex-col justify-center min-w-[160px] items-center">
                            <span className="text-[9px] font-black text-emerald-500/60 uppercase tracking-[0.2em] mb-0.5">{t('customer_wallet')}</span>
                            <div className="flex items-baseline gap-1">
                                <span className="text-[10px] font-black text-emerald-500/50 uppercase">{currency}</span>
                                <span className="text-2xl font-black text-emerald-500 font-mono tracking-tighter">
                                    {parseFloat(customer?.balance || 0).toLocaleString()}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Content */}
                {walletItems.length === 0 ? (
                    <div className="h-48 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-700/50 rounded-3xl bg-slate-50 dark:bg-slate-800/10 px-6 text-center">
                        <div className="w-16 h-16 bg-white dark:bg-slate-800/50 rounded-full flex items-center justify-center mb-3 border border-slate-200 dark:border-slate-700">
                            <Wallet size={32} className="text-slate-400 dark:text-slate-600" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-500 dark:text-slate-400">
                            {t('no_active_packages') || 'لا توجد باقات جاهزة للاستخدام'}
                        </h3>
                    </div>
                ) : (
                    <div className="mt-auto">
                        <div className="flex items-center justify-between mb-3 px-1">
                            <div className="flex items-center gap-2">
                                <Wallet size={16} className="text-purple-500" />
                                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 tracking-tight">{t('active_packages')}</span>
                            </div>
                            <div className="h-px flex-1 bg-slate-200 dark:bg-slate-200/5 mx-4" />
                        </div>
                        <div className="bg-slate-100 dark:bg-slate-900/40 border-2 border-dashed border-slate-200 dark:border-slate-700/50 rounded-3xl p-6 min-h-[160px]">
                            <div className="flex flex-wrap gap-4">
                                {walletItems.map(group => {
                                    const reward = group.campaigns?.reward_config || {};
                                    const activeId = group.allIds[0];

                                    return (
                                        <button
                                            key={group.id}
                                            onClick={() => handleUseCoupon(activeId)}
                                            disabled={loading}
                                            className="relative group bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 hover:border-purple-500 p-2.5 rounded-2xl flex flex-col items-center justify-center min-w-[90px] h-20 transition-all hover:scale-[1.05] active:scale-95 shadow-xl disabled:opacity-50"
                                        >
                                            {/* Price Badge - Subtle Left Top */}
                                            {group.campaigns?.price > 0 && (
                                                <div className="absolute -top-1.5 -left-1.5 bg-slate-700 text-slate-300 rounded-md border border-slate-600 shadow-sm z-10 group-hover:bg-slate-600 transition-colors flex items-baseline px-1.5 py-0.5 gap-0.5">
                                                    <span className="text-[7px] font-bold opacity-70 uppercase">{currency}</span>
                                                    <span className="text-[10px] font-black text-white leading-none">{group.campaigns.price}</span>
                                                </div>
                                            )}

                                            <div className="absolute -top-1.5 -right-1.5 bg-gradient-to-br from-purple-500 to-purple-700 text-white text-[10px] font-black h-5 w-5 rounded-full flex items-center justify-center border-2 border-slate-900 shadow-lg z-10">
                                                {group.count}
                                            </div>

                                            {reward.type === 'PERCENTAGE' && (
                                                <span className="text-xl font-black text-white mb-0 group-hover:text-purple-400 transition-colors">{reward.value}%</span>
                                            )}
                                            <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-tighter text-center line-clamp-1 leading-none group-hover:text-purple-400/70 transition-colors mt-0.5">
                                                {group.campaigns?.name}
                                            </span>

                                            <div className="absolute inset-0 bg-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl" />
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
