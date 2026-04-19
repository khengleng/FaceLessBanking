import { z } from 'zod';

import {
  INVESTIGATION_ENTITY_TYPES,
  type InvestigationEntityType,
  type InvestigationIndexRecord
} from '../../domain/investigation-index-record.js';

export const EntityTypeSchema = z.enum(INVESTIGATION_ENTITY_TYPES);

export const SearchQuerySchema = z.object({
  q: z.string().trim().min(1).optional(),
  entityType: EntityTypeSchema.optional(),
  customerId: z.string().trim().min(1).optional(),
  accountId: z.string().trim().min(1).optional(),
  paymentId: z.string().trim().min(1).optional(),
  caseId: z.string().trim().min(1).optional(),
  status: z.string().trim().min(1).optional(),
  correlationId: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional()
});

export const EntityLookupParamsSchema = z.object({
  entityType: EntityTypeSchema,
  entityId: z.string().trim().min(1)
});

export type SearchQueryDto = z.infer<typeof SearchQuerySchema>;
export type EntityLookupParamsDto = z.infer<typeof EntityLookupParamsSchema>;

export function toSearchItemDto(record: InvestigationIndexRecord): {
  indexId: string;
  entityType: InvestigationEntityType;
  entityId: string;
  correlationId?: string;
  customerId?: string;
  accountId?: string;
  paymentId?: string;
  caseId?: string;
  status?: string;
  sourceEventId: string;
  createdAt: string;
  updatedAt: string;
} {
  return {
    indexId: record.indexId,
    entityType: record.entityType,
    entityId: record.entityId,
    correlationId: record.correlationId,
    customerId: record.customerId,
    accountId: record.accountId,
    paymentId: record.paymentId,
    caseId: record.caseId,
    status: record.status,
    sourceEventId: record.sourceEventId,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt
  };
}
