-- 소속사 통계 기간 선택(2026-10-13): 방별 하루 기록(구독 수·팬 나라·언어)
CREATE TABLE "ActorDailyStat" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "subscribers" INTEGER NOT NULL,
    "countries" JSONB NOT NULL,
    "languages" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActorDailyStat_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ActorDailyStat_actorId_day_key" ON "ActorDailyStat"("actorId", "day");

CREATE INDEX "ActorDailyStat_day_idx" ON "ActorDailyStat"("day");

ALTER TABLE "ActorDailyStat" ADD CONSTRAINT "ActorDailyStat_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "Actor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
