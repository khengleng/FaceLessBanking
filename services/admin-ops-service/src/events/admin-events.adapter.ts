export class AdminEventsAdapter {
  async emitAdminViewAccessed(viewName: 'system-health' | 'services' | 'errors'): Promise<void> {
    void viewName;
    // Placeholder for future admin.view.accessed.v1 event.
  }
}
