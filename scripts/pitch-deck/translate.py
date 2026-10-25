"""한국어판 제안서 → 태국어판·영어판 슬라이드 파일 만들기(2026-10-25).
사용: python3 tr.py <ko 폴더(project/ 있는 곳)> <출력 루트> — <출력 루트>/th/project/…, <출력 루트>/en/project/…
문장 대응표(T)를 순서대로 바꾸고, 바꾸지 못한 한글이 남으면 멈춘다."""
import json, os, re, sys

KO, OUT = sys.argv[1], sys.argv[2]
FONT_KO = "'Noto Sans KR', Arial, sans-serif"
FONT = {'th': "'Noto Sans Thai', 'DM Sans', Arial, sans-serif", 'en': "'DM Sans', Arial, sans-serif"}
FOOT = {'th': 'Toffee · ข้อเสนอสำหรับต้นสังกัด · ', 'en': 'Toffee · Agency Proposal · '}
ASIDE = '<aside>발표 메모는 한국어판 제안서의 같은 쪽을 보세요(내부 메모라 이 판에는 넣지 않음).</aside>'

# 영어판 화면(2026-10-25 en-TH로 찍음) — 한국어판 blob → 영어판 blob(업로드 뒤 채움)
def img_map(lang):
    p = os.path.join(OUT, f'{lang}-img.json')
    return json.load(open(p)) if os.path.exists(p) else {}

# (한국어, 태국어, 영어) — 긴 것부터 바꾸도록 아래에서 정렬
T = [
 # cover
 ('토피 앱 아이콘', 'ไอคอนแอป Toffee', 'Toffee app icon'),
 ('토피 로고', 'โลโก้ Toffee', 'Toffee logo'),
 ('태국 아티스트와 팬을 잇는 유료 1:1 채팅 앱<br>창립 파트너 소속사 제안', 'แอปแชท 1:1 แบบสมัครสมาชิก ที่เชื่อมศิลปินไทยกับแฟน ๆ<br>ข้อเสนอสำหรับต้นสังกัดพันธมิตรผู้ก่อตั้ง', 'A paid 1:1 chat app connecting Thai artists and their fans<br>Founding partner proposal for agencies'),
 ('Toffee · Kong Seul Gi · 2026년 10월 · 대외비', 'Toffee · Kong Seul Gi · ตุลาคม 2569 · เอกสารลับ', 'Toffee · Kong Seul Gi · October 2026 · Confidential'),
 ('alt="채팅 화면"', 'alt="หน้าแชท"', 'alt="Chat screen"'),
 # what
 ('토피 소개', 'Toffee คืออะไร', 'About Toffee'),
 ('아티스트와 1:1로 대화하는 듯한 월 구독 서비스', 'บริการสมัครสมาชิกรายเดือน ที่เหมือนได้คุยกับศิลปินแบบ 1:1', 'A monthly subscription that feels like a 1:1 chat with your artist'),
 ('팬이 구독합니다', 'แฟนสมัครสมาชิก', 'Fans subscribe'),
 ('좋아하는 아티스트를 골라 앱스토어나 구글플레이에서 월 구독합니다.', 'เลือกศิลปินที่ชอบ แล้วสมัครสมาชิกรายเดือนผ่าน App Store หรือ Google Play', 'They pick their favorite artist and subscribe monthly through the App Store or Google Play.'),
 ('아티스트가 보냅니다', 'ศิลปินส่งข้อความ', 'Artists send'),
 ('글·사진·음성·짧은 영상을 원할 때 보냅니다. 팬은 각자 1:1 채팅방에서 받습니다.', 'ส่งข้อความ รูป เสียง หรือวิดีโอสั้นได้ทุกเมื่อ แฟนแต่ละคนได้รับในห้องแชท 1:1 ของตัวเอง', 'Text, photos, voice and short videos, whenever they like. Each fan receives them in their own 1:1 chat room.'),
 ('팬이 답장합니다', 'แฟนตอบกลับ', 'Fans reply'),
 ('팬이 보낸 답장은 아티스트와 소속사만 볼 수 있고, 다른 팬에게는 보이지 않습니다.', 'ข้อความตอบกลับของแฟน มีเพียงศิลปินและต้นสังกัดที่เห็นได้ แฟนคนอื่นมองไม่เห็น', 'Fan replies are visible only to the artist and the agency, never to other fans.'),
 # market
 ('한국 사례', 'กรณีศึกษาจากเกาหลี', 'The Korean case'),
 ('한국에서 메시지 구독은 이미 큰 사업입니다', 'ในเกาหลี ธุรกิจสมัครสมาชิกรับข้อความเป็นธุรกิจใหญ่แล้ว', 'In Korea, message subscriptions are already a big business'),
 ('749<span style="font-family:\'Noto Sans KR\', Arial, sans-serif;font-size:44px"> 억 원</span>', '฿1,900<span style="font-family:FONT;font-size:44px"> ล้าน</span>', '฿1.9<span style="font-family:FONT;font-size:44px"> billion</span>'),
 ('버블 운영사 디어유의 2024년 매출', 'รายได้ปี 2024 ของ DearU ผู้ให้บริการ Bubble', '2024 revenue of DearU, the company behind Bubble'),
 ('영업이익 254억 원 — 매출의 약 3분의 1이 이익입니다', 'กำไรจากการดำเนินงานราว ฿650 ล้าน — ประมาณหนึ่งในสามของรายได้', 'Operating profit of about ฿650 million, roughly one third of revenue'),
 ('2026년 2분기 매출, 1년 전보다', 'รายได้ไตรมาส 2 ปี 2026 เทียบกับปีก่อน', 'Q2 2026 revenue, year on year'),
 ('분기 매출 234억 원, 영업이익 94억 원(+26.4%)', 'รายได้ไตรมาสราว ฿590 ล้าน กำไรจากการดำเนินงานราว ฿240 ล้าน (+26.4%)', 'Quarterly revenue of about ฿590 million, operating profit about ฿240 million (+26.4%)'),
 ('197<span style="font-family:\'Noto Sans KR\', Arial, sans-serif;font-size:44px"> 만</span>', '1.97<span style="font-family:FONT;font-size:44px"> ล้าน</span>', '1.97<span style="font-family:FONT;font-size:44px"> million</span>'),
 ('2026년 2분기 평균 구독 수', 'จำนวนการสมัครสมาชิกเฉลี่ย ไตรมาส 2 ปี 2026', 'Average subscriptions, Q2 2026'),
 ('팬이 아티스트마다 매달 구독료를 냅니다', 'แฟนจ่ายค่าสมาชิกรายเดือนแยกตามศิลปิน', 'Fans pay a monthly fee for each artist'),
 ('아티스트는 메시지를 보내고, 앱·결제·운영은 플랫폼이 맡는 구조입니다. 토피는 이 구조를 태국 아티스트에게 가져옵니다.', 'ศิลปินส่งข้อความ ส่วนแอป การชำระเงิน และการดำเนินงานเป็นหน้าที่ของแพลตฟอร์ม Toffee นำรูปแบบนี้มาสู่ศิลปินไทย', 'Artists send messages; the platform runs the app, payments and operations. Toffee brings this model to Thai artists.'),
 ('출처: 디어유 연결 실적(2024년)·2026년 2분기 잠정 실적 공시, 증권사 리포트(2026년 8월)', 'ที่มา: งบการเงินรวม DearU (2024), ประกาศผลประกอบการเบื้องต้นไตรมาส 2/2026, รายงานบริษัทหลักทรัพย์ (ส.ค. 2026) · แปลงค่าที่ ₩1 = ฿0.0254', 'Sources: DearU consolidated results (2024), preliminary Q2 2026 earnings, brokerage reports (Aug 2026) · converted at ₩1 = ฿0.0254'),
 # why
 ('왜 지금인가', 'ทำไมต้องตอนนี้', 'Why now'),
 ('태국 팬덤은 크지만, 태국 소속사와 태국 아티스트를 위해 만든 유료 소통 공간은 아직 없습니다', 'แฟนด้อมไทยใหญ่มาก แต่ยังไม่มีพื้นที่สื่อสารแบบเสียเงิน ที่สร้างมาเพื่อต้นสังกัดและศิลปินไทยโดยเฉพาะ', 'Thai fandoms are huge, yet there is still no paid fan space built for Thai agencies and Thai artists'),
 ('토피는 한국에서 검증된 방식을 태국어와 태국 소속사에 맞춰 새로 만들었습니다. 번역·운영·서버·정산은 한국 팀인 토피가 그대로 맡습니다.', 'Toffee นำรูปแบบที่พิสูจน์แล้วในเกาหลีมาสร้างใหม่ให้เหมาะกับภาษาไทยและต้นสังกัดไทย ส่วนการแปล การดำเนินงาน เซิร์ฟเวอร์ และการแบ่งรายได้ ทีม Toffee จากเกาหลีดูแลทั้งหมด', 'Toffee rebuilt a model proven in Korea for the Thai language and Thai agencies. Translation, operations, servers and settlement are all handled by the Toffee team in Korea.'),
 # screens-fan
 ('팬 화면', 'หน้าจอแฟน', 'Fan app'),
 ('팬은 아티스트를 찾아 구독하고 바로 대화를 시작합니다', 'แฟนค้นหาศิลปิน สมัครสมาชิก แล้วเริ่มคุยได้ทันที', 'Fans find an artist, subscribe and start chatting right away'),
 ('alt="둘러보기"', 'alt="สำรวจ"', 'alt="Discover"'),
 ('>둘러보기<', '>สำรวจ<', '>Discover<'),
 ('프로필과 가격', 'โปรไฟล์และราคา', 'Profile and price'),
 ('1:1 채팅방', 'ห้องแชท 1:1', '1:1 chat room'),
 ('실제 앱 화면(태국어) · 데이터는 예시이며, 인물 사진은 AI로 만든 가상 인물입니다', 'หน้าจอจริงของแอป (ภาษาไทย) · ข้อมูลเป็นตัวอย่าง และรูปบุคคลสร้างด้วย AI', 'Real app screens (English) · Sample data; portraits are AI-generated, not real people'),
 # screens-artist
 ('아티스트 화면', 'หน้าจอศิลปิน', 'Artist app'),
 ('한 번 보내면 구독 중인 모든 팬에게 전달됩니다', 'ส่งครั้งเดียว ถึงแฟนที่สมัครสมาชิกทุกคน', 'Send once, and every subscribed fan receives it'),
 ('alt="메시지 보내기"', 'alt="ส่งข้อความ"', 'alt="Send a message"'),
 ('>메시지 보내기<', '>ส่งข้อความ<', '>Send a message<'),
 ('alt="답장 모아 보기 · 자동 번역"', 'alt="ข้อความตอบกลับ · แปลอัตโนมัติ"', 'alt="Replies · translation"'),
 ('답장 모아 보기 · 번역', 'รวมข้อความตอบกลับ · แปล', 'Replies · translation'),
 ('팬 이름 자동 입력', 'ใส่ชื่อแฟนอัตโนมัติ', 'Fan names, filled in'),
 ('팬마다 자기 닉네임이 들어간 메시지를 받습니다', 'แฟนแต่ละคนได้รับข้อความที่มีชื่อเล่นของตัวเอง', 'Each fan receives the message with their own nickname'),
 ('<h3 style="font-family:FONT;font-size:30px;font-weight:700;line-height:1.4">답장 모아 보기</h3>', '<h3 style="font-family:FONT;font-size:30px;font-weight:700;line-height:1.4">รวมข้อความตอบกลับ</h3>', '<h3 style="font-family:FONT;font-size:30px;font-weight:700;line-height:1.4">All replies in one place</h3>'),
 ('메시지별로 답장이 모이고, 외국어 답장은 버튼 하나로 번역해 볼 수 있습니다', 'ข้อความตอบกลับรวมอยู่ตามแต่ละข้อความ และข้อความภาษาต่างประเทศแปลได้ด้วยปุ่มเดียว', 'Replies are grouped by message, and foreign-language replies translate with one tap'),
 ('팬 관리', 'ดูแลแฟน', 'Fan management'),
 ('부적절한 팬은 직접 차단하거나 신고할 수 있습니다', 'บล็อกหรือรายงานแฟนที่ไม่เหมาะสมได้ด้วยตัวเอง', 'Block or report inappropriate fans directly'),
 # gets
 ('소속사가 얻는 것', 'สิ่งที่ต้นสังกัดได้รับ', 'What the agency gets'),
 ('새로운 월 수익, 그대로 유지되는 관리 권한, 적은 업무 부담', 'รายได้ใหม่ทุกเดือน สิทธิ์ดูแลยังอยู่ที่ต้นสังกัด และงานเพิ่มเพียงเล็กน้อย', 'New monthly revenue, full control, and very little extra work'),
 ('매달 들어오는 수익', 'รายได้ทุกเดือน', 'Monthly revenue'),
 ('스토어 수수료와 세금을 뺀 금액의 <b>70%</b>가 소속사 몫입니다(처음 함께하는 3곳, 계약 후 첫 12개월 — 그 뒤 60%). 아티스트별 월 정산서를 드립니다.', 'ต้นสังกัดได้รับ <b>70%</b> ของรายได้หลังหักค่าธรรมเนียมสโตร์และภาษี (สำหรับ 3 รายแรก ในช่วง 12 เดือนแรกหลังเซ็นสัญญา — หลังจากนั้น 60%) พร้อมรายงานแบ่งรายได้รายเดือนแยกตามศิลปิน', 'The agency receives <b>70%</b> of revenue after store fees and taxes (first three agencies, first 12 months after signing; 60% after that), with a monthly settlement statement per artist.'),
 ('관리 권한은 소속사에', 'ต้นสังกัดดูแลได้เต็มที่', 'The agency stays in control'),
 ('아티스트가 보낸 메시지와 팬 답장을 소속사 화면에서 모두 확인하고, 문제가 있으면 바로 회수할 수 있습니다.', 'ดูข้อความของศิลปินและข้อความตอบกลับของแฟนได้ทั้งหมดในหน้าจอต้นสังกัด และเรียกคืนข้อความที่มีปัญหาได้ทันที', 'See every artist message and fan reply on the agency screen, and pull back any problem message instantly.'),
 ('운영은 토피가', 'Toffee ดูแลการดำเนินงาน', 'Toffee runs everything'),
 ('앱·서버·결제·번역·정산·팬 문의는 토피가 맡습니다. 아티스트는 휴대폰 하나면 충분합니다(할 일은 다음 쪽).', 'แอป เซิร์ฟเวอร์ การชำระเงิน การแปล การแบ่งรายได้ และการดูแลแฟน Toffee รับผิดชอบทั้งหมด ศิลปินใช้แค่โทรศัพท์เครื่องเดียว (งานของแต่ละฝ่ายอยู่หน้าถัดไป)', 'App, servers, payments, translation, settlement and fan support are all on us. Artists only need a phone (who does what is on the next page).'),
 # roles
 ('역할 나누기', 'การแบ่งหน้าที่', 'Who does what'),
 ('아티스트는 메시지만 보내고, 나머지는 토피가 맡습니다', 'ศิลปินแค่ส่งข้อความ ที่เหลือ Toffee ดูแลให้', 'Artists just send messages. Toffee handles the rest'),
 ('<h3 style="font-family:FONT;font-size:34px;font-weight:700">아티스트</h3>', '<h3 style="font-family:FONT;font-size:34px;font-weight:700">ศิลปิน</h3>', '<h3 style="font-family:FONT;font-size:34px;font-weight:700">Artist</h3>'),
 ('주 3~4회, 한 번에 5분 안팎 메시지 작성(글·사진·음성·짧은 영상)', 'ส่งข้อความสัปดาห์ละ 3–4 ครั้ง ครั้งละราว 5 นาที (ข้อความ รูป เสียง วิดีโอสั้น)', 'Write messages 3–4 times a week, about 5 minutes each (text, photos, voice, short video)'),
 ('팬 답장은 원할 때만 확인', 'อ่านข้อความตอบกลับของแฟนเมื่อสะดวก', 'Read fan replies only when they want'),
 ('처음 사용법 안내(15분)는 토피가 진행', 'Toffee แนะนำวิธีใช้ครั้งแรก (15 นาที)', 'A 15-minute onboarding session run by Toffee'),
 ('<h3 style="font-family:FONT;font-size:34px;font-weight:700">소속사</h3>', '<h3 style="font-family:FONT;font-size:34px;font-weight:700">ต้นสังกัด</h3>', '<h3 style="font-family:FONT;font-size:34px;font-weight:700">Agency</h3>'),
 ('참여할 아티스트 선정', 'เลือกศิลปินที่จะเข้าร่วม', 'Choose the participating artists'),
 ('프로필 자료 1장 전달(등록은 토피가 진행)', 'ส่งข้อมูลโปรไฟล์ 1 หน้า (Toffee ลงทะเบียนให้)', 'Send a one-page profile (Toffee does the setup)'),
 ('필요할 때 메시지 확인·회수', 'ตรวจดูและเรียกคืนข้อความเมื่อจำเป็น', 'Review or pull back messages when needed'),
 ('월 1회, 30분 점검', 'ประชุมทบทวนเดือนละครั้ง 30 นาที', 'A 30-minute check-in once a month'),
 ('<h3 style="font-family:FONT;font-size:34px;font-weight:700">토피</h3>', '<h3 style="font-family:FONT;font-size:34px;font-weight:700">Toffee</h3>', '<h3 style="font-family:FONT;font-size:34px;font-weight:700">Toffee</h3>'),
 ('앱·서버·스토어 결제 운영', 'ดูแลแอป เซิร์ฟเวอร์ และการชำระเงินผ่านสโตร์', 'Run the app, servers and store payments'),
 ('메시지 자동 번역(9개 언어)·팬 문의·신고 처리', 'แปลข้อความอัตโนมัติ (9 ภาษา) ตอบคำถามแฟน และจัดการรายงาน', 'Auto-translate messages (9 languages), handle fan support and reports'),
 ('아티스트별 월간 보고서와 정산서', 'รายงานรายเดือนและรายงานแบ่งรายได้แยกตามศิลปิน', 'Monthly reports and settlement statements per artist'),
 ('메시지가 뜸한 아티스트는 먼저 알림', 'แจ้งเตือนก่อน หากศิลปินส่งข้อความน้อยลง', 'Give a heads-up when an artist posts less often'),
 # screens-agency
 ('소속사 화면', 'หน้าจอต้นสังกัด', 'Agency console'),
 ('소속사는 PC와 휴대폰에서 모든 현황을 확인합니다', 'ต้นสังกัดดูภาพรวมทั้งหมดได้ทั้งบนคอมพิวเตอร์และโทรศัพท์', 'Agencies see everything on PC and mobile'),
 ('통계 대시보드 — 구독·해지·메시지·답장 추이', 'แดชบอร์ดสถิติ — แนวโน้มการสมัคร การยกเลิก ข้อความ และข้อความตอบกลับ', 'Stats dashboard: subscriptions, cancellations, messages and replies'),
 ('팬 답장 확인 — 태국어 번역 포함, 신고·차단 가능', 'ตรวจดูข้อความตอบกลับของแฟน — มีคำแปลภาษาไทย รายงานและบล็อกได้', 'Fan replies with English translation; report or block'),
 # built
 ('태국 아티스트를 위한 기능', 'ฟีเจอร์สำหรับศิลปินไทย', 'Built for Thai artists'),
 ('핵심 기능은 이미 만들어져 작동합니다', 'ฟีเจอร์หลักพร้อมใช้งานแล้ว', 'The core features are already built and working'),
 ('태국어 기본', 'ภาษาไทยเป็นหลัก', 'Thai first'),
 ('태국어를 기본으로 영어·한국어·일본어·중국어(간체·번체)·베트남어·스페인어·포르투갈어까지 9개 언어', 'ภาษาไทยเป็นภาษาหลัก พร้อมอังกฤษ เกาหลี ญี่ปุ่น จีน (ตัวย่อ·ตัวเต็ม) เวียดนาม สเปน และโปรตุเกส รวม 9 ภาษา', 'Thai by default, plus English, Korean, Japanese, Chinese (Simplified and Traditional), Vietnamese, Spanish and Portuguese: 9 languages'),
 ('자동 번역', 'แปลอัตโนมัติ', 'Auto-translation'),
 ('원문 아래에 번역이 바로 표시됩니다. 해외 팬은 태국어 메시지를, 아티스트는 외국어 답장을 읽을 수 있습니다', 'คำแปลแสดงใต้ข้อความต้นฉบับทันที แฟนต่างชาติอ่านข้อความภาษาไทยได้ และศิลปินอ่านข้อความตอบกลับภาษาต่างประเทศได้', 'Translations appear right under the original, so overseas fans can read Thai messages and artists can read foreign replies'),
 ('<h3 style="font-family:FONT;font-size:30px;font-weight:700">소속사 화면</h3>', '<h3 style="font-family:FONT;font-size:30px;font-weight:700">หน้าจอต้นสังกัด</h3>', '<h3 style="font-family:FONT;font-size:30px;font-weight:700">Agency console</h3>'),
 ('모니터링·통계는 휴대폰과 PC에서, 월 정산은 PC에서 확인합니다', 'ติดตามข้อความและดูสถิติได้ทั้งบนโทรศัพท์และคอมพิวเตอร์ ส่วนรายงานแบ่งรายได้รายเดือนดูบนคอมพิวเตอร์', 'Monitoring and stats on mobile and PC; monthly settlement on PC'),
 ('CP방·묶음 구독', 'ห้องคู่จิ้น · แพ็กเกจรวม', 'Couple rooms · bundles'),
 ('드라마 커플이 함께 쓰는 방, 여러 아티스트를 할인해 묶은 구독', 'ห้องที่คู่จิ้นจากซีรีส์ใช้ร่วมกัน และแพ็กเกจรวมหลายศิลปินในราคาพิเศษ', 'Rooms shared by on-screen couples, and discounted bundles of several artists'),
 ('성인 전용·신고·차단', 'สำหรับผู้ใหญ่ · รายงาน · บล็อก', 'Adults only · report · block'),
 ('성인만 가입하고, 문제 팬은 아티스트·소속사가 바로 차단합니다(자세한 내용은 14쪽)', 'สมัครได้เฉพาะผู้ใหญ่ ศิลปินและต้นสังกัดบล็อกแฟนที่มีปัญหาได้ทันที (รายละเอียดหน้า 14)', 'Adults only, and artists or agencies can block problem fans instantly (details on page 14)'),
 ('공식 스토어 결제', 'ชำระเงินผ่านสโตร์ทางการ', 'Official store payments'),
 ('팬은 애플·구글에서 자국 통화로 결제하며, 환불 기준도 명확합니다', 'แฟนชำระผ่าน Apple และ Google ด้วยสกุลเงินของประเทศตัวเอง และมีเกณฑ์การคืนเงินที่ชัดเจน', 'Fans pay through Apple and Google in their own currency, with clear refund rules'),
 # future
 ('앞으로 더할 수익', 'รายได้ที่จะเพิ่มในอนาคต', 'Revenue we will add next'),
 ('월 구독에서 시작해 수익원을 하나씩 늘려 갑니다', 'เริ่มจากสมาชิกรายเดือน แล้วเพิ่มช่องทางรายได้ทีละอย่าง', 'We start with monthly subscriptions and add revenue streams one by one'),
 ('>지금<', '>ตอนนี้<', '>Now<'),
 ('월 구독 · CP방 · 묶음 구독', 'สมาชิกรายเดือน · ห้องคู่จิ้น · แพ็กเกจรวม', 'Monthly · couple rooms · bundles'),
 ('아티스트 한 명, 드라마 커플, 여러 아티스트 묶음까지 이미 작동합니다', 'ทั้งศิลปินเดี่ยว คู่จิ้น และแพ็กเกจหลายศิลปิน ใช้งานได้แล้ว', 'Single artists, on-screen couples and multi-artist bundles already work'),
 ('>다음<', '>ถัดไป<', '>Next<'),
 ('>스토리<', '>สตอรี่<', '>Stories<'),
 ('24시간 보이는 사진·짧은 영상. 팬이 매일 앱을 열 이유가 됩니다', 'รูปและวิดีโอสั้นที่อยู่ 24 ชั่วโมง เหตุผลให้แฟนเปิดแอปทุกวัน', 'Photos and short videos that last 24 hours, a reason for fans to open the app every day'),
 ('장기 구독 혜택', 'สิทธิพิเศษสำหรับสมาชิกระยะยาว', 'Loyalty perks'),
 ('오래 구독한 팬에게 혜택을 주어 해지를 줄이고 매달 수익을 지킵니다', 'มอบสิทธิพิเศษให้แฟนที่เป็นสมาชิกนาน ลดการยกเลิก และรักษารายได้ทุกเดือน', 'Rewards for long-time subscribers reduce cancellations and protect monthly revenue'),
 ('>준비 중<', '>กำลังเตรียม<', '>In preparation<'),
 ('아티스트 전용 스티커', 'สติกเกอร์เฉพาะศิลปิน', 'Artist stickers'),
 ('팬이 사서 답장에 쓰는 스티커. 판매 수익도 소속사와 나눕니다', 'สติกเกอร์ที่แฟนซื้อไปใช้ตอบกลับ รายได้จากการขายแบ่งกับต้นสังกัดด้วย', 'Stickers fans buy and use in replies, with sales revenue shared with the agency'),
 ('팬 라이브', 'ไลฟ์สำหรับแฟน', 'Fan live'),
 ('구독 팬만 들어오는 라이브로 아티스트와 더 가까워집니다', 'ไลฟ์ที่เข้าได้เฉพาะสมาชิก ทำให้ใกล้ชิดศิลปินมากขึ้น', 'Subscriber-only live streams bring fans even closer'),
 ('공식 굿즈', 'สินค้าทางการ', 'Official merch'),
 ('아티스트 프로필에서 소속사 공식몰로 바로 연결하는 것부터 시작합니다', 'เริ่มจากลิงก์จากโปรไฟล์ศิลปินไปยังร้านค้าทางการของต้นสังกัด', 'Starting with a direct link from the artist profile to the agency\'s official store'),
 ('순서와 시기는 소속사와 함께 정하며, 날짜를 약속하지 않습니다', 'ลำดับและช่วงเวลากำหนดร่วมกับต้นสังกัด โดยยังไม่ระบุวันที่', 'Order and timing are decided together with agencies; no dates are promised'),
 # team
 ('만든 사람', 'ผู้สร้าง', 'Who we are'),
 ('한국 팬 문화를 아는 팀이 만들고 운영합니다', 'สร้างและดูแลโดยทีมที่เข้าใจวัฒนธรรมแฟนเกาหลี', 'Built and run by a team that knows Korean fan culture'),
 ('>대표<', '>ผู้ก่อตั้ง<', '>Founder<'),
 ("태국 GL 드라마 팬으로 시작해 태국 GL 배우 스케줄 알림 앱 '젤리'를 직접 만들어 운영합니다. 팬이 무엇에 돈을 쓰고 왜 떠나는지 현장에서 봅니다.", 'เริ่มจากการเป็นแฟนซีรีส์ GL ไทย แล้วสร้างและดูแลแอปแจ้งตารางงานนักแสดง GL ไทยชื่อ "Gelly" ด้วยตัวเอง จึงเห็นจากหน้างานจริงว่าแฟนจ่ายเงินกับอะไร และเลิกใช้เพราะอะไร', 'Started as a fan of Thai GL series and built and runs "Gelly", a schedule-alert app for Thai GL actors. Sees first-hand what fans pay for and why they leave.'),
 ('alt="젤리 앱 아이콘"', 'alt="ไอคอนแอป Gelly"', 'alt="Gelly app icon"'),
 ('<span style="font-family:FONT;font-size:32px;color:#3A3F4B"> 명 가입</span>', '<span style="font-family:FONT;font-size:32px;color:#3A3F4B"> ผู้ใช้</span>', '<span style="font-family:FONT;font-size:32px;color:#3A3F4B"> sign-ups</span>'),
 ('젤리 · 10개 언어', 'Gelly · 10 ภาษา', 'Gelly · 10 languages'),
 ('출시 약 2개월 만에 가입자 가운데 <b>334명(38%)이 해외 팬</b>입니다. 태국 배우를 매일 따라가는 팬들을 이미 만나고 있습니다.', 'เพียงราว 2 เดือนหลังเปิดตัว <b>334 คน (38%) เป็นแฟนต่างชาติ</b> เราได้พบกับแฟนที่ติดตามนักแสดงไทยทุกวันอยู่แล้ว', 'About two months after launch, <b>334 sign-ups (38%) are overseas fans</b>. We already meet fans who follow Thai actors every day.'),
 ('법인 이름으로 계약', 'ทำสัญญาในนามนิติบุคคล', 'Contracts under a company'),
 ('토피 한국 법인, 2026년 12월 설립 예정', 'นิติบุคคล Toffee ในเกาหลี จะจดทะเบียน ธ.ค. 2569', 'Toffee Korean entity, incorporating December 2026'),
 ('공식 도메인 메일', 'อีเมลโดเมนทางการ', 'Official domain email'),
 ('지금 작동하는 앱', 'แอปที่ใช้งานได้แล้ว', 'A working app today'),
 ('15쪽 데모로 바로 써 보기', 'ลองใช้เดโมได้ที่หน้า 15', 'Try the demo on page 15'),
 ('alt="젤리 홈 화면 — 오늘의 일정"', 'alt="หน้าแรกของ Gelly — ตารางวันนี้"', 'alt="Gelly home screen, today\'s schedule"'),
 ('젤리 수치는 2026년 10월 기준 · 앱 화면은 시험용 데이터로 찍은 실제 젤리 화면', 'ตัวเลขของ Gelly ณ ต.ค. 2569 · หน้าจอจริงของ Gelly ถ่ายด้วยข้อมูลทดสอบ', 'Gelly figures as of October 2026 · Real Gelly screen captured with test data'),
 # terms
 ('계약 조건', 'เงื่อนไขสัญญา', 'Terms'),
 ('처음 함께하는 소속사 3곳에 드리는 조건', 'เงื่อนไขสำหรับต้นสังกัด 3 รายแรก', 'Terms for our first three partner agencies'),
 ('창립 파트너 3곳 한정', 'เฉพาะพันธมิตรผู้ก่อตั้ง 3 รายแรก', 'Founding partners: first three only'),
 ('계약 후 첫 12개월, 소속사 몫', 'ส่วนของต้นสังกัด 12 เดือนแรกหลังเซ็นสัญญา', 'Agency share, months 1–12 after signing'),
 ('13개월째부터, 소속사 몫', 'ส่วนของต้นสังกัด ตั้งแต่เดือนที่ 13', 'Agency share from month 13'),
 ('스토어 수수료와 세금을 뺀 금액 기준<br>예: ฿149 구독 1건 → 소속사 약 ฿83(70%) / ฿71(60%)<br>부가세 7%·스토어 수수료 15% 가정, 첫 달 할인 제외', 'คิดจากรายได้หลังหักค่าธรรมเนียมสโตร์และภาษี<br>ตัวอย่าง: สมาชิก ฿149 1 ราย → ต้นสังกัดได้ราว ฿83 (70%) / ฿71 (60%)<br>สมมติ VAT 7% และค่าธรรมเนียมสโตร์ 15% ไม่รวมส่วนลดเดือนแรก', 'After store fees and taxes<br>e.g. one ฿149 subscription → about ฿83 (70%) / ฿71 (60%)<br>Assumes 7% VAT and a 15% store fee; excludes the first-month discount'),
 ('<th style="width:24%;text-align:left">항목</th><th style="width:76%;text-align:left">내용</th>', '<th style="width:24%;text-align:left">หัวข้อ</th><th style="width:76%;text-align:left">รายละเอียด</th>', '<th style="width:24%;text-align:left">Item</th><th style="width:76%;text-align:left">Details</th>'),
 ('비용·독점', 'ค่าใช้จ่าย · การผูกขาด', 'Fees · exclusivity'),
 ('없음 — 가입비·월 이용료가 없고, 아티스트의 다른 플랫폼 활동도 자유롭습니다', 'ไม่มี — ไม่มีค่าแรกเข้าหรือค่าบริการรายเดือน และศิลปินทำกิจกรรมบนแพลตฟอร์มอื่นได้อิสระ', 'None: no sign-up or monthly fees, and artists remain free on other platforms'),
 ('팬 구독료', 'ค่าสมาชิกของแฟน', 'Fan price'),
 ('태국 기준 월 ฿149(첫 달 ฿99), CP방 ฿199 · 다른 나라는 스토어의 나라별 가격', 'ในไทย ฿149/เดือน (เดือนแรก ฿99) ห้องคู่จิ้น ฿199 · ประเทศอื่นใช้ราคาตามประเทศของสโตร์', 'Thailand: ฿149/month (first month ฿99), couple room ฿199 · other countries use store pricing per country'),
 ('시작 방식', 'วิธีเริ่มต้น', 'How we start'),
 ('일부 아티스트로 시작 → 4주 후 점검하고 확대 → 3개월 후 함께 평가', 'เริ่มจากศิลปินบางคน → ทบทวนและขยายหลัง 4 สัปดาห์ → ประเมินร่วมกันหลัง 3 เดือน', 'Start with a few artists → review and expand after 4 weeks → evaluate together after 3 months'),
 ('함께 볼 지표', 'ตัวชี้วัดที่ดูร่วมกัน', 'Shared metrics'),
 ('구독자 수, 월 해지율, 아티스트 발송 빈도', 'จำนวนสมาชิก อัตรายกเลิกต่อเดือน ความถี่ในการส่งข้อความของศิลปิน', 'Subscribers, monthly churn, artist posting frequency'),
 ('<td style="font-weight:700">계약</td>', '<td style="font-weight:700">สัญญา</td>', '<td style="font-weight:700">Contract</td>'),
 ('토피 한국 법인 이름으로 체결(2026년 12월 설립 예정)', 'ทำในนามนิติบุคคล Toffee ในเกาหลี (จะจดทะเบียน ธ.ค. 2569)', 'Signed by Toffee\'s Korean entity (incorporating December 2026)'),
 ('이 조건은 협의를 위한 제안이며 최종 계약이 아닙니다', 'เงื่อนไขนี้เป็นข้อเสนอเพื่อการหารือ ไม่ใช่สัญญาฉบับสุดท้าย', 'These terms are a proposal for discussion, not a final contract'),
 # safety
 ('안심하고 시작할 수 있도록', 'เริ่มต้นได้อย่างสบายใจ', 'Start with peace of mind'),
 ('언제든 중단할 수 있고, 권리와 정보는 보호됩니다', 'หยุดได้ทุกเมื่อ สิทธิ์และข้อมูลได้รับการคุ้มครอง', 'Stop anytime; your rights and data stay protected'),
 ('위약금 없는 중단', 'หยุดได้โดยไม่มีค่าปรับ', 'Stop with no penalty'),
 ('처음 3개월은 30일 전에 알려 주시면 언제든 중단할 수 있습니다. 구독 중인 팬의 환불과 안내는 토피가 처리합니다.', 'ใน 3 เดือนแรก หยุดได้ทุกเมื่อโดยแจ้งล่วงหน้า 30 วัน Toffee ดูแลการคืนเงินและแจ้งแฟนที่เป็นสมาชิกอยู่', 'During the first three months, stop anytime with 30 days\' notice. Toffee handles refunds and notices for current subscribers.'),
 ('콘텐츠 권리', 'สิทธิ์ในเนื้อหา', 'Content rights'),
 ('모든 권리는 아티스트와 소속사에 있습니다. 토피는 앱 안에서 구독자에게 보여 주는 권한만 갖습니다.', 'สิทธิ์ทั้งหมดเป็นของศิลปินและต้นสังกัด Toffee มีสิทธิ์เพียงแสดงเนื้อหาให้สมาชิกในแอปเท่านั้น', 'All rights stay with the artist and the agency. Toffee only has the right to show content to subscribers in the app.'),
 ('개인정보', 'ข้อมูลส่วนบุคคล', 'Personal data'),
 ('팬 정보는 토피가 관리하며 태국 개인정보보호법(PDPA)에 맞춰 준비하고 있습니다. 소속사 화면에는 팬의 이메일·결제 정보가 보이지 않고 닉네임만 보입니다.', 'Toffee ดูแลข้อมูลแฟน และกำลังเตรียมให้สอดคล้องกับ PDPA ของไทย หน้าจอต้นสังกัดไม่แสดงอีเมลหรือข้อมูลการชำระเงินของแฟน แสดงเพียงชื่อเล่น', 'Toffee manages fan data and is preparing for Thailand\'s PDPA. The agency console shows only nicknames, never fans\' emails or payment details.'),
 ('안전한 운영', 'การดำเนินงานที่ปลอดภัย', 'Safe operations'),
 ('성인만 가입할 수 있고, 신고·차단 기능과 앱 밖 공유 금지 약관을 갖췄습니다. 문제가 되는 메시지는 소속사가 바로 회수할 수 있습니다.', 'สมัครได้เฉพาะผู้ใหญ่ มีระบบรายงานและบล็อก และข้อกำหนดห้ามนำเนื้อหาออกไปเผยแพร่นอกแอป ต้นสังกัดเรียกคืนข้อความที่มีปัญหาได้ทันที', 'Adults only, with reporting, blocking and terms that forbid sharing content outside the app. Agencies can pull back problem messages instantly.'),
 # demo
 ('데모 둘러보기', 'ลองใช้เดโม', 'Try the demo'),
 ('10분이면 세 화면을 모두 써 보실 수 있습니다', 'ใช้เวลา 10 นาที ก็ลองได้ครบทั้งสามหน้าจอ', 'In 10 minutes you can try all three apps'),
 ('alt="소속사 통계 대시보드"', 'alt="แดชบอร์ดสถิติของต้นสังกัด"', 'alt="Agency stats dashboard"'),
 ('<h3 style="font-family:FONT;font-size:30px;font-weight:700">소속사 화면</h3>', '<h3 style="font-family:FONT;font-size:30px;font-weight:700">หน้าจอต้นสังกัด</h3>', '<h3 style="font-family:FONT;font-size:30px;font-weight:700">Agency console</h3>'),
 ('통계 대시보드를 보고, 소속 아티스트를 눌러 메시지와 답장을 확인합니다', 'ดูแดชบอร์ดสถิติ แล้วแตะศิลปินในสังกัดเพื่อดูข้อความและข้อความตอบกลับ', 'Check the stats dashboard, then tap an artist to see their messages and replies'),
 ('alt="아티스트 메시지 보내기 화면"', 'alt="หน้าจอส่งข้อความของศิลปิน"', 'alt="Artist send screen"'),
 ('<h3 style="font-family:FONT;font-size:30px;font-weight:700">아티스트 화면</h3>', '<h3 style="font-family:FONT;font-size:30px;font-weight:700">หน้าจอศิลปิน</h3>', '<h3 style="font-family:FONT;font-size:30px;font-weight:700">Artist app</h3>'),
 ('토피룸에서 글이나 사진을 하나 보내 봅니다', 'ลองส่งข้อความหรือรูปสักหนึ่งอย่างใน Toffee Room', 'Send a text or photo from the Toffee Room'),
 ('alt="팬 채팅방 화면"', 'alt="หน้าจอห้องแชทของแฟน"', 'alt="Fan chat screen"'),
 ('<h3 style="font-family:FONT;font-size:30px;font-weight:700">팬 화면</h3>', '<h3 style="font-family:FONT;font-size:30px;font-weight:700">หน้าจอแฟน</h3>', '<h3 style="font-family:FONT;font-size:30px;font-weight:700">Fan app</h3>'),
 ('방금 보낸 메시지가 도착한 것을 확인하고 답장도 보내 봅니다', 'ดูว่าข้อความที่เพิ่งส่งมาถึงแล้ว และลองตอบกลับ', 'See the message you just sent arrive, and send a reply'),
 ('전용 링크 — 누르면 바로 입장', 'ลิงก์เฉพาะ — แตะแล้วเข้าได้ทันที', 'Your private links: tap to enter'),
 ('>소속사 화면 열기<', '>เปิดหน้าจอต้นสังกัด<', '>Open agency console<'),
 ('>아티스트 화면 열기<', '>เปิดหน้าจอศิลปิน<', '>Open artist app<'),
 ('>팬 화면 열기<', '>เปิดหน้าจอแฟน<', '>Open fan app<'),
 ('직접 들어갈 때: demo.toffeechat.app에서 화면을 고르고 입장 코드', 'เข้าเอง: ไปที่ demo.toffeechat.app เลือกหน้าจอ แล้วใส่รหัส', 'Or go to demo.toffeechat.app, choose an app and enter code'),
 ('alt="휴대폰으로 팬 화면 열기 QR 코드"', 'alt="QR โค้ดเปิดหน้าจอแฟนบนโทรศัพท์"', 'alt="QR code to open the fan app on a phone"'),
 ('휴대폰으로 팬 화면', 'หน้าจอแฟนบนโทรศัพท์', 'Fan app on your phone'),
 ('마음껏 눌러 보셔도 됩니다', 'ลองกดได้ตามสบาย', 'Feel free to explore'),
 ('데모의 아티스트·팬·메시지는 모두 가상이며, 매일 새벽 처음 상태로 돌아갑니다.', 'ศิลปิน แฟน และข้อความในเดโมเป็นข้อมูลสมมติทั้งหมด และจะรีเซ็ตทุกเช้ามืด', 'All demo artists, fans and messages are fictional, and the demo resets every night.'),
 # contact
 ('다음 단계', 'ขั้นตอนถัดไป', 'Next step'),
 ('30분 미팅으로 시작합니다', 'เริ่มจากการประชุม 30 นาที', 'Let\'s start with a 30-minute meeting'),
 ('10분 둘러보기(선택)', 'ลองใช้ 10 นาที (ไม่บังคับ)', 'A 10-minute look (optional)'),
 ('15쪽의 전용 링크나 QR로 소속사·아티스트·팬 화면을 직접 써 보실 수 있습니다.', 'ลองใช้หน้าจอต้นสังกัด ศิลปิน และแฟนได้เองผ่านลิงก์เฉพาะหรือ QR ในหน้า 15', 'Try the agency, artist and fan apps yourself with the private links or QR on page 15.'),
 ('30분 미팅', 'ประชุม 30 นาที', '30-minute meeting'),
 ('화상 또는 방콕에서 직접 만나 화면을 함께 보며 질문에 답해 드립니다. 태국어 통역이 함께합니다.', 'ทางวิดีโอคอล หรือพบกันที่กรุงเทพฯ เพื่อดูหน้าจอและตอบคำถามไปพร้อมกัน โดยมีล่ามภาษาไทยร่วมด้วย', 'By video call or in person in Bangkok, walking through the app and answering your questions, with a Thai interpreter.'),
 ('조건 정리', 'สรุปเงื่อนไข', 'Agree on terms'),
 ('관심이 있으시면 계약서 초안을 보내 드립니다. 창립 파트너 조건은 먼저 계약한 3곳까지입니다.', 'หากสนใจ เราจะส่งร่างสัญญาให้ เงื่อนไขพันธมิตรผู้ก่อตั้งสำหรับ 3 รายแรกที่เซ็นสัญญาเท่านั้น', 'If you are interested, we will send a draft contract. Founding partner terms apply only to the first three agencies to sign.'),
 ('LINE 친구 추가', 'เพิ่มเพื่อนทาง LINE', 'Add us on LINE'),
 ('alt="LINE 친구 추가 QR 코드"', 'alt="QR โค้ดเพิ่มเพื่อนทาง LINE"', 'alt="LINE add-friend QR code"'),
 ('Toffee · 16 · 정식 출시 목표: 2027년 2월 · 데모 접속 기록은 보안과 안내를 위해 3개월간 보관합니다', 'Toffee · 16 · เป้าหมายเปิดตัวอย่างเป็นทางการ: ก.พ. 2570 · บันทึกการเข้าใช้เดโมเก็บไว้ 3 เดือนเพื่อความปลอดภัยและการติดต่อ', 'Toffee · 16 · Target official launch: February 2027 · Demo access logs are kept for 3 months for security and follow-up'),
]

def convert(lang, name, src):
    i = {'th': 1, 'en': 2}[lang]
    font = FONT[lang]
    s = src.replace(FONT_KO, 'FONT')
    s = re.sub(r'<aside>.*?</aside>', ASIDE, s, flags=re.S)
    for row in sorted(T, key=lambda r: -len(r[0])):
        ko = row[0].replace(FONT_KO, 'FONT')
        if ko in s:
            s = s.replace(ko, row[i])
    s = s.replace('Toffee · 소속사 제안서 · ', FOOT[lang])
    s = s.replace('FONT', font)
    if lang == 'en':
        s = s.replace('lang=th', 'lang=en')
        s = s.replace('실제 앱 화면(태국어)', 'Real app screens (English)')
    for a, b in img_map(lang).items():
        s = s.replace(a, b)
    left = re.findall(r'[가-힣][^<>"]*', re.sub(r'<aside>.*?</aside>', '', s, flags=re.S))
    if left:
        raise SystemExit(f'{lang}/{name}: 남은 한글 {left[:5]}')
    return s

for lang in ['th', 'en']:
    root = os.path.join(OUT, lang, 'project', 'slides')
    os.makedirs(root, exist_ok=True)
    for f in sorted(os.listdir(os.path.join(KO, 'project', 'slides'))):
        src = open(os.path.join(KO, 'project', 'slides', f)).read()
        open(os.path.join(root, f), 'w').write(convert(lang, f, src))
    print(lang, 'ok')
