// ============================================
// CONFIGURACIÓN DE SUPABASE
// ============================================
// Reemplaza con tus datos reales de Supabase
const SUPABASE_URL = 'https://TU_PROYECTO.supabase.co';
const SUPABASE_ANON_KEY = 'TU_ANON_KEY';

// Crear cliente de Supabase
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Constantes del sistema
const CONFIG = {
    porcentajeCritico: 20,
    diasVencimiento: 30,
    appName: 'Bodega UChile',
    version: '3.0.0'
};
