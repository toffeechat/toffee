import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as ImagePicker from 'expo-image-picker';

import { ThemedText } from '@/components/themed-text';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api-client';
import { confirm } from '@/lib/confirm';
import { uploadMyProfileImage } from '@/lib/upload-media';
import { useMe, useUpdateProfile } from '@/hooks/use-onboarding';
import { useTheme } from '@/hooks/use-theme';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';

const STATUS_MAX = 60;

/**
 * 팬 프로필 편집(2026-10-12 사용자 결정으로 1차) — 프로필 사진·상태메시지. 닉네임은 7일 규칙이 있어 따로(설정 > 닉네임).
 * 다른 팬에겐 안 보이고, 내 답장을 보는 아티스트·소속사 화면에만 보임(안내 문구). 금칙어·60자는 서버가 검사.
 */
export default function ProfileEditScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const { data: me } = useMe();
  const update = useUpdateProfile();
  const [status, setStatus] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);
  const statusValue = status ?? me?.statusMessage ?? '';

  const fail = (error: unknown) => setNotice({ text: error instanceof ApiError && error.message ? error.message : t('profileEdit.failed'), error: true });

  const pickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.85 });
    const asset = result.canceled ? null : result.assets[0];
    if (!asset) return;
    setNotice(null);
    setUploading(true);
    try {
      await update.mutateAsync({ profileImageKey: await uploadMyProfileImage(asset.uri, asset.mimeType) });
    } catch (error) {
      fail(error);
    } finally {
      setUploading(false);
    }
  };

  const removePhoto = async () => {
    if (!(await confirm(t('chatPhoto.removeTitle'), t('chatPhoto.removeConfirm'), t('chatPhoto.remove'), t('common.cancel')))) return;
    setNotice(null);
    update.mutate({ profileImageKey: null }, { onError: fail });
  };

  const saveStatus = () => {
    setNotice(null);
    update.mutate(
      { statusMessage: statusValue },
      { onSuccess: () => router.back(), onError: fail },
    );
  };

  const busy = uploading || update.isPending;
  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
      <View style={styles.photo}>
        <Avatar uri={me?.profileImageUrl} size={96} />
        <View style={styles.photoActions}>
          <Pressable accessibilityRole="button" disabled={busy} onPress={pickPhoto} style={[styles.chip, { borderColor: theme.backgroundSelected }, busy && styles.disabled]}>
            <ThemedText type="small">{uploading ? t('chatPhoto.uploading') : t('chatPhoto.change')}</ThemedText>
          </Pressable>
          {me?.profileImageUrl ? (
            <Pressable accessibilityRole="button" disabled={busy} onPress={removePhoto} style={[styles.chip, { borderColor: theme.backgroundSelected }, busy && styles.disabled]}>
              <ThemedText type="small" themeColor="danger">
                {t('chatPhoto.remove')}
              </ThemedText>
            </Pressable>
          ) : null}
        </View>
      </View>

      <ThemedText type="smallBold">{t('profileEdit.status')}</ThemedText>
      <TextInput
        value={statusValue}
        onChangeText={(value) => (setStatus(value), setNotice(null))}
        maxLength={STATUS_MAX}
        placeholder={t('profileEdit.statusPlaceholder')}
        placeholderTextColor={theme.textTertiary}
        style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
      />
      <ThemedText type="caption" themeColor="textTertiary" style={styles.counter}>
        {`${[...statusValue].length}/${STATUS_MAX}`}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {t('profileEdit.visibility')}
      </ThemedText>
      {notice ? (
        <ThemedText type="small" themeColor={notice.error ? 'danger' : 'textSecondary'}>
          {notice.text}
        </ThemedText>
      ) : null}
      <Button title={t('profileEdit.save')} onPress={saveStatus} loading={update.isPending && !uploading} disabled={busy} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: Spacing.four, gap: Spacing.two, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  photo: { alignItems: 'center', gap: Spacing.three, marginBottom: Spacing.three },
  photoActions: { flexDirection: 'row', gap: Spacing.two },
  chip: { borderWidth: 1, borderRadius: 8, paddingHorizontal: Spacing.two, paddingVertical: 4 },
  disabled: { opacity: 0.5 },
  input: { borderRadius: Radius.md, paddingHorizontal: Spacing.three, paddingVertical: Spacing.three, fontSize: 16 },
  counter: { alignSelf: 'flex-end' },
});
