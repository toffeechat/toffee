-- 캡처용 로컬 DB만: 한국어는 시드 이름 그대로, 팬 답장만 추가 (데모 서버·코드와 무관)
UPDATE "User" SET nickname = v.n FROM (VALUES ('fan3@toffee.demo','민트초코'),('fan4@toffee.demo','별빛'),('fan5@toffee.demo','하늘'),('fan6@toffee.demo','꿀단지')) AS v(e,n) WHERE "User".email=v.e;
INSERT INTO "Message" (id, "actorId", "senderType", "fanUserId", body, "replyToMessageId", "createdAt")
SELECT gen_random_uuid()::text, '00000000-0000-4000-8000-000000000011', 'FAN', u.id, v.t, 'ed3a9d2c-0633-4461-9071-0010a097eebd',
       p."createdAt" + (v.m || ' minutes')::interval
FROM (VALUES ('fan3@toffee.demo', '광장시장 빈대떡 꼭 드세요! 줄 서도 아깝지 않아요', 2), ('fan4@toffee.demo', '오면 사진 꼭 보여 줘요 📷', 3),
             ('fan5@toffee.demo', '날씨 추워요 따뜻하게 입고 와요 🧣', 5), ('fan6@toffee.demo', '보러 가고 싶다… 즐거운 여행 돼요 💕', 7)) AS v(e, t, m)
JOIN "User" u ON u.email = v.e JOIN "Message" p ON p.id = 'ed3a9d2c-0633-4461-9071-0010a097eebd';
