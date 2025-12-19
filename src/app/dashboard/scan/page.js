'use client';
import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { CreditCard, Wifi, WifiOff, Loader2, User, CheckCircle2, XCircle, Settings, Save, Delete } from 'lucide-react';

export default function ScanPage() {
    const [status, setStatus] = useState('disconnected'); // disconnected, connected, scanning, processing
    const [scanResult, setScanResult] = useState(null);
    const [readerIP, setReaderIP] = useState('127.0.0.1'); // Default to localhost
    const [showSettings, setShowSettings] = useState(false);

    // Persist IP
    useEffect(() => {
        const savedIP = localStorage.getItem('nfc_reader_ip');
        if (savedIP) setReaderIP(savedIP);
    }, []);

    const wsRef = useRef(null);
    const retryTimeoutRef = useRef(null);
    const isMounted = useRef(true);

    // Re-connect whenever IP changes (and component is mounted)
    useEffect(() => {
        isMounted.current = true;
        connectWebSocket(readerIP);
        return () => {
            isMounted.current = false;
            if (wsRef.current) {
                wsRef.current.onclose = null;
                wsRef.current.close();
            }
            if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
        };
    }, [readerIP]);

    const saveSettings = (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const newIP = formData.get('ip');
        if (newIP) {
            setReaderIP(newIP);
            localStorage.setItem('nfc_reader_ip', newIP);
            setShowSettings(false);
            toast.success(`Reader IP updated to ${newIP}`);
            // Force reconnect
            if (wsRef.current) wsRef.current.close();
        }
    };

    const connectWebSocket = (address) => {
        if (!isMounted.current) return;

        // Clean up existing
        if (wsRef.current) {
            wsRef.current.onclose = null;
            wsRef.current.close();
        }

        const wsUrl = `ws://${address}:8999`;
        console.log(`Attempting connection to ${wsUrl}`);

        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
            if (!isMounted.current) {
                ws.close();
                return;
            }
            setStatus('connected');
            toast.success('Connected to NFC Reader');
        };

        ws.onmessage = async (event) => {
            try {
                const data = JSON.parse(event.data);

                if (data.type === 'PING') return;

                if (data.type === 'CARD_SCAN') {
                    processScan(data.uid);
                } else if (data.type === 'READER_STATUS') {
                    if (data.status === 'connected') toast.info(`Reader detected: ${data.name}`);
                    if (data.status === 'disconnected') toast.warning('Reader removed');
                }
            } catch (e) {
                console.error('Failed to parse WS message:', e);
            }
        };

        ws.onclose = (event) => {
            if (!isMounted.current || wsRef.current !== ws) return;

            setStatus('disconnected');
            // Simply retry the SAME IP after a delay. 
            // We removed the auto-failover to localhost logic because strictly sticking to the configured IP is better for remote setups.
            retryTimeoutRef.current = setTimeout(() => connectWebSocket(address), 5000);
        };
    };

    // Audio Context Ref
    const audioContextRef = useRef(null);

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
        toast.info('Processing card...');

        try {
            const res = await fetch('/api/scan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ uid }),
            });
            const data = await res.json();

            setScanResult(data);

            if (data.status === 'success') {
                toast.success(`Customer verified: ${data.customer.full_name}`);
                playSound('success');
            } else if (data.status === 'unknown_card') {
                toast.error('Unknown Card');
                playSound('error');
            } else {
                toast.error(data.message || 'Error processing card');
                playSound('error');
            }

        } catch (err) {
            console.error(err);
            toast.error('Network Error');
            playSound('error');
        } finally {
            setStatus('connected');
        }
    };

    return (
        <div className="max-w-4xl mx-auto relative">
            <div className="flex items-center justify-between mb-8">
                <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Scan Terminal</h1>
                <div className="flex gap-2">
                    <button
                        onClick={() => setShowSettings(!showSettings)}
                        className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg dark:text-gray-400 dark:hover:bg-gray-800 transition"
                        title="Reader Connections"
                    >
                        <Settings size={20} />
                    </button>
                    <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${status === 'connected' || status === 'processing'
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        }`}>
                        {status === 'connected' || status === 'processing' ? <Wifi size={18} /> : <WifiOff size={18} />}
                        {status === 'connected' || status === 'processing' ? 'Reader Ready' : 'Reader Offline'}
                    </div>
                </div>
            </div>

            {/* Connection Settings Modal */}
            {showSettings && (
                <div className="absolute top-16 right-0 z-50 w-80 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-100 dark:border-gray-700 p-4 animate-in slide-in-from-top-2 duration-200">
                    <h3 className="font-bold text-gray-900 dark:text-white mb-3">Reader Connection</h3>
                    <form onSubmit={saveSettings} className="space-y-3">
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Reader IP Address</label>
                            <input
                                name="ip"
                                defaultValue={readerIP}
                                placeholder="127.0.0.1 or 192.168.x.x"
                                className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <p className="text-xs text-gray-400 mt-1">
                                Use <b>127.0.0.1</b> if the reader is connected to this device.
                                Use the PC's IP if connecting remotely.
                            </p>
                        </div>
                        <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 rounded-lg flex items-center justify-center gap-2">
                            <Save size={16} /> Save & Connect
                        </button>
                    </form>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Left: Scan Area */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-12 flex flex-col items-center justify-center text-center min-h-[400px]">
                    {status === 'processing' ? (
                        <div className="animate-pulse flex flex-col items-center">
                            <div className="h-24 w-24 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-6">
                                <Loader2 className="animate-spin text-blue-600 dark:text-blue-400" size={48} />
                            </div>
                            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Reading Card...</h3>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center">
                            <div className={`h-24 w-24 rounded-full flex items-center justify-center mb-6 transition-colors ${status === 'connected'
                                ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                                : 'bg-gray-100 dark:bg-gray-800 text-gray-400'
                                }`}>
                                <CreditCard size={48} />
                            </div>
                            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                                Waiting for Card
                            </h3>
                            <p className="text-gray-500 dark:text-gray-400 max-w-xs">
                                Tap an NFC card on the reader to identify customer and apply discounts.
                            </p>
                            <div className="mt-4 text-xs text-gray-400 font-mono">
                                Connected to: {readerIP}:8999
                            </div>
                        </div>
                    )}
                </div>

                {/* Right: Result Area & Checkout */}
                <div className="space-y-6">
                    {scanResult ? (
                        scanResult.status === 'success' ? (
                            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-green-200 dark:border-green-900 overflow-hidden">
                                <div className="bg-green-500/10 p-6 border-b border-green-100 dark:border-green-900/50 flex items-center gap-4">
                                    <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/50 flex items-center justify-center text-green-600 dark:text-green-400">
                                        <CheckCircle2 size={24} />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Active Customer</h3>
                                        <p className="text-sm text-green-600 dark:text-green-400">Verified Successfully</p>
                                    </div>
                                </div>
                                <div className="p-6 space-y-4">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Customer Name</label>
                                            <p className="text-xl font-medium text-gray-900 dark:text-white">{scanResult.customer.full_name}</p>
                                        </div>
                                        <div className="text-right">
                                            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Current Points</label>
                                            <p className="text-xl font-bold text-blue-600 dark:text-blue-400">{scanResult.customer.points_balance}</p>
                                        </div>
                                    </div>

                                    <hr className="border-gray-100 dark:border-gray-700 my-4" />

                                    {/* Checkout Form */}
                                    <CheckoutForm
                                        customer={scanResult.customer}
                                        card={scanResult.card}
                                        rewards={scanResult.availableRewards}
                                        onComplete={() => {
                                            setScanResult(null);
                                            toast.success('Transaction Completed!');
                                        }}
                                    />
                                </div>
                            </div>
                        ) : (
                            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-red-200 dark:border-red-900 p-8 text-center">
                                <div className="mx-auto h-16 w-16 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center text-red-500 mb-4">
                                    <XCircle size={32} />
                                </div>
                                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                                    {scanResult.message}
                                </h3>
                                <p className="text-gray-500">
                                    Card UID: <span className="font-mono bg-gray-100 px-2 py-1 rounded text-gray-800">{scanResult.uid}</span>
                                </p>
                                <button onClick={() => setScanResult(null)} className="mt-6 px-6 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition">
                                    Try Again
                                </button>
                            </div>
                        )
                    ) : (
                        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 h-full min-h-[400px] flex flex-col items-center justify-center text-gray-400 p-8 text-center">
                            <User size={32} className="mb-4 opacity-50" />
                            <p>Scan a card to view customer details and available discounts here.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function CheckoutForm({ customer, card, rewards, onComplete }) {
    const [amount, setAmount] = useState('');
    const [selectedRewardId, setSelectedRewardId] = useState('');
    const [loading, setLoading] = useState(false);

    const selectedReward = rewards.find(r => r.id.toString() === selectedRewardId);

    // Calculate final amount
    const finalAmount = () => {
        const amt = parseFloat(amount) || 0;
        if (!selectedReward) return amt;

        if (selectedReward.type === 'percentage') {
            return Math.max(0, amt - (amt * (selectedReward.value / 100)));
        } else if (selectedReward.type === 'fixed_amount') {
            return Math.max(0, amt - selectedReward.value);
        }
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
                toast.success(`Charged $${data.amount_after} | Earned ${data.points_earned} pts`);
                onComplete();
            } else {
                toast.error(data.message || 'Transaction failed');
            }
        } catch (err) {
            toast.error('Network error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Calculator / Input Area */}
            <CalculatorInput
                value={amount}
                onChange={setAmount}
                currency="$"
            />

            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Available Rewards</label>
                <select
                    className="w-full px-3 py-2 border rounded-lg bg-gray-50 dark:bg-gray-700 bg-white"
                    value={selectedRewardId}
                    onChange={e => setSelectedRewardId(e.target.value)}
                >
                    <option value="">No Reward Applied</option>
                    {rewards.map(reward => (
                        <option key={reward.id} value={reward.id}>
                            {reward.name} - {reward.type === 'percentage' ? `${reward.value}% OFF` : `$${reward.value} OFF`}
                            {reward.points_required > 0 ? ` (${reward.points_required} pts)` : ' (Free)'}
                        </option>
                    ))}
                </select>
            </div>

            {selectedReward && (
                <div className="bg-blue-50 text-blue-700 p-3 rounded-lg text-sm flex justify-between items-center animate-in fade-in zoom-in duration-200">
                    <span>Discount Applied:</span>
                    <span className="font-bold">-{selectedReward.type === 'percentage' ? `${selectedReward.value}%` : `$${selectedReward.value}`}</span>
                </div>
            )}

            <div className="pt-4 border-t border-gray-100 dark:border-gray-700">
                <div className="flex justify-between items-end mb-4">
                    <span className="text-gray-500 font-medium">Total to Pay</span>
                    <span className="text-4xl font-black text-gray-900 dark:text-white tracking-tight">${finalAmount().toFixed(2)}</span>
                </div>
                <button
                    onClick={handleCheckout}
                    disabled={loading || !amount}
                    className="w-full py-4 bg-gray-900 hover:bg-black text-white rounded-xl font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg active:scale-[0.98]"
                >
                    {loading ? 'Processing...' : 'Complete Transaction'}
                </button>
            </div>
        </div>
    );
}

function CalculatorInput({ value, onChange, currency }) {
    const handleNum = (num) => {
        if (value.includes('.') && num === '.' && value.split('.')[1].length >= 2) return; // Max 2 decimals
        if (num === '.' && value.includes('.')) return;
        onChange(prev => prev + num);
    };

    const handleClear = () => {
        onChange('');
    };

    const handleBackspace = () => {
        onChange(prev => prev.slice(0, -1));
    };

    const handleQuickAdd = (amountToAdd) => {
        const current = parseFloat(value) || 0;
        onChange((current + amountToAdd).toFixed(2).replace(/\.00$/, ''));
    };

    return (
        <div className="space-y-4">
            {/* Display Screen */}
            <div className="relative">
                <div className="absolute top-2 left-3 text-gray-400 font-medium text-sm">BILL AMOUNT</div>
                <div className="flex items-center justify-end w-full bg-gray-50 dark:bg-gray-900/50 border-2 border-blue-100 dark:border-blue-900/30 rounded-2xl px-6 py-6 h-28">
                    <span className="text-3xl text-gray-400 mr-2 font-light">{currency}</span>
                    <span className={`text-5xl font-mono mobile-nums tracking-wider ${!value ? 'text-gray-300' : 'text-gray-900 dark:text-white'}`}>
                        {value || '0.00'}
                    </span>
                </div>
                {value && (
                    <button
                        onClick={handleBackspace}
                        className="absolute bottom-4 left-4 p-2 text-gray-400 hover:text-red-500 transition-colors"
                    >
                        <Delete size={24} />
                    </button>
                )}
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-4 gap-2">
                {[10, 20, 50, 100].map(amt => (
                    <button
                        key={amt}
                        onClick={() => handleQuickAdd(amt)}
                        className="bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300 dark:hover:bg-blue-900/40 py-2 rounded-lg text-sm font-bold transition-colors"
                    >
                        +{amt}
                    </button>
                ))}
            </div>

            {/* Keypad */}
            <div className="grid grid-cols-3 gap-3">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                    <button
                        key={num}
                        onClick={() => handleNum(num.toString())}
                        className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 active:bg-gray-100 text-2xl font-bold text-gray-700 dark:text-gray-200 py-4 rounded-xl transition-all"
                    >
                        {num}
                    </button>
                ))}

                <button
                    onClick={handleClear}
                    className="bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-900/20 dark:text-red-400 border border-transparent font-bold py-4 rounded-xl transition-colors"
                >
                    C
                </button>
                <button
                    onClick={() => handleNum('0')}
                    className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm hover:bg-gray-50 text-2xl font-bold text-gray-700 dark:text-gray-200 py-4 rounded-xl"
                >
                    0
                </button>
                <button
                    onClick={() => handleNum('.')}
                    className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm hover:bg-gray-50 text-2xl font-bold text-gray-700 dark:text-gray-200 py-4 rounded-xl"
                >
                    .
                </button>
            </div>
        </div>
    );
}
