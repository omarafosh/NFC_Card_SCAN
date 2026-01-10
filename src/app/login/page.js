'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showTwoFactor, setShowTwoFactor] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [tempToken, setTempToken] = useState('');
  const router = useRouter();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (res.ok) {
        if (data.twoFactorRequired) {
          setTempToken(data.tempToken);
          setShowTwoFactor(true);
          toast.info('Please enter your 2FA code');
        } else {
          toast.success('Welcome back!');
          router.push('/dashboard');
        }
      } else {
        if (data.errors) {
          Object.values(data.errors).flat().forEach(err => toast.error(err));
        } else {
          toast.error(data.message || 'Login failed');
        }
      }
    } catch (err) {
      toast.error('An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const handleTwoFactorVerify = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch('/api/auth/2fa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tempToken, token: twoFactorCode }),
      });

      const data = await res.json();

      if (res.ok) {
        toast.success('Verified successfully!');
        router.push('/dashboard');
      } else {
        toast.error(data.message || 'Invalid code');
      }
    } catch (err) {
      toast.error('Verification failed');
    } finally {
      setLoading(false);
    }
  };

  if (showTwoFactor) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
        <div className="w-full max-w-md p-8 bg-gray-800 rounded-lg shadow-2xl border border-gray-700 animate-in fade-in slide-in-from-bottom-4">
          <h2 className="text-3xl font-bold mb-6 text-center text-blue-400">Two-Factor Authentication</h2>
          <p className="text-gray-400 text-center mb-8">Enter the 6-digit code from your authenticator app</p>

          <form onSubmit={handleTwoFactorVerify} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Authentication Code</label>
              <input
                type="text"
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 text-center text-2xl tracking-widest outline-none transition-all placeholder-gray-500 text-white font-mono"
                placeholder="000000"
                value={twoFactorCode}
                onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                maxLength={6}
                required
                autoFocus
              />
            </div>
            <button
              type="submit"
              disabled={loading || twoFactorCode.length !== 6}
              className={`w-full py-3 px-4 rounded-lg font-semibold bg-blue-600 hover:bg-blue-500 transition-all ${loading ? 'opacity-75' : ''}`}
            >
              {loading ? 'Verifying...' : 'Verify'}
            </button>
            <button
              type="button"
              onClick={() => setShowTwoFactor(false)}
              className="w-full text-sm text-gray-400 hover:text-white transition-colors"
            >
              Back to Login
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
      <div className="w-full max-w-md p-8 bg-gray-800 rounded-lg shadow-2xl border border-gray-700">
        <h2 className="text-3xl font-bold mb-6 text-center text-blue-400">NFC Discount System</h2>
        <p className="text-gray-400 text-center mb-8">Please sign in to continue</p>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Username</label>
            <input
              type="text"
              className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all placeholder-gray-500 text-white"
              placeholder="Enter your username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Password</label>
            <input
              type="password"
              className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all placeholder-gray-500 text-white"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className={`w-full py-3 px-4 rounded-lg font-semibold bg-blue-600 hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-opacity-50 transition-all shadow-lg ${loading ? 'opacity-75 cursor-not-allowed' : ''}`}
          >
            {loading ? 'Signing In...' : 'Sign In'}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-gray-700 flex justify-between items-center text-[10px] font-bold uppercase tracking-widest text-gray-500">
          <span>&copy; 2026 NFC Discount</span>
          <span className="bg-gray-900 px-2 py-0.5 rounded border border-gray-700 text-blue-400">v0.2.4</span>
        </div>
      </div>
    </div>
  );
}
