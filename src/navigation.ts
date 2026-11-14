export type Route =
  | { name: 'home' }
  | { name: 'lobby' }
  | { name: 'aliasSetup' }
  | { name: 'aliasGame' }
  | { name: 'headsSetup' }
  | { name: 'headsGame' }
  | { name: 'mafiaSetup' }
  | { name: 'mafiaReveal' }
  | { name: 'mafiaHost' }
  | { name: 'reveal' }
  | { name: 'round' }
  | { name: 'results' }
  | { name: 'pools' }
  | { name: 'poolEdit'; poolId: string | null }
  | { name: 'poolView'; poolId: string }
  | { name: 'import' };

export type Nav = {
  push: (r: Route) => void;
  replace: (r: Route) => void;
  back: () => void;
  reset: (r: Route) => void;
};
