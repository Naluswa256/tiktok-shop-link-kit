import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { productApi, AssembledProduct, ShopProductsResponse } from '@/lib/api';

// Query keys for React Query
export const productKeys = {
  all: ['products'] as const,
  shops: () => [...productKeys.all, 'shops'] as const,
  shop: (handle: string) => [...productKeys.shops(), handle] as const,
  shopProducts: (handle: string, options?: any) => [...productKeys.shop(handle), 'products', options] as const,
  product: (handle: string, videoId: string) => [...productKeys.shop(handle), 'product', videoId] as const,
};

// Hook to fetch shop products
export const useShopProducts = (
  handle: string,
  options?: {
    limit?: number;
    lastKey?: string;
    since?: string;
  }
) => {
  return useQuery({
    queryKey: productKeys.shopProducts(handle, options),
    queryFn: () => productApi.getShopProducts(handle, options),
    enabled: !!handle,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
};

// Hook to fetch a specific product
export const useProduct = (handle: string, videoId: string) => {
  return useQuery({
    queryKey: productKeys.product(handle, videoId),
    queryFn: () => productApi.getProduct(handle, videoId),
    enabled: !!handle && !!videoId,
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  });
};

// Hook to add a new product to the cache (for real-time updates)
export const useUpdateProductCache = () => {
  const queryClient = useQueryClient();

  const addNewProduct = (sellerHandle: string, newProduct: AssembledProduct) => {
    // Update the main products query
    queryClient.setQueryData(
      productKeys.shopProducts(sellerHandle),
      (oldData: any) => {
        if (!oldData?.data) return oldData;

        return {
          ...oldData,
          data: {
            ...oldData.data,
            products: [newProduct, ...oldData.data.products],
            pagination: {
              ...oldData.data.pagination,
              count: oldData.data.pagination.count + 1,
            },
            metadata: {
              ...oldData.data.metadata,
              timestamp: new Date().toISOString(),
            },
          },
        };
      }
    );

    // Also set the individual product cache
    queryClient.setQueryData(
      productKeys.product(sellerHandle, newProduct.video_id),
      {
        success: true,
        data: newProduct,
        message: 'Product retrieved successfully',
        timestamp: new Date().toISOString(),
        requestId: `cache-${Date.now()}`,
      }
    );
  };

  const invalidateShopProducts = (sellerHandle: string) => {
    queryClient.invalidateQueries({
      queryKey: productKeys.shop(sellerHandle),
    });
  };

  return {
    addNewProduct,
    invalidateShopProducts,
  };
};

// Hook for pagination
export const useShopProductsPagination = (handle: string) => {
  const queryClient = useQueryClient();

  const loadMore = async (lastKey: string) => {
    const newData = await productApi.getShopProducts(handle, { lastKey });
    
    // Merge with existing data
    queryClient.setQueryData(
      productKeys.shopProducts(handle),
      (oldData: any) => {
        if (!oldData?.data) return newData;

        return {
          ...newData,
          data: {
            ...newData.data,
            products: [...oldData.data.products, ...newData.data.products],
          },
        };
      }
    );

    return newData;
  };

  return { loadMore };
};
