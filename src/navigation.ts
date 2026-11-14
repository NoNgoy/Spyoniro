export type Route =
  | { name: 'lobby' }
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
