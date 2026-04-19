import { StatusBadge, type StatusTone } from '@/components/ui/StatusBadge';
import type { PaymentDetailBundle } from '@/lib/api/payments.client';

export type PaymentDetailPanelProps = {
  bundle: PaymentDetailBundle;
};

export function PaymentDetailPanel({ bundle }: PaymentDetailPanelProps) {
  return (
    <section className="payment-detail-layout" aria-label="payment detail">
      <div className="payment-detail-grid">
        <article className="summary-card">
          <h3>Payment ID</h3>
          <p className="summary-card-value">{bundle.payment.paymentId}</p>
        </article>
        <article className="summary-card">
          <h3>Status</h3>
          <p className="summary-card-value"><StatusBadge label={bundle.payment.status} tone={statusTone(bundle.payment.status)} /></p>
        </article>
        <article className="summary-card">
          <h3>Amount</h3>
          <p className="summary-card-value">{bundle.payment.amount.toLocaleString()} {bundle.payment.currency}</p>
        </article>
        <article className="summary-card">
          <h3>Source Account</h3>
          <p className="summary-card-value">{bundle.payment.sourceAccountId}</p>
        </article>
        <article className="summary-card">
          <h3>Destination Account</h3>
          <p className="summary-card-value">{bundle.payment.destinationAccountId}</p>
        </article>
        <article className="summary-card">
          <h3>Correlation ID</h3>
          <p className="summary-card-value">{bundle.payment.correlationId}</p>
        </article>
      </div>

      <section className="timeline-panel" aria-label="payment lifecycle timeline">
        <h3>Lifecycle Timeline</h3>
        <ul className="timeline-list">
          {bundle.timeline.map((event) => (
            <li key={event.id}>
              <div>
                <strong>{event.label}</strong>
                <StatusBadge label={event.status} tone={statusTone(event.status)} />
              </div>
              <small>{new Date(event.timestamp).toLocaleString()} · {event.source}</small>
              {event.details ? <small>{event.details}</small> : null}
            </li>
          ))}
        </ul>
      </section>
    </section>
  );
}

function statusTone(status: string): StatusTone {
  if (status === 'COMPLETED' || status === 'SUCCESS') {
    return 'success';
  }

  if (status === 'FAILED' || status === 'REJECTED') {
    return 'danger';
  }

  if (status === 'PENDING' || status === 'PROCESSING' || status === 'ACCEPTED') {
    return 'warning';
  }

  return 'neutral';
}
