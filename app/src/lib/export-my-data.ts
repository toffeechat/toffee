import { Platform } from 'react-native';
import { apiClient } from './api-client';
import { downloadText } from './web-files';

/**
 * 내 정보 받기(2026-10-20, PDPA) — 서버가 모은 내 기록(JSON)을 파일로. 웹은 바로 내려받고, 앱은 공유 창(파일 앱·메일로 저장).
 * path를 바꾸면 운영자가 회원 대신 받을 때도 같은 함수(/admin/users/:id/export).
 */
export async function exportMyData(path = '/auth/me/export', fileName = `toffee-my-data-${new Date().toISOString().slice(0, 10)}.json`): Promise<void> {
  const data = await apiClient.get<unknown>(path);
  const text = JSON.stringify(data, null, 2);
  if (Platform.OS === 'web') return downloadText(fileName, text, 'application/json;charset=utf-8');
  // expo-file-system·expo-sharing은 import 시점에 네이티브 객체를 만들어서(save-media.ts와 같은 이유) 필요할 때만
  const [{ File, Paths }, Sharing] = await Promise.all([import('expo-file-system'), import('expo-sharing')]);
  const file = new File(Paths.cache, fileName);
  if (file.exists) file.delete();
  file.create();
  file.write(text);
  await Sharing.shareAsync(file.uri, { mimeType: 'application/json', UTI: 'public.json' });
}
