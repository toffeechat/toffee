import { useEffect, useState } from 'react';
import { Modal, Platform, Pressable, Share, StyleSheet, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Check, Copy, Share2 } from 'lucide-react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/hooks/use-theme';
import { loadDemoCode, useIsDemoAccount } from '@/lib/demo-switch';
import { Radius, Spacing } from '@/constants/theme';

// 웹 주소 — 웹이면 지금 주소, 앱이면 EXPO_PUBLIC_WEB_URL(없으면 데모 웹)
const WEB_URL =
  process.env.EXPO_PUBLIC_WEB_URL ?? (Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin : 'https://demo.toffeechat.app');

/**
 * "PC로 이어 보기"(2026-11-24 — 소속사 폰 화면 개선 5번): 폰으로 먼저 본 담당자가 PC 큰 화면으로 다시 열 수 있게 링크 복사·공유.
 * 데모 계정이면 입장 코드가 든 링크(`?demo=코드&as=agency`, PC에서 열면 바로 소속사 화면), 아니면 웹 주소만(로그인 필요).
 */
export function PcContinueSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const isDemo = useIsDemoAccount();
  const [code, setCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (visible && isDemo) void loadDemoCode().then(setCode);
  }, [visible, isDemo]);
  const close = () => {
    setCopied(false);
    onClose();
  };

  const base = WEB_URL.replace(/\/$/, '');
  const url = isDemo && code ? `${base}/?demo=${encodeURIComponent(code)}&as=agency&lang=${encodeURIComponent(i18n.language)}` : `${base}/`;
  // 화면에 보이는 주소는 코드를 가림(옆 사람이 보거나 화면을 찍어도 코드가 드러나지 않게) — 복사·공유엔 실제 주소
  const shown = isDemo && code ? `${base.replace(/^https?:\/\//, '')}/?demo=••••&as=agency` : base.replace(/^https?:\/\//, '');
  const canShare = Platform.OS !== 'web' || (typeof navigator !== 'undefined' && typeof navigator.share === 'function');

  const copy = async () => {
    await Clipboard.setStringAsync(url);
    setCopied(true);
  };
  const share = async () => {
    const message = `${t('pcContinue.shareMessage')}\n${url}`;
    try {
      if (Platform.OS === 'web') await navigator.share({ text: message });
      else await Share.share({ message });
    } catch {
      // 공유창을 닫았거나 막힘 — 복사 버튼이 있으니 그대로 둠
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <Pressable style={styles.dim} onPress={close} accessibilityRole="button" accessibilityLabel={t('pcContinue.close')} />
      <View style={[styles.sheet, { backgroundColor: theme.background, paddingBottom: insets.bottom + Spacing.four }]}>
        <View style={[styles.grab, { backgroundColor: theme.border }]} />
        <ThemedText type="title">{t('pcContinue.title')}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {t(isDemo ? 'pcContinue.bodyDemo' : 'pcContinue.body')}
        </ThemedText>
        <PcIllustration />
        <View style={[styles.url, { backgroundColor: theme.backgroundElement }]}>
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1} selectable={!isDemo}>
            {shown}
          </ThemedText>
        </View>
        <View style={styles.row}>
          <View style={styles.flex}>
            <Button title={copied ? t('pcContinue.copied') : t('pcContinue.copy')} icon={copied ? Check : Copy} onPress={() => void copy()} />
          </View>
          {canShare ? (
            <View style={styles.flex}>
              <Button title={t('pcContinue.share')} icon={Share2} variant="secondary" onPress={() => void share()} />
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

/** PC 화면 모양(왼쪽 메뉴 + 숫자 카드 + 그래프) — 글자 없는 그림이라 어느 언어에서도 같음 */
function PcIllustration() {
  const theme = useTheme();
  const block = { backgroundColor: theme.backgroundElement };
  return (
    <View style={[styles.pc, { borderColor: theme.border }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={[styles.pcSide, { borderRightColor: theme.border }]}>
        <View style={[styles.pcLogo, { backgroundColor: theme.tint }]} />
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={[styles.pcMenu, i === 0 ? { backgroundColor: theme.tintSoft } : block]} />
        ))}
      </View>
      <View style={styles.pcBody}>
        <View style={styles.pcCards}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={[styles.pcCard, { borderColor: theme.border }]}>
              <View style={[styles.pcNum, { backgroundColor: theme.text }]} />
              <View style={[styles.pcLine, { backgroundColor: i === 1 ? theme.chart2 : theme.chart1 }]} />
            </View>
          ))}
        </View>
        <View style={[styles.pcChart, { borderColor: theme.border }]}>
          {[10, 18, 12, 24, 16, 30, 22, 34].map((h, i) => (
            <View key={i} style={[styles.pcBar, { height: h, backgroundColor: i === 7 ? theme.chart1 : theme.tintSoft }]} />
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  dim: { flex: 1, backgroundColor: 'rgba(15,17,21,0.4)' },
  sheet: { borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, paddingHorizontal: Spacing.four, paddingTop: Spacing.two, gap: Spacing.three, width: '100%', maxWidth: 560, alignSelf: 'center' },
  grab: { width: 40, height: 5, borderRadius: 3, alignSelf: 'center', marginBottom: Spacing.one },
  url: { borderRadius: Radius.md, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two + 2 },
  row: { flexDirection: 'row', gap: Spacing.two },
  pc: { flexDirection: 'row', borderWidth: 1, borderRadius: Radius.md, overflow: 'hidden', height: 120 },
  pcSide: { width: 64, borderRightWidth: StyleSheet.hairlineWidth, padding: 8, gap: 5 },
  pcLogo: { width: 28, height: 6, borderRadius: 3, marginBottom: 4 },
  pcMenu: { height: 8, borderRadius: 3 },
  pcBody: { flex: 1, padding: 8, gap: 6 },
  pcCards: { flexDirection: 'row', gap: 6 },
  pcCard: { flex: 1, borderWidth: StyleSheet.hairlineWidth, borderRadius: 6, padding: 6, gap: 6 },
  pcNum: { width: 18, height: 8, borderRadius: 2 },
  pcLine: { height: 3, borderRadius: 2 },
  pcChart: { flex: 1, borderWidth: StyleSheet.hairlineWidth, borderRadius: 6, flexDirection: 'row', alignItems: 'flex-end', gap: 4, padding: 6 },
  pcBar: { flex: 1, borderRadius: 2 },
});
