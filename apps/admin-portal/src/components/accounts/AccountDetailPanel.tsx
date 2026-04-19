import { StatusBadge, type StatusTone } from '@/components/ui/StatusBadge';
import type { AccountDetailBundle } from '@/lib/api/accounts.client';

export type AccountDetailPanelProps = {
  bundle: AccountDetailBundle;
};

export function AccountDetailPanel({ bundle }: AccountDetailPanelProps) {
  return (
    <section className="account-detail-grid" aria-label="account detail">
      <article className="summary-card">
        <h3>Account Status</h3>
        <p className="summary-card-value">
          <StatusBadge label={bundle.account.status} tone={statusTone(bundle.account.status)} />
        </p>
      </article>

      <article className="summary-card">
        <h3>Activation State</h3>
        <p className="summary-card-value">{bundle.activationState}</p>
      </article>

      <article className="summary-card">
        <h3>Account Type</h3>
        <p className="summary-card-value">{bundle.accountType}</p>
      </article>

      <article className="summary-card">
        <h3>Customer Reference</h3>
        <p className="summary-card-value">{bundle.account.customerId}</p>
      </article>

      <article className="summary-card">
        <h3>Available Balance</h3>
        <p className="summary-card-value">
          {bundle.balanceSnapshot ? `${bundle.balanceSnapshot.availableBalanceCents.toLocaleString()} ${bundle.balanceSnapshot.currency}` : 'N/A'}
        </p>
      </article>

      <article className="summary-card">
        <h3>Ledger Balance</h3>
        <p className="summary-card-value">
          {bundle.balanceSnapshot ? `${bundle.balanceSnapshot.ledgerBalanceCents.toLocaleString()} ${bundle.balanceSnapshot.currency}` : 'N/A'}
        </p>
      </article>
    </section>
  );
}

function statusTone(status: string): StatusTone {
  if (status === 'ACTIVE') {
    return 'success';
  }

  if (status === 'PENDING_ACTIVATION') {
    return 'warning';
  }

  if (status === 'SUSPENDED' || status === 'CLOSED') {
    return 'danger';
  }

  return 'neutral';
}
