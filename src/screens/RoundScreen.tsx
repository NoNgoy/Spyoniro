import React, { useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, Vibration, View } from 'react-native';
import { Button, Card, Screen, ui } from '../components/ui';
import type { Nav } from '../navigation';
import { useGame } from '../state/GameContext';
import { colors } from '../theme';

const fmt = (ms: number) => {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};

export function RoundScreen({ nav }: { nav: Nav }) {
  const g = useGame();
  const round = g.round;
  const duration = (round?.settings.timerMinutes ?? 0) * 60_000;
  const [running, setRunning] = useState(duration > 0);
  const [left, setLeft] = useState(duration);
  const endAt = useRef(Date.now() + duration);
  const buzzed = useRef(false);

  useEffect(() => {
    if (!running || duration === 0) return;
    endAt.current = Date.now() + left;
    const t = setInterval(() => {
      const l = endAt.current - Date.now();
      setLeft(Math.max(0, l));
      if (l <= 0) {
        setRunning(false);
        if (!buzzed.current) {
          buzzed.current = true;
          Vibration.vibrate([0, 400, 200, 400, 200, 800]);
        }
      }
    }, 250);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, duration]);

  if (!round) return null;
  const first = round.players.find((p) => p.id === round.plan.firstPlayerId);
  const spyWord = (n: number) => (n === 1 ? 'шпион' : n < 5 ? 'шпиона' : 'шпионов');
  const announced = round.settings.randomSpyCount
    ? 'Число шпионов неизвестно 🤫'
    : `В игре ${round.settings.spyCount} ${spyWord(round.settings.spyCount)}`;

  const reveal = () =>
    Alert.alert('Раскрыть роли?', 'Сначала проголосуйте всей компанией.', [
      { text: 'Ещё нет', style: 'cancel' },
      { text: 'Раскрыть', onPress: () => nav.replace({ name: 'results' }) },
    ]);

  return (
    <Screen
      title={`Раунд ${round.number}`}
      scroll={false}
      footer={<Button big label="Завершить и раскрыть роли" onPress={reveal} />}
    >
      <Card style={{ alignItems: 'center', gap: 6 }}>
        <Text style={ui.muted}>Первым спрашивает</Text>
        <Text style={[ui.h2, { textAlign: 'center' }]}>🎤 {first?.name}</Text>
      </Card>

      <View style={styles.timerBox}>
        {duration > 0 ? (
          <>
            <Text style={[styles.timer, left === 0 && { color: colors.danger }]}>{fmt(left)}</Text>
            <Text style={ui.muted}>{left === 0 ? 'Время вышло! Голосуйте.' : running ? 'Идёт обсуждение' : 'Пауза'}</Text>
          </>
        ) : (
          <>
            <Text style={styles.timerOff}>∞</Text>
            <Text style={ui.muted}>Без таймера</Text>
          </>
        )}
      </View>

      {duration > 0 ? (
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Button
            style={{ flex: 1 }}
            variant="secondary"
            label={running ? '⏸ Пауза' : '▶ Продолжить'}
            disabled={left === 0}
            onPress={() => setRunning((r) => !r)}
          />
          <Button
            style={{ flex: 1 }}
            variant="secondary"
            label="↺ Сброс"
            onPress={() => {
              buzzed.current = false;
              setRunning(false);
              setLeft(duration);
            }}
          />
        </View>
      ) : null}

      <Text style={[ui.muted, { textAlign: 'center' }]}>{announced}</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  timerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  timer: { color: colors.text, fontSize: 96, fontWeight: '900', fontVariant: ['tabular-nums'] },
  timerOff: { color: colors.muted, fontSize: 96, fontWeight: '300' },
});
