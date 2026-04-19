import { useCallback, useEffect, useState } from 'react';

import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { LoadingState } from '@/components/ui/LoadingState';
import { PageContainer } from '@/components/ui/PageContainer';
import {
  HttpProfitabilityClient,
  type ProfitabilityClient,
  type BankPnLSummary,
  type MarginMetrics,
  type ProfitabilityView
} from '@/lib/api/profitability.client';

export type ProfitabilityPageProps = {
  client?: ProfitabilityClient;
};

const DEFAULT_CLIENT = new HttpProfitabilityClient();

export function ProfitabilityPage({ client = DEFAULT_CLIENT }: ProfitabilityPageProps) {
  const [currency, setCurrency] = useState('USD');
  const [customerId, setCustomerId] = useState('cust-001');
  const [productType, setProductType] = useState('LOAN');
  const [customerView, setCustomerView] = useState<ProfitabilityView | null>(null);
  const [productView, setProductView] = useState<ProfitabilityView | null>(null);
  const [pnl, setPnl] = useState<BankPnLSummary | null>(null);
  const [margins, setMargins] = useState<MarginMetrics | null>(null);
  const [state, setState] = useState<'loading' | 'success' | 'empty' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setState('loading');
    setError(null);

    try {
      const [nextPnl, nextMargins, nextCustomer, nextProduct] = await Promise.all([
        client.getBankPnL(currency),
        client.getMargins(currency),
        client.getCustomerProfitability(customerId),
        client.getProductProfitability(productType)
      ]);

      setPnl(nextPnl);
      setMargins(nextMargins);
      setCustomerView(nextCustomer);
      setProductView(nextProduct);

      const hasData = Boolean(nextPnl || nextMargins || nextCustomer || nextProduct);
      setState(hasData ? 'success' : 'empty');
    } catch (err: unknown) {
      setState('error');
      setError(err instanceof Error ? err.message : 'profitability_load_failed');
    }
  }, [client, currency, customerId, productType]);

  useEffect(() => {
    void load();
  }, [load]);

  if (state === 'loading') {
    return (
      <PageContainer>
        <LoadingState message="Loading profitability view..." />
      </PageContainer>
    );
  }

  if (state === 'error') {
    return (
      <PageContainer>
        <ErrorState
          title="Profitability unavailable"
          description={`Unable to load profitability data: ${error ?? 'profitability_unavailable'}`}
          onRetry={() => void load()}
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="page-header">
        <div>
          <h2>Profitability Visibility</h2>
          <p>Customer, product, and bank-level profitability summary.</p>
        </div>
        <button type="button" className="refresh-button" onClick={() => void load()}>
          Refresh
        </button>
      </div>

      <section className="treasury-panel" aria-label="profitability filters">
        <h3>Filters</h3>
        <div className="treasury-filter-row">
          <label>
            Currency
            <input value={currency} maxLength={3} onChange={(event) => setCurrency(event.target.value.toUpperCase())} />
          </label>
          <label>
            Customer ID
            <input value={customerId} onChange={(event) => setCustomerId(event.target.value)} />
          </label>
          <label>
            Product Type
            <input value={productType} onChange={(event) => setProductType(event.target.value)} />
          </label>
          <button type="button" className="refresh-button" onClick={() => void load()}>
            Apply
          </button>
        </div>
      </section>

      {state === 'empty' ? (
        <EmptyState title="No profitability data" description="No profitability records are available for the selected filters." />
      ) : (
        <>
          <section className="treasury-panel" aria-label="bank pnl summary">
            <h3>Bank-Level P&L Summary</h3>
            {pnl ? (
              <div className="treasury-metric-grid">
                <article className="summary-card"><h3>Interest Income</h3><p className="summary-card-value">{pnl.totalInterestIncome.toFixed(2)}</p></article>
                <article className="summary-card"><h3>Fee Income</h3><p className="summary-card-value">{pnl.totalFeeIncome.toFixed(2)}</p></article>
                <article className="summary-card"><h3>FX Income</h3><p className="summary-card-value">{pnl.totalFxIncome.toFixed(2)}</p></article>
                <article className="summary-card"><h3>Total Cost</h3><p className="summary-card-value">{pnl.totalCost.toFixed(2)}</p></article>
                <article className="summary-card"><h3>Net Profit</h3><p className="summary-card-value">{pnl.netProfit.toFixed(2)}</p></article>
              </div>
            ) : (
              <p className="panel-placeholder">Bank-level P&L summary unavailable.</p>
            )}
          </section>

          <section className="treasury-panel" aria-label="customer and product profitability">
            <h3>Customer / Product Profitability</h3>
            <div className="pricing-grid">
              <article>
                <h4>Customer Profitability</h4>
                {customerView ? (
                  <div className="detail-grid">
                    <div><h4>Entity</h4><p>{customerView.entityId}</p></div>
                    <div><h4>Revenue</h4><p>{customerView.totalRevenue.toFixed(2)}</p></div>
                    <div><h4>Cost</h4><p>{customerView.totalCost.toFixed(2)}</p></div>
                    <div><h4>Net Profit</h4><p>{customerView.netProfit.toFixed(2)}</p></div>
                  </div>
                ) : (
                  <p className="panel-placeholder">Customer profitability unavailable.</p>
                )}
              </article>

              <article>
                <h4>Product Profitability</h4>
                {productView ? (
                  <div className="detail-grid">
                    <div><h4>Entity</h4><p>{productView.entityId}</p></div>
                    <div><h4>Revenue</h4><p>{productView.totalRevenue.toFixed(2)}</p></div>
                    <div><h4>Cost</h4><p>{productView.totalCost.toFixed(2)}</p></div>
                    <div><h4>Net Profit</h4><p>{productView.netProfit.toFixed(2)}</p></div>
                  </div>
                ) : (
                  <p className="panel-placeholder">Product profitability unavailable.</p>
                )}
              </article>
            </div>
          </section>

          <section className="treasury-panel" aria-label="margin metrics">
            <h3>Margin Metrics</h3>
            {margins ? (
              <div className="detail-grid">
                <div><h4>Net Interest Margin</h4><p>{margins.netInterestMargin.toFixed(4)}</p></div>
                <div><h4>Cost of Funds</h4><p>{margins.costOfFunds.toFixed(4)}</p></div>
                <div><h4>Yield on Assets</h4><p>{margins.yieldOnAssets.toFixed(4)}</p></div>
              </div>
            ) : (
              <p className="panel-placeholder">Margin metrics unavailable.</p>
            )}
          </section>
        </>
      )}
    </PageContainer>
  );
}
