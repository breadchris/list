import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/list/SupabaseClient';
import { RealtimeChannel } from '@supabase/supabase-js';

export interface ChatMessage {
  id: string;
  content: string;
  user: {
    name: string;
  };
  created_at: string;
}

export function useRealtimeChat(roomName: string, username: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    const channel = supabase
      .channel(`chat:${roomName}`, {
        config: {
          broadcast: { self: true }
        }
      })
      .on('broadcast', { event: 'message' }, (payload: any) => {
        setMessages((prev) => [...prev, payload.payload.message]);
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [roomName]);

  const sendMessage = async (content: string) => {
    if (!channelRef.current) {
      console.error('Chat channel not initialized');
      return;
    }

    const message: ChatMessage = {
      id: crypto.randomUUID(),
      content,
      user: { name: username },
      created_at: new Date().toISOString(),
    };

    await channelRef.current.send({
      type: 'broadcast',
      event: 'message',
      payload: { message },
    });
  };

  return { messages, sendMessage };
}
