import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

// Initialize OpenAI
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// Initialize Supabase Admin (service role preferred for backend, but we use what we have)
// Since we need to verify user based on token, we create a client that validates the token.
// PROPOSAL: Client passes access_token in Authorization header.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function POST(req: Request) {
    try {
        console.log('API Request received');
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            console.error('No auth header');
            return NextResponse.json({ error: 'Unauthorized: No token provided' }, { status: 401 });
        }

        const token = authHeader.replace('Bearer ', '');
        const supabase = createClient(supabaseUrl, supabaseAnonKey, {
            global: { headers: { Authorization: `Bearer ${token}` } },
        });

        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            console.error('Auth error:', authError);
            return NextResponse.json({ error: 'Unauthorized: Invalid token' }, { status: 401 });
        }

        console.log('User authenticated:', user.id);

        const body = await req.json();
        const { message, conversationId } = body;

        if (!message) {
            return NextResponse.json({ error: 'Message is required' }, { status: 400 });
        }

        // 1. Get or Create Conversation
        let currentConversationId = conversationId;
        if (!currentConversationId) {
            console.log('Creating new conversation');
            const { data: conv, error: convError } = await supabase
                .from('conversations')
                .insert({ user_id: user.id, title: message.substring(0, 30) + '...' })
                .select()
                .single();

            if (convError) {
                console.error('Conversation creation error:', convError);
                throw convError;
            }
            currentConversationId = conv.id;
            console.log('Created conversation:', currentConversationId);
        }

        // 2. Save User Message
        console.log('Saving user message');
        const { error: msgError } = await supabase.from('messages').insert({
            conversation_id: currentConversationId,
            role: 'user',
            content: message,
        });
        if (msgError) {
            console.error('Message save error:', msgError);
            throw msgError;
        }

        // 3. Get Conversation History (for context)
        const { data: history } = await supabase
            .from('messages')
            .select('role, content')
            .eq('conversation_id', currentConversationId)
            .order('created_at', { ascending: true })
            .limit(10); // Last 10 messages

        const messages = history?.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })) || [];
        console.log('History fetched, calling OpenAI');

        // 4. Call OpenAI
        const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                {
                    role: 'system', content: `You are Walter, a friendly, patient AI for older adults. 
        
        Guidelines:
        1. Be warm, concise, and helpful. 
        2. Use **Markdown formatting** to make your answers easy to read.
        3. Use **Headings** (##) to organize topics.
        4. Use **Bullet points** for lists.
        5. bold key terms.
        6. Avoid technical jargon unless asked.
        7. If asked, your model is "GPT-4o Mini".`
                },
                ...messages
            ],
            stream: true,
        });

        console.log('OpenAI response received, streaming...');

        // 5. Stream Response & Save Assistant Message (complicated with streaming + saving)
        // For simplicity efficiently, we will stream the response to the client,
        // and the client will need to wait for the full response. 
        // OR we can collect the stream here and save it, but that delays the response.
        // IMPROVEMENT: Use a ReadableStream to stream to client AND collect text to save to DB.

        const encoder = new TextEncoder();
        const decoder = new TextDecoder();

        let fullResponse = '';

        const stream = new ReadableStream({
            async start(controller) {
                try {
                    for await (const chunk of completion) {
                        const content = chunk.choices[0]?.delta?.content || '';
                        if (content) {
                            fullResponse += content;
                            controller.enqueue(encoder.encode(content));
                        }
                    }

                    // Save Assistant Message to DB after stream completes
                    await supabase.from('messages').insert({
                        conversation_id: currentConversationId,
                        role: 'assistant',
                        content: fullResponse,
                    });

                    // Send conversationId header/data if it was new? 
                    // Since we are streaming raw text, we can't easily send JSON meta data.
                    // The client should handle creation of conversation if it didn't exist.
                    // Workaround: Client creates conversation first? No, server should do it.
                    // Actually, if we return just text, how does client know the new conversationId?
                    // We can return a custom header `x-conversation-id`.

                } catch (e) {
                    console.error('Stream error:', e);
                    controller.error(e);
                } finally {
                    controller.close();
                }
            },
        });

        return new NextResponse(stream, {
            headers: {
                'x-conversation-id': currentConversationId,
                'Content-Type': 'text/plain; charset=utf-8',
            }
        });

    } catch (error: any) {
        console.error('Error in chat route:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
