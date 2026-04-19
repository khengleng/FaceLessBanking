import { useCallback, useEffect, useMemo, useState } from 'react';

import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { LoadingState } from '@/components/ui/LoadingState';
import { PageContainer } from '@/components/ui/PageContainer';
import { HttpFxClient, type FxClient, type FxOverviewBundle, type FxShockRunResult } from '@/lib/api/fx.client';

export type FXPageProps = {
  client?: FxClient;
};

const DEFAULT_CLIENT = new HttpFxClient();

export function FXPage({ client = DEFAULT_CLIENT }: FXPageProps) {
  const [baseCurrency, setBaseCurrency] = useState('USD');
  const [quoteCurrency, setQuoteCurrency] = useState('KHR');
  const [reportingCurrency, setReportingCurrency] = useState('USD');
  const [bundle, setBundle] = useState<FxOverviewBundle | null>(null);
  const [shockRun, setShockRun] = useState<FxShockRunResult | null>(null);
  const [state, setState] = useState<'loading' | 'success' | 'empty' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [shockState, setShockState] = useState<'idle' | 'running' | 'error'>('idle');

  const load = useCallback(async () => {
    setState('loading');
    setError(null);

    try {
      const next = await client.getOverview({ baseCurrency, quoteCurrency, reportingCurrency });
      setBundle(next);

      const hasData = Boolean(next.latestRate || next.exposureSummary || next.scenarios.length > 0);
      setState(hasData ? 'success' : 'empty');
    } catch (err: unknown) {
      setBundle(null);
      setState('error');
      setError(err instanceof Error ? err.message : 'fx_overview_failed');
    }
  }, [baseCurrency, client, quoteCurrency, reportingCurrency]);

  useEffect(() => {
    void load();
  }, [load]);

  const scenarioId = useMemo(() => bundle?.scenarios[0]?.scenarioId, [bundle]);

  const runShock = async () => {
    if (!scenarioId) {
      return;
    }

    setShockState('running');
    try {
      const result = await client.runScenario({ scenarioId, reportingCurrency });
      setShockRun(result);
      setShockState('idle');
    } catch {
      setShockState('error');
    }
  };

  if (state === 'loading') {
    return (
      <PageContainer>
        <LoadingState message="Loading FX overview..." />
      </PageContainer>
    );
  }

  if (state === 'error') {
    return (
      <PageContainer>
        <ErrorState
          title="FX page unavailable"
          description={`Unable to load FX visibility: ${error ?? 'fx_page_unavailable'}`}
          onRetry={() => void load()}
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="page-header">
        <div>
          <h2>FX Visibility</h2>
          <p>Latest rates, exposure summary, and shock scenario placeholders for treasury and risk.</p>
        </div>
        <button type="button" className="refresh-button" onClick={() => void load()}>
          Refresh
        </button>
      </div>

      <section className="treasury-panel" aria-label="fx filters">
        <h3>Filters</h3>
        <div className="treasury-filter-row">
          <label>
            Base Currency
            <input value={baseCurrency} onChange={(event) => setBaseCurrency(event.target.value.toUpperCase())} maxLength={3} />
          </label>
          <label>
            Quote Currency
            <input value={quoteCurrency} onChange={(event) => setQuoteCurrency(event.target.value.toUpperCase())} maxLength={3} />
          </label>
          <label>
            Reporting Currency
            <input value={reportingCurrency} onChange={(event) => setReportingCurrency(event.target.value.toUpperCase())} maxLength={3} />
          </label>
          <button type="button" className="refresh-button" onClick={() => void load()}>
            Apply
          </button>
        </div>
      </section>

      {bundle?.warnings.length ? (
        <div className="warning-banner" role="status">
          Some FX sources are partial: {bundle.warnings.join(', ')}
        </div>
      ) : null}

      {state === 'empty' ? (
        <EmptyState title="No FX data found" description="No FX rate or exposure results are available for the selected filter." />
      ) : (
        <>
          <section className="treasury-panel" aria-label="latest fx rate">
            <h3>Latest FX Rate</h3>
            {bundle?.latestRate ? (
              <div className="detail-grid">
                <div><h4>Pair</h4><p>{bundle.latestRate.baseCurrency}/{bundle.latestRate.quoteCurrency}</p></div>
                <div><h4>Rate</h4><p>{bundle.latestRate.rateValue}</p></div>
                <div><h4>Effective</h4><p>{new Date(bundle.latestRate.effectiveAt).toLocaleString()}</p></div>
              </div>
            ) : (
              <p className="panel-placeholder">No latest FX rate available for this pair.</p>
            )}
          </section>

          <section className="treasury-panel" aria-label="exposure summary">
            <h3>Exposure Summary</h3>
            {bundle?.exposureSummary ? (
              <div className="treasury-metric-grid">
                <article className="summary-card"><h3>Gross Assets</h3><p className="summary-card-value">{bundle.exposureSummary.totalGrossAssets}</p></article>
                <article className="summary-card"><h3>Gross Liabilities</h3><p className="summary-card-value">{bundle.exposureSummary.totalGrossLiabilities}</p></article>
                <article className="summary-card"><h3>Net Open Position</h3><p className="summary-card-value">{bundle.exposureSummary.totalNetOpenPosition}</p></article>
              </div>
            ) : (
              <p className="panel-placeholder">Exposure summary unavailable.</p>
            )}
          </section>

          <section className="treasury-panel" aria-label="shock scenarios">
            <h3>Shock Scenario Results</h3>
            <p className="panel-placeholder">Run baseline shock scenarios to preview valuation impact placeholders.</p>
            <div className="header-actions">
              <button type="button" className="refresh-button" onClick={() => void runShock()} disabled={!scenarioId || shockState === 'running'}>
                Run {scenarioId ?? 'Scenario'}
              </button>
            </div>

            {shockState === 'error' ? <p className="action-error">Shock scenario run failed.</p> : null}

            {shockRun ? (
              <div className="treasury-table-wrap" role="region" aria-label="shock run table">
                <table className="treasury-table">
                  <thead>
                    <tr>
                      <th scope="col">Currency</th>
                      <th scope="col">Original Value</th>
                      <th scope="col">Shocked Value</th>
                      <th scope="col">Delta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shockRun.results.map((row) => (
                      <tr key={`${row.currency}-${row.calculatedAt}`}>
                        <td>{row.currency}</td>
                        <td>{row.originalReportingValue}</td>
                        <td>{row.shockedReportingValue}</td>
                        <td>{row.deltaValue}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="panel-placeholder">No shock result yet. Use run action to populate scenario output.</p>
            )}
          </section>
        </>
      )}
    </PageContainer>
  );
}
