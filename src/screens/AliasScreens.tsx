import React, { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, Vibration, View } from 'react-native';
import { fmtTime, PoolPicker, useCountdown } from '../components/shared';
import { Button, Card, Chip, Input, Screen, Section, Stepper, ToggleRow, ui } from '../components/ui';
import { aliasWinner, scoreTurn, type WordResult } from '../logic/partyGames';
import type { Card as WordCard } from '../logic/types';
import type { Nav } from '../navigation';
import { useGame } from '../state/GameContext';
import { colors, font, radius } from '../theme';

const TEAM_COLORS = ['#EF4444', '#3B82F6', '#22C55E', '#F59E0B'];
const TIMES = [30, 45, 60, 90, 120];
const TARGETS = [20, 30, 40, 50, 70, 100];

export function AliasSetupScreen({ nav }: { nav: Nav }) {
  const g = useGame();
  const a = g.alias;
  return (
    <Screen
      title="🗣️ Объясни слово"
      onBack={nav.back}
      footer={
        <Button big label="Начать игру" disabled={!a.selectedPoolIds.length} onPress={() => nav.push({ name: 'aliasGame' })} />
      }
    >
      <Text style={ui.muted}>
        Команда по очереди объясняет слова одному из своих, не называя само слово и однокоренные. Угадал — плюс очко.
      </Text>
      <Section title="Команды">
        <Stepper label="Количество" value={a.teamCount} min={2} max={4} onChange={(v) => g.updateAlias({ teamCount: v })} />
        {a.teamNames.slice(0, a.teamCount).map((n, i) => (
          <Input
            key={i}
            value={n}
            maxLength={20}
            style={{ borderLeftWidth: 6, borderLeftColor: TEAM_COLORS[i] }}
            onChangeText={(t) => g.updateAlias({ teamNames: a.teamNames.map((x, j) => (j === i ? t : x)) })}
          />
        ))}
      </Section>
      <Section title="Правила">
        <Text style={ui.text}>Время хода</Text>
        <View style={ui.wrap}>
          {TIMES.map((t) => (
            <Chip key={t} label={`${t} сек`} active={a.roundSeconds === t} onPress={() => g.updateAlias({ roundSeconds: t })} />
          ))}
        </View>
        <Text style={ui.text}>Играем до</Text>
        <View style={ui.wrap}>
          {TARGETS.map((t) => (
            <Chip key={t} label={`${t} очков`} active={a.targetScore === t} onPress={() => g.updateAlias({ targetScore: t })} />
          ))}
        </View>
        <ToggleRow
          label="Штраф за пропуск"
          hint="−1 очко за каждое пропущенное слово"
          value={a.skipPenalty}
          onChange={(v) => g.updateAlias({ skipPenalty: v })}
        />
      </Section>
      <Section title="Категории">
        <PoolPicker selected={a.selectedPoolIds} onChange={(ids) => g.updateAlias({ selectedPoolIds: ids })} onManage={() => nav.push({ name: 'pools' })} />
      </Section>
    </Screen>
  );
}

type Phase = 'intro' | 'playing' | 'review' | 'scores';

export function AliasGameScreen({ nav }: { nav: Nav }) {
  const g = useGame();
  const a = g.alias;
  const teams = a.teamNames.slice(0, a.teamCount).map((n, i) => n.trim() || `Команда ${i + 1}`);
  const [scores, setScores] = useState<number[]>(() => teams.map(() => 0));
  const [turns, setTurns] = useState<number[]>(() => teams.map(() => 0));
  const [team, setTeam] = useState(0);
  const [phase, setPhase] = useState<Phase>('intro');
  const [results, setResults] = useState<WordResult[]>([]);
  const [current, setCurrent] = useState<WordCard | null>(null);
  const [timeUp, setTimeUp] = useState(false);
  const [cards, setCards] = useState<Record<string, WordCard>>({});

  const onEnd = useCallback(() => {
    Vibration.vibrate([0, 300, 150, 300]);
    setTimeUp(true);
  }, []);
  const timer = useCountdown(a.roundSeconds * 1000, phase === 'playing' && !timeUp, onEnd);

  const nextWord = () => {
    const c = g.drawWord(a.selectedPoolIds);
    if (!c) {
      Alert.alert('Нет карточек', 'В выбранных категориях не осталось карточек.');
      return;
    }
    setCards((m) => ({ ...m, [c.id]: c }));
    setCurrent(c);
  };

  const start = () => {
    setResults([]);
    setTimeUp(false);
    timer.reset();
    nextWord();
    setPhase('playing');
  };

  const mark = (guessed: boolean) => {
    if (!current) return;
    Vibration.vibrate(guessed ? 20 : 60);
    setResults((r) => [...r, { cardId: current.id, guessed }]);
    if (timeUp) {
      // последнее слово после сигнала — на этом ход заканчивается
      setCurrent(null);
      setPhase('review');
    } else nextWord();
  };

  const finishTurn = () => {
    const pts = scoreTurn(results, a.skipPenalty);
    const newScores = scores.map((s, i) => (i === team ? s + pts : s));
    const newTurns = turns.map((t, i) => (i === team ? t + 1 : t));
    setScores(newScores);
    setTurns(newTurns);
    setTeam((t) => (t + 1) % teams.length);
    setPhase('scores');
  };

  const winner = aliasWinner(scores, turns, a.targetScore);
  const quit = () =>
    Alert.alert('Выйти из игры?', 'Счёт будет потерян.', [
      { text: 'Нет', style: 'cancel' },
      { text: 'Выйти', style: 'destructive', onPress: nav.back },
    ]);

  if (phase === 'playing') {
    const pts = scoreTurn(results, a.skipPenalty);
    return (
      <Screen title={teams[team]} onBack={quit} scroll={false} right={<Text style={styles.ptsBadge}>{pts >= 0 ? `+${pts}` : pts}</Text>}>
        <Text style={[styles.timer, timeUp && { color: colors.danger }]}>{timeUp ? 'Последнее слово!' : fmtTime(timer.left)}</Text>
        <View style={[styles.wordBox, { borderColor: TEAM_COLORS[team] }]}>
          <Text style={ui.muted}>{current ? g.poolById(current.poolId)?.name : ''}</Text>
          <Text style={styles.word} adjustsFontSizeToFit numberOfLines={3}>
            {current?.name}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Pressable style={[styles.bigBtn, { backgroundColor: '#3A1820' }]} onPress={() => mark(false)}>
            <Text style={styles.bigBtnText}>✗ Пропуск</Text>
          </Pressable>
          <Pressable style={[styles.bigBtn, { backgroundColor: '#123326' }]} onPress={() => mark(true)}>
            <Text style={styles.bigBtnText}>✓ Угадали</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  if (phase === 'review') {
    const pts = scoreTurn(results, a.skipPenalty);
    return (
      <Screen
        title="Итоги хода"
        footer={<Button big label={`Записать ${pts >= 0 ? '+' : ''}${pts} команде «${teams[team]}»`} onPress={finishTurn} />}
      >
        <Text style={ui.muted}>Нажмите на слово, если отметили его неправильно.</Text>
        {results.map((r, i) => (
          <Pressable
            key={i}
            onPress={() => setResults((rs) => rs.map((x, j) => (j === i ? { ...x, guessed: !x.guessed } : x)))}
            style={[styles.reviewRow, { borderLeftColor: r.guessed ? colors.success : colors.danger }]}
          >
            <Text style={[ui.text, { flex: 1 }]}>{cards[r.cardId]?.name}</Text>
            <Text style={{ fontSize: 22 }}>{r.guessed ? '✅' : '❌'}</Text>
          </Pressable>
        ))}
        {!results.length ? <Text style={ui.muted}>Ни одного слова — бывает!</Text> : null}
      </Screen>
    );
  }

  // intro / scores
  return (
    <Screen
      title="🗣️ Объясни слово"
      onBack={quit}
      footer={
        winner !== null ? (
          <Button big label="Новая игра" onPress={() => nav.replace({ name: 'aliasGame' })} />
        ) : (
          <Button big label={`Ход команды «${teams[team]}» ▶`} onPress={start} />
        )
      }
    >
      {winner !== null ? (
        <Card style={{ alignItems: 'center', gap: 8, borderWidth: 2, borderColor: TEAM_COLORS[winner] }}>
          <Text style={{ fontSize: 56 }}>🏆</Text>
          <Text style={ui.h2}>Победа: {teams[winner]}</Text>
        </Card>
      ) : null}
      <Card style={{ gap: 4 }}>
        <Text style={[ui.h3, { marginBottom: 6 }]}>Счёт · до {a.targetScore}</Text>
        {teams.map((t, i) => (
          <View key={i} style={styles.scoreRow}>
            <View style={[styles.dot, { backgroundColor: TEAM_COLORS[i] }]} />
            <Text style={[ui.text, { flex: 1, fontWeight: i === team && winner === null ? '800' : '400' }]}>
              {t}
              {i === team && winner === null ? '  ← ходит' : ''}
            </Text>
            <Text style={styles.score}>{scores[i]}</Text>
          </View>
        ))}
      </Card>
      {winner === null ? (
        <Text style={[ui.muted, { textAlign: 'center' }]}>
          Команда «{teams[team]}» выбирает, кто объясняет. Передайте ему телефон и нажмите «Ход».
        </Text>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  timer: { color: colors.text, fontSize: 56, fontWeight: '900', textAlign: 'center', fontVariant: ['tabular-nums'] },
  wordBox: {
    flex: 1,
    borderWidth: 2,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    gap: 10,
  },
  word: { color: colors.text, fontSize: font.huge, fontWeight: '900', textAlign: 'center' },
  bigBtn: { flex: 1, borderRadius: radius.lg, paddingVertical: 34, alignItems: 'center' },
  bigBtnText: { color: colors.text, fontSize: font.h3, fontWeight: '900' },
  ptsBadge: { color: colors.success, fontSize: font.h2, fontWeight: '900' },
  reviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    padding: 14,
    borderLeftWidth: 5,
  },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  dot: { width: 14, height: 14, borderRadius: 7 },
  score: { color: colors.text, fontSize: font.h2, fontWeight: '900' },
});
