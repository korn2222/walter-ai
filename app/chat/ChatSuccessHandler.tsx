'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/app/lib/supabase';
import { X, Plus } from 'lucide-react';

export default function ChatSuccessHandler({ onSubscriptionUpdate }: { onSubscriptionUpdate: (status: string) => void }) {
    const searchParams = useSearchParams();
    const [showSuccess, setShowSuccess] = useState(false);

    useEffect(() => {
        if (searchParams.get('success') === 'true') {
            setShowSuccess(true);
            window.history.replaceState(null, '', '/chat');

            // Re-fetch profile/subscription status
            const fetchStatus = async () => {
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    const { data } = await supabase.from('profiles').select('subscription_status').eq('id', user.id).single();
                    if (data) onSubscriptionUpdate(data.subscription_status);
                }
            };
            fetchStatus();
        }
    }, [searchParams, onSubscriptionUpdate]);

    if (!showSuccess) return null;

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div className="bg-slate-900 border border-green-500/30 rounded-2xl p-8 max-w-md w-full text-center relative shadow-2xl shadow-green-900/20 scale-100 animate-in zoom-in-95 duration-300">
                <button
                    onClick={() => setShowSuccess(false)}
                    className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
                >
                    <X size={24} />
                </button>
                <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-6 text-green-400 border border-green-500/20">
                    <Plus size={40} className="rotate-45" />
                </div>
                <h2 className="text-3xl font-bold text-white mb-2">Welcome to Walter Pro!</h2>
                <p className="text-gray-300 mb-8 text-lg">
                    Your subscription is active. You now have unlimited access to Walter AI.
                </p>
                <button
                    onClick={() => setShowSuccess(false)}
                    className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg hover:shadow-green-500/20 text-lg"
                >
                    Start Chatting
                </button>
            </div>
        </div>
    );
}
