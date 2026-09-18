-- Migration: 20260805000000_fix_audit_regressions.sql
-- Fixes regressions identified in technical audit:
-- 1. S2-01: Restore reset cutoff check (AUD-001) in upsert_day_item_if_newer (overwritten by 20260803_add_day_item_qty.sql).
-- 2. S2-02: Secure increment_use_count with SET search_path = public and revoke from anon.
-- 3. S2-03: Prevent idempotency table poisoning: only record operation_id after UPDATE succeeds.
-- 4. S4-03: Drop obsolete update_item_use_count_if_newer function.

-- ============================================================================
-- 1. CORREÇÃO S2-01: Restaurar v_cutoff em upsert_day_item_if_newer (AUD-001)
-- ============================================================================
CREATE OR REPLACE FUNCTION upsert_day_item_if_newer(
  p_day_key TEXT,
  p_item_id UUID,
  p_checked BOOLEAN,
  p_postponed BOOLEAN,
  p_in_today BOOLEAN,
  p_qty INTEGER,
  p_updated_at TIMESTAMPTZ,
  p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  applied BOOLEAN;
  v_cutoff TIMESTAMPTZ;
BEGIN
  -- AUD-001: rejeita escritas anteriores ao cutoff de reset do dia/domínio
  SELECT cutoff_at INTO v_cutoff FROM mh_reset_cutoffs
    WHERE user_id = p_user_id AND day_key = p_day_key AND domain = 'compras';
  IF v_cutoff IS NOT NULL AND p_updated_at < v_cutoff THEN
    RETURN FALSE;
  END IF;

  INSERT INTO mh_day_items (day_key, item_id, checked, postponed, in_today, qty, updated_at, user_id)
  VALUES (p_day_key, p_item_id, p_checked, p_postponed, p_in_today, p_qty, p_updated_at, p_user_id)
  ON CONFLICT (user_id, day_key, item_id) DO UPDATE SET
    checked = EXCLUDED.checked,
    postponed = EXCLUDED.postponed,
    in_today = EXCLUDED.in_today,
    qty = EXCLUDED.qty,
    updated_at = EXCLUDED.updated_at
  WHERE mh_day_items.updated_at < EXCLUDED.updated_at
  RETURNING TRUE INTO applied;

  RETURN COALESCE(applied, FALSE);
END;
$$;

-- PUBLIC tinha EXECUTE por padrão; anon herda de PUBLIC, então revogar só de anon não basta
REVOKE EXECUTE ON FUNCTION upsert_day_item_if_newer(TEXT,UUID,BOOLEAN,BOOLEAN,BOOLEAN,INTEGER,TIMESTAMPTZ,UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION upsert_day_item_if_newer(TEXT,UUID,BOOLEAN,BOOLEAN,BOOLEAN,INTEGER,TIMESTAMPTZ,UUID) TO authenticated, service_role;

-- ============================================================================
-- 2. CORREÇÃO S2-02 e S2-03: Blindar increment_use_count e Idempotência
-- ============================================================================
REVOKE EXECUTE ON FUNCTION increment_use_count(UUID, INTEGER, UUID) FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION increment_use_count(
  p_item_id UUID,
  p_increment INTEGER DEFAULT 1,
  p_operation_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Se foi passado operation_id, verificar se já foi processado com sucesso
  IF p_operation_id IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM mh_processed_operations WHERE operation_id = p_operation_id) THEN
      RETURN TRUE;
    END IF;
  END IF;

  -- Só autenticado pode alterar seus próprios itens
  UPDATE mh_items
  SET use_count = COALESCE(use_count, 0) + p_increment,
      last_used = (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
      updated_at = NOW()
  WHERE id = p_item_id AND user_id = auth.uid();

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- Registra a operação com sucesso SOMENTE se o update surtiu efeito
  IF p_operation_id IS NOT NULL THEN
    INSERT INTO mh_processed_operations (operation_id)
    VALUES (p_operation_id)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION increment_use_count(UUID, INTEGER, UUID) TO authenticated, service_role;

-- ============================================================================
-- 3. CORREÇÃO S4-03: Remover RPC obsoleta
-- ============================================================================
REVOKE EXECUTE ON FUNCTION update_item_use_count_if_newer(UUID,UUID,INTEGER,BIGINT,TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
DROP FUNCTION IF EXISTS update_item_use_count_if_newer(UUID,UUID,INTEGER,BIGINT,TIMESTAMPTZ);
