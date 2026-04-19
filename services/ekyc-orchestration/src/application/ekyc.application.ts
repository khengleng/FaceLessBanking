import { randomUUID } from 'node:crypto';

import type {
  CreateSessionRequestDto,
  SubmitLivenessRequestDto,
  UploadDocumentsRequestDto
} from '../controllers/dtos/ekyc.dto.js';
import { buildEkycSession, type EkycSession } from '../domain/ekyc-session.js';
import type { AmlProviderAdapter } from '../adapters/provider-aml.adapter.js';
import type { LivenessProviderAdapter } from '../adapters/provider-liveness.adapter.js';
import type { OcrProviderAdapter } from '../adapters/provider-ocr.adapter.js';
import type { DocumentStorageAdapter } from '../adapters/document-storage.adapter.js';
import type { PostgresEkycAdapter } from '../adapters/postgres-ekyc.adapter.js';
import type { EkycEventsPublisher } from '../events/ekyc.events.js';

export type CreateSessionResult =
  | { kind: 'created'; session: EkycSession }
  | { kind: 'invalid_payload'; errors: string[] };

export type UploadDocumentsResult =
  | { kind: 'updated'; session: EkycSession }
  | { kind: 'invalid_payload'; errors: string[] }
  | { kind: 'not_found' };

export type SubmitLivenessResult =
  | { kind: 'updated'; session: EkycSession }
  | { kind: 'invalid_payload'; errors: string[] }
  | { kind: 'not_found' };

export type GetSessionResult =
  | { kind: 'found'; session: EkycSession }
  | { kind: 'not_found' };

export class EkycApplication {
  constructor(
    private readonly postgresAdapter: PostgresEkycAdapter,
    private readonly ocrProvider: OcrProviderAdapter,
    private readonly livenessProvider: LivenessProviderAdapter,
    private readonly amlProvider: AmlProviderAdapter,
    private readonly documentStorage: DocumentStorageAdapter,
    private readonly ekycEvents: EkycEventsPublisher
  ) {}

  async createSession(payload: CreateSessionRequestDto): Promise<CreateSessionResult> {
    const errors = validateCreateSessionPayload(payload);
    if (errors.length > 0) {
      return { kind: 'invalid_payload', errors };
    }

    const now = new Date().toISOString();

    const session = buildEkycSession({
      sessionId: randomUUID(),
      customerId: payload.customerId,
      countryCode: payload.countryCode,
      createdAt: now
    });

    const aml = await this.amlProvider.screenCustomer({
      customerId: payload.customerId,
      countryCode: payload.countryCode
    });

    const createdSession: EkycSession = {
      ...session,
      amlResult: aml.status,
      updatedAt: now
    };

    await this.postgresAdapter.insertSession(createdSession);
    await this.ekycEvents.emitSessionCreated(createdSession);
    await this.ekycEvents.emitStatusUpdated(createdSession);

    return { kind: 'created', session: createdSession };
  }

  async uploadDocuments(
    sessionId: string,
    payload: UploadDocumentsRequestDto
  ): Promise<UploadDocumentsResult> {
    const errors = validateUploadDocumentsPayload(payload);
    if (errors.length > 0) {
      return { kind: 'invalid_payload', errors };
    }

    const session = await this.postgresAdapter.findSessionById(sessionId);
    if (!session) {
      return { kind: 'not_found' };
    }

    const documentIds: string[] = [];

    for (const document of payload.documents) {
      const documentId = await this.documentStorage.storeDocument({
        sessionId,
        type: document.type,
        fileReference: document.fileReference
      });
      documentIds.push(documentId);

      await this.ocrProvider.processDocument({
        sessionId,
        documentType: document.type,
        fileReference: document.fileReference
      });
    }

    const now = new Date().toISOString();

    const updatedSession: EkycSession = {
      ...session,
      documentIds: [...session.documentIds, ...documentIds],
      status: session.livenessResult === 'passed' ? 'under_review' : 'documents_submitted',
      ocrResult: 'passed',
      updatedAt: now
    };

    await this.postgresAdapter.updateSession(updatedSession);
    await this.ekycEvents.emitStatusUpdated(updatedSession);

    return { kind: 'updated', session: updatedSession };
  }

  async submitLiveness(
    sessionId: string,
    payload: SubmitLivenessRequestDto
  ): Promise<SubmitLivenessResult> {
    const errors = validateSubmitLivenessPayload(payload);
    if (errors.length > 0) {
      return { kind: 'invalid_payload', errors };
    }

    const session = await this.postgresAdapter.findSessionById(sessionId);
    if (!session) {
      return { kind: 'not_found' };
    }

    await this.livenessProvider.verifyLiveness({
      sessionId,
      selfieReference: payload.selfieReference,
      challengeToken: payload.challengeToken
    });

    const now = new Date().toISOString();

    const updatedSession: EkycSession = {
      ...session,
      livenessResult: 'passed',
      status: session.ocrResult === 'passed' ? 'under_review' : 'liveness_submitted',
      updatedAt: now
    };

    await this.postgresAdapter.updateSession(updatedSession);
    await this.ekycEvents.emitStatusUpdated(updatedSession);

    return { kind: 'updated', session: updatedSession };
  }

  async getSessionById(sessionId: string): Promise<GetSessionResult> {
    const session = await this.postgresAdapter.findSessionById(sessionId);

    if (!session) {
      return { kind: 'not_found' };
    }

    return { kind: 'found', session };
  }
}

function validateCreateSessionPayload(payload: CreateSessionRequestDto): string[] {
  const errors: string[] = [];

  if (!payload.customerId || payload.customerId.trim().length < 3) {
    errors.push('customerId must contain at least 3 characters');
  }

  if (!payload.countryCode || payload.countryCode.trim().length !== 2) {
    errors.push('countryCode must be a 2-letter country code');
  }

  return errors;
}

function validateUploadDocumentsPayload(payload: UploadDocumentsRequestDto): string[] {
  const errors: string[] = [];

  if (!Array.isArray(payload.documents) || payload.documents.length === 0) {
    errors.push('documents must include at least one document');
    return errors;
  }

  for (const [index, document] of payload.documents.entries()) {
    if (!document.type || document.type.trim().length < 2) {
      errors.push(`documents[${index}].type is required`);
    }

    if (!document.fileReference || document.fileReference.trim().length < 3) {
      errors.push(`documents[${index}].fileReference is required`);
    }
  }

  return errors;
}

function validateSubmitLivenessPayload(payload: SubmitLivenessRequestDto): string[] {
  const errors: string[] = [];

  if (!payload.selfieReference || payload.selfieReference.trim().length < 3) {
    errors.push('selfieReference is required');
  }

  if (!payload.challengeToken || payload.challengeToken.trim().length < 3) {
    errors.push('challengeToken is required');
  }

  return errors;
}
