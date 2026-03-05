import { projectId, publicAnonKey } from '/utils/supabase/info';
import { TimelineEntry, Message } from './types';

const BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-61781242`;

const headers = {
  'Authorization': `Bearer ${publicAnonKey}`,
  'Content-Type': 'application/json'
};

export async function fetchThoughts(): Promise<TimelineEntry[]> {
  try {
    const res = await fetch(`${BASE_URL}/thoughts`, { headers });
    if (!res.ok) throw new Error('Failed to fetch thoughts');
    const data = await res.json();
    return data.map((d: any) => ({
      ...d,
      timestamp: new Date(d.timestamp)
    }));
  } catch (e) {
    console.error(e);
    return [];
  }
}

export async function saveThought(entry: TimelineEntry): Promise<void> {
  try {
    await fetch(`${BASE_URL}/thoughts`, {
      method: 'POST',
      headers,
      body: JSON.stringify(entry)
    });
  } catch (e) {
    console.error(e);
  }
}

export async function fetchMessages(): Promise<Message[]> {
  try {
    const res = await fetch(`${BASE_URL}/messages`, { headers });
    if (!res.ok) throw new Error('Failed to fetch messages');
    const data = await res.json();
    return data.map((d: any) => ({
      ...d,
      timestamp: new Date(d.timestamp)
    })).sort((a: Message, b: Message) => a.timestamp.getTime() - b.timestamp.getTime());
  } catch (e) {
    console.error(e);
    return [];
  }
}

export async function saveMessage(msg: Message): Promise<void> {
  try {
    await fetch(`${BASE_URL}/messages`, {
      method: 'POST',
      headers,
      body: JSON.stringify(msg)
    });
  } catch (e) {
    console.error(e);
  }
}
