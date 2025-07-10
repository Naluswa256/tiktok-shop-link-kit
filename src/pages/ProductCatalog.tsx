
import React, { useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { Layout, Header, Button, PageViewCounter } from '@/components/tiktok-commerce';
import { MessageCircle, Share2, Search, Eye, Video, ToggleLeft, ToggleRight, Filter, ChevronDown } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// Mock product data with enhanced visual appeal
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
  },
  {
    id: '5',
    title: 'Casual Sneakers',
    price: '75000',
    currency: 'UGX',
    tags: ['shoes', 'sneakers', 'casual'],
    sizes: ['38', '39', '40', '41', '42'],
    images: [
      'https://images.unsplash.com/photo-1549298916-b41d501d3772?w=400&h=400&fit=crop'
    ],
    tiktokUrl: 'https://tiktok.com/@nalu-fashion/video/127',
    isOutOfStock: false,
    views: 98
  },
  {
    id: '6',
    title: 'Evening Clutch',
    price: '35000',
    currency: 'UGX',
    tags: ['bags', 'accessories', 'evening'],
    sizes: ['One Size'],
    images: [
      'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400&h=400&fit=crop'
    ],
    tiktokUrl: 'https://tiktok.com/@nalu-fashion/video/128',
    isOutOfStock: false,
    views: 123
  }
];

const ProductCatalog = () => {
  const { handle } = useParams<{ handle: string }>();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTag, setSelectedTag] = useState<string>('all');
  const [products, setProducts] = useState(mockProducts);
  const [currentImageIndex, setCurrentImageIndex] = useState<Record<string, number>>({});
  
  // Check if this is the seller's own page (mock logic)
  const isOwner = handle === 'nalu-fashion';
  
  const hasProducts = products.length > 0;
  const totalViews = products.reduce((sum, product) => sum + product.views, 0);

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
  };

  const handleWhatsAppMessage = (product: typeof mockProducts[0]) => {
    const message = `Hi! I'm interested in "${product.title}" for ${product.currency} ${parseInt(product.price).toLocaleString()}. Is it still available?`;
    const whatsappUrl = `https://wa.me/256700000000?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  const nextImage = (productId: string, maxImages: number) => {
    setCurrentImageIndex(prev => ({
      ...prev,
      [productId]: ((prev[productId] || 0) + 1) % maxImages
    }));
  };

  if (!hasProducts) {
    return (
      <Layout
        header={
          <Header 
            title={`@${handle}`}
            actions={
              <div className="flex items-center gap-sm">
                <PageViewCounter count={0} />
                <Button variant="ghost" size="sm">
                  <Share2 className="w-4 h-4" />
                </Button>
              </div>
            }
          />
        }
      >
        <div className="space-y-lg">
          {/* Shop Header */}
          <div className="text-center space-y-sm bg-gradient-to-br from-primary/5 to-accent/5 py-xl rounded-lg">
            <div className="w-20 h-20 bg-gradient-to-br from-primary to-accent rounded-full flex items-center justify-center mx-auto shadow-lg">
              <span className="text-2xl font-bold text-white">
                {handle?.charAt(0).toUpperCase()}
              </span>
            </div>
            <h1 className="text-2xl font-bold text-foreground">
              @{handle}'s Shop
            </h1>
            <p className="text-sm text-muted-foreground font-mono bg-muted/50 px-3 py-1 rounded-full inline-block">
              tiktokshop.ug/shop/{handle}
            </p>
          </div>

          {/* Empty State */}
          <Card className="mx-auto max-w-md border-dashed border-2">
            <CardContent className="p-xl text-center space-y-lg">
              <div className="w-24 h-24 bg-gradient-to-br from-muted to-muted/50 rounded-2xl flex items-center justify-center mx-auto">
                <Eye className="w-10 h-10 text-muted-foreground" />
              </div>
              
              <div className="space-y-sm">
                <h2 className="text-xl font-bold text-foreground">
                  No products yet
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Post a TikTok video with <span className="font-bold text-primary">#TRACK</span> to automatically list your first product!
                </p>
              </div>

              <Button variant="primary" size="lg" className="w-full">
                Learn How It Works
              </Button>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout
      header={
        <Header 
          title={`@${handle}`}
          actions={
            <div className="flex items-center gap-sm">
              <PageViewCounter count={totalViews} />
              <Button variant="ghost" size="sm">
                <Share2 className="w-4 h-4" />
              </Button>
            </div>
          }
        />
      }
    >
      <div className="space-y-lg">
        {/* Shop Header */}
        <div className="text-center space-y-sm bg-gradient-to-br from-primary/5 to-accent/5 py-lg rounded-lg">
          <div className="w-16 h-16 bg-gradient-to-br from-primary to-accent rounded-full flex items-center justify-center mx-auto shadow-lg">
            <span className="text-xl font-bold text-white">
              {handle?.charAt(0).toUpperCase()}
            </span>
          </div>
          <h1 className="text-xl font-bold text-foreground">
            @{handle}'s Shop
          </h1>
          <p className="text-xs text-muted-foreground font-mono bg-muted/50 px-2 py-1 rounded-full inline-block">
            tiktokshop.ug/shop/{handle}
          </p>
          <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground">
            <span>{filteredProducts.length} Products</span>
            <span>•</span>
            <span>{totalViews} Total Views</span>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="space-y-sm">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 h-12 bg-muted/30 border-0 focus:bg-background"
            />
          </div>
          
          {/* Tag Filter Dropdown */}
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
                
                {/* Owner Toggle */}
                {isOwner && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleOutOfStock(product.id);
                    }}
                    className="absolute top-2 left-2 p-1 bg-white/90 rounded-full backdrop-blur-sm hover:bg-white transition-colors"
                  >
                    {product.isOutOfStock ? (
                      <ToggleLeft className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <ToggleRight className="w-4 h-4 text-success" />
                    )}
                  </button>
                )}
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
                
                {/* Sizes */}
                {product.sizes.length > 0 && product.sizes[0] !== 'One Size' && (
                  <div className="flex flex-wrap gap-1">
                    {product.sizes.slice(0, 3).map(size => (
                      <Badge key={size} variant="outline" className="text-xs px-1 py-0">
                        {size}
                      </Badge>
                    ))}
                    {product.sizes.length > 3 && (
                      <Badge variant="outline" className="text-xs px-1 py-0">
                        +{product.sizes.length - 3}
                      </Badge>
                    )}
                  </div>
                )}
                
                {/* TikTok Link */}
                <div className="bg-muted/50 rounded-md p-2 text-xs">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Video className="w-3 h-3" />
                    <span className="font-medium">TikTok Video</span>
                  </div>
                  <button
                    onClick={() => window.open(product.tiktokUrl, '_blank')}
                    className="text-primary hover:text-primary/80 font-medium text-left line-clamp-1"
                  >
                    Watch the original video of this product
                  </button>
                </div>
                
                {/* Action Button */}
                <Button
                  variant="accent"
                  size="sm"
                  onClick={() => handleWhatsAppMessage(product)}
                  disabled={product.isOutOfStock}
                  className="w-full h-8 text-xs font-semibold"
                >
                  <MessageCircle className="w-3 h-3" />
                  Buy on WhatsApp
                </Button>
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
      </div>
    </Layout>
  );
};

export default ProductCatalog;
