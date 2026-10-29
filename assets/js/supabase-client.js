// Mesmo projeto Supabase do POR DENTRO APP (ver assets/js/supabase-client.js lá) —
// a anonKey é pública por design; a segurança real vem do RLS e das funções
// security definer (db/crm-fase1.sql no app). Usado aqui só para chamar
// capturar_lead() e enviar o link de acesso (signInWithOtp) direto do funil.
export const SUPABASE_CONFIG = {
  url: 'https://hslhpktfgxwfvljvsxkj.supabase.co',
  anonKey: 'sb_publishable_nYVeQ3hGiMCGA0IzYqYeyQ_H9VcEXni'
};

// Versão exata, nunca @2 (a mesma do app): uma versão nova não pode derrubar o login do CRM sem ninguém testar.
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0/+esm';

export const supabase = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
