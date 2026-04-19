import { useCallback, useEffect, useState } from 'react';

import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { LoadingState } from '@/components/ui/LoadingState';
import { PageContainer } from '@/components/ui/PageContainer';
import { HttpAdministrationClient, type AdministrationClient, type FeatureFlagRecord } from '@/lib/api/administration.client';

const DEFAULT_CLIENT = new HttpAdministrationClient();

export type AdministrationFeatureFlagsPageProps = {
  client?: AdministrationClient;
};

export function AdministrationFeatureFlagsPage({ client = DEFAULT_CLIENT }: AdministrationFeatureFlagsPageProps) {
  const [items, setItems] = useState<FeatureFlagRecord[]>([]);
  const [state, setState] = useState<'loading' | 'success' | 'empty' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ flagKey: '', description: '', enabled: true, environments: 'dev,staging,prod', roles: 'ADMIN_USER' });

  const load = useCallback(async () => {
    setState('loading');
    setError(null);

    try {
      const flags = await client.listFeatureFlags();
      setItems(flags);
      setState(flags.length > 0 ? 'success' : 'empty');
    } catch (err: unknown) {
      setItems([]);
      setState('error');
      setError(err instanceof Error ? err.message : 'feature_flags_load_failed');
    }
  }, [client]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    const confirmation = window.confirm(
      form.enabled
        ? `Enable feature flag "${form.flagKey}" with current targeting?`
        : `Disable feature flag "${form.flagKey}" with current targeting?`
    );
    if (!confirmation) {
      return;
    }

    setError(null);
    setSaving(true);

    try {
      await client.upsertFeatureFlag({
        flagKey: form.flagKey,
        description: form.description,
        enabled: form.enabled,
        environments: form.environments.split(',').map((item) => item.trim()).filter(Boolean),
        roles: form.roles.split(',').map((item) => item.trim()).filter(Boolean)
      });

      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'feature_flag_upsert_failed');
    } finally {
      setSaving(false);
    }
  };

  if (state === 'loading') {
    return (
      <PageContainer>
        <LoadingState message="Loading feature flags..." />
      </PageContainer>
    );
  }

  if (state === 'error') {
    return (
      <PageContainer>
        <ErrorState
          title="Feature flags unavailable"
          description={`Unable to load feature flags: ${error ?? 'feature_flags_unavailable'}`}
          onRetry={() => void load()}
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="page-header">
        <div>
          <h2>Feature Flags</h2>
          <p>Admin-only rollout controls with environment and role targeting placeholders.</p>
        </div>
        <button type="button" className="refresh-button" onClick={() => void load()}>
          Refresh
        </button>
      </div>

      <section className="treasury-panel" aria-label="feature flag form">
        <h3>Create / Update Flag</h3>
        <div className="treasury-filter-row">
          <label>
            Flag Key
            <input value={form.flagKey} onChange={(event) => setForm({ ...form, flagKey: event.target.value })} />
          </label>
          <label>
            Description
            <input value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
          </label>
          <label>
            Environments
            <input value={form.environments} onChange={(event) => setForm({ ...form, environments: event.target.value })} />
          </label>
          <label>
            Roles
            <input value={form.roles} onChange={(event) => setForm({ ...form, roles: event.target.value })} />
          </label>
          <label>
            Enabled
            <select
              value={form.enabled ? 'true' : 'false'}
              onChange={(event) => setForm({ ...form, enabled: event.target.value === 'true' })}
            >
              <option value="true">Enabled</option>
              <option value="false">Disabled</option>
            </select>
          </label>
          <button type="button" className="refresh-button" onClick={() => void save()} disabled={saving}>
            Save Flag
          </button>
        </div>
      </section>

      {saving ? <p className="panel-placeholder" role="status" aria-live="polite">Saving feature flag...</p> : null}
      {error ? <p className="action-error" role="alert">{error}</p> : null}

      {state === 'empty' ? (
        <EmptyState title="No feature flags found" description="Create a feature flag to begin controlled rollout management." />
      ) : (
        <section className="treasury-table-wrap" aria-label="feature flags table">
          <table className="treasury-table">
            <thead>
              <tr>
                <th scope="col">Flag</th>
                <th scope="col">Description</th>
                <th scope="col">Enabled</th>
                <th scope="col">Environments</th>
                <th scope="col">Roles</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.flagKey}>
                  <td>{item.flagKey}</td>
                  <td>{item.description}</td>
                  <td>{item.enabled ? 'Yes' : 'No'}</td>
                  <td>{item.environments.join(', ')}</td>
                  <td>{item.roles.join(', ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </PageContainer>
  );
}
