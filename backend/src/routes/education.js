const express = require("express");
const { success, error } = require("../utils/response");
const { authenticate } = require("../middleware/auth");

const router = express.Router();

const tutorials = [
  {
    id: "tut_1",
    title: "What is a Deepfake?",
    description: "Learn how deepfakes work and why they matter",
    category: "fundamentals",
    difficulty: "beginner",
    duration: "5 min",
    content: "Deepfakes use AI to create convincing fake videos and audio...",
    steps: [
      { title: "Introduction", content: "Deepfakes are AI-generated media that replace one person's likeness with another." },
      { title: "How They Work", content: "Using deep learning, specifically autoencoders and GANs..." },
      { title: "Detection Methods", content: "Look for artifacts: unnatural blinking, face shape anomalies..." },
      { title: "Protection", content: "Use Enclave shields, enable real-time monitoring..." },
    ],
    quiz: {
      questions: [
        { q: "What technology powers deepfakes?", options: ["Machine Learning", "Blockchain", "Quantum Computing"], answer: 0 },
        { q: "What is a common deepfake artifact?", options: ["Perfect resolution", "Unnatural blinking", "No audio"], answer: 1 },
      ],
    },
    completions: 1247,
    rating: 4.8,
  },
  {
    id: "tut_2",
    title: "Voice Clone Detection",
    description: "Understand how voice clones are made and detected",
    category: "advanced",
    difficulty: "intermediate",
    duration: "8 min",
    content: "Voice cloning uses neural networks to replicate speech patterns...",
    steps: [
      { title: "Voice Synthesis", content: "Modern TTS can clone voices from just a few seconds of audio." },
      { title: "Detection Techniques", content: "Spectral analysis reveals synthetic artifacts..." },
      { title: "Enclave Voice Shield", content: "Our analyzer checks for pitch consistency, breath patterns..." },
    ],
    quiz: {
      questions: [
        { q: "How much audio is needed for voice cloning?", options: ["Hours", "Minutes", "Seconds"], answer: 2 },
      ],
    },
    completions: 834,
    rating: 4.6,
  },
  {
    id: "tut_3",
    title: "Protecting Your Digital Identity",
    description: "Practical steps to safeguard your online presence",
    category: "protection",
    difficulty: "beginner",
    duration: "6 min",
    content: "Your digital identity is valuable...",
    steps: [
      { title: "Audit Your Presence", content: "Search yourself, check social media privacy settings." },
      { title: "Enable Protection", content: "Set up Enclave shields for proactive monitoring." },
      { title: "Respond to Threats", content: "Use takedown tools when your likeness is misused." },
    ],
    quiz: {
      questions: [
        { q: "What is the first step in identity protection?", options: ["Buy insurance", "Audit your presence", "Hire a lawyer"], answer: 1 },
      ],
    },
    completions: 2103,
    rating: 4.9,
  },
  {
    id: "tut_4",
    title: "Understanding Deepfake Evidence",
    description: "How to evaluate and present deepfake evidence",
    category: "legal",
    difficulty: "advanced",
    duration: "10 min",
    content: "When dealing with deepfake evidence in legal contexts...",
    steps: [
      { title: "Chain of Custody", content: "Preserve original files with metadata intact." },
      { title: "Technical Analysis", content: "Use Enclave's forensic tools for detailed analysis." },
      { title: "Expert Testimony", content: "Document your methodology for court admissibility." },
    ],
    quiz: {
      questions: [
        { q: "Why is chain of custody important?", options: ["Makes files bigger", "Ensures admissibility", "Prevents deletion"], answer: 1 },
      ],
    },
    completions: 567,
    rating: 4.7,
  },
];

const certifications = [
  {
    id: "cert_1",
    name: "Deepfake Awareness",
    level: "Foundation",
    requirements: ["Complete 2 beginner tutorials", "Pass quiz with 80%+"],
    tutorials: ["tut_1", "tut_3"],
    badge: "shield-icon",
    holders: 892,
  },
  {
    id: "cert_2",
    name: "Detection Specialist",
    level: "Intermediate",
    requirements: ["Complete all tutorials", "Pass all quizzes with 90%+"],
    tutorials: ["tut_1", "tut_2", "tut_3", "tut_4"],
    badge: "radar-icon",
    holders: 234,
  },
];

router.get("/tutorials", authenticate, (req, res) => {
  const { category, difficulty } = req.query;
  let results = tutorials;

  if (category) results = results.filter(t => t.category === category);
  if (difficulty) results = results.filter(t => t.difficulty === difficulty);

  return success(res, { tutorials: results });
});

router.get("/tutorials/:tutorialId", authenticate, (req, res) => {
  const { tutorialId } = req.params;
  const tutorial = tutorials.find(t => t.id === tutorialId);
  if (!tutorial) return error(res, "Tutorial not found", 404);
  return success(res, { tutorial });
});

router.post("/tutorials/:tutorialId/quiz", authenticate, (req, res) => {
  const userId = req.user.userId;
  const { tutorialId } = req.params;
  const { answers } = req.body;
  const db = req.app.get("db");

  const tutorial = tutorials.find(t => t.id === tutorialId);
  if (!tutorial || !tutorial.quiz) return error(res, "Tutorial or quiz not found", 404);

  const questions = tutorial.quiz.questions;
  let correct = 0;

  questions.forEach((q, i) => {
    if (answers[i] === q.answer) correct++;
  });

  const score = Math.round((correct / questions.length) * 100);
  const passed = score >= 80;

  db.get("tutorial_completions").push({
    id: "comp_" + Date.now(),
    userId,
    tutorialId,
    score,
    passed,
    answers,
    completedAt: new Date().toISOString(),
  }).write();

  return success(res, { score, correct, total: questions.length, passed });
});

router.get("/certifications", authenticate, (req, res) => {
  return success(res, { certifications });
});

router.get("/progress", authenticate, (req, res) => {
  const userId = req.user.userId;
  const db = req.app.get("db");
  const completions = db.get("tutorial_completions").filter({ userId }).value() || [];

  const completedTutorials = [...new Set(completions.filter(c => c.passed).map(c => c.tutorialId))];

  return success(res, {
    completedTutorials,
    totalCompletions: completions.length,
    averageScore: completions.length > 0
      ? Math.round(completions.reduce((sum, c) => sum + c.score, 0) / completions.length)
      : 0,
    certifications: certifications.filter(cert =>
      cert.tutorials.every(t => completedTutorials.includes(t))
    ).map(c => c.name),
  });
});

router.get("/blog", authenticate, (req, res) => {
  const posts = [
    {
      id: "post_1",
      title: "The Rise of Deepfake Scams in 2025",
      excerpt: "How criminals are using AI to impersonate executives...",
      author: "Enclave Research",
      date: "2025-08-01",
      readTime: "5 min",
      category: "threats",
    },
    {
      id: "post_2",
      title: "How We Detected a State-Sponsored Deepfake Campaign",
      excerpt: "Our team uncovered a sophisticated operation targeting journalists...",
      author: "Enclave Research",
      date: "2025-07-15",
      readTime: "8 min",
      category: "case-study",
    },
    {
      id: "post_3",
      title: "Voice Cloning: The Next Frontier of Fraud",
      excerpt: "With just 3 seconds of audio, attackers can now clone your voice...",
      author: "Enclave Research",
      date: "2025-06-20",
      readTime: "6 min",
      category: "research",
    },
  ];

  return success(res, { posts });
});

module.exports = router;
