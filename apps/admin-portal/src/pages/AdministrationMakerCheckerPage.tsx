import { useState } from 'react';

import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { LoadingState } from '@/components/ui/LoadingState';
import { PageContainer } from '@/components/ui/PageContainer';
import { HttpAdministrationClient, type AdministrationClient, type MakerCheckerPolicy } from '@/lib/api/administration.client';

const DEFAULT_CLIENT = new HttpAdministrationClient();

export type AdministrationMakerCheckerPageProps = {
  client?: AdministrationClient;
};

export function AdministrationMakerCheckerPage({ client = DEFAULT_CLIENT }: AdministrationMakerCheckerPageProps) {
  const [form, setForm] = useState({
    actionType: 'LOAN_APPROVAL',
    enabled: true,
    thresholdAmount: '100000',
    caseType: 'loan-review'
  });
  const [policyId, setPolicyId] = useState('');
  const [createdPolicy, setCreatedPolicy] = useState<MakerCheckerPolicy | null>(null);
  const [lookupPolicy, setLookupPolicy] = useState<MakerCheckerPolicy | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  const run = async (fn: () => Promise<void>) => {
    setState('loading');
    setError(null);

    try {
      await fn();
      setState('success');
    } catch (err: unknown) {
      setState('error');
      setError(err instanceof Error ? err.message : 'maker_checker_failed');
    }
  };

  return (
    <PageContainer>
      <div className="page-header">
        <div>
          <h2>Maker-Checker Policies</h2>
          <p>Create and inspect maker-checker policy controls for sensitive actions.</p>
        </div>
      </div>

      <section className="treasury-panel" aria-label="create maker checker policy">
        <h3>Create Policy</h3>
        <div className="treasury-filter-row">
          <label>
            Action Type
            <select value={form.actionType} onChange={(event) => setForm({ ...form, actionType: event.target.value })}>
              <option value="MANUAL_ACCOUNT_ACTIVATION">MANUAL_ACCOUNT_ACTIVATION</option>
              <option value="LOAN_APPROVAL">LOAN_APPROVAL</option>
              <option value="MANUAL_PAYMENT_RELEASE">MANUAL_PAYMENT_RELEASE</option>
              <option value="MANUAL_FEE_WAIVER">MANUAL_FEE_WAIVER</option>
            </select>
          </label>
          <label>
            Enabled
            <select value={form.enabled ? 'true' : 'false'} onChange={(event) => setForm({ ...form, enabled: event.target.value === 'true' })}>
              <option value="true">Enabled</option>
              <option value="false">Disabled</option>
            </select>
          </label>
          <label>
            Threshold Amount
            <input value={form.thresholdAmount} onChange={(event) => setForm({ ...form, thresholdAmount: event.target.value })} />
          </label>
          <label>
            Case Type
            <input value={form.caseType} onChange={(event) => setForm({ ...form, caseType: event.target.value })} />
          </label>
          <button
            type="button"
            className="refresh-button"
            onClick={() =>
              void run(async () => {
                if (!window.confirm(`Create maker-checker policy for action "${form.actionType}"?`)) {
                  return;
                }
                const created = await client.createMakerCheckerPolicy({
                  actionType: form.actionType,
                  enabled: form.enabled,
                  thresholdAmount: Number(form.thresholdAmount),
                  caseType: form.caseType
                });

                setCreatedPolicy(created);
                setPolicyId(created.policyId);
              })
            }
            disabled={state === 'loading'}
          >
            Create Policy
          </button>
        </div>
      </section>

      <section className="treasury-panel" aria-label="lookup maker checker policy">
        <h3>Lookup Policy</h3>
        <div className="treasury-filter-row">
          <label>
            Policy ID
            <input value={policyId} onChange={(event) => setPolicyId(event.target.value)} />
          </label>
          <button
            type="button"
            className="refresh-button"
            onClick={() =>
              void run(async () => {
                const found = await client.getMakerCheckerPolicy(policyId);
                setLookupPolicy(found);
              })
            }
            disabled={state === 'loading'}
          >
            Fetch Policy
          </button>
        </div>
      </section>

      {createdPolicy ? (
        <section className="treasury-panel" aria-label="created policy">
          <h3>Created Policy</h3>
          <p className="panel-placeholder">{createdPolicy.policyId} · {createdPolicy.actionType} · {createdPolicy.caseType}</p>
        </section>
      ) : null}

      {lookupPolicy ? (
        <section className="treasury-panel" aria-label="lookup policy result">
          <h3>Lookup Result</h3>
          <p className="panel-placeholder">{lookupPolicy.policyId} · {lookupPolicy.actionType} · enabled: {lookupPolicy.enabled ? 'true' : 'false'}</p>
        </section>
      ) : null}

      {state === 'loading' ? <LoadingState message="Submitting maker-checker action..." /> : null}
      {state === 'error' ? (
        <ErrorState
          title="Action failed"
          description={error ?? 'maker_checker_failed'}
        />
      ) : null}
      {state === 'success' ? <p className="action-success" role="status">Action completed successfully.</p> : null}

      {state === 'idle' && !createdPolicy && !lookupPolicy ? (
        <EmptyState title="No policy activity yet" description="Create or lookup a maker-checker policy to populate this page." />
      ) : null}
    </PageContainer>
  );
}
