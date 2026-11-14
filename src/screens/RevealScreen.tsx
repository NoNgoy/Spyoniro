import React, { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, Vibration, View } from 'react-native';
import { RoleCard } from '../components/RoleCard';
import { Button, Screen, ui } from '../components/ui';
import type { Nav } from '../navigation';
import { useGame } from '../state/GameContext';
import { colors, font, radius } from '../theme';

type Phase = 'cover' | 'holding' | 'tapOpen';

export function RevealScreen({ nav }: { nav: Nav }) {
  const g = useGame();
  const round = g.round;
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>('cover');
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    setPhase('cover');
    setSeen(false);
  }, [index]);

  if (!round) return null;
  const { plan, players, settings } = round;
  const player = players[index];
  const assignment = plan.assignments.find((a) => a.playerId === player.id)!;
  const card = g.cardById(assignment.cardId);
  const civilianCard = g.cardById(plan.civilianCardId);
  const isLast = index === players.length - 1;
  const open = phase !== 'cover';

  const next = () => {
    if (isLast) nav.replace({ name: 'round' });
    else setIndex((i) => i + 1);
  };

  const quit = () =>
    Alert.alert('Прервать раздачу?', 'Раунд будет отменён.', [
      { text: 'Нет', style: 'cancel' },
      { text: 'В лобби', style: 'destructive', onPress: () => nav.reset({ name: 'lobby' }) },
    ]);

  return (
    <Screen title={`Раунд ${round.number}`} onBack={quit} scroll={false}>
      <View style={styles.progress}>
        {players.map((p, i) => (
          <View key={p.id} style={[styles.dot, i < index && styles.dotDone, i === index && styles.dotActive]} />
        ))}
      </View>

      <View style={{ flex: 1, justifyContent: 'center', gap: 20 }}>
        {open ? (
          <RoleCard
            assignment={assignment}
            card={card}
            pool={card ? g.poolById(card.poolId) : undefined}
            categoryPool={civilianCard ? g.poolById(civilianCard.poolId) : undefined}
            showTags={settings.showTags}
            spyHint={settings.spyHint}
          />
        ) : (
          <View style={styles.cover}>
            <Text style={ui.muted}>Передайте телефон игроку</Text>
            <Text style={styles.name} adjustsFontSizeToFit numberOfLines={2}>
              {player.name}
            </Text>
            <Text style={[ui.muted, { textAlign: 'center' }]}>
              {seen ? 'Роль просмотрена. Передайте телефон дальше.' : 'Убедитесь, что никто не подглядывает 👀'}
            </Text>
          </View>
        )}
      </View>

      <View style={{ gap: 12 }}>
        {phase === 'tapOpen' ? (
          <Button
            big
            label="Понятно, скрыть"
            onPress={() => {
              setPhase('cover');
              setSeen(true);
            }}
          />
        ) : (
          <Pressable
            onPressIn={() => {
              Vibration.vibrate(15);
              setPhase('holding');
            }}
            onPressOut={() => {
              setPhase('cover');
              setSeen(true);
            }}
            style={({ pressed }) => [styles.hold, pressed && { backgroundColor: colors.surface2 }]}
          >
            <Text style={styles.holdText}>{open ? 'Отпустите, чтобы скрыть' : '✋ Удерживайте, чтобы увидеть роль'}</Text>
          </Pressable>
        )}
        {phase === 'cover' && !seen ? (
          <Pressable onPress={() => setPhase('tapOpen')} style={{ alignItems: 'center', padding: 6 }}>
            <Text style={ui.muted}>Открыть по тапу</Text>
          </Pressable>
        ) : null}
        {phase === 'cover' && seen ? (
          <Button big label={isLast ? 'Все готовы — начать раунд ▶' : `Готово, следующий: ${players[index + 1].name}`} onPress={next} />
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  progress: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.border },
  dotDone: { backgroundColor: colors.success },
  dotActive: { backgroundColor: colors.accent, width: 22 },
  cover: {
    minHeight: 280,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 16,
  },
  name: { color: colors.text, fontSize: font.huge, fontWeight: '900', textAlign: 'center' },
  hold: {
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.accent,
    paddingVertical: 28,
    alignItems: 'center',
  },
  holdText: { color: colors.text, fontSize: font.h3, fontWeight: '800' },
});
