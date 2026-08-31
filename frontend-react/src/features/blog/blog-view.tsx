import { useState } from "react";
import { motion } from "motion/react";
import {
  BookOpen,
  Clock,
  User,
  ArrowRight,
  Search,
  TrendingUp,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StaggerContainer, StaggerItem } from "@/components/ui/motion";
import { SectionHeader } from "@/components/ui/dashboard";

const blogPosts = [
  {
    id: "post_1",
    title: "The Rise of Deepfake Scams in 2025",
    excerpt: "How criminals are using AI to impersonate executives and steal millions. A deep dive into the latest attack vectors and how to protect yourself.",
    author: "Dr. Sarah Chen",
    date: "2025-08-15",
    readTime: "5 min",
    category: "Threats",
    featured: true,
    image: "https://images.unsplash.com/photo-1555949963-aa79dcee981c?w=800&h=400&fit=crop",
  },
  {
    id: "post_2",
    title: "How We Detected a State-Sponsored Deepfake Campaign",
    excerpt: "Our research team uncovered a sophisticated operation targeting journalists across three continents. Here's how we did it.",
    author: "Enclave Research",
    date: "2025-08-01",
    readTime: "8 min",
    category: "Case Study",
    featured: false,
    image: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=800&h=400&fit=crop",
  },
  {
    id: "post_3",
    title: "Voice Cloning: The Next Frontier of Fraud",
    excerpt: "With just 3 seconds of audio, attackers can now clone your voice. We tested the latest detection methods.",
    author: "Dr. Michael Park",
    date: "2025-07-20",
    readTime: "6 min",
    category: "Research",
    featured: false,
    image: "https://images.unsplash.com/photo-1589903308904-1010c2294adc?w=800&h=400&fit=crop",
  },
  {
    id: "post_4",
    title: "Deepfake vs. Deepfake: When AI Fights AI",
    excerpt: "The arms race between deepfake generators and detectors is intensifying. Who's winning?",
    author: "Enclave Research",
    date: "2025-07-10",
    readTime: "7 min",
    category: "AI",
    featured: false,
    image: "https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800&h=400&fit=crop",
  },
  {
    id: "post_5",
    title: "Protecting Your Digital Identity in 2025",
    excerpt: "10 practical steps to safeguard your online presence from deepfake threats.",
    author: "Security Team",
    date: "2025-06-28",
    readTime: "4 min",
    category: "Guide",
    featured: false,
    image: "https://images.unsplash.com/photo-1563986768609-322da13575f2?w=800&h=400&fit=crop",
  },
];

const categories = ["All", "Threats", "Case Study", "Research", "AI", "Guide"];

export function BlogView() {
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredPosts = blogPosts.filter(post => {
    if (selectedCategory !== "All" && post.category !== selectedCategory) return false;
    if (searchQuery && !post.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const featuredPost = blogPosts.find(p => p.featured);
  const regularPosts = filteredPosts.filter(p => !p.featured || selectedCategory !== "All");

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 p-6">
      <SectionHeader icon={BookOpen} title="Blog & Insights" description="Research, case studies, and threat analysis" />

      {/* Featured Post */}
      {selectedCategory === "All" && featuredPost && !searchQuery && (
        <StaggerItem>
          <Card className="bg-white/5 border-white/10 overflow-hidden hover:bg-white/[0.07] transition-colors cursor-pointer">
            <div className="md:flex">
              <div className="md:w-1/2 h-48 md:h-auto bg-gradient-to-br from-cyan-500/20 to-violet-500/20 flex items-center justify-center">
                <TrendingUp className="w-16 h-16 text-cyan-400/50" />
              </div>
              <CardContent className="p-6 md:w-1/2">
                <Badge className="bg-cyan-500/10 text-cyan-400 border-cyan-500/20 mb-3">Featured</Badge>
                <h2 className="text-2xl font-bold text-white mb-2">{featuredPost.title}</h2>
                <p className="text-white/60 mb-4">{featuredPost.excerpt}</p>
                <div className="flex items-center gap-4 text-sm text-white/40">
                  <span className="flex items-center gap-1"><User className="w-3 h-3" />{featuredPost.author}</span>
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{featuredPost.readTime}</span>
                  <span>{featuredPost.date}</span>
                </div>
                <Button className="mt-4 bg-cyan-500 text-black">
                  Read More <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </CardContent>
            </div>
          </Card>
        </StaggerItem>
      )}

      {/* Search & Filter */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
          <Input placeholder="Search articles..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-10 bg-white/5 border-white/10 text-white" />
        </div>
        <div className="flex gap-1 flex-wrap">
          {categories.map(cat => (
            <Button key={cat} onClick={() => setSelectedCategory(cat)} size="sm" variant={selectedCategory === cat ? "default" : "ghost"} className={selectedCategory === cat ? "bg-cyan-500 text-black" : "text-white/60"}>
              {cat}
            </Button>
          ))}
        </div>
      </div>

      {/* Posts Grid */}
      <StaggerContainer className="grid grid-cols-2 gap-4">
        {regularPosts.map(post => (
          <StaggerItem key={post.id}>
            <Card className="bg-white/5 border-white/10 hover:bg-white/[0.07] transition-colors cursor-pointer h-full">
              <div className="h-32 bg-gradient-to-br from-white/5 to-white/10 flex items-center justify-center">
                <BookOpen className="w-8 h-8 text-white/20" />
              </div>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Badge className="bg-white/5 text-white/60 border-white/10">{post.category}</Badge>
                  <span className="text-xs text-white/40">{post.date}</span>
                </div>
                <h3 className="font-semibold text-white mb-1">{post.title}</h3>
                <p className="text-sm text-white/60 line-clamp-2">{post.excerpt}</p>
                <div className="flex items-center gap-3 mt-3 text-xs text-white/40">
                  <span className="flex items-center gap-1"><User className="w-3 h-3" />{post.author}</span>
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{post.readTime}</span>
                </div>
              </CardContent>
            </Card>
          </StaggerItem>
        ))}
      </StaggerContainer>

      {filteredPosts.length === 0 && (
        <Card className="bg-white/5 border-white/10">
          <CardContent className="p-8 text-center">
            <BookOpen className="w-10 h-10 text-white/20 mx-auto mb-3" />
            <p className="text-white/60">No articles found</p>
          </CardContent>
        </Card>
      )}
    </motion.div>
  );
}
