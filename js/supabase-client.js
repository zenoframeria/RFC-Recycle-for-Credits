// ขยะแลกแต้ม — Supabase client setup (Phase 2 backend).
// Requires the Supabase CDN script (window.supabase) to be loaded first.

const SUPABASE_URL = 'https://dhnufkyqqcgnbedbbudu.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_NGRqinnsNFLt8TGsgWyvMA_-3XQjOQC';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
