import { useState } from 'react';

import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { LoadingState } from '@/components/ui/LoadingState';
import { PageContainer } from '@/components/ui/PageContainer';
import {
  HttpPricingUiClient,
  type PricingUiClient,
  type FxPricingResult,
  type TransferPricingResult
} from '@/lib/api/pricing-ui.client';

export type PricingPageProps = {
  client?: PricingUiClient;
};

const DEFAULT_CLIENT = new HttpPricingUiClient();

export function PricingPage({ client = DEFAULT_CLIENT }: PricingPageProps) {
  const [transferForm, setTransferForm] = useState<{
    amount: string;
    currency: string;
    transferType: 'INTERNAL' | 'EXTERNAL' | 'INSTANT';
  }>({
    amount: '1000',
    currency: 'USD',
    transferType: 'INTERNAL'
  });
  const [fxForm, setFxForm] = useState({ amount: '1000', baseCurrency: 'USD', quoteCurrency: 'KHR' });
  const [transferResult, setTransferResult] = useState<TransferPricingResult | null>(null);
  const [fxResult, setFxResult] = useState<FxPricingResult | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  const runPricing = async () => {
    setState('loading');
    setError(null);

    try {
      const [transfer, fx] = await Promise.all([
        client.calculateTransferPricing({
          amount: Number(transferForm.amount),
          currency: transferForm.currency.toUpperCase(),
          transferType: transferForm.transferType
        }),
        client.calculateFxPricing({
          amount: Number(fxForm.amount),
          baseCurrency: fxForm.baseCurrency.toUpperCase(),
          quoteCurrency: fxForm.quoteCurrency.toUpperCase()
        })
      ]);

      setTransferResult(transfer);
      setFxResult(fx);
      setState('success');
    } catch (err: unknown) {
      setState('error');
      setError(err instanceof Error ? err.message : 'pricing_calculation_failed');
    }
  };

  return (
    <PageContainer>
      <div className="page-header">
        <div>
          <h2>Pricing Visibility</h2>
          <p>Loan/deposit pricing placeholders plus live transfer and FX pricing calculations.</p>
        </div>
        <button type="button" className="refresh-button" onClick={() => void runPricing()} disabled={state === 'loading'}>
          Calculate
        </button>
      </div>

      <section className="treasury-panel" aria-label="loan pricing results">
        <h3>Loan Pricing Results</h3>
        <p className="panel-placeholder">Loan pricing engine UI is placeholder in this phase. Product-rate curve and credit spread inputs will be integrated later.</p>
      </section>

      <section className="treasury-panel" aria-label="deposit pricing results">
        <h3>Deposit Pricing Results</h3>
        <p className="panel-placeholder">Deposit pricing UI is placeholder in this phase. Tenor curve and retention assumptions will be integrated later.</p>
      </section>

      <section className="treasury-panel" aria-label="transfer and fx pricing">
        <h3>Transfer / FX Pricing</h3>
        <div className="pricing-grid">
          <article>
            <h4>Transfer Pricing</h4>
            <div className="treasury-filter-row">
              <label>
                Amount
                <input value={transferForm.amount} onChange={(event) => setTransferForm({ ...transferForm, amount: event.target.value })} />
              </label>
              <label>
                Currency
                <input value={transferForm.currency} maxLength={3} onChange={(event) => setTransferForm({ ...transferForm, currency: event.target.value })} />
              </label>
              <label>
                Transfer Type
                <select
                  value={transferForm.transferType}
                  onChange={(event) =>
                    setTransferForm({
                      ...transferForm,
                      transferType: event.target.value as 'INTERNAL' | 'EXTERNAL' | 'INSTANT'
                    })
                  }
                >
                  <option value="INTERNAL">INTERNAL</option>
                  <option value="EXTERNAL">EXTERNAL</option>
                  <option value="INSTANT">INSTANT</option>
                </select>
              </label>
            </div>

            {transferResult ? (
              <div className="detail-grid">
                <div><h4>Fee</h4><p>{transferResult.fee.toFixed(2)}</p></div>
                <div><h4>Total Amount</h4><p>{transferResult.totalAmount.toFixed(2)}</p></div>
              </div>
            ) : (
              <p className="panel-placeholder">Run calculation to see transfer fee results.</p>
            )}
          </article>

          <article>
            <h4>FX Pricing</h4>
            <div className="treasury-filter-row">
              <label>
                Amount
                <input value={fxForm.amount} onChange={(event) => setFxForm({ ...fxForm, amount: event.target.value })} />
              </label>
              <label>
                Base
                <input value={fxForm.baseCurrency} maxLength={3} onChange={(event) => setFxForm({ ...fxForm, baseCurrency: event.target.value })} />
              </label>
              <label>
                Quote
                <input value={fxForm.quoteCurrency} maxLength={3} onChange={(event) => setFxForm({ ...fxForm, quoteCurrency: event.target.value })} />
              </label>
            </div>

            {fxResult ? (
              <div className="detail-grid">
                <div><h4>Base Rate</h4><p>{fxResult.baseRate.toFixed(6)}</p></div>
                <div><h4>Spread</h4><p>{fxResult.spread.toFixed(6)}</p></div>
                <div><h4>Final Rate</h4><p>{fxResult.finalRate.toFixed(6)}</p></div>
                <div><h4>Converted</h4><p>{fxResult.convertedAmount.toFixed(2)}</p></div>
              </div>
            ) : (
              <p className="panel-placeholder">Run calculation to see FX pricing results.</p>
            )}
          </article>
        </div>

        {state === 'loading' ? <LoadingState message="Calculating pricing..." /> : null}
        {state === 'error' ? (
          <ErrorState
            title="Pricing calculation failed"
            description={error ?? 'pricing_calculation_failed'}
            onRetry={() => void runPricing()}
          />
        ) : null}
      </section>

      {state === 'idle' && !transferResult && !fxResult ? (
        <EmptyState title="No pricing results yet" description="Provide inputs and run calculation to see transfer and FX pricing outputs." />
      ) : null}
    </PageContainer>
  );
}
