import { useState, useCallback, useEffect } from 'react';
import Modal from './Modal';
import { type useGoMode } from './lib/useGoMode';
import { type AgendaTaskRecord } from './lib/db';
import { CARD_PALETTE } from './lib/agendaCardPalette';
import { formatCountdown } from './lib/goModeEngine';

interface AgendaGoModeProps {
  goMode: ReturnType<typeof useGoMode>;
  tasks: AgendaTaskRecord[];
}

const CELEBRATE_EMOJIS = ['✨', '🌟', '⭐', '🎉'];
const BIG_CELEBRATE_EMOJIS = ['✨', '🌟', '⭐', '🎉', '🏆', '🎊'];

export default function AgendaGoMode({ goMode, tasks }: AgendaGoModeProps) {
  const { session, remainingMs, currentTask, celebration } = goMode;
  const [sparkles, setSparkles] = useState<{ id: number; left: number; delay: number; emoji: string }[]>([]);

  const burstSparkles = useCallback((big: boolean) => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const emojis = big ? BIG_CELEBRATE_EMOJIS : CELEBRATE_EMOJIS;
    const count = big ? 18 : 10;
    const next = Array.from({ length: count }).map((_, i) => ({
      id: Date.now() + i,
      left: Math.random() * 260 - 130,
      delay: Math.random() * 1.2,
      emoji: emojis[i % emojis.length],
    }));
    setSparkles(next);
    setTimeout(() => setSparkles([]), big ? 4200 : 3000);
  }, []);

  useEffect(() => {
    if (!celebration) return;
    (async () => burstSparkles(celebration.big))();
  }, [celebration, burstSparkles]);

  if (!session && !celebration) return null;

  if (celebration) {
    return (
      <div className="agenda-go-card agenda-go-card-celebrate">
        <div className="rotina-badge" style={{ fontSize: 44, background: celebration.big ? 'linear-gradient(135deg, #FFD166, #FF6B9D)' : undefined }}>
          {celebration.big ? '🏆' : '🏁'}
        </div>
        <div className="rotina-step-count">{celebration.big ? 'MISSÃO CUMPRIDA COM SOBRA' : 'MISSÃO CUMPRIDA'}</div>
        <div className="rotina-step-title">{celebration.big ? 'Mandou muito bem!' : 'Agenda concluída!'}</div>
        <button className="rotina-primary-btn" onClick={goMode.dismissCelebration}>Fechar</button>
        <div className="rotina-sparkles">
          {sparkles.map(s => (
            <span key={s.id} className="rotina-sparkle" style={{ left: `${s.left}px`, animationDelay: `${s.delay}s` }}>
              {s.emoji}
            </span>
          ))}
        </div>
      </div>
    );
  }

  if (!session) return null;

  const trail = session.taskOrder.map((id, i) => {
    const task = tasks.find(t => t.id === id);
    const palette = CARD_PALETTE[i % CARD_PALETTE.length];
    const isPast = i < session.currentIndex;
    const isCurrent = session.phase === 'task' && i === session.currentIndex;
    const status: 'done' | 'expired' | 'current' | 'upcoming' =
      isCurrent ? 'current' : isPast ? (task?.done ? 'done' : 'expired') : 'upcoming';
    return { id, title: task?.title ?? '(removida)', palette, status };
  });

  return (
    <div className="agenda-go">
      {session.phase === 'confirm' ? (
        // onClose is a deliberate no-op: this question requires an answer
        // (Sim/Não below) — Escape/backdrop-click shouldn't silently
        // abandon the run without recording either.
        <Modal titleId="agenda-go-confirm-title" onClose={() => {}} className="agenda-go-confirm-modal">
          <div className="rotina-badge" style={{ fontSize: 40 }}>⏰</div>
          <h2 className="agenda-go-confirm-title" id="agenda-go-confirm-title">Tempo encerrado!</h2>
          <p className="agenda-go-confirm-question">Você terminou tudo?</p>
          <div className="agenda-go-confirm-actions">
            <button className="rotina-primary-btn" onClick={() => goMode.confirmFinished(true)}>Sim, terminei</button>
            <button className="agenda-go-confirm-no-btn" onClick={() => goMode.confirmFinished(false)}>Ainda não</button>
          </div>
        </Modal>
      ) : (
        <div
          className="agenda-go-card"
          style={session.phase === 'task' ? { background: `${CARD_PALETTE[session.currentIndex % CARD_PALETTE.length].tint}, rgba(15, 12, 28, 0.6)` } : undefined}
        >
          {session.phase === 'bonus' ? (
            <>
              <div className="rotina-badge" style={{ fontSize: 40 }}>🎁</div>
              <div className="rotina-step-count">TEMPO BÔNUS</div>
              <div className="rotina-step-title">Sobrou tempo — aproveita!</div>
            </>
          ) : (
            <>
              <div className="rotina-badge" style={{ fontSize: 40 }}>⏱️</div>
              <div className="rotina-step-count">PASSO {session.currentIndex + 1} DE {session.taskOrder.length}</div>
              <div className="rotina-step-title">{currentTask?.title ?? '...'}</div>
            </>
          )}

          <div className="agenda-go-timer">{formatCountdown(remainingMs)}</div>
          {session.paused && <div className="agenda-go-paused-label">Pausado</div>}

          <div className="agenda-go-actions">
            <button className="rotina-primary-btn" onClick={session.paused ? goMode.resume : goMode.pause}>
              {session.paused ? '▶ Retomar' : '⏸ Pausar'}
            </button>
            {session.phase === 'task' ? (
              <button className="agenda-go-secondary-btn" onClick={goMode.finishCurrentEarly}>✓ Concluir agora</button>
            ) : (
              <button className="agenda-go-secondary-btn" onClick={goMode.endBonusNow}>🏁 Fim</button>
            )}
          </div>
          <button className="agenda-go-exit-btn" onClick={goMode.exitGo}>Sair do Go</button>
        </div>
      )}

      <div className="agenda-go-trail">
        {trail.map(item => (
          <div key={item.id} className={`agenda-go-trail-item agenda-go-trail-${item.status}`}>
            <span
              className="agenda-go-trail-dot"
              style={item.status === 'done' ? { background: item.palette.grad } : undefined}
            >
              {item.status === 'done' ? '✓' : item.status === 'expired' ? '⏱️' : ''}
            </span>
            <span className="agenda-go-trail-title">{item.title}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
