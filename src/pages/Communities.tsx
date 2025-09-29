import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  BookOpen, 
  Users, 
  Plus, 
  Search,
  Clock,
  Star,
  MessageSquare,
  Settings,
  Bell
} from "lucide-react";
import { Link } from "react-router-dom";

const Communities = () => {
  // Mock data - will be replaced with real data from Supabase
  const communities = [
    { 
      id: 1, 
      name: "AP Calculus Study Group", 
      members: 245, 
      description: "Master calculus concepts together with guided practice sessions",
      course: "AP Calculus AB",
      activity: "Very Active",
      rating: 4.8,
      isJoined: true
    },
    { 
      id: 2, 
      name: "Physics Problem Solvers", 
      members: 189, 
      description: "Tackle challenging physics problems step by step",
      course: "AP Physics 1",
      activity: "Active",
      rating: 4.6,
      isJoined: false
    },
    { 
      id: 3, 
      name: "Chemistry Lab Partners", 
      members: 156, 
      description: "Virtual chemistry lab sessions and concept discussions",
      course: "AP Chemistry",
      activity: "Moderate",
      rating: 4.5,
      isJoined: false
    },
    { 
      id: 4, 
      name: "SAT Math Mastery", 
      members: 432, 
      description: "Comprehensive SAT math preparation with practice tests",
      course: "SAT Prep",
      activity: "Very Active",
      rating: 4.9,
      isJoined: true
    },
  ];

  const myCommunitiesCount = communities.filter(c => c.isJoined).length;

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
                <Button variant="ghost" className="text-home-foreground hover:bg-home-surface bg-home-surface">Communities</Button>
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
            {/* Header Section */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-home-foreground">Communities</h1>
                <p className="text-gray-600">Connect with fellow learners and join study groups</p>
              </div>
              <Button className="bg-home-primary hover:bg-home-primary-hover text-white">
                <Plus className="w-5 h-5 mr-2" />
                Create Community
              </Button>
            </div>

            {/* Search and Filters */}
            <Card className="p-6 bg-white border border-gray-200">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <Input 
                    placeholder="Search communities..." 
                    className="pl-10 border-gray-200 focus:border-home-primary"
                  />
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="border-home-primary text-home-primary hover:bg-home-primary hover:text-white">
                    All Subjects
                  </Button>
                  <Button variant="outline" className="border-gray-300 text-gray-600 hover:bg-gray-100">
                    AP Courses
                  </Button>
                  <Button variant="outline" className="border-gray-300 text-gray-600 hover:bg-gray-100">
                    SAT Prep
                  </Button>
                </div>
              </div>
            </Card>

            {/* Communities Grid */}
            <div className="grid md:grid-cols-2 gap-6">
              {communities.map((community) => (
                <Card key={community.id} className="p-6 bg-white border border-gray-200 hover:shadow-lg transition-shadow">
                  <div className="space-y-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="text-xl font-semibold text-home-foreground">{community.name}</h3>
                          {community.isJoined && (
                            <Badge className="bg-home-primary/10 text-home-primary border-home-primary/20">
                              Joined
                            </Badge>
                          )}
                        </div>
                        <p className="text-gray-600 text-sm mb-3">{community.description}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <div className="flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        <span>{community.members} members</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        <span>{community.activity}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Star className="w-4 h-4 text-yellow-500" />
                        <span>{community.rating}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <Badge className="bg-home-secondary/10 text-home-secondary border-home-secondary/20">
                        {community.course}
                      </Badge>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="border-gray-300 text-gray-600 hover:bg-gray-100">
                          <MessageSquare className="w-4 h-4" />
                        </Button>
                        {community.isJoined ? (
                          <Button size="sm" className="bg-home-primary hover:bg-home-primary-hover text-white">
                            Open
                          </Button>
                        ) : (
                          <Button variant="outline" size="sm" className="border-home-primary text-home-primary hover:bg-home-primary hover:text-white">
                            Join
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* My Communities */}
            <Card className="p-6 bg-white border border-gray-200">
              <h3 className="font-semibold text-home-foreground mb-4">My Communities</h3>
              <div className="text-center py-4">
                <div className="w-16 h-16 bg-home-primary rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-2xl font-bold text-white">{myCommunitiesCount}</span>
                </div>
                <p className="text-sm text-gray-600">Communities Joined</p>
              </div>
              <Button variant="outline" className="w-full border-home-primary text-home-primary hover:bg-home-primary hover:text-white">
                View My Communities
              </Button>
            </Card>

            {/* Popular Subjects */}
            <Card className="p-6 bg-white border border-gray-200">
              <h3 className="font-semibold text-home-foreground mb-4">Popular Subjects</h3>
              <div className="space-y-3">
                {[
                  { name: "AP Calculus", count: 12 },
                  { name: "AP Physics", count: 8 },
                  { name: "SAT Prep", count: 15 },
                  { name: "AP Chemistry", count: 6 },
                  { name: "AP Biology", count: 9 }
                ].map((subject, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <span className="text-sm text-home-foreground">{subject.name}</span>
                    <Badge variant="secondary" className="bg-home-surface text-gray-600">
                      {subject.count}
                    </Badge>
                  </div>
                ))}
              </div>
            </Card>

            {/* Community Tips */}
            <Card className="p-6 bg-home-primary text-white">
              <div className="text-center">
                <Users className="w-12 h-12 mx-auto mb-3" />
                <h3 className="font-semibold mb-2">Join Active Communities</h3>
                <p className="text-sm opacity-90">Connect with peers studying similar subjects for better learning outcomes!</p>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Communities;