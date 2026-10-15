import { ActivityIndicator, FlatList, RefreshControl, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { MessageCircle } from 'lucide-react-native';

import { RoomListRow } from '@/components/room-list-row';
import { EmptyState } from '@/components/ui/empty-state';
import { useMyActors } from '@/hooks/use-console';
import { useTheme } from '@/hooks/use-theme';
import { useManualRefresh } from '@/hooks/use-manual-refresh';
import { MaxContentWidth, Spacing } from '@/constants/theme';

/**
 * 아티스트 첫 화면 "토피룸"(2026-10-14 사용자 요청: 카톡 대화방 목록처럼) — 내 방(개인방·CP방)마다 사진·이름·마지막 메시지·시간,
 * 최근에 보낸 방이 위. 방이 하나여도 목록부터(예전엔 바로 그 방으로 들어갔음).
 */
export default function StudioRoomsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const { data: actors, isLoading, refetch } = useMyActors();
  const { refreshing, onRefresh } = useManualRefresh(refetch);
  const rooms = [...(actors ?? [])].sort(
    (a, b) => new Date(b.lastMessage?.createdAt ?? 0).getTime() - new Date(a.lastMessage?.createdAt ?? 0).getTime(),
  );

  if (isLoading) return <ActivityIndicator style={styles.loading} color={theme.tint} />;
  return (
    <FlatList
      data={rooms}
      keyExtractor={(item) => item.id}
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.tint} />}
      ListEmptyComponent={<EmptyState icon={MessageCircle} title={t('studio.noActor')} />}
      renderItem={({ item }) => <RoomListRow actor={item} onPress={() => router.push(`/studio/${item.id}`)} />}
    />
  );
}

const styles = StyleSheet.create({
  loading: { marginTop: Spacing.six },
  list: { paddingVertical: Spacing.two, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
});
