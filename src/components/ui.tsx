import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { ComponentProps, ReactNode } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View,
  type StyleProp, type TextInputProps, type TextStyle, type ViewStyle,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { create } from 'zustand';

import { useStore } from '@/lib/store';
import { C, F, TONES, type Tone } from '@/lib/theme';

// ---------------------------------------------------------------- text
type W = keyof typeof F;
export function useScale() {
  return useStore((s) => (s.settings.largeText ? 1.2 : 1));
}

export function T({
  children, size = 15, w = 'r', color = C.ink, style, lines, center, selectable,
}: {
  children: ReactNode; size?: number; w?: W; color?: string; style?: StyleProp<TextStyle>; lines?: number; center?: boolean; selectable?: boolean;
}) {
  const k = useScale();
  return (
    <Text
      numberOfLines={lines}
      selectable={selectable}
      style={[{ fontFamily: F[w], fontSize: size * k, lineHeight: Math.round(size * k * 1.38), color }, center && { textAlign: 'center' }, style]}>
      {children}
    </Text>
  );
}

export const Over = ({ children, color = C.green }: { children: ReactNode; color?: string }) => (
  <T size={11} w="b" color={color} style={{ letterSpacing: 1, textTransform: 'uppercase' }}>
    {children}
  </T>
);

// ---------------------------------------------------------------- icons
export type IconName = ComponentProps<typeof Feather>['name'];
type MciName = ComponentProps<typeof MaterialCommunityIcons>['name'];
const MCI: Record<string, MciName> = { pill: 'pill', scan: 'line-scan', food: 'silverware-fork-knife', tablet: 'pill', capsule: 'pill' };
export type AnyIcon = IconName | keyof typeof MCI;

export function Icon({ name, size = 20, color = C.ink }: { name: AnyIcon; size?: number; color?: string }) {
  if (name in MCI) return <MaterialCommunityIcons name={MCI[name as keyof typeof MCI]} size={size} color={color} />;
  return <Feather name={name as IconName} size={size} color={color} />;
}

export function IconBox({
  name, kind = 'tint', size = 40, icon = 19,
}: { name: AnyIcon; kind?: 'tint' | 'solid' | 'white' | 'amber' | 'orange' | 'red'; size?: number; icon?: number }) {
  const bg = { tint: C.iconbg, solid: C.green, white: C.white, amber: C.amberbg, orange: C.orangebg, red: C.redbg }[kind];
  const fg = { tint: C.green, solid: C.white, white: C.green, amber: C.amber, orange: C.orange, red: C.red }[kind];
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.3, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={name} size={icon} color={fg} />
    </View>
  );
}

export function Avatar({ text, tone = 'green', size = 44 }: { text: string; tone?: Tone; size?: number }) {
  const t = TONES[tone];
  const initials = text.replace(/^(dr|mr|mrs|ms)\.?\s+/i, '').split(/\s+/).filter(Boolean).map((p) => p[0]).join('').slice(0, 2).toUpperCase() || '?';
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: t.bg, alignItems: 'center', justifyContent: 'center' }}>
      <T size={size * 0.32} w="b" color={t.fg}>
        {initials}
      </T>
    </View>
  );
}

export function MedBadge({ name, tone, size = 46 }: { name: string; tone: Tone; size?: number }) {
  const t = TONES[tone];
  const caps = name.match(/[A-Z]/g) ?? [];
  const ab = (caps.length >= 2 ? caps.slice(0, 2).join('') : name.replace(/[^A-Za-z]/g, '').slice(0, 2)).toUpperCase() || 'RX';
  return (
    <View style={{ width: size, height: size, borderRadius: 14, backgroundColor: t.bg, alignItems: 'center', justifyContent: 'center' }}>
      <T size={14} w="b" color={t.fg}>
        {ab}
      </T>
    </View>
  );
}

// ---------------------------------------------------------------- containers
export function Card({ children, style, tint, dark, onPress, label }: { children: ReactNode; style?: StyleProp<ViewStyle>; tint?: boolean; dark?: boolean; onPress?: () => void; label?: string }) {
  const s = [styles.card, tint && styles.tint, dark && styles.dark, style];
  if (onPress) {
    return (
      <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [s, pressed && { opacity: 0.85 }]}>
        {children}
      </Pressable>
    );
  }
  return <View style={s}>{children}</View>;
}

export function Screen({
  children, top, scroll = true, dark, padBottom = true, refresh,
}: { children: ReactNode; top?: ReactNode; scroll?: boolean; dark?: boolean; padBottom?: boolean; refresh?: ReactNode }) {
  const bg = dark ? C.night : C.bg;
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: bg }}>
      {top}
      {scroll ? (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 6, paddingBottom: padBottom ? 120 : 30, gap: 18 }}
          keyboardShouldPersistTaps="handled"
          refreshControl={refresh as never}>
          {children}
        </ScrollView>
      ) : (
        <View style={{ flex: 1, paddingHorizontal: 20 }}>{children}</View>
      )}
    </SafeAreaView>
  );
}

export function TopBar({ right }: { right?: ReactNode }) {
  return (
    <View style={styles.topbar}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
        <View style={styles.logo}>
          <Feather name="plus" size={17} color={C.white} />
        </View>
        <Text style={{ fontFamily: F.b, fontSize: 22, letterSpacing: -0.6 }}>
          <Text style={{ color: C.deep }}>Med</Text>
          <Text style={{ color: C.mint }}>Ora</Text>
        </Text>
      </View>
      {right ?? (
        <Pressable accessibilityLabel="Reminders" onPress={() => router.push('/reminders')} style={styles.round}>
          <Feather name="bell" size={19} color={C.ink} />
        </Pressable>
      )}
    </View>
  );
}

export function BackBar({ title, right, dark }: { title?: string; right?: ReactNode; dark?: boolean }) {
  return (
    <View style={[styles.topbar, { paddingBottom: 6 }]}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} style={{ flexDirection: 'row', alignItems: 'center', gap: 2, paddingVertical: 8, paddingRight: 12 }}>
        <Feather name="chevron-left" size={22} color={dark ? '#CDEBDD' : C.green} />
        <T w="sb" color={dark ? '#CDEBDD' : C.green}>
          {title ?? 'Back'}
        </T>
      </Pressable>
      {right}
    </View>
  );
}

export function PageTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <View style={{ gap: 2 }}>
      <T size={27} w="sb" style={{ letterSpacing: -0.6 }}>
        {title}
      </T>
      {sub ? <T color={C.muted}>{sub}</T> : null}
    </View>
  );
}

export function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <T size={17} w="sb">
          {title}
        </T>
        {action}
      </View>
      {children}
    </View>
  );
}

export function TextLink({ title, onPress, size = 14, icon = true, color = C.green }: { title: string; onPress: () => void; size?: number; icon?: boolean; color?: string }) {
  return (
    <Pressable accessibilityRole="link" onPress={onPress} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
      <T size={size} w="b" color={color}>
        {title}
      </T>
      {icon ? <Feather name="chevron-right" size={size + 2} color={color} /> : null}
    </Pressable>
  );
}

// ---------------------------------------------------------------- chips & buttons
const CHIP = {
  ok: [C.sage, C.sageink], up: [C.amberbg, C.amber], sk: [C.skip, C.soft], new: [C.lav, C.lavink], plan: [C.iconbg, C.deep],
  warn: [C.orangebg, C.orange], bad: [C.redbg, C.red], nc: [C.skip, C.soft], light: ['rgba(255,255,255,0.14)', '#CDEBDD'],
} as const;
export type ChipKind = keyof typeof CHIP;
export function Chip({ label, kind = 'ok', icon }: { label: string; kind?: ChipKind; icon?: AnyIcon }) {
  const [bg, fg] = CHIP[kind];
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: bg, borderRadius: 99, paddingHorizontal: 9, paddingVertical: 3, alignSelf: 'flex-start' }}>
      {icon ? <Icon name={icon} size={12} color={fg} /> : null}
      <T size={11.5} w="b" color={fg}>
        {label}
      </T>
    </View>
  );
}

export function Btn({
  title, onPress, kind = 'primary', icon, size = 'md', block, disabled, loading, style,
}: {
  title: string; onPress: () => void; kind?: 'primary' | 'ghost' | 'soft' | 'light' | 'white' | 'danger';
  icon?: AnyIcon; size?: 'sm' | 'md' | 'xl'; block?: boolean; disabled?: boolean; loading?: boolean; style?: StyleProp<ViewStyle>;
}) {
  const bg = { primary: C.green, ghost: C.card, soft: C.tint, light: 'rgba(255,255,255,0.14)', white: C.white, danger: C.redbg }[kind];
  const fg = { primary: C.white, ghost: C.ink, soft: C.deep, light: C.white, white: C.deep, danger: C.red }[kind];
  const border = { primary: C.green, ghost: C.line, soft: C.tint2, light: 'rgba(255,255,255,0.3)', white: C.white, danger: C.redbg }[kind];
  const h = { sm: 40, md: 50, xl: 60 }[size];
  const fs = { sm: 14, md: 15.5, xl: 18 }[size];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled || !!loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        { minHeight: h, borderRadius: size === 'sm' ? 12 : 15, backgroundColor: bg, borderWidth: 1, borderColor: border, paddingHorizontal: size === 'sm' ? 13 : 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
        block && { alignSelf: 'stretch' },
        !block && { alignSelf: 'flex-start' },
        (disabled || loading) && { opacity: 0.5 },
        pressed && { opacity: 0.8, transform: [{ scale: 0.985 }] },
        style,
      ]}>
      {loading ? <ActivityIndicator color={fg} /> : icon ? <Icon name={icon} size={fs + 2} color={fg} /> : null}
      <T size={fs} w="sb" color={fg} center>
        {title}
      </T>
    </Pressable>
  );
}

export function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <Switch
      accessibilityLabel={label}
      value={value}
      onValueChange={onChange}
      trackColor={{ false: '#C9D3CF', true: C.green }}
      thumbColor={C.white}
      ios_backgroundColor="#C9D3CF"
    />
  );
}

export function Row({
  icon, iconKind, title, sub, onPress, right, last, chevron = true,
}: { icon?: AnyIcon; iconKind?: 'tint' | 'amber' | 'orange' | 'red'; title: string; sub?: string; onPress?: () => void; right?: ReactNode; last?: boolean; chevron?: boolean }) {
  const body = (
    <View style={[styles.row, last && { borderBottomWidth: 0 }]}>
      {icon ? <IconBox name={icon} kind={iconKind} size={38} icon={17} /> : null}
      <View style={{ flex: 1, minWidth: 0 }}>
        <T w="sb">{title}</T>
        {sub ? <T size={13} color={C.muted}>{sub}</T> : null}
      </View>
      {right}
      {onPress && chevron && !right ? <Feather name="chevron-right" size={19} color={C.faint} /> : null}
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => pressed && { opacity: 0.7 }}>
      {body}
    </Pressable>
  );
}

export function KV({ k, v, last }: { k: string; v: string; last?: boolean }) {
  return (
    <View style={[styles.row, { paddingVertical: 11 }, last && { borderBottomWidth: 0 }]}>
      <T size={14} color={C.muted} style={{ flexShrink: 0 }}>
        {k}
      </T>
      <T size={14} w="sb" style={{ flex: 1, textAlign: 'right' }}>
        {v || '—'}
      </T>
    </View>
  );
}

// ---------------------------------------------------------------- inputs
export function Field({ label: lab, hint, ...props }: TextInputProps & { label: string; hint?: string }) {
  const k = useScale();
  return (
    <View style={{ gap: 6 }}>
      <T size={13} w="sb" color={C.soft}>
        {lab}
      </T>
      <TextInput
        placeholderTextColor={C.faint}
        {...props}
        style={[{ borderWidth: 1, borderColor: C.line, borderRadius: 13, paddingHorizontal: 13, paddingVertical: 12, fontFamily: F.r, fontSize: 16 * k, color: C.ink, backgroundColor: C.card }, props.multiline && { minHeight: 80, textAlignVertical: 'top' }]}
      />
      {hint ? <T size={12} color={C.muted}>{hint}</T> : null}
    </View>
  );
}

export function Choice<V extends string>({ options, value, onChange, labels }: { options: readonly V[]; value: V; onChange: (v: V) => void; labels?: Partial<Record<V, string>> }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {options.map((o) => {
        const on = o === value;
        return (
          <Pressable key={o} accessibilityRole="radio" accessibilityState={{ selected: on }} onPress={() => onChange(o)} style={[styles.choice, on && styles.choiceOn]}>
            <T size={14} w="sb" color={on ? C.white : C.ink}>
              {labels?.[o] ?? o}
            </T>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Segmented<V extends string>({ options, value, onChange }: { options: { value: V; label: string }[]; value: V; onChange: (v: V) => void }) {
  return (
    <View style={{ flexDirection: 'row', backgroundColor: '#ECEFED', borderRadius: 14, padding: 4, alignSelf: 'flex-start' }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable key={o.value} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => onChange(o.value)} style={[{ paddingVertical: 9, paddingHorizontal: 16, borderRadius: 11 }, on && { backgroundColor: C.card, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 1 }]}>
            <T size={14} w="sb" color={on ? C.ink : C.soft}>
              {o.label}
            </T>
          </Pressable>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------- sheet
export function Sheet({ visible, onClose, title, sub, children }: { visible: boolean; onClose: () => void; title: string; sub?: string; children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <Pressable style={{ flex: 1, backgroundColor: C.scrim }} onPress={onClose} accessibilityLabel="Close" />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 20 }]}>
          <View style={styles.grab} />
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
            <View style={{ flex: 1 }}>
              <T size={21} w="sb">
                {title}
              </T>
              {sub ? <T size={14} color={C.muted}>{sub}</T> : null}
            </View>
            <Pressable accessibilityLabel="Close" onPress={onClose} style={[styles.round, { width: 36, height: 36, backgroundColor: C.bg, borderWidth: 0 }]}>
              <Feather name="x" size={18} color={C.ink} />
            </Pressable>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 14 }}>
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function Callout({ children, kind = 'info', icon }: { children: ReactNode; kind?: 'info' | 'warn' | 'bad'; icon?: AnyIcon }) {
  const bg = { info: C.tint, warn: C.amberbg, bad: C.redbg }[kind];
  const fg = { info: C.deep, warn: C.amber, bad: C.red }[kind];
  return (
    <View style={{ flexDirection: 'row', gap: 10, backgroundColor: bg, borderRadius: 14, padding: 12, alignItems: 'flex-start' }}>
      <Icon name={icon ?? (kind === 'info' ? 'shield' : 'alert-triangle')} size={18} color={fg} />
      <View style={{ flex: 1 }}>
        {typeof children === 'string' ? (
          <T size={14} color={fg}>
            {children}
          </T>
        ) : (
          children
        )}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------- toast
type ToastState = { msg: string | null; show: (m: string) => void };
let timer: ReturnType<typeof setTimeout> | null = null;
export const useToast = create<ToastState>((set) => ({
  msg: null,
  show: (msg) => {
    if (timer) clearTimeout(timer);
    set({ msg });
    timer = setTimeout(() => set({ msg: null }), 3000);
  },
}));
export const toast = (m: string) => useToast.getState().show(m);

export function ToastHost() {
  const msg = useToast((s) => s.msg);
  const insets = useSafeAreaInsets();
  if (!msg) return null;
  return (
    <View pointerEvents="none" style={[styles.toast, { bottom: insets.bottom + 92 }]} accessibilityLiveRegion="polite">
      <Feather name="check-circle" size={18} color="#9FE0C4" />
      <T size={14.5} w="m" color={C.white} style={{ flex: 1 }}>
        {msg}
      </T>
    </View>
  );
}

export const styles = StyleSheet.create({
  card: { backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 20, padding: 16 },
  tint: { backgroundColor: C.tint, borderColor: C.tint2 },
  dark: { backgroundColor: C.green2, borderColor: C.green2 },
  topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 10 },
  logo: { width: 32, height: 32, borderRadius: 9, backgroundColor: C.green, alignItems: 'center', justifyContent: 'center' },
  round: { width: 42, height: 42, borderRadius: 21, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.line2 },
  choice: { paddingVertical: 9, paddingHorizontal: 15, borderRadius: 99, borderWidth: 1, borderColor: C.line, backgroundColor: C.card },
  choiceOn: { backgroundColor: C.green, borderColor: C.green },
  sheet: { backgroundColor: C.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 8, maxHeight: '90%' },
  grab: { width: 42, height: 5, borderRadius: 3, backgroundColor: '#D5DCD9', alignSelf: 'center', marginBottom: 12 },
  toast: { position: 'absolute', left: 16, right: 16, backgroundColor: C.deep, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 10, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 6 },
});
