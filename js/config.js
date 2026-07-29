const SUPABASE_URL = 'https://senktvcsnfgwrdbfwzmx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNlbmt0dmNzbmZnd3JkYmZ3em14Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUwMjQ4NzYsImV4cCI6MjEwMDYwMDg3Nn0.dfIul1c2rU0xfW78gluIncu4cTR7X43jJPH-Ru_Kiv4';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const CONFIG = {
    porcentajeCritico: 20,
    diasVencimiento: 30,
    appName: 'Bodega CEHAQ',
    version: '4.5.0'
};
