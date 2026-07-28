import { useState, useEffect, useCallback, useRef } from 'react';
import { useDayState, useItems } from './lib/useStore';
import { CATEGORIES, getCategoryByKey, getTodayKey, formatDateBR } from './lib/categories';
import { db, type ItemRecord } from './lib/db';
import { useInstallPrompt } from './lib/useInstallPrompt';
import { classifyItem } from './lib/classifyCategory';

const CHECK_SVG = '<svg viewBox="0 0 24 24" fill="none"><path d="M4 12.5L9.5 18L20 6" stroke="white" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

type TabKey = 'hoje' | 'concluidos' | 'proximo';

const TABS: { key: TabKey; label: string; emoji: string }[] = [
  { key: 'hoje', label: 'Hoje', emoji: '🛒' },
  { key: 'concluidos', label: 'Concluídos', emoji: '✅' },
  { key: 'proximo', label: 'Próximo', emoji: '🕒' },
];

function ItemRow({
  item,
  cat,
  checked,
  onToggle,
  onPostpone,
  showPostpone,
}: {
  item: ItemRecord;
  cat: (typeof CATEGORIES)[number];
  checked: boolean;
  onToggle: () => void;
  onPostpone?: () => void;
  showPostpone?: boolean;
}) {
  return (
    <div
      className={`item${checked ? ' checked' : ''}`}
      style={{ '--cat-color': cat.color, '--cat-bg': cat.bgColor } as React.CSSProperties}
      onClick={onToggle}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onToggle();
        }
      }}
      role="checkbox"
      aria-checked={checked}
      aria-label={`${checked ? 'Desmarcar' : 'Marcar'} ${item.name}`}
      tabIndex={0}
    >
      <span className="checkbox" dangerouslySetInnerHTML={{ __html: CHECK_SVG }} />
      <span className="emoji-tag">{item.emoji}</span>
      <span className="name">{item.name}</span>
      {item.qty && item.qty > 1 && <span className="qty">{item.qty}x</span>}
      {showPostpone && !checked && onPostpone && (
        <span
          className="postpone-btn"
          onClick={(e) => {
            e.stopPropagation();
            onPostpone();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              e.stopPropagation();
              onPostpone();
            }
          }}
          title="Adiar para amanhã"
          role="button"
          aria-label={`Adiar ${item.name} para amanhã`}
          tabIndex={0}
        >
          🕒
        </span>
      )}
    </div>
  );
}

export default function App() {
  const {
    user,
    loginWithMagicLink,
    logout,
    state,
    loading: stateLoading,
    syncStatus,
    toggleItem,
    postponeItem,
    unpostponeItem,
    resetAll,
    addItemToToday,
    syncCategory,
    stuckSyncCount,
    retryStuckEntries,
  } = useDayState();

  const [retryingStuck, setRetryingStuck] = useState(false);
  const handleRetryStuckSync = useCallback(async () => {
    setRetryingStuck(true);
    try {
      await retryStuckEntries();
    } finally {
      setRetryingStuck(false);
    }
  }, [retryStuckEntries]);

  const { items, loading: itemsLoading, error: itemsError, addItem, searchItems } = useItems();

  const [email, setEmail] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authSent, setAuthSent] = useState(false);

  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState<ItemRecord[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [correctionItemId, setCorrectionItemId] = useState<string | null>(null);
  const [correctionShowPicker, setCorrectionShowPicker] = useState(false);
  const [celebration, setCelebration] = useState('');
  const [celebrationShow, setCelebrationShow] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>('hoje');
  const [showIosInstallModal, setShowIosInstallModal] = useState(false);
  
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const todayKey = getTodayKey();
  const dateStr = formatDateBR(todayKey);
  const loading = stateLoading || itemsLoading;

  const requestCategoryCorrection = useCallback((itemId: string | null) => {
    setCorrectionItemId(itemId);
    setCorrectionShowPicker(true);
  }, []);

  // Filter items that are explicitly in today's shopping list
  const allItemsForDay = items.filter(i => !!state.inToday[i.id]);

  const checked = allItemsForDay.filter(i => state.checked[i.id]);
  const isComplete = checked.length === allItemsForDay.length && allItemsForDay.length > 0;

  useEffect(() => {
    if (isComplete) {
      setTimeout(() => {
        setCelebration('🎉 Sacola completa — bom mercado!');
        setCelebrationShow(true);
        burstConfetti();
      }, 0);
    }
  }, [isComplete]);

  const showToast = useCallback((msg: string) => {
    setCelebration(msg);
    setCelebrationShow(true);
    setTimeout(() => setCelebrationShow(false), 2500);
  }, []);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    try {
      setAuthLoading(true);
      await loginWithMagicLink(email.trim());
      setAuthSent(true);
      showToast('✉️ Magic Link enviado!');
    } catch (err) {
      console.error(err);
      showToast('❌ Erro ao enviar Magic Link.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleCategoryCorrection = useCallback(async (newCategory: string) => {
    if (correctionItemId == null) return;
    const item = items.find(i => i.id === correctionItemId);
    if (!item) return;
    const cat = getCategoryByKey(newCategory);
    const catName = cat ? cat.name : 'Outros';

    await syncCategory(correctionItemId, newCategory);
    setCorrectionShowPicker(false);
    setCorrectionItemId(null);
    showToast(`🔄 "${item.name}" movido para ${catName}`);
  }, [correctionItemId, items, syncCategory, showToast]);

  const handleInputChange = useCallback((value: string) => {
    setInputValue(value);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (value.trim().length < 2) {
      setShowSuggestions(false);
      setSuggestions([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      const results = await searchItems(value);
      setSuggestions(results);
      setShowSuggestions(results.length > 0);
    }, 150);
  }, [searchItems]);

  const handleSelectSuggestion = useCallback(async (item: ItemRecord) => {
    const itemName = item.name;
    setInputValue('');
    setShowSuggestions(false);

    const updatedItem: ItemRecord = {
      ...item,
      useCount: (item.useCount || 0) + 1,
      lastUsed: Date.now(),
    };

    // Bump the count locally FIRST, then hand the fresh values to
    // addItemToToday — it queues an 'add' sync entry using whatever item
    // object it's given, so a stale count here would leak into that entry
    // and drift the remote value behind the local one.
    await db.items.update(item.id, {
      useCount: updatedItem.useCount,
      lastUsed: updatedItem.lastUsed,
    });

    await addItemToToday(updatedItem);

    showToast(`🛒 "${itemName}" na lista!`);
  }, [addItemToToday, showToast]);

  const handleCreateNew = useCallback(async () => {
    const name = inputValue.trim();
    if (!name) return;

    const existing = items.find(i => i.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      await handleSelectSuggestion(existing);
      return;
    }

    setShowSuggestions(false);
    setInputValue('');

    try {
      const classification = await classifyItem(name);
      const emojis: Record<string, string> = {
        frutas: '🍎',
        bebidas: '🥤',
        mercearia: '🛒',
        casa: '🧻',
        outros: '📦',
      };
      const emoji = classification.emoji || emojis[classification.category] || '📦';
      const cat = getCategoryByKey(classification.category);
      const catName = cat ? cat.name : 'Outros';

      const newId = await addItem(name, classification.category, emoji);
      if (newId) {
        const newItemRecord: ItemRecord = {
          id: newId,
          name,
          category: classification.category,
          emoji,
          useCount: 1,
          lastUsed: Date.now(),
          userId: user?.id || '',
        };
        await addItemToToday(newItemRecord);
        showToast(`🆕 "${name}" em ${catName} — toque em ✏️ se quiser corrigir`);
        requestCategoryCorrection(newId);
      }
    } catch (err) {
      console.error('Failed to classify item:', err);
      const newId = await addItem(name, 'outros', '📦');
      if (newId) {
        const newItemRecord: ItemRecord = {
          id: newId,
          name,
          category: 'outros',
          emoji: '📦',
          useCount: 1,
          lastUsed: Date.now(),
          userId: user?.id || '',
        };
        await addItemToToday(newItemRecord);
        showToast(`🆕 "${name}" adicionado!`);
        requestCategoryCorrection(newId);
      }
    }
  }, [inputValue, items, handleSelectSuggestion, addItem, showToast, requestCategoryCorrection, addItemToToday, user]);

  const handleToggle = useCallback(async (item: ItemRecord) => {
    const willBeChecked = await toggleItem(item.id, item);
    if (willBeChecked) {
      showToast(`✅ ${item.name} — no carrinho!`);
    }
  }, [toggleItem, showToast]);

  const handlePostpone = useCallback(async (item: ItemRecord) => {
    await postponeItem(item.id);
    showToast(`🕒 ${item.name} — adiado para amanhã`);
  }, [postponeItem, showToast]);

  const handleReturnFromPostponed = useCallback(async (item: ItemRecord) => {
    await unpostponeItem(item.id);
    showToast(`📋 "${item.name}" — trazido de volta!`);
  }, [unpostponeItem, showToast]);

  const todayItems = allItemsForDay;
  const checkedCount = allItemsForDay.filter(i => state.checked[i.id]).length;
  const totalCount = allItemsForDay.length;
  const progressPct = totalCount ? (checkedCount / totalCount) * 100 : 0;

  const pendingByCategory = CATEGORIES
    .map(cat => ({
      cat,
      items: allItemsForDay.filter(i => i.category === cat.key && !state.checked[i.id]),
      total: allItemsForDay.filter(i => i.category === cat.key).length,
    }))
    .filter(g => g.items.length > 0);

  const concludedByCategory = CATEGORIES
    .map(cat => ({
      cat,
      items: allItemsForDay.filter(i => i.category === cat.key && state.checked[i.id]),
    }))
    .filter(g => g.items.length > 0);

  const postponedByCategory = CATEGORIES
    .map(cat => ({
      cat,
      items: items.filter(i => i.category === cat.key && state.postponed[i.id]),
    }))
    .filter(g => g.items.length > 0);

  const concludedItems = allItemsForDay.filter(i => state.checked[i.id]);
  const postponedItems = items.filter(i => state.postponed[i.id]);

  const { isInstallable, isIOS, install: installApp } = useInstallPrompt();

  // ─── LOGIN SCREEN RENDER ───
  if (!user && !stateLoading) {
    return (
      <div className="page">
        <div className="flags" aria-hidden="true">
          {Array.from({ length: 15 }).map((_, i) => <span key={i} />)}
        </div>
        <div className="login-wrap">
          <div className="login-card">
            <h1 className="login-title">Mercado</h1>
            <p className="login-desc">Lista de compras inteligente.<br />Insira seu e-mail para receber um link de acesso instantâneo.</p>
            {authSent ? (
              <div className="login-success">
                ✉️ Enviamos um Magic Link para seu e-mail! Verifique sua caixa de entrada e clique no link para entrar.
              </div>
            ) : (
              <form onSubmit={handleLoginSubmit} className="login-form">
                <input
                  type="email"
                  placeholder="Seu e-mail..."
                  className="login-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <button type="submit" className="login-submit-btn" disabled={authLoading}>
                  {authLoading ? 'Enviando...' : 'Receber Link de Acesso'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="flags" aria-hidden="true">
        {Array.from({ length: 15 }).map((_, i) => <span key={i} />)}
      </div>

      <header>
        <div className="header-top">
          <div className="basket">🧺</div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
              <h1>Mercado</h1>
              {syncStatus !== 'idle' && (
                <span className="sync-indicator">
                  {syncStatus === 'syncing' && '🔄 salvando...'}
                  {syncStatus === 'synced' && '✅ salvo'}
                  {syncStatus === 'error' && '⚠️ erro sync'}
                </span>
              )}
            </div>
            <p className="date">{dateStr}</p>
          </div>
          {isInstallable && (
            isIOS ? (
              <div
                className="ios-install-hint"
                onClick={() => setShowIosInstallModal(true)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setShowIosInstallModal(true);
                  }
                }}
                style={{ cursor: 'pointer' }}
                role="button"
                tabIndex={0}
                aria-label="Como instalar"
              >
                📲
              </div>
            ) : (
              <button
                className="install-btn"
                onClick={() => installApp()}
                aria-label="Instalar app"
                title="Instalar Mercado de Hoje"
              >
                📲
              </button>
            )
          )}
        </div>
        <div className="progress-wrap">
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${progressPct}%` }} />
          </div>
          <span className="progress-label">
            {loading ? 'carregando...' : `${checkedCount} de ${totalCount} no carrinho`}
          </span>
        </div>
        {stuckSyncCount > 0 && (
          <div className="stuck-sync-banner" role="alert">
            <span>
              ⚠️ {stuckSyncCount} {stuckSyncCount === 1 ? 'alteração não sincronizou' : 'alterações não sincronizaram'} depois de várias tentativas.
            </span>
            <button
              className="stuck-sync-retry-btn"
              onClick={handleRetryStuckSync}
              disabled={retryingStuck}
            >
              {retryingStuck ? 'Tentando...' : 'Tentar de novo'}
            </button>
          </div>
        )}
      </header>

      {/* ─── TABS ─── */}
      <div className="tabs-bar">
        {TABS.map(tab => {
          const count =
            tab.key === 'hoje'
              ? todayItems.length - checkedCount
              : tab.key === 'concluidos'
              ? concludedItems.length
              : postponedItems.length;
          return (
            <button
              key={tab.key}
              className={`tab-btn${activeTab === tab.key ? ' active' : ''}`}
              onClick={() => setActiveTab(tab.key)}
            >
              <span className="tab-emoji">{tab.emoji}</span>
              <span className="tab-label">{tab.label}</span>
              {count > 0 && <span className="tab-badge">{count}</span>}
            </button>
          );
        })}
      </div>

      <main>
        {/* ─── ADD INPUT ─── */}
        <div className="add-section">
          <div className="add-input-wrap">
            <input
              className="add-input"
              type="text"
              placeholder="Adicionar item..."
              value={inputValue}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && inputValue.trim() && !showSuggestions) {
                  handleCreateNew();
                }
              }}
              aria-label="Adicionar novo item à lista"
              autoComplete="off"
            />
            <button
              className="add-btn"
              onClick={handleCreateNew}
              aria-label="Adicionar item"
            >
              +
            </button>
          </div>

          {showSuggestions && (
            <div className="autocomplete">
              {suggestions.map(item => {
                const cat = getCategoryByKey(item.category);
                const alreadyOnList = allItemsForDay.some(i => i.id === item.id);
                const isPostponed = state.postponed[item.id];
                return (
                  <div
                    key={item.id}
                    className={`autocomplete-item${isPostponed ? ' postponed' : ''}`}
                    onClick={() => handleSelectSuggestion(item)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleSelectSuggestion(item);
                      }
                    }}
                    role="option"
                    tabIndex={0}
                    aria-label={`${
                      isPostponed
                        ? 'Trazer de volta'
                        : alreadyOnList
                        ? 'Já na lista'
                        : 'Adicionar'
                    } ${item.name}`}
                  >
                    <span className="cat-dot" style={{ background: cat?.color }} />
                    <span>{item.emoji}</span>
                    <span className="name">{item.name}</span>
                    <span className="freq">
                      {isPostponed
                        ? '🕒 adiado'
                        : alreadyOnList
                        ? '✓ na lista'
                        : `x${item.useCount}`}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Category correction picker */}
          {correctionShowPicker && (
            <div className="correction-picker">
              <div className="correction-title">Está certo?</div>
              <div className="correction-categories">
                {CATEGORIES.map(cat => (
                  <button
                    key={cat.key}
                    className="correction-cat-btn"
                    style={{ '--cat-color': cat.color, '--cat-bg': cat.bgColor } as React.CSSProperties}
                    onClick={() => handleCategoryCorrection(cat.key)}
                  >
                    <span className="cat-emoji">{cat.emoji}</span>
                    <span className="cat-name">{cat.name}</span>
                  </button>
                ))}
                <button
                  className="correction-cat-btn correct"
                  onClick={() => {
                    setCorrectionShowPicker(false);
                    setCorrectionItemId(null);
                    showToast('✅ Categoria mantida');
                  }}
                >
                  <span className="cat-emoji">✅</span>
                  <span className="cat-name">Correto!</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ─── TAB CONTENT ─── */}
        {loading ? (
          <div className="empty-state">
            <div className="emoji">🧺</div>
            <div className="text">Carregando lista...</div>
          </div>
        ) : itemsError ? (
          <div className="error-state">
            <div className="emoji">⚠️</div>
            <div className="text">Erro ao carregar os dados</div>
            <div className="text" style={{ marginTop: 4 }}>{itemsError}</div>
            <button
              className="retry-btn"
              onClick={() => {
                window.location.reload();
              }}
            >
              Tentar novamente
            </button>
          </div>
        ) : activeTab === 'hoje' ? (
          pendingByCategory.length === 0 ? (
            <div className="empty-state">
              <div className="emoji">✅</div>
              <div className="text">Tudo no carrinho!</div>
              <div className="text" style={{ marginTop: 4 }}>Boas compras!</div>
            </div>
          ) : (
            pendingByCategory.map(({ cat, items: catItems, total }) => (
              <div className="category" key={cat.key}>
                <div className="category-head">
                  <span className="emoji">{cat.emoji}</span>
                  <h2>{cat.name}</h2>
                  <span className="count">
                    {total - catItems.length}/{total}
                  </span>
                </div>
                {catItems.map(item => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    cat={cat}
                    checked={false}
                    onToggle={() => handleToggle(item)}
                    onPostpone={() => handlePostpone(item)}
                    showPostpone
                  />
                ))}
              </div>
            ))
          )
        ) : activeTab === 'concluidos' ? (
          concludedItems.length === 0 ? (
            <div className="empty-state">
              <div className="emoji">🛒</div>
              <div className="text">Nenhum concluído ainda</div>
              <div className="text" style={{ marginTop: 4 }}>Marque os itens na aba Hoje</div>
            </div>
          ) : (
            concludedByCategory.map(({ cat, items: catItems }) => (
              <div className="category concluded" key={cat.key}>
                <div className="category-head">
                  <span className="emoji">{cat.emoji}</span>
                  <h2>{cat.name}</h2>
                  <span className="count">{catItems.length}/{catItems.length}</span>
                </div>
                {catItems.map(item => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    cat={cat}
                    checked={true}
                    onToggle={() => handleToggle(item)}
                    showPostpone={false}
                  />
                ))}
              </div>
            ))
          )
        ) : (
          // ─── PRÓXIMO (adiados) ───
          postponedItems.length === 0 ? (
            <div className="empty-state">
              <div className="emoji">🕒</div>
              <div className="text">Nenhum adiado</div>
              <div className="text" style={{ marginTop: 4 }}>
                Use o botão 🕒 para adiar itens
              </div>
            </div>
          ) : (
            postponedByCategory.map(({ cat, items: catItems }) => (
              <div className="category postponed" key={cat.key}>
                <div className="category-head">
                  <span className="emoji">{cat.emoji}</span>
                  <h2>{cat.name}</h2>
                  <span className="count">{catItems.length}</span>
                </div>
                {catItems.map(item => {
                  const catInfo = getCategoryByKey(item.category) || cat;
                  return (
                    <div
                      key={item.id}
                      className="item postponed-item"
                      style={{
                        '--cat-color': catInfo.color,
                        '--cat-bg': catInfo.bgColor,
                      } as React.CSSProperties}
                      onClick={() => handleReturnFromPostponed(item)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleReturnFromPostponed(item);
                        }
                      }}
                      role="button"
                      aria-label={`Trazer ${item.name} de volta para hoje`}
                      tabIndex={0}
                    >
                      <span className="emoji-tag">{item.emoji}</span>
                      <span className="name">{item.name}</span>
                      {item.qty && item.qty > 1 && <span className="qty">{item.qty}x</span>}
                      <span className="return-btn" title="Trazer de volta para hoje">
                        ↩
                      </span>
                    </div>
                  );
                })}
              </div>
            ))
          )
        )}
      </main>

      <footer>
        <div className="footer-buttons">
          <button className="logout-btn" onClick={logout}>
            Sair da conta
          </button>
          <button className="reset-btn" onClick={resetAll}>
            Limpar marcações
          </button>
        </div>
      </footer>

      {/* iOS Installation Modal */}
      {showIosInstallModal && (
        <div className="modal-backdrop" onClick={() => setShowIosInstallModal(false)}>
          <div className="ios-modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="ios-modal-title">Instalar no iPhone</h2>
            <div className="ios-modal-steps">
              <div className="ios-modal-step">
                <span className="ios-modal-step-number">1</span>
                <span>Toque no botão de **Compartilhar** 📤 na barra inferior do Safari.</span>
              </div>
              <div className="ios-modal-step">
                <span className="ios-modal-step-number">2</span>
                <span>Role a lista de opções para baixo e selecione **Adicionar à Tela de Início** ➕.</span>
              </div>
              <div className="ios-modal-step">
                <span className="ios-modal-step-number">3</span>
                <span>Confirme o nome do aplicativo e toque em **Adicionar** no canto superior direito.</span>
              </div>
            </div>
            <button className="ios-modal-close-btn" onClick={() => setShowIosInstallModal(false)}>
              Entendi
            </button>
          </div>
        </div>
      )}

      <div className={`celebration${celebrationShow ? ' show' : ''}`}>{celebration}</div>
    </div>
  );
}

function burstConfetti() {
  const emojis = ['🎉', '🍓', '🍌', '✨', '🛒'];
  for (let i = 0; i < 12; i++) {
    const el = document.createElement('div');
    el.className = 'confetti-piece';
    el.textContent = emojis[Math.floor(Math.random() * emojis.length)];
    el.style.cssText = `
      position: fixed;
      left: ${Math.random() * 100}vw;
      top: -20px;
      font-size: ${18 + Math.random() * 18}px;
      pointer-events: none;
      z-index: 9999;
      animation: confettiFall ${2 + Math.random() * 2}s ease-in forwards;
    `;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 4000);
  }
}
