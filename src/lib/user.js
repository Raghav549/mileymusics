import { supabase } from './auth.js';

export const getAppUserId = async () => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.user?.id || null;
  } catch (error) {
    console.error('Get app user ID error:', error);
    return null;
  }
};

export const getAnonymousId = () => {
  // Get or create anonymous ID from localStorage
  let anonId = localStorage.getItem('mileymusics_anon_id');
  if (!anonId) {
    anonId = `anon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('mileymusics_anon_id', anonId);
  }
  return anonId;
};
