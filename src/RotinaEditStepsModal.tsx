import { useState, useCallback } from 'react';
import Modal from './Modal';
import type { useRotinaStepDefs } from './lib/useRotinaStepDefs';
import type { SkyPeriod } from './lib/rotinaSteps';

interface RotinaEditStepsModalProps {
  stepDefs: ReturnType<typeof useRotinaStepDefs>;
  onClose: () => void;
}

const PERIOD_OPTIONS: { key: SkyPeriod; label: string; icon: string }[] = [
  { key: 'dawn', label: 'Amanhecer', icon: '🌅' },
  { key: 'morning', label: 'Manhã', icon: '🌤️' },
  { key: 'afternoon', label: 'Tarde', icon: '☀️' },
  { key: 'dusk', label: 'Entardecer', icon: '🌇' },
  { key: 'night', label: 'Noite', icon: '🌙' },
];

export default function RotinaEditStepsModal({ stepDefs, onClose }: RotinaEditStepsModalProps) {
  const { steps, addStep, updateStep, removeStep, moveStep, syncStatus, stuckSyncCount, retryStuckEntries } = stepDefs;

  // Commit-on-blur drafts for title/emoji, same convention as AgendaPlanner's
  // titleDrafts/durationDrafts — avoids writing (and syncing) on every keystroke.
  const [titleDrafts, setTitleDrafts] = useState<Record<string, string>>({});
  const [emojiDrafts, setEmojiDrafts] = useState<Record<string, string>>({});
  const [retryingStuck, setRetryingStuck] = useState(false);

  const commitTitle = useCallback((id: string) => {
    const draft = titleDrafts[id];
    if (draft === undefined) return;
    const trimmed = draft.trim();
    setTitleDrafts(prev => { const next = { ...prev }; delete next[id]; return next; });
    if (trimmed) updateStep(id, { title: trimmed });
  }, [titleDrafts, updateStep]);

  const commitEmoji = useCallback((id: string) => {
    const draft = emojiDrafts[id];
    if (draft === undefined) return;
    const trimmed = draft.trim();
    setEmojiDrafts(prev => { const next = { ...prev }; delete next[id]; return next; });
    if (trimmed) updateStep(id, { emoji: trimmed });
  }, [emojiDrafts, updateStep]);

  const [newTitle, setNewTitle] = useState('');
  const [newEmoji, setNewEmoji] = useState('✅');
  const [newPeriod, setNewPeriod] = useState<SkyPeriod>('morning');

  const handleAddStep = useCallback(async () => {
    const title = newTitle.trim();
    if (!title) return;
    await addStep(title, newEmoji.trim() || '✅', newPeriod);
    setNewTitle('');
    setNewEmoji('✅');
    setNewPeriod('morning');
  }, [newTitle, newEmoji, newPeriod, addStep]);

  const handleRetryStuck = useCallback(async () => {
    setRetryingStuck(true);
    try { await retryStuckEntries(); } finally { setRetryingStuck(false); }
  }, [retryStuckEntries]);

  return (
    <Modal titleId="rotina-edit-steps-title" onClose={onClose} className="rotina-edit-modal">
      <h2 className="rotina-edit-title" id="rotina-edit-steps-title">
        Editar rotina
        {syncStatus !== 'idle' && (
          <span className="rotina-edit-sync-indicator" role="status" aria-live="polite">
            {syncStatus === 'syncing' && ' 🔄'}
            {syncStatus === 'synced' && ' ✅'}
            {syncStatus === 'error' && ' ⚠️'}
          </span>
        )}
      </h2>

      {stuckSyncCount > 0 && (
        <div className="rotina-edit-stuck-banner" role="alert">
          <span>
            ⚠️ {stuckSyncCount} {stuckSyncCount === 1 ? 'alteração não sincronizou' : 'alterações não sincronizaram'}.
          </span>
          <button className="rotina-edit-stuck-retry-btn" onClick={handleRetryStuck} disabled={retryingStuck}>
            {retryingStuck ? 'Tentando...' : 'Tentar de novo'}
          </button>
        </div>
      )}

      <div className="rotina-edit-list">
        {steps.map((step, i) => (
          <div key={step.id} className="rotina-edit-row">
            <div className="rotina-edit-row-main">
              <input
                className="rotina-edit-emoji-input"
                type="text"
                value={emojiDrafts[step.id] ?? step.emoji}
                onChange={e => setEmojiDrafts(prev => ({ ...prev, [step.id]: e.target.value }))}
                onBlur={() => commitEmoji(step.id)}
                maxLength={4}
                aria-label={`Emoji do passo "${step.title}"`}
              />
              <input
                className="rotina-edit-title-input"
                type="text"
                value={titleDrafts[step.id] ?? step.title}
                onChange={e => setTitleDrafts(prev => ({ ...prev, [step.id]: e.target.value }))}
                onBlur={() => commitTitle(step.id)}
                aria-label={`Título do passo "${step.title}"`}
              />
            </div>

            <div className="rotina-period-picker">
              {PERIOD_OPTIONS.map(p => (
                <button
                  key={p.key}
                  type="button"
                  className={`rotina-period-btn${step.period === p.key ? ' active' : ''}`}
                  onClick={() => updateStep(step.id, { period: p.key })}
                  title={p.label}
                  aria-pressed={step.period === p.key}
                >
                  {p.icon} {p.label}
                </button>
              ))}
            </div>

            <div className="rotina-edit-row-actions">
              <span className="rotina-reorder-btns">
                <button
                  className="rotina-reorder-btn"
                  onClick={() => moveStep(step.id, -1)}
                  disabled={i === 0}
                  aria-label={`Mover "${step.title}" pra cima`}
                  title="Mover pra cima"
                >
                  ▲
                </button>
                <button
                  className="rotina-reorder-btn"
                  onClick={() => moveStep(step.id, 1)}
                  disabled={i === steps.length - 1}
                  aria-label={`Mover "${step.title}" pra baixo`}
                  title="Mover pra baixo"
                >
                  ▼
                </button>
              </span>
              <button
                className="rotina-edit-remove-btn"
                onClick={() => removeStep(step.id)}
                aria-label={`Remover "${step.title}"`}
                title="Remover"
              >
                🗑️
              </button>
            </div>
          </div>
        ))}
        {steps.length === 0 && (
          <div className="rotina-edit-empty">Nenhum passo ainda. Adicione o primeiro abaixo.</div>
        )}
      </div>

      <div className="rotina-edit-add-row">
        <input
          className="rotina-edit-emoji-input"
          type="text"
          value={newEmoji}
          onChange={e => setNewEmoji(e.target.value)}
          maxLength={4}
          aria-label="Emoji do novo passo"
        />
        <input
          className="rotina-edit-title-input"
          type="text"
          value={newTitle}
          onChange={e => setNewTitle(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleAddStep(); }}
          placeholder="Título do novo passo"
          aria-label="Título do novo passo"
        />
        <button className="rotina-edit-add-btn" onClick={handleAddStep} disabled={!newTitle.trim()}>
          + Adicionar
        </button>
      </div>

      <button className="rotina-edit-close-btn" onClick={onClose}>Fechar</button>
    </Modal>
  );
}
