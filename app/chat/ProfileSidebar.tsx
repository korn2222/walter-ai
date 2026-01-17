'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/app/lib/supabase';
import { Save, LogOut, CreditCard, User, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface ProfileSidebarProps {
    user: any;
    isOpen: boolean;
    onClose: () => void;
}

export default function ProfileSidebar({ user, isOpen, onClose }: ProfileSidebarProps) {
    const router = useRouter();
    const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null);
    const [isLoadingSubscription, setIsLoadingSubscription] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    useEffect(() => {
        if (!user) return;

        const fetchProfile = async () => {
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
    }, [user]);

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
            const { error } = await supabase
                .from('profiles')
                .update({ name, updated_at: new Date().toISOString() })
                .eq('id', user.id);

            if (error) throw error;

            await supabase.auth.updateUser({
                data: { name }
            });

            setMessage({ type: 'success', text: 'Saved!' });
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

    const isSubscribed = subscriptionStatus === 'active' || subscriptionStatus === 'trialing';

    if (!isOpen) return null;

    return (
        <aside className="w-full md:w-[320px] bg-slate-900/90 backdrop-blur-xl border-l border-white/5 h-full flex flex-col transition-all duration-300 absolute md:relative right-0 z-50">
            <div className="p-6 border-b border-white/5 flex items-center justify-between">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <User size={20} className="text-app-accent-glow" />
                    Profile
                </h2>
                <button onClick={onClose} className="md:hidden text-gray-400 hover:text-white">
                    ✕
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-8">
                {/* Subscription Status */}
                <section>
                    <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Subscription</h3>

                    {message && (
                        <div className={`p-3 mb-4 rounded-lg text-sm ${message.type === 'success' ? 'bg-green-500/10 text-green-200 border border-green-500/20' : 'bg-red-500/10 text-red-200 border border-red-500/20'}`}>
                            {message.text}
                        </div>
                    )}

                    {loading ? (
                        <div className="animate-pulse h-20 bg-white/5 rounded-xl" />
                    ) : isSubscribed ? (
                        <div className="space-y-3">
                            <div className="bg-green-500/10 border border-green-500/20 p-4 rounded-xl">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center text-green-400">
                                        <Sparkles size={16} />
                                    </div>
                                    <div>
                                        <p className="font-bold text-white">Walter AI Pro</p>
                                        <p className="text-xs text-green-300">Active Plan</p>
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={handlePortal}
                                disabled={isLoadingSubscription}
                                className="w-full bg-white/5 hover:bg-white/10 text-white text-sm font-medium py-2.5 rounded-lg transition-colors border border-white/5"
                            >
                                {isLoadingSubscription ? 'Loading...' : 'Manage Subscription'}
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <div className="bg-blue-600/10 border border-blue-500/20 p-4 rounded-xl">
                                <p className="text-sm text-blue-200 mb-3">Upgrade to unlock full chat access and premium features.</p>
                                <button
                                    onClick={() => handleCheckout(true)}
                                    disabled={isLoadingSubscription}
                                    className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-2.5 rounded-lg transition-all shadow-lg hover:shadow-blue-500/20 mb-2"
                                >
                                    {isLoadingSubscription ? 'Loading...' : 'Start Free Trial'}
                                </button>
                                <button
                                    onClick={() => handleCheckout(false)}
                                    disabled={isLoadingSubscription}
                                    className="w-full bg-transparent hover:bg-white/5 text-xs text-gray-400 font-medium py-2 rounded-lg transition-colors"
                                >
                                    Or subscribe immediately ($15/mo)
                                </button>
                            </div>
                        </div>
                    )}
                </section>

                {/* Profile Settings */}
                <section>
                    <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Account</h3>
                    <form onSubmit={handleUpdateProfile} className="space-y-4">
                        <div>
                            <label className="block text-xs text-gray-500 mb-1.5">Email</label>
                            <input
                                type="email"
                                value={email}
                                disabled
                                className="w-full bg-black/20 text-gray-400 text-sm px-3 py-2.5 rounded-lg border border-white/5 cursor-not-allowed"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-gray-500 mb-1.5">Name</label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full bg-white/5 text-white text-sm px-3 py-2.5 rounded-lg border border-white/10 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                                placeholder="Your name"
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={saving}
                            className="w-full bg-white/5 hover:bg-white/10 text-white text-sm font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 border border-white/5"
                        >
                            <Save size={16} />
                            {saving ? 'Saving...' : 'Save Changes'}
                        </button>
                    </form>
                </section>
            </div>

            <div className="p-6 border-t border-white/5">
                <button
                    onClick={handleLogout}
                    className="w-full flex items-center justify-center gap-2 text-red-400 hover:bg-red-500/10 hover:text-red-300 py-2.5 rounded-lg transition-colors text-sm font-medium"
                >
                    <LogOut size={16} />
                    Log Out
                </button>
            </div>
        </aside>
    );
}
