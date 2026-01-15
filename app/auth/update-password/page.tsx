'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/app/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function UpdatePasswordPage() {
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const router = useRouter();

    useEffect(() => {
        // Exchange the hash fragment for a session if present (Supabase magic)
        // Usually handled automatically by the auth helper, but ensuring session helps.
        const handleSession = async () => {
            const { data: { session }, error } = await supabase.auth.getSession();
            if (error) console.error("Session error:", error);
        };
        handleSession();
    }, []);


    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setMessage(null);

        try {
            const { error } = await supabase.auth.updateUser({ password });
            if (error) throw error;

            setMessage({ type: 'success', text: 'Password updated successfully!' });
            setTimeout(() => {
                router.push('/auth/login');
            }, 2000);
        } catch (err: any) {
            setMessage({ type: 'error', text: err.message });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-app-gradient p-4 antialiased">
            <div className="w-full max-w-md glass-panel rounded-3xl p-8 md:p-10 shadow-2xl relative overflow-hidden animate-fade-in">
                {/* Decorative background glow */}
                <div className="absolute -top-20 -right-20 w-64 h-64 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

                <div className="relative z-10">
                    <div className="text-center mb-10">
                        <h1 className="text-3xl font-bold text-white mb-3 tracking-tight">Update Password</h1>
                        <p className="text-app-text-muted text-base">Enter your new password below</p>
                    </div>

                    {message && (
                        <div className={`p-4 rounded-2xl mb-6 text-sm backdrop-blur-sm border ${message.type === 'success'
                                ? 'bg-green-500/10 border-green-500/20 text-green-200'
                                : 'bg-red-500/10 border-red-500/20 text-red-200'
                            }`}>
                            {message.text}
                        </div>
                    )}

                    <form onSubmit={handleUpdate} className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-app-text-secondary ml-1">New Password</label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full bg-slate-900/50 text-white text-lg px-5 py-4 rounded-xl border border-white/10 focus:border-app-accent focus:ring-1 focus:ring-app-accent transition-all placeholder:text-slate-600"
                                placeholder="••••••••"
                                required
                                minLength={6}
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-accent-gradient hover:opacity-90 text-white text-lg font-semibold h-[60px] rounded-2xl transition-all shadow-glow hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none mt-4"
                        >
                            {loading ? 'Updating...' : 'Update Password'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
