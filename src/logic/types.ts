// Общие типы игры «Шпион».

export type Card = {
  /** Стабильный id: `${poolId}/${name}` */
  id: string;
  name: string;
  poolId: string;
  /** Семантический кластер (для «Слепого шпиона») */
  cluster?: string;
  /** Явные близкие аналоги (id карточек того же пула) */
  similarIds: string[];
  tags: string[];
};

export type Pool = {
  id: string;
  name: string;
  icon: string;
  color: string;
  description?: string;
  builtIn: boolean;
  /** id кластера -> человекочитаемое название */
  clusterLabels: Record<string, string>;
  cards: Card[];
};

export type GameMode = 'classic' | 'blind' | 'mixed';

export type Player = { id: string; name: string };

export type Settings = {
  playerCount: number;
  mode: GameMode;
  spyCount: number;
  randomSpyCount: boolean;
  chaosMode: boolean;
  /** Вероятность хаос-события (0..1) */
  chaosChance: number;
  selectedPoolIds: string[];
  /** 0 = без таймера */
  timerMinutes: number;
  spyHint: boolean;
  showTags: boolean;
  hardAntiRepeat: boolean;
};

export type SpyStat = {
  /** Сколько раундов назад игрок был шпионом (0 = в прошлом раунде) */
  roundsSinceLastSpy: number;
  timesSpy: number;
  /** Был ли первым игроком в прошлом раунде */
  roundsSinceFirst: number;
};

export type SpyHistory = Record<string, SpyStat>;

/** Колода одного пула: перетасованный порядок + позиция следующей карты */
export type DeckState = { order: string[]; pos: number; lastDrawn?: string };
export type Decks = Record<string, DeckState>;

export type RoleKind = 'civilian' | 'classicSpy' | 'blindSpy';

export type Assignment = {
  playerId: string;
  role: RoleKind;
  /** Карточка, которую видит игрок (null для классического шпиона) */
  cardId: string | null;
};

export type ChaosEvent = 'none' | 'allSpies' | 'noSpies';

export type RoundPlan = {
  civilianCardId: string;
  blindCardId: string | null;
  assignments: Assignment[];
  firstPlayerId: string;
  chaos: ChaosEvent;
  spyIds: string[];
};
