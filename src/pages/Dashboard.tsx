import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  BookOpen, 
  Users, 
  Plus, 
  MessageSquare, 
  Clock,
  Zap,
  Trophy,
  Calendar,
  Settings,
  Bell
} from "lucide-react";
import { Link } from "react-router-dom";

const Dashboard = () => {
  // Mock data - will be replaced with real data from Supabase
  const recentSessions = [
    { id: 1, title: "AP Calculus Study Group", participants: 5, lastActive: "2 hours ago", course: "AP Calculus AB" },
    { id: 2, title: "Physics Problem Solving", participants: 3, lastActive: "1 day ago", course: "AP Physics 1" },
  ];

  const friends = [
    { id: 1, name: "Alex Chen", status: "online", avatar: "AC" },
    { id: 2, name: "Sarah Kim", status: "studying", avatar: "SK" },
    { id: 3, name: "Mike Johnson", status: "offline", avatar: "MJ" },
  ];

  const stats = {
    streak: 7,
    minutesStudied: 120,
    problemsSolved: 15,
    sessionsJoined: 3
  };

  return (
    <div className="min-h-screen bg-gradient-surface">
      {/* Header */}
      <header className="border-b border-border bg-surface/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-primary rounded-lg flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-foreground">MarkIt</span>
            </Link>
            
            <nav className="hidden md:flex items-center gap-4">
              <Link to="/app">
                <Button variant="ghost">Dashboard</Button>
              </Link>
              <Link to="/communities">
                <Button variant="ghost">Communities</Button>
              </Link>
              <Link to="/friends">
                <Button variant="ghost">Friends</Button>
              </Link>
            </nav>
          </div>
          
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon">
              <Bell className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="icon">
              <Settings className="w-5 h-5" />
            </Button>
            <div className="w-8 h-8 rounded-full bg-gradient-primary flex items-center justify-center">
              <span className="text-white text-sm font-medium">JD</span>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-4 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-3 space-y-6">
            {/* Welcome Section */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-foreground">Welcome back, John!</h1>
                <p className="text-muted-foreground">Ready to continue your learning journey?</p>
              </div>
              <Link to="/session/new">
                <Button variant="hero" className="group">
                  <Plus className="w-5 h-5 mr-2" />
                  New Session
                </Button>
              </Link>
            </div>

            {/* Stats Cards */}
            <div className="grid md:grid-cols-4 gap-4">
              <Card className="p-4 bg-gradient-primary text-white">
                <div className="flex items-center gap-3">
                  <Zap className="w-8 h-8" />
                  <div>
                    <p className="text-sm opacity-90">Current Streak</p>
                    <p className="text-2xl font-bold">{stats.streak} days</p>
                  </div>
                </div>
              </Card>
              
              <Card className="p-4 bg-gradient-success text-white">
                <div className="flex items-center gap-3">
                  <Clock className="w-8 h-8" />
                  <div>
                    <p className="text-sm opacity-90">Minutes Today</p>
                    <p className="text-2xl font-bold">{stats.minutesStudied}m</p>
                  </div>
                </div>
              </Card>
              
              <Card className="p-4 bg-card">
                <div className="flex items-center gap-3">
                  <Trophy className="w-8 h-8 text-warning" />
                  <div>
                    <p className="text-sm text-muted-foreground">Problems Solved</p>
                    <p className="text-2xl font-bold text-foreground">{stats.problemsSolved}</p>
                  </div>
                </div>
              </Card>
              
              <Card className="p-4 bg-card">
                <div className="flex items-center gap-3">
                  <Users className="w-8 h-8 text-secondary" />
                  <div>
                    <p className="text-sm text-muted-foreground">Sessions Joined</p>
                    <p className="text-2xl font-bold text-foreground">{stats.sessionsJoined}</p>
                  </div>
                </div>
              </Card>
            </div>

            {/* Recent Sessions */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-foreground">Recent Sessions</h2>
                <Link to="/sessions">
                  <Button variant="ghost">View All</Button>
                </Link>
              </div>
              
              <div className="space-y-3">
                {recentSessions.map((session) => (
                  <div key={session.id} className="flex items-center justify-between p-4 bg-surface rounded-lg hover:bg-surface-hover transition-colors cursor-pointer">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-gradient-primary rounded-lg flex items-center justify-center">
                        <BookOpen className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h3 className="font-medium text-foreground">{session.title}</h3>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                          <span>{session.participants} participants</span>
                          <span>•</span>
                          <span>{session.lastActive}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="secondary">{session.course}</Badge>
                      <Button variant="outline" size="sm">
                        Join
                      </Button>
                    </div>
                  </div>
                ))}
                
                {recentSessions.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No recent sessions. Start your first study session!</p>
                  </div>
                )}
              </div>
            </Card>

            {/* Quick Actions */}
            <Card className="p-6">
              <h2 className="text-xl font-semibold text-foreground mb-4">Quick Actions</h2>
              <div className="grid md:grid-cols-3 gap-4">
                <Link to="/session/new">
                  <Button variant="outline" className="w-full h-20 flex-col">
                    <Plus className="w-6 h-6 mb-2" />
                    Create Session
                  </Button>
                </Link>
                <Link to="/communities">
                  <Button variant="outline" className="w-full h-20 flex-col">
                    <Users className="w-6 h-6 mb-2" />
                    Browse Communities
                  </Button>
                </Link>
                <Link to="/upload">
                  <Button variant="outline" className="w-full h-20 flex-col">
                    <Calendar className="w-6 h-6 mb-2" />
                    Upload Document
                  </Button>
                </Link>
              </div>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Friends Online */}
            <Card className="p-6">
              <h3 className="font-semibold text-foreground mb-4">Friends</h3>
              <div className="space-y-3">
                {friends.map((friend) => (
                  <div key={friend.id} className="flex items-center gap-3">
                    <div className="relative">
                      <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                        <span className="text-xs font-medium">{friend.avatar}</span>
                      </div>
                      <div className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-background ${
                        friend.status === 'online' ? 'bg-success' : 
                        friend.status === 'studying' ? 'bg-warning' : 'bg-muted'
                      }`} />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">{friend.name}</p>
                      <p className="text-xs text-muted-foreground capitalize">{friend.status}</p>
                    </div>
                    <Button variant="ghost" size="sm">
                      <MessageSquare className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <Link to="/friends">
                <Button variant="outline" className="w-full mt-4">
                  View All Friends
                </Button>
              </Link>
            </Card>

            {/* Achievement Card */}
            <Card className="p-6 bg-gradient-success text-white">
              <div className="text-center">
                <Trophy className="w-12 h-12 mx-auto mb-3" />
                <h3 className="font-semibold mb-2">Week Warrior!</h3>
                <p className="text-sm opacity-90">You've maintained your study streak for 7 days straight!</p>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;