import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useAdminActions, type AdminActionEntry } from '@/hooks/use-admin';
import { useTheme } from '@/hooks/use-theme';
import { Radius, Spacing } from '@/constants/theme';

// 운영자 화면은 운영자(한국어) 전용이라 의도적으로 다국어 처리 안 함
const ACTION_LABELS: Record<string, string> = {
  USER_SUSPEND: '회원 정지',
  USER_BAN: '영구차단',
  USER_REACTIVATE: '제재 해제',
  USER_PROFILE_CLEAR: '팬 프로필 지움',
  USER_ROLE: '역할 변경',
  REPORT_RESOLVE: '신고 승인',
  REPORT_DISMISS: '신고 기각',
  ACTOR_RETIRE: '아티스트 활동 종료',
  ACTOR_RESTORE: '아티스트 활동 재개',
  ACTOR_PRICE: '가격·스토어 상품 변경',
  BUNDLE_CREATE: '묶음 만들기',
  BUNDLE_UPDATE: '묶음 변경',
  COUPLE_CREATE: 'CP방 만들기',
  AGENCY_SHARE: '소속사 정산 배분율 변경',
  SETTLEMENT_CLOSE: '정산 마감',
  SETTLEMENT_REOPEN: '정산 마감 취소',
  SETTLEMENT_PAYOUT: '정산 지급 기록',
  SETTLEMENT_PAYOUT_DELETE: '정산 지급 기록 삭제',
  NOTICE_CREATE: '공지 올리기',
  NOTICE_UPDATE: '공지 고치기',
  NOTICE_DELETE: '공지 삭제',
  ACTOR_IMPORT: '아티스트 일괄 등록',
  ACTOR_RELEASE: '공개 시각 변경',
  ACTOR_LINK_ISSUE: '계정 연결 링크 만들기',
  ACTOR_LINK_REVOKE: '계정 연결 링크 취소',
  ACTOR_LINK_CLAIM: '아티스트가 링크로 계정 연결',
  BANNED_WORD_CREATE: '금칙어 추가',
  BANNED_WORD_DELETE: '금칙어 삭제',
  BANNED_WORD_DEFAULTS: '금칙어 기본 목록 넣기',
  ACTOR_RETIRE_SCHEDULE: '활동 종료 예정 변경',
  // 운영 기능(2026-10-20)
  STORE_SALE_STOPPED: '애플 판매 중지 표시',
  ACTOR_CONTRACT: '계약 끝나는 날 변경',
  APP_SETTINGS: '앱 설정(점검·최소 버전) 변경',
  NOTICE_PUSH: '공지 푸시 보냄',
  INQUIRY_REPLY: '1:1 문의 답변',
  INQUIRY_CLOSE: '1:1 문의 닫음',
  ADMIN_LEVEL: '운영자 권한 단계 변경',
  ADMIN_MFA: '2단계 인증 켜기·끄기·초기화',
  USER_EXPORT: '개인정보 파일 받기',
};

function detailText(entry: AdminActionEntry): string {
  const d = entry.detail ?? {};
  const parts: string[] = [];
  if (typeof d.category === 'string') parts.push(`사유 ${d.category}`);
  if (typeof d.title === 'string') parts.push(`"${d.title}"`);
  // 금칙어(2026-10-20)
  if (typeof d.term === 'string') parts.push(`"${d.term}"${typeof d.language === 'string' ? ` (${d.language})` : ''}`);
  if (typeof d.added === 'number') parts.push(`${d.added}개 추가`);
  // 활동 종료 예정(2026-10-20) — null이면 예정 취소
  if (entry.action === 'ACTOR_RETIRE_SCHEDULE') parts.push(typeof d.retireAt === 'string' ? `${new Date(d.retireAt).toLocaleString('ko-KR', { timeZone: 'Asia/Bangkok' })}(태국) 종료 예정` : '예정 취소');
  if (typeof d.note === 'string' && d.note) parts.push(`메모 "${d.note}"`);
  if (typeof d.count === 'number') parts.push(`${d.count}명`);
  if (typeof d.releaseAt === 'string') parts.push(`공개 ${new Date(d.releaseAt).toLocaleString('ko-KR', { timeZone: 'Asia/Bangkok' })}(태국)`);
  if (d.releaseAt === null) parts.push('바로 공개');
  if (typeof d.until === 'string') parts.push(`해제 ${new Date(d.until).toLocaleString('ko-KR')}`);
  if (typeof d.from === 'string' && typeof d.to === 'string') parts.push(`${d.from} → ${d.to}`);
  // 정산 배분율(숫자, null = 기본값)
  if (typeof d.month === 'string') parts.push(`${d.month}${typeof d.payoutCents === 'number' ? ` · 지급 합계 ฿${(d.payoutCents / 100).toLocaleString('ko-KR')}` : ''}`);
  // 정산 지급 기록 — 받는 쪽·보낸 금액
  if (typeof d.payee === 'string') parts.push(`${d.payee}${typeof d.amountCents === 'number' ? ` ฿${(d.amountCents / 100).toLocaleString('ko-KR')}` : ''}`);
  if (entry.action === 'AGENCY_SHARE') parts.push(`${d.from ?? '기본값'} → ${d.to ?? '기본값'}${typeof d.to === 'number' ? '%' : ''}`);
  return parts.join(' · ');
}

/** 운영자 작업 기록 — 누가 언제 무엇을 했는지(최근 100건). 분쟁·문의 대응용이라 지우지 않음 */
export default function AdminActionsScreen() {
  const theme = useTheme();
  const { data, isLoading } = useAdminActions();
  return (
    <FlatList
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.list}
      data={data ?? []}
      keyExtractor={(item) => item.id}
      ListEmptyComponent={
        isLoading ? (
          <ActivityIndicator color={theme.tint} style={styles.loading} />
        ) : (
          <ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
            아직 기록이 없어요.
          </ThemedText>
        )
      }
      renderItem={({ item }) => (
        <View style={[styles.row, { backgroundColor: theme.backgroundElement }]}>
          <View style={styles.top}>
            <ThemedText type="smallBold">{ACTION_LABELS[item.action] ?? item.action}</ThemedText>
            <ThemedText type="caption" themeColor="textTertiary">
              {new Date(item.createdAt).toLocaleString('ko-KR')}
            </ThemedText>
          </View>
          <ThemedText type="small">
            대상: {item.targetName ?? item.targetId} · 처리: {item.adminName}
          </ThemedText>
          {detailText(item) ? (
            <ThemedText type="small" themeColor="textSecondary">
              {detailText(item)}
            </ThemedText>
          ) : null}
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: Spacing.four, gap: Spacing.two },
  loading: { marginTop: Spacing.six },
  empty: { textAlign: 'center', marginTop: Spacing.five },
  row: { borderRadius: Radius.md, padding: Spacing.three, gap: 4 },
  top: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.two },
});
