import React, { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, Vibration, View } from 'react-native';
import { PlayerNames } from '../components/shared';
import { Button, Card, Screen, Section, Stepper, ToggleRow, ui } from '../components/ui';
import {
  buildRoleList,
  MAFIA_MIN_PLAYERS,
  MAFIA_ROLE_INFO,
  mafiaWinner,
  maxMafia,
  nightScript,
  recommendedMafia,
  resolveMafiaCount,
  type MafiaRole,
} from '../logic/partyGames';
import type { Nav } from '../navigation';
import { MAX_PLAYERS, useGame } from '../state/GameContext';
import { colors, font, radius } from '../theme';

const ROLE_COLOR: Record<'mafia' | 'city' | 'solo', string> = { mafia: '#EF4444', city: '#3B82F6', solo: '#A855F7' };

function roleSummary(roles: MafiaRole[]) {
  const counts = new Map<MafiaRole, number>();
  roles.forEach((r) => counts.set(r, (counts.get(r) ?? 0) + 1));
  return [...counts.entries()].map(([r, n]) => `${MAFIA_ROLE_INFO[r].emoji} ${MAFIA_ROLE_INFO[r].title}${n > 1 ? ` ×${n}` : ''}`);
}

export function MafiaSetupScreen({ nav }: { nav: Nav }) {
  const g = useGame();
  const m = g.mafia;
  const roles = buildRoleList(m);
  return (
    <Screen
      title="🔫 Мафия"
      onBack={nav.back}
      footer={
        <Button
          big
          label={`Раздать роли · ${m.playerCount} игроков`}
          onPress={() => {
            g.startMafia();
            nav.push({ name: 'mafiaReveal' });
          }}
        />
      }
    >
      <Text style={ui.muted}>
        Нужен ведущий — он не играет и держит телефон после раздачи. Телефон раздаёт роли по кругу, а потом подсказывает
        ведущему, кого будить ночью, и следит, кто выбыл.
      </Text>
      <Section title="Игроки (без ведущего)">
        <Stepper
          label="Количество"
          value={m.playerCount}
          min={MAFIA_MIN_PLAYERS}
          max={MAX_PLAYERS}
          onChange={(v) => g.updateMafia({ playerCount: v })}
        />
        <PlayerNames count={m.playerCount} />
      </Section>
      <Section title="Роли" hint={roleSummary(roles).join(' · ')}>
        <ToggleRow
          label="Мафия — автоматически"
          hint={`Около четверти игроков: сейчас ${recommendedMafia(m.playerCount)}`}
          value={m.autoMafiaCount}
          onChange={(v) => g.updateMafia({ autoMafiaCount: v })}
        />
        {!m.autoMafiaCount ? (
          <Stepper
            label="Мафии"
            value={resolveMafiaCount(m)}
            min={1}
            max={maxMafia(m.playerCount)}
            onChange={(v) => g.updateMafia({ mafiaCount: v })}
          />
        ) : null}
        <ToggleRow label="🎩 Дон мафии" hint="Если мафии 2+. Ночью ищет шерифа" value={m.don} onChange={(v) => g.updateMafia({ don: v })} />
        <ToggleRow label="⭐ Шериф" hint="Проверяет игроков ночью" value={m.sheriff} onChange={(v) => g.updateMafia({ sheriff: v })} />
        <ToggleRow label="💉 Доктор" hint="Лечит одного игрока ночью" value={m.doctor} onChange={(v) => g.updateMafia({ doctor: v })} />
        <ToggleRow label="🔪 Маньяк" hint="Одиночка, от 7 игроков" value={m.maniac} onChange={(v) => g.updateMafia({ maniac: v })} />
      </Section>
    </Screen>
  );
}

export function MafiaRevealScreen({ nav }: { nav: Nav }) {
  const g = useGame();
  const game = g.mafiaGame;
  const [index, setIndex] = useState(0);
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    setOpen(false);
    setSeen(false);
  }, [index]);
  if (!game) return null;
  const player = game.players[index];
  const role = game.assignments.find((a) => a.playerId === player.id)!.role;
  const info = MAFIA_ROLE_INFO[role];
  const isLast = index === game.players.length - 1;
  const partners =
    info.team === 'mafia'
      ? game.assignments
          .filter((a) => MAFIA_ROLE_INFO[a.role].team === 'mafia' && a.playerId !== player.id)
          .map((a) => game.players.find((p) => p.id === a.playerId)!.name)
      : [];

  return (
    <Screen
      title="Раздача ролей"
      onBack={() =>
        Alert.alert('Прервать раздачу?', '', [
          { text: 'Нет', style: 'cancel' },
          { text: 'Да', style: 'destructive', onPress: nav.back },
        ])
      }
      scroll={false}
    >
      <View style={styles.progress}>
        {game.players.map((p, i) => (
          <View key={p.id} style={[styles.dot, i < index && { backgroundColor: colors.success }, i === index && styles.dotActive]} />
        ))}
      </View>
      <View style={{ flex: 1, justifyContent: 'center' }}>
        {open ? (
          <View style={[styles.card, { borderColor: ROLE_COLOR[info.team] }]}>
            <Text style={{ fontSize: 64 }}>{info.emoji}</Text>
            <Text style={[styles.role, { color: ROLE_COLOR[info.team] }]}>{info.title}</Text>
            <Text style={[ui.muted, { textAlign: 'center' }]}>{info.hint}</Text>
            {partners.length ? <Text style={[ui.text, { textAlign: 'center' }]}>Твоя команда: {partners.join(', ')}</Text> : null}
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={ui.muted}>Передайте телефон игроку</Text>
            <Text style={styles.name} adjustsFontSizeToFit numberOfLines={2}>
              {player.name}
            </Text>
            <Text style={ui.muted}>{seen ? 'Роль просмотрена — передайте дальше' : 'Никто не подглядывает? 👀'}</Text>
          </View>
        )}
      </View>
      <View style={{ gap: 12 }}>
        <Pressable
          onPressIn={() => {
            Vibration.vibrate(15);
            setOpen(true);
          }}
          onPressOut={() => {
            setOpen(false);
            setSeen(true);
          }}
          style={({ pressed }) => [styles.hold, pressed && { backgroundColor: colors.surface2 }]}
        >
          <Text style={styles.holdText}>{open ? 'Отпустите, чтобы скрыть' : '✋ Удерживайте, чтобы увидеть роль'}</Text>
        </Pressable>
        {seen && !open ? (
          <Button
            big
            label={isLast ? 'Все готовы — отдать ведущему ▶' : `Готово, следующий: ${game.players[index + 1].name}`}
            onPress={() => (isLast ? nav.replace({ name: 'mafiaHost' }) : setIndex((i) => i + 1))}
          />
        ) : null}
      </View>
    </Screen>
  );
}

export function MafiaHostScreen({ nav }: { nav: Nav }) {
  const g = useGame();
  const game = g.mafiaGame;
  const [dead, setDead] = useState<string[]>([]);
  const [night, setNight] = useState(1);
  const [step, setStep] = useState(0);
  const [phase, setPhase] = useState<'night' | 'day'>('night');
  const [showRoles, setShowRoles] = useState(false);
  if (!game) return null;
  const roleOf = (id: string) => game.assignments.find((a) => a.playerId === id)!.role;
  const allRoles = game.assignments.map((a) => a.role);
  const alive = game.players.filter((p) => !dead.includes(p.id));
  const outcome = mafiaWinner(alive.map((p) => roleOf(p.id)));
  const script = nightScript(allRoles.filter((_, i) => !dead.includes(game.assignments[i].playerId)), night === 1);

  const toggleDead = (id: string) => setDead((d) => (d.includes(id) ? d.filter((x) => x !== id) : [...d, id]));
  const nextStep = () => {
    if (step < script.length - 1) setStep(step + 1);
    else {
      setPhase('day');
      setStep(0);
    }
  };

  return (
    <Screen
      title={`Ведущий · ${phase === 'night' ? `Ночь ${night}` : `День ${night}`}`}
      onBack={() =>
        Alert.alert('Закончить партию?', '', [
          { text: 'Нет', style: 'cancel' },
          { text: 'В меню', style: 'destructive', onPress: () => nav.reset({ name: 'home' }) },
        ])
      }
      footer={
        outcome ? (
          <Button
            big
            label="Новая партия"
            onPress={() => {
              g.startMafia();
              nav.replace({ name: 'mafiaReveal' });
            }}
          />
        ) : phase === 'night' ? (
          <Button big label={step < script.length - 1 ? 'Дальше ▶' : 'Наступает день ☀️'} onPress={nextStep} />
        ) : (
          <Button
            big
            label="Голосование окончено — ночь 🌙"
            onPress={() => {
              setNight((n) => n + 1);
              setPhase('night');
              setStep(0);
            }}
          />
        )
      }
    >
      {outcome ? (
        <Card style={{ alignItems: 'center', gap: 8, borderWidth: 2, borderColor: outcome === 'city' ? '#3B82F6' : '#EF4444' }}>
          <Text style={{ fontSize: 56 }}>{outcome === 'city' ? '🏙️' : outcome === 'mafia' ? '🔫' : '🔪'}</Text>
          <Text style={ui.h2}>
            {outcome === 'city' ? 'Победил город!' : outcome === 'mafia' ? 'Победила мафия!' : 'Победил маньяк!'}
          </Text>
        </Card>
      ) : phase === 'night' ? (
        <Card style={{ gap: 10, minHeight: 140, justifyContent: 'center' }}>
          <Text style={ui.muted}>
            Шаг {step + 1} из {script.length} — прочитайте вслух
          </Text>
          <Text style={styles.script}>{script[step]}</Text>
        </Card>
      ) : (
        <Card style={{ gap: 8 }}>
          <Text style={styles.script}>☀️ Обсуждение и голосование</Text>
          <Text style={ui.muted}>Отметьте ниже, кто выбыл ночью и по итогам голосования.</Text>
        </Card>
      )}

      <Section title={`Живы: ${alive.length} из ${game.players.length}`} hint="Нажмите на игрока, чтобы отметить выбывшим">
        <ToggleRow label="Показать роли (только ведущему)" value={showRoles} onChange={setShowRoles} />
        {game.players.map((p) => {
          const isDead = dead.includes(p.id);
          const info = MAFIA_ROLE_INFO[roleOf(p.id)];
          return (
            <Pressable key={p.id} onPress={() => toggleDead(p.id)} style={[styles.playerRow, isDead && { opacity: 0.4 }]}>
              <Text style={[ui.text, { flex: 1, textDecorationLine: isDead ? 'line-through' : 'none' }]}>
                {isDead ? '💀 ' : ''}
                {p.name}
              </Text>
              {showRoles || outcome ? (
                <Text style={{ color: ROLE_COLOR[info.team], fontWeight: '700' }}>
                  {info.emoji} {info.title}
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  progress: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.border },
  dotActive: { backgroundColor: colors.accent, width: 22 },
  card: {
    minHeight: 300,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 14,
  },
  name: { color: colors.text, fontSize: font.huge, fontWeight: '900', textAlign: 'center' },
  role: { fontSize: 40, fontWeight: '900', textAlign: 'center' },
  hold: { borderRadius: radius.lg, borderWidth: 2, borderColor: colors.accent, paddingVertical: 28, alignItems: 'center' },
  holdText: { color: colors.text, fontSize: font.h3, fontWeight: '800' },
  script: { color: colors.text, fontSize: font.h3 + 2, fontWeight: '700', lineHeight: 30 },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surface2,
    borderRadius: radius.sm,
    padding: 14,
  },
});
