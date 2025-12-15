'use client';
import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { CreditCard, Wifi, WifiOff, Loader2, User, CheckCircle2, XCircle } from 'lucide-react';

export default function ScanPage() {
    const [status, setStatus] = useState('disconnected'); // disconnected, connected, scanning, processing
    const [scanResult, setScanResult] = useState(null);
    const wsRef = useRef(null);

    useEffect(() => {
        connectWebSocket();
        return () => {
            if (wsRef.current) wsRef.current.close();
        };
    }, []);

    const connectWebSocket = () => {
        const ws = new WebSocket('ws://localhost:8999');
        wsRef.current = ws;

        ws.onopen = () => {
            setStatus('connected');
            toast.success('Connected to NFC Reader');
        };

        ws.onclose = () => {
            setStatus('disconnected');
            toast.error('Disconnected from NFC Reader');
            // Try reconnecting in 5s
            setTimeout(connectWebSocket, 5000);
        };

        ws.onmessage = async (event) => {
            const data = JSON.parse(event.data);

            if (data.type === 'CARD_SCAN') {
                processScan(data.uid);
            } else if (data.type === 'READER_STATUS') {
                if (data.status === 'connected') toast.info(`Reader detected: ${data.name}`);
                if (data.status === 'disconnected') toast.warning('Reader removed');
            }
        };
    };

    const processScan = async (uid) => {
        setStatus('processing');
        setScanResult(null);
        toast.dismiss(); // Clear old toasts
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
            } else if (data.status === 'unknown_card') {
                toast.error('Unknown Card');
            } else {
                toast.error(data.message || 'Error processing card');
            }

        } catch (err) {
            console.error(err);
            toast.error('Network Error');
        } finally {
            setStatus('connected');
        }
    };

    return (
        <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-8">
                <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Scan Terminal</h1>
                <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${status === 'connected' || status === 'processing'
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                    }`}>
                    {status === 'connected' || status === 'processing' ? <Wifi size={18} /> : <WifiOff size={18} />}
                    {status === 'connected' || status === 'processing' ? 'Reader Ready' : 'Reader Offline'}
                </div>
            </div>

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
                        </div>
                    )}
                </div>

                {/* Right: Result Area */}
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
                                    <div>
                                        <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Customer Name</label>
                                        <p className="text-xl font-medium text-gray-900 dark:text-white">{scanResult.customer.full_name}</p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Current Points</label>
                                            <p className="text-lg font-medium text-blue-600 dark:text-blue-400">{scanResult.customer.points_balance || 0} pts</p>
                                        </div>
                                        <div>
                                            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Card UID</label>
                                            <p className="text-lg font-mono text-gray-600 dark:text-gray-300">{scanResult.card.uid}</p>
                                        </div>
                                    </div>

                                    {scanResult.discount ? (
                                        <div className="mt-4 p-4 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-900/50">
                                            <h4 className="font-semibold text-indigo-900 dark:text-indigo-300 flex items-center gap-2">
                                                Available Discount
                                            </h4>
                                            <p className="text-indigo-700 dark:text-indigo-400 text-sm mt-1">
                                                {scanResult.discount.name} ({scanResult.discount.type === 'percentage' ? `${scanResult.discount.value}% OFF` : `$${scanResult.discount.value} OFF`})
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="mt-4 p-4 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 text-center text-sm text-gray-500">
                                            No active discount available for this customer.
                                        </div>
                                    )}
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
