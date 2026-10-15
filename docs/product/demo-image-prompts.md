# 데모 아티스트 사진 — 이미지 생성 프롬프트 (2026-10-15)

데모 데이터(`backend/src/demo/demo-seed.ts`)의 가상 아티스트 6명 + CP + 셀카 사진을 다시 만들 때 쓰는 프롬프트.
2026-10-13에 넣은 사진은 머리·옷·배경만 다르고 **얼굴이 거의 같은 사람**처럼 보여서(이미지 AI가 "예쁜 아이돌"을 하나의
평균 얼굴로 수렴시키는 특성), 이번엔 **얼굴형·눈·코·입·피부톤·나이·표정·점/주근깨 같은 특징**을 사람마다 일부러 다르게 정했다.

## 1. 먼저 읽기 — 얼굴이 같아지지 않게 하는 요령

1. **한 사람 = 새 대화(새 세션)** 하나. 같은 대화창에서 이어서 만들면 AI가 앞 사진의 얼굴을 참고해 버린다(지난번 얼굴이
   비슷했던 가장 큰 이유로 추정).
2. 프롬프트의 **얼굴 묘사 줄을 지우지 말 것** — 머리·옷만 바꾸면 또 같은 얼굴이 나온다.
3. 사진 6장을 다 만든 뒤 **나란히 놓고 비교** — 두 사람이 닮아 보이면 나중에 만든 쪽을 다시 생성.
4. 셀카·CP 사진은 그 사람의 **공식 사진을 참고 이미지로 첨부**하고 "same person as the reference image"를 붙인다(첨부가 안 되는
   도구면 얼굴 묘사 줄을 그대로 복사).
5. 실존 연예인 이름·"닮은 꼴"은 절대 넣지 않는다(초상권). 제안서·데모엔 계속 "AI로 만든 가상 인물" 표기.

## 2. 만들 파일

| 파일 | 크기·비율 | 비고 |
|---|---|---|
| `<이름>-official.jpg` × 6 | 600×800 (세로 3:4) | 공식 프로필 사진 |
| `<이름>-chat.jpg` × 6 | 400×400 (정사각) | **따로 안 만들어도 됨** — 공식 사진 얼굴 부분을 잘라서 만듦(Claude가 처리) |
| `couple-caramel-macaron.jpg` | 600×800 (3:4) | 캐러멜 & 마카롱 CP |
| `selfie-caramel.jpg` | 800×800 (1:1) | 캐러멜이 토피룸에 보낸 셀카 |

생성 도구에서 비율은 **3:4**(셀카만 1:1)로 고르고, 크기는 더 커도 된다(넣을 때 줄임).

## 3. 사람별 설정 한눈에

| 이름 | 성별·나이 느낌 | 직업 느낌(데모 메시지 기준) | 얼굴 핵심 차이 | 머리·배경 |
|---|---|---|---|---|
| Caramel | 여, 24 | 드라마 배우, CP 주연 | 긴 계란형, 속쌍꺼풀 아몬드 눈, 꿀빛 피부, 왼쪽 눈 밑 점, 입 다문 미소 | 웨이브 긴 갈색 머리 / 피치 |
| Nougat | 여, 28 | 팬미팅 하는 시크한 배우 | 각진 턱·높은 광대, 진한 쌍꺼풀 큰 눈, 도톰한 입술, 중간 톤 갈색 피부 | 귀 넘긴 검은 단발 / 민트 |
| Macaron | 여, 20 | 막내, 밝은 성격 | 동그란 얼굴·볼살, 애교살 있는 처진 눈, 콧등 주근깨, 앞니 보이는 큰 웃음 | 앞머리 있는 핑크 단발 / 핑크 |
| Cookie | 여, 25 | 댄서 출신 가수 | 짙은 구릿빛 피부, 무쌍 눈, 일자 진한 눈썹, 보조개, 입 크게 벌린 웃음 | 잔머리 있는 검은 하이 포니테일 / 버터 옐로 |
| Jellybean | 남, 21 | 귀여운 막내 가수 | 동글한 얼굴, 큰 쌍꺼풀 눈, 밝은 피부, 덧니 살짝 보이는 웃음 | 갈색 펌 / 하늘색 |
| Choco | 남, 29 | 연기 경력 있는 형 | 각진 얼굴, 가는 무쌍 눈, 짙은 눈썹, 구릿빛 피부, 짧은 수염 자국, 한쪽 입꼬리만 올린 미소 | 짧은 투블럭 / 라벤더 |

## 4. 프롬프트 (영어 그대로 복사)

모든 프롬프트 끝에 붙는 **공통 꼬리말**(이미 각 프롬프트에 들어 있음):

> Shot on a full-frame camera, 85mm lens, soft studio light. Real photograph, natural skin texture with visible pores,
> slight facial asymmetry, no beauty filter, no airbrushing. Not a celebrity, a fictional person.

부정 프롬프트(negative prompt) 칸이 있는 도구면 여기에 넣는다:

> plastic skin, airbrushed, doll face, generic idol face, V-line chin, identical faces, heavy makeup, oversaturated,
> illustration, 3D render, extra fingers, text, watermark

### 4-1. Caramel — `caramel-official.jpg`

```
Vertical 3:4 studio portrait of a 24-year-old Thai woman, a TV drama actress. Long oval face with a softly tapered chin,
gently hooded almond-shaped eyes with an inner (tapered) double eyelid, straight medium-thick natural brows,
a small straight nose, medium lips, warm honey-tan skin, a small beauty mark just below her left eye.
Calm, closed-mouth gentle smile, looking slightly off-camera then back at the lens.
Long dark-brown hair with loose soft waves, middle part. Wearing a cream ribbed knit top.
Plain warm peach backdrop, framed from mid-chest up.
Shot on a full-frame camera, 85mm lens, soft studio light. Real photograph, natural skin texture with visible pores,
slight facial asymmetry, no beauty filter, no airbrushing. Not a celebrity, a fictional person.
```

### 4-2. Nougat — `nougat-official.jpg`

```
Vertical 3:4 studio portrait of a 28-year-old Thai woman with a chic, mature look. Angular face with a defined square
jawline and high cheekbones, large deep-set eyes with a pronounced double eyelid, arched dark brows,
a slightly wide nose bridge, full lips, medium brown skin with a warm olive undertone.
Confident, subtle closed-lip smile, chin slightly raised.
Sleek jaw-length black bob tucked behind one ear, small gold hoop earrings. Wearing a crisp white oversized shirt.
Plain soft mint-green backdrop, framed from mid-chest up.
Shot on a full-frame camera, 85mm lens, soft studio light. Real photograph, natural skin texture with visible pores,
slight facial asymmetry, no beauty filter, no airbrushing. Not a celebrity, a fictional person.
```

### 4-3. Macaron — `macaron-official.jpg`

```
Vertical 3:4 studio portrait of a 20-year-old Thai woman, bubbly and playful. Round face with full chubby cheeks,
slightly downturned "puppy" eyes with prominent under-eye fat (aegyo-sal) and a soft double eyelid, a short button nose,
light freckles across the nose and cheeks, fair skin with pink undertones.
Big laughing smile showing her upper front teeth, eyes crinkling.
Pastel pink chin-length bob with see-through bangs. Wearing a pink tweed cardigan.
Plain baby-pink backdrop, framed from mid-chest up.
Shot on a full-frame camera, 85mm lens, soft studio light. Real photograph, natural skin texture with visible pores,
slight facial asymmetry, no beauty filter, no airbrushing. Not a celebrity, a fictional person.
```

### 4-4. Cookie — `cookie-official.jpg`

```
Vertical 3:4 studio portrait of a 25-year-old Thai woman, a singer with a dancer's athletic build. Wide face with
a soft square jaw, monolid eyes with no double eyelid, thick straight dark brows, a broad nose, wide mouth,
deep tan bronze skin, a deep dimple on her right cheek.
Open-mouth joyful laugh, head tilted slightly.
Black hair in a high sleek ponytail with baby hairs at the hairline. Wearing a butter-yellow cropped zip-up track jacket.
Plain butter-yellow backdrop, framed from mid-chest up.
Shot on a full-frame camera, 85mm lens, soft studio light. Real photograph, natural skin texture with visible pores,
slight facial asymmetry, no beauty filter, no airbrushing. Not a celebrity, a fictional person.
```

### 4-5. Jellybean — `jellybean-official.jpg`

```
Vertical 3:4 studio portrait of a 21-year-old Thai man, a boyish young singer. Soft round face with a rounded chin,
large bright eyes with a clear double eyelid, soft low brows, a small rounded nose, light skin,
a slightly crooked canine tooth visible in a wide cheerful grin.
Fluffy brown permed curls with a short fringe. Wearing a light-wash denim jacket over a white T-shirt.
Plain sky-blue backdrop, framed from mid-chest up.
Shot on a full-frame camera, 85mm lens, soft studio light. Real photograph, natural skin texture with visible pores,
slight facial asymmetry, no beauty filter, no airbrushing. Not a celebrity, a fictional person.
```

### 4-6. Choco — `choco-official.jpg`

```
Vertical 3:4 studio portrait of a 29-year-old Thai man, an experienced actor. Angular rectangular face with a strong
jaw, narrow monolid eyes, thick straight dark eyebrows, a prominent nose bridge, medium-thin lips,
tan golden-brown skin, a light stubble shadow on the jaw and upper lip.
Calm half-smile with one corner of the mouth raised, steady direct gaze.
Short black two-block cut with textured top. Wearing a black zip-up jacket over a white T-shirt.
Plain soft lavender backdrop, framed from mid-chest up.
Shot on a full-frame camera, 85mm lens, soft studio light. Real photograph, natural skin texture with visible pores,
slight facial asymmetry, no beauty filter, no airbrushing. Not a celebrity, a fictional person.
```

### 4-7. Caramel & Macaron CP — `couple-caramel-macaron.jpg`

캐러멜·마카롱 공식 사진 **두 장을 참고 이미지로 첨부**하고:

```
Vertical 3:4 photo of two young Thai women posing together as an on-screen couple for a GL drama promo.
Left: the woman from the first reference image (Caramel) — same face, long dark-brown wavy hair, honey-tan skin,
beauty mark under her left eye, wearing a cream cardigan, calm gentle smile.
Right: the woman from the second reference image (Macaron) — same face, pink bob with bangs, round face, freckles,
wearing a pink knit sweater, big laughing smile, leaning her head toward Caramel's shoulder.
Their faces must look clearly like two different people. Split pastel backdrop, peach on the left and pink on the right.
Shot on a full-frame camera, 50mm lens, soft studio light. Real photograph, natural skin texture, no beauty filter.
Fictional people, not celebrities.
```

### 4-8. 캐러멜 셀카 — `selfie-caramel.jpg`

캐러멜 공식 사진을 **참고 이미지로 첨부**하고:

```
Square 1:1 mirror-free phone selfie of the same woman as the reference image (Caramel): long oval face, hooded almond
eyes, honey-tan skin, small beauty mark under her left eye, long dark-brown wavy hair loosely down.
She is in a drama-set makeup room after filming, holding the phone at arm's length, chin resting on her other hand,
soft closed-mouth smile. Wearing a cream knit top. Warm vanity-mirror bulbs blurred in the background.
Casual smartphone photo look, slight grain, natural skin texture, no beauty filter. Fictional person, not a celebrity.
```

## 5. 다 만든 뒤

파일 이름을 위 표대로 바꿔서 대화에 올려 주면 Claude가: 크기 맞추기(600×800 / 800×800), 공식 사진에서 정사각 대화방 사진
(`*-chat.jpg`, 400×400) 잘라 만들기, `app/public/demo/`에 교체, 제안서 화면 캡처 갱신까지 한다. 사진을 같은 이름으로 덮어쓰면 앱이 예전 사진을 계속 보여 주므로(주소 기준으로 저장해 둠), `backend/src/demo/demo-seed.ts`의
`DEMO_ASSET_VERSION` 값을 올리고, 배포 뒤 운영자 화면에서 **"데모 초기화"**를 눌러야 바뀐다.
