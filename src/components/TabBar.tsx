import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { Pressable, StyleSheet, View } from 'react-native';

import { C } from '@/lib/theme';

import { Icon, T, type AnyIcon } from './ui';

const ITEMS: Record<string, { label: string; icon: AnyIcon }> = {
  index: { label: 'Home', icon: 'home' },
  medicines: { label: 'Medicines', icon: 'pill' },
  scan: { label: 'Scan', icon: 'scan' },
  care: { label: 'Care Team', icon: 'users' },
  profile: { label: 'Profile', icon: 'user' },
};

export function TabBar({ state, navigation, insets }: BottomTabBarProps) {
  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {state.routes.map((route, index) => {
        const item = ITEMS[route.name];
        if (!item) return null;
        const focused = state.index === index;
        const scan = route.name === 'scan';
        const onPress = () => {
          const e = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !e.defaultPrevented) navigation.navigate(route.name);
        };
        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={item.label}
            onPress={onPress}
            style={styles.item}>
            {scan ? (
              <View style={styles.scan}>
                <Icon name="scan" size={26} color={C.white} />
              </View>
            ) : (
              <View style={[styles.pill, focused && { backgroundColor: C.navon }]}>
                <Icon name={item.icon} size={21} color={focused ? C.green : C.muted} />
              </View>
            )}
            <T size={11} w="sb" color={focused || scan ? C.green : C.muted}>
              {item.label}
            </T>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.98)', borderTopWidth: 1, borderTopColor: C.line, paddingTop: 6, paddingHorizontal: 6 },
  item: { flex: 1, alignItems: 'center', gap: 3, paddingVertical: 2 },
  pill: { width: 46, height: 30, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  scan: {
    width: 58, height: 58, borderRadius: 29, backgroundColor: C.green, alignItems: 'center', justifyContent: 'center', marginTop: -26,
    borderWidth: 4, borderColor: C.white, shadowColor: C.green, shadowOpacity: 0.45, shadowRadius: 10, shadowOffset: { width: 0, height: 6 }, elevation: 6,
  },
});
