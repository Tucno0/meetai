import 'server-only';
import { StreamChat } from 'stream-chat';

// Initialize the Stream Chat client with your API key and secret
// Ensure that the environment variables are set correctly

export const streamChat = StreamChat.getInstance(
  process.env.NEXT_PUBLIC_STREAM_CHAT_API_KEY!,
  process.env.STREAM_CHAT_API_SECRET!
);
