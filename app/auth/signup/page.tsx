'use client';

import { useState } from 'react';
import { supabase } from '@/app/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function SignupPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            // Verify if email is already used (requires check_email_exists RPC function)
            const { data: emailExists } = await supabase.rpc('check_email_exists', {
                email_to_check: email
            });

            if (emailExists) {
                throw new Error('This email is already registered. Please sign in instead.');
            }

            const { error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        name,
                    },
                },
            });

            if (error) throw error;
            alert('Signup successful! Please sign in.');
            router.push('/auth/login');

        } catch (err: any) {
            // Fallback for missing RPC or other errors
            if (err.message?.includes('check_email_exists') && err.message?.includes('not found')) {
                // Squelch RPC missing error if function not applied yet, proceed to try signup anyway
                console.warn("RPC check_email_exists missing, proceeding with standard signup");
                try {
                    const { error: signUpError } = await supabase.auth.signUp({
                        email,
                        password,
                        options: { data: { name } }
                    });
                    if (signUpError) throw signUpError;
                    alert('Signup successful! Please sign in.');
                    router.push('/auth/login');
                    return;
                } catch (innerErr: any) {
                    setError(innerErr.message);
                    return;
                }
            }
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-app-gradient p-4 antialiased">
            <div className="w-full max-w-md glass-panel rounded-3xl p-8 md:p-10 shadow-2xl relative overflow-hidden animate-fade-in">
                {/* Decorative background glow */}
                <div className="absolute -top-20 -left-20 w-64 h-64 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

                <div className="relative z-10">
                    <div className="text-center mb-10">
                        <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">Join Walter AI</h1>
                        <p className="text-app-text-muted">Start your journey today</p>
                    </div>

                    {error && (
                        <div className="bg-red-500/10 border border-red-500/20 text-red-200 p-4 rounded-2xl mb-6 text-sm backdrop-blur-sm">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSignup} className="space-y-5">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-app-text-secondary ml-1">Full Name</label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full bg-slate-900/50 text-white text-lg px-5 py-4 rounded-xl border border-white/10 focus:border-app-accent focus:ring-1 focus:ring-app-accent transition-all placeholder:text-slate-600"
                                placeholder="Walter Smith"
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-app-text-secondary ml-1">Email Address</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full bg-slate-900/50 text-white text-lg px-5 py-4 rounded-xl border border-white/10 focus:border-app-accent focus:ring-1 focus:ring-app-accent transition-all placeholder:text-slate-600"
                                placeholder="you@example.com"
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-app-text-secondary ml-1">Password</label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full bg-slate-900/50 text-white text-lg px-5 py-4 rounded-xl border border-white/10 focus:border-app-accent focus:ring-1 focus:ring-app-accent transition-all placeholder:text-slate-600"
                                placeholder="••••••••"
                                required
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-accent-gradient hover:opacity-90 text-white text-lg font-semibold h-[60px] rounded-2xl transition-all shadow-glow hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none mt-4"
                        >
                            {loading ? 'Creating account...' : 'Create Account'}
                        </button>
                    </form>

                    <p className="mt-8 text-center text-app-text-muted">
                        Already have an account?{' '}
                        <Link href="/auth/login" className="text-app-accent-glow hover:text-white font-medium transition-colors">
                            Sign in
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
