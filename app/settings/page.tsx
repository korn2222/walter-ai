'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/app/lib/supabase';
import { ArrowLeft, Save, LogOut } from 'lucide-react';
import Link from 'next/link';

export default function SettingsPage() {
    const router = useRouter();
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
                .select('name')
                .eq('id', user.id)
                .single();

            if (profile) {
                setName(profile.name || '');
            }
            setLoading(false);
        };

        fetchProfile();
    }, [router]);

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

    return (
        <div className="min-h-screen bg-app-bg text-app-text-primary p-4 md:p-8">
            <div className="max-w-2xl mx-auto">
                <Link href="/chat" className="inline-flex items-center gap-2 text-app-text-secondary hover:text-white mb-8 text-lg font-medium transition-colors">
                    <ArrowLeft size={24} />
                    Back to Chat
                </Link>

                <h1 className="text-3xl md:text-4xl font-bold text-white mb-8">Settings</h1>

                <div className="bg-app-card border border-app-border rounded-2xl p-6 md:p-8 shadow-xl space-y-8">
                    {message && (
                        <div className={`p-4 rounded-xl ${message.type === 'success' ? 'bg-green-500/10 text-green-200 border border-green-500/30' : 'bg-red-500/10 text-red-200 border border-red-500/30'}`}>
                            {message.text}
                        </div>
                    )}

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
    );
}
