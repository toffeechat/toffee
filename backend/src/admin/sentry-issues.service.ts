import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service.js';
import { AdminAlertService } from '../notifications/admin-alert.service.js';
import { alertCandidates, toErrorIssue, type ErrorAlertCandidate, type ErrorIssue, type SentryApiIssue } from './sentry-issues.js';

const CACHE_MS = 5 * 60_000;
// 실패하면 1분 동안은 다시 묻지 않음(Sentry가 느리거나 막혔을 때 운영자 홈을 열 때마다 기다리지 않게)
const FAILURE_CACHE_MS = 60_000;
const REQUEST_TIMEOUT_MS = 10_000;
const SHOW_LIMIT = 10;
// 한 번에 이보다 많으면 묶어서 한 통(배포 직후 오류가 쏟아질 때 알림 폭탄 방지)
const SEPARATE_ALERT_LIMIT = 3;
const KEEP_SENT_MS = 7 * 24 * 60 * 60_000;

export type ErrorsView =
  | { status: 'NOT_CONNECTED'; missing: string[] }
  | { status: 'OK' | 'FAILED'; fetchedAt: string | null; listUrl: string; issues: Omit<ErrorIssue, 'hourly'>[]; total24h: number; error?: string };

/**
 * 운영자 홈 "최근 오류"(2026-10-25 사용자 결정, 1차) — 서버가 Sentry API로 미해결 오류를 가져와 5분 캐시, 5분마다 새 오류·많이 나는 오류를
 * 기존 운영자 알림(ERROR)으로. SENTRY_API_TOKEN이 없으면 화면엔 "Sentry 연결 전". 키·알림 규칙 설정은 docs/product/error-monitoring-guide.md.
 */
@Injectable()
export class SentryIssuesService {
  private readonly logger = new Logger(SentryIssuesService.name);
  private cache: { at: number; ok: boolean; issues: ErrorIssue[]; error?: string } | null = null;
  private inflight: Promise<void> | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly alerts: AdminAlertService,
  ) {}

  private settings() {
    const token = this.config.get<string>('SENTRY_API_TOKEN')?.trim() ?? '';
    const org = this.config.get<string>('SENTRY_ORG')?.trim() || 'toffeechat';
    const projects = (this.config.get<string>('SENTRY_PROJECTS')?.trim() || 'toffee-backend,toffee-app')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    // 조직이 EU에 있으면 https://de.sentry.io
    const apiUrl = (this.config.get<string>('SENTRY_API_URL')?.trim() || 'https://sentry.io').replace(/\/+$/, '');
    const environment = this.config.get<string>('SENTRY_ISSUES_ENVIRONMENT')?.trim() ?? '';
    // 1시간에 이 횟수 이상이면 알림(기본 30, 0이면 끔)
    const rawThreshold = Number(this.config.get<string>('ERROR_ALERT_HOURLY_THRESHOLD')?.trim() || 30);
    const threshold = Number.isFinite(rawThreshold) && rawThreshold >= 0 ? rawThreshold : 30;
    return { token, org, projects, apiUrl, environment, threshold };
  }

  // Sentry 화면(API 지역과 상관없이 조직 주소)
  private listUrl() {
    const { org, environment } = this.settings();
    const query = `?query=${encodeURIComponent('is:unresolved')}&statsPeriod=24h${environment ? `&environment=${encodeURIComponent(environment)}` : ''}`;
    return `https://${org}.sentry.io/issues/${query}`;
  }

  async view(): Promise<ErrorsView> {
    const { token } = this.settings();
    if (!token) return { status: 'NOT_CONNECTED', missing: ['SENTRY_API_TOKEN'] };
    await this.refresh();
    const cache = this.cache!;
    const issues = [...cache.issues].sort((a, b) => (b.lastSeen ?? '').localeCompare(a.lastSeen ?? ''));
    return {
      status: cache.ok ? 'OK' : 'FAILED',
      // 실패했어도 바로 앞 성공 결과가 있으면 같이 보여 줌
      fetchedAt: cache.issues.length || cache.ok ? new Date(cache.at).toISOString() : null,
      listUrl: this.listUrl(),
      issues: issues.slice(0, SHOW_LIMIT).map(({ hourly: _hourly, ...rest }) => rest),
      total24h: issues.reduce((sum, issue) => sum + issue.count24h, 0),
      ...(cache.error ? { error: cache.error } : {}),
    };
  }

  /** 캐시가 지났으면 다시 가져옴(동시에 여러 번 불려도 한 번만) */
  async refresh(force = false) {
    const age = this.cache ? Date.now() - this.cache.at : Infinity;
    if (!force && this.cache && age < (this.cache.ok ? CACHE_MS : FAILURE_CACHE_MS)) return;
    this.inflight ??= this.load().finally(() => (this.inflight = null));
    await this.inflight;
  }

  private async load() {
    const { token, org, projects, apiUrl, environment } = this.settings();
    try {
      const lists = await Promise.all(
        projects.map(async (project) => {
          const params = new URLSearchParams({ query: 'is:unresolved', statsPeriod: '24h', sort: 'date', limit: '25' });
          if (environment) params.set('environment', environment);
          const response = await fetch(`${apiUrl}/api/0/projects/${encodeURIComponent(org)}/${encodeURIComponent(project)}/issues/?${params}`, {
            headers: { Authorization: `Bearer ${token}` },
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
          });
          if (!response.ok) throw new Error(`${project}: Sentry ${response.status}`);
          const body = (await response.json()) as SentryApiIssue[];
          return body.map((raw) => toErrorIssue(raw, project));
        }),
      );
      this.cache = { at: Date.now(), ok: true, issues: lists.flat() };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Sentry 오류 목록 가져오기 실패: ${message}`);
      this.cache = { at: Date.now(), ok: false, issues: this.cache?.issues ?? [], error: message };
    }
  }

  /** 5분마다 — 캐시를 새로 채우고 새 오류·많이 나는 오류를 운영자에게 */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async watch(now = new Date()) {
    if (!this.settings().token) return;
    try {
      await this.refresh(true);
      if (!this.cache?.ok) return;
      const sent: ErrorAlertCandidate[] = [];
      for (const candidate of alertCandidates(this.cache.issues, now, this.settings().threshold)) {
        if (await this.claim(candidate)) sent.push(candidate);
      }
      await this.send(sent);
      await this.prisma.errorAlertSent.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - KEEP_SENT_MS) } } });
    } catch (error) {
      this.logger.error('오류 알림 확인 실패', error as Error);
    }
  }

  // 먼저 기록을 남긴 서버만 보냄(유니크 키) — 서버가 여러 대거나 다시 켜져도 한 번
  private async claim({ issue, kind, bucket }: ErrorAlertCandidate) {
    try {
      await this.prisma.errorAlertSent.create({ data: { issueId: issue.id, kind, bucket } });
      return true;
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') return false;
      throw error;
    }
  }

  private async send(sent: ErrorAlertCandidate[]) {
    if (sent.length === 0) return;
    const threshold = this.settings().threshold;
    if (sent.length > SEPARATE_ALERT_LIMIT) {
      const lines = sent.slice(0, 10).map((item) => `· ${item.kind === 'NEW' ? '새 오류' : `1시간 ${item.hourCount}번`} — ${item.issue.title}`);
      await this.alerts.notify('ERROR', `오류 알림 ${sent.length}건`, `${lines.join('\n')}${sent.length > 10 ? `\n외 ${sent.length - 10}건` : ''}\n\n${this.listUrl()}`, {});
      return;
    }
    for (const { issue, kind, hourCount } of sent) {
      const title = kind === 'NEW' ? `새 오류 · ${issue.title}` : `1시간에 ${hourCount}번 · ${issue.title}`;
      const body = [
        kind === 'SPIKE' ? `기준 ${threshold}번을 넘었어요.` : null,
        issue.culprit || null,
        `${issue.project} · 전체 ${issue.count}번 · 영향 받은 사용자 ${issue.userCount}명`,
        issue.url || null,
      ]
        .filter(Boolean)
        .join('\n');
      await this.alerts.notify('ERROR', title.slice(0, 120), body, { issueId: issue.id, ...(issue.url ? { url: issue.url } : {}) });
    }
  }
}
