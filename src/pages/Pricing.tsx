import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  BookOpen, 
  Check,
  X,
  Star,
  Zap,
  Crown,
  Users,
  MessageSquare,
  Video,
  Sparkles,
  Target,
  Gamepad2,
  Brain,
  Clock,
  Shield,
  Smartphone,
  Globe,
  BarChart3,
  FileText,
  Camera,
  Mic,
  Share2,
  Download,
  Settings,
  Bell,
  Heart,
  Trophy,
  Lock,
  ChevronRight
} from "lucide-react";
import { Link } from "react-router-dom";

const Pricing = () => {
  const plans = [
    {
      name: "Free",
      price: 0,
      period: "forever",
      description: "Perfect for getting started with basic study features",
      color: "border-gray-200",
      buttonVariant: "outline" as const,
      buttonText: "Get Started Free",
      popular: false,
      features: [
        { text: "Basic whiteboard", included: true },
        { text: "Up to 3 community joins", included: true },
        { text: "10 AI credits per month", included: true },
        { text: "Basic chat features", included: true },
        { text: "Mobile app access", included: true },
        { text: "Real-time collaboration", included: false },
        { text: "Voice & video calls", included: false },
        { text: "Advanced AI features", included: false },
        { text: "Unlimited communities", included: false },
        { text: "Priority support", included: false },
        { text: "Study analytics", included: false },
        { text: "Screen recording", included: false }
      ]
    },
    {
      name: "Plus",
      price: 7,
      period: "month",
      description: "Enhanced features for serious students",
      color: "border-home-primary",
      buttonVariant: "default" as const,
      buttonText: "Start Plus Trial",
      popular: true,
      features: [
        { text: "Everything in Free", included: true },
        { text: "Unlimited community joins", included: true },
        { text: "100 AI credits per month", included: true },
        { text: "Real-time collaboration", included: true },
        { text: "Voice & video calls", included: true },
        { text: "Advanced AI features", included: true },
        { text: "Study analytics", included: true },
        { text: "Screen recording", included: true },
        { text: "Priority support", included: true },
        { text: "Custom themes", included: true },
        { text: "Advanced sharing", included: true },
        { text: "Study streaks & achievements", included: true }
      ]
    },
    {
      name: "Pro",
      price: 15,
      period: "month",
      description: "Complete solution for power users and educators",
      color: "border-yellow-500",
      buttonVariant: "default" as const,
      buttonText: "Start Pro Trial",
      popular: false,
      features: [
        { text: "Everything in Plus", included: true },
        { text: "Unlimited AI credits", included: true },
        { text: "Advanced study plans", included: true },
        { text: "Focus mode & productivity tools", included: true },
        { text: "Advanced analytics & insights", included: true },
        { text: "Custom study rooms", included: true },
        { text: "Bulk document processing", included: true },
        { text: "API access", included: true },
        { text: "White-label options", included: true },
        { text: "Dedicated support", included: true },
        { text: "Early access to new features", included: true },
        { text: "Team management tools", included: true }
      ]
    }
  ];


  return (
    <div className="min-h-screen bg-home-background font-lexend">
      {/* Header */}
      <header className="border-b border-gray-200 bg-home-surface/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-home-primary rounded-lg flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-home-foreground font-homemade">MarkIt</span>
          </Link>
          
          <nav className="hidden md:flex items-center gap-6">
            <Link to="/features" className="text-gray-600 hover:text-home-foreground transition-colors">
              Features
            </Link>
            <Link to="/pricing" className="text-home-primary font-medium">
              Pricing
            </Link>
          </nav>
          
          <div className="flex items-center gap-3">
            <Link to="/auth">
              <Button variant="ghost" className="text-home-foreground hover:bg-home-surface">Sign In</Button>
            </Link>
            <Link to="/auth">
              <Button className="bg-home-primary hover:bg-home-primary-hover text-white">Get Started</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative py-20 lg:py-32 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-home-primary/10 via-home-secondary/10 to-green-100/20" />
        
        <div className="container mx-auto px-4 relative text-center">
          <Badge className="mb-4 bg-home-primary/10 text-home-primary border-home-primary/20 hover:bg-home-primary hover:text-white transition-colors duration-200 cursor-pointer">
            <Star className="w-3 h-3 mr-1" />
            Simple Pricing
          </Badge>
          
          <h1 className="text-4xl lg:text-6xl font-bold text-home-foreground mb-6 leading-tight font-lexend">
            Choose your perfect
            <br />
            <span className="text-gradient font-homemade">study plan</span>
          </h1>
          
          <p className="text-xl text-gray-600 mb-8 leading-relaxed max-w-3xl mx-auto">
            Start free and upgrade as you grow. All plans include our core features with 
            additional benefits for Plus and Pro users.
          </p>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {plans.map((plan, index) => (
              <Card 
                key={plan.name} 
                className={`p-8 relative ${plan.color} ${
                  plan.popular 
                    ? 'border-2 shadow-lg scale-105' 
                    : 'border shadow-md'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <Badge className="bg-home-primary text-white px-4 py-1">
                      <Crown className="w-3 h-3 mr-1" />
                      Most Popular
                    </Badge>
                  </div>
                )}
                
                <div className="text-center mb-8">
                  <h3 className="text-2xl font-bold text-home-foreground mb-2">{plan.name}</h3>
                  <div className="mb-4">
                    <span className="text-4xl font-bold text-home-foreground">${plan.price}</span>
                    <span className="text-gray-600 ml-1">/{plan.period}</span>
                  </div>
                  <p className="text-gray-600">{plan.description}</p>
                </div>
                
                <div className="space-y-4 mb-8">
                  {plan.features.map((feature, featureIndex) => (
                    <div key={featureIndex} className="flex items-center gap-3">
                      {feature.included ? (
                        <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                      ) : (
                        <X className="w-5 h-5 text-gray-300 flex-shrink-0" />
                      )}
                      <span className={`text-sm ${feature.included ? 'text-gray-700' : 'text-gray-400'}`}>
                        {feature.text}
                      </span>
                    </div>
                  ))}
                </div>
                
                <Button 
                  className="w-full" 
                  variant={plan.buttonVariant}
                  size="lg"
                >
                  {plan.buttonText}
                </Button>
              </Card>
            ))}
          </div>
        </div>
      </section>


      {/* FAQ Section */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-home-foreground mb-4">
              Frequently Asked Questions
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Everything you need to know about our pricing and plans
            </p>
          </div>
          
          <div className="max-w-3xl mx-auto space-y-8">
            <div className="border-b border-gray-200 pb-6">
              <h3 className="text-xl font-semibold text-home-foreground mb-3">
                Can I change my plan at any time?
              </h3>
              <p className="text-gray-600 leading-relaxed">
                Yes! You can upgrade or downgrade your plan at any time. Changes take effect immediately, 
                and we'll prorate any billing differences.
              </p>
            </div>
            
            <div className="border-b border-gray-200 pb-6">
              <h3 className="text-xl font-semibold text-home-foreground mb-3">
                What happens to my data if I cancel?
              </h3>
              <p className="text-gray-600 leading-relaxed">
                Your data is always yours. If you cancel, you can export your study materials and 
                continue using the free plan with limited features.
              </p>
            </div>
            
            <div className="border-b border-gray-200 pb-6">
              <h3 className="text-xl font-semibold text-home-foreground mb-3">
                Do you offer student discounts?
              </h3>
              <p className="text-gray-600 leading-relaxed">
                Yes! We offer 50% off for verified students. Contact support with your student ID 
                to get your discount applied.
              </p>
            </div>
            
            <div className="border-b border-gray-200 pb-6">
              <h3 className="text-xl font-semibold text-home-foreground mb-3">
                Is there a free trial for paid plans?
              </h3>
              <p className="text-gray-600 leading-relaxed">
                Yes! Both Plus and Pro plans come with a 14-day free trial. No credit card required 
                to start your trial.
              </p>
            </div>
            
            <div className="pb-6">
              <h3 className="text-xl font-semibold text-home-foreground mb-3">
                What payment methods do you accept?
              </h3>
              <p className="text-gray-600 leading-relaxed">
                We accept all major credit cards, PayPal, and bank transfers. All payments are 
                processed securely through Stripe.
              </p>
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
            Join thousands of students already using MarkIt to collaborate, 
            learn faster, and achieve their academic goals.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/auth">
              <Button size="lg" className="bg-home-primary hover:bg-home-primary-hover text-white shadow-lg hover:shadow-xl transition-all duration-200">
                Start Free Trial
                <ChevronRight className="w-5 h-5" />
              </Button>
            </Link>
            <Link to="/features">
              <Button variant="outline" size="lg" className="border-home-primary text-home-primary hover:bg-home-primary hover:text-white">
                View All Features
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-home-surface py-12">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <Link to="/" className="flex items-center gap-2 mb-4 md:mb-0">
              <div className="w-8 h-8 bg-home-primary rounded-lg flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-home-foreground font-homemade">MarkIt</span>
            </Link>
            
            <div className="flex gap-6 text-sm text-gray-600">
              <Link to="/privacy" className="hover:text-home-foreground transition-colors">Privacy</Link>
              <Link to="/terms" className="hover:text-home-foreground transition-colors">Terms</Link>
              <Link to="/support" className="hover:text-home-foreground transition-colors">Support</Link>
            </div>
          </div>
          
          <div className="border-t border-gray-200 mt-8 pt-8 text-center text-sm text-gray-600">
            © 2024 MarkIt. Building the future of collaborative learning.
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Pricing;
