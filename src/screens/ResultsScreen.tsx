import React from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { Button, Card, Screen, ui } from '../components/ui';
import type { RoleKind } from '../logic/types';
import type { Nav } from '../navigation';
import { useGame } from '../state/GameContext';
import { colors, font, radius } from '../theme';

const ROLE_LABEL: Record<RoleKind, string> = {
  civilian: 'Мирный',
  classicSpy: 'Шпион',
  blindSpy: 'Слепой шпион',
};

export function ResultsScreen({ nav }: { nav: Nav }) {
  const g = useGame();
  const round = g.round;
  if (!round) return null;
  const { plan, players } = round;
  const civ = g.cardById(plan.civilianCardId);
  const blind = g.cardById(plan.blindCardId);
  const pool = civ ? g.poolById(civ.poolId) : undefined;
  const spies = players.filter((p) => plan.spyIds.includes(p.id));

  const nextRound = () => {
    const err = g.startRound();
    if (err) Alert.alert('Не получается начать', err);
    else nav.replace({ name: 'reveal' });
  };

  return (
    <Screen
      title="Итоги раунда"
      onBack={() => nav.reset({ name: 'lobby' })}
      footer={
        <>
          <Button big label="▶ Следующий раунд" onPress={nextRound} />
          <Button variant="secondary" label="В лобби" onPress={() => nav.reset({ name: 'lobby' })} />
        </>
      }
    >
      {plan.chaos !== 'none' ? (
        <Card style={{ backgroundColor: '#2B2108', borderWidth: 1, borderColor: colors.warning }}>
          <Text style={[ui.h3, { color: colors.warning }]}>
            🌀 Хаос! {plan.chaos === 'allSpies' ? 'Все были шпионами' : 'Шпионов не было вообще'}
          </Text>
        </Card>
      ) : null}

      <Card style={{ gap: 6 }}>
        <Text style={ui.muted}>
          {pool?.icon} {pool?.name}
        </Text>
        <Text style={ui.muted}>Слово мирных</Text>
        <Text style={styles.word}>{plan.chaos === 'allSpies' ? '— (не было мирных)' : civ?.name}</Text>
        {blind ? (
          <>
            <Text style={[ui.muted, { marginTop: 8 }]}>Слово слепого шпиона</Text>
            <Text style={[styles.word, { color: colors.warning }]}>{blind.name}</Text>
          </>
        ) : null}
      </Card>

      <Card style={{ gap: 4 }}>
        <Text style={ui.h3}>
          {spies.length === 0 ? 'Шпионов не было' : spies.length === 1 ? 'Шпион' : `Шпионы (${spies.length})`}
        </Text>
        {spies.map((p) => {
          const a = plan.assignments.find((x) => x.playerId === p.id)!;
          return (
            <Text key={p.id} style={styles.spyName}>
              🕵️ {p.name} <Text style={ui.muted}>· {ROLE_LABEL[a.role]}</Text>
            </Text>
          );
        })}
      </Card>

      <Card style={{ gap: 2 }}>
        <Text style={[ui.h3, { marginBottom: 8 }]}>Все роли</Text>
        {players.map((p) => {
          const a = plan.assignments.find((x) => x.playerId === p.id)!;
          const c = g.cardById(a.cardId);
          const isSpy = a.role !== 'civilian';
          return (
            <View key={p.id} style={styles.row}>
              <Text style={[ui.text, { flex: 1 }]} numberOfLines={1}>
                {p.id === plan.firstPlayerId ? '🎤 ' : ''}
                {p.name}
              </Text>
              <View style={[styles.badge, isSpy && { backgroundColor: colors.danger }]}>
                <Text style={styles.badgeText}>{ROLE_LABEL[a.role]}</Text>
              </View>
              <Text style={[ui.muted, { width: 110, textAlign: 'right' }]} numberOfLines={1}>
                {c?.name ?? '—'}
              </Text>
            </View>
          );
        })}
      </Card>

      <Card style={{ gap: 2 }}>
        <Text style={[ui.h3, { marginBottom: 8 }]}>Статистика шпионов</Text>
        {players.map((p) => (
          <View key={p.id} style={styles.row}>
            <Text style={[ui.text, { flex: 1 }]}>{p.name}</Text>
            <Text style={ui.muted}>{g.history[p.id]?.timesSpy ?? 0} раз</Text>
          </View>
        ))}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  word: { color: colors.text, fontSize: font.h1, fontWeight: '900' },
  spyName: { color: colors.text, fontSize: font.h3, fontWeight: '700', paddingVertical: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.surface2,
  },
  badge: { backgroundColor: colors.surface2, borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 4 },
  badgeText: { color: colors.text, fontSize: 12, fontWeight: '700' },
});
