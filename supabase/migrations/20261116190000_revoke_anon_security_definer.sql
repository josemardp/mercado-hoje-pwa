-- 16/11/2026: tira de quem nao esta logado a execucao das funcoes SECURITY DEFINER.
-- Origem: aviso de seguranca do Supabase (anon_security_definer_function_executable), T-ST-10 da Gestao PJP.
-- Aplicada em producao em 16/11/2026 (projeto do SecretarioTask, que este app divide).
-- set_secret_token e app.has_secret_token nao tem chamador em codigo nem em politica: ficam so para logado.
-- Reversao: grant execute on function ... to anon;

revoke execute on function public.reset_day_domain(text, text) from anon, public;
revoke execute on function public.get_reset_cutoff(text, text) from anon, public;
revoke execute on function public.set_secret_token(text) from anon, public;
revoke execute on function app.has_secret_token(text) from anon, public;
grant execute on function public.reset_day_domain(text, text) to authenticated, service_role;
grant execute on function public.get_reset_cutoff(text, text) to authenticated, service_role;
grant execute on function public.set_secret_token(text) to authenticated, service_role;
grant execute on function app.has_secret_token(text) to authenticated, service_role;
