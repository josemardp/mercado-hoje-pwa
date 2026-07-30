import { useState, useEffect, useCallback, useMemo, useRef, memo, lazy, Suspense } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { useDayState, useItems } from './lib/useStore';
import { AuthProvider, useAuth } from './lib/AuthProvider';
import { CATEGORIES, getCategoryByKey, getTodayKey, formatDateBR } from './lib/categories';
import { db, type ItemRecord } from './lib/db';
import { useInstallPrompt } from './lib/useInstallPrompt';
import { classifyItem } from './lib/classifyCategory';
import { ROTINA_STEPS } from './lib/rotinaSteps';
import { useRotinaState } from './lib/useRotinaState';
import { useAgendaState } from './lib/useAgendaState';
import Modal from './Modal';
import { logError } from './lib/logger';
import { fetchUserDataForExport, downloadJSON } from './lib/exportData';

// S6-01: RotinaTab pulls in AgendaPlanner, agendaScheduler and its own CSS
// (rotinaStyles.css) — none of that is needed until the user actually opens
// the Rotina tab, so it's split into its own chunk instead of the initial
// bundle. The data hooks (useRotinaState/useAgendaState above) stay eager
// because their counts feed the tab badge before the tab is ever opened.
const RotinaTab = lazy(() => import('./RotinaTab'));

// stroke uses var(--on-accent), not a hardcoded white: in dark mode the
// checked category color is a bright tint, and white-on-bright fails contrast.
const CHECK_SVG = '<svg viewBox="0 0 24 24" fill="none"><path d="M4 12.5L9.5 18L20 6" stroke="var(--on-accent)" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

type TabKey = 'hoje' | 'concluidos' | 'proximo' | 'rotina';

const TABS: { key: TabKey; label: string; emoji: string }[] = [
  { key: 'hoje', label: 'Compras hoje', emoji: '🛒' },
  { key: 'concluidos', label: 'Compras concluídas', emoji: '✅' },
  { key: 'proximo', label: 'Próximas compras', emoji: '🕒' },
  { key: 'rotina', label: 'Rotina', emoji: '🌅' },
];

const ItemRow = memo(function ItemRow({
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
  onToggle: (item: ItemRecord) => void;
  onPostpone?: (item: ItemRecord) => void;
  showPostpone?: boolean;
}) {
  return (
    <div
      className={`item${checked ? ' checked' : ''}`}
      style={{ '--cat-color': cat.color, '--cat-bg': cat.bgColor } as React.CSSProperties}
      onClick={() => onToggle(item)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onToggle(item);
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
            onPostpone(item);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              e.stopPropagation();
              onPostpone(item);
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
});

function AppInner() {
  const { user, passwordRecovery, clearPasswordRecovery, authLinkError } = useAuth();

  const {
    signInWithPassword,
    sendPasswordReset,
    updatePassword,
    logout,
    state,
    loading: stateLoading,
    syncStatus,
    toggleItem,
    postponeItem,
    unpostponeItem,
    unmarkAllChecked,
    resetAll,
    addItemToToday,
    syncCategory,
    stuckSyncCount,
    retryStuckEntries,
    processSyncQueue,
  } = useDayState(user);

  const [retryingStuck, setRetryingStuck] = useState(false);
  const handleRetryStuckSync = useCallback(async () => {
    setRetryingStuck(true);
    try {
      await retryStuckEntries();
    } finally {
      setRetryingStuck(false);
    }
  }, [retryStuckEntries]);

  const { items, loading: itemsLoading, error: itemsError, addItem, searchItems } = useItems(user);

  const rotinaState = useRotinaState(user);
  const agendaState = useAgendaState(user);

  // AUD-010: "Limpar marcações" used to fire resetAll() (which wipes the
  // whole day's list, not just the checkmarks the label implied) with zero
  // confirmation. Armed two-tap confirm, same convention as Rotina/Agenda's
  // reset button — separate armed state so switching context can't leave a
  // stale confirmation pointed at the wrong action (see RotinaTab.tsx).
  const [clearListArmed, setClearListArmed] = useState(false);
  const handleClearListClick = useCallback(() => {
    if (!clearListArmed) {
      setClearListArmed(true);
      setTimeout(() => setClearListArmed(false), 2600);
    } else {
      resetAll();
      setClearListArmed(false);
    }
  }, [clearListArmed, resetAll]);

  // AUD-007: logout used to clear every local table/queue unconditionally,
  // silently discarding anything that hadn't synced yet (including entries
  // that failed repeatedly and were already flagged as "stuck"). Count
  // pending entries across all three domains before allowing it through,
  // and offer to sync first instead of just warning after the fact.
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [logoutPendingCount, setLogoutPendingCount] = useState<number | null>(null);
  const [syncingBeforeLogout, setSyncingBeforeLogout] = useState(false);

  const countAllPendingSync = useCallback(async () => {
    const [compras, rotina, agenda] = await Promise.all([
      db.syncQueue.count(),
      db.rotinaSyncQueue.count(),
      db.agendaSyncQueue.count(),
    ]);
    return compras + rotina + agenda;
  }, []);

  const handleLogoutClick = useCallback(async () => {
    setLogoutPendingCount(await countAllPendingSync());
    setShowLogoutConfirm(true);
  }, [countAllPendingSync]);

  const handleSyncNowBeforeLogout = useCallback(async () => {
    setSyncingBeforeLogout(true);
    try {
      await Promise.all([
        processSyncQueue(),
        rotinaState.processSyncQueue(),
        agendaState.processSyncQueue(),
      ]);
      setLogoutPendingCount(await countAllPendingSync());
    } finally {
      setSyncingBeforeLogout(false);
    }
  }, [processSyncQueue, rotinaState, agendaState, countAllPendingSync]);

  const handleConfirmLogout = useCallback(async () => {
    setShowLogoutConfirm(false);
    await logout();
  }, [logout]);

  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(scriptUrl, registration) {
      console.info('[sw] registered', { scriptUrl, scope: registration?.scope });
    },
    onNeedRefresh() {
      console.info('[sw] new version waiting');
    },
    onRegisterError(err) {
      logError('Failed to register service worker', err);
    },
  });

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [forgotMode, setForgotMode] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const [showChangePassword, setShowChangePassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');
  const [changePasswordStatus, setChangePasswordStatus] = useState<'idle' | 'saving' | 'error'>('idle');

  // Landing here via an "esqueci minha senha" email link fires
  // PASSWORD_RECOVERY — surface the "definir nova senha" step right away
  // instead of leaving it hidden behind the footer button. Adjusted during
  // render (comparing against the previous value) rather than in a
  // useEffect — this repo's lint rules flag a bare setState call inside an
  // effect body as a likely-avoidable render (see RotinaTab.tsx for the
  // same pattern).
  const [prevPasswordRecovery, setPrevPasswordRecovery] = useState(passwordRecovery);
  if (passwordRecovery !== prevPasswordRecovery) {
    setPrevPasswordRecovery(passwordRecovery);
    if (passwordRecovery) setShowChangePassword(true);
  }

  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState<ItemRecord[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  // AUD-017: ARIA combobox pattern — the input keeps real DOM focus; arrow
  // keys move this "virtual" highlight instead of tabbing between options.
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [correctionItemId, setCorrectionItemId] = useState<string | null>(null);
  const [correctionShowPicker, setCorrectionShowPicker] = useState(false);
  const [celebration, setCelebration] = useState('');
  const [celebrationShow, setCelebrationShow] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>(() =>
    new URLSearchParams(window.location.search).get('tab') === 'rotina' ? 'rotina' : 'hoje'
  );
  const [showIosInstallModal, setShowIosInstallModal] = useState(false);
  
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const addInputRef = useRef<HTMLInputElement>(null);
  const tabRefs = useRef<Partial<Record<TabKey, HTMLButtonElement | null>>>({});

  // PWA manifest shortcut ("Adicionar item", long-press the app icon) lands
  // here with ?action=add-item. Wait for auth to resolve either way: if
  // logged in, focus the add field; if not (session expired/never logged
  // in), still strip the param so it doesn't linger in the URL forever.
  useEffect(() => {
    if (stateLoading) return;
    if (new URLSearchParams(window.location.search).get('action') === 'add-item') {
      if (user) addInputRef.current?.focus();
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, [user, stateLoading]);

  // PWA manifest shortcut ("Rotina", long-press the app icon) lands here
  // with ?tab=rotina — activeTab's lazy initializer above already reads it,
  // this effect only strips the param so it doesn't linger in the URL.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('tab') === 'rotina') {
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, []);

  const todayKey = getTodayKey();
  const dateStr = formatDateBR(todayKey);
  const loading = stateLoading || itemsLoading;

  const requestCategoryCorrection = useCallback((itemId: string | null) => {
    setCorrectionItemId(itemId);
    setCorrectionShowPicker(true);
  }, []);

  // Filter items that are explicitly in today's shopping list
  const allItemsForDay = useMemo(
    () => items.filter(i => !!state.inToday[i.id]),
    [items, state.inToday],
  );

  const isComplete = useMemo(() => {
    const checkedCount = allItemsForDay.filter(i => state.checked[i.id]).length;
    return checkedCount === allItemsForDay.length && allItemsForDay.length > 0;
  }, [allItemsForDay, state.checked]);

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
    setAuthError('');

    if (forgotMode) {
      if (!email.trim()) return;
      try {
        setAuthLoading(true);
        await sendPasswordReset(email.trim());
        setResetSent(true);
      } catch (err) {
        logError('Failed to send password reset', err);
        setAuthError('Não deu pra enviar o link de redefinição. Confira o e-mail.');
      } finally {
        setAuthLoading(false);
      }
      return;
    }

    if (!email.trim() || !password) return;
    try {
      setAuthLoading(true);
      await signInWithPassword(email.trim(), password);
    } catch (err) {
      logError('Failed to sign in', err);
      setAuthError('E-mail ou senha incorretos.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleChangePasswordSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6 || newPassword !== newPasswordConfirm) {
      setChangePasswordStatus('error');
      return;
    }
    try {
      setChangePasswordStatus('saving');
      await updatePassword(newPassword);
      setShowChangePassword(false);
      setNewPassword('');
      setNewPasswordConfirm('');
      setChangePasswordStatus('idle');
      clearPasswordRecovery();
      showToast('🔒 Senha atualizada!');
    } catch (err) {
      logError('Failed to update password', err);
      setChangePasswordStatus('error');
    }
  }, [newPassword, newPasswordConfirm, updatePassword, showToast, clearPasswordRecovery]);

  const [exportingData, setExportingData] = useState(false);
  const handleExportData = useCallback(async () => {
    if (!user || exportingData) return;
    setExportingData(true);
    try {
      const data = await fetchUserDataForExport(user.id);
      downloadJSON(`meu-diario-backup-${getTodayKey()}.json`, data);
      showToast('📦 Backup baixado!');
    } catch (err) {
      logError('Failed to export user data', err);
      showToast('⚠️ Não deu pra exportar. Tente de novo.');
    } finally {
      setExportingData(false);
    }
  }, [user, exportingData, showToast]);

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
    setHighlightedIndex(-1);

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
      logError('Failed to classify item', err);
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

  const pendingByCategory = useMemo(() => CATEGORIES
    .map(cat => ({
      cat,
      items: allItemsForDay.filter(i => i.category === cat.key && !state.checked[i.id]),
      total: allItemsForDay.filter(i => i.category === cat.key).length,
    }))
    .filter(g => g.items.length > 0), [allItemsForDay, state.checked]);

  const concludedByCategory = useMemo(() => CATEGORIES
    .map(cat => ({
      cat,
      items: allItemsForDay.filter(i => i.category === cat.key && state.checked[i.id]),
    }))
    .filter(g => g.items.length > 0), [allItemsForDay, state.checked]);

  const postponedByCategory = useMemo(() => CATEGORIES
    .map(cat => ({
      cat,
      items: items.filter(i => i.category === cat.key && state.postponed[i.id]),
    }))
    .filter(g => g.items.length > 0), [items, state.postponed]);

  const concludedItems = useMemo(
    () => allItemsForDay.filter(i => state.checked[i.id]),
    [allItemsForDay, state.checked],
  );
  const postponedItems = useMemo(
    () => items.filter(i => state.postponed[i.id]),
    [items, state.postponed],
  );

  const { isInstallable, isIOS, install: installApp } = useInstallPrompt();

  // ─── LOGIN SCREEN RENDER ───
  if (!user && !stateLoading) {
    return (
      <div className="page">
        <div className="login-wrap">
          <div className="login-card">
            <h1 className="login-title">Meu Diário</h1>
            <p className="login-desc">Compras, rotina e agenda no seu dia a dia.</p>
            {authLinkError && (
              <div className="login-error" role="alert" style={{ marginBottom: 12 }}>{authLinkError}</div>
            )}
            {resetSent ? (
              <div className="login-success" role="status">
                ✉️ Enviamos um link de redefinição de senha pro seu e-mail! Verifique sua caixa de entrada.
              </div>
            ) : (
              <form onSubmit={handleLoginSubmit} className="login-form">
                <input
                  type="email"
                  name="email"
                  placeholder="Seu e-mail..."
                  className="login-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="username"
                  required
                />
                {!forgotMode && (
                  <div className="login-password-wrap">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      placeholder="Sua senha..."
                      className="login-input"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="current-password"
                      required
                    />
                    <button
                      type="button"
                      className="login-password-toggle"
                      onClick={() => setShowPassword(v => !v)}
                      aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                      aria-pressed={showPassword}
                    >
                      {showPassword ? (
                        <svg viewBox="0 0 24 24" fill="none" width="20" height="20" aria-hidden="true">
                          <path d="M3 3L21 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                          <path d="M10.6 5.1A10.9 10.9 0 0 1 12 5c5 0 9 3.5 10 7-.4 1.3-1.1 2.6-2.1 3.7M6.7 6.7C4.6 8 3 9.9 2 12c1 3.5 5 7 10 7 1.4 0 2.7-.3 3.9-.7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      ) : (
                        <svg viewBox="0 0 24 24" fill="none" width="20" height="20" aria-hidden="true">
                          <path d="M2 12C3 8.5 7 5 12 5s9 3.5 10 7c-1 3.5-5 7-10 7s-9-3.5-10-7Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
                        </svg>
                      )}
                    </button>
                  </div>
                )}
                {authError && <div className="login-error" role="alert">{authError}</div>}
                <button type="submit" className="login-submit-btn" disabled={authLoading}>
                  {authLoading
                    ? (forgotMode ? 'Enviando...' : 'Entrando...')
                    : (forgotMode ? 'Enviar link de redefinição' : 'Entrar')}
                </button>
                <button
                  type="button"
                  className="login-forgot-link"
                  onClick={() => { setForgotMode(f => !f); setAuthError(''); }}
                >
                  {forgotMode ? '← Voltar pro login' : 'Esqueci minha senha'}
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

      {needRefresh && (
        <div className="update-banner update-banner-global" role="status">
          <span>✨ Nova versão disponível.</span>
          <button
            className="update-banner-btn"
            onClick={() => updateServiceWorker(true)}
          >
            Atualizar
          </button>
        </div>
      )}

      {activeTab !== 'rotina' && (
      <header>
        <div className="header-top">
          <div className="basket">📔</div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
              <h1>Meu Diário</h1>
              {syncStatus !== 'idle' && (
                <span className="sync-indicator" role="status" aria-live="polite">
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
                title="Instalar Meu Diário"
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
      )}

      {/* ─── TABS (AUD-017: role="tablist"/"tab", seta/Home/End, roving tabindex) ─── */}
      {(() => {
        // Visual order (Rotina on its own row above the three Compras tabs)
        // is also the keyboard traversal order — arrows move through this
        // flat sequence regardless of which row a tab is visually in.
        const tabOrder: TabKey[] = ['rotina', 'hoje', 'concluidos', 'proximo'];

        const handleTabKeyDown = (e: React.KeyboardEvent, key: TabKey) => {
          const idx = tabOrder.indexOf(key);
          let nextIdx: number | null = null;
          if (e.key === 'ArrowRight' || e.key === 'ArrowDown') nextIdx = (idx + 1) % tabOrder.length;
          else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') nextIdx = (idx - 1 + tabOrder.length) % tabOrder.length;
          else if (e.key === 'Home') nextIdx = 0;
          else if (e.key === 'End') nextIdx = tabOrder.length - 1;
          if (nextIdx === null) return;
          e.preventDefault();
          const nextKey = tabOrder[nextIdx];
          setActiveTab(nextKey);
          tabRefs.current[nextKey]?.focus();
        };

        const renderTab = (tab: (typeof TABS)[number]) => {
          const count =
            tab.key === 'hoje'
              ? todayItems.length - checkedCount
              : tab.key === 'concluidos'
              ? concludedItems.length
              : tab.key === 'proximo'
              ? postponedItems.length
              : ROTINA_STEPS.length - Object.keys(rotinaState.done).length;
          const selected = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              ref={el => { tabRefs.current[tab.key] = el; }}
              role="tab"
              id={`tab-${tab.key}`}
              aria-selected={selected}
              aria-controls={`panel-${tab.key}`}
              tabIndex={selected ? 0 : -1}
              className={`tab-btn${selected ? ' active' : ''}`}
              onClick={() => setActiveTab(tab.key)}
              onKeyDown={e => handleTabKeyDown(e, tab.key)}
            >
              <span className="tab-emoji">{tab.emoji}</span>
              <span className="tab-label">{tab.label}</span>
              {count > 0 && <span className="tab-badge">{count}</span>}
            </button>
          );
        };
        const rotinaTab = TABS.find(t => t.key === 'rotina')!;
        const comprasTabs = TABS.filter(t => t.key !== 'rotina');
        return (
          <div className="tabs-bar tabs-bar-pyramid" role="tablist" aria-label="Seções do app">
            <div className="tabs-row tabs-row-top">{renderTab(rotinaTab)}</div>
            <div className="tabs-row tabs-row-bottom">{comprasTabs.map(renderTab)}</div>
          </div>
        );
      })()}

      <main
        className={activeTab === 'rotina' ? 'main-rotina' : undefined}
        role="tabpanel"
        id={`panel-${activeTab}`}
        aria-labelledby={`tab-${activeTab}`}
      >
        {activeTab === 'rotina' ? (
          <Suspense fallback={null}>
            <RotinaTab {...rotinaState} agenda={agendaState} />
          </Suspense>
        ) : (
        <>
        {/* ─── ADD INPUT ─── */}
        <div className="add-section">
          <div className="add-input-wrap">
            <input
              ref={addInputRef}
              className="add-input"
              type="text"
              placeholder="Adicionar item..."
              value={inputValue}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={(e) => {
                if (showSuggestions && suggestions.length > 0) {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setHighlightedIndex(i => (i + 1) % suggestions.length);
                    return;
                  }
                  if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setHighlightedIndex(i => (i - 1 + suggestions.length) % suggestions.length);
                    return;
                  }
                  if (e.key === 'Escape') {
                    setShowSuggestions(false);
                    setHighlightedIndex(-1);
                    return;
                  }
                  if (e.key === 'Enter' && highlightedIndex >= 0) {
                    e.preventDefault();
                    handleSelectSuggestion(suggestions[highlightedIndex]);
                    return;
                  }
                }
                if (e.key === 'Enter' && inputValue.trim() && !showSuggestions) {
                  handleCreateNew();
                }
              }}
              aria-label="Adicionar novo item à lista"
              autoComplete="off"
              role="combobox"
              aria-expanded={showSuggestions}
              aria-controls="add-suggestions-listbox"
              aria-autocomplete="list"
              aria-activedescendant={highlightedIndex >= 0 ? `suggestion-${suggestions[highlightedIndex]?.id}` : undefined}
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
            <div className="autocomplete" role="listbox" id="add-suggestions-listbox" aria-label="Sugestões de itens">
              {suggestions.map((item, index) => {
                const cat = getCategoryByKey(item.category);
                const alreadyOnList = allItemsForDay.some(i => i.id === item.id);
                const isPostponed = state.postponed[item.id];
                return (
                  <div
                    key={item.id}
                    id={`suggestion-${item.id}`}
                    className={`autocomplete-item${isPostponed ? ' postponed' : ''}${index === highlightedIndex ? ' highlighted' : ''}`}
                    onClick={() => handleSelectSuggestion(item)}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    role="option"
                    aria-selected={index === highlightedIndex}
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
            totalCount === 0 ? (
              <div className="empty-state">
                <div className="emoji">🧺</div>
                <div className="text">Sua lista está vazia</div>
                <div className="text" style={{ marginTop: 4 }}>Adicione um item acima pra começar.</div>
              </div>
            ) : (
              <div className="empty-state">
                <div className="emoji">✅</div>
                <div className="text">Tudo no carrinho!</div>
                <div className="text" style={{ marginTop: 4 }}>Boas compras!</div>
              </div>
            )
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
                    onToggle={handleToggle}
                    onPostpone={handlePostpone}
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
                    onToggle={handleToggle}
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
        </>
        )}
      </main>

      <footer>
        <div className="footer-buttons">
          <button className="logout-btn" onClick={handleLogoutClick}>
            Sair da conta
          </button>
          {activeTab !== 'rotina' && checkedCount > 0 && (
            <button className="reset-btn" onClick={unmarkAllChecked}>
              Desmarcar concluídos
            </button>
          )}
          {activeTab !== 'rotina' && (
            <button
              className={`reset-btn${clearListArmed ? ' reset-btn-confirming' : ''}`}
              onClick={handleClearListClick}
            >
              {clearListArmed ? 'Confirmar limpeza da lista' : 'Limpar lista do dia'}
            </button>
          )}
        </div>
        <div className="footer-links">
          <button
            className="login-forgot-link"
            onClick={handleExportData}
            disabled={exportingData}
          >
            {exportingData ? 'Exportando...' : 'Exportar meus dados'}
          </button>
          <button
            className="login-forgot-link"
            onClick={() => setShowChangePassword(true)}
          >
            Alterar senha
          </button>
        </div>
      </footer>

      {/* Logout confirmation modal (AUD-007) */}
      {showLogoutConfirm && (
        <Modal titleId="logout-modal-title" onClose={() => setShowLogoutConfirm(false)}>
          <h2 className="ios-modal-title" id="logout-modal-title">Sair da conta?</h2>
            {logoutPendingCount === null ? (
              <p>Verificando pendências...</p>
            ) : logoutPendingCount > 0 ? (
              <>
                <p>
                  Você tem {logoutPendingCount} {logoutPendingCount === 1 ? 'alteração' : 'alterações'} que ainda{' '}
                  {logoutPendingCount === 1 ? 'não sincronizou' : 'não sincronizaram'}. Sair agora vai descartá-la{logoutPendingCount === 1 ? '' : 's'}.
                </p>
                <button
                  className="login-submit-btn"
                  onClick={handleSyncNowBeforeLogout}
                  disabled={syncingBeforeLogout}
                >
                  {syncingBeforeLogout ? 'Sincronizando...' : 'Sincronizar agora'}
                </button>
                <button className="reset-btn" onClick={handleConfirmLogout}>
                  Sair mesmo assim (descartar)
                </button>
              </>
            ) : (
              <p>Tudo sincronizado. Tem certeza que quer sair?</p>
            )}
            {logoutPendingCount === 0 && (
              <button className="login-submit-btn" onClick={handleConfirmLogout}>
                Sair
              </button>
            )}
            <button className="login-forgot-link" onClick={() => setShowLogoutConfirm(false)}>
              Cancelar
            </button>
        </Modal>
      )}

      {/* Change password modal */}
      {showChangePassword && (
        <Modal titleId="change-password-modal-title" onClose={() => setShowChangePassword(false)}>
          <h2 className="ios-modal-title" id="change-password-modal-title">Alterar senha</h2>
            <form onSubmit={handleChangePasswordSubmit} className="login-form">
              <input
                type="password"
                placeholder="Nova senha (mín. 6 caracteres)..."
                className="login-input"
                value={newPassword}
                onChange={(e) => { setNewPassword(e.target.value); setChangePasswordStatus('idle'); }}
                autoComplete="new-password"
                required
                minLength={6}
              />
              <input
                type="password"
                placeholder="Confirme a nova senha..."
                className="login-input"
                value={newPasswordConfirm}
                onChange={(e) => { setNewPasswordConfirm(e.target.value); setChangePasswordStatus('idle'); }}
                autoComplete="new-password"
                required
                minLength={6}
              />
              {changePasswordStatus === 'error' && (
                <div className="login-error" role="alert">
                  {newPassword.length < 6
                    ? 'A senha precisa ter pelo menos 6 caracteres.'
                    : newPassword !== newPasswordConfirm
                    ? 'As senhas não coincidem.'
                    : 'Não deu pra salvar a senha. Tenta de novo.'}
                </div>
              )}
              <button type="submit" className="login-submit-btn" disabled={changePasswordStatus === 'saving'}>
                {changePasswordStatus === 'saving' ? 'Salvando...' : 'Salvar senha'}
              </button>
            </form>
        </Modal>
      )}

      {/* iOS Installation Modal */}
      {showIosInstallModal && (
        <Modal titleId="ios-install-modal-title" onClose={() => setShowIosInstallModal(false)}>
          <h2 className="ios-modal-title" id="ios-install-modal-title">Instalar no iPhone</h2>
            <div className="ios-modal-steps">
              <div className="ios-modal-step">
                <span className="ios-modal-step-number">1</span>
                <span>Toque no botão de <strong>Compartilhar</strong> 📤 na barra inferior do Safari.</span>
              </div>
              <div className="ios-modal-step">
                <span className="ios-modal-step-number">2</span>
                <span>Role a lista de opções para baixo e selecione <strong>Adicionar à Tela de Início</strong> ➕.</span>
              </div>
              <div className="ios-modal-step">
                <span className="ios-modal-step-number">3</span>
                <span>Confirme o nome do aplicativo e toque em <strong>Adicionar</strong> no canto superior direito.</span>
              </div>
            </div>
            <button className="ios-modal-close-btn" onClick={() => setShowIosInstallModal(false)}>
              Entendi
            </button>
        </Modal>
      )}

      <div className={`celebration${celebrationShow ? ' show' : ''}`} role="status" aria-live="polite">{celebration}</div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  );
}

function burstConfetti() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

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
