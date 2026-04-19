import { Link, useParams } from 'react-router-dom';

import { ErrorState } from '@/components/ui/ErrorState';
import { LoadingState } from '@/components/ui/LoadingState';
import { PageContainer } from '@/components/ui/PageContainer';
import { PaymentDetailPanel } from '@/components/payments/PaymentDetailPanel';
import { usePaymentDetail } from '@/features/payments/use-payment-detail';
import type { PaymentsClient } from '@/lib/api/payments.client';

export type PaymentDetailPageProps = {
  client?: PaymentsClient;
};

export function PaymentDetailPage({ client }: PaymentDetailPageProps) {
  const { paymentId } = useParams<{ paymentId: string }>();
  const { bundle, state, reload } = usePaymentDetail(paymentId, client);

  if (state.status === 'loading') {
    return (
      <PageContainer>
        <LoadingState message="Loading payment detail..." />
      </PageContainer>
    );
  }

  if (state.status === 'error' || !bundle) {
    return (
      <PageContainer>
        <div className="page-header">
          <div>
            <h2>Payment Investigation</h2>
            <p>Operational payment lifecycle lookup.</p>
          </div>
          <Link to="/payments" className="link-button">Back to Payments</Link>
        </div>

        <ErrorState
          title="Payment detail unavailable"
          description={`Unable to load payment: ${state.error ?? 'payment_detail_unavailable'}`}
          onRetry={() => void reload()}
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="page-header">
        <div>
          <h2>{bundle.payment.paymentId}</h2>
          <p>{bundle.payment.correlationId}</p>
        </div>
        <div className="header-actions">
          <button type="button" className="refresh-button" onClick={() => void reload()}>
            Refresh
          </button>
          <Link to="/payments" className="link-button">Back</Link>
        </div>
      </div>

      {bundle.warnings.length > 0 ? (
        <div className="warning-banner" role="status">
          Some timeline sources are partial: {bundle.warnings.join(', ')}
        </div>
      ) : null}

      <PaymentDetailPanel bundle={bundle} />
    </PageContainer>
  );
}
