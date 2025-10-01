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
    <div className="min-h-screen bg-home-background font-lexend">
      {/* Header */}
      <header className="border-b border-gray-200 bg-home-surface/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-home-primary rounded-lg flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-home-foreground font-homemade">MarkIt</span>
            </Link>
            
            <nav className="hidden md:flex items-center gap-4">
              <Link to="/app">
                <Button variant="ghost" className="text-home-foreground hover:bg-home-surface">Dashboard</Button>
              </Link>
              <Link to="/communities">
                <Button variant="ghost" className="text-home-foreground hover:bg-home-surface">Communities</Button>
              </Link>
              <Link to="/friends">
                <Button variant="ghost" className="text-home-foreground hover:bg-home-surface">Friends</Button>
              </Link>
            </nav>
          </div>
          
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="text-home-foreground hover:bg-home-surface">
              <Bell className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="icon" className="text-home-foreground hover:bg-home-surface">
              <Settings className="w-5 h-5" />
            </Button>
            <div className="w-8 h-8 rounded-full bg-home-primary flex items-center justify-center">
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
                <h1 className="text-3xl font-bold text-home-foreground">Welcome back, John!</h1>
                <p className="text-gray-600">Ready to continue your learning journey?</p>
              </div>
              <Link to="/session/new">
                <Button className="group bg-home-primary hover:bg-home-primary-hover text-white">
                  <Plus className="w-5 h-5 mr-2" />
                  New Session
                </Button>
              </Link>
            </div>

            {/* Stats Cards */}
            <div className="grid md:grid-cols-4 gap-4">
              <Card className="p-4 bg-home-primary text-white">
                <div className="flex items-center gap-3">
                  <Zap className="w-8 h-8" />
                  <div>
                    <p className="text-sm opacity-90">Current Streak</p>
                    <p className="text-2xl font-bold">{stats.streak} days</p>
                  </div>
                </div>
              </Card>
              
              <Card className="p-4 bg-home-secondary text-white">
                <div className="flex items-center gap-3">
                  <Clock className="w-8 h-8" />
                  <div>
                    <p className="text-sm opacity-90">Minutes Today</p>
                    <p className="text-2xl font-bold">{stats.minutesStudied}m</p>
                  </div>
                </div>
              </Card>
              
              <Card className="p-4 bg-white border border-gray-200">
                <div className="flex items-center gap-3">
                  <Trophy className="w-8 h-8 text-yellow-600" />
                  <div>
                    <p className="text-sm text-gray-600">Problems Solved</p>
                    <p className="text-2xl font-bold text-home-foreground">{stats.problemsSolved}</p>
                  </div>
                </div>
              </Card>
              
              <Card className="p-4 bg-white border border-gray-200">
                <div className="flex items-center gap-3">
                  <Users className="w-8 h-8 text-home-secondary" />
                  <div>
                    <p className="text-sm text-gray-600">Sessions Joined</p>
                    <p className="text-2xl font-bold text-home-foreground">{stats.sessionsJoined}</p>
                  </div>
                </div>
              </Card>
            </div>

            {/* Recent Sessions */}
            <Card className="p-6 bg-white border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-home-foreground">Recent Sessions</h2>
                <Link to="/sessions">
                  <Button variant="ghost" className="text-home-foreground hover:bg-home-surface">View All</Button>
                </Link>
              </div>
              
              <div className="space-y-3">
                {recentSessions.map((session) => (
                  <div key={session.id} className="flex items-center justify-between p-4 bg-home-surface rounded-lg hover:bg-gray-100 transition-colors cursor-pointer">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-home-primary rounded-lg flex items-center justify-center">
                        <BookOpen className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h3 className="font-medium text-home-foreground">{session.title}</h3>
                        <div className="flex items-center gap-3 text-sm text-gray-600">
                          <span>{session.participants} participants</span>
                          <span>•</span>
                          <span>{session.lastActive}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className="bg-home-secondary/10 text-home-secondary border-home-secondary/20">{session.course}</Badge>
                      <Button variant="outline" size="sm" className="border-home-primary text-home-primary hover:bg-home-primary hover:text-white">
                        Join
                      </Button>
                    </div>
                  </div>
                ))}
                
                {recentSessions.length === 0 && (
                  <div className="text-center py-8 text-gray-600">
                    <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No recent sessions. Start your first study session!</p>
                  </div>
                )}
              </div>
            </Card>

            {/* Quick Actions */}
            <Card className="p-6 bg-white border border-gray-200">
              <h2 className="text-xl font-semibold text-home-foreground mb-4">Quick Actions</h2>
              <div className="grid md:grid-cols-3 gap-4">
                <Link to="/session/new">
                  <Button variant="outline" className="w-full h-20 flex-col border-home-primary text-home-primary hover:bg-home-primary hover:text-white">
                    <Plus className="w-6 h-6 mb-2" />
                    Create Session
                  </Button>
                </Link>
                <Link to="/communities">
                  <Button variant="outline" className="w-full h-20 flex-col border-home-secondary text-home-secondary hover:bg-home-secondary hover:text-white">
                    <Users className="w-6 h-6 mb-2" />
                    Browse Communities
                  </Button>
                </Link>
                <Link to="/upload">
                  <Button variant="outline" className="w-full h-20 flex-col border-gray-300 text-gray-600 hover:bg-gray-100">
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
            <Card className="p-6 bg-white border border-gray-200">
              <h3 className="font-semibold text-home-foreground mb-4">Friends</h3>
              <div className="space-y-3">
                {friends.map((friend) => (
                  <div key={friend.id} className="flex items-center gap-3">
                    <div className="relative">
                      <div className="w-8 h-8 rounded-full bg-home-secondary flex items-center justify-center">
                        <span className="text-xs font-medium text-white">{friend.avatar}</span>
                      </div>
                      <div className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-white ${
                        friend.status === 'online' ? 'bg-green-500' : 
                        friend.status === 'studying' ? 'bg-yellow-500' : 'bg-gray-400'
                      }`} />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-home-foreground">{friend.name}</p>
                      <p className="text-xs text-gray-600 capitalize">{friend.status}</p>
                    </div>
                    <Button variant="ghost" size="sm" className="text-home-foreground hover:bg-home-surface">
                      <MessageSquare className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <Link to="/friends">
                <Button variant="outline" className="w-full mt-4 border-home-primary text-home-primary hover:bg-home-primary hover:text-white">
                  View All Friends
                </Button>
              </Link>
            </Card>

            {/* Achievement Card */}
            <Card className="p-6 bg-home-primary text-white">
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