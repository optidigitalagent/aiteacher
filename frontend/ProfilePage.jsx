import { useState, useEffect, useRef } from "react";

const userProfile = {
  name: "Artem",
  avatarInitials: "A",
  cefrLevel: "B1 Intermediate",
  aiRankTitle: "Confident Learner",
  aiSummary: "Your speaking skills are improving steadily. Keep practicing question forms to become more confident.",
};

const learningStats = {
  lessonsCompleted: 24,
  learningTime: "18h 40m",
  currentStreak: 7,
  testsCompleted: 5,
  booksStudied: 2,
  averageAccuracy: 82,
};

const productivity = {
  score: 78,
  trend: "Growing",
  weeklyData: [42, 48, 51, 57, 64, 72, 78],
  weekLabels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  insight: "Your productivity increased this week because you completed lessons more consistently and spent more time speaking.",
};

const rankProgress = {
  currentRank: "Confident Learner",
  nextRank: "Fluent Speaker",
  progress: 64,
  hint: "Complete 6 more lessons and keep your accuracy above 80% to reach the next rank.",
};

const lessonHistory = [
  { id: 1, title: "Focus 2 — Section 1.3 — Listening Practice", status: "Completed", duration: "25 min", accuracy: 84 },
  { id: 2, title: "Past Simple Practice", status: "Completed", duration: "18 min", accuracy: 79 },
  { id: 3, title: "Question Forms", status: "In progress", duration: "12 min", accuracy: 72 },
  { id: 4, title: "Focus 2 — Section 2.1 — Vocabulary", status: "Completed", duration: "22 min", accuracy: 88 },
];

const testsData = [
  { id: 1, title: "Grammar Check", status: "Passed", score: 81, icon: "✦" },
  { id: 2, title: "Speaking Test", status: "Completed", score: 76, icon: "◎" },
  { id: 3, title: "Listening Quiz", status: "Passed", score: 86, icon: "◈" },
  { id: 4, title: "Vocabulary Review", status: "Passed", score: 90, icon: "◇" },
];

const booksData = [
  { id: 1, title: "Focus 2 Student Book", progress: 42, completedSections: 9, totalSections: 21 },
  { id: 2, title: "Business English Basics", progress: 15, completedSections: 3, totalSections: 20 },
];

const aiRecommendation = {
  nextLesson: "Practice Question Forms",
  weakArea: "Question order",
  reason: "You often place auxiliary verbs after the subject. A short focused lesson will help fix this.",
};

const styles = {
  page: {
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    background: "#FFFFFF",
    minHeight: "100vh",
    color: "#0F172A",
  },
  header: {
    position: "sticky",
    top: 0,
    zIndex: 100,
    background: "rgba(255,255,255,0.95)",
    backdropFilter: "blur(12px)",
    borderBottom: "1px solid #F0EEF8",
    padding: "0 40px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    height: 68,
  },
  logo: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    textDecoration: "none",
    cursor: "pointer",
  },
  logoIcon: {
    width: 32,
    height: 32,
    background: "linear-gradient(135deg, #7B8CFF 0%, #A18BFF 100%)",
    borderRadius: 8,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#fff",
    fontSize: 14,
    fontWeight: 700,
  },
  logoText: {
    fontSize: 16,
    fontWeight: 700,
    color: "#0F172A",
    letterSpacing: "-0.3px",
  },
  nav: {
    display: "flex",
    alignItems: "center",
    gap: 4,
  },
  navLink: {
    padding: "8px 16px",
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 500,
    color: "#64748B",
    cursor: "pointer",
    transition: "all 0.2s ease",
    textDecoration: "none",
    border: "none",
    background: "transparent",
  },
  navLinkActive: {
    color: "#7B8CFF",
    background: "rgba(123,140,255,0.08)",
  },
  headerRight: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  avatarSmall: {
    width: 36,
    height: 36,
    borderRadius: "50%",
    background: "linear-gradient(135deg, #7B8CFF 0%, #A18BFF 100%)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#fff",
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
    border: "2px solid #7B8CFF",
  },
  btnPrimary: {
    background: "linear-gradient(135deg, #7B8CFF 0%, #FFB38C 100%)",
    color: "#fff",
    border: "none",
    borderRadius: 12,
    padding: "10px 20px",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    transition: "all 0.2s ease",
    whiteSpace: "nowrap",
  },
  main: {
    maxWidth: 1200,
    margin: "0 auto",
    padding: "40px 40px 80px",
  },
  card: {
    background: "#FFFFFF",
    border: "1px solid #F0EEF8",
    borderRadius: 20,
    padding: 28,
    boxShadow: "0 2px 16px rgba(123,140,255,0.06)",
    transition: "transform 0.2s ease, box-shadow 0.2s ease",
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "1.2px",
    textTransform: "uppercase",
    color: "#A18BFF",
    marginBottom: 6,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 700,
    color: "#0F172A",
    marginBottom: 20,
    letterSpacing: "-0.3px",
  },
};

function AnimatedProgressBar({ value, color = "linear-gradient(90deg, #7B8CFF, #A18BFF)", height = 8, animated = true }) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setWidth(value), 300);
    return () => clearTimeout(t);
  }, [value]);
  return (
    <div style={{ background: "#F0EEF8", borderRadius: 999, height, overflow: "hidden" }}>
      <div style={{
        height: "100%",
        width: `${width}%`,
        background: color,
        borderRadius: 999,
        transition: animated ? "width 1s cubic-bezier(0.4,0,0.2,1)" : "none",
      }} />
    </div>
  );
}

function MiniLineChart({ data, labels }) {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const W = canvas.width, H = canvas.height;
    const pad = { top: 12, right: 12, bottom: 24, left: 28 };
    const chartW = W - pad.left - pad.right;
    const chartH = H - pad.top - pad.bottom;
    const min = Math.min(...data) - 5;
    const max = Math.max(...data) + 5;
    ctx.clearRect(0, 0, W, H);

    const xStep = chartW / (data.length - 1);
    const yScale = (v) => pad.top + chartH - ((v - min) / (max - min)) * chartH;
    const xAt = (i) => pad.left + i * xStep;

    ctx.strokeStyle = "#F0EEF8";
    ctx.lineWidth = 1;
    [0.25, 0.5, 0.75, 1].forEach((t) => {
      const y = pad.top + chartH * (1 - t);
      ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(pad.left + chartW, y); ctx.stroke();
    });

    const grad = ctx.createLinearGradient(0, pad.top, 0, H);
    grad.addColorStop(0, "rgba(123,140,255,0.15)");
    grad.addColorStop(1, "rgba(123,140,255,0)");
    ctx.beginPath();
    ctx.moveTo(xAt(0), yScale(data[0]));
    data.forEach((v, i) => { if (i > 0) ctx.lineTo(xAt(i), yScale(v)); });
    ctx.lineTo(xAt(data.length - 1), pad.top + chartH);
    ctx.lineTo(xAt(0), pad.top + chartH);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    const lineGrad = ctx.createLinearGradient(pad.left, 0, pad.left + chartW, 0);
    lineGrad.addColorStop(0, "#7B8CFF");
    lineGrad.addColorStop(1, "#FFB38C");
    ctx.beginPath();
    ctx.moveTo(xAt(0), yScale(data[0]));
    data.forEach((v, i) => { if (i > 0) ctx.lineTo(xAt(i), yScale(v)); });
    ctx.strokeStyle = lineGrad;
    ctx.lineWidth = 2.5;
    ctx.lineJoin = "round";
    ctx.stroke();

    data.forEach((v, i) => {
      ctx.beginPath();
      ctx.arc(xAt(i), yScale(v), 3.5, 0, Math.PI * 2);
      ctx.fillStyle = i === data.length - 1 ? "#FFB38C" : "#7B8CFF";
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.stroke();
    });

    ctx.fillStyle = "#94A3B8";
    ctx.font = "10px Inter, sans-serif";
    ctx.textAlign = "center";
    labels.forEach((l, i) => { ctx.fillText(l, xAt(i), H - 6); });
  }, [data, labels]);
  return <canvas ref={canvasRef} width={520} height={140} style={{ width: "100%", height: 140 }} />;
}

function StatCard({ icon, value, label, trend, accent = "#7B8CFF" }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...styles.card,
        padding: "22px 24px",
        transform: hovered ? "translateY(-4px)" : "none",
        boxShadow: hovered ? "0 8px 24px rgba(123,140,255,0.12)" : "0 2px 16px rgba(123,140,255,0.06)",
      }}
    >
      <div style={{ width: 36, height: 36, borderRadius: 10, background: `${accent}18`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14, fontSize: 16 }}>
        {icon}
      </div>
      <div style={{ fontSize: 28, fontWeight: 800, color: "#0F172A", letterSpacing: "-0.5px", lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 13, color: "#64748B", marginTop: 4, fontWeight: 500 }}>{label}</div>
      {trend && <div style={{ fontSize: 11, color: accent, marginTop: 6, fontWeight: 600 }}>{trend}</div>}
    </div>
  );
}

function AppHeader() {
  const [hoverBtn, setHoverBtn] = useState(false);
  const navItems = ["Home", "Learning", "About", "Pricing", "Support"];
  return (
    <header style={styles.header}>
      <div style={styles.logo}>
        <div style={styles.logoIcon}>✦</div>
        <span style={styles.logoText}>AI Teacher</span>
      </div>
      <nav style={styles.nav}>
        {navItems.map((item) => (
          <a key={item} href={item === "Home" ? "/" : `/${item.toLowerCase()}`} style={{ ...styles.navLink, ...(item === "Learning" ? {} : {}) }}>
            {item}
          </a>
        ))}
      </nav>
      <div style={styles.headerRight}>
        <div style={{ ...styles.avatarSmall, boxShadow: "0 0 0 3px rgba(123,140,255,0.25)" }}>
          {userProfile.avatarInitials}
        </div>
        <button
          onMouseEnter={() => setHoverBtn(true)}
          onMouseLeave={() => setHoverBtn(false)}
          onClick={() => window.location.href = "/learning"}
          style={{
            ...styles.btnPrimary,
            transform: hoverBtn ? "scale(1.02)" : "scale(1)",
            boxShadow: hoverBtn ? "0 4px 20px rgba(123,140,255,0.35)" : "none",
          }}
        >
          ✦ Start lesson
        </button>
      </div>
    </header>
  );
}

function ProfileHero() {
  const [hoverBtn, setHoverBtn] = useState(false);
  return (
    <div style={{
      ...styles.card,
      background: "linear-gradient(135deg, #FAFBFF 0%, #FFF8F4 100%)",
      border: "1px solid #EEE9FF",
      padding: "40px 40px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 32,
      flexWrap: "wrap",
      marginBottom: 24,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
        <div style={{
          width: 88,
          height: 88,
          borderRadius: "50%",
          background: "linear-gradient(135deg, #7B8CFF 0%, #A18BFF 60%, #FFB38C 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 32,
          fontWeight: 800,
          color: "#fff",
          flexShrink: 0,
          boxShadow: "0 4px 24px rgba(123,140,255,0.3)",
        }}>
          {userProfile.avatarInitials}
        </div>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <h1 style={{ fontSize: 28, fontWeight: 800, color: "#0F172A", margin: 0, letterSpacing: "-0.5px" }}>
              {userProfile.name}
            </h1>
            <span style={{
              background: "linear-gradient(135deg, #7B8CFF18, #A18BFF18)",
              color: "#7B8CFF",
              fontSize: 12,
              fontWeight: 700,
              padding: "3px 10px",
              borderRadius: 999,
              border: "1px solid rgba(123,140,255,0.2)",
            }}>
              {userProfile.cefrLevel}
            </span>
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, color: "#A18BFF", marginBottom: 8 }}>
            ✦ {userProfile.aiRankTitle}
          </div>
          <p style={{ fontSize: 14, color: "#64748B", margin: 0, maxWidth: 420, lineHeight: 1.6 }}>
            {userProfile.aiSummary}
          </p>
        </div>
      </div>
      <button
        onMouseEnter={() => setHoverBtn(true)}
        onMouseLeave={() => setHoverBtn(false)}
        onClick={() => window.location.href = "/learning"}
        style={{
          ...styles.btnPrimary,
          padding: "13px 28px",
          fontSize: 15,
          borderRadius: 14,
          transform: hoverBtn ? "scale(1.02)" : "scale(1)",
          boxShadow: hoverBtn ? "0 6px 24px rgba(123,140,255,0.35)" : "0 2px 12px rgba(123,140,255,0.2)",
        }}
      >
        ◎ Continue learning →
      </button>
    </div>
  );
}

function StatsGrid() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 16, marginBottom: 24 }}>
      <StatCard icon="📚" value={learningStats.lessonsCompleted} label="Lessons completed" trend="↑ +3 this week" accent="#7B8CFF" />
      <StatCard icon="⏱" value={learningStats.learningTime} label="Learning time" accent="#A18BFF" />
      <StatCard icon="🔥" value={`${learningStats.currentStreak}d`} label="Current streak" trend="Keep it up!" accent="#FFB38C" />
      <StatCard icon="✅" value={learningStats.testsCompleted} label="Tests completed" accent="#7B8CFF" />
      <StatCard icon="📖" value={learningStats.booksStudied} label="Books studied" accent="#A18BFF" />
      <StatCard icon="🎯" value={`${learningStats.averageAccuracy}%`} label="Avg. accuracy" trend="↑ +4% vs last week" accent="#FFB38C" />
    </div>
  );
}

function ProductivityCard() {
  const [hovered, setHovered] = useState(false);
  const scoreColor = productivity.score >= 70 ? "#7B8CFF" : "#FFB38C";
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...styles.card,
        transform: hovered ? "translateY(-4px)" : "none",
        boxShadow: hovered ? "0 8px 24px rgba(123,140,255,0.12)" : "0 2px 16px rgba(123,140,255,0.06)",
      }}
    >
      <div style={styles.sectionLabel}>Productivity</div>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 40, fontWeight: 800, color: "#0F172A", letterSpacing: "-1px", lineHeight: 1 }}>
            {productivity.score}
            <span style={{ fontSize: 18, fontWeight: 600, color: "#94A3B8" }}>/100</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
            <span style={{
              background: "rgba(123,140,255,0.1)",
              color: "#7B8CFF",
              fontSize: 12,
              fontWeight: 700,
              padding: "3px 10px",
              borderRadius: 999,
            }}>
              ↑ {productivity.trend}
            </span>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 12, color: "#94A3B8", marginBottom: 2 }}>This week</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: scoreColor }}>
            +{productivity.weeklyData[6] - productivity.weeklyData[0]} pts
          </div>
        </div>
      </div>
      <MiniLineChart data={productivity.weeklyData} labels={productivity.weekLabels} />
      <div style={{
        marginTop: 16,
        padding: "12px 16px",
        background: "linear-gradient(135deg, rgba(123,140,255,0.06), rgba(161,139,255,0.06))",
        borderRadius: 12,
        border: "1px solid rgba(123,140,255,0.1)",
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#A18BFF", letterSpacing: "0.8px", marginBottom: 4 }}>AI INSIGHT</div>
        <p style={{ fontSize: 13, color: "#475569", margin: 0, lineHeight: 1.6 }}>{productivity.insight}</p>
      </div>
    </div>
  );
}

function RankProgressCard() {
  const [hovered, setHovered] = useState(false);
  const ranks = ["Beginner", "Explorer", "Confident Learner", "Fluent Speaker", "Expert"];
  const currentIdx = ranks.indexOf(rankProgress.currentRank);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...styles.card,
        transform: hovered ? "translateY(-4px)" : "none",
        boxShadow: hovered ? "0 8px 24px rgba(123,140,255,0.12)" : "0 2px 16px rgba(123,140,255,0.06)",
      }}
    >
      <div style={styles.sectionLabel}>Level Progression</div>
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 12, color: "#94A3B8", marginBottom: 2 }}>Current rank</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#7B8CFF" }}>✦ {rankProgress.currentRank}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 12, color: "#94A3B8", marginBottom: 2 }}>Next rank</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#0F172A" }}>{rankProgress.nextRank}</div>
          </div>
        </div>
        <AnimatedProgressBar value={rankProgress.progress} height={10} color="linear-gradient(90deg, #7B8CFF, #A18BFF, #FFB38C)" />
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
          <span style={{ fontSize: 12, color: "#7B8CFF", fontWeight: 600 }}>{rankProgress.progress}% complete</span>
          <span style={{ fontSize: 12, color: "#94A3B8" }}>36% remaining</span>
        </div>
      </div>
      <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
        {ranks.map((r, i) => (
          <div key={r} style={{
            flex: 1,
            height: 6,
            borderRadius: 999,
            background: i < currentIdx ? "#7B8CFF" : i === currentIdx ? "linear-gradient(90deg, #7B8CFF, #A18BFF)" : "#F0EEF8",
          }} />
        ))}
      </div>
      <div style={{
        padding: "12px 16px",
        background: "linear-gradient(135deg, rgba(255,179,140,0.08), rgba(161,139,255,0.06))",
        borderRadius: 12,
        border: "1px solid rgba(255,179,140,0.15)",
      }}>
        <p style={{ fontSize: 13, color: "#475569", margin: 0, lineHeight: 1.6 }}>{rankProgress.hint}</p>
      </div>
    </div>
  );
}

function LessonHistoryCard() {
  const [hovered, setHovered] = useState(false);
  return (
    <div style={{ ...styles.card, marginBottom: 24 }}>
      <div style={styles.sectionLabel}>Recent Activity</div>
      <h2 style={{ ...styles.sectionTitle, marginBottom: 16 }}>Learning History</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {lessonHistory.map((lesson, i) => (
          <LessonItem key={lesson.id} lesson={lesson} index={i} />
        ))}
      </div>
    </div>
  );
}

function LessonItem({ lesson, index }) {
  const [hovered, setHovered] = useState(false);
  const isCompleted = lesson.status === "Completed";
  const accuracyColor = lesson.accuracy >= 85 ? "#22C55E" : lesson.accuracy >= 75 ? "#7B8CFF" : "#FFB38C";
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "14px 18px",
        background: hovered ? "#FAFBFF" : "#FAFAFA",
        borderRadius: 14,
        border: `1px solid ${hovered ? "#E0DCFF" : "#F0EEF8"}`,
        transition: "all 0.2s ease",
        cursor: "default",
        gap: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14, flex: 1, minWidth: 0 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: isCompleted ? "rgba(123,140,255,0.1)" : "rgba(255,179,140,0.1)",
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 14,
        }}>
          {isCompleted ? "✓" : "▶"}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#0F172A", marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {lesson.title}
          </div>
          <div style={{ fontSize: 12, color: "#94A3B8" }}>{lesson.duration}</div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 16, flexShrink: 0 }}>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: accuracyColor }}>{lesson.accuracy}%</div>
          <div style={{ fontSize: 11, color: "#94A3B8" }}>accuracy</div>
        </div>
        <span style={{
          fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 999,
          background: isCompleted ? "rgba(34,197,94,0.1)" : "rgba(255,179,140,0.15)",
          color: isCompleted ? "#16A34A" : "#F97316",
        }}>
          {lesson.status}
        </span>
      </div>
    </div>
  );
}

function TestsCard() {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...styles.card,
        transform: hovered ? "translateY(-2px)" : "none",
        boxShadow: hovered ? "0 8px 24px rgba(123,140,255,0.1)" : "0 2px 16px rgba(123,140,255,0.06)",
      }}
    >
      <div style={styles.sectionLabel}>Exams & Quizzes</div>
      <h2 style={{ ...styles.sectionTitle }}>Tests Completed</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {testsData.map((test) => (
          <div key={test.id} style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "12px 16px",
            background: "#FAFAFA",
            borderRadius: 12,
            border: "1px solid #F0EEF8",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 8,
                background: "rgba(161,139,255,0.1)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 13, color: "#A18BFF",
              }}>
                {test.icon}
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#0F172A" }}>{test.title}</div>
                <div style={{ fontSize: 11, color: "#94A3B8" }}>{test.status}</div>
              </div>
            </div>
            <div style={{
              fontSize: 16, fontWeight: 800, color: test.score >= 85 ? "#7B8CFF" : "#A18BFF",
            }}>
              {test.score}%
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BookProgressCard() {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...styles.card,
        transform: hovered ? "translateY(-2px)" : "none",
        boxShadow: hovered ? "0 8px 24px rgba(123,140,255,0.1)" : "0 2px 16px rgba(123,140,255,0.06)",
      }}
    >
      <div style={styles.sectionLabel}>Textbooks</div>
      <h2 style={{ ...styles.sectionTitle }}>Book Progress</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {booksData.map((book) => (
          <BookItem key={book.id} book={book} />
        ))}
      </div>
    </div>
  );
}

function BookItem({ book }) {
  const [hoverBtn, setHoverBtn] = useState(false);
  return (
    <div style={{ padding: "16px", background: "#FAFAFA", borderRadius: 14, border: "1px solid #F0EEF8" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 12 }}>
        <div style={{
          width: 40, height: 48, borderRadius: 6,
          background: "linear-gradient(145deg, #7B8CFF, #A18BFF)",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#fff", fontSize: 16, flexShrink: 0,
          boxShadow: "0 2px 8px rgba(123,140,255,0.3)",
        }}>📖</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#0F172A", marginBottom: 2 }}>{book.title}</div>
          <div style={{ fontSize: 12, color: "#94A3B8" }}>{book.completedSections} / {book.totalSections} sections completed</div>
        </div>
        <div style={{ fontSize: 20, fontWeight: 800, color: "#7B8CFF" }}>{book.progress}%</div>
      </div>
      <AnimatedProgressBar value={book.progress} height={6} color="linear-gradient(90deg, #7B8CFF, #A18BFF)" />
      <button
        onMouseEnter={() => setHoverBtn(true)}
        onMouseLeave={() => setHoverBtn(false)}
        onClick={() => window.location.href = "/learning"}
        style={{
          marginTop: 12,
          background: "transparent",
          border: "1px solid rgba(123,140,255,0.3)",
          color: "#7B8CFF",
          borderRadius: 8,
          padding: "6px 14px",
          fontSize: 12,
          fontWeight: 600,
          cursor: "pointer",
          transition: "all 0.2s ease",
          transform: hoverBtn ? "scale(1.02)" : "scale(1)",
          background: hoverBtn ? "rgba(123,140,255,0.06)" : "transparent",
        }}
      >
        Continue →
      </button>
    </div>
  );
}

function AIRecommendationsCard() {
  const [hovered, setHovered] = useState(false);
  const [hoverBtn, setHoverBtn] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...styles.card,
        background: "linear-gradient(135deg, #FAFBFF 0%, #FFF8F4 100%)",
        border: "1px solid #EEE9FF",
        marginBottom: 24,
        transform: hovered ? "translateY(-2px)" : "none",
        boxShadow: hovered ? "0 8px 24px rgba(123,140,255,0.1)" : "0 2px 16px rgba(123,140,255,0.06)",
      }}
    >
      <div style={styles.sectionLabel}>AI Recommendations</div>
      <h2 style={{ ...styles.sectionTitle }}>Your Personalized Plan</h2>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 24 }}>
        <div style={{ padding: "18px", background: "rgba(123,140,255,0.06)", borderRadius: 14, border: "1px solid rgba(123,140,255,0.12)" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#7B8CFF", letterSpacing: "0.8px", marginBottom: 8 }}>NEXT LESSON</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#0F172A", marginBottom: 4 }}>{aiRecommendation.nextLesson}</div>
          <div style={{ fontSize: 12, color: "#64748B" }}>Recommended for your level</div>
        </div>
        <div style={{ padding: "18px", background: "rgba(255,179,140,0.06)", borderRadius: 14, border: "1px solid rgba(255,179,140,0.15)" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#FFB38C", letterSpacing: "0.8px", marginBottom: 8 }}>WEAK AREA</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#0F172A", marginBottom: 4 }}>{aiRecommendation.weakArea}</div>
          <div style={{ fontSize: 12, color: "#64748B" }}>Needs focused practice</div>
        </div>
        <div style={{ padding: "18px", background: "rgba(161,139,255,0.06)", borderRadius: 14, border: "1px solid rgba(161,139,255,0.12)" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#A18BFF", letterSpacing: "0.8px", marginBottom: 8 }}>AI ANALYSIS</div>
          <p style={{ fontSize: 13, color: "#475569", margin: 0, lineHeight: 1.6 }}>{aiRecommendation.reason}</p>
        </div>
      </div>
      <button
        onMouseEnter={() => setHoverBtn(true)}
        onMouseLeave={() => setHoverBtn(false)}
        onClick={() => window.location.href = "/learning"}
        style={{
          ...styles.btnPrimary,
          padding: "13px 28px",
          fontSize: 14,
          borderRadius: 12,
          transform: hoverBtn ? "scale(1.02)" : "scale(1)",
          boxShadow: hoverBtn ? "0 6px 24px rgba(123,140,255,0.35)" : "0 2px 12px rgba(123,140,255,0.15)",
        }}
      >
        Practice recommended lesson →
      </button>
    </div>
  );
}

function GradientCTA() {
  const [hoverBtn, setHoverBtn] = useState(false);
  return (
    <div style={{
      borderRadius: 24,
      background: "linear-gradient(135deg, #7B8CFF 0%, #A18BFF 50%, #FFB38C 100%)",
      padding: "48px 48px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 24,
      flexWrap: "wrap",
    }}>
      <div>
        <h2 style={{ fontSize: 28, fontWeight: 800, color: "#fff", margin: "0 0 8px", letterSpacing: "-0.5px" }}>
          Ready for your next lesson?
        </h2>
        <p style={{ fontSize: 15, color: "rgba(255,255,255,0.85)", margin: 0 }}>
          Continue learning with your AI teacher.
        </p>
      </div>
      <button
        onMouseEnter={() => setHoverBtn(true)}
        onMouseLeave={() => setHoverBtn(false)}
        onClick={() => window.location.href = "/learning"}
        style={{
          background: "#fff",
          color: "#7B8CFF",
          border: "none",
          borderRadius: 14,
          padding: "14px 32px",
          fontSize: 15,
          fontWeight: 700,
          cursor: "pointer",
          transition: "all 0.2s ease",
          transform: hoverBtn ? "scale(1.02)" : "scale(1)",
          boxShadow: hoverBtn ? "0 6px 24px rgba(0,0,0,0.15)" : "0 2px 12px rgba(0,0,0,0.1)",
          whiteSpace: "nowrap",
        }}
      >
        Continue learning →
      </button>
    </div>
  );
}

function AppFooter() {
  return (
    <footer style={{
      borderTop: "1px solid #F0EEF8",
      padding: "48px 40px 32px",
      marginTop: 64,
    }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr 1fr 1fr", gap: 40, marginBottom: 40 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <div style={{ width: 28, height: 28, background: "linear-gradient(135deg,#7B8CFF,#A18BFF)", borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 12 }}>✦</div>
              <span style={{ fontWeight: 700, fontSize: 15, color: "#0F172A" }}>AI Teacher</span>
            </div>
            <p style={{ fontSize: 13, color: "#94A3B8", lineHeight: 1.6 }}>Your personal AI English teacher, anytime, anywhere.</p>
          </div>
          {[
            { title: "Product", links: ["Learning", "AI Teacher", "Progress", "Pricing"] },
            { title: "Resources", links: ["Blog", "Study guides", "Community", "Free lessons"] },
            { title: "Company", links: ["About us", "Careers", "Contact", "Press kit"] },
            { title: "Support", links: ["Help center", "Contact us", "Privacy policy", "Terms of service"] },
          ].map((col) => (
            <div key={col.title}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#0F172A", letterSpacing: "0.5px", marginBottom: 12 }}>{col.title}</div>
              {col.links.map((l) => (
                <div key={l} style={{ fontSize: 13, color: "#94A3B8", marginBottom: 8, cursor: "pointer" }}>{l}</div>
              ))}
            </div>
          ))}
        </div>
        <div style={{ borderTop: "1px solid #F0EEF8", paddingTop: 20, fontSize: 12, color: "#CBD5E1", textAlign: "center" }}>
          © 2025 AI Teacher. All rights reserved.
        </div>
      </div>
    </footer>
  );
}

export default function ProfilePage() {
  return (
    <div style={styles.page}>
      <AppHeader />
      <main style={styles.main}>
        <ProfileHero />
        <StatsGrid />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 24 }}>
          <ProductivityCard />
          <RankProgressCard />
        </div>
        <LessonHistoryCard />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 24 }}>
          <TestsCard />
          <BookProgressCard />
        </div>
        <AIRecommendationsCard />
        <GradientCTA />
      </main>
      <AppFooter />
    </div>
  );
}
