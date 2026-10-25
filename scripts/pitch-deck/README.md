# 소속사 제안서 태국어·영어판 + 소속사별 PDF (2026-10-25)

한국어판 제안서(기준본)를 고친 뒤 태국어판·영어판과 소속사별 PDF 16개(8곳 × 2언어)를 다시 만드는 도구. 작업 폴더는 세션 scratchpad.

1. 한국어판 슬라이드 받기: Artifact `read`로 `project/slides/*.html`을 `<작업>/ko/`에.
2. `python3 translate.py <작업>/ko <작업>/tr/out` — 문장 대응표(T)로 `th/`·`en/` 슬라이드를 만듦. 한국어가 남으면 멈추니
   새 문장은 T에 (한국어, 태국어, 영어)로 추가. 이미지 id는 `<작업>/tr/out/{th,en}-img.json`(한국어판 blob → 각 판 blob) — 판마다 자산 id가 다름.
3. 두 제안서 아티팩트에 `project/slides/*.html` 올리기(태국어판·영어판 링크는 CLAUDE.md).
4. `node pdf.cjs <작업>` — `<작업>/codes/codes.json`(소속사 이름·입장 코드, **저장소엔 넣지 않음** — 소속사 페이지 "데모 입장 코드" 표)과
   로컬 이미지(화면 캡처·QR·로고)로 `<작업>/pdf/Toffee_Proposal_<TH|EN>_<회사>.pdf`. 15쪽의 견본 코드·QR만 회사별로 바뀜.
   `node pdf.cjs <작업> th:gmmtv`면 그 하나만 + 쪽별 PNG 미리보기(겹침 확인용).
   x-icon은 PDF에선 SVG로 바꿔 그림(Chart·Lock·Wrench).

QR은 `qrcode`(파이썬)로 `https://demo.toffeechat.app/?demo=<코드>&as=fan&lang=<th|en>`, 확인은 OpenCV `QRCodeDetector`.
