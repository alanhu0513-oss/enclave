import { useState, useEffect } from "react";
import { motion } from "motion/react";
import {
  BookOpen,
  Clock,
  User,
  ArrowRight,
  Search,
  TrendingUp,
  ArrowLeft,
  Share2,
  Mail,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StaggerContainer, StaggerItem } from "@/components/ui/motion";
import { SectionHeader } from "@/components/ui/dashboard";
import { api } from "@/lib/api";

interface BlogPost {
  id: string;
  title: string;
  excerpt: string;
  content?: string;
  author: string;
  date: string;
  read_time: string;
  category: string;
  featured: boolean;
  image_url?: string;
}

const fallbackPosts: BlogPost[] = [
  {
    id: "post_1",
    title: "The Rise of Deepfake Scams in 2025",
    excerpt: "How criminals are using AI to impersonate executives and steal millions. A deep dive into the latest attack vectors and how to protect yourself.",
    author: "Dr. Sarah Chen",
    date: "2025-08-15",
    read_time: "5 min",
    category: "Threats",
    featured: true,
  },
  {
    id: "post_2",
    title: "How We Detected a State-Sponsored Deepfake Campaign",
    excerpt: "Our research team uncovered a sophisticated operation targeting journalists across three continents. Here's how we did it.",
    author: "Enclave Research",
    date: "2025-08-01",
    read_time: "8 min",
    category: "Case Study",
    featured: false,
  },
  {
    id: "post_3",
    title: "Voice Cloning: The Next Frontier of Fraud",
    excerpt: "With just 3 seconds of audio, attackers can now clone your voice. We tested the latest detection methods.",
    author: "Dr. Michael Park",
    date: "2025-07-20",
    read_time: "6 min",
    category: "Research",
    featured: false,
  },
];

const categories = ["All", "Threats", "Case Study", "Research", "AI", "Guide"];

function BlogDetail({ post, onBack }: { post: BlogPost; onBack: () => void }) {
  const [newsletterEmail, setNewsletterEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);

  const handleSubscribe = async () => {
    if (!newsletterEmail) return;
    try {
      await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:4000"}/api/education/newsletter`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newsletterEmail }),
      });
      setSubscribed(true);
      setNewsletterEmail("");
    } catch {}
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 p-6 max-w-3xl mx-auto">
      <Button variant="ghost" onClick={onBack} className="text-white/60 hover:text-white -ml-2">
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to Blog
      </Button>

      <article>
        <Badge className="bg-cyan-500/10 text-cyan-400 border-cyan-500/20 mb-3">{post.category}</Badge>
        <h1 className="text-3xl font-bold text-white mb-3">{post.title}</h1>
        <div className="flex items-center gap-4 text-sm text-white/40 mb-6">
          <span className="flex items-center gap-1"><User className="w-3 h-3" />{post.author}</span>
          <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{post.read_time}</span>
          <span>{post.date}</span>
        </div>

        <div className="prose prose-invert max-w-none">
          <p className="text-white/70 text-lg leading-relaxed mb-4">{post.excerpt}</p>
          {post.content ? (
            <div className="text-white/60 whitespace-pre-wrap leading-relaxed">{post.content}</div>
          ) : (
            <div className="text-white/60 leading-relaxed space-y-4">
              <p>The threat landscape for digital identity is evolving faster than ever. In this article, we explore the latest developments in deepfake technology and what they mean for individuals and organizations.</p>
              <h2 className="text-xl font-semibold text-white mt-6">Key Findings</h2>
              <p>Our research team has identified several emerging patterns in how threat actors are deploying AI-generated content. The sophistication of these attacks has increased dramatically, with real-time generation capabilities now accessible to low-skill adversaries.</p>
              <h2 className="text-xl font-semibold text-white mt-6">Detection Methods</h2>
              <p>Enclave's multi-layered detection pipeline combines cloud AI analysis, local ML models, and heuristic analysis to provide comprehensive coverage against modern deepfake attacks. Our approach achieves over 94% accuracy across multiple benchmarks.</p>
              <h2 className="text-xl font-semibold text-white mt-6">Recommendations</h2>
              <ul className="list-disc list-inside space-y-2 text-white/60">
                <li>Enable real-time monitoring for your digital presence</li>
                <li>Use multi-factor authentication on all accounts</li>
                <li>Verify unexpected communications through secondary channels</li>
                <li>Report suspected deepfakes to platform abuse teams immediately</li>
              </ul>
            </div>
          )}
        </div>

        <div className="flex gap-3 mt-8">
          <Button variant="outline" className="border-white/10 text-white/60">
            <Share2 className="w-4 h-4 mr-1" /> Share
          </Button>
        </div>
      </article>

      {/* Newsletter CTA */}
      <Card className="bg-gradient-to-r from-cyan-500/10 to-violet-500/10 border-cyan-500/20">
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
            <Mail className="w-5 h-5" /> Stay Updated
          </h3>
          <p className="text-white/60 text-sm mb-4">Get the latest threat intelligence and security insights delivered to your inbox.</p>
          {subscribed ? (
            <p className="text-cyan-400 text-sm font-medium">Thanks for subscribing!</p>
          ) : (
            <div className="flex gap-2">
              <Input placeholder="your@email.com" value={newsletterEmail} onChange={e => setNewsletterEmail(e.target.value)} className="bg-white/5 border-white/10 text-white flex-1" />
              <Button onClick={handleSubscribe} className="bg-cyan-500 text-black">Subscribe</Button>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

export function BlogView() {
  const [posts, setPosts] = useState<BlogPost[]>(fallbackPosts);
  const [_loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPost, setSelectedPost] = useState<BlogPost | null>(null);

  useEffect(() => {
    api.getBlogPosts()
      .then((data: any) => {
        const fetched = data?.posts || data;
        if (Array.isArray(fetched) && fetched.length > 0) {
          setPosts(fetched.map((p: any) => ({
            id: p.id,
            title: p.title,
            excerpt: p.excerpt || "",
            content: p.content || "",
            author: p.author || "Enclave",
            date: p.date || p.published_at || "",
            read_time: p.read_time || "5 min",
            category: p.category || "General",
            featured: !!p.featured,
            image_url: p.image_url,
          })));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filteredPosts = posts.filter(post => {
    if (selectedCategory !== "All" && post.category !== selectedCategory) return false;
    if (searchQuery && !post.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const featuredPost = posts.find(p => p.featured);
  const regularPosts = filteredPosts.filter(p => !p.featured || selectedCategory !== "All");

  if (selectedPost) {
    return <BlogDetail post={selectedPost} onBack={() => setSelectedPost(null)} />;
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 p-6">
      <SectionHeader icon={BookOpen} title="Blog & Insights" description="Research, case studies, and threat analysis" />

      {/* Introduction */}
      <Card className="bg-white/5 border-white/10">
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold text-white mb-3">Understanding the Deepfake Threat Landscape</h2>
          <div className="space-y-3 text-sm text-white/70 leading-relaxed">
            <p>
              The deepfake threat is no longer theoretical. In 2024 alone, deepfake fraud attempts increased by 900%, with losses exceeding billions of dollars globally. From CEO impersonation scams that trick finance teams into wiring millions, to non-consensual intimate imagery used for blackmail and harassment, synthetic media attacks are affecting individuals and organizations at an unprecedented scale.
            </p>
            <p>
              This blog serves as your resource for staying informed about the rapidly evolving world of AI-generated content threats. Our research team publishes in-depth analysis of emerging attack vectors, case studies from real incidents we have investigated, and practical guides for strengthening your defenses against synthetic media manipulation.
            </p>
            <p>
              Whether you are a security professional tracking the latest adversarial techniques, a content creator concerned about impersonation, or anyone who wants to understand how deepfake technology works and how to detect it, these articles provide the technical depth and actionable insights you need. We cover everything from the underlying machine learning research to the real-world tactics threat actors use to deploy deepfakes at scale.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Featured Post */}
      {selectedCategory === "All" && featuredPost && !searchQuery && (
        <StaggerItem>
          <Card className="bg-white/5 border-white/10 overflow-hidden hover:bg-white/[0.07] transition-colors cursor-pointer" onClick={() => setSelectedPost(featuredPost)}>
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
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{featuredPost.read_time}</span>
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
            <Card className="bg-white/5 border-white/10 hover:bg-white/[0.07] transition-colors cursor-pointer h-full" onClick={() => setSelectedPost(post)}>
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
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{post.read_time}</span>
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
