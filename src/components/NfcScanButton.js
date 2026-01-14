'use client';
import { useState, useEffect } from 'react';
import { Zap, Loader2, WifiOff } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { useLanguage } from '@/lib/LanguageContext';

export default function NfcScanButton({ onScan, className = "" }) {
    const { t } = useLanguage();
    const [isScanning, setIsScanning] = useState(false);
    const [terminalId, setTerminalId] = useState(null);

    useEffect(() => {
        // Read terminal from localStorage
        const saved = localStorage.getItem('selected_terminal');
        if (saved) setTerminalId(saved);
    }, []);

    const startScanning = () => {
        const currentTerminal = localStorage.getItem('selected_terminal');
        if (!currentTerminal) {
            toast.error(t('select_terminal_first') || 'يرجى اختيار الماكينة أولاً من صفحة المسح');
            return;
        }
        setTerminalId(currentTerminal);
        setIsScanning(true);
        toast.info(t('waiting_for_card_on_terminal') || 'في انتظار وضع البطاقة على الماكينة...');
    };

    useEffect(() => {
        if (!isScanning || !terminalId) return;

        const channel = supabase
            .channel(`quick-scan-${terminalId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'scan_events',
                    filter: `terminal_id=eq.${terminalId}`
                },
                (payload) => {
                    const uid = payload.new ? payload.new.uid : null;
                    if (uid) {
                        onScan(uid);
                        setIsScanning(false);
                        toast.success(t('card_scanned_success') || 'تم قراءة البطاقة بنجاح');
                    }
                }
            )
            .subscribe();

        // Auto-stop after 30 seconds to save resources
        const timeout = setTimeout(() => {
            if (isScanning) {
                setIsScanning(false);
                toast.error(t('scan_timeout') || 'انتهى وقت الانتظار');
            }
        }, 30000);

        return () => {
            clearTimeout(timeout);
            channel.unsubscribe();
            supabase.removeChannel(channel);
        };
    }, [isScanning, terminalId, onScan]);

    if (isScanning) {
        return (
            <button
                type="button"
                onClick={() => setIsScanning(false)}
                className={`flex items-center gap-2 px-3 py-2 bg-amber-500 text-white rounded-xl font-bold animate-pulse ${className}`}
            >
                <Loader2 size={16} className="animate-spin" />
                <span className="text-xs">{t('scanning') || 'جاري المسح...'}</span>
            </button>
        );
    }

    return (
        <button
            type="button"
            onClick={startScanning}
            className={`flex items-center gap-2 px-3 py-2 bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500 hover:text-white rounded-xl border border-blue-500/20 transition-all font-bold ${className}`}
            title={t('scan_from_terminal') || 'مسح من الماكينة'}
        >
            <Zap size={16} className="fill-current" />
            <span className="text-xs">{t('scan') || 'مسح'}</span>
        </button>
    );
}
