import { useCallback, useEffect, useState } from 'react';

import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { LoadingState } from '@/components/ui/LoadingState';
import { PageContainer } from '@/components/ui/PageContainer';
import { HttpAdministrationClient, type AdministrationClient, type ConfigRecord } from '@/lib/api/administration.client';

const DEFAULT_CLIENT = new HttpAdministrationClient();

export type AdministrationSystemConfigPageProps = {
  client?: AdministrationClient;
};

export function AdministrationSystemConfigPage({ client = DEFAULT_CLIENT }: AdministrationSystemConfigPageProps) {
  const [items, setItems] = useState<ConfigRecord[]>([]);
  const [lookup, setLookup] = useState<ConfigRecord | null>(null);
  const [state, setState] = useState<'loading' | 'success' | 'empty' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ key: '', value: '', reason: 'admin_update' });
  const [lookupKey, setLookupKey] = useState('');

  const load = useCallback(async () => {
    setState('loading');
    setError(null);

    try {
      const config = await client.listConfig();
      setItems(config);
      setState(config.length > 0 ? 'success' : 'empty');
    } catch (err: unknown) {
      setItems([]);
      setState('error');
      setError(err instanceof Error ? err.message : 'config_load_failed');
    }
  }, [client]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    if (!window.confirm(`Save configuration key "${form.key}"?`)) {
      return;
    }

    setError(null);
    setSaving(true);

    try {
      await client.upsertConfig({
        key: form.key,
        value: form.value,
        reason: form.reason
      });
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'config_upsert_failed');
    } finally {
      setSaving(false);
    }
  };

  const fetchByKey = async () => {
    setError(null);

    try {
      const entry = await client.getConfigByKey(lookupKey);
      setLookup(entry);
    } catch (err: unknown) {
      setLookup(null);
      setError(err instanceof Error ? err.message : 'config_lookup_failed');
    }
  };

  if (state === 'loading') {
    return (
      <PageContainer>
        <LoadingState message="Loading system configuration..." />
      </PageContainer>
    );
  }

  if (state === 'error') {
    return (
      <PageContainer>
        <ErrorState
          title="System configuration unavailable"
          description={`Unable to load config: ${error ?? 'config_unavailable'}`}
          onRetry={() => void load()}
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="page-header">
        <div>
          <h2>System Configuration</h2>
          <p>Runtime configuration management with safe display rules.</p>
        </div>
        <button type="button" className="refresh-button" onClick={() => void load()}>
          Refresh
        </button>
      </div>

      <section className="treasury-panel" aria-label="upsert config">
        <h3>Create / Update Config</h3>
        <div className="treasury-filter-row">
          <label>
            Key
            <input value={form.key} onChange={(event) => setForm({ ...form, key: event.target.value })} />
          </label>
          <label>
            Value
            <input value={form.value} onChange={(event) => setForm({ ...form, value: event.target.value })} />
          </label>
          <label>
            Reason
            <input value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} />
          </label>
          <button type="button" className="refresh-button" onClick={() => void save()} disabled={saving}>
            Save Config
          </button>
        </div>
      </section>

      <section className="treasury-panel" aria-label="config lookup">
        <h3>Lookup Config By Key</h3>
        <div className="treasury-filter-row">
          <label>
            Key
            <input value={lookupKey} onChange={(event) => setLookupKey(event.target.value)} />
          </label>
          <button type="button" className="refresh-button" onClick={() => void fetchByKey()}>
            Fetch Config
          </button>
        </div>

        {lookup ? <p className="panel-placeholder">{lookup.key}: {toSafeDisplay(lookup)}</p> : <p className="panel-placeholder">No lookup result.</p>}
      </section>

      {saving ? <p className="panel-placeholder" role="status" aria-live="polite">Saving configuration...</p> : null}
      {error ? <p className="action-error" role="alert">{error}</p> : null}

      {state === 'empty' ? (
        <EmptyState title="No configuration entries" description="No config entries are available yet." />
      ) : (
        <section className="treasury-table-wrap" aria-label="config table">
          <table className="treasury-table">
            <thead>
              <tr>
                <th scope="col">Key</th>
                <th scope="col">Value</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.key}>
                  <td>{item.key}</td>
                  <td>{toSafeDisplay(item)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </PageContainer>
  );
}

function toSafeDisplay(item: ConfigRecord): string {
  const loweredKey = item.key.toLowerCase();

  if (loweredKey.includes('secret') || loweredKey.includes('token') || loweredKey.includes('password') || loweredKey.includes('key')) {
    return '[REDACTED]';
  }

  if (typeof item.value === 'string') {
    return item.value;
  }

  return JSON.stringify(item.value);
}
