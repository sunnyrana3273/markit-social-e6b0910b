import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Sparkles, 
  Users, 
  MessageSquare, 
  Video,
  Gamepad2,
  Target,
  Zap,
  Clock,
  Shield,
  Globe,
  TrendingUp,
  CheckCircle2,
  ChevronRight,
  Book
} from "lucide-react";
import { Link } from "react-router-dom";

const Features = () => {
  return (
    <div className="min-h-screen bg-home-background font-lexend force-light-mode">
      {/* Header */}
      <header className="border-b border-gray-200 bg-home-surface/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-1.5">
            <div className="w-8 h-8 flex items-center justify-center">
              <Book className="w-5 h-5 text-home-primary " />
            </div>
            <span className="text-xl font-bold text-home-foreground">MarkIt</span>
          </Link>
          
          <nav className="hidden md:flex items-center gap-6">
            <Link to="/features" className="text-home-primary font-semibold">
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
        
        <div className="container mx-auto px-4 relative">
          <div className="max-w-4xl mx-auto text-center">
            <Badge className="mb-4 bg-home-primary/10 text-home-primary border-home-primary/20">
              <Sparkles className="w-3 h-3 mr-1" />
              Complete Feature Set
            </Badge>
            
            <h1 className="text-4xl lg:text-6xl font-bold text-home-foreground mb-6 leading-tight">
              Everything you need to
              <br />
              <span className="text-gradient font-homemade">excel in learning</span>
            </h1>
            
            <p className="text-xl text-gray-600 mb-8 leading-relaxed max-w-2xl mx-auto">
              MarkIt combines AI-powered assistance, real-time collaboration, and engaging study tools 
              to create the ultimate learning platform for students.
            </p>
            
            <Link to="/auth">
              <Button size="lg" className="group bg-home-primary hover:bg-home-primary-hover text-white">
                Start Learning Today
                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Core Features */}
      <section className="py-20 bg-home-surface">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-home-foreground mb-4">
              Core Features
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Powerful tools designed to enhance your learning experience
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                icon: Sparkles,
                title: "AI Vision Assistant",
                description: "Advanced AI that can see and understand your work. Select any problem on the whiteboard and get instant, context-aware help with step-by-step explanations.",
                features: ["Image recognition", "Step-by-step solutions", "Multiple subject support", "Natural language interaction"]
              },
              {
                icon: Users,
                title: "Real-time Collaboration", 
                description: "Work together seamlessly with friends. See live cursors, changes, and presence indicators as you study together on the same whiteboard.",
                features: ["Live cursor tracking", "Instant synchronization", "Presence indicators", "Conflict-free editing"]
              },
              {
                icon: MessageSquare,
                title: "Smart Chat System",
                description: "DM friends, create study groups, and get help in context-aware conversations. AI understands your study context and provides relevant assistance.",
                features: ["Direct messaging", "Group chats", "Context-aware AI", "File sharing"]
              },
              {
                icon: Video,
                title: "Voice Calls",
                description: "Jump into high-quality voice calls instantly during study sessions. Perfect for explaining complex problems or group study.",
                features: ["HD video calls", "Crystal-clear audio", "Screen sharing", "Recording options"]
              },
              {
                icon: Target,
                title: "AP Course Communities",
                description: "Join dedicated communities for AP Calculus, Physics, Chemistry, and more. Connect with peers and expert moderators in your subject areas.",
                features: ["Subject-specific rooms", "Expert moderation", "Resource sharing", "Study schedules"]
              },
              {
                icon: Gamepad2,
                title: "Gamified Learning",
                description: "Stay motivated with achievement badges, study streaks, leaderboards, and challenges. Make learning fun while tracking your progress.",
                features: ["Daily streaks", "Achievement badges", "Leaderboards", "Study challenges"]
              }
            ].map((feature, index) => {
              const IconComponent = feature.icon;
              return (
                <Card key={index} className="p-8 bg-white hover:shadow-xl transition-all duration-200 border border-gray-200">
                  <div className="mb-4">
                    <div className="w-14 h-14 bg-home-primary/10 rounded-xl flex items-center justify-center mb-4">
                      <IconComponent className="w-8 h-8 text-home-primary" />
                    </div>
                    <h3 className="text-2xl font-semibold text-home-foreground mb-3">{feature.title}</h3>
                    <p className="text-gray-600 leading-relaxed mb-4">{feature.description}</p>
                  </div>
                  <ul className="space-y-2">
                    {feature.features.map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                        <CheckCircle2 className="w-4 h-4 text-home-primary flex-shrink-0 mt-0.5" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Advanced Features */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-home-foreground mb-4">
              Advanced Capabilities
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Professional-grade tools for serious learners
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {[
              {
                icon: Clock,
                title: "Smart Scheduling",
                description: "AI-powered study scheduling that adapts to your learning patterns and optimizes your study time for maximum retention.",
              },
              {
                icon: Shield,
                title: "Privacy & Security",
                description: "Your data is encrypted and secure. We never share your information and you have full control over your privacy settings.",
              },
              {
                icon: Globe,
                title: "Multi-Platform Access",
                description: "Access your study sessions from any device. Your work is automatically synced across desktop, tablet, and mobile.",
              },
              {
                icon: TrendingUp,
                title: "Progress Analytics",
                description: "Track your learning progress with detailed analytics. See which subjects need more attention and celebrate your achievements.",
              },
              {
                icon: Zap,
                title: "Instant Feedback",
                description: "Get real-time feedback on your work. AI checks your solutions and provides guidance to help you learn faster.",
              },
              {
                icon: Target,
                title: "Resource Library",
                description: "Access a curated library of study materials, practice problems, and educational resources across all subjects.",
              }
            ].map((feature, index) => {
              const IconComponent = feature.icon;
              return (
                <Card key={index} className="p-6 bg-home-surface border-gray-200 hover:shadow-lg transition-all">
                  <div className="flex gap-4">
                    <div className="w-12 h-12 bg-home-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                      <IconComponent className="w-6 h-6 text-home-primary" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-home-foreground mb-2">{feature.title}</h3>
                      <p className="text-gray-600 leading-relaxed">{feature.description}</p>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 relative overflow-hidden bg-home-surface">
        <div className="absolute inset-0 bg-gradient-to-br from-home-primary/5 to-home-secondary/5" />
        <div className="container mx-auto px-4 text-center relative">
          <h2 className="text-4xl lg:text-5xl font-bold text-home-foreground mb-6">
            Ready to experience all features?
          </h2>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            Start with a free account and unlock the full power of AI-assisted learning.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/auth">
              <Button size="lg" className="bg-home-primary hover:bg-home-primary-hover text-white shadow-lg">
                Get Started Free
                <ChevronRight className="w-5 h-5" />
              </Button>
            </Link>
            <Link to="/pricing">
              <Button size="lg" variant="outline" className="border-home-primary text-home-primary hover:bg-home-primary hover:text-white">
                View Pricing
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white py-12">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <Link to="/" className="flex items-center gap-1.5 mb-4 md:mb-0">
              <div className="w-8 h-8 flex items-center justify-center">
                <Book className="w-5 h-5 text-home-primary " />
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

export default Features;
