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
    <div className="min-h-screen bg-gradient-surface">
      {/* Header */}
      <header className="border-b border-border bg-surface/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-primary rounded-lg flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-foreground">MarkIt</span>
          </div>
          
          <nav className="hidden md:flex items-center gap-6">
            <Link to="/features" className="text-muted-foreground hover:text-foreground transition-colors">
              Features
            </Link>
            <Link to="/communities" className="text-muted-foreground hover:text-foreground transition-colors">
              Communities
            </Link>
            <Link to="/pricing" className="text-muted-foreground hover:text-foreground transition-colors">
              Pricing
            </Link>
          </nav>
          
          <div className="flex items-center gap-3">
            <Link to="/auth">
              <Button variant="ghost">Sign In</Button>
            </Link>
            <Link to="/auth">
              <Button variant="hero">Get Started</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative py-20 lg:py-32 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-secondary/5 to-success/5" />
        
        <div className="container mx-auto px-4 relative">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="animate-slide-up">
              <Badge className="mb-4 bg-primary/10 text-primary border-primary/20">
                <Zap className="w-3 h-3 mr-1" />
                AI-Powered Learning
              </Badge>
              
              <h1 className="text-5xl lg:text-6xl font-bold text-foreground mb-6 leading-tight">
                Study Smarter
                <span className="bg-gradient-primary bg-clip-text text-transparent"> Together</span>
              </h1>
              
              <p className="text-xl text-muted-foreground mb-8 leading-relaxed">
                Transform your learning with AI-assisted whiteboards, real-time collaboration, 
                and vibrant study communities. Built for the next generation of students.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 mb-8">
                <Link to="/app">
                  <Button variant="hero" size="lg" className="group">
                    Start a Study Session
                    <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
                <Button variant="outline" size="lg">
                  <Video className="w-4 h-4 mr-2" />
                  Watch Demo
                </Button>
              </div>
              
              <div className="flex items-center gap-6 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <div className="flex -space-x-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-primary border-2 border-background" />
                    <div className="w-8 h-8 rounded-full bg-secondary border-2 border-background" />
                    <div className="w-8 h-8 rounded-full bg-success border-2 border-background" />
                  </div>
                  <span>1000+ active learners</span>
                </div>
                <div className="flex items-center gap-1">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-warning text-warning" />
                  ))}
                  <span className="ml-1">4.9 rating</span>
                </div>
              </div>
            </div>
            
            <div className="relative animate-float">
              <img 
                src={heroImage} 
                alt="Students collaborating on MarkIt platform"
                className="rounded-2xl shadow-hover w-full"
              />
              <div className="absolute inset-0 bg-gradient-primary/10 rounded-2xl" />
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-surface">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-foreground mb-4">
              Everything you need to excel
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
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
                color: "text-primary"
              },
              {
                icon: Users,
                title: "Real-time Collaboration", 
                description: "Work together on the same whiteboard with friends. See cursors, changes, and presence live.",
                color: "text-secondary"
              },
              {
                icon: MessageSquare,
                title: "Smart Chat",
                description: "DM friends, join study rooms, and get help in context-aware conversations.",
                color: "text-success"
              },
              {
                icon: Video,
                title: "Voice & Video Calls",
                description: "Jump into voice calls instantly during study sessions for better collaboration.",
                color: "text-warning"
              },
              {
                icon: Target,
                title: "AP Course Communities",
                description: "Join dedicated rooms for AP Calculus, Physics, and more with expert moderation.",
                color: "text-danger"
              },
              {
                icon: Gamepad2,
                title: "Gamified Learning",
                description: "Track streaks, earn achievements, and compete with friends to stay motivated.",
                color: "text-primary"
              }
            ].map((feature, index) => (
              <Card key={index} className="p-6 bg-card hover:bg-card-hover transition-all duration-200 hover:shadow-card group cursor-pointer">
                <feature.icon className={`w-12 h-12 ${feature.color} mb-4 group-hover:scale-110 transition-transform`} />
                <h3 className="text-xl font-semibold text-foreground mb-2">{feature.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-primary/5" />
        <div className="container mx-auto px-4 text-center relative">
          <h2 className="text-4xl lg:text-5xl font-bold text-foreground mb-6">
            Ready to transform your learning?
          </h2>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Join thousands of students already using MarkIt to collaborate, 
            learn faster, and achieve their academic goals.
          </p>
          <Link to="/auth">
            <Button variant="hero" size="lg" className="animate-pulse-glow">
              Get Started for Free
              <ChevronRight className="w-5 h-5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-surface py-12">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center gap-2 mb-4 md:mb-0">
              <div className="w-8 h-8 bg-gradient-primary rounded-lg flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-foreground">MarkIt</span>
            </div>
            
            <div className="flex gap-6 text-sm text-muted-foreground">
              <Link to="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
              <Link to="/terms" className="hover:text-foreground transition-colors">Terms</Link>
              <Link to="/support" className="hover:text-foreground transition-colors">Support</Link>
            </div>
          </div>
          
          <div className="border-t border-border mt-8 pt-8 text-center text-sm text-muted-foreground">
            © 2024 MarkIt. Building the future of collaborative learning.
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;