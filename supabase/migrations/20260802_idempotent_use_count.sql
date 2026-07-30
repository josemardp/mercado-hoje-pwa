-- Sprint 2 (AUD-003): ao marcar um item, o app disparava um incremento
-- atômico de use_count E enfileirava uma escrita absoluta ("use_count = N")
-- pra mesma ação. Se a fila processasse depois do incremento responder, o
-- valor absoluto (calculado a partir de uma leitura local possivelmente
-- desatualizada) podia sobrescrever o incremento — contador some ou soma
-- duas vezes, dependendo da ordem.
--
-- Correção: uma única estratégia (incremento atômico, sempre enfileirado e
-- retentado como qualquer outra escrita, nunca mais disparado direto e
-- esquecido) e um operation_id opcional pra idempotência — um retry do
-- cliente depois de uma resposta ambígua (rede caiu depois do servidor
-- aplicar, antes do cliente confirmar) não aplica o incremento de novo.

CREATE TABLE mh_processed_operations (
  operation_id UUID PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Sem policies: nenhum acesso direto do cliente a essa tabela. Só
-- increment_use_count (SECURITY DEFINER) a toca.
ALTER TABLE mh_processed_operations ENABLE ROW LEVEL SECURITY;

DROP FUNCTION IF EXISTS increment_use_count(UUID, INTEGER);

CREATE OR REPLACE FUNCTION increment_use_count(
  p_item_id UUID,
  p_increment INTEGER DEFAULT 1,
  p_operation_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_rows INTEGER;
BEGIN
  IF p_operation_id IS NOT NULL THEN
    INSERT INTO mh_processed_operations (operation_id) VALUES (p_operation_id)
      ON CONFLICT DO NOTHING;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows = 0 THEN
      -- Já processado antes (retry depois de uma resposta ambígua) — não
      -- aplica o incremento de novo, mas ainda reporta sucesso pro cliente
      -- parar de tentar.
      RETURN TRUE;
    END IF;
  END IF;

  UPDATE mh_items
  SET use_count = COALESCE(use_count, 0) + p_increment,
      last_used = (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
      updated_at = NOW()
  WHERE id = p_item_id AND user_id = auth.uid();

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION increment_use_count(UUID, INTEGER, UUID) TO anon;
GRANT EXECUTE ON FUNCTION increment_use_count(UUID, INTEGER, UUID) TO authenticated;
