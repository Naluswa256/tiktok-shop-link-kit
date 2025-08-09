import React, { useState } from 'react';
import { AdminRouteGuard } from '@/contexts/AdminAuthContext';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { useAdminUserList, useAdminStats, useAdminRealTimeUpdates } from '@/hooks/useAdminData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RefreshCw, Users } from 'lucide-react';
import { toast } from 'sonner';
import { AdminFilters } from '@/components/admin/AdminFilters';
import { AdminStatsCards } from '@/components/admin/AdminStatsCards';
import { AdminUserModal } from '@/components/admin/AdminUserModal';
import { AdminUsersTable } from '@/components/admin/AdminUsersTable';

const AdminDashboard: React.FC = () => {
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);

  // Enable real-time updates
  useAdminRealTimeUpdates(true);

  // Data hooks
  const {
    users,
    pagination,
    query,
    isLoading: usersLoading,
    error: usersError,
    setSearch,
    setSubscriptionFilter,
    setSorting,
    setPage,
    nextPage,
    prevPage,
    refetch: refetchUsers,
  } = useAdminUserList();

  const {
    data: stats,
    isLoading: statsLoading,
    error: statsError,
    refetch: refetchStats,
  } = useAdminStats();

  // Handlers
  const handleUserClick = (userId: string) => {
    setSelectedUserId(userId);
    setIsUserModalOpen(true);
  };

  const handleCloseUserModal = () => {
    setSelectedUserId(null);
    setIsUserModalOpen(false);
  };

  const handleRefreshAll = async () => {
    try {
      await Promise.all([refetchUsers(), refetchStats()]);
      toast.success('Data refreshed successfully');
    } catch (error) {
      toast.error('Failed to refresh data');
    }
  };



  return (
    <AdminRouteGuard>
      <AdminLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
              <p className="text-gray-600 mt-1">
                Manage users and monitor platform statistics
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefreshAll}
                disabled={usersLoading || statsLoading}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${(usersLoading || statsLoading) ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>

          {/* Stats Cards */}
          <AdminStatsCards
            stats={stats}
            isLoading={statsLoading}
            error={statsError}
          />

          {/* Users Management Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-primary" />
                  <CardTitle>User Management</CardTitle>
                </div>
                <div className="text-sm text-gray-500">
                  {pagination && (
                    <>
                      Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
                      {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                      {pagination.total} users
                    </>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Filters */}
              <AdminFilters
                searchValue={query.search || ''}
                subscriptionFilter={query.subscriptionStatus || ''}
                sortBy={query.sortBy || 'createdAt'}
                sortOrder={query.sortOrder || 'desc'}
                onSearchChange={setSearch}
                onSubscriptionFilterChange={setSubscriptionFilter}
                onSortChange={setSorting}
              />

              {/* Users Table */}
              <AdminUsersTable
                users={users}
                pagination={pagination}
                isLoading={usersLoading}
                error={usersError}
                onUserClick={handleUserClick}
                onPageChange={setPage}
                onNextPage={nextPage}
                onPrevPage={prevPage}
                currentQuery={query}
              />
            </CardContent>
          </Card>

          {/* User Details Modal */}
          {selectedUserId && (
            <AdminUserModal
              userId={selectedUserId}
              isOpen={isUserModalOpen}
              onClose={handleCloseUserModal}
            />
          )}
        </div>
      </AdminLayout>
    </AdminRouteGuard>
  );
};

export default AdminDashboard;
