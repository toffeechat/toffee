-- 캡처용 로컬 DB만 영어로 (데모 서버·코드와 무관)
UPDATE "Agency" SET name = CASE id
  WHEN '00000000-0000-4000-8000-000000000001' THEN 'Demo Entertainment (sample)'
  WHEN '00000000-0000-4000-8000-000000000002' THEN 'Former Agency (sample)'
  WHEN '00000000-0000-4000-8000-000000000003' THEN 'Sweet Music (sample)' END;
UPDATE "Actor" SET "legalName" = v.l, "chatDisplayName" = v.c FROM (VALUES
  ('00000000-0000-4000-8000-000000000011', 'Caramel (sample)', 'Caramel'),
  ('00000000-0000-4000-8000-000000000012', 'Nougat (sample)', 'Nougat'),
  ('00000000-0000-4000-8000-000000000013', 'Caramel & Macaron (sample)', 'Caramel & Macaron'),
  ('00000000-0000-4000-8000-000000000014', 'Macaron (sample)', 'Macaron'),
  ('00000000-0000-4000-8000-000000000015', 'Jellybean (sample)', 'Jellybean'),
  ('00000000-0000-4000-8000-000000000016', 'Cookie (sample)', 'Cookie'),
  ('00000000-0000-4000-8000-000000000017', 'Choco (sample)', 'Choco')) AS v(id, l, c)
WHERE "Actor".id = v.id;
UPDATE "User" SET nickname = v.n, "displayName" = v.n FROM (VALUES
  ('fan1@toffee.demo', 'caramel_love'), ('fan2@toffee.demo', 'nougat_lover'), ('fan3@toffee.demo', 'minnie'),
  ('fan4@toffee.demo', 'plai'), ('fan5@toffee.demo', 'skyblue'), ('fan6@toffee.demo', 'honey'),
  ('caramel-self@toffee.demo', 'Caramel'), ('staff@toffee.demo', 'Demo Staff')) AS v(e, n)
WHERE "User".email = v.e;
UPDATE "Message" SET body = v.t FROM (VALUES
  ('{{name}} 다음 달에 방콕 가! 추천할 맛집 있어?', '{{name}} heading to Pratunam this weekend! Any food spots you love?'),
  ('{{name}}야 오늘 하루 어땠어? 나는 촬영 잘 마쳤어!', '{{name}} how was your day? I just wrapped today''s shoot!'),
  ('오늘 셀카 📸', 'Today''s selfie 📸'),
  ('오빠 오늘도 화이팅!', 'You got this! Cheering for you every day 💜'),
  ('{{name}} 안녕! 오늘도 좋은 하루 보내', 'Hi {{name}}! Have a great day'),
  ('연습 끝! 다들 밥 챙겨 먹었어?', 'Practice done! Did everyone eat?'),
  ('มาเลยค่ะ! ต้องลองข้าวมันไก่ประตูน้ำนะคะ อร่อยมาก รอเจอนะคะ 💕', 'Come! You must try Pratunam chicken rice. Can''t wait 💕'),
  ('สวัสดี {{name}}! วันนี้กินข้าวหรือยัง? คิดถึงนะ 555', 'Hi {{name}}! Have you eaten yet? Miss you haha'),
  ('วันนี้ถ่ายละครเสร็จดึกมากเลย เหนื่อยแต่สนุกมาก ขอบคุณที่รอนะคะ 🥹', 'Finished filming super late today. Tired but so fun. Thanks for waiting 🥹'),
  ('{{name}} ค่ะ พรุ่งนี้มีแฟนมีตติ้งที่กรุงเทพฯ ตื่นเต้นมากเลยค่ะ ㅠㅠ', '{{name}}, fan meeting in Bangkok tomorrow. So nervous 🥹')) AS v(o, t)
WHERE "Message".body = v.o;
INSERT INTO "Message" (id, "actorId", "senderType", "fanUserId", body, "replyToMessageId", "createdAt")
SELECT gen_random_uuid()::text, '00000000-0000-4000-8000-000000000011', 'FAN', u.id, v.t, :'parent',
       p."createdAt" + (v.m || ' minutes')::interval
FROM (VALUES ('fan3@toffee.demo', 'Go Ang chicken rice! Long queue but worth it', 2), ('fan4@toffee.demo', 'Send us photos when you go 📷', 3),
             ('fan5@toffee.demo', 'It''s so hot there, drink lots of water ☀️', 5), ('fan6@toffee.demo', 'Wish I could meet you there. Have fun 💕', 7)) AS v(e, t, m)
JOIN "User" u ON u.email = v.e JOIN "Message" p ON p.id = :'parent';
