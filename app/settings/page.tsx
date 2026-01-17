'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/app/lib/supabase';
import { ArrowLeft, Save, LogOut } from 'lucide-react';
import Link from 'next/link';

export default function SettingsPage() {
    const router = useRouter();
    const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null);
    const [isLoadingSubscription, setIsLoadingSubscription] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    useEffect(() => {
        const fetchProfile = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                router.push('/auth/login');
                return;
            }
            setEmail(user.email || '');

            const { data: profile } = await supabase
                .from('profiles')
                .select('name, subscription_status')
                .eq('id', user.id)
                .single();

            if (profile) {
                setName(profile.name || '');
                setSubscriptionStatus(profile.subscription_status);
            }
            setLoading(false);
        };

        fetchProfile();
    }, [router]);

    const handleCheckout = async (isTrial: boolean) => {
        setIsLoadingSubscription(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const res = await fetch('/api/stripe/checkout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({ isTrial })
            });
            const data = await res.json();
            if (data.url) {
                window.location.href = data.url;
            } else {
                throw new Error(data.error || 'Failed to create checkout session');
            }
        } catch (error: any) {
            setMessage({ type: 'error', text: error.message });
            setIsLoadingSubscription(false);
        }
    };

    const handlePortal = async () => {
        setIsLoadingSubscription(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const res = await fetch('/api/stripe/portal', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${session.access_token}`
                }
            });
            const data = await res.json();
            if (data.url) {
                window.location.href = data.url;
            } else {
                throw new Error(data.error || 'Failed to create portal session');
            }
        } catch (error: any) {
            setMessage({ type: 'error', text: error.message });
            setIsLoadingSubscription(false);
        }
    };

    const handleUpdateProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setMessage(null);

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('No user found');

            const { error } = await supabase
                .from('profiles')
                .update({ name, updated_at: new Date().toISOString() })
                .eq('id', user.id);

            if (error) throw error;

            // Also update auth metadata
            await supabase.auth.updateUser({
                data: { name }
            });

            setMessage({ type: 'success', text: 'Profile updated successfully!' });
        } catch (error: any) {
            setMessage({ type: 'error', text: error.message });
        } finally {
            setSaving(false);
        }
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push('/auth/login');
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-app-bg flex items-center justify-center text-white">
                Loading settings...
            </div>
        );
    }

    const isSubscribed = subscriptionStatus === 'active' || subscriptionStatus === 'trialing';

    return (
        <div className="min-h-screen bg-app-bg text-app-text-primary p-4 md:p-8">
            <div className="max-w-2xl mx-auto">
                <Link href="/chat" className="inline-flex items-center gap-2 text-app-text-secondary hover:text-white mb-8 text-lg font-medium transition-colors">
                    <ArrowLeft size={24} />
                    Back to Chat
                </Link>

                <h1 className="text-3xl md:text-4xl font-bold text-white mb-8">Settings</h1>

                <div className="space-y-8">
                    {/* Subscription Card */}
                    <div className="bg-app-card border border-app-border rounded-2xl p-6 md:p-8 shadow-xl">
                        <h2 className="text-2xl font-bold text-white mb-4">Subscription</h2>
                        {message && (
                            <div className={`p-4 mb-4 rounded-xl ${message.type === 'success' ? 'bg-green-500/10 text-green-200 border border-green-500/30' : 'bg-red-500/10 text-red-200 border border-red-500/30'}`}>
                                {message.text}
                            </div>
                        )}

                        {isSubscribed ? (
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 text-green-400 bg-green-400/10 p-3 rounded-lg border border-green-400/20 w-fit">
                                    <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                                    <span className="font-medium">Active: Walter AI Pro</span>
                                </div>
                                <button
                                    onClick={handlePortal}
                                    disabled={isLoadingSubscription}
                                    className="w-full bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-lg hover:shadow-glow transform hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
                                >
                                    {isLoadingSubscription ? 'Loading...' : 'Manage Subscription'}
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <p className="text-app-text-secondary">Unlock the full power of Walter AI.</p>
                                <div className="grid md:grid-cols-2 gap-4">
                                    <button
                                        onClick={() => handleCheckout(true)}
                                        disabled={isLoadingSubscription}
                                        className="w-full bg-accent-gradient hover:opacity-90 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-lg hover:shadow-glow transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 border border-white/10"
                                    >
                                        {isLoadingSubscription ? 'Loading...' : 'Start 30-Day Free Trial'}
                                        <div className="text-xs font-normal opacity-80 mt-1">Then $10/mo</div>
                                    </button>
                                    <button
                                        onClick={() => handleCheckout(false)}
                                        disabled={isLoadingSubscription}
                                        className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-lg hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 border border-white/10"
                                    >
                                        {isLoadingSubscription ? 'Loading...' : 'Subscribe ($10/mo)'}
                                        <div className="text-xs font-normal opacity-80 mt-1">Skip trial, pay now</div>
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Profile Form */}
                    <div className="bg-app-card border border-app-border rounded-2xl p-6 md:p-8 shadow-xl">
                        <h2 className="text-2xl font-bold text-white mb-6">Profile</h2>
                        <form onSubmit={handleUpdateProfile} className="space-y-6">
                            <div>
                                <label className="block text-app-text-secondary mb-2 text-lg">Email Address</label>
                                <input
                                    type="email"
                                    value={email}
                                    disabled
                                    className="w-full bg-app-bg/50 text-app-text-muted text-lg px-4 py-3 rounded-xl border border-app-border cursor-not-allowed"
                                />
                                <p className="text-sm text-app-text-muted mt-2">Email cannot be changed manually.</p>
                            </div>

                            <div>
                                <label className="block text-app-text-secondary mb-2 text-lg">Full Name</label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="w-full bg-app-input text-white text-lg px-4 py-3 rounded-xl border border-app-border focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                />
                            </div>

                            <div className="flex flex-col sm:flex-row gap-4 pt-4 border-t border-app-border mt-8">
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="flex-1 bg-app-accent hover:bg-app-accent-hover text-white text-lg font-medium py-3 px-6 rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                                >
                                    <Save size={20} />
                                    {saving ? 'Saving...' : 'Save Changes'}
                                </button>

                                <button
                                    type="button"
                                    onClick={handleLogout}
                                    className="flex-1 bg-slate-700 hover:bg-slate-600 text-white text-lg font-medium py-3 px-6 rounded-xl flex items-center justify-center gap-2 transition-colors"
                                >
                                    <LogOut size={20} />
                                    Log Out
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}
