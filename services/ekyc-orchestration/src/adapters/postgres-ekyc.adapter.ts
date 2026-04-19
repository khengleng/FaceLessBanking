import type { EkycSession } from '../domain/ekyc-session.js';
import type { WebhookReceipt } from '../domain/webhook-receipt.js';

export class PostgresEkycAdapter {
  private readonly sessions = new Map<string, EkycSession>();
  private readonly applicantToSession = new Map<string, string>();
  private readonly webhookReceiptsByDedupeKey = new Map<string, WebhookReceipt>();

  async insertSession(session: EkycSession): Promise<void> {
    this.sessions.set(session.sessionId, session);
    this.applicantToSession.set(session.sumsubApplicantId, session.sessionId);
  }

  async updateSession(session: EkycSession): Promise<void> {
    this.sessions.set(session.sessionId, session);
    this.applicantToSession.set(session.sumsubApplicantId, session.sessionId);
  }

  async findSessionById(sessionId: string): Promise<EkycSession | null> {
    return this.sessions.get(sessionId) ?? null;
  }

  async getEkycSessionBySumsubApplicantId(sumsubApplicantId: string): Promise<EkycSession | null> {
    const sessionId = this.applicantToSession.get(sumsubApplicantId);
    if (!sessionId) {
      return null;
    }

    return this.sessions.get(sessionId) ?? null;
  }

  async updateEkycSessionStatus(input: {
    sessionId: string;
    newStatus: EkycSession['status'];
    reviewResult?: string;
    verificationLevel?: string;
    updatedAt: string;
  }): Promise<EkycSession | null> {
    const existing = this.sessions.get(input.sessionId);
    if (!existing) {
      return null;
    }

    const updated: EkycSession = {
      ...existing,
      status: input.newStatus,
      reviewResult: input.reviewResult ?? existing.reviewResult,
      verificationLevel: input.verificationLevel ?? existing.verificationLevel,
      updatedAt: input.updatedAt
    };

    this.sessions.set(input.sessionId, updated);
    this.applicantToSession.set(updated.sumsubApplicantId, updated.sessionId);

    return updated;
  }

  async createWebhookReceipt(receipt: WebhookReceipt): Promise<void> {
    this.webhookReceiptsByDedupeKey.set(receipt.dedupeKey, receipt);
  }

  async hasProcessedWebhookReceipt(dedupeKey: string): Promise<boolean> {
    const receipt = this.webhookReceiptsByDedupeKey.get(dedupeKey);
    return Boolean(receipt?.processedAt);
  }

  async markWebhookReceiptProcessed(dedupeKey: string, processedAt: string): Promise<void> {
    const receipt = this.webhookReceiptsByDedupeKey.get(dedupeKey);
    if (!receipt) {
      return;
    }

    this.webhookReceiptsByDedupeKey.set(dedupeKey, {
      ...receipt,
      processedAt
    });
  }
}
