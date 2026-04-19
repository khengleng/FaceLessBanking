import { Link } from 'react-router-dom';

import { PageContainer } from '@/components/ui/PageContainer';

export function AdministrationPage() {
  return (
    <PageContainer>
      <div className="page-header">
        <div>
          <h2>Administration</h2>
          <p>Governance and runtime controls for internal administrators.</p>
        </div>
      </div>

      <section className="admin-grid" aria-label="administration sections">
        <article className="summary-card">
          <h3>Roles & Permissions</h3>
          <p className="panel-placeholder">Create roles, permissions, and user-role assignments.</p>
          <Link to="/administration/roles-permissions" className="link-button">Open</Link>
        </article>

        <article className="summary-card">
          <h3>Feature Flags</h3>
          <p className="panel-placeholder">Manage rollout flags and targeting placeholders.</p>
          <Link to="/administration/feature-flags" className="link-button">Open</Link>
        </article>

        <article className="summary-card">
          <h3>System Configuration</h3>
          <p className="panel-placeholder">Read and update runtime configuration entries.</p>
          <Link to="/administration/system-config" className="link-button">Open</Link>
        </article>

        <article className="summary-card">
          <h3>Maker-Checker Policies</h3>
          <p className="panel-placeholder">Configure and inspect maker-checker policy records.</p>
          <Link to="/administration/maker-checker" className="link-button">Open</Link>
        </article>
      </section>
    </PageContainer>
  );
}
