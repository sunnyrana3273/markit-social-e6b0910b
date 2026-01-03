import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { 
  Users, 
  Sparkles, 
  MessageSquare, 
  Video,
  Gamepad2,
  ChevronRight,
  Star,
  Zap,
  Target,
  Book,
  TrendingUp,
  Clock,
  Award,
  Palette
} from "lucide-react";
import { Link } from "react-router-dom";
import peopleIcon from "@/assets/people.svg";
import { useForceLightMode } from "@/hooks/useForceLightMode";
import { supabase } from "@/integrations/supabase/client";
import hisdLogo from "@/assets/hisdlogo.png";
import utLogo from "@/assets/utlogo.png";
import congressionalLogo from "@/assets/congressionalappchallengetranspo.png";
import amLogo from "@/assets/a&mlogo.png";
import markitDemoVideo from "@/assets/markitdemo.mp4";

const Index = () => {
  useForceLightMode();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [userImageUrl, setUserImageUrl] = useState<string | null>(null);
  
  useEffect(() => {
    document.title = "MarkIt: Learning but better";
    // Force light mode immediately on mount
    const root = document.documentElement;
    root.classList.remove('dark');
    
    // Also ensure CSS variables are applied
    root.style.colorScheme = 'light';

    // Check authentication status and verify user has completed onboarding
    const checkAuth = async () => {
      try {
        setIsCheckingAuth(true);
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError || !session) {
          setIsAuthenticated(false);
          setUserImageUrl(null);
          setIsCheckingAuth(false);
          return;
        }

        // Verify session is valid by checking if user has a profile with username
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('image_url, username')
          .eq('id', session.user.id)
          .maybeSingle();

        if (profileError) {
          console.error('[Index] Error fetching profile:', profileError);
          setIsAuthenticated(false);
          setUserImageUrl(null);
          setIsCheckingAuth(false);
          return;
        }

        // Only show Dashboard if user has completed onboarding (has username)
        const hasCompletedOnboarding = !!profile?.username;
        setIsAuthenticated(hasCompletedOnboarding);
        setUserImageUrl(profile?.image_url || null);
      } catch (error) {
        console.error('[Index] Error checking auth:', error);
        setIsAuthenticated(false);
        setUserImageUrl(null);
      } finally {
        setIsCheckingAuth(false);
      }
    };

    checkAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!session) {
        setIsAuthenticated(false);
        setUserImageUrl(null);
        return;
      }

      // Verify user has completed onboarding
      try {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('image_url, username')
          .eq('id', session.user.id)
          .maybeSingle();

        if (profileError) {
          console.error('[Index] Error fetching profile on auth change:', profileError);
          setIsAuthenticated(false);
          setUserImageUrl(null);
          return;
        }

        const hasCompletedOnboarding = !!profile?.username;
        setIsAuthenticated(hasCompletedOnboarding);
        setUserImageUrl(profile?.image_url || null);
      } catch (error) {
        console.error('[Index] Error checking profile on auth change:', error);
        setIsAuthenticated(false);
        setUserImageUrl(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return (
    <div className="min-h-screen bg-home-background font-lexend force-light-mode">
      {/* Header */}
      <header className="border-b border-gray-200 bg-home-surface/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between relative">
          <div className="flex items-center gap-1.5">
            <div className="w-8 h-8 flex items-center justify-center">
              <Book className="w-5 h-5 text-home-primary" />
            </div>
            <span className="text-xl font-bold text-home-foreground">MarkIt</span>
          </div>
          
          <nav className="hidden md:flex items-center gap-6 absolute left-1/2 transform -translate-x-1/2">
            <Link to="/features" className="text-gray-600 hover:text-home-foreground transition-colors">
              Features
            </Link>
            <Link to="/pricing" className="text-gray-600 hover:text-home-foreground transition-colors">
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
      <section className="relative pt-12 pb-8 lg:pt-16 lg:pb-12 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-home-primary/10 via-home-secondary/10 to-green-100/20" />
        
        <div className="container mx-auto px-4 relative">
          <div className="max-w-4xl mx-auto text-center">
            <div className="animate-slide-up">
              <Badge variant="outline" className="mb-4 bg-home-primary/10 text-home-primary border-home-primary/20 hover:bg-home-primary/10 hover:text-home-primary">
                <Zap className="w-3 h-3 mr-1" />
                AI-Powered Learning
              </Badge>
              
              <h1 className="text-3xl lg:text-5xl font-bold text-home-foreground mb-6 leading-tight font-lexend">
                MarkIt: Learning but
                <br />
                <span className="text-gradient font-cedarville inline-block text-5xl lg:text-8xl" style={{ marginTop: '0' }}>better</span>
              </h1>
              
              <p className="text-xl text-gray-600 mb-8 leading-relaxed max-w-2xl mx-auto">
                Transform your learning with AI-assisted whiteboards, real-time collaboration, 
                and vibrant study communities. Built for the next generation of students.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 mb-8 justify-center items-center">
                {isAuthenticated ? (
                  <div className="flex items-center gap-2">
                    <Avatar className="w-10 h-10">
                      <AvatarImage src={userImageUrl || undefined} alt="Profile" />
                      <AvatarFallback>
                        <Book className="w-5 h-5" />
                      </AvatarFallback>
                    </Avatar>
                    <Link to="/app">
                      <Button size="lg" className="group bg-home-primary hover:bg-home-primary-hover text-white">
                        Dashboard
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <Link to="/app">
                    <Button size="lg" className="group bg-home-primary hover:bg-home-primary-hover text-white">
                      Join your friends
                      <ChevronRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </Link>
                )}
                <Button
                  variant="outline"
                  size="lg"
                  className="border-home-primary text-home-primary hover:bg-home-primary hover:text-white"
                  onClick={() => {
                    const videoSection = document.getElementById('video-demo');
                    if (videoSection) {
                      videoSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                  }}
                >
                  <Video className="w-4 h-4 mr-2" />
                  Watch Demo
                </Button>
              </div>
              
              <div className="flex flex-col sm:flex-row items-center justify-center gap-6 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <div className="flex -space-x-2">
                    <div className="w-8 h-8 rounded-full bg-home-primary border-2 border-home-background" />
                    <div className="w-8 h-8 rounded-full bg-home-secondary border-2 border-home-background" />
                    <div className="w-8 h-8 rounded-full bg-green-500 border-2 border-home-background" />
                  </div>
                  <span>1000+ active learners</span>
                </div>
                <div className="flex items-center gap-1">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  ))}
                  <span className="ml-1">4.9 rating</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Endorsements Carousel */}
      <section className="py-4 bg-white border-y border-gray-200">
        <div className="container mx-auto px-4">
          <h2 className="text-center text-2xl font-bold text-home-foreground mb-3">
            Endorsed by students/organizations at leading institutions
          </h2>
          <div className="relative overflow-hidden">
            <div className="flex animate-scroll items-center">
              {/* Multiple sets for seamless infinite loop */}
              {[
                { src: hisdLogo, alt: "HISD Logo" },
                { src: utLogo, alt: "UT Logo" },
                { src: congressionalLogo, alt: "Congressional App Challenge" },
                { src: amLogo, alt: "A&M Logo" },
                { src: hisdLogo, alt: "HISD Logo" },
                { src: utLogo, alt: "UT Logo" },
                { src: congressionalLogo, alt: "Congressional App Challenge" },
                { src: amLogo, alt: "A&M Logo" },
                { src: hisdLogo, alt: "HISD Logo" },
                { src: utLogo, alt: "UT Logo" },
                { src: congressionalLogo, alt: "Congressional App Challenge" },
                { src: amLogo, alt: "A&M Logo" },
              ].map((logo, index) => (
                <div
                  key={index}
                  className="flex-shrink-0 flex items-center justify-center"
                  style={{ 
                    width: '200px', 
                    height: '50px',
                    marginRight: index % 4 === 3 ? '0' : '4rem'
                  }}
                >
                  <img
                    src={logo.src}
                    alt={logo.alt}
                    className="max-w-full max-h-full object-contain opacity-70 hover:opacity-100 transition-opacity"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Video Demo Section */}
      <section id="video-demo" className="py-12 bg-home-background scroll-mt-16">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <video
              src={markitDemoVideo}
              controls
              className="w-full rounded-lg shadow-lg"
              style={{ maxHeight: '600px' }}
            >
              Your browser does not support the video tag.
            </video>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-home-surface scroll-mt-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-home-foreground mb-4">
              Everything you need to excel
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              From AI-powered assistance to real-time collaboration, 
              MarkIt brings the future of education to your fingertips.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Featured Card - AI Assistant (Larger, Gradient Background) */}
            <Card className="md:col-span-2 lg:col-span-1 p-8 bg-gradient-to-br from-home-primary/10 via-home-primary/5 to-transparent border-2 border-home-primary/20 hover:border-home-primary/40 transition-all duration-300 hover:shadow-xl group cursor-pointer relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-home-primary/5 rounded-full blur-3xl -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-500" />
              <div className="relative z-10">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-16 h-16 bg-home-primary/20 rounded-2xl flex items-center justify-center group-hover:scale-110 group-hover:rotate-6 transition-all duration-300">
                    <Sparkles className="w-8 h-8 text-home-primary" />
                  </div>
                  <Badge variant="outline" className="bg-home-primary/20 text-home-primary border-home-primary/30 hover:bg-home-primary/20 hover:text-home-primary">
                    <Zap className="w-3 h-3 mr-1" />
                    Featured
                  </Badge>
                </div>
                <h3 className="text-2xl font-bold text-home-foreground mb-3 group-hover:text-home-primary transition-colors">
                  AI Vision Assistant
                </h3>
                <p className="text-gray-700 leading-relaxed mb-4 text-base">
                  Get instant help with problems using our advanced vision AI. Just ask!
                </p>
                <div className="flex items-center gap-4 text-sm text-gray-600">
                  <div className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    <span>Instant</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <TrendingUp className="w-4 h-4" />
                    <span>95% Accuracy</span>
                  </div>
                </div>
              </div>
            </Card>

            {/* Smart Chat - Compact with Badge */}
            <Card className="p-6 bg-white hover:shadow-xl transition-all duration-300 group cursor-pointer border-2 border-green-200 hover:border-green-400 relative overflow-hidden">
              <div className="absolute top-4 right-4">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              </div>
              <div className="relative z-10">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-4 group-hover:bg-green-200 group-hover:scale-110 transition-all duration-300">
                  <MessageSquare className="w-6 h-6 text-green-600" />
                </div>
                <h3 className="text-xl font-semibold text-home-foreground mb-2">
                  Smart Chat
                </h3>
                <p className="text-gray-600 leading-relaxed text-sm mb-3">
                  DM friends, join study rooms, and get help in context-aware conversations.
                </p>
                <Badge variant="outline" className="border-green-300 text-green-700 bg-green-50">
                  Context-aware
                </Badge>
              </div>
            </Card>

            {/* Voice & Video Calls - Icon Top, Stats Bottom */}
            <Card className="p-6 bg-gradient-to-b from-blue-50 to-white hover:from-blue-100 hover:to-white transition-all duration-300 hover:shadow-lg group cursor-pointer border border-blue-200">
              <div className="text-center mb-4">
                <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-3 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300">
                  <Video className="w-8 h-8 text-blue-600" />
                </div>
                <h3 className="text-xl font-semibold text-home-foreground mb-2">
                  Voice Calls
                </h3>
                <p className="text-gray-600 leading-relaxed text-sm mb-4">
                  Jump into voice calls instantly during study sessions for better collaboration.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 pt-4 border-t border-blue-100">
                <div className="text-center">
                  <div className="text-lg font-bold text-blue-600">Wideband</div>
                  <div className="text-xs text-gray-500">Quality</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-blue-600">24/7</div>
                  <div className="text-xs text-gray-500">Available</div>
                </div>
              </div>
            </Card>

            {/* Gamified Learning - Stats Card Style */}
            <Card className="p-6 bg-gradient-to-br from-yellow-50 via-orange-50 to-white hover:shadow-xl transition-all duration-300 group cursor-pointer border-2 border-yellow-200 hover:border-yellow-400 relative">
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-yellow-100 rounded-xl flex items-center justify-center shadow-md group-hover:scale-110 group-hover:rotate-6 transition-all duration-300">
                  <Gamepad2 className="w-6 h-6 text-yellow-600" />
                </div>
                <Award className="w-5 h-5 text-yellow-600 group-hover:scale-125 transition-transform" />
              </div>
              <h3 className="text-xl font-semibold text-home-foreground mb-2">
                Gamified Learning
              </h3>
              <p className="text-gray-600 leading-relaxed text-sm mb-4">
                Track streaks, problems, and compete with friends to stay motivated.
              </p>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Daily Streaks</span>
                  <span className="font-semibold text-orange-600">6 days</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Problems</span>
                  <span className="font-semibold text-yellow-600">12 solved</span>
                </div>
              </div>
            </Card>

            {/* AP Course Communities - Vertical with Icon Badge */}
            <Card className="p-6 bg-white hover:bg-gradient-to-br hover:from-purple-50 hover:via-blue-50 hover:to-transparent transition-all duration-300 hover:shadow-lg group cursor-pointer border border-gray-200 hover:border-purple-300 relative">
              <div className="absolute top-0 right-0 w-20 h-20 bg-purple-100/50 rounded-bl-full opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center shadow-lg group-hover:shadow-xl group-hover:scale-110 transition-all duration-300">
                    <img src={peopleIcon} alt="People" className="w-8 h-8" style={{ filter: 'brightness(0) saturate(100%) invert(27%) sepia(51%) saturate(2878%) hue-rotate(258deg) brightness(94%) contrast(92%)' }} />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-home-foreground">
                      AP Communities
                    </h3>
                    <p className="text-xs text-gray-500">Expert moderated</p>
                  </div>
                </div>
                <p className="text-gray-600 leading-relaxed text-sm mb-3">
                  Join dedicated rooms for AP Calculus AB / BC, Physics, Computer Science and more with expert moderation.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="text-xs">AP Calculus AB | BC</Badge>
                  <Badge variant="outline" className="text-xs">AP Physics 1 | 2 | C | E&M | Mechanics</Badge>
                  <Badge variant="outline" className="text-xs">AP Computer Science A | P</Badge>
                  <Badge variant="outline" className="text-xs">+ More</Badge>
                </div>
              </div>
                </Card>

            {/* Customize Study Environment */}
            <Card className="p-6 bg-gradient-to-br from-pink-50 via-rose-50 to-white hover:shadow-xl transition-all duration-300 group cursor-pointer border-2 border-pink-200 hover:border-pink-400 relative">
              <div className="absolute top-0 right-0 w-24 h-24 bg-pink-100/30 rounded-bl-full opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="relative z-10">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 bg-pink-100 rounded-xl flex items-center justify-center shadow-md group-hover:scale-110 group-hover:rotate-6 transition-all duration-300">
                    <Palette className="w-6 h-6 text-pink-600" />
                  </div>
                </div>
                <h3 className="text-xl font-semibold text-home-foreground mb-2">
                  Customize your study environment
                </h3>
                <p className="text-gray-600 leading-relaxed text-sm mb-4">
                  Select from themes, colors, and build the coziest study spot.
                </p>
                <div className="grid grid-cols-2 gap-3 pt-4 border-t border-pink-100">
                  <div className="text-center">
                    <div className="text-lg font-bold text-pink-600">Customizable</div>
                    <div className="text-xs text-gray-500">Themes</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-pink-600">Unlimited</div>
                    <div className="text-xs text-gray-500">Colors</div>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 relative overflow-hidden bg-white">
        <div className="absolute inset-0 bg-gradient-to-br from-home-primary/5 to-home-secondary/5" />
        <div className="container mx-auto px-4 text-center relative">
          <h2 className="text-4xl lg:text-5xl font-bold text-home-foreground mb-6">
            Ready to transform your learning?
          </h2>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            Join thousands of students already using MarkIt to collaborate, 
            learn faster, and achieve their academic goals.
          </p>
          <Link to="/auth">
            <Button size="lg" className="bg-home-primary hover:bg-home-primary-hover text-white shadow-lg hover:shadow-xl transition-all duration-200">
              Get Started for Free
              <ChevronRight className="w-5 h-5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-home-surface py-12">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center">
              <div className="flex items-center gap-1.5 mb-4 md:mb-0">
              <div className="w-8 h-8 flex items-center justify-center">
                  <Book className="w-5 h-5 text-home-primary" />
              </div>
                <span className="text-xl font-bold text-home-foreground">MarkIt</span>
            </div>
            
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

export default Index;