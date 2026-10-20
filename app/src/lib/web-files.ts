import { Platform } from 'react-native';

// 운영자 PC 웹 전용 파일 다루기(2026-10-19 아티스트 일괄 등록) — 파일 여러 개 고르기·내려받기·사진 줄이기. 앱(네이티브)에선 안 씀

export const canUseWebFiles = Platform.OS === 'web' && typeof document !== 'undefined';

/** 파일 고르기 창 — 취소하면 빈 배열 */
export function pickWebFiles(accept: string, multiple: boolean): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.multiple = multiple;
    input.onchange = () => resolve(input.files ? [...input.files] : []);
    // 취소는 브라우저마다 이벤트가 달라서(cancel 지원 안 하는 곳) 빈 배열이 안 올 수도 있음 — 고르기 버튼은 다시 누를 수 있게 둠
    input.addEventListener('cancel', () => resolve([]));
    input.click();
  });
}

export function downloadText(fileName: string, text: string, type = 'text/csv;charset=utf-8'): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** 큰 사진은 긴 변 1600px JPEG로 줄여서(팬 데이터·로딩) — 이미 작으면 그대로. 결과는 업로드에 넘길 blob: 주소 */
export async function shrinkPhoto(file: File, maxSide = 1600): Promise<{ uri: string; contentType: string }> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 1.5 * 1024 * 1024) return { uri: URL.createObjectURL(file), contentType: file.type || 'image/jpeg' };
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.88));
    if (!blob) throw new Error('canvas');
    return { uri: URL.createObjectURL(blob), contentType: 'image/jpeg' };
  } catch {
    return { uri: URL.createObjectURL(file), contentType: file.type || 'image/jpeg' };
  }
}
