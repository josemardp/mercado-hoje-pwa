import { useState, useCallback, useEffect } from 'react';

export interface InstallPromptInfo {
  isInstallable: boolean;
  isIOS: boolean;
  install: () => Promise<boolean>;
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function isIOSDevice(): boolean {
  const ua = navigator.userAgent;
  const isIOS = /iPhone|iPad|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  return isIOS;
}

function isInStandaloneMode(): boolean {
  const nav = window.navigator as unknown as Record<string, unknown>;
  const standalone = nav.standalone === true;
  const displayMode = window.matchMedia('(display-mode: standalone)').matches;
  return standalone || displayMode;
}

export function useInstallPrompt(): InstallPromptInfo {
  const isIOS = isIOSDevice();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  // isInstallable is derived: true if iOS and not standalone, or if beforeinstallprompt fired
  const isInstallable = isIOS ? !isInStandaloneMode() : deferredPrompt !== null;

  useEffect(() => {
    if (isIOS) return; // iOS doesn't use beforeinstallprompt

    const handler = (e: Event) => {
      const promptEvent = e as BeforeInstallPromptEvent;
      promptEvent.preventDefault();
      setDeferredPrompt(promptEvent);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, [isIOS]);

  const install = useCallback(async () => {
    if (isIOS) return false;
    if (!deferredPrompt) return false;
    deferredPrompt.prompt();
    const choiceResult = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    return choiceResult.outcome === 'accepted';
  }, [deferredPrompt, isIOS]);

  return { isInstallable, isIOS, install };
}
