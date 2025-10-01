import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  BookOpen, 
  Users,
  Plus, 
  Search,
  Bell,
  Settings
} from "lucide-react";
import { Link } from "react-router-dom";
import { useState } from "react";

const Communities = () => {
  const [searchQuery, setSearchQuery] = useState("");
  // AP Course Communities organized by subject
  const courseCategories = [
    {
      category: "Math and Computer Science",
      courses: [
        { id: 1, name: "AP Calculus AB" },
        { id: 2, name: "AP Calculus BC" },
        { id: 4, name: "AP Computer Science A" },
        { id: 5, name: "AP Computer Science Principles" },
        { id: 6, name: "AP Precalculus" },
        { id: 7, name: "AP Statistics" }
      ]
    },
    {
      category: "Sciences",
      courses: [
        { id: 8, name: "AP Biology" },
        { id: 9, name: "AP Chemistry" },
        { id: 10, name: "AP Environmental Science" },
        { id: 11, name: "AP Physics 1: Algebra-Based" },
        { id: 12, name: "AP Physics 2: Algebra-Based" },
        { id: 13, name: "AP Physics C: Electricity and Magnetism" },
        { id: 14, name: "AP Physics C: Mechanics" }
      ]
    },
    {
      category: "SAT Prep",
      courses: [
        { id: 15, name: "SAT Math" },
        { id: 16, name: "SAT Reading and Writing" }
      ]
    }
  ];

  // Filter courses based on search query
  const filteredCategories = courseCategories.map(category => ({
    ...category,
    courses: category.courses.filter(course =>
      course.name.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })).filter(category => category.courses.length > 0);

  

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
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
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

            {/* AP Courses Grid */}
            <div className="grid md:grid-cols-2 gap-8">
              {filteredCategories.length > 0 ? (
                filteredCategories.map((category) => (
                <div key={category.category} className="space-y-4">
                  <h2 className="text-2xl font-bold text-home-foreground border-t-4 border-gray-900 pt-4">
                    {category.category}
                  </h2>
                  <div className="space-y-3">
                    {category.courses.map((course) => (
                      <Link 
                        key={course.id}
                        to={`/course/${course.id}`}
                        className="flex items-center justify-between p-4 bg-white border-b border-gray-200 hover:bg-gray-50 transition-colors group"
                      >
                        <span className="text-home-foreground font-medium">{course.name}</span>
                        <span className="text-gray-400 group-hover:text-home-primary transition-colors">›</span>
                      </Link>
                    ))}
                  </div>
                </div>
              ))
              ) : (
                <div className="col-span-2 text-center py-12 text-gray-600">
                  <p>No communities found matching "{searchQuery}"</p>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
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