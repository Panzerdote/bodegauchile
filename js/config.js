// ============================================
// CONFIGURACIÓN DE SUPABASE
// ============================================
// Reemplaza con tus datos reales de Supabase
const SUPABASE_URL = 'https://senktvcsnfgwrdbfwzmx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNlbmt0dmNzbmZnd3JkYmZ3em14Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTAyNDg3NiwiZXhwIjoyMTAwNjAwODc2fQ.xCJ4ZBtWEFpcGu46c2_KBzBzbdOIOc7Y6ZFIkdR0yUE';

// Crear cliente de Supabase
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Constantes del sistema
const CONFIG = {
    porcentajeCritico: 20,
    diasVencimiento: 30,
    appName: 'Bodega UChile',
    version: '3.0.0'
};
