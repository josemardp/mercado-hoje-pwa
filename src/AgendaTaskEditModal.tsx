import { useState } from 'react';
import Modal from './Modal';
import { type AgendaTaskRecord } from './lib/db';
import { FLOOR_MINUTES } from './lib/agendaDurationEstimator';

interface AgendaTaskEditModalProps {
  task: AgendaTaskRecord;
  onClose: () => void;
  onSaveTitle: (title: string) => void;
  onSaveScheduledTime: (start: string, end: string) => void;
  onSaveDuration: (minutes: number) => void;
  onToggleFixed: (fixedStart?: string) => void;
  onSaveFixedStart: (fixedStart: string) => void;
  onRemove: () => void;
}

// Opened by AgendaPlanner's long-press handler — the inline row already
// lets you edit title/duration/fixed time with a tap, but once a card is
// scheduled its time badge becomes read-only text (the scheduler owns
// scheduledStart/End). This is the only place a scheduled slot's time can
// be edited directly.
export default function AgendaTaskEditModal({
  task, onClose, onSaveTitle, onSaveScheduledTime, onSaveDuration, onToggleFixed, onSaveFixedStart, onRemove,
}: AgendaTaskEditModalProps) {
  const isScheduled = !!task.scheduledStart && !!task.scheduledEnd;
  const [title, setTitle] = useState(task.title);
  const [start, setStart] = useState(task.scheduledStart ?? '');
  const [end, setEnd] = useState(task.scheduledEnd ?? '');
  const [duration, setDuration] = useState(task.estimatedMinutes);
  const [fixedStart, setFixedStart] = useState(task.fixedStart ?? '');
  const [timeError, setTimeError] = useState('');

  const handleSave = () => {
    const trimmed = title.trim();
    if (trimmed && trimmed !== task.title) onSaveTitle(trimmed);

    if (isScheduled) {
      if (!start || !end) { setTimeError('Preencha início e fim.'); return; }
      if (end <= start) { setTimeError('O fim precisa ser depois do início.'); return; }
      if (start !== task.scheduledStart || end !== task.scheduledEnd) onSaveScheduledTime(start, end);
    } else {
      if (duration !== task.estimatedMinutes) onSaveDuration(duration);
      if (task.fixed && fixedStart && fixedStart !== task.fixedStart) onSaveFixedStart(fixedStart);
    }
    onClose();
  };

  return (
    <Modal titleId="agenda-task-edit-title" onClose={onClose} className="rotina-edit-modal agenda-task-edit-modal">
      <h2 className="rotina-edit-title" id="agenda-task-edit-title">Editar tarefa</h2>

      <div className="agenda-edit-field">
        <label htmlFor="agenda-edit-title-input">Título</label>
        <input
          id="agenda-edit-title-input"
          className="rotina-edit-title-input agenda-edit-title-full"
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
        />
      </div>

      {isScheduled ? (
        <div className="agenda-edit-field-row">
          <div className="agenda-edit-field">
            <label htmlFor="agenda-edit-start-input">Início</label>
            <input
              id="agenda-edit-start-input"
              type="time"
              value={start}
              onChange={e => { setStart(e.target.value); setTimeError(''); }}
            />
          </div>
          <div className="agenda-edit-field">
            <label htmlFor="agenda-edit-end-input">Fim</label>
            <input
              id="agenda-edit-end-input"
              type="time"
              value={end}
              onChange={e => { setEnd(e.target.value); setTimeError(''); }}
            />
          </div>
        </div>
      ) : (
        <>
          <div className="agenda-edit-field">
            <label htmlFor="agenda-edit-duration-input">Duração (min)</label>
            <input
              id="agenda-edit-duration-input"
              type="number"
              min={FLOOR_MINUTES}
              step={FLOOR_MINUTES}
              value={duration}
              disabled={task.fixed}
              onChange={e => setDuration(Number(e.target.value))}
            />
          </div>
          <label className="agenda-edit-fixed-toggle">
            <input
              type="checkbox"
              checked={task.fixed}
              onChange={() => onToggleFixed(fixedStart || task.fixedStart)}
            />
            Compromisso fixo
          </label>
          {task.fixed && (
            <div className="agenda-edit-field">
              <label htmlFor="agenda-edit-fixed-start-input">Horário fixo</label>
              <input
                id="agenda-edit-fixed-start-input"
                type="time"
                value={fixedStart}
                onChange={e => setFixedStart(e.target.value)}
              />
            </div>
          )}
        </>
      )}

      {timeError && <div className="agenda-validation-error" role="alert">{timeError}</div>}

      <div className="agenda-edit-actions">
        <button className="agenda-edit-remove-btn" onClick={onRemove}>Remover tarefa</button>
        <button className="rotina-primary-btn agenda-edit-save-btn" onClick={handleSave}>Salvar</button>
      </div>
      <button className="rotina-edit-close-btn" onClick={onClose}>Cancelar</button>
    </Modal>
  );
}
