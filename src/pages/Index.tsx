import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  BookOpen, 
  Users, 
  Sparkles, 
  MessageSquare, 
  Video,
  Gamepad2,
  ChevronRight,
  Star,
  Zap,
  Target
} from "lucide-react";
import { Link } from "react-router-dom";
import heroImage from "@/assets/hero-education.jpg";

const Index = () => {
  return (
    <div className="min-h-screen bg-home-background font-lexend">
      {/* Header */}
      <header className="border-b border-gray-200 bg-home-surface/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-home-primary rounded-lg flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-home-foreground font-homemade">MarkIt</span>
          </div>
          
          <nav className="hidden md:flex items-center gap-6">
            <Link to="/features" className="text-gray-600 hover:text-home-foreground transition-colors">
              Features
            </Link>
            <Link to="/communities" className="text-gray-600 hover:text-home-foreground transition-colors">
              Communities
            </Link>
            <Link to="/pricing" className="text-gray-600 hover:text-home-foreground transition-colors">
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
        
        <div className="container mx-auto px-4 relative">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="animate-slide-up">
              <Badge className="mb-4 bg-home-primary/10 text-home-primary border-home-primary/20">
                <Zap className="w-3 h-3 mr-1" />
                AI-Powered Learning
              </Badge>
              
              <h1 className="text-5xl lg:text-6xl font-bold text-home-foreground mb-6 leading-tight">
                Study Smarter
                <span className="bg-gradient-to-r from-home-primary to-home-secondary bg-clip-text text-transparent"> Together</span>
              </h1>
              
              <p className="text-xl text-gray-600 mb-8 leading-relaxed">
                Transform your learning with AI-assisted whiteboards, real-time collaboration, 
                and vibrant study communities. Built for the next generation of students.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 mb-8">
                <Link to="/app">
                  <Button size="lg" className="group bg-home-primary hover:bg-home-primary-hover text-white">
                    Start a Study Session
                    <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
                <Button variant="outline" size="lg" className="border-home-primary text-home-primary hover:bg-home-primary hover:text-white">
                  <Video className="w-4 h-4 mr-2" />
                  Watch Demo
                </Button>
              </div>
              
              <div className="flex items-center gap-6 text-sm text-gray-600">
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
            <div className="relative animate-float">
              <img 
                src={heroImage} 
                alt="Students collaborating on MarkIt platform"
                className="rounded-2xl shadow-lg w-full"
              />
              <div className="absolute inset-0 bg-gradient-to-br from-home-primary/10 to-home-secondary/10 rounded-2xl" />
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-home-surface">
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
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                icon: Sparkles,
                title: "AI Assistant",
                description: "Get instant help with problems using our advanced vision AI. Just select and ask!",
                color: "text-home-primary"
              },
              {
                icon: Users,
                title: "Real-time Collaboration", 
                description: "Work together on the same whiteboard with friends. See cursors, changes, and presence live.",
                color: "text-home-secondary"
              },
              {
                icon: MessageSquare,
                title: "Smart Chat",
                description: "DM friends, join study rooms, and get help in context-aware conversations.",
                color: "text-green-600"
              },
              {
                icon: Video,
                title: "Voice & Video Calls",
                description: "Jump into voice calls instantly during study sessions for better collaboration.",
                color: "text-blue-600"
              },
              {
                icon: Target,
                title: "AP Course Communities",
                description: "Join dedicated rooms for AP Calculus, Physics, and more with expert moderation.",
                color: "text-purple-600"
              },
              {
                icon: Gamepad2,
                title: "Gamified Learning",
                description: "Track streaks, earn achievements, and compete with friends to stay motivated.",
                color: "text-home-primary"
              }
            ].map((feature, index) => {
              const IconComponent = feature.icon;
              return (
                <Card key={index} className="p-6 bg-white hover:bg-gray-50 transition-all duration-200 hover:shadow-lg group cursor-pointer border border-gray-200">
                  <IconComponent className={`w-12 h-12 ${feature.color} mb-4 group-hover:scale-110 transition-transform`} />
                  <h3 className="text-xl font-semibold text-home-foreground mb-2">{feature.title}</h3>
                  <p className="text-gray-600 leading-relaxed">{feature.description}</p>
                </Card>
              );
            })}
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
            <div className="flex items-center gap-2 mb-4 md:mb-0">
              <div className="w-8 h-8 bg-home-primary rounded-lg flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-home-foreground font-homemade">MarkIt</span>
            </div>
            
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

export default Index;