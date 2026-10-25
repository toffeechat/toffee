import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Put, Query } from '@nestjs/common';
import { MessagesService } from './messages.service.js';
import { ListMessagesQueryDto, ListRepliesQueryDto, SearchMessagesQueryDto } from './dto/list-replies-query.dto.js';
import { SendReplyDto } from './dto/send-reply.dto.js';
import { SendBroadcastDto } from './dto/send-broadcast.dto.js';
import { UpdateGreetingsDto } from './dto/update-greetings.dto.js';
import { DeleteMessageDto } from './dto/delete-message.dto.js';
import { GreetingsService } from './greetings.service.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { Role } from '../generated/prisma/enums.js';
import type { AuthenticatedUser } from '../common/types/authenticated-user.js';
import { AdminOwnerOnly } from '../common/decorators/admin-access.decorator.js';

@Controller('actors/:actorId/messages')
export class MessagesController {
  constructor(
    private readonly messagesService: MessagesService,
    private readonly greetingsService: GreetingsService,
  ) {}

  // 팬 대화방에 끼워 넣을 환영 메시지·생일 축하(2026-10-12)
  @Get('extras')
  extras(@CurrentUser() user: AuthenticatedUser, @Param('actorId') actorId: string) {
    return this.greetingsService.extrasForFan(user.id, actorId);
  }

  // 환영·생일 축하 메시지 편집 — 보내기와 같이 배우 본인만(소속사는 대신 못 씀)
  @Roles(Role.ACTOR, Role.ADMIN)
  @Get('greetings')
  greetings(@CurrentUser() user: AuthenticatedUser, @Param('actorId') actorId: string) {
    return this.greetingsService.settings(user.id, actorId);
  }

  @Roles(Role.ACTOR, Role.ADMIN)
  @AdminOwnerOnly()
  @Put('greetings')
  updateGreetings(@CurrentUser() user: AuthenticatedUser, @Param('actorId') actorId: string, @Body() dto: UpdateGreetingsDto) {
    return this.greetingsService.updateSettings(user.id, actorId, dto);
  }

  @Get()
  listForFan(@CurrentUser() user: AuthenticatedUser, @Param('actorId') actorId: string, @Query() query: ListMessagesQueryDto) {
    return this.messagesService.listForFan(user.id, actorId, { limit: query.limit, before: query.before });
  }

  @Post('reply')
  sendReply(
    @CurrentUser() user: AuthenticatedUser,
    @Param('actorId') actorId: string,
    @Body() dto: SendReplyDto,
  ) {
    return this.messagesService.sendReply(user.id, actorId, dto);
  }

  // 배우 본인만 발송 가능 — 소속사는 발송 권한 없음(읽기 전용 모니터링만)
  @Roles(Role.ACTOR, Role.ADMIN)
  @AdminOwnerOnly()
  @Post('broadcast')
  sendBroadcast(
    @CurrentUser() user: AuthenticatedUser,
    @Param('actorId') actorId: string,
    @Body() dto: SendBroadcastDto,
  ) {
    return this.messagesService.sendBroadcast(user.id, actorId, dto);
  }

  // 'replies'가 아무 :id 라우트보다 먼저 매칭될 필요는 없음 — 형제 라우트가 reply/broadcast뿐이라 충돌 없음
  @Roles(Role.AGENCY_STAFF, Role.ACTOR, Role.ADMIN)
  @Get('replies')
  listReplies(
    @CurrentUser() user: AuthenticatedUser,
    @Param('actorId') actorId: string,
    @Query() query: ListRepliesQueryDto,
  ) {
    return this.messagesService.listReplies(user.id, actorId, query.messageId, { limit: query.limit, before: query.before });
  }

  // 소속사 모니터링용 — 배우가 실제로 보낸 메시지를 읽기 전용으로 확인
  @Roles(Role.AGENCY_STAFF, Role.ACTOR, Role.ADMIN)
  @Get('broadcasts')
  listBroadcasts(@CurrentUser() user: AuthenticatedUser, @Param('actorId') actorId: string) {
    return this.messagesService.listBroadcasts(user.id, actorId);
  }

  // 팬 채팅방 사진·영상 모아보기(전체 화면 넘겨보기에도 씀)
  @Get('media')
  listMedia(@CurrentUser() user: AuthenticatedUser, @Param('actorId') actorId: string, @Query() query: ListMessagesQueryDto) {
    return this.messagesService.listMediaForFan(user.id, actorId, { limit: query.limit, before: query.before });
  }

  // 팬 채팅방 안 검색
  @Get('search')
  search(@CurrentUser() user: AuthenticatedUser, @Param('actorId') actorId: string, @Query() query: SearchMessagesQueryDto) {
    return this.messagesService.searchForFan(user.id, actorId, query.q, { limit: query.limit, before: query.before });
  }

  // 팬 화면 "남은 답장 N개"
  @Get('reply-quota')
  replyQuota(@CurrentUser() user: AuthenticatedUser, @Param('actorId') actorId: string) {
    return this.messagesService.replyQuota(user.id, actorId);
  }

  // 회수(2026-10-14, 예전 "삭제") — 아티스트는 자기가 보낸 메시지, 소속사 직원은 자기 소속 아티스트 것을 대신(2026-10-12), 팬은 자기 답장.
  // 운영자·소속사는 본문 { reason } 필수(2026-10-25)
  @Roles(Role.USER, Role.ACTOR, Role.AGENCY_STAFF, Role.ADMIN)
  @Delete(':messageId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteBroadcast(
    @CurrentUser() user: AuthenticatedUser,
    @Param('actorId') actorId: string,
    @Param('messageId') messageId: string,
    @Body() dto: DeleteMessageDto,
  ) {
    await this.messagesService.deleteBroadcast(user.id, actorId, messageId, dto.reason);
  }
}
