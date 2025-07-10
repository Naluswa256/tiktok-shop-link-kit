import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Layout, Header, Button, PageViewCounter } from '@/components/tiktok-commerce';
import { MessageCircle, Share2, Search, Eye, Video, ToggleLeft, ToggleRight, Filter, ChevronDown, LogOut, ExternalLink, Plus } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

// Mock product data - same as ProductCatalog but with seller controls
const mockProducts = [
  {
    id: '1',
    title: 'Designer High Heels Collection',
    price: '55000',
    currency: 'UGX',
    tags: ['shoes', 'heels', 'fashion'],
    sizes: ['37', '38', '39', '40', '41'],
    images: [
      'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=400&h=400&fit=crop',
      'https://images.unsplash.com/photo-1549298916-b41d501d3772?w=400&h=400&fit=crop',
      'https://images.unsplash.com/photo-1562183241-b937e95585b6?w=400&h=400&fit=crop'
    ],
    tiktokUrl: 'https://tiktok.com/@nalu-fashion/video/123',
    isOutOfStock: false,
    views: 234
  },
  {
    id: '2', 
    title: 'Premium Leather Handbag',
    price: '85000',
    currency: 'UGX',
    tags: ['bags', 'leather', 'accessories'],
    sizes: ['One Size'],
    images: [
      'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=400&h=400&fit=crop',
      'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400&h=400&fit=crop'
    ],
    tiktokUrl: 'https://tiktok.com/@nalu-fashion/video/124',
    isOutOfStock: false,
    views: 189
  },
  {
    id: '3',
    title: 'Summer Floral Dress',
    price: '45000', 
    currency: 'UGX',
    tags: ['dresses', 'summer', 'casual'],
    sizes: ['S', 'M', 'L', 'XL'],
    images: [
      'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=400&h=400&fit=crop',
      'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?w=400&h=400&fit=crop'
    ],
    tiktokUrl: 'https://tiktok.com/@nalu-fashion/video/125',
    isOutOfStock: true,
    views: 156
  },
  {
    id: '4',
    title: 'Statement Jewelry Set',
    price: '25000',
    currency: 'UGX', 
    tags: ['jewelry', 'accessories', 'sets'],
    sizes: ['One Size'],
    images: [
      'https://images.unsplash.com/photo-1611652022419-a9419f74343d?w=400&h=400&fit=crop'
    ],
    tiktokUrl: 'https://tiktok.com/@nalu-fashion/video/126',
    isOutOfStock: false,
    views: 67
  }
];

const SellerDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTag, setSelectedTag] = useState<string>('all');
  const [products, setProducts] = useState(mockProducts);
  const [currentImageIndex, setCurrentImageIndex] = useState<Record<string, number>>({});

  // Redirect if not authenticated
  React.useEffect(() => {
    if (!user) {
      navigate('/login');
    }
  }, [user, navigate]);

  if (!user) {
    return null; // Will redirect
  }

  const totalViews = products.reduce((sum, product) => sum + product.views, 0);
  const activeProducts = products.filter(p => !p.isOutOfStock).length;
  const outOfStockProducts = products.filter(p => p.isOutOfStock).length;

  // Get all unique tags
  const allTags = useMemo(() => {
    const tags = new Set<string>();
    products.forEach(product => {
      product.tags.forEach(tag => tags.add(tag));
    });
    return Array.from(tags);
  }, [products]);

  // Filter products
  const filteredProducts = useMemo(() => {
    return products.filter(product => {
      const matchesSearch = product.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           product.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesTag = selectedTag === 'all' || product.tags.includes(selectedTag);
      return matchesSearch && matchesTag;
    });
  }, [products, searchTerm, selectedTag]);

  const toggleOutOfStock = (productId: string) => {
    setProducts(prev => prev.map(product => 
      product.id === productId 
        ? { ...product, isOutOfStock: !product.isOutOfStock }
        : product
    ));
    
    const product = products.find(p => p.id === productId);
    if (product) {
      toast({
        title: product.isOutOfStock ? "Product marked as available" : "Product marked as out of stock",
        description: `"${product.title}" status updated`,
      });
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
    toast({
      title: "Logged out successfully",
      description: "You have been signed out of your account",
    });
  };

  const viewPublicShop = () => {
    window.open(`/shop/${user.shopHandle}`, '_blank');
  };

  const shareShopLink = () => {
    const shopUrl = `${window.location.origin}/shop/${user.shopHandle}`;
    navigator.clipboard.writeText(shopUrl);
    toast({
      title: "Shop link copied!",
      description: "Share this link to let customers browse your products",
    });
  };

  const nextImage = (productId: string, maxImages: number) => {
    setCurrentImageIndex(prev => ({
      ...prev,
      [productId]: ((prev[productId] || 0) + 1) % maxImages
    }));
  };

  return (
    <Layout
      header={
        <Header 
          title="Seller Dashboard"
          actions={
            <div className="flex items-center gap-sm">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={viewPublicShop}
                className="gap-2"
              >
                <ExternalLink className="w-4 h-4" />
                View Shop
              </Button>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={handleLogout}
                className="gap-2"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </Button>
            </div>
          }
        />
      }
    >
      <div className="space-y-lg">
        {/* Dashboard Header */}
        <div className="bg-gradient-to-br from-primary/5 to-accent/5 rounded-lg p-lg">
          <div className="flex items-center justify-between mb-md">
            <div>
              <h1 className="text-xl font-bold text-foreground">
                Welcome back, {user.tiktokHandle}!
              </h1>
              <p className="text-sm text-muted-foreground">
                Manage your shop and track your sales
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Your shop link:</p>
              <div className="flex items-center gap-2">
                <code className="text-sm font-mono bg-background px-2 py-1 rounded">
                  buylink.ug/shop/{user.shopHandle}
                </code>
                <Button variant="ghost" size="sm" onClick={shareShopLink}>
                  <Share2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-md">
            <div className="bg-background/50 rounded-lg p-md text-center">
              <div className="text-2xl font-bold text-foreground">{products.length}</div>
              <div className="text-xs text-muted-foreground">Total Products</div>
            </div>
            <div className="bg-background/50 rounded-lg p-md text-center">
              <div className="text-2xl font-bold text-success">{activeProducts}</div>
              <div className="text-xs text-muted-foreground">Available</div>
            </div>
            <div className="bg-background/50 rounded-lg p-md text-center">
              <div className="text-2xl font-bold text-warning">{outOfStockProducts}</div>
              <div className="text-xs text-muted-foreground">Out of Stock</div>
            </div>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="space-y-sm">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search your products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 h-12 bg-muted/30 border-0 focus:bg-background"
            />
          </div>
          
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <Select value={selectedTag} onValueChange={setSelectedTag}>
              <SelectTrigger className="w-48 h-10 bg-muted/30 border-0">
                <SelectValue placeholder="Filter by category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {allTags.map(tag => (
                  <SelectItem key={tag} value={tag} className="capitalize">
                    {tag}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedTag !== 'all' && (
              <Badge variant="secondary" className="capitalize">
                {selectedTag}
              </Badge>
            )}
          </div>
        </div>

        {/* Products Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredProducts.map((product) => (
            <Card 
              key={product.id} 
              className={`group overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1 ${
                product.isOutOfStock ? 'opacity-60' : ''
              }`}
            >
              {/* Image */}
              <div 
                className="aspect-square overflow-hidden bg-muted cursor-pointer relative"
                onClick={() => nextImage(product.id, product.images.length)}
              >
                <img
                  src={product.images[currentImageIndex[product.id] || 0]}
                  alt={product.title}
                  className="object-cover w-full h-full transition-transform duration-300 group-hover:scale-110"
                />
                
                {/* Image Counter */}
                {product.images.length > 1 && (
                  <div className="absolute top-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded-full backdrop-blur-sm">
                    {((currentImageIndex[product.id] || 0) + 1)}/{product.images.length}
                  </div>
                )}
                
                {/* Out of Stock Overlay */}
                {product.isOutOfStock && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-sm">
                    <span className="text-white font-bold text-sm">Out of Stock</span>
                  </div>
                )}
                
                {/* Stock Toggle */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleOutOfStock(product.id);
                  }}
                  className="absolute top-2 left-2 p-1 bg-white/90 rounded-full backdrop-blur-sm hover:bg-white transition-colors"
                  title={product.isOutOfStock ? "Mark as available" : "Mark as out of stock"}
                >
                  {product.isOutOfStock ? (
                    <ToggleLeft className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <ToggleRight className="w-4 h-4 text-success" />
                  )}
                </button>
              </div>
              
              <CardContent className="p-3 space-y-2">
                {/* Title and Price */}
                <div className="space-y-1">
                  <h3 className="font-semibold text-sm line-clamp-2 leading-tight text-foreground">
                    {product.title}
                  </h3>
                  <p className="text-lg font-bold text-primary">
                    {product.currency} {parseInt(product.price).toLocaleString()}
                  </p>
                </div>
                
                {/* Views */}
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Eye className="w-3 h-3" />
                  <span>{product.views} views</span>
                </div>
                
                {/* Status Badge */}
                <div className="flex items-center justify-between">
                  <Badge 
                    variant={product.isOutOfStock ? "destructive" : "default"}
                    className="text-xs"
                  >
                    {product.isOutOfStock ? "Out of Stock" : "Available"}
                  </Badge>
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => window.open(product.tiktokUrl, '_blank')}
                    className="h-6 px-2 text-xs"
                  >
                    <Video className="w-3 h-3 mr-1" />
                    TikTok
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* No Results */}
        {filteredProducts.length === 0 && (
          <div className="text-center py-xl">
            <div className="w-20 h-20 bg-muted/50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">No products found</h3>
            <p className="text-muted-foreground">Try adjusting your search or filter criteria</p>
          </div>
        )}

        {/* Add Product CTA */}
        <Card className="border-dashed border-2">
          <CardContent className="p-lg text-center space-y-md">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
              <Plus className="w-8 h-8 text-primary" />
            </div>
            <div className="space-y-sm">
              <h3 className="text-lg font-semibold text-foreground">Add More Products</h3>
              <p className="text-sm text-muted-foreground">
                Post a TikTok video with <span className="font-bold text-primary">#TRACK</span> to automatically add new products
              </p>
            </div>
            <Button variant="primary" size="lg">
              Learn How to Add Products
            </Button>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default SellerDashboard;