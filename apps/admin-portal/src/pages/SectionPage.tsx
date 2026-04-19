import { EmptyState } from '@/components/ui/EmptyState';
import { FilterBar } from '@/components/ui/FilterBar';
import { PageContainer } from '@/components/ui/PageContainer';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { TablePlaceholder } from '@/components/ui/TablePlaceholder';

export type SectionPageProps = {
  title: string;
  description: string;
};

export function SectionPage({ title, description }: SectionPageProps) {
  return (
    <PageContainer>
      <div className="page-header">
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        <StatusBadge label="Placeholder" tone="warning" />
      </div>
      <FilterBar />
      <TablePlaceholder columns={['Reference', 'Status', 'Updated At']} />
      <EmptyState
        title={`No ${title.toLowerCase()} records loaded`}
        description="Backend integration is pending. Connect API clients and role-aware queries next."
      />
    </PageContainer>
  );
}
