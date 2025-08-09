import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Search, Filter, X, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

interface AdminFiltersProps {
  searchValue: string;
  subscriptionFilter: string;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  onSearchChange: (search: string) => void;
  onSubscriptionFilterChange: (filter: string) => void;
  onSortChange: (sortBy: string, sortOrder: 'asc' | 'desc') => void;
}

export const AdminFilters: React.FC<AdminFiltersProps> = ({
  searchValue,
  subscriptionFilter,
  sortBy,
  sortOrder,
  onSearchChange,
  onSubscriptionFilterChange,
  onSortChange,
}) => {
  const [localSearch, setLocalSearch] = useState(searchValue);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      onSearchChange(localSearch);
    }, 300);

    return () => clearTimeout(timer);
  }, [localSearch, onSearchChange]);

  // Update local search when prop changes (e.g., from external clear)
  useEffect(() => {
    setLocalSearch(searchValue);
  }, [searchValue]);

  const handleClearSearch = () => {
    setLocalSearch('');
    onSearchChange('');
  };

  const handleClearSubscriptionFilter = () => {
    onSubscriptionFilterChange('');
  };

  const handleSortToggle = (field: string) => {
    if (sortBy === field) {
      // Toggle order if same field
      onSortChange(field, sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      // Default to desc for new field
      onSortChange(field, 'desc');
    }
  };

  const getSortIcon = (field: string) => {
    if (sortBy !== field) {
      return <ArrowUpDown className="w-4 h-4" />;
    }
    return sortOrder === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />;
  };

  const activeFiltersCount = [
    searchValue,
    subscriptionFilter,
  ].filter(Boolean).length;

  const clearAllFilters = () => {
    setLocalSearch('');
    onSearchChange('');
    onSubscriptionFilterChange('');
  };

  return (
    <div className="space-y-4">
      {/* Main Filters Row */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Search Input */}
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search by handle or phone number..."
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            className="pl-10 pr-10"
          />
          {localSearch && (
            <button
              onClick={handleClearSearch}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Subscription Status Filter */}
        <div className="sm:w-48">
          <Select value={subscriptionFilter} onValueChange={onSubscriptionFilterChange}>
            <SelectTrigger>
              <SelectValue placeholder="All Subscriptions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Subscriptions</SelectItem>
              <SelectItem value="trial">Trial</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Sort Controls */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleSortToggle('createdAt')}
            className={`flex items-center gap-2 ${sortBy === 'createdAt' ? 'bg-primary/10 text-primary' : ''}`}
          >
            Date {getSortIcon('createdAt')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleSortToggle('handle')}
            className={`flex items-center gap-2 ${sortBy === 'handle' ? 'bg-primary/10 text-primary' : ''}`}
          >
            Handle {getSortIcon('handle')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleSortToggle('subscriptionStatus')}
            className={`flex items-center gap-2 ${sortBy === 'subscriptionStatus' ? 'bg-primary/10 text-primary' : ''}`}
          >
            Status {getSortIcon('subscriptionStatus')}
          </Button>
        </div>
      </div>

      {/* Active Filters Display */}
      {activeFiltersCount > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 text-sm text-gray-600">
            <Filter className="w-4 h-4" />
            <span>Active filters:</span>
          </div>

          {searchValue && (
            <Badge variant="secondary" className="flex items-center gap-1">
              Search: "{searchValue}"
              <button
                onClick={handleClearSearch}
                className="ml-1 hover:text-red-600"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          )}

          {subscriptionFilter && (
            <Badge variant="secondary" className="flex items-center gap-1">
              Status: {subscriptionFilter}
              <button
                onClick={handleClearSubscriptionFilter}
                className="ml-1 hover:text-red-600"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={clearAllFilters}
            className="text-xs text-gray-500 hover:text-red-600"
          >
            Clear all
          </Button>
        </div>
      )}

      {/* Sort Display */}
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <span>Sorted by:</span>
        <Badge variant="outline" className="text-xs">
          {sortBy === 'createdAt' ? 'Date Created' : 
           sortBy === 'handle' ? 'Handle' : 
           sortBy === 'subscriptionStatus' ? 'Subscription Status' : sortBy}
          {' '}
          ({sortOrder === 'asc' ? 'A-Z' : 'Z-A'})
        </Badge>
      </div>
    </div>
  );
};
