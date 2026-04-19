import type { ReactNode } from 'react';

import { AccountDetailPage } from '@/pages/AccountDetailPage';
import { AccountsListPage } from '@/pages/AccountsListPage';
import type { UserRole } from '@/features/auth/session';
import { Customer360Page } from '@/pages/Customer360Page';
import { CustomerListPage } from '@/pages/CustomerListPage';
import { DashboardHomePage } from '@/pages/DashboardHomePage';
import { OnboardingReviewPage } from '@/pages/OnboardingReviewPage';
import { PaymentDetailPage } from '@/pages/PaymentDetailPage';
import { PaymentsListPage } from '@/pages/PaymentsListPage';
import { LoanDetailPage } from '@/pages/LoanDetailPage';
import { LoansListPage } from '@/pages/LoansListPage';
import { ReconciliationJobDetailPage } from '@/pages/ReconciliationJobDetailPage';
import { ReconciliationJobsPage } from '@/pages/ReconciliationJobsPage';
import { FXPage } from '@/pages/FXPage';
import { PricingPage } from '@/pages/PricingPage';
import { ProfitabilityPage } from '@/pages/ProfitabilityPage';
import { TreasuryOverviewPage } from '@/pages/TreasuryOverviewPage';
import { AdministrationFeatureFlagsPage } from '@/pages/AdministrationFeatureFlagsPage';
import { AdministrationMakerCheckerPage } from '@/pages/AdministrationMakerCheckerPage';
import { AdministrationPage } from '@/pages/AdministrationPage';
import { AdministrationRolesPermissionsPage } from '@/pages/AdministrationRolesPermissionsPage';
import { AdministrationSystemConfigPage } from '@/pages/AdministrationSystemConfigPage';
import { SectionPage } from '@/pages/SectionPage';

export type PortalRoute = {
  path: string;
  element: ReactNode;
  requiredRoles: UserRole[];
};

export const PORTAL_ROUTES: PortalRoute[] = [
  {
    path: '/dashboard',
    element: <DashboardHomePage />,
    requiredRoles: ['OPS_USER', 'OPS_MANAGER', 'RISK_USER', 'TREASURY_USER', 'ADMIN_USER']
  },
  {
    path: '/onboarding',
    element: <OnboardingReviewPage />,
    requiredRoles: ['OPS_USER', 'OPS_MANAGER', 'ADMIN_USER']
  },
  {
    path: '/customers',
    element: <CustomerListPage />,
    requiredRoles: ['OPS_USER', 'OPS_MANAGER', 'ADMIN_USER']
  },
  {
    path: '/customers/:customerId',
    element: <Customer360Page />,
    requiredRoles: ['OPS_USER', 'OPS_MANAGER', 'ADMIN_USER']
  },
  {
    path: '/accounts',
    element: <AccountsListPage />,
    requiredRoles: ['OPS_USER', 'OPS_MANAGER', 'ADMIN_USER']
  },
  {
    path: '/accounts/:accountId',
    element: <AccountDetailPage />,
    requiredRoles: ['OPS_USER', 'OPS_MANAGER', 'ADMIN_USER']
  },
  {
    path: '/payments',
    element: <PaymentsListPage />,
    requiredRoles: ['OPS_USER', 'OPS_MANAGER', 'ADMIN_USER']
  },
  {
    path: '/payments/:paymentId',
    element: <PaymentDetailPage />,
    requiredRoles: ['OPS_USER', 'OPS_MANAGER', 'ADMIN_USER']
  },
  {
    path: '/loans',
    element: <LoansListPage />,
    requiredRoles: ['OPS_USER', 'OPS_MANAGER', 'ADMIN_USER']
  },
  {
    path: '/loans/:loanId',
    element: <LoanDetailPage />,
    requiredRoles: ['OPS_USER', 'OPS_MANAGER', 'ADMIN_USER']
  },
  {
    path: '/reconciliation',
    element: <ReconciliationJobsPage />,
    requiredRoles: ['OPS_MANAGER', 'ADMIN_USER']
  },
  {
    path: '/reconciliation/:jobId',
    element: <ReconciliationJobDetailPage />,
    requiredRoles: ['OPS_MANAGER', 'ADMIN_USER']
  },
  {
    path: '/fx',
    element: <FXPage />,
    requiredRoles: ['TREASURY_USER', 'RISK_USER', 'OPS_MANAGER', 'ADMIN_USER']
  },
  {
    path: '/pricing',
    element: <PricingPage />,
    requiredRoles: ['TREASURY_USER', 'OPS_MANAGER', 'ADMIN_USER']
  },
  {
    path: '/treasury',
    element: <TreasuryOverviewPage />,
    requiredRoles: ['TREASURY_USER', 'OPS_MANAGER', 'ADMIN_USER']
  },
  {
    path: '/risk-limits',
    element: <SectionPage title="Risk & Limits" description="Risk alerts, limit utilization, and controls." />,
    requiredRoles: ['RISK_USER', 'OPS_MANAGER', 'ADMIN_USER']
  },
  {
    path: '/profitability',
    element: <ProfitabilityPage />,
    requiredRoles: ['OPS_MANAGER', 'ADMIN_USER']
  },
  {
    path: '/administration',
    element: <AdministrationPage />,
    requiredRoles: ['ADMIN_USER']
  },
  {
    path: '/administration/roles-permissions',
    element: <AdministrationRolesPermissionsPage />,
    requiredRoles: ['ADMIN_USER']
  },
  {
    path: '/administration/feature-flags',
    element: <AdministrationFeatureFlagsPage />,
    requiredRoles: ['ADMIN_USER']
  },
  {
    path: '/administration/system-config',
    element: <AdministrationSystemConfigPage />,
    requiredRoles: ['ADMIN_USER']
  },
  {
    path: '/administration/maker-checker',
    element: <AdministrationMakerCheckerPage />,
    requiredRoles: ['ADMIN_USER']
  }
];
