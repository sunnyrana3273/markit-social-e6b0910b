import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  ChevronRight,
  Check,
  X,
  Sparkles,
  Book,
  Crown,
  Loader2
} from "lucide-react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useForceLightMode } from "@/hooks/useForceLightMode";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

import { BACKEND_URL } from '@/lib/api';

interface LocationState {
  autoSubscribe?: 'plus' | 'pro';
  subscribePlan?: 'plus' | 'pro';
}

const Pricing = () => {
  useForceLightMode();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const [hasTriggeredAutoSubscribe, setHasTriggeredAutoSubscribe] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  
  // Get state if returning from auth with pending subscription
  const locationState = location.state as LocationState | null;
  
  useEffect(() => {
    document.title = "MarkIt | Pricing";

    // Check authentication status
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setIsAuthenticated(!!session);
    };

    checkAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);
  
  // Auto-trigger subscription if returning from auth with pending plan
  useEffect(() => {
    const planToSubscribe = locationState?.autoSubscribe || locationState?.subscribePlan;
    if (planToSubscribe && isAuthenticated && !hasTriggeredAutoSubscribe && !isLoading) {
      setHasTriggeredAutoSubscribe(true);
      // Clear the state to prevent re-triggering on refresh
      window.history.replaceState({}, document.title);
      // Trigger subscription
      handleSubscribe(planToSubscribe);
    }
  }, [locationState, isAuthenticated, hasTriggeredAutoSubscribe, isLoading]);

  const handleSubscribe = async (plan: 'plus' | 'pro') => {
    if (!isAuthenticated) {
      // Store intended plan and redirect to auth with return URL
      navigate('/auth', { state: { returnTo: '/pricing', subscribePlan: plan } });
      return;
    }

    setIsLoading(plan);

    try {
      // Get the session token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/auth');
        return;
      }

      // Create checkout session
      const response = await fetch(`${BACKEND_URL}/api/create-checkout-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ plan }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create checkout session');
      }

      const { url } = await response.json();
      
      if (url) {
        // Redirect to Stripe Checkout
        window.location.href = url;
      } else {
        throw new Error('No checkout URL received');
      }
    } catch (error: any) {
      console.error('Error creating checkout session:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to start checkout. Please try again.",
        variant: "destructive",
      });
      setIsLoading(null);
    }
  };

  const features = [
    { name: "AI Assistance Queries", free: "5/day", plus: "50/day", pro: "Unlimited" },
    { name: "Whiteboard Tools", free: "Basic", plus: "Advanced", pro: "Premium + Custom" },
    { name: "Storage Space", free: "1 GB", plus: "15 GB", pro: "50 GB" },
    { name: "Voice Calls", free: false, plus: true, pro: true },
    { name: "Public Communities", free: true, plus: true, pro: true },
    { name: "Custom Themes", free: false, plus: true, pro: true },
    { name: "Advanced Analytics", free: false, plus: false, pro: true },
    { name: "Priority Support", free: false, plus: true, pro: true },
    { name: "24/7 Support", free: false, plus: false, pro: true },
  ];

  return (
    <div className="min-h-screen bg-home-background font-lexend force-light-mode">
      {/* Header */}
      <header className="border-b border-gray-200 bg-home-surface/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between relative">
          <Link to="/" className="flex items-center gap-1.5">
              <div className="w-8 h-8 flex items-center justify-center">
              <Book className="w-5 h-5 text-home-primary" />
              </div>
            <span className="text-xl font-bold text-home-foreground">MarkIt</span>
          </Link>
          
          <nav className="hidden md:flex items-center gap-6 absolute left-1/2 transform -translate-x-1/2">
            <Link to="/features" className="text-gray-600 hover:text-home-foreground transition-colors">
              Features
            </Link>
            <Link to="/pricing" className="text-home-primary font-semibold">
              Pricing
            </Link>
          </nav>
          
          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <Link to="/app">
                <Button className="bg-home-primary hover:bg-home-primary-hover text-white">Dashboard</Button>
              </Link>
            ) : (
              <>
                <Link to="/auth">
                  <Button variant="ghost" className="text-home-foreground hover:bg-home-surface">Sign In</Button>
                </Link>
                <Link to="/auth">
                  <Button className="bg-home-primary hover:bg-home-primary-hover text-white">Get Started</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative py-20 lg:py-32 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-home-primary/10 via-home-secondary/10 to-green-100/20" />
        
        <div className="container mx-auto px-4 relative">
          <div className="max-w-4xl mx-auto text-center">
            <Badge className="mb-4 bg-home-primary/10 text-home-primary border-home-primary/20">
              <Sparkles className="w-3 h-3 mr-1" />
              Simple, Transparent Pricing
            </Badge>
            
            <h1 className="text-4xl lg:text-6xl font-bold text-home-foreground mb-6 leading-tight">
              Choose the perfect plan
              <br />
              <span className="text-gradient font-cedarville">for your learning</span>
            </h1>
            
            <p className="text-xl text-gray-600 mb-8 leading-relaxed max-w-2xl mx-auto">
              Start free and scale as you grow. All plans include our core features 
              with no hidden fees or long-term commitments.
            </p>
          </div>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="py-20 bg-home-surface">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto mb-20">
            {/* Free Plan */}
            <Card className="p-8 bg-white border-gray-200 hover:shadow-xl transition-all">
              <div className="mb-6">
                <h3 className="text-2xl font-bold text-home-foreground mb-2">Free</h3>
                <div className="flex items-baseline gap-1 mb-4">
                  <span className="text-5xl font-bold text-home-foreground">$0</span>
                  <span className="text-gray-600">/month</span>
                </div>
                <p className="text-gray-600">Perfect for getting started</p>
              </div>
              
              <Link to="/auth">
                <Button variant="outline" className="w-full mb-6 border-home-primary text-home-primary hover:bg-home-primary hover:text-white">
                  Get Started
                </Button>
              </Link>
              
              <div className="space-y-3">
                <div className="flex items-start gap-2">
                  <Check className="w-5 h-5 text-home-primary flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-gray-600">5 AI queries per day</span>
                </div>
                <div className="flex items-start gap-2">
                  <Check className="w-5 h-5 text-home-primary flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-gray-600">Basic whiteboard tools</span>
                </div>
                <div className="flex items-start gap-2">
                  <Check className="w-5 h-5 text-home-primary flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-gray-600">Public communities</span>
                </div>
                <div className="flex items-start gap-2">
                  <Check className="w-5 h-5 text-home-primary flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-gray-600">1 GB storage</span>
                </div>
              </div>
            </Card>

            {/* Plus Plan */}
            <Card className="p-8 bg-white border-2 border-home-primary relative hover:shadow-2xl transition-all">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                <Badge className="bg-home-primary text-white px-4 py-1">Most Popular</Badge>
              </div>
              
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-6 h-6 text-home-primary" />
                  <h3 className="text-2xl font-bold text-home-foreground">Plus</h3>
                </div>
                <div className="flex items-baseline gap-1 mb-4">
                  <span className="text-5xl font-bold text-home-foreground">$7</span>
                  <span className="text-gray-600">/month</span>
                </div>
                <p className="text-gray-600">For serious learners</p>
              </div>
              
              <Button 
                className="w-full mb-6 bg-home-primary hover:bg-home-primary-hover text-white"
                onClick={() => handleSubscribe('plus')}
                disabled={isLoading === 'plus'}
              >
                {isLoading === 'plus' ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  'Subscribe Now'
                )}
              </Button>
              
              <div className="space-y-3">
                <div className="flex items-start gap-2">
                  <Check className="w-5 h-5 text-home-primary flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-gray-600">50 AI queries per day</span>
                </div>
                <div className="flex items-start gap-2">
                  <Check className="w-5 h-5 text-home-primary flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-gray-600">Advanced whiteboard tools</span>
                </div>
                <div className="flex items-start gap-2">
                  <Check className="w-5 h-5 text-home-primary flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-gray-600">Voice calls enabled</span>
                </div>
                <div className="flex items-start gap-2">
                  <Check className="w-5 h-5 text-home-primary flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-gray-600">Priority support</span>
                </div>
                <div className="flex items-start gap-2">
                  <Check className="w-5 h-5 text-home-primary flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-gray-600">15 GB storage</span>
                </div>
                <div className="flex items-start gap-2">
                  <Check className="w-5 h-5 text-home-primary flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-gray-600">Custom themes</span>
                </div>
              </div>
            </Card>

            {/* Pro Plan */}
            <Card className="p-8 bg-white border-gray-200 hover:shadow-xl transition-all">
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <Crown className="w-6 h-6 text-home-primary" />
                  <h3 className="text-2xl font-bold text-home-foreground">Pro</h3>
                </div>
                <div className="flex items-baseline gap-1 mb-4">
                  <span className="text-5xl font-bold text-home-foreground">$15</span>
                  <span className="text-gray-600">/month</span>
                </div>
                <p className="text-gray-600">For power users</p>
              </div>
              
              <Button 
                variant="outline" 
                className="w-full mb-6 border-home-primary text-home-primary hover:bg-home-primary hover:text-white"
                onClick={() => handleSubscribe('pro')}
                disabled={isLoading === 'pro'}
              >
                {isLoading === 'pro' ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  'Subscribe Now'
                )}
              </Button>
              
              <div className="space-y-3">
                <div className="flex items-start gap-2">
                  <Check className="w-5 h-5 text-home-primary flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-gray-600">Unlimited AI queries</span>
                </div>
                <div className="flex items-start gap-2">
                  <Check className="w-5 h-5 text-home-primary flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-gray-600">Premium whiteboard tools</span>
                </div>
                <div className="flex items-start gap-2">
                  <Check className="w-5 h-5 text-home-primary flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-gray-600">Voice calls</span>
                </div>
                <div className="flex items-start gap-2">
                  <Check className="w-5 h-5 text-home-primary flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-gray-600">50 GB storage</span>
                </div>
                <div className="flex items-start gap-2">
                  <Check className="w-5 h-5 text-home-primary flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-gray-600">Advanced analytics</span>
                </div>
                <div className="flex items-start gap-2">
                  <Check className="w-5 h-5 text-home-primary flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-gray-600">24/7 priority support</span>
                </div>
                
              </div>
            </Card>
          </div>

          {/* Feature Comparison Table */}
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl font-bold text-home-foreground text-center mb-12">
              Detailed Feature Comparison
            </h2>
            
            <Card className="overflow-hidden bg-white">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 bg-home-surface">
                      <th className="text-left p-4 font-semibold text-home-foreground">Feature</th>
                      <th className="text-center p-4 font-semibold text-home-foreground">Free</th>
                      <th className="text-center p-4 font-semibold text-home-foreground bg-home-primary/5">Plus</th>
                      <th className="text-center p-4 font-semibold text-home-foreground">Pro</th>
                    </tr>
                  </thead>
                  <tbody>
                    {features.map((feature, index) => (
                      <tr key={index} className="border-b border-gray-100 hover:bg-home-surface/50 transition-colors">
                        <td className="p-4 text-gray-700">{feature.name}</td>
                        <td className="p-4 text-center">
                          {typeof feature.free === 'boolean' ? (
                            feature.free ? (
                              <Check className="w-5 h-5 text-home-primary mx-auto" />
                            ) : (
                              <X className="w-5 h-5 text-gray-300 mx-auto" />
                            )
                          ) : (
                            <span className="text-gray-600 text-sm">{feature.free}</span>
                          )}
                        </td>
                        <td className="p-4 text-center bg-home-primary/5">
                          {typeof feature.plus === 'boolean' ? (
                            feature.plus ? (
                              <Check className="w-5 h-5 text-home-primary mx-auto" />
                            ) : (
                              <X className="w-5 h-5 text-gray-300 mx-auto" />
                            )
                          ) : (
                            <span className="text-gray-600 text-sm font-medium">{feature.plus}</span>
                          )}
                        </td>
                        <td className="p-4 text-center">
                          {typeof feature.pro === 'boolean' ? (
                            feature.pro ? (
                              <Check className="w-5 h-5 text-home-primary mx-auto" />
                            ) : (
                              <X className="w-5 h-5 text-gray-300 mx-auto" />
                            )
                          ) : (
                            <span className="text-gray-600 text-sm">{feature.pro}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl font-bold text-home-foreground text-center mb-12">
              Frequently Asked Questions
            </h2>
            
            <div className="space-y-6">
              {[
                {
                  question: "Can I change my plan later?",
                  answer: "Yes! You can upgrade or downgrade your plan at any time. Changes take effect immediately, and we'll prorate the difference."
                },
                {
                  question: "What payment methods do you accept?",
                  answer: "We accept all major credit cards, debit cards, and PayPal. All payments are processed securely through Stripe."
                },
                {
                  question: "Is there a free trial for paid plans?",
                  answer: "While we don't offer a traditional trial, our Free plan lets you explore MarkIt's core features. You can upgrade anytime to unlock more capabilities."
                },
                {
                  question: "Can I cancel anytime?",
                  answer: "Absolutely! There are no long-term contracts. Cancel anytime from your account settings, and you'll retain access until the end of your billing period."
                },
                {
                  question: "Do you offer student or educational discounts?",
                  answer: "Yes! We offer special pricing for educational institutions and verified students. Contact our support team for more information."
                },
                {
                  question: "What happens to my data if I downgrade?",
                  answer: "Your data is always safe. If you exceed storage limits after downgrading, you'll be prompted to manage your files, but nothing is deleted without your permission."
                }
              ].map((faq, index) => (
                <Card key={index} className="p-6 bg-home-surface border-gray-200">
                  <h3 className="text-lg font-semibold text-home-foreground mb-2">{faq.question}</h3>
                  <p className="text-gray-600 leading-relaxed">{faq.answer}</p>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 relative overflow-hidden bg-home-surface">
        <div className="absolute inset-0 bg-gradient-to-br from-home-primary/5 to-home-secondary/5" />
        <div className="container mx-auto px-4 text-center relative">
          <h2 className="text-4xl lg:text-5xl font-bold text-home-foreground mb-6">
            Ready to get started?
          </h2>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            Join thousands of students already using MarkIt. Start free and upgrade when you're ready.
          </p>
          <Link to="/auth">
            <Button size="lg" className="bg-home-primary hover:bg-home-primary-hover text-white shadow-lg">
              Start Learning Today
              <ChevronRight className="w-5 h-5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white py-12">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <Link to="/" className="flex items-center gap-1.5 mb-4 md:mb-0">
              <div className="w-8 h-8 flex items-center justify-center">
                <Book className="w-5 h-5 text-home-primary" />
              </div>
              <span className="text-xl font-bold text-home-foreground">MarkIt</span>
            </Link>
            
            <div className="flex gap-6 text-sm text-gray-600">
              <Link to="/privacy" className="hover:text-home-foreground transition-colors">Privacy</Link>
              <Link to="/terms" className="hover:text-home-foreground transition-colors">Terms</Link>
              <Link to="/support" className="hover:text-home-foreground transition-colors">Support</Link>
            </div>
          </div>
          
          <div className="border-t border-gray-200 mt-8 pt-8 text-center text-sm text-gray-600">
            © 2025 MarkIt. Building the future of collaborative learning.
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Pricing;
