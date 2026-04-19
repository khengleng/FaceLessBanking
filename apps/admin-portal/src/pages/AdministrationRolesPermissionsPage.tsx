import { useState } from 'react';

import { EmptyState } from '@/components/ui/EmptyState';
import { PageContainer } from '@/components/ui/PageContainer';
import { HttpAdministrationClient, type AdministrationClient, type AdminRole } from '@/lib/api/administration.client';

const DEFAULT_CLIENT = new HttpAdministrationClient();

export type AdministrationRolesPermissionsPageProps = {
  client?: AdministrationClient;
};

export function AdministrationRolesPermissionsPage({ client = DEFAULT_CLIENT }: AdministrationRolesPermissionsPageProps) {
  const [roleForm, setRoleForm] = useState({ roleName: 'OPS_REVIEWER', description: 'Ops reviewer role', permissionIds: '' });
  const [permissionForm, setPermissionForm] = useState({ permissionName: 'ops.case.read', resource: 'cases', action: 'read' });
  const [assignForm, setAssignForm] = useState({ userId: 'user-001', roleId: '' });
  const [lookupRoleId, setLookupRoleId] = useState('');
  const [lookupUserId, setLookupUserId] = useState('');

  const [lastRole, setLastRole] = useState<AdminRole | null>(null);
  const [lookupRole, setLookupRole] = useState<AdminRole | null>(null);
  const [userRoles, setUserRoles] = useState<{ userId: string; roles: AdminRole[] } | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  const run = async (fn: () => Promise<void>) => {
    setState('loading');
    setError(null);

    try {
      await fn();
      setState('success');
    } catch (err: unknown) {
      setState('error');
      setError(err instanceof Error ? err.message : 'administration_roles_failed');
    }
  };

  return (
    <PageContainer>
      <div className="page-header">
        <div>
          <h2>Roles & Permissions</h2>
          <p>Admin-only role and permission governance controls.</p>
        </div>
      </div>

      <section className="treasury-panel" aria-label="create role">
        <h3>Create Role</h3>
        <div className="treasury-filter-row">
          <label>
            Role Name
            <input value={roleForm.roleName} onChange={(event) => setRoleForm({ ...roleForm, roleName: event.target.value })} />
          </label>
          <label>
            Description
            <input value={roleForm.description} onChange={(event) => setRoleForm({ ...roleForm, description: event.target.value })} />
          </label>
          <label>
            Permission IDs (comma-separated)
            <input value={roleForm.permissionIds} onChange={(event) => setRoleForm({ ...roleForm, permissionIds: event.target.value })} />
          </label>
          <button
            type="button"
            className="refresh-button"
            onClick={() =>
              void run(async () => {
                if (!window.confirm(`Create role "${roleForm.roleName}"?`)) {
                  return;
                }
                const created = await client.createRole({
                  roleName: roleForm.roleName,
                  description: roleForm.description,
                  permissionIds: roleForm.permissionIds
                    .split(',')
                    .map((item) => item.trim())
                    .filter(Boolean)
                });
                setLastRole(created);
                if (!assignForm.roleId) {
                  setAssignForm((current) => ({ ...current, roleId: created.roleId }));
                }
              })
            }
            disabled={state === 'loading'}
          >
            Create Role
          </button>
        </div>
      </section>

      <section className="treasury-panel" aria-label="create permission">
        <h3>Create Permission</h3>
        <div className="treasury-filter-row">
          <label>
            Permission Name
            <input value={permissionForm.permissionName} onChange={(event) => setPermissionForm({ ...permissionForm, permissionName: event.target.value })} />
          </label>
          <label>
            Resource
            <input value={permissionForm.resource} onChange={(event) => setPermissionForm({ ...permissionForm, resource: event.target.value })} />
          </label>
          <label>
            Action
            <input value={permissionForm.action} onChange={(event) => setPermissionForm({ ...permissionForm, action: event.target.value })} />
          </label>
          <button
            type="button"
            className="refresh-button"
            onClick={() => void run(async () => {
              if (!window.confirm(`Create permission "${permissionForm.permissionName}"?`)) {
                return;
              }
              await client.createPermission(permissionForm);
            })}
            disabled={state === 'loading'}
          >
            Create Permission
          </button>
        </div>
      </section>

      <section className="treasury-panel" aria-label="assign role">
        <h3>Assign Role to User</h3>
        <div className="treasury-filter-row">
          <label>
            User ID
            <input value={assignForm.userId} onChange={(event) => setAssignForm({ ...assignForm, userId: event.target.value })} />
          </label>
          <label>
            Role ID
            <input value={assignForm.roleId} onChange={(event) => setAssignForm({ ...assignForm, roleId: event.target.value })} />
          </label>
          <button
            type="button"
            className="refresh-button"
            onClick={() => void run(async () => {
              if (!window.confirm(`Assign role "${assignForm.roleId}" to user "${assignForm.userId}"?`)) {
                return;
              }
              await client.assignRole(assignForm);
            })}
            disabled={state === 'loading'}
          >
            Assign Role
          </button>
        </div>
      </section>

      <section className="treasury-panel" aria-label="lookups">
        <h3>Lookup</h3>
        <div className="pricing-grid">
          <article>
            <h4>Role by ID</h4>
            <div className="treasury-filter-row">
              <label>
                Role ID
                <input value={lookupRoleId} onChange={(event) => setLookupRoleId(event.target.value)} />
              </label>
              <button
                type="button"
                className="refresh-button"
                onClick={() => void run(async () => {
                  const role = await client.getRoleById(lookupRoleId);
                  setLookupRole(role);
                })}
              >
                Fetch Role
              </button>
            </div>

            {lookupRole ? <p className="panel-placeholder">{lookupRole.roleId} · {lookupRole.roleName}</p> : <p className="panel-placeholder">No role selected.</p>}
          </article>

          <article>
            <h4>User Roles</h4>
            <div className="treasury-filter-row">
              <label>
                User ID
                <input value={lookupUserId} onChange={(event) => setLookupUserId(event.target.value)} />
              </label>
              <button
                type="button"
                className="refresh-button"
                onClick={() => void run(async () => {
                  const roles = await client.getUserRoles(lookupUserId);
                  setUserRoles(roles);
                })}
              >
                Fetch User Roles
              </button>
            </div>

            {userRoles ? (
              <ul className="panel-list">
                {userRoles.roles.map((role) => (
                  <li key={role.roleId}>{role.roleName} ({role.roleId})</li>
                ))}
              </ul>
            ) : (
              <p className="panel-placeholder">No user role lookup yet.</p>
            )}
          </article>
        </div>
      </section>

      {lastRole ? (
        <section className="treasury-panel" aria-label="last created role">
          <h3>Last Created Role</h3>
          <p className="panel-placeholder">{lastRole.roleName} ({lastRole.roleId})</p>
        </section>
      ) : null}

      {state === 'loading' ? <p className="panel-placeholder" role="status" aria-live="polite">Submitting admin action...</p> : null}
      {state === 'error' ? <p className="action-error" role="alert">{error}</p> : null}
      {state === 'success' ? <p className="action-success" role="status">Action completed successfully.</p> : null}

      {state === 'idle' && !lastRole && !lookupRole && !userRoles ? (
        <EmptyState title="No role actions yet" description="Use the forms above to create roles/permissions and run lookups." />
      ) : null}
    </PageContainer>
  );
}
