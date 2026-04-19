import type { LedgerAnchor } from '../domain/ledger-anchor.js';

export class PostgresLedgerAdapter {
  private readonly anchors = new Map<string, LedgerAnchor>();

  async insertAnchor(anchor: LedgerAnchor): Promise<void> {
    this.anchors.set(anchor.anchorId, anchor);
  }

  async findAnchorById(anchorId: string): Promise<LedgerAnchor | null> {
    return this.anchors.get(anchorId) ?? null;
  }

  async findAnchorByEventId(eventId: string): Promise<LedgerAnchor | null> {
    for (const anchor of this.anchors.values()) {
      if (anchor.eventId === eventId) {
        return anchor;
      }
    }

    return null;
  }
}
