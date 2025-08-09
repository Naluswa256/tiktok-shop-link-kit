
import { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { Layout, Header, Button, PageViewCounter } from '@/components/tiktok-commerce';
import { MessageCircle, Share2, TrendingUp, Video, LogIn } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { SubscriptionPrompt } from '@/components/SubscriptionPrompt';
import { TrialExpiryModal } from '@/components/SubscriptionGuard';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { shopApi, ShopData } from '@/lib/api';
import { useShopProducts } from '@/hooks/useProducts';
import { useProductUpdates } from '@/hooks/useProductUpdates';
import { useTrialExpiryMonitor, useSubscriptionTimer } from '@/hooks/useSubscription';

const Shop = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { handle } = useParams<{ handle: string }>();
  const { user, isAuthenticated, token } = useAuth();

  const [showSubscriptionPrompt, setShowSubscriptionPrompt] = useState(false);
  const [showTrialExpiryModal, setShowTrialExpiryModal] = useState(false);
  const [shopData, setShopData] = useState<ShopData | null>(null);
  const [ownerData, setOwnerData] = useState<ShopData | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewCount, setViewCount] = useState<number>(0);
  const [isFirstTimeSignup, setIsFirstTimeSignup] = useState(false);

  const shopHandle = handle || 'unknown';
  const isOwner = isAuthenticated && (user?.tiktokHandle === shopHandle || user?.shopHandle === shopHandle);

  // Hooks for real-time features
  const { data: productsData, isLoading: productsLoading, error: productsError } = useShopProducts(shopHandle);
  const { status: wsStatus } = useProductUpdates(isOwner ? shopHandle : null);

  const { isExpired, isWarning, timeLeft, subscriptionStatus } = useTrialExpiryMonitor();
  const { formatTimeLeft } = useSubscriptionTimer();

  const products = productsData?.data?.products || [];
  const hasProducts = products.length > 0;
  const hasActiveSubscription = subscriptionStatus?.status === 'trial' || subscriptionStatus?.status === 'paid';

  // Check if this is a first-time signup flow (coming from subscription selection)
  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const fromSubscription = urlParams.get('from') === 'subscription';
    const isNewUser = urlParams.get('new') === 'true';
    setIsFirstTimeSignup(fromSubscription && isNewUser);
  }, [location.search]);

  // Monitor trial expiry for owners
  useEffect(() => {
    if (isOwner && isExpired) {
      setShowTrialExpiryModal(true);
    } else if (isOwner && isWarning) {
      // Show warning toast for trial ending soon
      toast.warning(`Trial ending soon: ${timeLeft}`);
    }
  }, [isOwner, isExpired, isWarning, timeLeft]);

  // Fetch shop data based on user status
  const fetchShopData = async () => {
    if (!handle) {
      setLoading(false);
      return;
    }

    try {
      if (isAuthenticated && isOwner && token) {
        // Get both public and owner data for authenticated owners
        const [publicResponse, ownerResponse] = await Promise.all([
          shopApi.getShopByHandle(handle),
          shopApi.getShopByHandleOwner(handle, token)
        ]);

        setShopData(publicResponse.data);
        setOwnerData(ownerResponse.data);

        // Use owner analytics if available
        if (ownerResponse.data.analytics) {
          setViewCount(ownerResponse.data.analytics.total_views || 0);
        } else if (publicResponse.data.viewCount) {
          setViewCount(publicResponse.data.viewCount);
        }

        if (isFirstTimeSignup) {
          toast.success('Welcome to your shop! You now have access to detailed analytics.');
        }
      }
      // Public access (buyers or unauthenticated users)
      else {
        const response = await shopApi.getShopByHandle(handle);
        setShopData(response.data);

        // Update view count from API response
        if (response.data.viewCount) {
          setViewCount(response.data.viewCount);
        }
      }

      // Track the view (for all scenarios)
      await shopApi.trackShopView(handle, {
        referrer: document.referrer,
        userAgent: navigator.userAgent,
      });

    } catch (error) {
      // If shop not found, show basic shop info
      console.log('Shop data not available:', error);
      setShopData({
        shopId: '',
        handle: handle,
        shopLink: `/shop/${handle}`,
        displayName: `@${handle}`,
        profilePhotoUrl: '',
        followerCount: 0,
        isVerified: false,
        subscriptionStatus: 'unknown',
        createdAt: new Date().toISOString(),
      });
    } finally {
      setLoading(false);
    }
  };

  // Fetch shop data on component mount
  useEffect(() => {
    if (handle) {
      fetchShopData();
    }
  }, [handle, isOwner, token, isAuthenticated]);

  // Check for subscription prompt for new users
  useEffect(() => {
    const fromSignup = location.state?.fromSignup;
    const isFirstVisit = !localStorage.getItem('buylink_shop_visited_' + shopHandle);

    if (isOwner && (fromSignup || isFirstVisit) && !hasActiveSubscription) {
      setShowSubscriptionPrompt(true);
      localStorage.setItem('buylink_shop_visited_' + shopHandle, 'true');
    }
  }, [isOwner, hasActiveSubscription, location.state, shopHandle]);

  const handleSubscriptionComplete = () => {
    setShowSubscriptionPrompt(false);
    toast.success('Welcome to your shop! Start posting with #TRACK to add products.');
  };



  return (
    <>
      <Layout
        header={
          <Header
            title={`@${shopHandle}`}
            actions={
              <div className="flex items-center gap-sm">
                <PageViewCounter count={viewCount} />

                {/* Show different actions based on user status */}
                {!isAuthenticated ? (
                  // For non-authenticated users (buyers or potential sellers)
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => navigate(`/login?redirect=${encodeURIComponent(location.pathname)}`)}
                    className="gap-2"
                  >
                    <LogIn className="w-4 h-4" />
                    Sign In
                  </Button>
                ) : isOwner ? (
                  // For authenticated shop owners
                  <div className="flex items-center gap-xs">
                    {ownerData && (
                      <span className="text-xs text-muted-foreground px-2 py-1 bg-primary/10 rounded">
                        Owner View
                      </span>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate('/dashboard')}
                      className="gap-2"
                    >
                      Dashboard
                    </Button>
                  </div>
                ) : (
                  // For authenticated users viewing someone else's shop
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate('/dashboard')}
                    className="gap-2"
                  >
                    My Shop
                  </Button>
                )}

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(window.location.href);
                    toast.success('Shop link copied to clipboard!');
                  }}
                >
                  <Share2 className="w-4 h-4" />
                </Button>
              </div>
            }
          />
        }
      >
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : (
        <div className="space-y-lg">
        {/* Shop Header */}
        <div className="text-center space-y-sm">
          {shopData?.profilePhotoUrl ? (
            <div className="w-20 h-20 mx-auto overflow-hidden rounded-full border-2 border-primary/20">
              <img
                src={shopData.profilePhotoUrl}
                alt={`${shopHandle}'s profile`}
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto border-2 border-primary/20">
              <span className="text-xl font-bold text-primary">
                {shopHandle.charAt(0).toUpperCase()}
              </span>
            </div>
          )}

          <div className="space-y-xs">
            <h1 className="text-xl font-bold text-foreground flex items-center justify-center gap-1">
              {shopData?.displayName ? shopData.displayName : `@${shopHandle}`}
              {shopData?.isVerified && (
                <span className="text-primary text-lg">✓</span>
              )}
            </h1>

            <p className="text-sm text-muted-foreground font-medium">
              TikTok Shop
            </p>

            {/* TikTok Stats */}
            <div className="flex items-center justify-center gap-4 text-sm">
              {shopData?.followerCount && shopData.followerCount > 0 ? (
                <div className="flex items-center gap-1">
                  <span className="font-semibold text-foreground">
                    {shopData.followerCount.toLocaleString()}
                  </span>
                  <span className="text-muted-foreground">followers</span>
                </div>
              ) : null}

              <div className="flex items-center gap-1">
                <span className="font-semibold text-foreground">{products.length}</span>
                <span className="text-muted-foreground">products</span>
              </div>

              <div className="flex items-center gap-1">
                <span className="font-semibold text-foreground">{viewCount}</span>
                <span className="text-muted-foreground">views</span>
              </div>
            </div>

            {/* TikTok Profile Link */}
            <div className="pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(`https://tiktok.com/@${shopHandle}`, '_blank')}
                className="gap-2 text-xs"
              >
                <Video className="w-3 h-3" />
                View TikTok Profile
              </Button>
            </div>
          </div>
        </div>

        {/* Empty State */}
        {!hasProducts && (
          <Card className="mx-auto max-w-md">
            <CardContent className="p-lg text-center space-y-md">
              <div className="w-20 h-20 bg-muted/50 rounded-full flex items-center justify-center mx-auto">
                <Video className="w-8 h-8 text-muted-foreground" />
              </div>

              <div className="space-y-sm">
                <h2 className="text-base font-semibold text-foreground">
                  {isOwner ? "No products yet" : "Shop coming soon"}
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {isOwner ? (
                    <>
                      Post a TikTok video with <span className="font-semibold text-primary">#TRACK</span> to generate your first listing!
                    </>
                  ) : (
                    <>
                      @{shopHandle} hasn't added any products yet. Check back soon or follow them on TikTok for updates!
                    </>
                  )}
                </p>
              </div>

              {isOwner && (
                <div className="bg-accent/10 rounded-ds-md p-md space-y-sm">
                  <div className="flex items-center justify-center gap-2 text-accent">
                    <TrendingUp className="w-4 h-4" />
                    <span className="text-sm font-medium">How it works:</span>
                  </div>
                  <ol className="text-xs text-muted-foreground space-y-1">
                    <li>1. Post your product on TikTok</li>
                    <li>2. Add #TRACK in your caption</li>
                    <li>3. We'll auto-generate your product card</li>
                    <li>4. Share your shop link anywhere!</li>
                  </ol>
                </div>
              )}

              {isOwner ? (
                <Button
                  variant="primary"
                  size="block"
                  onClick={() => window.open(`https://tiktok.com/@${shopHandle}`, '_blank')}
                >
                  Post on TikTok
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="block"
                  onClick={() => window.open(`https://tiktok.com/@${shopHandle}`, '_blank')}
                  className="gap-2"
                >
                  <Video className="w-4 h-4" />
                  Follow on TikTok
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* Owner Analytics Section (only for authenticated owners) */}
        {isOwner && ownerData?.analytics && (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-lg">
              <div className="space-y-md">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-primary" />
                  <h3 className="text-base font-semibold text-foreground">Shop Analytics</h3>
                  {isFirstTimeSignup && (
                    <span className="text-xs bg-accent text-accent-foreground px-2 py-1 rounded-full">
                      Welcome!
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-md">
                  <div className="text-center p-sm bg-background/50 rounded-ds-sm">
                    <div className="text-lg font-bold text-foreground">
                      {ownerData.analytics.views_today}
                    </div>
                    <div className="text-xs text-muted-foreground">Today</div>
                  </div>
                  <div className="text-center p-sm bg-background/50 rounded-ds-sm">
                    <div className="text-lg font-bold text-foreground">
                      {ownerData.analytics.views_this_week}
                    </div>
                    <div className="text-xs text-muted-foreground">This Week</div>
                  </div>
                  <div className="text-center p-sm bg-background/50 rounded-ds-sm">
                    <div className="text-lg font-bold text-foreground">
                      {ownerData.analytics.views_this_month}
                    </div>
                    <div className="text-xs text-muted-foreground">This Month</div>
                  </div>
                  <div className="text-center p-sm bg-background/50 rounded-ds-sm">
                    <div className="text-lg font-bold text-foreground">
                      {ownerData.analytics.total_views}
                    </div>
                    <div className="text-xs text-muted-foreground">All Time</div>
                  </div>
                </div>

                {isFirstTimeSignup && (
                  <div className="bg-accent/10 rounded-ds-md p-md space-y-sm">
                    <div className="flex items-center gap-2 text-accent">
                      <span className="text-sm font-medium">🎉 Your shop is now live!</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Start posting TikTok videos with #TRACK to add products to your shop.
                      Share your shop link to start getting visitors!
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Sign Up Prompt for Non-Authenticated Users */}
        {!isAuthenticated && (
          <Card className="mx-auto max-w-md border-primary/20 bg-primary/5">
            <CardContent className="p-lg text-center space-y-md">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                <LogIn className="w-6 h-6 text-primary" />
              </div>

              <div className="space-y-sm">
                <h3 className="text-base font-semibold text-foreground">
                  Are you {shopData?.displayName || `@${shopHandle}`}?
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  If this is your TikTok handle, sign in to access your shop dashboard and analytics.
                </p>
                <p className="text-xs text-muted-foreground">
                  Or create your own shop and start selling from your TikTok videos!
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <Button
                  variant="primary"
                  size="block"
                  onClick={() => navigate(`/login?redirect=${encodeURIComponent(location.pathname)}`)}
                  className="gap-2"
                >
                  <LogIn className="w-4 h-4" />
                  Sign In as @{shopHandle}
                </Button>
                <div className="text-xs text-muted-foreground my-2">or</div>
                <Button
                  variant="outline"
                  size="block"
                  onClick={() => navigate('/')}
                  className="gap-2"
                >
                  Create My Own Shop
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Products Section */}
        {hasActiveSubscription && (
          <Card>
            <CardContent className="p-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-foreground">Products</h3>
                  {isOwner && wsStatus.connected && (
                    <div className="flex items-center gap-2 text-xs text-success">
                      <div className="w-2 h-2 bg-success rounded-full animate-pulse"></div>
                      Live updates
                    </div>
                  )}
                </div>

                {productsLoading ? (
                  <div className="text-center py-8">
                    <div className="text-sm text-muted-foreground">Loading products...</div>
                  </div>
                ) : productsError ? (
                  <div className="text-center py-8">
                    <div className="text-sm text-destructive">Failed to load products</div>
                  </div>
                ) : hasProducts ? (
                  <div className="grid grid-cols-2 gap-4">
                    {products.map((product) => (
                      <div key={product.video_id} className="border rounded-lg overflow-hidden">
                        <div className="aspect-square bg-muted">
                          <img
                            src={product.primary_thumbnail.thumbnail_url}
                            alt={product.title}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="p-3 space-y-2">
                          <h4 className="text-sm font-medium text-foreground line-clamp-2">
                            {product.title}
                          </h4>
                          {product.price && (
                            <p className="text-sm font-semibold text-primary">
                              UGX {product.price.toLocaleString()}
                            </p>
                          )}
                          {product.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {product.tags.slice(0, 2).map((tag) => (
                                <span
                                  key={tag}
                                  className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 space-y-2">
                    <div className="text-sm text-muted-foreground">No products yet</div>
                    {isOwner && (
                      <div className="text-xs text-muted-foreground">
                        Post TikTok videos with #TRACK to add products
                      </div>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Contact Section */}
        <Card>
          <CardContent className="p-lg">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">
                  Ready to buy?
                </p>
                <p className="text-xs text-muted-foreground">
                  Chat directly with the seller
                </p>
              </div>
              <Button variant="accent" className="gap-2">
                <MessageCircle className="w-4 h-4" />
                WhatsApp
              </Button>
            </div>
          </CardContent>
        </Card>
        </div>
      )}
    </Layout>

    {/* Subscription Prompt Modal */}
    <SubscriptionPrompt
      isOpen={showSubscriptionPrompt}
      onClose={() => setShowSubscriptionPrompt(false)}
      handle={shopHandle}
      onSubscribe={handleSubscriptionComplete}
    />

    {/* Trial Expiry Modal */}
    <TrialExpiryModal
      isOpen={showTrialExpiryModal}
      onClose={() => setShowTrialExpiryModal(false)}
      onSubscribe={() => {
        setShowTrialExpiryModal(false);
        navigate('/subscription', {
          state: {
            returnTo: location.pathname,
            reason: 'trial_expired'
          }
        });
      }}
      timeLeft={formatTimeLeft}
    />
  </>
  );
};

export default Shop;
