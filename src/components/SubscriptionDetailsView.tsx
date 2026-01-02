import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { 
  CreditCard, 
  Crown, 
  Gift, 
  Clock, 
  CheckCircle, 
  XCircle, 
  DollarSign,
  Calendar,
  Sparkles,
  AlertCircle,
  ExternalLink,
  X,
  RotateCcw
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";

interface SubscriptionDetailsViewProps {
  userId?: string;
}

interface SubscriptionDetails {
  currentPlan: {
    plan: 'free' | 'plus' | 'pro';
    plan_expires_at: string | null;
    isExpired: boolean;
    source: 'stripe' | 'kp' | 'free';
  };
  knowledgePoints: number;
  kpRedemptions: Array<{
    id: string;
    subscription_type: 'plus' | 'pro';
    knowledge_points_spent: number;
    expires_at: string;
    created_at: string;
    is_active: boolean;
    isExpired: boolean;
  }>;
  stripeSubscriptions: Array<{
    id: string;
    status: string;
    plan: string;
    current_period_start: string;
    current_period_end: string;
    cancel_at_period_end: boolean;
    canceled_at: string | null;
    created: string;
    items: Array<{
      price_id: string;
      amount: number;
      currency: string;
      interval: string;
    }>;
    invoices: Array<{
      id: string;
      amount_paid: number;
      currency: string;
      status: string;
      created: string;
      paid_at: string | null;
      period_start: string | null;
      period_end: string | null;
    }>;
  }>;
  stripePayments: Array<{
    id: string;
    amount: number;
    currency: string;
    status: string;
    created: string;
    description: string | null;
  }>;
  nextBilling: string | null;
}

const SubscriptionDetailsView = ({ userId }: SubscriptionDetailsViewProps) => {
  const [details, setDetails] = useState<SubscriptionDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [cancelingSubId, setCancelingSubId] = useState<string | null>(null);
  const [reactivatingSubId, setReactivatingSubId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (userId) {
      fetchSubscriptionDetails();
    }
  }, [userId]);

  const fetchSubscriptionDetails = async () => {
    try {
      setIsLoading(true);
      
      // Get auth token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({
          title: "Error",
          description: "Please sign in to view subscription details",
          variant: "destructive",
        });
        return;
      }

      const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
      
      // Fetch from backend API
      const response = await fetch(`${BACKEND_URL}/api/user/subscription-details`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch subscription details');
      }

      const data = await response.json();
      if (data.success) {
        setDetails(data);
      } else {
        throw new Error(data.error || 'Failed to fetch subscription details');
      }
    } catch (error: any) {
      console.error('Error fetching subscription details:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to load subscription details",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatCurrency = (amount: number, currency: string = 'usd') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount);
  };

  const handleCancelSubscription = async (subscriptionId: string) => {
    if (!confirm('Are you sure you want to cancel this subscription? It will remain active until the end of the current billing period.')) {
      return;
    }

    try {
      setCancelingSubId(subscriptionId);
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({
          title: "Error",
          description: "Please sign in to cancel subscription",
          variant: "destructive",
        });
        return;
      }

      const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
      
      const response = await fetch(`${BACKEND_URL}/api/cancel-subscription`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ subscriptionId }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to cancel subscription');
      }

      toast({
        title: "Subscription Canceled",
        description: data.message || "Your subscription will be canceled at the end of the current billing period.",
      });

      // Refresh subscription details
      await fetchSubscriptionDetails();
    } catch (error: any) {
      console.error('Error canceling subscription:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to cancel subscription",
        variant: "destructive",
      });
    } finally {
      setCancelingSubId(null);
    }
  };

  const handleReactivateSubscription = async (subscriptionId: string) => {
    try {
      setReactivatingSubId(subscriptionId);
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({
          title: "Error",
          description: "Please sign in to reactivate subscription",
          variant: "destructive",
        });
        return;
      }

      const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
      
      const response = await fetch(`${BACKEND_URL}/api/reactivate-subscription`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ subscriptionId }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to reactivate subscription');
      }

      toast({
        title: "Subscription Reactivated",
        description: data.message || "Your subscription has been reactivated.",
      });

      // Refresh subscription details
      await fetchSubscriptionDetails();
    } catch (error: any) {
      console.error('Error reactivating subscription:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to reactivate subscription",
        variant: "destructive",
      });
    } finally {
      setReactivatingSubId(null);
    }
  };

  const getPlanBadge = (plan: string) => {
    const planColors = {
      free: 'bg-gray-500',
      plus: 'bg-blue-500',
      pro: 'bg-yellow-500',
    };
    const planIcons = {
      free: null,
      plus: <Sparkles className="w-3 h-3" />,
      pro: <Crown className="w-3 h-3" />,
    };
    
    return (
      <Badge className={`${planColors[plan as keyof typeof planColors] || 'bg-gray-500'} text-white`}>
        {planIcons[plan as keyof typeof planIcons]}
        <span className="ml-1 capitalize">{plan}</span>
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!details) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <AlertCircle className="w-8 h-8 mx-auto mb-2" />
        <p>Unable to load subscription details</p>
      </div>
    );
  }

  const { currentPlan, knowledgePoints, kpRedemptions, stripeSubscriptions, stripePayments, nextBilling } = details;
  const activeStripeSub = stripeSubscriptions.find(s => s.status === 'active');
  const totalSpent = stripePayments.reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="space-y-6">
      {/* Current Plan Status */}
      <Card className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold mb-2">Current Subscription</h3>
            <div className="flex items-center gap-2 mb-2">
              {getPlanBadge(currentPlan.plan)}
              {currentPlan.source === 'stripe' && (
                <Badge variant="outline" className="flex items-center gap-1">
                  <CreditCard className="w-3 h-3" />
                  Stripe
                </Badge>
              )}
              {currentPlan.source === 'kp' && (
                <Badge variant="outline" className="flex items-center gap-1">
                  <Gift className="w-3 h-3" />
                  Knowledge Points
                </Badge>
              )}
            </div>
          </div>
          {currentPlan.isExpired ? (
            <XCircle className="w-6 h-6 text-red-500" />
          ) : (
            <CheckCircle className="w-6 h-6 text-green-500" />
          )}
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">Status:</span>
            <span className={currentPlan.isExpired ? 'text-red-500 font-medium' : 'text-green-500 font-medium'}>
              {currentPlan.isExpired ? 'Expired' : 'Active'}
            </span>
          </div>

          {currentPlan.plan_expires_at && (
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">Expires:</span>
              <span className="font-medium">{formatDate(currentPlan.plan_expires_at)}</span>
            </div>
          )}

          {nextBilling && (
            <div className="flex items-center gap-2 text-sm">
              <DollarSign className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">Next billing:</span>
              <span className="font-medium">{formatDate(nextBilling)}</span>
            </div>
          )}

          {currentPlan.plan === 'free' && (
            <div className="mt-4 pt-4 border-t">
              <Link to="/pricing">
                <Button variant="outline" className="w-full">
                  Upgrade Plan
                  <ExternalLink className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </div>
          )}
        </div>
      </Card>

      {/* Knowledge Points Section */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Gift className="w-5 h-5" />
            Knowledge Points
          </h3>
          <Badge variant="secondary" className="text-lg px-3 py-1">
            {knowledgePoints.toLocaleString()} KP
          </Badge>
        </div>
        <Link to="/app/rewards">
          <Button variant="outline" className="w-full">
            View Rewards Store
            <ExternalLink className="w-4 h-4 ml-2" />
          </Button>
        </Link>
      </Card>

      {/* KP Redemptions History */}
      {kpRedemptions.length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Gift className="w-5 h-5" />
            KP Redemption History
          </h3>
          <div className="space-y-3">
            {kpRedemptions.map((redemption) => (
              <div key={redemption.id} className="p-4 border rounded-lg">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {getPlanBadge(redemption.subscription_type)}
                    {redemption.isExpired ? (
                      <Badge variant="outline" className="text-red-500 border-red-500">
                        Expired
                      </Badge>
                    ) : redemption.is_active ? (
                      <Badge variant="outline" className="text-green-500 border-green-500">
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="outline">Inactive</Badge>
                    )}
                  </div>
                </div>
                <div className="space-y-1 text-sm text-muted-foreground mt-2">
                  <div className="flex items-center gap-2">
                    <Gift className="w-3 h-3" />
                    <span>{redemption.knowledge_points_spent} Knowledge Points</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-3 h-3" />
                    <span>Redeemed: {formatDate(redemption.created_at)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-3 h-3" />
                    <span>Expires: {formatDate(redemption.expires_at)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Stripe Subscriptions */}
      {stripeSubscriptions.length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            Stripe Subscriptions
          </h3>
          <div className="space-y-4">
            {stripeSubscriptions.map((sub) => {
              const isActive = sub.status === 'active';
              const isCanceling = sub.cancel_at_period_end;
              const canCancel = isActive && !isCanceling;
              const canReactivate = isActive && isCanceling;
              
              return (
                <div key={sub.id} className="p-4 border rounded-lg">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {getPlanBadge(sub.plan)}
                        <Badge 
                          variant="outline"
                          className={
                            sub.status === 'active' ? 'text-green-500 border-green-500' :
                            sub.status === 'canceled' ? 'text-red-500 border-red-500' :
                            'text-yellow-500 border-yellow-500'
                          }
                        >
                          {sub.status}
                        </Badge>
                        {isCanceling && (
                          <Badge variant="outline" className="text-orange-500 border-orange-500">
                            Cancels at period end
                          </Badge>
                        )}
                      </div>
                      {sub.items.length > 0 && (
                        <div className="text-sm text-muted-foreground">
                          {formatCurrency(sub.items[0].amount, sub.items[0].currency)} / {sub.items[0].interval}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {canCancel && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleCancelSubscription(sub.id)}
                          disabled={cancelingSubId === sub.id}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-500/10"
                        >
                          {cancelingSubId === sub.id ? (
                            <>
                              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-red-600 mr-2"></div>
                              Canceling...
                            </>
                          ) : (
                            <>
                              <X className="w-3 h-3 mr-1" />
                              Cancel
                            </>
                          )}
                        </Button>
                      )}
                      {canReactivate && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleReactivateSubscription(sub.id)}
                          disabled={reactivatingSubId === sub.id}
                          className="text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-500/10"
                        >
                          {reactivatingSubId === sub.id ? (
                            <>
                              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-green-600 mr-2"></div>
                              Reactivating...
                            </>
                          ) : (
                            <>
                              <RotateCcw className="w-3 h-3 mr-1" />
                              Reactivate
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2 text-sm text-muted-foreground mt-3">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3 h-3" />
                      <span>Created: {formatDate(sub.created)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-3 h-3" />
                      <span>Current period: {formatDate(sub.current_period_start)} - {formatDate(sub.current_period_end)}</span>
                    </div>
                    {isCanceling && (
                      <div className="flex items-center gap-2 text-orange-500 mt-2 p-2 bg-orange-50 dark:bg-orange-500/10 rounded">
                        <AlertCircle className="w-3 h-3" />
                        <span className="text-xs">
                          This subscription will be canceled on {formatDate(sub.current_period_end)}. You'll continue to have access until then.
                        </span>
                      </div>
                    )}
                    {sub.canceled_at && (
                      <div className="flex items-center gap-2 text-red-500">
                        <XCircle className="w-3 h-3" />
                        <span>Canceled: {formatDate(sub.canceled_at)}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Payment History */}
      {stripePayments.length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            Payment History
          </h3>
          <div className="mb-4 p-3 bg-muted rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Total Spent</span>
              <span className="text-lg font-semibold">{formatCurrency(totalSpent)}</span>
            </div>
          </div>
          <div className="space-y-2">
            {stripePayments.map((payment) => (
              <div key={payment.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <div className="font-medium">{formatCurrency(payment.amount, payment.currency)}</div>
                  <div className="text-sm text-muted-foreground">
                    {formatDate(payment.created)}
                  </div>
                  {payment.description && (
                    <div className="text-xs text-muted-foreground mt-1">{payment.description}</div>
                  )}
                </div>
                <Badge variant="outline" className="text-green-500 border-green-500">
                  {payment.status}
                </Badge>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* No Subscriptions Message */}
      {kpRedemptions.length === 0 && stripeSubscriptions.length === 0 && (
        <Card className="p-6 text-center">
          <Crown className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">No Active Subscriptions</h3>
          <p className="text-sm text-muted-foreground mb-4">
            You're currently on the free plan. Upgrade to unlock premium features!
          </p>
          <Link to="/pricing">
            <Button>
              View Plans
              <ExternalLink className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </Card>
      )}
    </div>
  );
};

export default SubscriptionDetailsView;

