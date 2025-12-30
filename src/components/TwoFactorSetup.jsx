'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, ShieldCheck, Copy } from 'lucide-react';

export default function TwoFactorSetup({ onComplete }) {
    const [step, setStep] = useState('initial'); // initial, qr, verifying, success
    const [loading, setLoading] = useState(false);
    const [qrData, setQrData] = useState(null);
    const [secret, setSecret] = useState('');
    const [token, setToken] = useState('');

    const startSetup = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/auth/2fa/setup', { method: 'POST' });
            const data = await res.json();

            if (!res.ok) throw new Error(data.message);

            setQrData(data.qrCode);
            setSecret(data.secret);
            setStep('qr');
        } catch (err) {
            toast.error('Failed to start 2FA setup: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const verifyAndEnable = async () => {
        if (token.length !== 6) {
            toast.error('Please enter a valid 6-digit code');
            return;
        }

        setLoading(true);
        try {
            const res = await fetch('/api/auth/2fa/enable', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.message);

            setStep('success');
            toast.success('Two-factor authentication enabled successfully!');
            if (onComplete) onComplete();

        } catch (err) {
            toast.error('Verification failed: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    if (step === 'initial') {
        return (
            <div className="space-y-4">
                <div className="flex items-center gap-2 text-amber-600 bg-amber-50 p-3 rounded-md border border-amber-200">
                    <ShieldCheck className="w-5 h-5 flex-shrink-0" />
                    <p className="text-sm">Protect your account by adding an extra layer of security.</p>
                </div>
                <Button onClick={startSetup} disabled={loading} className="w-full">
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Enable 2FA'}
                </Button>
            </div>
        );
    }

    if (step === 'qr') {
        return (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
                <div className="text-center space-y-2">
                    <p className="text-sm text-muted-foreground">1. Scan this QR code with Google Authenticator</p>
                    {qrData && (
                        <div className="flex justify-center p-4 bg-white rounded-lg border">
                            <img src={qrData} alt="2FA QR Code" className="w-48 h-48" />
                        </div>
                    )}
                </div>

                <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground uppercase">Or enter setup key manually</Label>
                    <div className="flex gap-2">
                        <code className="flex-1 p-2 bg-muted rounded text-xs font-mono break-all">{secret}</code>
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => {
                            navigator.clipboard.writeText(secret);
                            toast.success('Copied to clipboard');
                        }}>
                            <Copy className="w-4 h-4" />
                        </Button>
                    </div>
                </div>

                <div className="space-y-2 pt-2">
                    <p className="text-sm text-muted-foreground">2. Enter the 6-digit code from the app</p>
                    <div className="flex gap-2">
                        <Input
                            value={token}
                            onChange={(e) => setToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            placeholder="000000"
                            className="text-center tracking-widest text-lg font-mono"
                            maxLength={6}
                        />
                        <Button onClick={verifyAndEnable} disabled={loading || token.length !== 6}>
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Enable'}
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    if (step === 'success') {
        return (
            <div className="text-center p-6 space-y-4 text-green-600 bg-green-50 rounded-lg border border-green-200">
                <div className="mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                    <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                    <h3 className="font-semibold">2FA Enabled!</h3>
                    <p className="text-sm text-green-700">Your account is now more secure.</p>
                </div>
            </div>
        );
    }

    return null;
}
