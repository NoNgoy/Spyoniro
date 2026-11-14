import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, Vibration, View } from 'react-native';
import { Accelerometer } from 'expo-sensors';
import { fmtTime, PoolPicker, useCountdown } from '../components/shared';
import { Button, Chip, Screen, Section, ToggleRow, ui } from '../components/ui';
import { createTiltDetector, type WordResult } from '../logic/partyGames';
import type { Card } from '../logic/types';
import type { Nav } from '../navigation';
import { useGame } from '../state/GameContext';
import { colors, font, radius } from '../theme';

const TIMES = [45, 60, 90, 120];

export function HeadsSetupScreen({ nav }: { nav: Nav }) {
  const g = useGame();
  const h = g.heads;
  return (
    <Screen
      title="🤔 Кто я?"
      onBack={nav.back}
      footer={<Button big label="Играть" disabled={!h.selectedPoolIds.length} onPress={() => nav.push({ name: 'headsGame' })} />}
    >
      <Text style={ui.muted}>
        Приложи телефон ко лбу экраном к друзьям. Они объясняют слово, ты угадываешь.{'\n'}Наклон вниз — угадал, наклон
        вверх — пропуск.
      </Text>
      <Section title="Правила">
        <Text style={ui.text}>Время</Text>
        <View style={ui.wrap}>
          {TIMES.map((t) => (
            <Chip key={t} label={`${t} сек`} active={h.roundSeconds === t} onPress={() => g.updateHeads({ roundSeconds: t })} />
          ))}
        </View>
        <ToggleRow
          label="Управление наклоном"
          hint="Если выключить — угадал/пропуск нажатием на верх/низ экрана"
          value={h.useTilt}
          onChange={(v) => g.updateHeads({ useTilt: v })}
        />
      </Section>
      <Section title="Категории">
        <PoolPicker selected={h.selectedPoolIds} onChange={(ids) => g.updateHeads({ selectedPoolIds: ids })} onManage={() => nav.push({ name: 'pools' })} />
      </Section>
    </Screen>
  );
}

type Phase = 'ready' | 'countdown' | 'playing' | 'results';

export function HeadsGameScreen({ nav }: { nav: Nav }) {
  const g = useGame();
  const h = g.heads;
  const [phase, setPhase] = useState<Phase>('ready');
  const [count, setCount] = useState(3);
  const [current, setCurrent] = useState<Card | null>(null);
  const [results, setResults] = useState<(WordResult & { name: string })[]>([]);
  const [flash, setFlash] = useState<'guessed' | 'skip' | null>(null);
  const currentRef = useRef<Card | null>(null);
  currentRef.current = current;

  const onEnd = useCallback(() => {
    Vibration.vibrate([0, 400, 150, 400]);
    setPhase('results');
  }, []);
  const timer = useCountdown(h.roundSeconds * 1000, phase === 'playing', onEnd);

  const nextWord = useCallback(() => {
    const c = g.drawWord(h.selectedPoolIds);
    if (!c) {
      Alert.alert('Нет карточек', 'В выбранных категориях нет карточек.');
      setPhase('results');
      return;
    }
    setCurrent(c);
  }, [g, h.selectedPoolIds]);

  const act = useCallback(
    (kind: 'guessed' | 'skip') => {
      const c = currentRef.current;
      if (!c) return;
      Vibration.vibrate(kind === 'guessed' ? 30 : 80);
      setResults((r) => [...r, { cardId: c.id, name: c.name, guessed: kind === 'guessed' }]);
      setFlash(kind);
      setCurrent(null);
      setTimeout(() => {
        setFlash(null);
        nextWord();
      }, 550);
    },
    [nextWord],
  );

  // обратный отсчёт 3-2-1
  useEffect(() => {
    if (phase !== 'countdown') return;
    if (count === 0) {
      setPhase('playing');
      nextWord();
      return;
    }
    const t = setTimeout(() => setCount((c) => c - 1), 800);
    return () => clearTimeout(t);
  }, [phase, count, nextWord]);

  // акселерометр
  useEffect(() => {
    if (phase !== 'playing' || !h.useTilt) return;
    const detect = createTiltDetector();
    let sub: { remove: () => void } | null = null;
    let cancelled = false;
    Accelerometer.isAvailableAsync()
      .then((ok) => {
        if (!ok || cancelled) return;
        Accelerometer.setUpdateInterval(80);
        sub = Accelerometer.addListener(({ z }) => {
          if (!currentRef.current) return;
          const a = detect(z);
          if (a) act(a);
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      sub?.remove();
    };
  }, [phase, h.useTilt, act]);

  const begin = () => {
    setResults([]);
    setCurrent(null);
    timer.reset();
    setCount(3);
    setPhase('countdown');
  };

  if (phase === 'ready')
    return (
      <Screen title="🤔 Кто я?" onBack={nav.back} scroll={false} footer={<Button big label="Я готов — старт" onPress={begin} />}>
        <View style={styles.center}>
          <Text style={{ fontSize: 80 }}>📱</Text>
          <Text style={[ui.h2, { textAlign: 'center' }]}>Приложи телефон ко лбу</Text>
          <Text style={[ui.muted, { textAlign: 'center' }]}>
            Экраном к друзьям.{'\n'}
            {h.useTilt ? 'Наклон вниз — угадал ✓\nНаклон вверх — пропуск ✗' : 'Верх экрана — угадал ✓\nНиз экрана — пропуск ✗'}
          </Text>
        </View>
      </Screen>
    );

  if (phase === 'countdown')
    return (
      <View style={[styles.full, { backgroundColor: colors.bg }]}>
        <Text style={styles.count}>{count || '!'}</Text>
      </View>
    );

  if (phase === 'playing') {
    const bg = flash === 'guessed' ? '#0F5132' : flash === 'skip' ? '#6B2A0E' : colors.bg;
    return (
      <View style={[styles.full, { backgroundColor: bg }]}>
        <Pressable style={styles.half} onPress={() => act('guessed')} />
        <View style={styles.wordWrap} pointerEvents="none">
          {flash ? (
            <Text style={styles.word}>{flash === 'guessed' ? '✓ Угадал!' : '✗ Пропуск'}</Text>
          ) : (
            <>
              <Text style={styles.timer}>{fmtTime(timer.left)}</Text>
              <Text style={styles.word} adjustsFontSizeToFit numberOfLines={3}>
                {current?.name}
              </Text>
              <Text style={styles.category}>{current ? g.poolById(current.poolId)?.name : ''}</Text>
            </>
          )}
        </View>
        <Pressable style={styles.half} onPress={() => act('skip')} />
      </View>
    );
  }

  const guessed = results.filter((r) => r.guessed).length;
  return (
    <Screen
      title="Результат"
      onBack={nav.back}
      footer={
        <>
          <Button big label="Следующий игрок ▶" onPress={() => setPhase('ready')} />
          <Button variant="secondary" label="В меню" onPress={nav.back} />
        </>
      }
    >
      <View style={{ alignItems: 'center', gap: 4 }}>
        <Text style={{ fontSize: 64, color: colors.text, fontWeight: '900' }}>{guessed}</Text>
        <Text style={ui.muted}>угадано из {results.length}</Text>
      </View>
      {results.map((r, i) => (
        <View key={i} style={[styles.row, { borderLeftColor: r.guessed ? colors.success : colors.danger }]}>
          <Text style={[ui.text, { flex: 1 }]}>{r.name}</Text>
          <Text style={{ fontSize: 20 }}>{r.guessed ? '✅' : '❌'}</Text>
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  full: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  count: { color: colors.text, fontSize: 160, fontWeight: '900' },
  half: { flex: 1, alignSelf: 'stretch' },
  wordWrap: { position: 'absolute', left: 16, right: 16, alignItems: 'center', gap: 14 },
  timer: { color: colors.muted, fontSize: font.h2, fontWeight: '800', fontVariant: ['tabular-nums'] },
  word: { color: colors.text, fontSize: 56, fontWeight: '900', textAlign: 'center' },
  category: { color: colors.muted, fontSize: font.body },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.sm, padding: 14, borderLeftWidth: 5 },
});
