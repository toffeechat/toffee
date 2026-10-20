import { ArrayMaxSize, ArrayMinSize, IsArray, IsString } from 'class-validator';

// 연결 링크 만들기 — 아티스트 id 여러 개(일괄 등록 직후 한꺼번에), 참조 ID라 @IsString
export class IssueActorLinksDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(300)
  @IsString({ each: true })
  actorIds!: string[];
}
