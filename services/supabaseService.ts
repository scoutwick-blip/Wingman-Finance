
import { createClient } from '@supabase/supabase-js';

// Table schema required in Supabase:
// create table wingman_backups (
//   id text primary key,
//   data jsonb,
//   updated_at timestamp with time zone
// );

export const uploadToCloud = async (url: string, key: string, profileId: string, data: any) => {
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
  try {
    const supabase = createClient(url, key);
    // Just try to select something invalid to check auth, 
    // or just checking if createClient throws isn't enough as it's lazy.
    // We'll try to fetch a non-existent row.
    const { error } = await supabase.from('wingman_backups').select('id').limit(1);
    // If error is 401 or invalid URL, it will show up.
    // If table doesn't exist, it throws error 404 or 400.
    if (error && error.code !== 'PGRST116') { // PGRST116 is 'row not found' which is fine
       // If table missing, that's a specific error to handle
       if (error.message.includes('relation "wingman_backups" does not exist')) {
         throw new Error('Table "wingman_backups" missing. Run SQL script.');
       }
       if (error.code) throw error; 
    }
    return true;
  } catch (e: any) {
    throw e;
  }
}
