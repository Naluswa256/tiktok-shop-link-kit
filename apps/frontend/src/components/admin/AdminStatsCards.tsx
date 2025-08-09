import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Users, 
  UserCheck, 
  Clock, 
  AlertTriangle, 
  TrendingUp, 
  Calendar,
  Loader2
} from 'lucide-react';
import { AdminStats } from '@/lib/admin-api';

interface AdminStatsCardsProps {
  stats?: AdminStats;
  isLoading: boolean;
  error?: any;
}

export const AdminStatsCards: React.FC<AdminStatsCardsProps> = ({
  stats,
  isLoading,
  error,
}) => {
  if (error) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="p-6">
          <div className="flex items-center text-red-600">
            <AlertTriangle className="w-5 h-5 mr-2" />
            <span>Failed to load statistics</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const statsCards = [
    {
      title: 'Total Users',
      value: stats?.totalUsers || 0,
      icon: Users,
      color: 'blue',
      description: 'All registered users',
    },
    {
      title: 'Active Trials',
      value: stats?.activeTrials || 0,
      icon: Clock,
      color: 'yellow',
      description: 'Users on trial period',
    },
    {
      title: 'Paid Subscribers',
      value: stats?.paidCount || 0,
      icon: UserCheck,
      color: 'green',
      description: 'Active paid subscriptions',
    },
    {
      title: 'Expired/Pending',
      value: (stats?.expiredCount || 0) + (stats?.pendingCount || 0),
      icon: AlertTriangle,
      color: 'red',
      description: 'Expired or pending users',
    },
    {
      title: 'Last 7 Days',
      value: stats?.signupsLast7Days || 0,
      icon: TrendingUp,
      color: 'purple',
      description: 'New signups this week',
    },
    {
      title: 'Last 30 Days',
      value: stats?.signupsLast30Days || 0,
      icon: Calendar,
      color: 'indigo',
      description: 'New signups this month',
    },
  ];

  const getColorClasses = (color: string) => {
    const colorMap = {
      blue: 'text-blue-600 bg-blue-100',
      yellow: 'text-yellow-600 bg-yellow-100',
      green: 'text-green-600 bg-green-100',
      red: 'text-red-600 bg-red-100',
      purple: 'text-purple-600 bg-purple-100',
      indigo: 'text-indigo-600 bg-indigo-100',
    };
    return colorMap[color as keyof typeof colorMap] || 'text-gray-600 bg-gray-100';
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
      {statsCards.map((card) => {
        const Icon = card.icon;
        const colorClasses = getColorClasses(card.color);
        
        return (
          <Card key={card.title} className="relative overflow-hidden">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-gray-600">
                  {card.title}
                </CardTitle>
                <div className={`p-2 rounded-lg ${colorClasses}`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-1">
                <div className="text-2xl font-bold text-gray-900">
                  {isLoading ? (
                    <Loader2 className="w-6 h-6 animate-spin" />
                  ) : (
                    card.value.toLocaleString()
                  )}
                </div>
                <p className="text-xs text-gray-500">
                  {card.description}
                </p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

// Additional detailed stats component
export const AdminDetailedStats: React.FC<AdminStatsCardsProps> = ({
  stats,
  isLoading,
  error,
}) => {
  if (error || !stats) return null;

  const trialConversionRate = stats.totalUsers > 0 
    ? ((stats.paidCount / stats.totalUsers) * 100).toFixed(1)
    : '0';

  const activeUserRate = stats.totalUsers > 0
    ? (((stats.activeTrials + stats.paidCount) / stats.totalUsers) * 100).toFixed(1)
    : '0';

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-600">
            Trial Conversion Rate
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="text-2xl font-bold text-green-600">
            {isLoading ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              `${trialConversionRate}%`
            )}
          </div>
          <p className="text-xs text-gray-500">
            Trials converted to paid
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-600">
            Active User Rate
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="text-2xl font-bold text-blue-600">
            {isLoading ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              `${activeUserRate}%`
            )}
          </div>
          <p className="text-xs text-gray-500">
            Active users (trial + paid)
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-600">
            Expired Trials
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="text-2xl font-bold text-orange-600">
            {isLoading ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              stats.expiredTrials.toLocaleString()
            )}
          </div>
          <p className="text-xs text-gray-500">
            Trials that have expired
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-600">
            Growth Rate
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="text-2xl font-bold text-purple-600">
            {isLoading ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              `+${stats.signupsLast7Days}`
            )}
          </div>
          <p className="text-xs text-gray-500">
            New users this week
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
