import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Layout, Button } from '@/components/tiktok-commerce';
import { ArrowLeft, MessageCircle, Share2, Video } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { WhatsAppPrompt, useWhatsAppPrompt } from '@/components/WhatsAppPrompt';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { shopApi, ShopData, AssembledProduct } from '@/lib/api';
import { useProduct } from '@/hooks/useProducts';

const ProductDetail = () => {
  const { handle, videoId } = useParams<{ handle: string; videoId: string }>();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();

  const [shopData, setShopData] = useState<ShopData | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [sellerWhatsAppNumber, setSellerWhatsAppNumber] = useState<string | null>(null);

  const shopHandle = handle || 'unknown';
  const isOwner = isAuthenticated && (user?.tiktokHandle === shopHandle || user?.shopHandle === shopHandle);

  // Use the product hook
  const { data: productData, isLoading, error } = useProduct(shopHandle, videoId || '');
  const product = productData?.data;

  // WhatsApp prompt state
  const { isOpen: isWhatsAppPromptOpen, openPrompt: openWhatsAppPrompt, closePrompt: closeWhatsAppPrompt } = useWhatsAppPrompt();

  useEffect(() => {
    const fetchShopData = async () => {
      if (!handle) return;

      try {
        const shopResponse = await shopApi.getShopByHandle(handle);
        setShopData(shopResponse.data);
      } catch (error) {
        console.error('Failed to fetch shop data:', error);
      }
    };

    fetchShopData();
  }, [handle]);

  // Handle product error
  useEffect(() => {
    if (error) {
      console.error('Failed to fetch product:', error);
      toast.error('Failed to load product details');
      navigate(`/shop/${handle}`);
    }
  }, [error, handle, navigate]);

  const handleWhatsAppContact = () => {
    if (!product) return;

    const productUrl = window.location.href;
    const message = `Hi! I'm interested in this product:\n\n📦 *${product.title}*\n${product.price ? `💰 UGX ${product.price.toLocaleString()}` : '💬 Price on request'}\n\n🔗 View product: ${productUrl}\n\nCan you tell me more about it?`;
    const phoneNumber = shopData?.phoneNumber || sellerWhatsAppNumber;

    if (phoneNumber) {
      // Use seller's WhatsApp number and send message directly
      const whatsappUrl = `https://api.whatsapp.com/send?phone=${phoneNumber.replace('+', '')}&text=${encodeURIComponent(message)}`;
      window.open(whatsappUrl, '_blank');
    } else if (isOwner) {
      // Show prompt for owner to add WhatsApp number
      openWhatsAppPrompt('modal');
    } else {
      // Fallback: open WhatsApp with just the message
      const fallbackMessage = `${message}\n\nContact @${shopHandle} for more details`;
      const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(fallbackMessage)}`;
      window.open(whatsappUrl, '_blank');
      toast.info('Seller hasn\'t added their WhatsApp number yet. You can still share this message!');
    }
  };

  const handleShare = async () => {
    const shareData = {
      title: product?.title || 'Check out this product',
      text: `${product?.title} - Available on @${shopHandle}'s shop`,
      url: window.location.href,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (error) {
        // User cancelled sharing
      }
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(window.location.href);
      toast.success('Product link copied to clipboard!');
    }
  };

  const nextImage = () => {
    if (!product?.thumbnails) return;
    setCurrentImageIndex((prev) => 
      prev === product.thumbnails.length - 1 ? 0 : prev + 1
    );
  };

  const prevImage = () => {
    if (!product?.thumbnails) return;
    setCurrentImageIndex((prev) => 
      prev === 0 ? product.thumbnails.length - 1 : prev - 1
    );
  };

  if (isLoading) {
    return (
      <Layout
        header={
          <div className="flex items-center justify-between h-16 px-4">
            <Button variant="ghost" size="sm" onClick={() => navigate(`/shop/${handle}`)}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <h1 className="text-lg font-semibold">Loading...</h1>
            <div className="w-10" />
          </div>
        }
      >
        <div className="space-y-4 p-4">
          <div className="aspect-square bg-muted animate-pulse rounded-lg" />
          <div className="space-y-2">
            <div className="h-6 bg-muted animate-pulse rounded" />
            <div className="h-4 bg-muted animate-pulse rounded w-1/2" />
          </div>
        </div>
      </Layout>
    );
  }

  if (!product) {
    return (
      <Layout
        header={
          <div className="flex items-center justify-between h-16 px-4">
            <Button variant="ghost" size="sm" onClick={() => navigate(`/shop/${handle}`)}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <h1 className="text-lg font-semibold">Product Not Found</h1>
            <div className="w-10" />
          </div>
        }
      >
        <div className="text-center p-8">
          <p className="text-muted-foreground">Product not found</p>
        </div>
      </Layout>
    );
  }

  const currentThumbnail = product.thumbnails?.[currentImageIndex] || product.primary_thumbnail;

  return (
    <>
      <Layout
        header={
          <div className="flex items-center justify-between h-16 px-4">
            <Button variant="ghost" size="sm" onClick={() => navigate(`/shop/${handle}`)}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <h1 className="text-lg font-semibold truncate mx-4">{product.title}</h1>
            <Button variant="ghost" size="sm" onClick={handleShare}>
              <Share2 className="w-4 h-4" />
            </Button>
          </div>
        }
      >
        <div className="space-y-6 p-4">
          {/* Product Images */}
          <Card>
            <CardContent className="p-0">
              <div className="relative aspect-square bg-muted">
                <img
                  src={currentThumbnail.thumbnail_url}
                  alt={product.title}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQwMCIgdmlld0JveD0iMCAwIDQwMCA0MDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSI0MDAiIGhlaWdodD0iNDAwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0yMDAgMTAwQzE2MS4zIDEwMCAxMzAgMTMxLjMgMTMwIDE3MFMxNjEuMyAyNDAgMjAwIDI0MFMyNzAgMjA4LjcgMjcwIDE3MFMyMzguNyAxMDAgMjAwIDEwMFpNMjAwIDIxMEMxNzcuOSAyMTAgMTYwIDE5Mi4xIDE2MCAxNzBTMTc3LjkgMTMwIDIwMCAxMzBTMjQwIDE0Ny45IDI0MCAxNzBTMjIyLjEgMjEwIDIwMCAyMTBaIiBmaWxsPSIjOUI5QkEzIi8+CjxwYXRoIGQ9Ik0zMDAgMzAwSDEwMFYzMzBIMzAwVjMwMFoiIGZpbGw9IiM5QjlCQTMiLz4KPC9zdmc+';
                  }}
                  onClick={nextImage}
                />
                
                {/* Image Navigation */}
                {product.thumbnails && product.thumbnails.length > 1 && (
                  <>
                    <button
                      onClick={prevImage}
                      className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 text-white p-2 rounded-full"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                    <button
                      onClick={nextImage}
                      className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 text-white p-2 rounded-full"
                    >
                      <ArrowLeft className="w-4 h-4 rotate-180" />
                    </button>
                    
                    {/* Image Indicators */}
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                      {product.thumbnails.map((_, index) => (
                        <button
                          key={index}
                          onClick={() => setCurrentImageIndex(index)}
                          className={`w-2 h-2 rounded-full ${
                            index === currentImageIndex ? 'bg-white' : 'bg-white/50'
                          }`}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Product Info */}
          <Card>
            <CardContent className="p-6 space-y-4">
              <div>
                <h1 className="text-xl font-bold text-foreground mb-2">{product.title}</h1>
                
                {/* Price */}
                <div className="mb-4">
                  {product.price ? (
                    <p className="text-2xl font-bold text-primary">
                      UGX {product.price.toLocaleString()}
                    </p>
                  ) : (
                    <p className="text-lg text-muted-foreground italic">
                      DM seller for price
                    </p>
                  )}
                </div>

                {/* Tags */}
                {product.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {product.tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Stats */}
                <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                  <div className="flex items-center gap-1">
                    <Video className="w-4 h-4" />
                    <span>TikTok Product</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span>ID: {product.video_id}</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3">
                <Button
                  variant="primary"
                  size="lg"
                  onClick={handleWhatsAppContact}
                  className="w-full gap-2"
                >
                  <MessageCircle className="w-5 h-5" />
                  <span className="hidden sm:inline">Contact Seller on WhatsApp</span>
                  <span className="sm:hidden">WhatsApp Seller</span>
                </Button>

                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => window.open(`https://www.tiktok.com/@${shopHandle}/video/${product.video_id}`, '_blank')}
                  className="w-full gap-2"
                >
                  <Video className="w-5 h-5" />
                  Watch TikTok Video
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Seller Info */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-foreground">Sold by</h3>
                  <p className="text-sm text-muted-foreground">@{shopHandle}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/shop/${handle}`)}
                >
                  View Shop
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </Layout>

      {/* WhatsApp Prompt Modal */}
      {isWhatsAppPromptOpen && (
        <WhatsAppPrompt
          onClose={closeWhatsAppPrompt}
          onSuccess={(phoneNumber) => {
            setSellerWhatsAppNumber(phoneNumber);
            toast.success('WhatsApp number added! Customers can now contact you directly.');
          }}
        />
      )}
    </>
  );
};

export default ProductDetail;
