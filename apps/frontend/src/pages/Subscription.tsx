
import { useNavigate, useLocation } from 'react-router-dom';
import { Layout, Header, Button } from '@/components/tiktok-commerce';
import { Check, ArrowLeft, Clock, Loader2, ExternalLink } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { useSubscriptionStatus, useSubscribe, useSubscriptionTimer } from '@/hooks/useSubscription';
import { useAuth } from '@/contexts/AuthContext';

const Subscription = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { isLoading: statusLoading } = useSubscriptionStatus();
  const { mutate: subscribe, isPending: isSubscribing } = useSubscribe();
  const { formatTimeLeft, subscriptionStatus } = useSubscriptionTimer();

  // Get return path and reason from navigation state
  const returnTo = location.state?.returnTo || `/shop/${user?.shopHandle}`;
  const reason = location.state?.reason;
  const message = location.state?.message;
  const shopLink = location.state?.shopLink;
  const isNewAccount = reason === 'new_account';

  const handleSubscribe = () => {
    subscribe(undefined, {
      onSuccess: () => {
        // Navigate back to the return path
        navigate(returnTo, { replace: true });
      },
    });
  };

  const handleGoBack = () => {
    // Only allow going back if subscription is not expired
    if (subscriptionStatus?.status !== 'expired') {
      navigate(returnTo);
    } else {
      navigate('/');
    }
  };

  // Show loading state while checking subscription
  if (statusLoading) {
    return (
      <Layout
        header={<Header title="Subscription" />}
      >
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="text-center space-y-4">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
            <p className="text-sm text-muted-foreground">Loading subscription details...</p>
          </div>
        </div>
      </Layout>
    );
  }

  const isExpired = subscriptionStatus?.status === 'expired';
  const isTrial = subscriptionStatus?.status === 'trial';
  const isPaid = subscriptionStatus?.status === 'paid';

  return (
    <Layout
      header={
        <Header
          title="Subscription"
          actions={
            !isExpired && (
              <Button variant="ghost" size="sm" onClick={handleGoBack}>
                <ArrowLeft className="w-4 h-4" />
                Back
              </Button>
            )
          }
        />
      }
    >
      <div className="max-w-md mx-auto space-y-6 p-4">
        {/* Welcome Message for New Accounts */}
        {isNewAccount && (
          <div className="bg-success/10 border border-success/20 rounded-lg p-4 text-center space-y-3">
            <div>
              <h2 className="text-lg font-semibold text-success mb-2">🎉 Welcome to TikTok Commerce Hub!</h2>
              <p className="text-sm text-success-foreground">{message}</p>
            </div>
            {shopLink && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Your shop is ready at:</p>
                <div className="flex items-center justify-center gap-2">
                  <code className="text-xs bg-muted px-2 py-1 rounded">{shopLink}</code>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => window.open(shopLink, '_blank')}
                    className="h-6 w-6 p-0"
                  >
                    <ExternalLink className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Status Message for Other Cases */}
        {message && !isNewAccount && (
          <div className="bg-warning/10 border border-warning/20 rounded-lg p-4 text-center">
            <p className="text-sm text-warning-foreground">{message}</p>
          </div>
        )}

        {/* Current Status */}
        {subscriptionStatus && (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">Current Status</p>
                  <p className="text-xs text-muted-foreground capitalize">
                    {subscriptionStatus.status}
                    {formatTimeLeft && ` • ${formatTimeLeft}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {isTrial && <Clock className="w-4 h-4 text-warning" />}
                  {isPaid && <Check className="w-4 h-4 text-success" />}
                  {isExpired && <span className="text-destructive text-sm">⚠️</span>}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-foreground">
            {isNewAccount
              ? 'Choose Your Plan'
              : isPaid
              ? 'Premium Active'
              : isExpired
              ? 'Subscription Required'
              : 'Upgrade to Premium'
            }
          </h1>
          <p className="text-muted-foreground">
            {isNewAccount
              ? 'Start with a 7-day free trial, then choose the plan that works for you'
              : isPaid
              ? 'You have access to all premium features'
              : isExpired
              ? 'Your subscription has expired. Renew to continue accessing your shop.'
              : 'Unlock unlimited products and advanced analytics'
            }
          </p>
        </div>

        <Card className="overflow-hidden">
          <CardContent className="p-6 space-y-6">
            {!isPaid ? (
              <>
                <div className="text-center space-y-4">
                  <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                    <span className="text-2xl font-bold text-primary">₵</span>
                  </div>

                  <div className="space-y-2">
                    <div className="text-3xl font-bold text-foreground">
                      UGX 10,000
                      <span className="text-sm font-normal text-muted-foreground">/month</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Everything you need to sell on TikTok
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Check className="w-4 h-4 text-success" />
                    <span>Auto-generate products from TikTok videos</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Check className="w-4 h-4 text-success" />
                    <span>Real-time product updates</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Check className="w-4 h-4 text-success" />
                    <span>WhatsApp integration for easy selling</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Check className="w-4 h-4 text-success" />
                    <span>Live page view analytics</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Check className="w-4 h-4 text-success" />
                    <span>Shareable shop link</span>
                  </div>
                </div>

                {isNewAccount ? (
                  <div className="space-y-3">
                    <Button
                      variant="outline"
                      size="lg"
                      onClick={() => navigate(returnTo)}
                      className="w-full"
                    >
                      Continue with Free Trial (7 days)
                    </Button>

                    <Button
                      variant="primary"
                      size="lg"
                      onClick={handleSubscribe}
                      disabled={isSubscribing}
                      className="w-full"
                    >
                      {isSubscribing ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          Processing...
                        </>
                      ) : (
                        'Subscribe Now & Save'
                      )}
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="primary"
                    size="lg"
                    onClick={handleSubscribe}
                    disabled={isSubscribing}
                    className="w-full"
                  >
                    {isSubscribing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        Processing...
                      </>
                    ) : (
                      `${isExpired ? 'Renew' : 'Subscribe'} Now`
                    )}
                  </Button>
                )}

                <p className="text-xs text-muted-foreground text-center">
                  {isNewAccount
                    ? 'Start your free trial now • Upgrade anytime • No setup fees'
                    : `Cancel anytime • No setup fees • ${isTrial ? 'Continue trial' : '7-day free trial'}`
                  }
                </p>
              </>
            ) : (
              <div className="text-center space-y-md">
                <div className="w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mx-auto">
                  <Check className="w-8 h-8 text-success" />
                </div>
                
                <div className="space-y-sm">
                  <h2 className="text-lg font-semibold text-success">
                    Welcome to BuyLink UG!
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Your subscription is active. Start posting TikTok videos with #TRACK to generate your first products.
                  </p>
                </div>

                <div className="bg-muted/50 rounded-ds-md p-md">
                  <p className="text-xs text-muted-foreground">
                    Next: Share your shop link and start selling!
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Subscription;
