import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, BackHandler, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GameProvider, useGame } from './src/state/GameContext';
import type { Nav, Route } from './src/navigation';
import { LobbyScreen } from './src/screens/LobbyScreen';
import { RevealScreen } from './src/screens/RevealScreen';
import { RoundScreen } from './src/screens/RoundScreen';
import { ResultsScreen } from './src/screens/ResultsScreen';
import { PoolsScreen } from './src/screens/PoolsScreen';
import { PoolEditScreen } from './src/screens/PoolEditScreen';
import { PoolViewScreen } from './src/screens/PoolViewScreen';
import { ImportScreen } from './src/screens/ImportScreen';
import { colors } from './src/theme';

/** Минимальный стек-навигатор: без нативных зависимостей, с поддержкой кнопки «Назад» Android */
function Router() {
  const { loaded } = useGame();
  const [stack, setStack] = useState<Route[]>([{ name: 'lobby' }]);

  const nav: Nav = useMemo(
    () => ({
      push: (r) => setStack((s) => [...s, r]),
      replace: (r) => setStack((s) => [...s.slice(0, -1), r]),
      back: () => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s)),
      reset: (r) => setStack([r]),
    }),
    [],
  );

  const top = stack[stack.length - 1];
  const onHardwareBack = useCallback(() => {
    // во время раздачи/раунда «Назад» не должен случайно выкинуть из игры
    if (top.name === 'reveal' || top.name === 'round') return true;
    if (top.name === 'results') {
      nav.reset({ name: 'lobby' });
      return true;
    }
    if (stack.length > 1) {
      nav.back();
      return true;
    }
    return false;
  }, [top, stack.length, nav]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', onHardwareBack);
    return () => sub.remove();
  }, [onHardwareBack]);

  if (!loaded)
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );

  switch (top.name) {
    case 'lobby':
      return <LobbyScreen nav={nav} />;
    case 'reveal':
      return <RevealScreen nav={nav} />;
    case 'round':
      return <RoundScreen nav={nav} />;
    case 'results':
      return <ResultsScreen nav={nav} />;
    case 'pools':
      return <PoolsScreen nav={nav} />;
    case 'poolEdit':
      return <PoolEditScreen key={top.poolId ?? 'new'} nav={nav} poolId={top.poolId} />;
    case 'poolView':
      return <PoolViewScreen nav={nav} poolId={top.poolId} />;
    case 'import':
      return <ImportScreen nav={nav} />;
  }
}

export default function App() {
  return (
    <SafeAreaProvider>
      <GameProvider>
        <View style={{ flex: 1, backgroundColor: colors.bg }}>
          <StatusBar style="light" />
          <Router />
        </View>
      </GameProvider>
    </SafeAreaProvider>
  );
}
