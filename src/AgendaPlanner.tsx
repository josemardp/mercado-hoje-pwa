import { useState, useCallback, useMemo, useRef } from 'react';
import { type useAgendaState } from './lib/useAgendaState';
import { type useGoMode } from './lib/useGoMode';
import { formatDurationLabel } from './lib/agendaScheduler';
import { FLOOR_MINUTES } from './lib/agendaDurationEstimator';
import { CARD_PALETTE } from './lib/agendaCardPalette';
import AgendaGoMode from './AgendaGoMode';
import AgendaTaskEditModal from './AgendaTaskEditModal';

// Long-press-to-edit / press-and-drag-to-reorder tuning. Held below the
// "cancel" threshold, a stray finger tremor during the hold doesn't abort
// the press; held below the "drag start" threshold once armed, releasing
// opens the edit modal instead of committing a (non-)reorder.
const LONG_PRESS_MS = 550;
const TAP_CANCEL_PX = 10;
const DRAG_START_PX = 12;

// `goMode` is called once in App.tsx (alongside useAgendaState itself) and
// passed down — same convention as RotinaTab's stepDefs prop, so switching
// tabs/re-rendering never spins up a second independent Dexie/timer instance.
type AgendaPlannerProps = ReturnType<typeof useAgendaState> & {
  goMode: ReturnType<typeof useGoMode>;
};

function nowHHMM(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function addMinutesToHHMM(hhmm: string, minutes: number): string {
  const [h, m] = hhmm.split(':').map(Number);
  const total = h * 60 + m + minutes;
  const wrapped = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  return `${String(Math.floor(wrapped / 60)).padStart(2, '0')}:${String(wrapped % 60).padStart(2, '0')}`;
}

export default function AgendaPlanner({
  tasks, loading, syncStatus, stuckSyncCount, retryStuckEntries,
  addTask, updateTaskTitle, updateTaskDuration, toggleFixed, updateFixedStart, updateScheduledTime,
  removeTask, moveTask, reorderTasks, toggleDone, generateSchedule,
  goMode,
}: AgendaPlannerProps) {
  const [windowMode, setWindowMode] = useState<'relativo' | 'absoluto'>('relativo');
  const [relativeHours, setRelativeHours] = useState(2);
  const [relativeMinutes, setRelativeMinutes] = useState(0);
  const [absoluteStart, setAbsoluteStart] = useState('14:00');
  const [absoluteEnd, setAbsoluteEnd] = useState('16:00');

  const [newTitle, setNewTitle] = useState('');
  const [newFixed, setNewFixed] = useState(false);
  const [newFixedStart, setNewFixedStart] = useState('');

  const [shortfallMinutes, setShortfallMinutes] = useState<number | null>(null);
  const [validationError, setValidationError] = useState('');
  const [generating, setGenerating] = useState(false);
  const [retryingStuck, setRetryingStuck] = useState(false);

  // AUD-013: title/duration used to persist (local write + remote push) on
  // every keystroke. Typing now only updates this local draft; the real
  // update fires on blur instead, so a whole sentence produces one write.
  const [titleDrafts, setTitleDrafts] = useState<Record<string, string>>({});
  const [durationDrafts, setDurationDrafts] = useState<Record<string, number>>({});
  const commitTitle = useCallback((id: string) => {
    const draft = titleDrafts[id];
    if (draft === undefined) return;
    updateTaskTitle(id, draft);
    setTitleDrafts(prev => { const next = { ...prev }; delete next[id]; return next; });
  }, [titleDrafts, updateTaskTitle]);
  const commitDuration = useCallback((id: string) => {
    const draft = durationDrafts[id];
    if (draft === undefined) return;
    updateTaskDuration(id, draft);
    setDurationDrafts(prev => { const next = { ...prev }; delete next[id]; return next; });
  }, [durationDrafts, updateTaskDuration]);

  // AUD-011: toggling "fixo" off used to erase fixedStart outright, so
  // turning it back on lost the time you'd already set. This remembers the
  // last time typed for each task, purely on the UI side, independent of
  // whatever the domain currently has stored for it.
  const [fixedStartDrafts, setFixedStartDrafts] = useState<Record<string, string>>({});

  const handleAddTask = useCallback(async () => {
    const title = newTitle.trim();
    if (!title) return;
    // AUD-011: a "fixed" task with no time wasn't rejected before — it just
    // silently existed in that confusing state until the editor fixed it up.
    if (newFixed && !newFixedStart) {
      setValidationError('Defina o horário do compromisso fixo antes de adicionar.');
      return;
    }
    setValidationError('');
    await addTask(title, { fixed: newFixed, fixedStart: newFixed ? newFixedStart : undefined });
    setNewTitle('');
    setNewFixed(false);
    setNewFixedStart('');
  }, [newTitle, newFixed, newFixedStart, addTask]);

  const handleGenerate = useCallback(async () => {
    const windowStart = windowMode === 'relativo' ? nowHHMM() : absoluteStart;
    const windowEnd = windowMode === 'relativo'
      ? addMinutesToHHMM(windowStart, relativeHours * 60 + relativeMinutes)
      : absoluteEnd;

    if (windowEnd <= windowStart) {
      setValidationError('O horário final precisa ser depois do inicial.');
      return;
    }
    // AUD-011: a fixed task without a time can't be scheduled at all (it has
    // no anchor) — block here with a specific message instead of letting the
    // engine silently treat it as an unanchored "soft-fixed" task.
    const missingTime = tasks.filter(t => t.fixed && !t.fixedStart);
    if (missingTime.length > 0) {
      const names = missingTime.map(t => `"${t.title}"`).join(', ');
      setValidationError(`Defina o horário de: ${names} antes de montar a agenda.`);
      return;
    }
    setValidationError('');
    setGenerating(true);
    try {
      const result = await generateSchedule(windowStart, windowEnd);
      if (result.invalidWindow) {
        setValidationError('O horário final precisa ser depois do inicial.');
        setShortfallMinutes(null);
        return;
      }
      if (result.fixedConflicts.length > 0) {
        const names = tasks
          .filter(t => result.fixedConflicts.includes(t.id))
          .map(t => `"${t.title}"`)
          .join(' e ');
        setValidationError(`Dois compromissos fixos se sobrepõem (${names}) — ajuste o horário de um deles antes de montar a agenda.`);
        setShortfallMinutes(null);
        return;
      }
      setShortfallMinutes(result.shortfallMinutes);
    } finally {
      setGenerating(false);
    }
  }, [windowMode, absoluteStart, absoluteEnd, relativeHours, relativeMinutes, generateSchedule, tasks]);

  const handleRetryStuck = useCallback(async () => {
    setRetryingStuck(true);
    try { await retryStuckEntries(); } finally { setRetryingStuck(false); }
  }, [retryStuckEntries]);

  const hasScheduleAny = useMemo(() => tasks.some(t => t.scheduledStart), [tasks]);
  const sortedTasks = useMemo(() => {
    if (!hasScheduleAny) return tasks.slice().sort((a, b) => a.order - b.order);
    return tasks.slice().sort((a, b) => (a.scheduledStart || '').localeCompare(b.scheduledStart || ''));
  }, [tasks, hasScheduleAny]);

  const canStartGo = useMemo(() => tasks.some(t => t.scheduledStart && t.scheduledEnd && !t.done), [tasks]);
  const goActive = !!goMode.session || !!goMode.celebration;

  // ─── Long-press to edit / press-and-drag to reorder ──────────────────
  // A tap on the check circle, title input, remove ×, etc. still behaves
  // exactly as before (handlePointerDown bails out on those targets).
  // Holding anywhere else on the card for LONG_PRESS_MS "arms" it; from
  // there, releasing opens the edit modal, while dragging past
  // DRAG_START_PX instead starts a live reorder (adjacent-swap against
  // whichever neighbor card the pointer crosses).
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [armedId, setArmedId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOffsetY, setDragOffsetY] = useState(0);
  const [dragOrder, setDragOrder] = useState<string[] | null>(null);
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const dragOrderRef = useRef<string[]>([]);
  const pressRef = useRef<{
    id: string; startX: number; startY: number; timer: number | null; armed: boolean; dragging: boolean;
  } | null>(null);

  const clearPress = useCallback(() => {
    if (pressRef.current?.timer) window.clearTimeout(pressRef.current.timer);
    pressRef.current = null;
    setArmedId(null);
  }, []);

  const endDrag = useCallback(async (commit: boolean) => {
    const order = dragOrderRef.current;
    const draggedEl = draggingId ? cardRefs.current.get(draggingId) : undefined;
    if (draggedEl) draggedEl.style.touchAction = '';
    setDraggingId(null);
    setDragOrder(null);
    setDragOffsetY(0);
    dragOrderRef.current = [];
    if (commit && order.length > 0) await reorderTasks(order);
  }, [draggingId, reorderTasks]);

  const handleCardPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>, taskId: string) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('input, button, textarea, select, a, label')) return;
    clearPress();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* not critical */ }
    pressRef.current = { id: taskId, startX: e.clientX, startY: e.clientY, timer: null, armed: false, dragging: false };
    pressRef.current.timer = window.setTimeout(() => {
      if (!pressRef.current || pressRef.current.id !== taskId) return;
      pressRef.current.armed = true;
      setArmedId(taskId);
      if ('vibrate' in navigator) navigator.vibrate(25);
    }, LONG_PRESS_MS);
  }, [clearPress]);

  const handleCardPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const press = pressRef.current;
    if (!press) return;
    const dx = e.clientX - press.startX;
    const dy = e.clientY - press.startY;

    if (!press.armed) {
      if (Math.hypot(dx, dy) > TAP_CANCEL_PX) clearPress();
      return;
    }

    if (!press.dragging) {
      if (Math.abs(dy) < DRAG_START_PX) return;
      press.dragging = true;
      dragOrderRef.current = sortedTasks.map(t => t.id);
      setDragOrder(dragOrderRef.current);
      setDraggingId(press.id);
      const el = cardRefs.current.get(press.id);
      if (el) el.style.touchAction = 'none';
    }

    setDragOffsetY(dy);

    const order = dragOrderRef.current;
    const idx = order.indexOf(press.id);
    if (idx === -1) return;
    const neighborIdx = dy > 0 ? idx + 1 : idx - 1;
    const neighborId = order[neighborIdx];
    if (!neighborId) return;
    const neighborEl = cardRefs.current.get(neighborId);
    if (!neighborEl) return;
    const rect = neighborEl.getBoundingClientRect();
    const midpoint = rect.top + rect.height / 2;
    const crossed = dy > 0 ? e.clientY > midpoint : e.clientY < midpoint;
    if (!crossed) return;

    const next = order.slice();
    next[idx] = neighborId;
    next[neighborIdx] = press.id;
    dragOrderRef.current = next;
    setDragOrder(next);
    // Re-anchor so the next swap is measured from here, not the drag's
    // original start point — otherwise a long continuous drag would only
    // ever be able to swap past the very first neighbor.
    press.startY = e.clientY;
    setDragOffsetY(0);
  }, [clearPress, sortedTasks]);

  const handleCardPointerUp = useCallback(() => {
    const press = pressRef.current;
    if (!press) return;
    if (press.dragging) {
      endDrag(true);
    } else if (press.armed) {
      setEditingTaskId(press.id);
    }
    clearPress();
  }, [clearPress, endDrag]);

  const handleCardPointerCancel = useCallback(() => {
    if (pressRef.current?.dragging) endDrag(false);
    clearPress();
  }, [clearPress, endDrag]);

  const displayTasks = useMemo(() => {
    if (!dragOrder) return sortedTasks;
    const byId = new Map(sortedTasks.map(t => [t.id, t]));
    return dragOrder.map(id => byId.get(id)).filter((t): t is typeof sortedTasks[number] => !!t);
  }, [dragOrder, sortedTasks]);

  const editingTask = editingTaskId ? tasks.find(t => t.id === editingTaskId) ?? null : null;

  let scheduledIndex = 0;

  if (goActive) {
    return (
      <div className="agenda-planner">
        <AgendaGoMode goMode={goMode} tasks={tasks} />
      </div>
    );
  }

  return (
    <div className="agenda-planner">
      {syncStatus !== 'idle' && (
        <div className="rotina-sync-indicator" role="status" aria-live="polite">
          {syncStatus === 'syncing' && '🔄 salvando...'}
          {syncStatus === 'synced' && '✅ salvo'}
          {syncStatus === 'error' && '⚠️ erro sync'}
        </div>
      )}

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

      <div className="agenda-window-input">
        <div className="agenda-mode-toggle">
          <button
            className={windowMode === 'relativo' ? 'active' : ''}
            onClick={() => setWindowMode('relativo')}
          >
            A partir de agora
          </button>
          <button
            className={windowMode === 'absoluto' ? 'active' : ''}
            onClick={() => setWindowMode('absoluto')}
          >
            Horário definido
          </button>
        </div>

        {windowMode === 'relativo' ? (
          <div className="agenda-window-fields">
            <label>
              Horas
              <input
                type="number"
                min={0}
                max={12}
                value={relativeHours}
                onChange={e => setRelativeHours(Number(e.target.value))}
              />
            </label>
            <label>
              Minutos
              <input
                type="number"
                min={0}
                max={59}
                step={5}
                value={relativeMinutes}
                onChange={e => setRelativeMinutes(Number(e.target.value))}
              />
            </label>
          </div>
        ) : (
          <div className="agenda-window-fields">
            <label>
              Início
              <input type="time" value={absoluteStart} onChange={e => setAbsoluteStart(e.target.value)} />
            </label>
            <label>
              Fim
              <input type="time" value={absoluteEnd} onChange={e => setAbsoluteEnd(e.target.value)} />
            </label>
          </div>
        )}

        <button className="rotina-primary-btn" onClick={handleGenerate} disabled={generating || tasks.length === 0}>
          {generating ? 'Montando...' : 'Montar agenda'}
        </button>

        {canStartGo && (
          <button className="agenda-go-start-btn" onClick={goMode.startGo}>
            ▶ Iniciar Go
          </button>
        )}

        {validationError && <div className="agenda-validation-error" role="alert">{validationError}</div>}
        {shortfallMinutes !== null && shortfallMinutes > 0 && (
          <div className="rotina-stuck-sync-banner" role="alert">
            <span>
              ⚠️ Não cabe tudo no tempo disponível — faltam {formatDurationLabel(shortfallMinutes)} mesmo comprimindo ao máximo.
            </span>
          </div>
        )}
      </div>

      <div className="agenda-add-row">
        <input
          className="agenda-title-input"
          type="text"
          placeholder="Nova tarefa..."
          value={newTitle}
          onChange={e => setNewTitle(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleAddTask(); }}
        />
        <label className="agenda-fixed-toggle">
          <input type="checkbox" checked={newFixed} onChange={e => setNewFixed(e.target.checked)} />
          Fixo
        </label>
        {newFixed && (
          <input
            type="time"
            value={newFixedStart}
            onChange={e => setNewFixedStart(e.target.value)}
          />
        )}
        <button className="rotina-primary-btn agenda-add-btn" onClick={handleAddTask}>
          Adicionar
        </button>
      </div>

      {loading ? (
        <div className="rotina-step-title">Carregando...</div>
      ) : tasks.length === 0 ? (
        <div className="rotina-step-count">Nenhuma tarefa ainda — adicione acima.</div>
      ) : (
        <div className="agenda-task-list">
          {displayTasks.map((task, index) => {
            const isScheduled = !!task.scheduledStart;
            if (isScheduled) scheduledIndex++;
            const palette = CARD_PALETTE[index % CARD_PALETTE.length];
            const isArmed = armedId === task.id;
            const isDragging = draggingId === task.id;
            return (
              <div
                key={task.id}
                ref={el => { if (el) cardRefs.current.set(task.id, el); else cardRefs.current.delete(task.id); }}
                className={`agenda-task-card${task.done ? ' agenda-task-card-done' : ''}${isArmed ? ' agenda-task-card-armed' : ''}${isDragging ? ' agenda-task-card-dragging' : ''}`}
                style={{
                  background: `${palette.tint}, rgba(15, 12, 28, 0.6)`,
                  transform: isDragging ? `translateY(${dragOffsetY}px) scale(1.02)` : undefined,
                }}
                onPointerDown={e => handleCardPointerDown(e, task.id)}
                onPointerMove={handleCardPointerMove}
                onPointerUp={handleCardPointerUp}
                onPointerCancel={handleCardPointerCancel}
              >
                <button
                  className="agenda-task-check"
                  style={task.done ? { background: palette.grad, borderColor: 'transparent' } : undefined}
                  onClick={() => toggleDone(task.id)}
                  aria-label={`Marcar "${task.title}" como concluída`}
                  aria-pressed={task.done}
                  title="Concluída"
                >
                  {task.done ? '✓' : ''}
                </button>

                <div className="agenda-task-main">
                  <div className="agenda-task-top">
                    <input
                      className="agenda-task-title-input"
                      type="text"
                      value={titleDrafts[task.id] ?? task.title}
                      onChange={e => setTitleDrafts(prev => ({ ...prev, [task.id]: e.target.value }))}
                      onBlur={() => commitTitle(task.id)}
                      aria-label="Título da tarefa"
                    />
                    <div className="agenda-task-actions">
                      {!hasScheduleAny && (
                        <span className="agenda-reorder-btns">
                          <button
                            className="agenda-reorder-btn"
                            onClick={() => moveTask(task.id, -1)}
                            disabled={index === 0}
                            aria-label={`Mover "${task.title}" pra cima`}
                            title="Mover pra cima"
                          >
                            ▲
                          </button>
                          <button
                            className="agenda-reorder-btn"
                            onClick={() => moveTask(task.id, 1)}
                            disabled={index === displayTasks.length - 1}
                            aria-label={`Mover "${task.title}" pra baixo`}
                            title="Mover pra baixo"
                          >
                            ▼
                          </button>
                        </span>
                      )}
                      <button
                        className="agenda-remove-btn"
                        onClick={() => removeTask(task.id)}
                        aria-label={`Remover "${task.title}"`}
                        title="Remover"
                      >
                        ×
                      </button>
                    </div>
                  </div>

                  <div className="agenda-task-meta">
                    {isScheduled ? (
                      <span className="agenda-task-time-badge" style={{ background: palette.grad }}>
                        {String(scheduledIndex).padStart(2, '0')} · {task.scheduledStart}–{task.scheduledEnd}
                      </span>
                    ) : task.fixed ? (
                      <input
                        className="agenda-fixed-time-input"
                        type="time"
                        value={fixedStartDrafts[task.id] ?? task.fixedStart ?? ''}
                        onChange={e => {
                          const value = e.target.value;
                          setFixedStartDrafts(prev => ({ ...prev, [task.id]: value }));
                          if (value) updateFixedStart(task.id, value);
                        }}
                        aria-label={`Horário do compromisso fixo "${task.title}"`}
                      />
                    ) : null}

                    {isScheduled ? (
                      <span className="agenda-task-duration">
                        {formatDurationLabel(Math.round(
                          (toMinutesForDisplay(task.scheduledEnd!) - toMinutesForDisplay(task.scheduledStart!))
                        ))}
                      </span>
                    ) : (
                      <input
                        className="agenda-duration-input"
                        type="number"
                        min={FLOOR_MINUTES}
                        step={FLOOR_MINUTES}
                        value={durationDrafts[task.id] ?? task.estimatedMinutes}
                        onChange={e => setDurationDrafts(prev => ({ ...prev, [task.id]: Number(e.target.value) }))}
                        onBlur={() => commitDuration(task.id)}
                        disabled={task.fixed}
                        aria-label={`Duração de "${task.title}"`}
                      />
                    )}

                    <button
                      className={`agenda-fixed-badge${task.fixed ? ' agenda-fixed-on' : ''}`}
                      onClick={() => {
                        // AUD-011: capture task.fixedStart into the local
                        // memory HERE, at the moment of un-fixing, before the
                        // domain clears it — a task whose time was only ever
                        // set at creation (never edited through the row's
                        // own input) would otherwise have nothing remembered
                        // to restore when toggled back on.
                        const remembered = fixedStartDrafts[task.id] ?? task.fixedStart;
                        if (remembered) setFixedStartDrafts(prev => ({ ...prev, [task.id]: remembered }));
                        toggleFixed(task.id, remembered);
                      }}
                      title={task.fixed ? 'Tornar flexível (comprimível)' : 'Marcar como compromisso fixo (não comprimível)'}
                      aria-pressed={task.fixed}
                    >
                      {task.fixed ? 'fixo' : 'flexível'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editingTask && (
        <AgendaTaskEditModal
          task={editingTask}
          onClose={() => setEditingTaskId(null)}
          onSaveTitle={title => updateTaskTitle(editingTask.id, title)}
          onSaveScheduledTime={(start, end) => updateScheduledTime(editingTask.id, start, end)}
          onSaveDuration={minutes => updateTaskDuration(editingTask.id, minutes)}
          onToggleFixed={fixedStart => toggleFixed(editingTask.id, fixedStart)}
          onSaveFixedStart={fixedStart => updateFixedStart(editingTask.id, fixedStart)}
          onRemove={() => { removeTask(editingTask.id); setEditingTaskId(null); }}
        />
      )}
    </div>
  );
}

function toMinutesForDisplay(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}
