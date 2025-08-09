import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { 
  User, 
  Phone, 
  Calendar, 
  Clock, 
  CheckCircle, 
  XCircle,
  Loader2,
  AlertCircle,
  ExternalLink,
  Users,
  TrendingUp
} from 'lucide-react';
import { useAdminUserDetails } from '@/hooks/useAdminData';

interface AdminUserModalProps {
  userId: string;
  isOpen: boolean;
  onClose: () => void;
}

export const AdminUserModal: React.FC<AdminUserModalProps> = ({
  userId,
  isOpen,
  onClose,
}) => {
  const { data: userResponse, isLoading, error } = useAdminUserDetails(userId);
  const user = userResponse?.data;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'trial':
        return <Clock className="w-4 h-4 text-yellow-600" />;
      case 'paid':
      case 'active':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'expired':
        return <XCircle className="w-4 h-4 text-red-600" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-600" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      trial: { variant: 'secondary' as const, label: 'Trial', className: 'bg-yellow-100 text-yellow-800' },
      paid: { variant: 'default' as const, label: 'Paid', className: 'bg-green-100 text-green-800' },
      active: { variant: 'default' as const, label: 'Active', className: 'bg-green-100 text-green-800' },
      expired: { variant: 'destructive' as const, label: 'Expired', className: 'bg-red-100 text-red-800' },
      pending: { variant: 'outline' as const, label: 'Pending', className: 'bg-gray-100 text-gray-800' },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    
    return (
      <Badge variant={config.variant} className={config.className}>
        {getStatusIcon(status)}
        <span className="ml-1">{config.label}</span>
      </Badge>
    );
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };

  const formatTimeLeft = (expiresAt?: string) => {
    if (!expiresAt) return null;
    
    const now = new Date();
    const expiry = new Date(expiresAt);
    const diffTime = expiry.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return 'Expired';
    if (diffDays === 0) return 'Expires today';
    if (diffDays === 1) return 'Expires in 1 day';
    return `Expires in ${diffDays} days`;
  };

  const maskPhoneNumber = (phone?: string) => {
    if (!phone) return 'N/A';
    return phone;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            User Details
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin" />
            <span className="ml-2">Loading user details...</span>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-8 text-red-600">
            <AlertCircle className="w-5 h-5 mr-2" />
            <span>Failed to load user details</span>
          </div>
        ) : user ? (
          <div className="space-y-6">
            {/* User Header */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                      <User className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold">@{user.handle}</h3>
                      {user.displayName && (
                        <p className="text-gray-600">{user.displayName}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {user.isVerified && (
                      <Badge variant="secondary">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Verified
                      </Badge>
                    )}
                    {getStatusBadge(user.subscriptionStatus)}
                  </div>
                </div>
              </CardHeader>
            </Card>

            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Basic Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">User ID</label>
                    <p className="text-sm font-mono bg-gray-100 p-2 rounded">
                      {user.userId}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Handle</label>
                    <p className="text-sm">@{user.handle}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Phone Number</label>
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-gray-400" />
                      <p className="text-sm">{maskPhoneNumber(user.phoneNumber)}</p>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Shop Link</label>
                    <div className="flex items-center gap-2">
                      <ExternalLink className="w-4 h-4 text-gray-400" />
                      <p className="text-sm">{user.shopLink}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* TikTok Information */}
            {(user.followerCount || user.isVerified) && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" />
                    TikTok Profile
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    {user.followerCount && (
                      <div>
                        <label className="text-sm font-medium text-gray-500">Followers</label>
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-gray-400" />
                          <p className="text-sm font-semibold">
                            {user.followerCount.toLocaleString()}
                          </p>
                        </div>
                      </div>
                    )}
                    <div>
                      <label className="text-sm font-medium text-gray-500">Verification Status</label>
                      <div className="flex items-center gap-2">
                        {user.isVerified ? (
                          <>
                            <CheckCircle className="w-4 h-4 text-green-600" />
                            <span className="text-sm text-green-600">Verified</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="w-4 h-4 text-gray-400" />
                            <span className="text-sm text-gray-600">Not Verified</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Subscription Information */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Subscription Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Current Status</label>
                    <div className="mt-1">
                      {getStatusBadge(user.subscriptionStatus)}
                    </div>
                  </div>
                  {user.trialEndDate && (
                    <div>
                      <label className="text-sm font-medium text-gray-500">Trial Status</label>
                      <div className="flex items-center gap-2 mt-1">
                        <Clock className="w-4 h-4 text-gray-400" />
                        <span className="text-sm">
                          {formatTimeLeft(user.trialEndDate)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <Separator />

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Created At</label>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      <p className="text-sm">{formatDate(user.createdAt)}</p>
                    </div>
                  </div>
                  {user.lastLoginAt && (
                    <div>
                      <label className="text-sm font-medium text-gray-500">Last Login</label>
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-gray-400" />
                        <p className="text-sm">{formatDate(user.lastLoginAt)}</p>
                      </div>
                    </div>
                  )}
                </div>

                {user.trialEndDate && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Trial Expires</label>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      <p className="text-sm">{formatDate(user.trialEndDate)}</p>
                    </div>
                  </div>
                )}

                {user.subscriptionEndDate && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Subscription Expires</label>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      <p className="text-sm">{formatDate(user.subscriptionEndDate)}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            No user data available
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
