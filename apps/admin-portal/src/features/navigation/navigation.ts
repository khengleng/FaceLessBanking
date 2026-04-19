import type { UserRole } from '@/features/auth/session';
import { hasAnyRequiredRole } from '@/features/auth/permission-guard';

export type NavItem = {
  label: string;
  path: string;
  requiredRoles: UserRole[];
};

export const NAV_ITEMS: NavItem[] = [
  {
    label: 'Dashboard',
    path: '/dashboard',
    requiredRoles: ['OPS_USER', 'OPS_MANAGER', 'RISK_USER', 'TREASURY_USER', 'ADMIN_USER']
  },
  {
    label: 'Onboarding',
    path: '/onboarding',
    requiredRoles: ['OPS_USER', 'OPS_MANAGER', 'ADMIN_USER']
  },
  {
    label: 'Customers',
    path: '/customers',
    requiredRoles: ['OPS_USER', 'OPS_MANAGER', 'ADMIN_USER']
  },
  {
    label: 'Accounts',
    path: '/accounts',
    requiredRoles: ['OPS_USER', 'OPS_MANAGER', 'ADMIN_USER']
  },
  {
    label: 'Payments',
    path: '/payments',
    requiredRoles: ['OPS_USER', 'OPS_MANAGER', 'ADMIN_USER']
  },
  {
    label: 'Loans',
    path: '/loans',
    requiredRoles: ['OPS_USER', 'OPS_MANAGER', 'ADMIN_USER']
  },
  {
    label: 'Reconciliation',
    path: '/reconciliation',
    requiredRoles: ['OPS_MANAGER', 'ADMIN_USER']
  },
  {
    label: 'FX',
    path: '/fx',
    requiredRoles: ['TREASURY_USER', 'RISK_USER', 'OPS_MANAGER', 'ADMIN_USER']
  },
  {
    label: 'Pricing',
    path: '/pricing',
    requiredRoles: ['TREASURY_USER', 'OPS_MANAGER', 'ADMIN_USER']
  },
  {
    label: 'Treasury',
    path: '/treasury',
    requiredRoles: ['TREASURY_USER', 'OPS_MANAGER', 'ADMIN_USER']
  },
  {
    label: 'Risk & Limits',
    path: '/risk-limits',
    requiredRoles: ['RISK_USER', 'OPS_MANAGER', 'ADMIN_USER']
  },
  {
    label: 'Profitability',
    path: '/profitability',
    requiredRoles: ['OPS_MANAGER', 'ADMIN_USER']
  },
  {
    label: 'Administration',
    path: '/administration',
    requiredRoles: ['ADMIN_USER']
  }
];

export function getNavigationForRoles(roles: UserRole[]): NavItem[] {
  return NAV_ITEMS.filter((item) => hasAnyRequiredRole(roles, item.requiredRoles));
}
