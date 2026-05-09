import type { CodesignApi } from '../../preload/index';

/**
 * A browser-native polyfill for the Electron-only `window.codesign` API.
 * This allows the app to run as a pure web app on Vercel, using localStorage
 * for state and fetch for the AI generation backend.
 */
export function initializeWebPolyfill(): void {
  if (typeof window === 'undefined' || window.codesign) return;

  const storage = {
    get: (key: string) => JSON.parse(localStorage.getItem(`codesign:${key}`) || 'null'),
    set: (key: string, val: any) => localStorage.setItem(`codesign:${key}`, JSON.stringify(val)),
  };

  const polyfill: Partial<CodesignApi> = {
    detectProvider: async (key: string) => {
      if (key.startsWith('sk-ant-')) return 'anthropic';
      if (key.startsWith('sk-or-')) return 'openrouter';
      if (key.startsWith('sk-')) return 'openai';
      if (key.startsWith('AIza')) return 'google';
      return null;
    },

    onboarding: {
      getState: async () => {
        const config = storage.get('config') || { hasKey: false, provider: null, modelPrimary: null };
        return {
          ...config,
          baseUrl: config.baseUrl || null,
          designSystem: null,
        };
      },
      validateKey: async () => ({ ok: true, modelCount: 1 }),
      saveKey: async (input: any) => {
        const next = { hasKey: true, provider: input.provider, modelPrimary: input.modelPrimary, baseUrl: input.baseUrl };
        storage.set('config', next);
        return { ...next, designSystem: null };
      },
      skip: async () => {
        const next = { hasKey: true, provider: 'openai', modelPrimary: 'gpt-4o' };
        storage.set('config', next);
        return { ...next, designSystem: null, baseUrl: null };
      },
    } as any,

    generate: async (payload: any) => {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Generation failed');
      }
      return response.json();
    },

    snapshots: {
      listDesigns: async () => storage.get('designs') || [],
      createDesign: async (name: string) => {
        const designs = storage.get('designs') || [];
        const newDesign = { id: Math.random().toString(36).slice(2), name, createdAt: new Date().toISOString(), workspacePath: '/' };
        storage.set('designs', [...designs, newDesign]);
        return newDesign;
      },
      getDesign: async (id: string) => (storage.get('designs') || []).find((d: any) => d.id === id) || null,
      list: async () => [],
    } as any,

    chat: {
      list: async (designId: string) => storage.get(`chat:${designId}`) || [],
      append: async (input: any) => {
        const chat = storage.get(`chat:${input.designId}`) || [];
        const row = { ...input, id: Math.random().toString(36).slice(2), createdAt: new Date().toISOString() };
        storage.set(`chat:${input.designId}`, [...chat, row]);
        return row;
      },
    } as any,

    files: {
      list: async () => [],
      read: async () => ({ content: '' }),
      importToWorkspace: async () => [],
      subscribe: async () => ({ ok: true }),
      unsubscribe: async () => ({ ok: true }),
      onChanged: () => () => {},
    } as any,

    locale: {
      getSystem: async () => 'en',
      getCurrent: async () => storage.get('locale') || 'en',
      set: async (l: string) => {
        storage.set('locale', l);
        return l;
      },
    },

    preferences: {
      get: async () => storage.get('prefs') || { memoryEnabled: false },
      update: async (p: any) => {
        const current = storage.get('prefs') || {};
        const next = { ...current, ...p };
        storage.set('prefs', next);
        return next;
      },
    } as any,

    settings: {
      listProviders: async () => [],
      setActiveProvider: async (input: any) => {
        const config = storage.get('config') || {};
        const next = { ...config, provider: input.provider, modelPrimary: input.modelPrimary };
        storage.set('config', next);
        return { ...next, hasKey: true, designSystem: null };
      },
    } as any,
  };

  (window as any).codesign = polyfill;
}
