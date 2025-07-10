
import React, { useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { Layout, Header, Button, PageViewCounter } from '@/components/tiktok-commerce';
import { MessageCircle, Share2, Search, Eye, ExternalLink, ToggleLeft, ToggleRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

// Mock product data with tags and multiple images
const mockProducts = [
  {
    id: '1',
    title: 'Designer High Heels Collection',
    price: '55000',
    currency: 'UGX',
    tags: ['shoes', 'heels', 'fashion'],
    sizes: ['37', '38', '39', '40', '41'],
    images: [
      'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=300&h=300&fit=crop',
      'https://images.unsplash.com/photo-1549298916-b41d501d3772?w=300&h=300&fit=crop',
      'https://images.unsplash.com/photo-1562183241-b937e95585b6?w=300&h=300&fit=crop'
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
      'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=300&h=300&fit=crop',
      'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=300&h=300&fit=crop'
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
      'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=300&h=300&fit=crop',
      'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?w=300&h=300&fit=crop'
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
      'https://images.unsplash.com/photo-1611652022419-a9419f74343d?w=300&h=300&fit=crop'
    ],
    tiktokUrl: 'https://tiktok.com/@nalu-fashion/video/126',
    isOutOfStock: false,
    views: 67
  }
];

const ProductCatalog = () => {
  const { handle } = useParams<{ handle: string }>();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [products, setProducts] = useState(mockProducts);
  const [currentImageIndex, setCurrentImageIndex] = useState<Record<string, number>>({});
  
  // Check if this is the seller's own page (mock logic)
  const isOwner = handle === 'nalu-fashion'; // In real app, check authentication
  
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
      const matchesTag = !selectedTag || product.tags.includes(selectedTag);
      return matchesSearch && matchesTag;
    });
  }, [products, searchTerm, selectedTag]);

  // Group products by tags
  const groupedProducts = useMemo(() => {
    const groups: Record<string, typeof products> = {};
    
    if (selectedTag) {
      groups[selectedTag] = filteredProducts.filter(p => p.tags.includes(selectedTag));
    } else {
      filteredProducts.forEach(product => {
        product.tags.forEach(tag => {
          if (!groups[tag]) groups[tag] = [];
          if (!groups[tag].find(p => p.id === product.id)) {
            groups[tag].push(product);
          }
        });
      });
    }
    
    return groups;
  }, [filteredProducts, selectedTag]);

  const toggleOutOfStock = (productId: string) => {
    setProducts(prev => prev.map(product => 
      product.id === productId 
        ? { ...product, isOutOfStock: !product.isOutOfStock }
        : product
    ));
  };

  const handleWhatsAppMessage = (product: typeof mockProducts[0]) => {
    const message = `Hi! I'm interested in "${product.title}" for ${product.currency} ${product.price}. Is it still available?`;
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
          <div className="text-center space-y-sm">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
              <span className="text-lg font-bold text-primary">
                {handle?.charAt(0).toUpperCase()}
              </span>
            </div>
            <h1 className="text-lg font-semibold text-foreground">
              @{handle}'s Shop
            </h1>
            <p className="text-sm text-muted-foreground">
              tiktokshop.ug/shop/{handle}
            </p>
          </div>

          {/* Empty State */}
          <Card className="mx-auto max-w-md">
            <CardContent className="p-lg text-center space-y-md">
              <div className="w-20 h-20 bg-muted/50 rounded-full flex items-center justify-center mx-auto">
                <Eye className="w-8 h-8 text-muted-foreground" />
              </div>
              
              <div className="space-y-sm">
                <h2 className="text-base font-semibold text-foreground">
                  No products yet
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Post a TikTok video with <span className="font-semibold text-primary">#TRACK</span> to automatically list your first product!
                </p>
              </div>

              <Button variant="primary" size="block">
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
        <div className="text-center space-y-sm">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
            <span className="text-lg font-bold text-primary">
              {handle?.charAt(0).toUpperCase()}
            </span>
          </div>
          <h1 className="text-lg font-semibold text-foreground">
            @{handle}'s Shop
          </h1>
          <p className="text-sm text-muted-foreground">
            tiktokshop.ug/shop/{handle}
          </p>
        </div>

        {/* Search and Filter */}
        <div className="space-y-sm">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          
          {/* Tag Filter */}
          <div className="flex gap-2 overflow-x-auto pb-2">
            <Button
              variant={selectedTag === null ? "primary" : "ghost"}
              size="sm"
              onClick={() => setSelectedTag(null)}
              className="whitespace-nowrap"
            >
              All
            </Button>
            {allTags.map(tag => (
              <Button
                key={tag}
                variant={selectedTag === tag ? "primary" : "ghost"}
                size="sm"
                onClick={() => setSelectedTag(tag === selectedTag ? null : tag)}
                className="whitespace-nowrap"
              >
                {tag}
              </Button>
            ))}
          </div>
        </div>

        {/* Products by Category */}
        {Object.entries(groupedProducts).map(([tag, tagProducts]) => (
          <div key={tag} className="space-y-md">
            <h2 className="text-lg font-semibold text-foreground capitalize flex items-center gap-2">
              {tag}
              <Badge variant="secondary" className="text-xs">
                {tagProducts.length}
              </Badge>
            </h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-md">
              {tagProducts.map((product) => (
                <Card 
                  key={product.id} 
                  className={`overflow-hidden transition-all hover:shadow-elevation-md ${
                    product.isOutOfStock ? 'opacity-60' : ''
                  }`}
                >
                  {/* Image Gallery */}
                  <div 
                    className="aspect-square overflow-hidden bg-muted cursor-pointer relative"
                    onClick={() => nextImage(product.id, product.images.length)}
                  >
                    <img
                      src={product.images[currentImageIndex[product.id] || 0]}
                      alt={product.title}
                      className="object-cover w-full h-full transition-transform hover:scale-105"
                    />
                    {product.images.length > 1 && (
                      <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
                        {((currentImageIndex[product.id] || 0) + 1)}/{product.images.length}
                      </div>
                    )}
                    {product.isOutOfStock && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <span className="text-white font-semibold">Out of Stock</span>
                      </div>
                    )}
                  </div>
                  
                  <CardContent className="p-md space-y-sm">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1 flex-1">
                        <h3 className="font-semibold text-base line-clamp-2 leading-tight">
                          {product.title}
                        </h3>
                        <p className="text-lg font-bold text-primary">
                          {product.currency} {parseInt(product.price).toLocaleString()}
                        </p>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Eye className="w-3 h-3" />
                          <span>{product.views} views</span>
                        </div>
                      </div>
                      
                      {isOwner && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleOutOfStock(product.id)}
                          className="ml-2"
                        >
                          {product.isOutOfStock ? (
                            <ToggleLeft className="w-4 h-4 text-muted-foreground" />
                          ) : (
                            <ToggleRight className="w-4 h-4 text-success" />
                          )}
                        </Button>
                      )}
                    </div>
                    
                    {/* Sizes */}
                    {product.sizes.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {product.sizes.map(size => (
                          <Badge key={size} variant="outline" className="text-xs">
                            {size}
                          </Badge>
                        ))}
                      </div>
                    )}
                    
                    {/* Tags */}
                    <div className="flex flex-wrap gap-1">
                      {product.tags.map(tag => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          #{tag}
                        </Badge>
                      ))}
                    </div>
                    
                    {/* Action Buttons */}
                    <div className="flex gap-2 pt-sm">
                      <Button
                        variant="accent"
                        size="block"
                        onClick={() => handleWhatsAppMessage(product)}
                        disabled={product.isOutOfStock}
                        className="flex-1"
                      >
                        <MessageCircle className="w-4 h-4" />
                        Buy on WhatsApp
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => window.open(product.tiktokUrl, '_blank')}
                        className="px-3"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}

        {filteredProducts.length === 0 && (
          <div className="text-center py-xl">
            <p className="text-muted-foreground">No products found matching your search.</p>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default ProductCatalog;
