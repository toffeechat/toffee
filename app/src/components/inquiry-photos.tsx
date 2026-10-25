import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { ImagePlus, X } from 'lucide-react-native';

import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { INQUIRY_PHOTO_MAX, type InquiryPhoto, type PickedPhoto } from '@/hooks/use-support';
import { useTheme } from '@/hooks/use-theme';
import { Radius, Spacing } from '@/constants/theme';

/**
 * 1:1 문의 사진(2026-10-25 — 결제 영수증·오류 화면) — 회원 화면·운영자 화면 공통.
 * 문구는 부르는 쪽이 넘김(회원 화면은 9개 언어, 운영자 화면은 한국어).
 */

/** 보낼 사진 고르기 — 고른 사진 미리보기(× 빼기) + 3장이 안 되면 "사진 추가" 칸. 올리기는 보낼 때 */
export function InquiryPhotoPicker({
  photos,
  onChange,
  addLabel,
  removeLabel,
  disabled,
}: {
  photos: PickedPhoto[];
  onChange: (photos: PickedPhoto[]) => void;
  addLabel: string;
  removeLabel: string;
  disabled?: boolean;
}) {
  const theme = useTheme();
  const remaining = INQUIRY_PHOTO_MAX - photos.length;
  const pick = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: remaining, quality: 0.8 });
    if (result.canceled) return;
    // 웹은 selectionLimit를 안 지켜서 여기서 자름
    const added = result.assets.map((asset) => ({ uri: asset.uri, mimeType: asset.mimeType ?? undefined }));
    onChange([...photos, ...added].slice(0, INQUIRY_PHOTO_MAX));
  };
  return (
    <View style={styles.row}>
      {photos.map((photo, index) => (
        <View key={photo.uri} style={[styles.tile, { backgroundColor: theme.backgroundElement }]}>
          <Image source={{ uri: photo.uri }} style={styles.image} contentFit="cover" />
          <Pressable
            onPress={() => onChange(photos.filter((_, i) => i !== index))}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel={removeLabel}
            hitSlop={6}
            style={styles.remove}>
            <Icon as={X} size={14} color="#ffffff" strokeWidth={2.5} />
          </Pressable>
        </View>
      ))}
      {remaining > 0 ? (
        <Pressable
          onPress={() => void pick()}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={addLabel}
          style={({ pressed }) => [styles.tile, styles.add, { borderColor: theme.border, opacity: disabled ? 0.4 : pressed ? 0.6 : 1 }]}>
          <Icon as={ImagePlus} size={22} themeColor="textSecondary" />
          <ThemedText type="caption" themeColor="textSecondary">
            {photos.length}/{INQUIRY_PHOTO_MAX}
          </ThemedText>
        </Pressable>
      ) : null}
    </View>
  );
}

/** 글에 붙은 사진 — 누르면 전체 화면(확대·저장, media-viewer). 저장소가 안 되면 대신 안내 문구 */
export function InquiryPhotoStrip({ photos, size = 88, openLabel, unavailableLabel }: { photos: InquiryPhoto[]; size?: number; openLabel: string; unavailableLabel: string }) {
  const theme = useTheme();
  const router = useRouter();
  if (photos.length === 0) return null;
  return (
    <View style={styles.row}>
      {photos.map((photo) =>
        photo.url ? (
          <Pressable
            key={photo.id}
            onPress={() => router.push({ pathname: '/media-viewer', params: { id: `inquiry-${photo.id}`, url: photo.url!, type: 'PHOTO' } })}
            accessibilityRole="imagebutton"
            accessibilityLabel={openLabel}
            style={({ pressed }) => [styles.tile, { width: size, height: size, backgroundColor: theme.backgroundSelected, opacity: pressed ? 0.7 : 1 }]}>
            <Image source={{ uri: photo.url }} style={styles.image} contentFit="cover" />
          </Pressable>
        ) : (
          <View key={photo.id} style={[styles.tile, styles.add, { width: size, height: size, borderColor: theme.border }]}>
            <ThemedText type="caption" themeColor="textTertiary" style={styles.center}>
              {unavailableLabel}
            </ThemedText>
          </View>
        ),
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  tile: { width: 72, height: 72, borderRadius: Radius.md, overflow: 'hidden' },
  image: { width: '100%', height: '100%' },
  add: { borderWidth: 1, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 2, padding: 4 },
  remove: { position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(15,17,21,0.65)', alignItems: 'center', justifyContent: 'center' },
  center: { textAlign: 'center' },
});
