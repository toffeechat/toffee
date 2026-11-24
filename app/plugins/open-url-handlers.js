// AppDelegate.swift의 application(_:open:options:)에 소셜 로그인 콜백 처리를 끼워 넣는 공용 도우미(2026-11-24, Expo SDK 58).
// SDK 58의 AppDelegate에는 이 함수가 없어서 처음 부를 때 super로 넘기는 함수를 만들고, 그 뒤엔 같은 함수 맨 앞에 처리 줄을 더함.
// 같은 tag로 두 번 불러도 한 번만 들어감(prebuild를 반복해도 안전).
const OPEN_URL_SIGNATURE = 'public override func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {';

function addImport(contents, importLine) {
  if (!importLine || contents.includes(importLine)) return contents;
  const anchor = /^(internal )?import Expo\s*$/m;
  if (!anchor.test(contents)) throw new Error('open-url-handlers: AppDelegate에서 "import Expo" 줄을 찾지 못함');
  return contents.replace(anchor, (line) => `${line}\n${importLine}`);
}

function addOpenUrlHandler(contents, { importLine, tag, handler }) {
  const marker = `// @toffee-open-url ${tag}`;
  if (contents.includes(marker)) return contents;
  let out = addImport(contents, importLine);
  if (!out.includes(OPEN_URL_SIGNATURE)) {
    // AppDelegate 클래스의 didFinishLaunching 함수가 끝나는 곳 뒤에 새 함수를 넣음
    const classStart = out.search(/class AppDelegate\b[^{]*\{/);
    if (classStart < 0) throw new Error('open-url-handlers: AppDelegate 클래스를 찾지 못함');
    const classEnd = findBlockEnd(out, out.indexOf('{', classStart));
    const fn = `\n  ${OPEN_URL_SIGNATURE}\n    // @toffee-open-url-handlers\n    return super.application(app, open: url, options: options)\n  }\n`;
    out = out.slice(0, classEnd) + fn + out.slice(classEnd);
  }
  return out.replace('    // @toffee-open-url-handlers\n', `    // @toffee-open-url-handlers\n    ${marker}\n    ${handler}\n`);
}

// 여는 중괄호 위치에서 짝이 맞는 닫는 중괄호의 위치
function findBlockEnd(src, open) {
  let depth = 0;
  for (let i = open; i < src.length; i += 1) {
    if (src[i] === '{') depth += 1;
    else if (src[i] === '}') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  throw new Error('open-url-handlers: 중괄호 짝이 맞지 않음');
}

module.exports = { addOpenUrlHandler };
