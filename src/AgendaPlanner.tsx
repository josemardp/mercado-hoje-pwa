import { useState, useCallback, useMemo } from 'react';
import { type useAgendaState } from './lib/useAgendaState';
import { formatDurationLabel } from './lib/agendaScheduler';

type AgendaPlannerProps = ReturnType<typeof useAgendaState>;

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
  addTask, updateTaskTitle, updateTaskDuration, toggleFixed, removeTask, moveTask, toggleDone, generateSchedule,
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

  const handleAddTask = useCallback(async () => {
    const title = newTitle.trim();
    if (!title) return;
    await addTask(title, { fixed: newFixed, fixedStart: newFixed && newFixedStart ? newFixedStart : undefined });
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
    setValidationError('');
    setGenerating(true);
    try {
      const result = await generateSchedule(windowStart, windowEnd);
      setShortfallMinutes(result.shortfallMinutes);
    } finally {
      setGenerating(false);
    }
  }, [windowMode, absoluteStart, absoluteEnd, relativeHours, relativeMinutes, generateSchedule]);

  const handleRetryStuck = useCallback(async () => {
    setRetryingStuck(true);
    try { await retryStuckEntries(); } finally { setRetryingStuck(false); }
  }, [retryStuckEntries]);

  const hasScheduleAny = useMemo(() => tasks.some(t => t.scheduledStart), [tasks]);
  const sortedTasks = useMemo(() => {
    if (!hasScheduleAny) return tasks.slice().sort((a, b) => a.order - b.order);
    return tasks.slice().sort((a, b) => (a.scheduledStart || '').localeCompare(b.scheduledStart || ''));
  }, [tasks, hasScheduleAny]);

  let scheduledIndex = 0;

  return (
    <div className="agenda-planner">
      {syncStatus !== 'idle' && (
        <div className="rotina-sync-indicator">
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

        {validationError && <div className="agenda-validation-error">{validationError}</div>}
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
        <table className="agenda-table">
          <thead>
            <tr>
              <th>Nº</th>
              <th>Horário</th>
              <th>Duração</th>
              <th>Tarefa</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {sortedTasks.map((task, index) => {
              const isScheduled = !!task.scheduledStart;
              if (isScheduled) scheduledIndex++;
              return (
                <tr key={task.id} className={`agenda-task-row${task.done ? ' agenda-task-done' : ''}`}>
                  <td>{isScheduled ? String(scheduledIndex).padStart(2, '0') : '—'}</td>
                  <td>
                    {isScheduled ? `${task.scheduledStart}–${task.scheduledEnd}` : (task.fixed && task.fixedStart ? task.fixedStart : '—')}
                  </td>
                  <td>
                    {isScheduled ? (
                      formatDurationLabel(Math.round(
                        (toMinutesForDisplay(task.scheduledEnd!) - toMinutesForDisplay(task.scheduledStart!))
                      ))
                    ) : (
                      <input
                        className="agenda-duration-input"
                        type="number"
                        min={5}
                        step={5}
                        value={task.estimatedMinutes}
                        onChange={e => updateTaskDuration(task.id, Number(e.target.value))}
                        disabled={task.fixed}
                      />
                    )}
                  </td>
                  <td>
                    <input
                      className="agenda-title-edit"
                      type="text"
                      value={task.title}
                      onChange={e => updateTaskTitle(task.id, e.target.value)}
                    />
                    <button
                      className={`agenda-fixed-badge${task.fixed ? ' agenda-fixed-on' : ''}`}
                      onClick={() => toggleFixed(task.id)}
                      title={task.fixed ? 'Tornar flexível (comprimível)' : 'Marcar como compromisso fixo (não comprimível)'}
                    >
                      {task.fixed ? 'fixo' : 'flexível'}
                    </button>
                  </td>
                  <td className="agenda-row-actions">
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
                          disabled={index === sortedTasks.length - 1}
                          aria-label={`Mover "${task.title}" pra baixo`}
                          title="Mover pra baixo"
                        >
                          ▼
                        </button>
                      </span>
                    )}
                    <input
                      type="checkbox"
                      checked={task.done}
                      onChange={() => toggleDone(task.id)}
                      aria-label={`Marcar "${task.title}" como concluída`}
                      title="Concluída"
                    />
                    <button
                      className="agenda-remove-btn"
                      onClick={() => removeTask(task.id)}
                      aria-label={`Remover "${task.title}"`}
                      title="Remover"
                    >
                      ×
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

function toMinutesForDisplay(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}
