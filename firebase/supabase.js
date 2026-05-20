// Supabase client — used only for Storage (file uploads).
// Firestore remains the source of truth for project data; we just store
// the resulting public URL in each project's `links` array.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://wtkasqevyzzsrewthvio.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_ScbnoCYr22lXzpep5loy7A_R0PWXISt";

export const SUPABASE_BUCKET = "default";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false },
});
