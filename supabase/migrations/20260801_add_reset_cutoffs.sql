-- Sprint 1 (AUD-001, crítico): reset sem tombstone permitia que um
-- dispositivo B, offline no momento do reset em A, ressuscitasse dados
-- antigos ao reconectar. A união LWW não tem como distinguir "nunca
-- sincronizado" de "apagado por reset", e um INSERT sem linha conflitante
-- sempre tem sucesso, não importa o timestamp que ele carregue.
--
-- Correção: um cutoff de reset por user_id + day_key + domínio, guardado no
-- servidor e usando o relógio do PRÓPRIO SERVIDOR (clock_timestamp()), não o
-- do cliente. Toda escrita condicional passa a rejeitar qualquer
-- updated_at anterior ao cutoff, mesmo quando não existe mais linha
-- conflitante para comparar.

CREATE TABLE mh_reset_cutoffs (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day_key TEXT NOT NULL,
  domain TEXT NOT NULL CHECK (domain IN ('compras', 'rotina')),
  cutoff_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (user_id, day_key, domain)
);

ALTER TABLE mh_reset_cutoffs ENABLE ROW LEVEL SECURITY;

-- Somente leitura direta para o dono. Toda escrita passa por
-- reset_day_domain() (SECURITY DEFINER) — nunca um INSERT/UPDATE direto do
-- cliente, para impedir que o próprio cliente forje ou recue seu cutoff.
CREATE POLICY "Allow read of own reset cutoffs" ON mh_reset_cutoffs
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION reset_day_domain(p_day_key TEXT, p_domain TEXT)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cutoff TIMESTAMPTZ := clock_timestamp();
BEGIN
  IF p_domain NOT IN ('compras', 'rotina') THEN
    RAISE EXCEPTION 'invalid domain: %', p_domain;
  END IF;

  -- Idempotente: repetir o reset nunca move o cutoff pra trás (GREATEST
  -- implícito via WHERE), então um reset duplicado (ex.: reenvio da fila
  -- offline) não reabre a janela de dados já cortados.
  INSERT INTO mh_reset_cutoffs (user_id, day_key, domain, cutoff_at)
  VALUES (auth.uid(), p_day_key, p_domain, v_cutoff)
  ON CONFLICT (user_id, day_key, domain) DO UPDATE
    SET cutoff_at = EXCLUDED.cutoff_at
    WHERE mh_reset_cutoffs.cutoff_at < EXCLUDED.cutoff_at;

  IF p_domain = 'compras' THEN
    DELETE FROM mh_day_items
      WHERE user_id = auth.uid() AND day_key = p_day_key AND updated_at < v_cutoff;
  ELSIF p_domain = 'rotina' THEN
    DELETE FROM mh_rotina_state
      WHERE user_id = auth.uid() AND day_key = p_day_key AND updated_at < v_cutoff;
  END IF;

  RETURN v_cutoff;
END;
$$;

GRANT EXECUTE ON FUNCTION reset_day_domain(TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION get_reset_cutoff(p_day_key TEXT, p_domain TEXT)
RETURNS TIMESTAMPTZ
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT cutoff_at FROM mh_reset_cutoffs
    WHERE user_id = auth.uid() AND day_key = p_day_key AND domain = p_domain;
$$;

GRANT EXECUTE ON FUNCTION get_reset_cutoff(TEXT, TEXT) TO authenticated;

-- Ensina as duas RPCs condicionais existentes a rejeitar qualquer escrita
-- anterior ao cutoff, mesmo sem linha conflitante (o caso que ressuscitava
-- dados: sem linha remota pra comparar, o INSERT simples sempre passava).

CREATE OR REPLACE FUNCTION upsert_day_item_if_newer(
  p_day_key TEXT,
  p_item_id UUID,
  p_checked BOOLEAN,
  p_postponed BOOLEAN,
  p_in_today BOOLEAN,
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
  SELECT cutoff_at INTO v_cutoff FROM mh_reset_cutoffs
    WHERE user_id = p_user_id AND day_key = p_day_key AND domain = 'compras';
  IF v_cutoff IS NOT NULL AND p_updated_at < v_cutoff THEN
    RETURN FALSE;
  END IF;

  INSERT INTO mh_day_items (day_key, item_id, checked, postponed, in_today, updated_at, user_id)
  VALUES (p_day_key, p_item_id, p_checked, p_postponed, p_in_today, p_updated_at, p_user_id)
  ON CONFLICT (user_id, day_key, item_id) DO UPDATE SET
    checked = EXCLUDED.checked,
    postponed = EXCLUDED.postponed,
    in_today = EXCLUDED.in_today,
    updated_at = EXCLUDED.updated_at
  WHERE mh_day_items.updated_at < EXCLUDED.updated_at
  RETURNING TRUE INTO applied;

  RETURN COALESCE(applied, FALSE);
END;
$$;

GRANT EXECUTE ON FUNCTION upsert_day_item_if_newer(TEXT,UUID,BOOLEAN,BOOLEAN,BOOLEAN,TIMESTAMPTZ,UUID) TO authenticated;

CREATE OR REPLACE FUNCTION upsert_rotina_step_if_newer(
  p_day_key TEXT,
  p_step_id TEXT,
  p_done BOOLEAN,
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
  SELECT cutoff_at INTO v_cutoff FROM mh_reset_cutoffs
    WHERE user_id = p_user_id AND day_key = p_day_key AND domain = 'rotina';
  IF v_cutoff IS NOT NULL AND p_updated_at < v_cutoff THEN
    RETURN FALSE;
  END IF;

  INSERT INTO mh_rotina_state (day_key, step_id, done, updated_at, user_id)
  VALUES (p_day_key, p_step_id, p_done, p_updated_at, p_user_id)
  ON CONFLICT (user_id, day_key, step_id) DO UPDATE SET
    done = EXCLUDED.done,
    updated_at = EXCLUDED.updated_at
  WHERE mh_rotina_state.updated_at < EXCLUDED.updated_at
  RETURNING TRUE INTO applied;

  RETURN COALESCE(applied, FALSE);
END;
$$;

GRANT EXECUTE ON FUNCTION upsert_rotina_step_if_newer(TEXT,TEXT,BOOLEAN,TIMESTAMPTZ,UUID) TO authenticated;
