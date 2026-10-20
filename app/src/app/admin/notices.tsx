import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Switch, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useDeleteNotice, useSaveNotice } from '@/hooks/use-admin';
import { useNotices, type Notice } from '@/hooks/use-support';
import { useTheme } from '@/hooks/use-theme';
import { confirm } from '@/lib/confirm';
import { Spacing } from '@/constants/theme';

/**
 * 공지사항 관리(2026-10-12) — 쓴 글은 바로 앱 마이페이지 > 공지사항에 보임. 고정하면 맨 위. 한국어로 쓰면 다른 언어 팬은 [번역 보기](2026-10-20).
 * [모두에게 푸시]를 켜고 올리면 모든 계정에 알림(제목은 받는 사람 언어로 번역, 한 공지에 한 번 — 2026-10-20).
 */
function NoticeForm({ editing, onDone }: { editing: Notice | null; onDone: () => void }) {
  const theme = useTheme();
  const [title, setTitle] = useState(editing?.title ?? '');
  const [body, setBody] = useState(editing?.body ?? '');
  const [pinned, setPinned] = useState(editing?.pinned ?? false);
  const [push, setPush] = useState(false);
  const alreadyPushed = !!editing?.pushedAt;
  const save = useSaveNotice();
  const ready = !!title.trim() && !!body.trim();

  const handleSave = async () => {
    if (!ready) return;
    if (push && !(await confirm('공지 푸시', '모든 계정(팬·아티스트·소속사)에게 알림을 보내요. 한 공지에 한 번만 보낼 수 있어요.', '올리고 보내기', '취소', false))) return;
    save.mutate(
      { id: editing?.id, title: title.trim(), body: body.trim(), pinned, push: push && !alreadyPushed },
      {
        onSuccess: () => {
          setTitle('');
          setBody('');
          setPinned(false);
          setPush(false);
          onDone();
        },
      },
    );
  };

  const inputStyle = [styles.input, { color: theme.text, backgroundColor: theme.background }];
  return (
    <ThemedView style={[styles.form, { backgroundColor: theme.backgroundElement }]}>
      <ThemedText type="smallBold">{editing ? '공지 고치기' : '새 공지'}</ThemedText>
      <TextInput value={title} onChangeText={setTitle} maxLength={200} placeholder="제목" placeholderTextColor={theme.textSecondary} style={inputStyle} />
      <TextInput
        value={body}
        onChangeText={setBody}
        maxLength={10000}
        multiline
        placeholder="본문(한국어로 쓰면 돼요 — 다른 언어 팬은 [번역 보기]로 자기 언어로 봐요)"
        placeholderTextColor={theme.textSecondary}
        style={[inputStyle, styles.body]}
      />
      <ThemedView style={styles.pinRow}>
        <ThemedText type="small">맨 위에 고정</ThemedText>
        <Switch value={pinned} onValueChange={setPinned} trackColor={{ true: theme.tint, false: theme.border }} thumbColor="#ffffff" />
      </ThemedView>
      <ThemedView style={styles.pinRow}>
        <ThemedText type="small">{alreadyPushed ? '푸시 보냄(다시 못 보내요)' : '모두에게 푸시 보내기(점검·약관 변경 등)'}</ThemedText>
        <Switch value={push} onValueChange={setPush} disabled={alreadyPushed} trackColor={{ true: theme.tint, false: theme.border }} thumbColor="#ffffff" />
      </ThemedView>
      <ThemedView style={styles.actions}>
        {editing ? (
          <Pressable onPress={onDone} style={[styles.button, styles.secondary, { borderColor: theme.border }]}>
            <ThemedText type="smallBold">취소</ThemedText>
          </Pressable>
        ) : null}
        <Pressable disabled={!ready || save.isPending} onPress={() => void handleSave()} style={[styles.button, { backgroundColor: theme.tint, opacity: ready ? 1 : 0.5 }]}>
          <ThemedText type="smallBold" style={styles.buttonText}>
            {editing ? '저장' : '올리기'}
          </ThemedText>
        </Pressable>
      </ThemedView>
      {save.isError && (
        <ThemedText type="small" themeColor="danger">
          {(save.error as Error).message}
        </ThemedText>
      )}
    </ThemedView>
  );
}

function NoticeRow({ notice, onEdit }: { notice: Notice; onEdit: () => void }) {
  const theme = useTheme();
  const remove = useDeleteNotice();
  const handleDelete = async () => {
    if (await confirm('공지 삭제', `"${notice.title}"을(를) 지울까요? 앱에서 바로 사라져요.`, '삭제', '취소')) remove.mutate(notice.id);
  };
  return (
    <ThemedView style={[styles.row, { backgroundColor: theme.backgroundElement }]}>
      <ThemedView style={styles.rowBody}>
        <ThemedText type="smallBold" numberOfLines={1}>
          {notice.pinned ? '📌 ' : ''}
          {notice.title}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {new Date(notice.createdAt).toLocaleString('ko-KR')}
          {notice.pushedAt ? ` · 푸시 보냄 ${new Date(notice.pushedAt).toLocaleString('ko-KR')}` : ''}
        </ThemedText>
      </ThemedView>
      <Pressable onPress={onEdit} hitSlop={8}>
        <ThemedText type="small" style={{ color: theme.tint }}>
          고치기
        </ThemedText>
      </Pressable>
      <Pressable disabled={remove.isPending} onPress={() => void handleDelete()} hitSlop={8}>
        <ThemedText type="small" themeColor="danger">
          삭제
        </ThemedText>
      </Pressable>
    </ThemedView>
  );
}

export default function AdminNoticesScreen() {
  const theme = useTheme();
  const { data: notices, isLoading } = useNotices();
  const [editing, setEditing] = useState<Notice | null>(null);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <FlatList
        data={notices}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <ThemedView style={styles.headerBox}>
            <NoticeForm key={editing?.id ?? 'new'} editing={editing} onDone={() => setEditing(null)} />
            {notices?.length ? (
              <ThemedText type="small" themeColor="textSecondary">
                공지 {notices.length}개 · 고정 {notices.filter((notice) => notice.pinned).length}개
              </ThemedText>
            ) : null}
          </ThemedView>
        }
        ListEmptyComponent={
          isLoading ? (
            <ActivityIndicator style={styles.loading} color={theme.tint} />
          ) : (
            <ThemedText type="small" themeColor="textSecondary" style={styles.emptyMessage}>
              올린 공지가 없어요.
            </ThemedText>
          )
        }
        renderItem={({ item }) => <NoticeRow notice={item} onEdit={() => setEditing(item)} />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  headerBox: { gap: Spacing.two, backgroundColor: 'transparent' },
  container: { flex: 1 },
  form: { borderRadius: 14, padding: Spacing.three, gap: Spacing.two, marginBottom: Spacing.two },
  input: { borderRadius: 10, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, fontSize: 16 },
  body: { minHeight: 120, textAlignVertical: 'top' },
  pinRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'transparent' },
  actions: { flexDirection: 'row', gap: Spacing.two, backgroundColor: 'transparent' },
  button: { flex: 1, borderRadius: 10, paddingVertical: Spacing.two, alignItems: 'center' },
  secondary: { borderWidth: 1 },
  buttonText: { color: '#fff' },
  list: { padding: Spacing.four, gap: Spacing.two },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, borderRadius: 12, padding: Spacing.three },
  rowBody: { flex: 1, gap: 2, backgroundColor: 'transparent' },
  emptyMessage: { textAlign: 'center', marginTop: Spacing.six },
  loading: { marginTop: Spacing.six },
});
