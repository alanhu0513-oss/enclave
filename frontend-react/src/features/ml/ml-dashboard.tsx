import { useState, useEffect } from "react";
import { motion } from "motion/react";
import {
  Brain,
  Activity,
  GitBranch,
  Rocket,
  RotateCcw,
  Target,
  Clock,
  TrendingUp,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StaggerContainer, StaggerItem, Kinetic, FadeIn } from "@/components/ui/motion";
import { buttonPulse, glowPulse } from "@/lib/motion-presets";
import { SectionHeader, EmptyState } from "@/components/ui/dashboard";
import { api } from "@/lib/api";

interface Model {
  id: string;
  name: string;
  version: string;
  type: string;
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  status: string;
  dataset: string;
  parameters: string;
  inferenceTime: string;
}

interface ABTest {
  id: string;
  name: string;
  modelA: string;
  modelB: string;
  trafficSplit: number;
  status: string;
}

export function MLDashboard() {
  const [models, setModels] = useState<Model[]>([]);
  const [abTests, setABTests] = useState<ABTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"models" | "benchmarks" | "abtests">("models");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [modelsRes, testsRes] = await Promise.all([
        api.getMLModels(),
        api.getABTests(),
      ]);
      setModels((modelsRes as any)?.models || []);
      setABTests((testsRes as any)?.tests || []);
    } catch (e) {
      console.error("Failed to load ML data:", e);
    } finally {
      setLoading(false);
    }
  };

  const deployModel = async (modelId: string) => {
    try {
      await api.deployMLModel(modelId);
    } catch (e) {
      console.error("Deploy failed:", e);
    } finally {
      loadData();
    }
  };

  const rollbackModel = async (modelId: string) => {
    try {
      await api.rollbackMLModel(modelId);
    } catch (e) {
      console.error("Rollback failed:", e);
    } finally {
      loadData();
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "production":
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
      case "staging":
        return "bg-amber-500/10 text-amber-400 border-amber-500/20";
      case "archived":
        return "bg-white/5 text-white/40 border-white/10";
      default:
        return "bg-white/5 text-white/40 border-white/10";
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <div className="h-8 w-64 bg-white/5 rounded-lg animate-pulse" />
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-40 bg-white/5 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6 p-6"
    >
      <FadeIn>
        <SectionHeader
          icon={Brain}
          title="ML Command Center"
          description="Model versioning, benchmarks & A/B testing"
        />
      </FadeIn>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Models", value: models.length, icon: Brain, color: "text-violet-400" },
          { label: "Production", value: models.filter((m) => m.status === "production").length, icon: Rocket, color: "text-emerald-400" },
          { label: "A/B Tests", value: abTests.filter((t) => t.status === "running").length, icon: GitBranch, color: "text-cyan-400" },
        ].map((stat) => (
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

      <div className="flex gap-2">
        {(["models", "benchmarks", "abtests"] as const).map((tab) => (
          <Button
            key={tab}
            onClick={() => setActiveTab(tab)}
            variant={activeTab === tab ? "default" : "ghost"}
            className={activeTab === tab ? "bg-cyan text-black" : "text-white/60"}
          >
            {tab === "models" ? "Models" : tab === "benchmarks" ? "Benchmarks" : "A/B Tests"}
          </Button>
        ))}
      </div>

      {activeTab === "models" && (
        <StaggerContainer className="space-y-4">
          {models.map((model) => (
            <StaggerItem key={model.id}>
              <Kinetic>
                <Card
                  className="bg-white/5 border-white/10 hover:bg-white/[0.07] transition-colors"
                  {...(model.status === "production" ? glowPulse : {})}
                >
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <h3 className="text-lg font-semibold text-white">{model.name}</h3>
                          <Badge className={getStatusColor(model.status)}>{model.status}</Badge>
                          <Badge className="bg-white/5 text-white/60 border-white/10">{model.type}</Badge>
                        </div>
                        <p className="text-sm text-white/60 mt-1">Dataset: {model.dataset}</p>

                        <div className="grid grid-cols-4 gap-4 mt-4">
                          {[
                            { label: "Accuracy", value: `${(model.accuracy * 100).toFixed(1)}%`, icon: Target },
                            { label: "F1 Score", value: `${(model.f1Score * 100).toFixed(1)}%`, icon: TrendingUp },
                            { label: "Parameters", value: model.parameters, icon: Activity },
                            { label: "Inference", value: model.inferenceTime, icon: Clock },
                          ].map((metric) => (
                            <div key={metric.label} className="flex items-center gap-2">
                              <metric.icon className="w-3 h-3 text-white/40" />
                              <div>
                                <p className="text-xs text-white/40">{metric.label}</p>
                                <p className="text-sm font-medium text-white">{metric.value}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="flex gap-2">
                        {model.status !== "production" && (
                          <motion.div {...buttonPulse}>
                            <Button
                              onClick={() => deployModel(model.id)}
                              size="sm"
                              className="bg-emerald-500 text-black hover:bg-emerald-600"
                            >
                              <Rocket className="w-3 h-3 mr-1" />
                              Deploy
                            </Button>
                          </motion.div>
                        )}
                        {model.status === "production" && (
                          <Button
                            onClick={() => rollbackModel(model.id)}
                            size="sm"
                            variant="outline"
                            className="border-white/10 text-white/60"
                          >
                            <RotateCcw className="w-3 h-3 mr-1" />
                            Rollback
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Kinetic>
            </StaggerItem>
          ))}
        </StaggerContainer>
      )}

      {activeTab === "abtests" && (
        <StaggerContainer className="space-y-4">
          {abTests.length === 0 ? (
            <EmptyState icon={GitBranch} title="No A/B Tests" description="Create an A/B test to compare models" />
          ) : (
            abTests.map((test) => (
              <StaggerItem key={test.id}>
                <Card className="bg-white/5 border-white/10">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-white">{test.name}</h3>
                        <p className="text-sm text-white/60 mt-1">
                          {test.modelA} vs {test.modelB} • {test.trafficSplit}% split
                        </p>
                      </div>
                      <Badge className={getStatusColor(test.status)}>{test.status}</Badge>
                    </div>
                  </CardContent>
                </Card>
              </StaggerItem>
            ))
          )}
        </StaggerContainer>
      )}
    </motion.div>
  );
}
