import { supabase } from './auth.js';

let cachedToken = null;

export const getSupabaseToken = async () => {
  try {
    if (cachedToken) return cachedToken;

    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      cachedToken = session.access_token;
      return cachedToken;
    }
    return null;
  } catch (error) {
    console.error('Get supabase token error:', error);
    return null;
  }
};

export const setSupabaseToken = (token) => {
  cachedToken = token;
};

export const clearSupabaseToken = () => {
  cachedToken = null;
};
