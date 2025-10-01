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
  Target,
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
  Upload,
  Settings,
  Bell,
  Heart,
  Trophy,
  Lock,
  CheckCircle
} from "lucide-react";
import { Link } from "react-router-dom";

const Features = () => {
  const mainFeatures = [
    {
      icon: Sparkles,
      title: "AI Assistant",
      description: "Get instant help with problems using our advanced vision AI. Just select and ask!",
      color: "text-home-primary",
      details: [
        "Visual problem recognition",
        "Step-by-step solutions",
        "Multiple subject support",
        "Context-aware responses"
      ]
    },
    {
      icon: Users,
      title: "Real-time Collaboration", 
      description: "Work together on the same whiteboard with friends. See cursors, changes, and presence live.",
      color: "text-home-secondary",
      details: [
        "Live cursor tracking",
        "Instant synchronization",
        "Presence indicators",
        "Conflict resolution"
      ]
    },
    {
      icon: MessageSquare,
      title: "Smart Chat",
      description: "DM friends, join study rooms, and get help in context-aware conversations.",
      color: "text-green-600",
      details: [
        "Context-aware messaging",
        "Study room integration",
        "File sharing",
        "Message history"
      ]
    },
    {
      icon: Video,
      title: "Voice & Video Calls",
      description: "Jump into voice calls instantly during study sessions for better collaboration.",
      color: "text-blue-600",
      details: [
        "HD video quality",
        "Crystal clear audio",
        "Screen sharing",
        "Recording capabilities"
      ]
    },
    {
      icon: Target,
      title: "AP Course Communities",
      description: "Join dedicated rooms for AP Calculus, Physics, and more with expert moderation.",
      color: "text-purple-600",
      details: [
        "Expert moderators",
        "Course-specific content",
        "Study schedules",
        "Practice exams"
      ]
    },
    {
      icon: Gamepad2,
      title: "Gamified Learning",
      description: "Track streaks, earn achievements, and compete with friends to stay motivated.",
      color: "text-orange-600",
      details: [
        "Daily streaks",
        "Achievement badges",
        "Leaderboards",
        "Progress tracking"
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
            <Link to="/features" className="text-home-primary font-medium">
              Features
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
        
        <div className="container mx-auto px-4 relative text-center">
          <Badge className="mb-4 bg-home-primary/10 text-home-primary border-home-primary/20 hover:bg-home-primary hover:text-white transition-colors duration-200 cursor-pointer">
            <Zap className="w-3 h-3 mr-1" />
            Powerful Features
          </Badge>
          
          <h1 className="text-4xl lg:text-6xl font-bold text-home-foreground mb-6 leading-tight font-lexend">
            Everything you need to
            <br />
            <span className="text-gradient font-homemade">excel in your studies</span>
          </h1>
          
          <p className="text-xl text-gray-600 mb-8 leading-relaxed max-w-3xl mx-auto">
            From AI-powered assistance to real-time collaboration, MarkIt brings the future of education 
            to your fingertips with tools designed for modern learners.
          </p>
        </div>
      </section>

      {/* Main Features Section */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-home-foreground mb-4">
              Core Features
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              The essential tools that make MarkIt the perfect study companion
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {mainFeatures.map((feature, index) => {
              const IconComponent = feature.icon;
              return (
                <Card key={index} className="p-8 bg-white hover:bg-gray-50 transition-all duration-200 hover:shadow-lg group cursor-pointer border border-gray-200">
                  <IconComponent className={`w-16 h-16 ${feature.color} mb-6 group-hover:scale-110 transition-transform`} />
                  <h3 className="text-2xl font-semibold text-home-foreground mb-4">{feature.title}</h3>
                  <p className="text-gray-600 leading-relaxed mb-6">{feature.description}</p>
                  
                  <ul className="space-y-2">
                    {feature.details.map((detail, detailIndex) => (
                      <li key={detailIndex} className="flex items-center gap-2 text-sm text-gray-600">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        {detail}
                      </li>
                    ))}
                  </ul>
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
            Ready to experience these features?
          </h2>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            Join thousands of students already using MarkIt to collaborate, 
            learn faster, and achieve their academic goals.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/auth">
              <Button size="lg" className="bg-home-primary hover:bg-home-primary-hover text-white shadow-lg hover:shadow-xl transition-all duration-200">
                Get Started for Free
                <ChevronRight className="w-5 h-5" />
              </Button>
            </Link>
            <Link to="/pricing">
              <Button variant="outline" size="lg" className="border-home-primary text-home-primary hover:bg-home-primary hover:text-white">
                View Pricing
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

export default Features;
