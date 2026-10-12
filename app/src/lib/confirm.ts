import { Alert, Platform } from 'react-native';

/** 예/아니오 확인 — 웹은 브라우저 confirm, 앱은 Alert(웹의 Alert는 버튼을 지원하지 않아서 분기). 동의처럼 위험하지 않은 확인은 destructive=false */
export function confirm(title: string, message: string, okLabel: string, cancelLabel: string, destructive = true): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  return new Promise((resolve) =>
    Alert.alert(title, message, [
      { text: cancelLabel, style: 'cancel', onPress: () => resolve(false) },
      { text: okLabel, style: destructive ? 'destructive' : 'default', onPress: () => resolve(true) },
    ]),
  );
}
