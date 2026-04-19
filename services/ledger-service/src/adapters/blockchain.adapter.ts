export type BlockchainAnchorRequest = {
  hash: string;
  chain: string;
};

export type BlockchainAnchorResult = {
  transactionId: string;
};

export interface BlockchainAdapter {
  submitAnchor(request: BlockchainAnchorRequest): Promise<BlockchainAnchorResult>;
}

export class BlockchainAdapterStub implements BlockchainAdapter {
  async submitAnchor(request: BlockchainAnchorRequest): Promise<BlockchainAnchorResult> {
    return {
      transactionId: `tx-${request.chain}-${request.hash.slice(0, 12)}`
    };
  }
}
