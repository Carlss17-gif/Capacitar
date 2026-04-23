/* ============================================================
   supabase.js — Conexión a Supabase
   Carl's Jr. Capacitación
   ============================================================ */

const SUPABASE_URL = "https://iuvyyukhikxvncgvbpbz.supabase.co";
const SUPABASE_KEY = "sb_publishable_WbR0KXyDT_ybCFPc2qbpFA_zCcuJMB8";

const mysupabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
