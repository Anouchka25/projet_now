import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://pdsiyzpqzqwkqytsitxe.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBkc2l5enBxenF3a3F5dHNpdHhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzgyNjA2NTAsImV4cCI6MjA1MzgzNjY1MH0.--I0QRj8RZh7jTV9f5m_Kk66XiCVtToOZJKAVP2ZqBc';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});