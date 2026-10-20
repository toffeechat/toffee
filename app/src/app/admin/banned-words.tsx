import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { AdminButton, AdminButtonRow, AdminChip, AdminMessage, AdminSection } from '@/components/admin-ui';
import {
  useAddDefaultBannedWords,
  useBannedWords,
  useCreateBannedWord,
  useDeleteBannedWord,
  useTestBannedWords,
  type BannedWord,
  type BannedWordLanguage,
} from '@/hooks/use-admin';
import { ApiError } from '@/lib/api-client';
import { confirm } from '@/lib/confirm';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';

// 앱 언어 9개(2026-10-20) — 띄어쓰기 언어는 단어 단위로 비교(서버 matchesBannedWord)
const LANGUAGES: { key: BannedWordLanguage; label: string }[] = [
  { key: 'ko', label: '한국어' },
  { key: 'th', label: '태국어' },
  { key: 'en', label: '영어' },
  { key: 'ja', label: '일본어' },
  { key: 'zh-Hans', label: '중국어(간체)' },
  { key: 'zh-Hant', label: '중국어(번체)' },
  { key: 'vi', label: '베트남어' },
  { key: 'es', label: '스페인어' },
  { key: 'pt-BR', label: '포르투갈어' },
];
const WORD_BOUNDARY = new Set<BannedWordLanguage>(['en', 'es', 'pt-BR', 'vi']);
const labelOf = (language: string) => LANGUAGES.find((item) => item.key === language)?.label ?? language;
const errorText = (error: unknown, fallback: string) => (error instanceof ApiError ? error.message : fallback);

/**
 * 금칙어(2026-10-20 개편) — 언어 탭 9개(개수), 추가·삭제(확인), [기본 목록 넣기](나라별 욕설·성적·혐오 + 외부 연락처 유도 — 사용자 결정),
 * 테스트해 보기. 막는 건 언어와 상관없이 모든 팬 답장·닉네임에.
 */
export default function AdminBannedWordsScreen() {
  const theme = useTheme();
  const { data: words, isLoading } = useBannedWords();
  const [tab, setTab] = useState<BannedWordLanguage | null>(null);
  const [query, setQuery] = useState('');
  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const word of words ?? []) map.set(word.language, (map.get(word.language) ?? 0) + 1);
    return map;
  }, [words]);
  const shown = (words ?? []).filter((word) => (!tab || word.language === tab) && (!query.trim() || word.term.toLowerCase().includes(query.trim().toLowerCase())));

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <FlatList
        data={shown}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View style={styles.header}>
            <TestBox />
            {/* 탭을 바꾸면 추가할 언어도 그 탭으로 */}
            <AddForm key={tab ?? 'all'} language={tab ?? 'ko'} />
            <DefaultsBox language={tab} />
            <View style={styles.chips}>
              <AdminChip label="전체" count={words?.length ?? 0} selected={tab === null} onPress={() => setTab(null)} />
              {LANGUAGES.map((lang) => (
                <AdminChip key={lang.key} label={lang.label} count={counts.get(lang.key) ?? 0} selected={tab === lang.key} onPress={() => setTab(lang.key)} />
              ))}
            </View>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="목록에서 찾기"
              placeholderTextColor={theme.textSecondary}
              style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
            />
            {isLoading ? <ActivityIndicator color={theme.tint} /> : null}
          </View>
        }
        ListEmptyComponent={
          isLoading ? null : (
            <ThemedText type="small" themeColor="textSecondary" style={styles.emptyMessage}>
              {tab ? `${labelOf(tab)} 금칙어가 없어요. 위에서 기본 목록을 넣을 수 있어요.` : '등록된 금칙어가 없어요.'}
            </ThemedText>
          )
        }
        renderItem={({ item }) => <BannedWordRow word={item} />}
      />
    </SafeAreaView>
  );
}

function TestBox() {
  const theme = useTheme();
  const [text, setText] = useState('');
  const test = useTestBannedWords();
  const hits = test.data?.hits;
  return (
    <AdminSection title="테스트해 보기" hint="팬이 이렇게 쓰면 막히는지 확인해요(저장하지 않아요).">
      <TextInput
        value={text}
        onChangeText={(value) => {
          setText(value);
          test.reset();
        }}
        placeholder="예: 오늘도 너무 멋있어요"
        placeholderTextColor={theme.textSecondary}
        multiline
        style={[styles.input, { color: theme.text, backgroundColor: theme.background }]}
      />
      <AdminButtonRow>
        <AdminButton secondary label={test.isPending ? '확인하는 중…' : '확인'} disabled={!text.trim() || test.isPending} onPress={() => test.mutate(text)} />
      </AdminButtonRow>
      {hits ? (
        <ThemedText type="smallBold" themeColor={hits.length ? 'danger' : 'text'}>
          {hits.length ? `막혀요 — ${hits.map((hit) => `"${hit.term}"(${labelOf(hit.language)})`).join(', ')}` : '막히지 않아요.'}
        </ThemedText>
      ) : null}
      <AdminMessage text={test.isError ? errorText(test.error, '확인하지 못했어요.') : null} error />
    </AdminSection>
  );
}

function AddForm({ language: initial }: { language: BannedWordLanguage }) {
  const theme = useTheme();
  const [term, setTerm] = useState('');
  const [language, setLanguage] = useState<BannedWordLanguage>(initial);
  const create = useCreateBannedWord();
  const handleAdd = () => {
    if (!term.trim()) return;
    create.mutate({ term: term.trim(), language }, { onSuccess: () => setTerm('') });
  };
  return (
    <AdminSection
      title="금칙어 추가"
      hint={
        WORD_BOUNDARY.has(language)
          ? `${labelOf(language)}는 단어 단위로 비교해요 — "ass"를 넣어도 "class"는 안 막혀요.`
          : `${labelOf(language)}는 포함되면 막아요 — 다른 낱말 안에 들어가는 짧은 말은 넣지 마세요(예: "보지"는 "보지 마"도 막음).`
      }>
      <View style={styles.chips}>
        {LANGUAGES.map((lang) => (
          <AdminChip key={lang.key} label={lang.label} selected={language === lang.key} onPress={() => setLanguage(lang.key)} />
        ))}
      </View>
      <TextInput
        value={term}
        onChangeText={setTerm}
        onSubmitEditing={handleAdd}
        placeholder="추가할 금칙어"
        placeholderTextColor={theme.textSecondary}
        style={[styles.input, { color: theme.text, backgroundColor: theme.background }]}
      />
      <AdminButtonRow>
        <AdminButton label={create.isPending ? '추가하는 중…' : `${labelOf(language)}로 추가`} disabled={!term.trim() || create.isPending} onPress={handleAdd} />
      </AdminButtonRow>
      <AdminMessage text={create.isError ? errorText(create.error, '추가하지 못했어요.') : null} error />
    </AdminSection>
  );
}

function DefaultsBox({ language }: { language: BannedWordLanguage | null }) {
  const add = useAddDefaultBannedWords();
  const target = language ? labelOf(language) : '9개 언어 전부';
  const run = async () => {
    const ok = await confirm(
      '기본 목록 넣기',
      `${target}의 기본 금칙어(욕설·성적·혐오 표현, 외부 연락처 유도·광고 문구)를 넣어요. 이미 있는 단어는 건너뛰고, 예전에 지운 기본 단어는 다시 들어가요.`,
      '넣기',
      '취소',
    );
    if (ok) add.mutate(language ?? undefined);
  };
  return (
    <AdminSection title="기본 목록" hint="토피가 미리 정리한 나라별 금칙어예요(원어민 검토 전 초안). 넣은 뒤 목록에서 하나씩 지울 수 있어요.">
      <AdminButtonRow>
        <AdminButton secondary label={add.isPending ? '넣는 중…' : `${target} 기본 목록 넣기`} disabled={add.isPending} onPress={() => void run()} />
      </AdminButtonRow>
      <AdminMessage text={add.data ? `${add.data.added}개를 넣었어요.` : add.isError ? errorText(add.error, '넣지 못했어요.') : null} error={add.isError} />
    </AdminSection>
  );
}

function BannedWordRow({ word }: { word: BannedWord }) {
  const theme = useTheme();
  const remove = useDeleteBannedWord();
  const onDelete = async () => {
    if (await confirm('금칙어 삭제', `"${word.term}"(${labelOf(word.language)})을 지울까요? 지우면 바로 이 말을 쓸 수 있게 돼요.`, '삭제', '취소')) remove.mutate(word.id);
  };
  return (
    <View style={[styles.row, { backgroundColor: theme.backgroundElement }]}>
      <View style={styles.rowBody}>
        <ThemedText type="smallBold">{word.term}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {labelOf(word.language)}
          {word.isDefault ? ' · 기본 목록' : ''}
        </ThemedText>
      </View>
      <Pressable disabled={remove.isPending} onPress={() => void onDelete()} accessibilityRole="button" hitSlop={8}>
        <ThemedText type="small" themeColor="danger">
          삭제
        </ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { gap: Spacing.three, marginBottom: Spacing.two },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  input: { borderRadius: 10, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, fontSize: 16 },
  list: { padding: Spacing.four, gap: Spacing.two },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 12, padding: Spacing.three },
  rowBody: { gap: 2, flex: 1 },
  emptyMessage: { textAlign: 'center', marginTop: Spacing.four },
});
