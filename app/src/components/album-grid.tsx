import { StyleSheet, View } from 'react-native';

import { MediaTile } from '@/components/media-tile';
import type { ChatMessage } from '@/hooks/use-messages';
import { albumLayout } from '@/utils/chat-album';
import { Radius } from '@/constants/theme';

const ALBUM_WIDTH = 240;
const ALBUM_GAP = 2;

/**
 * 연달아 온 사진·영상 격자(2026-10-13 팬 토피룸, 2026-10-15부터 아티스트 스튜디오도 같은 모양) — 2·3개 한 줄, 4개 2+2, 그 이상 3개씩.
 * 칸을 누르면 전체 화면(actorId가 있으면 그 방 사진을 좌우로), 길게 누르면 그 칸의 메시지 메뉴(onLongPressItem — 아티스트는 한 장씩 회수)
 */
export function AlbumGrid({ items, actorId, onLongPressItem }: { items: ChatMessage[]; actorId?: string; onLongPressItem?: (id: string) => void }) {
  const lines = albumLayout(items.length);
  // 줄마다 시작 위치(앞 줄들 칸 수의 합)
  const starts = lines.map((_, line) => lines.slice(0, line).reduce((sum, n) => sum + n, 0));
  return (
    <View style={styles.album}>
      {lines.map((columns, line) => {
        const slice = items.slice(starts[line], starts[line] + columns);
        const cell = (ALBUM_WIDTH - ALBUM_GAP * (columns - 1)) / columns;
        return (
          <View key={line} style={styles.albumLine}>
            {slice.map((item) => (
              <MediaTile
                key={item.id}
                id={item.id}
                url={item.mediaUrl}
                mediaType={item.mediaType as 'PHOTO' | 'VIDEO'}
                durationMs={item.mediaDurationMs}
                thumbnailUrl={item.thumbnailUrl}
                thumbhash={item.thumbhash}
                actorId={actorId}
                size={{ width: cell, height: columns === 1 ? 280 : cell }}
                onLongPress={onLongPressItem ? () => onLongPressItem(item.id) : undefined}
              />
            ))}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  album: { width: ALBUM_WIDTH, gap: ALBUM_GAP, borderRadius: Radius.lg, overflow: 'hidden' },
  albumLine: { flexDirection: 'row', gap: ALBUM_GAP },
});
