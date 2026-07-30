import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import type { useRotinaState } from './lib/useRotinaState';
import type { useAgendaState } from './lib/useAgendaState';
import { ROTINA_STEPS, type RotinaStep } from './lib/rotinaSteps';
import { getSkyPresetForStep, getAmbientSkyPreset, type SkyPreset } from './lib/rotinaSky';
import { formatDateBR, getTodayKey } from './lib/categories';
import AgendaPlanner from './AgendaPlanner';
import './rotinaStyles.css';

const ARC_PATH_D = 'M14,66 Q160,-14 306,14';
const STAR_POSITIONS = [
  { x: 40, y: 18, r: 1.4 },
  { x: 90, y: -2, r: 1.1 },
  { x: 150, y: -10, r: 1.6 },
  { x: 220, y: -4, r: 1.2 },
  { x: 280, y: 20, r: 1.3 },
];

function greetingText(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia, Josemar';
  if (h < 18) return 'Boa tarde, Josemar';
  return 'Boa noite, Josemar';
}

function firstIncomplete(done: Record<string, boolean>, fromIndex: number): number {
  for (let i = 0; i < ROTINA_STEPS.length; i++) {
    const idx = (fromIndex + i) % ROTINA_STEPS.length;
    if (!done[ROTINA_STEPS[idx].id]) return idx;
  }
  return -1;
}

// Takes the useRotinaState() result as props (called once in App.tsx,
// alongside useDayState) rather than calling the hook itself here — a
// second independent instance would mean two Dexie queries, two 30s
// day-transition timers and two online listeners for the same state.
type RotinaTabProps = ReturnType<typeof useRotinaState> & {
  agenda: ReturnType<typeof useAgendaState>;
};

export default function RotinaTab({
  done, loading, syncStatus, toggleStep, resetToday,
  stuckSyncCount, retryStuckEntries, agenda,
}: RotinaTabProps) {
  const [mode, setModeState] = useState<'fixa' | 'agenda'>('fixa');
  // `useRotinaState` runs unconditionally in App.tsx regardless of which tab
  // is active, so by the time this component actually mounts (user taps the
  // Rotina tab), `loading` may have already settled — there's no live
  // true→false transition left to catch. Deriving focus from `done` every
  // render (until the user explicitly navigates) sidesteps that entirely,
  // instead of trying to detect an edge that may have already passed.
  const [manualFocus, setManualFocus] = useState<number | null>(null);
  const [cardSwap, setCardSwap] = useState(false);
  const [resetArmed, setResetArmed] = useState(false);
  const [retryingStuck, setRetryingStuck] = useState(false);
  const [sparkles, setSparkles] = useState<{ id: number; left: number; delay: number; emoji: string }[]>([]);

  // AUD-010: resetArmed used to be shared across both modes — arming the
  // confirmation in Agenda, then switching to Rotina fixa, would let the
  // next tap confirm the WRONG action (reiniciar rotina instead of limpar
  // agenda, or vice versa). Switching modes now always cancels any armed
  // confirmation.
  const setMode = useCallback((next: 'fixa' | 'agenda') => {
    setResetArmed(false);
    setModeState(next);
  }, []);

  const initialPreset = useMemo(() => getSkyPresetForStep(ROTINA_STEPS[0]), []);
  const [bgState, setBgState] = useState<{ front: 'a' | 'b'; a: SkyPreset; b: SkyPreset }>({
    front: 'a',
    a: initialPreset,
    b: initialPreset,
  });

  const trackPathRef = useRef<SVGPathElement>(null);
  const [pathLen, setPathLen] = useState(0);

  useEffect(() => {
    if (trackPathRef.current) setPathLen(trackPathRef.current.getTotalLength());
  }, []);

  // Forces a periodic re-render in Agenda mode so the ambient sky (real
  // clock, see targetPreset below) actually drifts over time even if you
  // just leave the tab open without touching anything.
  const [, forceAmbientTick] = useState(0);
  useEffect(() => {
    if (mode !== 'agenda') return;
    const interval = setInterval(() => forceAmbientTick(t => t + 1), 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [mode]);

  const doneCount = useMemo(() => ROTINA_STEPS.filter(s => done[s.id]).length, [done]);
  const totalCount = ROTINA_STEPS.length;
  const allDone = doneCount === totalCount;
  const progress = totalCount ? doneCount / totalCount : 0;

  // Follows the first not-done step automatically until the user explicitly
  // navigates (a dot click or completing a step advances manualFocus) —
  // recomputed from `done` every render, so it's always correct regardless
  // of when this component happens to mount relative to the data loading.
  const autoFocus = useMemo(() => {
    const next = firstIncomplete(done, 0);
    return next === -1 ? 0 : next;
  }, [done]);
  const focus = manualFocus !== null ? manualFocus : autoFocus;

  // Sky follows the focused step's own tag first; falls back to the real
  // clock when there's no step to focus (celebration screen) — and in
  // Agenda mode, always the real clock, since every Agenda task already
  // carries its own real scheduled time, unlike the fixed routine's
  // abstract per-step period tags.
  const currentStep: RotinaStep | undefined = ROTINA_STEPS[focus];
  const targetPreset =
    mode === 'agenda' || allDone || !currentStep
      ? getAmbientSkyPreset()
      : getSkyPresetForStep(currentStep);

  // Crossfade the background as targetPreset changes — "adjust state when a
  // value changes", done during render (React's sanctioned pattern for
  // this: https://react.dev/learn/you-might-not-need-an-effect) instead of
  // a useEffect, comparing against the previous render's value.
  const [prevTargetKey, setPrevTargetKey] = useState(targetPreset.key);
  if (targetPreset.key !== prevTargetKey) {
    setPrevTargetKey(targetPreset.key);
    setBgState(prev => {
      const nextFront = prev.front === 'a' ? 'b' : 'a';
      return prev.front === 'a'
        ? { front: nextFront, a: prev.a, b: targetPreset }
        : { front: nextFront, a: targetPreset, b: prev.b };
    });
  }

  // Reading an SVG ref's geometry must happen post-render (an effect), not
  // during render (e.g. inside useMemo) — refs aren't guaranteed stable/set
  // yet while rendering is in progress.
  const [sunPoint, setSunPoint] = useState({ x: 14, y: 66 });
  useEffect(() => {
    if (!trackPathRef.current || pathLen === 0) return;
    const p = trackPathRef.current.getPointAtLength(progress * pathLen);
    setSunPoint({ x: p.x, y: p.y });
  }, [progress, pathLen]);

  const burstSparkles = useCallback(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const emojis = ['✨', '🌟', '⭐', '🎉'];
    const next = Array.from({ length: 10 }).map((_, i) => ({
      id: Date.now() + i,
      left: Math.random() * 220 - 110,
      delay: Math.random() * 1.2,
      emoji: emojis[i % emojis.length],
    }));
    setSparkles(next);
    setTimeout(() => setSparkles([]), 3000);
  }, []);

  const handleConclude = useCallback(async () => {
    if (!currentStep) return;
    const wasDone = !!done[currentStep.id];
    // Sparkles react to the specific action of finishing the LAST step,
    // not to a generic "allDone changed" effect — computed here since
    // `done` won't reflect this toggle until the next render.
    const willCompleteAll = !wasDone && doneCount + 1 === totalCount;
    await toggleStep(currentStep.id);
    if (willCompleteAll) burstSparkles();
    if (!wasDone) {
      setCardSwap(true);
      setTimeout(() => {
        const next = firstIncomplete({ ...done, [currentStep.id]: true }, focus + 1);
        setManualFocus(next === -1 ? focus : next);
        setCardSwap(false);
      }, 180);
    }
  }, [currentStep, done, toggleStep, doneCount, totalCount, burstSparkles, focus]);

  const handleDotClick = useCallback((i: number) => {
    setCardSwap(true);
    setTimeout(() => {
      setManualFocus(i);
      setCardSwap(false);
    }, 180);
  }, []);

  const handleResetClick = useCallback(() => {
    if (!resetArmed) {
      setResetArmed(true);
      setTimeout(() => setResetArmed(false), 2600);
    } else {
      if (mode === 'agenda') {
        agenda.clearAll();
      } else {
        resetToday();
        setManualFocus(null);
      }
      setResetArmed(false);
    }
  }, [resetArmed, resetToday, mode, agenda]);

  const handleRetryStuck = useCallback(async () => {
    setRetryingStuck(true);
    try { await retryStuckEntries(); } finally { setRetryingStuck(false); }
  }, [retryStuckEntries]);

  const dateStr = formatDateBR(getTodayKey());

  return (
    <div className="rotina-tab">
      <div
        className={`rotina-bg-layer${bgState.front === 'a' ? ' rotina-bg-front' : ''}`}
        style={{ background: `linear-gradient(165deg, ${bgState.a.gradientFrom}, ${bgState.a.gradientTo})` }}
      />
      <div
        className={`rotina-bg-layer${bgState.front === 'b' ? ' rotina-bg-front' : ''}`}
        style={{ background: `linear-gradient(165deg, ${bgState.b.gradientFrom}, ${bgState.b.gradientTo})` }}
      />

      <div className="rotina-shell">
        <header className="rotina-header">
          <div className="rotina-top-row">
            <div>
              <div className="rotina-greeting">{greetingText()}</div>
              <div className="rotina-date">{dateStr}</div>
              {syncStatus !== 'idle' && (
                <div className="rotina-sync-indicator" role="status" aria-live="polite">
                  {syncStatus === 'syncing' && '🔄 salvando...'}
                  {syncStatus === 'synced' && '✅ salvo'}
                  {syncStatus === 'error' && '⚠️ erro sync'}
                </div>
              )}
            </div>
            <button
              className={`rotina-reset-btn${resetArmed ? ' rotina-confirming' : ''}`}
              onClick={handleResetClick}
              title={mode === 'agenda' ? 'Limpar agenda' : 'Reiniciar rotina'}
              aria-label={
                resetArmed
                  ? `Confirmar ${mode === 'agenda' ? 'limpeza da agenda' : 'reinício da rotina'}`
                  : mode === 'agenda' ? 'Limpar agenda' : 'Reiniciar rotina'
              }
            >
              {resetArmed ? '✓' : '↺'}
            </button>
          </div>

          <div
            className="agenda-mode-toggle rotina-mode-toggle"
            role="tablist"
            aria-label="Modo da Rotina"
            onKeyDown={e => {
              if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' && e.key !== 'Home' && e.key !== 'End') return;
              e.preventDefault();
              setMode(mode === 'fixa' ? 'agenda' : 'fixa');
              (e.currentTarget.querySelector(`[aria-selected="false"]`) as HTMLButtonElement | null)?.focus();
            }}
          >
            <button
              role="tab"
              id="rotina-mode-tab-fixa"
              aria-selected={mode === 'fixa'}
              aria-controls="rotina-mode-panel"
              tabIndex={mode === 'fixa' ? 0 : -1}
              className={mode === 'fixa' ? 'active' : ''}
              onClick={() => setMode('fixa')}
            >
              Rotina fixa
            </button>
            <button
              role="tab"
              id="rotina-mode-tab-agenda"
              aria-selected={mode === 'agenda'}
              aria-controls="rotina-mode-panel"
              tabIndex={mode === 'agenda' ? 0 : -1}
              className={mode === 'agenda' ? 'active' : ''}
              onClick={() => setMode('agenda')}
            >
              Agenda
            </button>
          </div>

          {stuckSyncCount > 0 && (
            <div className="rotina-stuck-sync-banner" role="alert">
              <span>
                ⚠️ {stuckSyncCount} {stuckSyncCount === 1 ? 'alteração não sincronizou' : 'alterações não sincronizaram'}.
              </span>
              <button className="rotina-stuck-sync-retry-btn" onClick={handleRetryStuck} disabled={retryingStuck}>
                {retryingStuck ? 'Tentando...' : 'Tentar de novo'}
              </button>
            </div>
          )}

          <div className="rotina-arc-wrap">
            <svg viewBox="0 0 320 80">
              <path ref={trackPathRef} className="rotina-track-path" d={ARC_PATH_D} />
              <path
                className="rotina-progress-path"
                d={ARC_PATH_D}
                style={{
                  stroke: targetPreset.arcColor,
                  strokeDasharray: pathLen,
                  strokeDashoffset: pathLen * (1 - progress),
                }}
              />
              {STAR_POSITIONS.map((s, i) => (
                <circle
                  key={i}
                  className={`rotina-star${targetPreset.showStars ? ' rotina-star-visible' : ''}`}
                  cx={s.x}
                  cy={s.y}
                  r={s.r}
                />
              ))}
              <circle className="rotina-sun-glow" cx={sunPoint.x} cy={sunPoint.y} r={16} fill={targetPreset.arcColor} fillOpacity={0.35} />
              <circle className="rotina-sun-core" cx={sunPoint.x} cy={sunPoint.y} r={6.5} fill="#FFF3C4" />
            </svg>
          </div>
          <div className="rotina-progress-label"><b>{doneCount}</b>/{totalCount} passos concluídos</div>
        </header>

        <div
          id="rotina-mode-panel"
          role="tabpanel"
          aria-labelledby={mode === 'agenda' ? 'rotina-mode-tab-agenda' : 'rotina-mode-tab-fixa'}
        >
        {mode === 'agenda' ? (
          <AgendaPlanner {...agenda} />
        ) : (
        <>
        <div className="rotina-main">
          {loading ? (
            <div className="rotina-card">
              <div className="rotina-step-title">Carregando...</div>
            </div>
          ) : allDone ? (
            <div className="rotina-card rotina-celebrate">
              <div className="rotina-badge" style={{ fontSize: 44 }}>🏁</div>
              <div className="rotina-step-count">MISSÃO CUMPRIDA</div>
              <div className="rotina-step-title">Rotina completa!</div>
              <div style={{ color: 'var(--rotina-ink-dim)', fontSize: 14, marginTop: -8 }}>
                Josemar, o dia é seu.
              </div>
              <button className="rotina-primary-btn" onClick={handleResetClick}>
                {resetArmed ? 'Confirmar reinício' : 'Reiniciar rotina'}
              </button>
              <div className="rotina-sparkles">
                {sparkles.map(s => (
                  <span
                    key={s.id}
                    className="rotina-sparkle"
                    style={{ left: `${s.left}px`, animationDelay: `${s.delay}s` }}
                  >
                    {s.emoji}
                  </span>
                ))}
              </div>
            </div>
          ) : currentStep ? (
            <div className={`rotina-card${cardSwap ? ' rotina-card-swap' : ''}`}>
              <div className="rotina-badge" style={{ background: `linear-gradient(135deg, ${targetPreset.arcColor}, #FFB347)` }}>
                {currentStep.emoji}
              </div>
              <div className="rotina-step-count">PASSO {focus + 1} DE {totalCount}</div>
              <div className="rotina-step-title">{currentStep.title}</div>
              <button
                className="rotina-primary-btn"
                onClick={handleConclude}
                style={done[currentStep.id] ? { opacity: 0.75 } : undefined}
              >
                {done[currentStep.id] ? 'Concluído ✓ — revisar' : 'Concluir ✅'}
              </button>
            </div>
          ) : null}
        </div>

        <div className="rotina-trail">
          {ROTINA_STEPS.map((step, i) => (
            <div
              key={step.id}
              className={`rotina-dot${done[step.id] ? ' rotina-dot-done' : ''}${i === focus ? ' rotina-dot-current' : ''}`}
              onClick={() => handleDotClick(i)}
              role="button"
              tabIndex={0}
              aria-label={`Ir para o passo ${step.title}`}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleDotClick(i);
                }
              }}
            >
              {step.emoji}
            </div>
          ))}
        </div>
        </>
        )}
        </div>
      </div>
    </div>
  );
}
