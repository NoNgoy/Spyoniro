import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getRandomValues } from 'expo-crypto';
import { BUILTIN_POOLS } from '../data';
import { customToPool, type CustomPool } from '../logic/customPools';
import { createSecureRng, maxSpies, planRound } from '../logic/randomizer';
import type { Card, Decks, Player, Pool, RoundPlan, Settings, SpyHistory } from '../logic/types';

export const MIN_PLAYERS = 3;
export const MAX_PLAYERS = 16;
const STORAGE_KEY = 'spy-game:v1';

const defaultName = (i: number) => `Игрок ${i + 1}`;
const defaultPlayers = (): Player[] =>
  Array.from({ length: MAX_PLAYERS }, (_, i) => ({ id: `p${i + 1}`, name: defaultName(i) }));

export const DEFAULT_SETTINGS: Settings = {
  playerCount: 5,
  mode: 'classic',
  spyCount: 1,
  randomSpyCount: false,
  chaosMode: false,
  chaosChance: 0.07,
  selectedPoolIds: ['clash_royale'],
  timerMinutes: 5,
  spyHint: true,
  showTags: false,
  hardAntiRepeat: true,
};

type Persisted = {
  players: Player[];
  settings: Settings;
  history: SpyHistory;
  decks: Decks;
  customPools: CustomPool[];
  hidden: Record<string, string[]>;
  roundsPlayed: number;
};

export type CurrentRound = { plan: RoundPlan; players: Player[]; settings: Settings; number: number };

type Ctx = Persisted & {
  loaded: boolean;
  pools: Pool[];
  poolById: (id: string) => Pool | undefined;
  cardById: (id: string | null) => Card | undefined;
  activePlayers: Player[];
  round: CurrentRound | null;
  updateSettings: (p: Partial<Settings>) => void;
  setPlayerName: (index: number, name: string) => void;
  resetPlayerNames: () => void;
  startRound: () => string | null;
  saveCustomPool: (p: CustomPool) => void;
  deleteCustomPool: (id: string) => void;
  toggleHidden: (poolId: string, cardId: string) => void;
  setHiddenAll: (poolId: string, hidden: boolean) => void;
  resetStats: () => void;
};

const GameContext = createContext<Ctx | null>(null);
const rng = createSecureRng((arr) => getRandomValues(arr));

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [loaded, setLoaded] = useState(false);
  const [state, setState] = useState<Persisted>({
    players: defaultPlayers(),
    settings: DEFAULT_SETTINGS,
    history: {},
    decks: {},
    customPools: [],
    hidden: {},
    roundsPlayed: 0,
  });
  const [round, setRound] = useState<CurrentRound | null>(null);

  // загрузка
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!raw) return;
        const data = JSON.parse(raw) as Partial<Persisted>;
        setState((s) => ({
          ...s,
          ...data,
          players: defaultPlayers().map((p, i) => data.players?.[i] ?? p),
          settings: { ...DEFAULT_SETTINGS, ...(data.settings ?? {}) },
        }));
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  // сохранение (с небольшим debounce)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!loaded) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => {});
    }, 300);
  }, [state, loaded]);

  const pools = useMemo(() => [...BUILTIN_POOLS, ...state.customPools.map(customToPool)], [state.customPools]);
  const poolMap = useMemo(() => new Map(pools.map((p) => [p.id, p])), [pools]);
  const cardMap = useMemo(() => {
    const m = new Map<string, Card>();
    pools.forEach((p) => p.cards.forEach((c) => m.set(c.id, c)));
    return m;
  }, [pools]);

  const activePlayers = useMemo(
    () => state.players.slice(0, state.settings.playerCount).map((p, i) => ({ ...p, name: p.name.trim() || defaultName(i) })),
    [state.players, state.settings.playerCount],
  );

  const updateSettings = useCallback((p: Partial<Settings>) => {
    setState((s) => {
      const settings = { ...s.settings, ...p };
      settings.spyCount = Math.max(1, Math.min(settings.spyCount, maxSpies(settings.playerCount)));
      return { ...s, settings };
    });
  }, []);

  const setPlayerName = useCallback((index: number, name: string) => {
    setState((s) => ({ ...s, players: s.players.map((p, i) => (i === index ? { ...p, name } : p)) }));
  }, []);

  const resetPlayerNames = useCallback(() => {
    setState((s) => ({ ...s, players: s.players.map((p, i) => ({ ...p, name: defaultName(i) })) }));
  }, []);

  const startRound = useCallback((): string | null => {
    const s = state;
    const cardsByPool: Record<string, Card[]> = {};
    for (const id of s.settings.selectedPoolIds) {
      const pool = poolMap.get(id);
      if (!pool) continue;
      const hidden = new Set(s.hidden[id] ?? []);
      const visible = pool.cards.filter((c) => !hidden.has(c.id));
      if (visible.length) cardsByPool[id] = visible;
    }
    if (!Object.keys(cardsByPool).length) return 'Выберите хотя бы одну категорию с карточками.';
    const out = planRound({
      players: activePlayers,
      mode: s.settings.mode,
      spyCount: s.settings.spyCount,
      randomSpyCount: s.settings.randomSpyCount,
      chaosMode: s.settings.chaosMode,
      chaosChance: s.settings.chaosChance,
      hardAntiRepeat: s.settings.hardAntiRepeat,
      cardsByPool,
      history: s.history,
      decks: s.decks,
      rng,
    });
    const number = s.roundsPlayed + 1;
    setState((prev) => ({ ...prev, history: out.history, decks: out.decks, roundsPlayed: number }));
    setRound({ plan: out.plan, players: activePlayers, settings: s.settings, number });
    return null;
  }, [state, poolMap, activePlayers]);

  const saveCustomPool = useCallback((p: CustomPool) => {
    setState((s) => {
      const exists = s.customPools.some((x) => x.id === p.id);
      return { ...s, customPools: exists ? s.customPools.map((x) => (x.id === p.id ? p : x)) : [...s.customPools, p] };
    });
  }, []);

  const deleteCustomPool = useCallback((id: string) => {
    setState((s) => {
      const decks = { ...s.decks };
      delete decks[id];
      return {
        ...s,
        decks,
        customPools: s.customPools.filter((x) => x.id !== id),
        settings: { ...s.settings, selectedPoolIds: s.settings.selectedPoolIds.filter((x) => x !== id) },
      };
    });
  }, []);

  const toggleHidden = useCallback((poolId: string, cardId: string) => {
    setState((s) => {
      const cur = new Set(s.hidden[poolId] ?? []);
      cur.has(cardId) ? cur.delete(cardId) : cur.add(cardId);
      return { ...s, hidden: { ...s.hidden, [poolId]: [...cur] } };
    });
  }, []);

  const setHiddenAll = useCallback(
    (poolId: string, hidden: boolean) => {
      const pool = poolMap.get(poolId);
      setState((s) => ({ ...s, hidden: { ...s.hidden, [poolId]: hidden && pool ? pool.cards.map((c) => c.id) : [] } }));
    },
    [poolMap],
  );

  const resetStats = useCallback(() => {
    setState((s) => ({ ...s, history: {}, decks: {}, roundsPlayed: 0 }));
  }, []);

  const value: Ctx = {
    ...state,
    loaded,
    pools,
    poolById: (id) => poolMap.get(id),
    cardById: (id) => (id ? cardMap.get(id) : undefined),
    activePlayers,
    round,
    updateSettings,
    setPlayerName,
    resetPlayerNames,
    startRound,
    saveCustomPool,
    deleteCustomPool,
    toggleHidden,
    setHiddenAll,
    resetStats,
  };
  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame(): Ctx {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame вне GameProvider');
  return ctx;
}
