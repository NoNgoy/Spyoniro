import React from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, font, radius } from '../theme';

export function Screen({
  title,
  onBack,
  right,
  children,
  scroll = true,
  footer,
}: {
  title?: string;
  onBack?: () => void;
  right?: React.ReactNode;
  children: React.ReactNode;
  scroll?: boolean;
  footer?: React.ReactNode;
}) {
  const header =
    title || onBack ? (
      <View style={s.header}>
        {onBack ? (
          <Pressable onPress={onBack} hitSlop={16} style={s.back} accessibilityLabel="Назад">
            <Text style={s.backText}>‹</Text>
          </Pressable>
        ) : null}
        <Text style={s.title} numberOfLines={1}>
          {title}
        </Text>
        <View style={{ marginLeft: 'auto' }}>{right}</View>
      </View>
    ) : null;
  return (
    <SafeAreaView style={s.screen} edges={['top', 'bottom', 'left', 'right']}>
      {header}
      {scroll ? (
        <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      ) : (
        <View style={[s.content, { flex: 1 }]}>{children}</View>
      )}
      {footer ? <View style={s.footer}>{footer}</View> : null}
    </SafeAreaView>
  );
}

type BtnVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  style,
  big,
}: {
  label: string;
  onPress?: () => void;
  variant?: BtnVariant;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  big?: boolean;
}) {
  const bg =
    variant === 'primary' ? colors.accent : variant === 'danger' ? colors.danger : variant === 'secondary' ? colors.surface2 : 'transparent';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        s.btn,
        { backgroundColor: bg, opacity: disabled ? 0.4 : pressed ? 0.8 : 1 },
        big && { paddingVertical: 20 },
        variant === 'ghost' && { borderWidth: 1, borderColor: colors.border },
        style,
      ]}
    >
      <Text style={[s.btnText, big && { fontSize: font.h3 }]}>{label}</Text>
    </Pressable>
  );
}

export function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>{title}</Text>
      {hint ? <Text style={s.hint}>{hint}</Text> : null}
      <View style={{ gap: 10, marginTop: 10 }}>{children}</View>
    </View>
  );
}

export function Stepper({
  value,
  min,
  max,
  onChange,
  label,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  label?: string;
}) {
  return (
    <View style={s.row}>
      {label ? <Text style={s.rowLabel}>{label}</Text> : null}
      <View style={s.stepper}>
        <Pressable style={s.stepBtn} onPress={() => onChange(Math.max(min, value - 1))} disabled={value <= min} hitSlop={8}>
          <Text style={[s.stepText, value <= min && { opacity: 0.3 }]}>−</Text>
        </Pressable>
        <Text style={s.stepValue}>{value}</Text>
        <Pressable style={s.stepBtn} onPress={() => onChange(Math.min(max, value + 1))} disabled={value >= max} hitSlop={8}>
          <Text style={[s.stepText, value >= max && { opacity: 0.3 }]}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

export function ToggleRow({
  label,
  hint,
  value,
  onChange,
  disabled,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <Pressable style={[s.row, disabled && { opacity: 0.4 }]} onPress={() => !disabled && onChange(!value)}>
      <View style={{ flex: 1, paddingRight: 12 }}>
        <Text style={s.rowLabel}>{label}</Text>
        {hint ? <Text style={s.hint}>{hint}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ true: colors.accent, false: colors.border }}
        thumbColor="#fff"
      />
    </Pressable>
  );
}

export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={s.segmented}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable key={String(o.value)} onPress={() => onChange(o.value)} style={[s.segment, active && s.segmentActive]}>
            <Text style={[s.segmentText, active && { color: colors.accentText }]} numberOfLines={1}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Chip({
  label,
  active,
  onPress,
  color,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
  color?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[s.chip, active && { backgroundColor: color ?? colors.accent, borderColor: color ?? colors.accent }]}
    >
      <Text style={[s.chipText, active && { color: '#fff' }]}>{label}</Text>
    </Pressable>
  );
}

export function Input(props: TextInputProps) {
  return <TextInput placeholderTextColor={colors.muted} {...props} style={[s.input, props.style]} />;
}

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[s.card, style]}>{children}</View>;
}

export const ui = StyleSheet.create({
  text: { color: colors.text, fontSize: font.body },
  muted: { color: colors.muted, fontSize: font.small },
  h1: { color: colors.text, fontSize: font.h1, fontWeight: '800' },
  h2: { color: colors.text, fontSize: font.h2, fontWeight: '800' },
  h3: { color: colors.text, fontSize: font.h3, fontWeight: '700' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  back: { paddingRight: 8 },
  backText: { color: colors.text, fontSize: 38, lineHeight: 40, fontWeight: '300' },
  title: { color: colors.text, fontSize: font.h2, fontWeight: '800', flexShrink: 1 },
  content: { padding: 16, paddingBottom: 32, gap: 16 },
  footer: { padding: 16, paddingTop: 8, gap: 10, borderTopWidth: 1, borderTopColor: colors.surface2 },
  btn: { borderRadius: radius.md, paddingVertical: 16, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center' },
  btnText: { color: colors.text, fontSize: font.body, fontWeight: '700' },
  section: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 16 },
  sectionTitle: { color: colors.text, fontSize: font.h3, fontWeight: '800' },
  hint: { color: colors.muted, fontSize: font.small, marginTop: 4 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 },
  rowLabel: { color: colors.text, fontSize: font.body, fontWeight: '600' },
  stepper: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface2, borderRadius: radius.md },
  stepBtn: { width: 52, height: 48, alignItems: 'center', justifyContent: 'center' },
  stepText: { color: colors.text, fontSize: 28, fontWeight: '600' },
  stepValue: { color: colors.text, fontSize: font.h3, fontWeight: '800', minWidth: 36, textAlign: 'center' },
  segmented: { flexDirection: 'row', backgroundColor: colors.surface2, borderRadius: radius.md, padding: 4 },
  segment: { flex: 1, paddingVertical: 12, borderRadius: radius.sm, alignItems: 'center' },
  segmentActive: { backgroundColor: colors.accent },
  segmentText: { color: colors.muted, fontSize: font.small + 1, fontWeight: '700' },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface2,
  },
  chipText: { color: colors.text, fontSize: font.small + 1, fontWeight: '600' },
  input: {
    backgroundColor: colors.surface2,
    color: colors.text,
    borderRadius: radius.sm,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: font.body,
    borderWidth: 1,
    borderColor: colors.border,
  },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 16 },
});
