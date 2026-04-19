import { useMemo, useState } from 'react';

import { EmptyState } from '@/components/ui/EmptyState';
import { StatusBadge } from '@/components/ui/StatusBadge';
import type { Customer360Bundle } from '@/lib/api/customers.client';

const TABS = [
  { id: 'profile', label: 'Profile' },
  { id: 'accounts', label: 'Accounts' },
  { id: 'loans', label: 'Loans' },
  { id: 'payments', label: 'Recent Payments' },
  { id: 'onboarding', label: 'Onboarding Status' },
  { id: 'profitability', label: 'Profitability' }
] as const;

type TabId = (typeof TABS)[number]['id'];

export type Customer360TabsProps = {
  bundle: Customer360Bundle;
};

export function Customer360Tabs({ bundle }: Customer360TabsProps) {
  const [activeTab, setActiveTab] = useState<TabId>('profile');

  const tabContent = useMemo(() => {
    if (activeTab === 'profile') {
      return <ProfileTab bundle={bundle} />;
    }

    if (activeTab === 'accounts') {
      return <AccountsTab bundle={bundle} />;
    }

    if (activeTab === 'loans') {
      return <LoansTab bundle={bundle} />;
    }

    if (activeTab === 'payments') {
      return <PaymentsTab />;
    }

    if (activeTab === 'onboarding') {
      return <OnboardingTab bundle={bundle} />;
    }

    return <ProfitabilityTab bundle={bundle} />;
  }, [activeTab, bundle]);

  return (
    <section className="customer-360-tabs" aria-label="customer 360 sections">
      <div className="tab-list" role="tablist" aria-label="customer 360 tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            className={activeTab === tab.id ? 'tab active' : 'tab'}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="tab-panel">{tabContent}</div>
    </section>
  );
}

function ProfileTab({ bundle }: { bundle: Customer360Bundle }) {
  const profile = bundle.profile;

  return (
    <div className="detail-grid">
      <div>
        <h4>Customer</h4>
        <p>{bundle.customer.firstName} {bundle.customer.lastName}</p>
      </div>
      <div>
        <h4>Status</h4>
        <StatusBadge label={bundle.customer.status} />
      </div>
      <div>
        <h4>Email</h4>
        <p>{bundle.customer.email}</p>
      </div>
      <div>
        <h4>Verification</h4>
        <p>{profile?.verificationStatus ?? 'UNAVAILABLE'}</p>
      </div>
      <div>
        <h4>Risk Level</h4>
        <p>{profile?.riskLevel ?? 'UNAVAILABLE'}</p>
      </div>
      <div>
        <h4>Country</h4>
        <p>{profile?.countryCode ?? 'N/A'}</p>
      </div>
    </div>
  );
}

function AccountsTab({ bundle }: { bundle: Customer360Bundle }) {
  if (bundle.accounts.length === 0) {
    return <EmptyState title="No accounts" description="No account records are available for this customer yet." />;
  }

  return (
    <table className="customer-table">
      <thead>
        <tr>
          <th scope="col">Account ID</th>
          <th scope="col">Product</th>
          <th scope="col">Currency</th>
          <th scope="col">Status</th>
          <th scope="col">Created</th>
        </tr>
      </thead>
      <tbody>
        {bundle.accounts.map((account) => (
          <tr key={account.accountId}>
            <td>{account.accountId}</td>
            <td>{account.productCode}</td>
            <td>{account.currency}</td>
            <td>{account.status}</td>
            <td>{new Date(account.createdAt).toLocaleString()}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function LoansTab({ bundle }: { bundle: Customer360Bundle }) {
  if (bundle.loans.length === 0) {
    return <EmptyState title="No loans" description="No loan records are available yet or loan list API is not enabled." />;
  }

  return (
    <table className="customer-table">
      <thead>
        <tr>
          <th scope="col">Loan ID</th>
          <th scope="col">Status</th>
          <th scope="col">Principal</th>
          <th scope="col">Currency</th>
          <th scope="col">Created</th>
        </tr>
      </thead>
      <tbody>
        {bundle.loans.map((loan) => (
          <tr key={loan.loanId}>
            <td>{loan.loanId}</td>
            <td>{loan.status}</td>
            <td>{loan.principalAmountCents ?? 0}</td>
            <td>{loan.currency ?? 'USD'}</td>
            <td>{loan.createdAt ? new Date(loan.createdAt).toLocaleString() : 'N/A'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function PaymentsTab() {
  return (
    <EmptyState
      title="Recent payments placeholder"
      description="Payment timeline integration is a placeholder and will be connected to payment list APIs next."
    />
  );
}

function OnboardingTab({ bundle }: { bundle: Customer360Bundle }) {
  return (
    <div className="detail-grid">
      <div>
        <h4>Onboarding Reference</h4>
        <p>{bundle.profile?.onboardingReference ?? 'N/A'}</p>
      </div>
      <div>
        <h4>Verification Status</h4>
        <p>{bundle.profile?.verificationStatus ?? 'UNVERIFIED'}</p>
      </div>
      <div>
        <h4>Contact Status</h4>
        <p>{bundle.profile?.contactStatus ?? 'UNKNOWN'}</p>
      </div>
    </div>
  );
}

function ProfitabilityTab({ bundle }: { bundle: Customer360Bundle }) {
  if (!bundle.profitability) {
    return (
      <EmptyState
        title="Profitability placeholder"
        description="Customer profitability is not available yet from profitability APIs for this customer."
      />
    );
  }

  return (
    <div className="summary-grid">
      <article className="summary-card">
        <h3>Total Revenue</h3>
        <p className="summary-card-value">{bundle.profitability.totalRevenue.toLocaleString()}</p>
      </article>
      <article className="summary-card">
        <h3>Total Cost</h3>
        <p className="summary-card-value">{bundle.profitability.totalCost.toLocaleString()}</p>
      </article>
      <article className="summary-card">
        <h3>Net Profit</h3>
        <p className="summary-card-value">{bundle.profitability.netProfit.toLocaleString()} {bundle.profitability.currency}</p>
      </article>
    </div>
  );
}
