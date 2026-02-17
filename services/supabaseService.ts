
import { createClient, SupabaseClient, Session, User } from '@supabase/supabase-js';

// Table schema required in Supabase:
// create table wingman_backups (
//   id text primary key,
//   user_id text,
//   data jsonb,
//   updated_at timestamp with time zone
// );
//
// For RLS (Row Level Security), run:
// alter table wingman_backups enable row level security;
// create policy "Users can manage their own data" on wingman_backups
//   for all using (auth.uid()::text = user_id);

let supabaseInstance: SupabaseClient | null = null;

export const initSupabase = (url: string, key: string): SupabaseClient => {
  if (!supabaseInstance || supabaseInstance.supabaseUrl !== url) {
    supabaseInstance = createClient(url, key);
  }
  return supabaseInstance;
};

export const getSupabase = (): SupabaseClient | null => {
  return supabaseInstance;
};

export const uploadToCloud = async (url: string, key: string, profileId: string, data: Record<string, unknown>) => {
  const supabase = createClient(url, key);
  
  // Upsert the data (Insert or Update if exists)
  const { error } = await supabase
    .from('wingman_backups')
    .upsert({ 
      id: profileId, 
      data: data, 
      updated_at: new Date().toISOString() 
    });
    
  if (error) throw error;
  return true;
};

export const downloadFromCloud = async (url: string, key: string, profileId: string) => {
  const supabase = createClient(url, key);
  
  const { data, error } = await supabase
    .from('wingman_backups')
    .select('data, updated_at')
    .eq('id', profileId)
    .single();

  if (error) throw error;
  
  if (!data) return null;
  return {
    content: data.data,
    updatedAt: data.updated_at
  };
};

export const testConnection = async (url: string, key: string) => {
  const supabase = createClient(url, key);
  const { error } = await supabase.from('wingman_backups').select('id').limit(1);
  if (error && error.code !== 'PGRST116') { // PGRST116 is 'row not found' which is fine
     if (error.message.includes('relation "wingman_backups" does not exist')) {
       throw new Error('Table "wingman_backups" missing. Run SQL script.');
     }
     if (error.code) throw error;
  }
  return true;
}

// ===== AUTHENTICATION FUNCTIONS =====

export const signUp = async (email: string, password: string) => {
  if (!supabaseInstance) throw new Error('Supabase not initialized');

  const { data, error } = await supabaseInstance.auth.signUp({
    email,
    password,
  });

  if (error) throw error;
  return data;
};

export const signIn = async (email: string, password: string) => {
  if (!supabaseInstance) throw new Error('Supabase not initialized');

  const { data, error } = await supabaseInstance.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;
  return data;
};

export const signInWithOAuth = async (provider: 'google' | 'github' | 'facebook') => {
  if (!supabaseInstance) throw new Error('Supabase not initialized');

  const { data, error } = await supabaseInstance.auth.signInWithOAuth({
    provider,
    options: {
      // Let Supabase handle the redirect automatically
      // The OAuth providers should use the Supabase callback URL:
      // https://YOUR-PROJECT.supabase.co/auth/v1/callback
      redirectTo: `${window.location.origin}`
    }
  });

  if (error) throw error;
  return data;
};

export const signOut = async () => {
  if (!supabaseInstance) throw new Error('Supabase not initialized');

  const { error } = await supabaseInstance.auth.signOut();
  if (error) throw error;
};

export const getCurrentUser = async (): Promise<User | null> => {
  if (!supabaseInstance) return null;

  const { data: { user } } = await supabaseInstance.auth.getUser();
  return user;
};

export const getCurrentSession = async (): Promise<Session | null> => {
  if (!supabaseInstance) return null;

  const { data: { session } } = await supabaseInstance.auth.getSession();
  return session;
};

export const onAuthStateChange = (callback: (session: Session | null, user: User | null) => void) => {
  if (!supabaseInstance) return { data: { subscription: { unsubscribe: () => {} } } };

  return supabaseInstance.auth.onAuthStateChange((_event, session) => {
    callback(session, session?.user ?? null);
  });
};

// Upload data with authenticated user
export const uploadAuthData = async (profileId: string, data: Record<string, unknown>) => {
  if (!supabaseInstance) throw new Error('Supabase not initialized');

  const user = await getCurrentUser();
  if (!user) throw new Error('User not authenticated');

  const { error } = await supabaseInstance
    .from('wingman_backups')
    .upsert({
      id: profileId,
      user_id: user.id,
      data: data,
      updated_at: new Date().toISOString()
    });

  if (error) throw error;
  return true;
};

// Download data with authenticated user
export const downloadAuthData = async (profileId: string) => {
  if (!supabaseInstance) throw new Error('Supabase not initialized');

  const user = await getCurrentUser();
  if (!user) throw new Error('User not authenticated');

  const { data, error } = await supabaseInstance
    .from('wingman_backups')
    .select('data, updated_at')
    .eq('id', profileId)
    .eq('user_id', user.id)
    .single();

  if (error && error.code !== 'PGRST116') throw error;

  if (!data) return null;
  return {
    content: data.data,
    updatedAt: data.updated_at
  };
};

// Fetch all profiles for the authenticated user
export const fetchUserProfiles = async () => {
  if (!supabaseInstance) throw new Error('Supabase not initialized');

  const user = await getCurrentUser();
  if (!user) throw new Error('User not authenticated');

  const { data, error } = await supabaseInstance
    .from('wingman_backups')
    .select('id, data, updated_at')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false });

  if (error) throw error;

  return data || [];
};

// Delete a profile's data
export const deleteAuthData = async (profileId: string) => {
  if (!supabaseInstance) throw new Error('Supabase not initialized');

  const user = await getCurrentUser();
  if (!user) throw new Error('User not authenticated');

  const { error } = await supabaseInstance
    .from('wingman_backups')
    .delete()
    .eq('id', profileId)
    .eq('user_id', user.id);

  if (error) throw error;
  return true;
};

export const resetPassword = async (email: string) => {
  if (!supabaseInstance) throw new Error('Supabase not initialized');

  const { error } = await supabaseInstance.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`
  });

  if (error) throw error;
};
