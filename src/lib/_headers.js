import { supabase } from './auth.js';

export const getAuthHeaders = async () => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    return {
      ...(session && { 'Authorization': `Bearer ${session.access_token}` }),
    };
  } catch (error) {
    console.error('Get auth headers error:', error);
    return {};
  }
};

export const getHeaders = async () => {
  const authHeaders = await getAuthHeaders();
  return {
    'Content-Type': 'application/json',
    ...authHeaders,
  };
};
