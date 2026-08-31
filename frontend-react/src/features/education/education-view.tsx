import { useState, useEffect } from "react";
import { motion } from "motion/react";
import {
  GraduationCap,
  BookOpen,
  Award,
  Star,
  Clock,
  CheckCircle,
  ChevronRight,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StaggerContainer, StaggerItem } from "@/components/ui/motion";
import { SectionHeader } from "@/components/ui/dashboard";
import { api } from "@/lib/api";

interface Tutorial {
  id: string;
  title: string;
  description: string;
  category: string;
  difficulty: string;
  duration: string;
  completions: number;
  rating: number;
}

interface Certification {
  id: string;
  name: string;
  level: string;
  requirements: string[];
  holders: number;
}

export function EducationView() {
  const [tutorials, setTutorials] = useState<Tutorial[]>([]);
  const [certifications, setCertifications] = useState<Certification[]>([]);
  const [progress, setProgress] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"tutorials" | "certs" | "blog">("tutorials");

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [tutRes, certRes, progRes] = await Promise.all([
        api.getTutorials(),
        api.getCertifications(),
        api.getEducationProgress(),
      ]);
      setTutorials(tutRes.tutorials || []);
      setCertifications(certRes.certifications || []);
      setProgress(progRes);
    } catch (e) {
      console.error("Failed to load education data:", e);
    } finally {
      setLoading(false);
    }
  };

  const getDifficultyColor = (d: string) => {
    switch (d) {
      case "beginner": return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
      case "intermediate": return "bg-amber-500/10 text-amber-400 border-amber-500/20";
      case "advanced": return "bg-red-500/10 text-red-400 border-red-500/20";
      default: return "bg-white/5 text-white/60 border-white/10";
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <div className="h-8 w-64 bg-white/5 rounded-lg animate-pulse" />
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <div key={i} className="h-40 bg-white/5 rounded-xl animate-pulse" />)}
        </div>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 p-6">
      <SectionHeader icon={GraduationCap} title="Education Center" description="Learn to detect and prevent deepfakes" />

      {/* Progress */}
      {progress && (
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: "Completed", value: progress.completedTutorials?.length || 0, icon: CheckCircle, color: "text-emerald-400" },
            { label: "Avg Score", value: `${progress.averageScore || 0}%`, icon: Star, color: "text-amber-400" },
            { label: "Certifications", value: progress.certifications?.length || 0, icon: Award, color: "text-violet-400" },
            { label: "Total Quizzes", value: progress.totalCompletions || 0, icon: BookOpen, color: "text-cyan-400" },
          ].map(stat => (
            <StaggerItem key={stat.label}>
              <Card className="bg-white/5 border-white/10">
                <CardContent className="p-4 flex items-center gap-3">
                  <stat.icon className={`w-5 h-5 ${stat.color}`} />
                  <div>
                    <p className="text-2xl font-bold text-white">{stat.value}</p>
                    <p className="text-xs text-white/60">{stat.label}</p>
                  </div>
                </CardContent>
              </Card>
            </StaggerItem>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2">
        {(["tutorials", "certs", "blog"] as const).map(tab => (
          <Button key={tab} onClick={() => setActiveTab(tab)} variant={activeTab === tab ? "default" : "ghost"} className={activeTab === tab ? "bg-cyan-500 text-black" : "text-white/60"}>
            {tab === "tutorials" ? "Tutorials" : tab === "certs" ? "Certifications" : "Blog"}
          </Button>
        ))}
      </div>

      {/* Tutorials */}
      {activeTab === "tutorials" && (
        <StaggerContainer className="grid grid-cols-2 gap-4">
          {tutorials.map(tut => (
            <StaggerItem key={tut.id}>
              <Card className="bg-white/5 border-white/10 hover:bg-white/[0.07] transition-colors cursor-pointer">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-white">{tut.title}</h3>
                      <p className="text-sm text-white/60 mt-1">{tut.description}</p>
                      <div className="flex items-center gap-2 mt-3">
                        <Badge className={getDifficultyColor(tut.difficulty)}>{tut.difficulty}</Badge>
                        <span className="text-xs text-white/40 flex items-center gap-1"><Clock className="w-3 h-3" />{tut.duration}</span>
                        <span className="text-xs text-white/40">{tut.completions} completed</span>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-white/40" />
                  </div>
                </CardContent>
              </Card>
            </StaggerItem>
          ))}
        </StaggerContainer>
      )}

      {/* Certifications */}
      {activeTab === "certs" && (
        <StaggerContainer className="space-y-4">
          {certifications.map(cert => (
            <StaggerItem key={cert.id}>
              <Card className="bg-white/5 border-white/10">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-white">{cert.name}</h3>
                      <p className="text-sm text-white/60 mt-1">Level: {cert.level} • {cert.holders} holders</p>
                      <ul className="mt-2 space-y-1">
                        {cert.requirements.map((req, i) => (
                          <li key={i} className="text-xs text-white/40 flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" />{req}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <Award className="w-8 h-8 text-amber-400" />
                  </div>
                </CardContent>
              </Card>
            </StaggerItem>
          ))}
        </StaggerContainer>
      )}

      {/* Blog */}
      {activeTab === "blog" && (
        <Card className="bg-white/5 border-white/10">
          <CardContent className="p-8 text-center">
            <BookOpen className="w-10 h-10 text-cyan-400 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-white">Blog & Case Studies</h3>
            <p className="text-sm text-white/60 mt-1">Coming soon — research articles and threat analysis</p>
          </CardContent>
        </Card>
      )}
    </motion.div>
  );
}
