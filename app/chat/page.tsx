'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/app/lib/supabase';
import {
    Send,
    Menu,
    Plus,
    MessageSquare,
    User,
    Settings,
    LogOut,
    X
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface Tuple {
    role: 'user' | 'assistant';
    content: string;
}

interface Conversation {
    id: string;
    title: string;
    updated_at: string;
}

export default function ChatPage() {
    const router = useRouter();
    const [user, setUser] = useState<any>(null);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [messages, setMessages] = useState<Tuple[]>([]);
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [isMobile, setIsMobile] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const checkUser = async () => {
            const { data: { user }, error } = await supabase.auth.getUser();
            if (error || !user) {
                router.push('/auth/login');
                return;
            }
            setUser(user);
            fetchConversations(user.id);
        };

        checkUser();

        const handleResize = () => {
            const mobile = window.innerWidth < 768;
            setIsMobile(mobile);
            if (mobile) setSidebarOpen(false);
            else setSidebarOpen(true);
        };

        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [router]);

    useEffect(() => {
        // Small timeout to ensure DOM update
        setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
    }, [messages]);

    const fetchConversations = async (userId: string) => {
        const { data } = await supabase
            .from('conversations')
            .select('*')
            .eq('user_id', userId)
            .order('updated_at', { ascending: false });

        if (data) setConversations(data);
    };

    const loadConversation = async (id: string) => {
        setActiveConversationId(id);
        setLoading(true);
        const { data } = await supabase
            .from('messages')
            .select('role, content')
            .eq('conversation_id', id)
            .order('created_at', { ascending: true });

        if (data) {
            setMessages(data as Tuple[]);
        }
        setLoading(false);
        if (isMobile) setSidebarOpen(false);
    };

    const startNewChat = () => {
        setActiveConversationId(null);
        setMessages([]);
        if (isMobile) setSidebarOpen(false);
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push('/auth/login');
    };

    const sendMessage = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!input.trim() || loading) return;

        const userMessage = input.trim();
        setInput('');
        setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
        setLoading(true);

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error('No session');

            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({
                    message: userMessage,
                    conversationId: activeConversationId
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `Server error: ${response.status}`);
            }

            const reader = response.body?.getReader();
            const decoder = new TextDecoder();
            let assistantMessage = '';

            const newConversationId = response.headers.get('x-conversation-id');
            if (newConversationId && activeConversationId !== newConversationId) {
                setActiveConversationId(newConversationId);
            }

            setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

            if (reader) {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    const chunk = decoder.decode(value, { stream: true });
                    assistantMessage += chunk;

                    setMessages(prev => {
                        const newMsgs = [...prev];
                        const lastMsg = newMsgs[newMsgs.length - 1];
                        if (lastMsg.role === 'assistant') {
                            lastMsg.content = assistantMessage;
                        }
                        return newMsgs;
                    });
                }
            }

            if (!activeConversationId && newConversationId) {
                fetchConversations(user.id);
            }

        } catch (error: any) {
            console.error(error);
            alert(`Error: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex h-screen overflow-hidden bg-app-gradient text-app-text-primary antialiased">
            {/* Mobile Overlay */}
            {isMobile && sidebarOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity" onClick={() => setSidebarOpen(false)} />
            )}

            {/* Sidebar - Glass Effect */}
            <aside
                className={`
            fixed md:relative z-50 h-full w-[280px] bg-slate-900/80 backdrop-blur-xl border-r border-white/5 flex flex-col transition-transform duration-300 ease-in-out
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0 md:w-[280px]'}
            ${!sidebarOpen && !isMobile ? 'hidden' : 'flex'}
        `}
            >
                <div className="p-5 border-b border-white/5 flex items-center justify-between">
                    <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                        <span className="w-8 h-8 rounded-lg bg-accent-gradient flex items-center justify-center text-sm shadow-glow">W</span>
                        Walter AI
                    </h1>
                    {isMobile && (
                        <button onClick={() => setSidebarOpen(false)} className="text-app-text-muted hover:text-white transition-colors">
                            <X size={24} />
                        </button>
                    )}
                </div>

                <div className="p-4">
                    <button
                        onClick={startNewChat}
                        className="w-full bg-accent-gradient hover:opacity-90 text-white rounded-xl py-3 px-4 flex items-center justify-center gap-2 transition-all font-medium text-lg shadow-lg hover:shadow-glow hover:scale-[1.02] active:scale-[0.98]"
                    >
                        <Plus size={20} />
                        New Chat
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-3 space-y-1 py-2">
                    <div className="text-xs font-semibold text-app-text-muted uppercase tracking-wider px-3 mb-2">History</div>
                    {conversations.map(conv => (
                        <button
                            key={conv.id}
                            onClick={() => loadConversation(conv.id)}
                            className={`w-full text-left p-3 rounded-xl flex items-center gap-3 transition-all group
                        ${activeConversationId === conv.id
                                    ? 'bg-white/10 text-white shadow-inner'
                                    : 'text-app-text-secondary hover:bg-white/5 hover:text-white'}
                    `}
                        >
                            <MessageSquare size={18} className={activeConversationId === conv.id ? 'text-app-accent-glow' : 'text-app-text-muted group-hover:text-white'} />
                            <span className="truncate text-sm font-medium">{conv.title}</span>
                        </button>
                    ))}
                </div>

                <div className="p-4 border-t border-white/5 bg-black/20">
                    <div className="flex items-center gap-3 mb-4 p-2 rounded-xl bg-white/5 border border-white/5">
                        <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-white shrink-0">
                            <User size={20} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-white text-sm font-medium truncate">{user?.user_metadata?.name || 'User'}</p>
                            <p className="text-xs text-app-text-muted truncate">{user?.email}</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <button
                            onClick={() => router.push('/settings')}
                            className="flex items-center justify-center gap-2 p-2 rounded-lg text-app-text-secondary hover:bg-white/10 hover:text-white transition-colors text-sm font-medium"
                        >
                            <Settings size={18} />
                            Settings
                        </button>
                        <button
                            onClick={handleLogout}
                            className="flex items-center justify-center gap-2 p-2 rounded-lg text-app-text-secondary hover:bg-red-500/10 hover:text-red-400 transition-colors text-sm font-medium"
                        >
                            <LogOut size={18} />
                            Logout
                        </button>
                    </div>
                </div>
            </aside>

            {/* Main Chat Area */}
            <main className="flex-1 flex flex-col h-full relative w-full bg-app-bg/50">
                {/* Header (Mobile Only) */}
                <header className="h-[60px] border-b border-white/5 flex items-center px-4 bg-slate-900/80 backdrop-blur-md z-10 sticky top-0 md:hidden">
                    <button onClick={() => setSidebarOpen(true)} className="text-app-text-secondary hover:text-white mr-4">
                        <Menu size={24} />
                    </button>
                    <span className="font-bold text-lg text-white">Walter AI</span>
                </header>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8 pb-48">
                    {messages.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center p-8 opacity-0 animate-[fadeIn_0.8s_ease-out_forwards]">
                            <div className="w-24 h-24 bg-slate-800/50 rounded-full flex items-center justify-center text-app-accent-glow mb-8 shadow-2xl border border-white/5">
                                <MessageSquare size={48} />
                            </div>
                            <h2 className="text-3xl font-bold text-white mb-3 tracking-tight">Hello, I'm Walter!</h2>
                            <p className="text-xl text-app-text-secondary max-w-lg leading-relaxed">
                                I'm here to be your friendly companion. Ask me anything, tell me a story, or just say hello.
                            </p>
                        </div>
                    ) : (
                        messages.map((msg, idx) => (
                            <div
                                key={idx}
                                className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}
                            >
                                <div
                                    className={`
                                max-w-[85%] md:max-w-[70%] p-5 md:p-6 text-lg leading-relaxed shadow-lg backdrop-blur-sm
                                ${msg.role === 'user'
                                            ? 'bg-accent-gradient text-white rounded-2xl rounded-tr-sm border border-transparent'
                                            : 'bg-slate-800/60 text-gray-100 rounded-2xl rounded-tl-sm border border-white/10'}
                            `}
                                >
                                    {msg.role === 'assistant' ? (
                                        <div className="text-gray-100">
                                            <ReactMarkdown
                                                components={{
                                                    h1: ({ node, ...props }) => <h1 className="text-xl font-bold text-white mt-4 mb-2" {...props} />,
                                                    h2: ({ node, ...props }) => <h2 className="text-lg font-bold text-white mt-3 mb-2" {...props} />,
                                                    h3: ({ node, ...props }) => <h3 className="text-base font-bold text-white mt-2 mb-1" {...props} />,
                                                    ul: ({ node, ...props }) => <ul className="list-disc list-inside space-y-1 mb-2 ml-1" {...props} />,
                                                    ol: ({ node, ...props }) => <ol className="list-decimal list-inside space-y-1 mb-2 ml-1" {...props} />,
                                                    li: ({ node, ...props }) => <li className="text-gray-200" {...props} />,
                                                    p: ({ node, ...props }) => <p className="mb-2 last:mb-0 leading-relaxed" {...props} />,
                                                    strong: ({ node, ...props }) => <strong className="font-bold text-white" {...props} />,
                                                    blockquote: ({ node, ...props }) => <blockquote className="border-l-4 border-app-accent pl-4 py-1 my-2 bg-white/5 rounded-r" {...props} />,
                                                    code: ({ node, ...props }) => <code className="bg-black/30 px-1 py-0.5 rounded text-sm font-mono text-app-accent-glow" {...props} />,
                                                }}
                                            >
                                                {msg.content}
                                            </ReactMarkdown>
                                        </div>
                                    ) : (
                                        msg.content
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                    {loading && messages.length > 0 && messages[messages.length - 1].role === 'user' && (
                        <div className="flex justify-start w-full animate-fade-in">
                            <div className="bg-slate-800/60 text-slate-300 px-6 py-4 rounded-2xl rounded-tl-sm border border-white/10 flex items-center gap-2 backdrop-blur-sm">
                                <div className="w-2.5 h-2.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                <div className="w-2.5 h-2.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                <div className="w-2.5 h-2.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                <span className="ml-3 text-lg font-medium text-blue-200">Thinking...</span>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="border-t border-white/5 bg-slate-900/80 backdrop-blur-xl p-4 md:p-6 w-full absolute bottom-0 z-20">
                    <form onSubmit={sendMessage} className="max-w-4xl mx-auto relative flex items-center gap-3">
                        <input
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Type a message to Walter..."
                            className="flex-1 bg-slate-800/50 text-white text-lg px-6 py-4 rounded-full border border-white/10 focus:ring-2 focus:ring-app-accent focus:border-transparent outline-none placeholder:text-slate-500 transition-all shadow-inner"
                            disabled={loading}
                        />
                        <button
                            type="submit"
                            disabled={!input.trim() || loading}
                            className="bg-accent-gradient hover:opacity-90 text-white p-4 rounded-full transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-glow hover:scale-105 active:scale-95"
                        >
                            <Send size={24} />
                        </button>
                    </form>
                </div>
            </main>
        </div>
    );
}
