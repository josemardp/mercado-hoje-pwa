-- Sincronização em tempo real entre aparelhos.
--
-- O app só puxava novidades ao ganhar foco (throttle de 30s) e ao recarregar;
-- um PC aberto ficava minutos atrás do celular. A partir desta migration as
-- tabelas do app entram na publicação supabase_realtime e o cliente passa a
-- receber cada gravação do outro aparelho na hora. O polling de 15s no
-- cliente continua como rede de segurança (canal caído, rede instável,
-- publicação desfeita).
--
-- REPLICA IDENTITY FULL: sem isso o payload de DELETE carrega só a chave
-- primária; com o filtro user_id=eq.<uuid> no canal, esses eventos seriam
-- descartados. Custo desprezível para o volume destas tabelas.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'mh_day_items'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.mh_day_items';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'mh_items'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.mh_items';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'mh_rotina_state'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.mh_rotina_state';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'mh_agenda_tasks'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.mh_agenda_tasks';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'mh_rotina_steps'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.mh_rotina_steps';
  END IF;
END
$$;

ALTER TABLE public.mh_day_items REPLICA IDENTITY FULL;
ALTER TABLE public.mh_items REPLICA IDENTITY FULL;
ALTER TABLE public.mh_rotina_state REPLICA IDENTITY FULL;
ALTER TABLE public.mh_agenda_tasks REPLICA IDENTITY FULL;
ALTER TABLE public.mh_rotina_steps REPLICA IDENTITY FULL;
