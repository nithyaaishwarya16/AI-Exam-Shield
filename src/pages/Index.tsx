import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Shield, Camera, Mic, Globe, AlertTriangle, ChevronRight, LogIn, LogOut, User, BarChart3 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import heroImage from "@/assets/hero-security.jpg";

const features = [
  { icon: Camera, title: "Camera presence", desc: "We check that someone stays in frame—without turning the room into a surveillance show." },
  { icon: Mic, title: "Sound in the room", desc: "Loud or sudden spikes get flagged so you can review context, not guess." },
  { icon: Globe, title: "Browser stays put", desc: "Students stay in one tab, fullscreen when you want it, with clear prompts if they drift." },
  { icon: AlertTriangle, title: "Plain-language log", desc: "Issues are time-stamped so staff can open the log and see what happened, in order." },
];

export default function Index() {
  const navigate = useNavigate();
  const { user, isAuthenticated, logout } = useAuth();

  useEffect(() => {
    if (isAuthenticated && user?.role === "admin") {
      navigate("/admin", { replace: true });
    }
  }, [isAuthenticated, user, navigate]);

  return (
    <div className="min-h-screen gradient-hero">
      <nav className="flex items-center justify-between px-5 sm:px-8 py-5 max-w-6xl mx-auto border-b border-border/40">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary border border-border/60">
            <Shield className="w-5 h-5 text-primary" strokeWidth={1.75} />
          </div>
          <div className="leading-tight">
            <span className="font-heading text-lg font-semibold text-foreground tracking-tight block">ExamShield</span>
            <span className="text-xs text-muted-foreground hidden sm:block">Online exams, calmly enforced</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isAuthenticated ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2 rounded-xl">
                  <Avatar className="h-8 w-8 border border-border/60">
                    <AvatarFallback className="text-xs font-medium">{user?.name?.charAt(0).toUpperCase() || "U"}</AvatarFallback>
                  </Avatar>
                  <span className="hidden sm:inline max-w-[10rem] truncate">{user?.name}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 rounded-xl">
                <DropdownMenuLabel>
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium">{user?.name}</p>
                    <p className="text-xs text-muted-foreground">{user?.email}</p>
                    {user?.studentId && <p className="text-xs text-muted-foreground">ID: {user.studentId}</p>}
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {user?.role !== "admin" && (
                  <>
                    <DropdownMenuItem className="rounded-lg" onClick={() => navigate("/exam/setup")}>
                      <User className="mr-2 h-4 w-4" />
                      Go to exam setup
                    </DropdownMenuItem>
                    <DropdownMenuItem className="rounded-lg" onClick={() => navigate("/dashboard")}>
                      <User className="mr-2 h-4 w-4" />
                      My dashboard
                    </DropdownMenuItem>
                  </>
                )}
                {user?.role === "admin" && (
                  <>
                    <DropdownMenuItem className="rounded-lg" onClick={() => navigate("/admin")}>
                      <Shield className="mr-2 h-4 w-4" />
                      Admin
                    </DropdownMenuItem>
                    <DropdownMenuItem className="rounded-lg" onClick={() => navigate("/analytics")}>
                      <BarChart3 className="mr-2 h-4 w-4" />
                      Analytics
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem className="rounded-lg" onClick={logout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="flex items-center gap-2">
              <Button variant="ghost" className="rounded-xl" onClick={() => navigate("/login")}>
                <LogIn className="mr-2 h-4 w-4" />
                Log in
              </Button>
              <Button className="rounded-xl shadow-sm" onClick={() => navigate("/register")}>
                Create account
              </Button>
            </div>
          )}
        </div>
      </nav>

      <section className="max-w-6xl mx-auto px-5 sm:px-8 pt-14 pb-16 lg:pt-20 lg:pb-24">
        <div className="grid lg:grid-cols-[1.05fr_0.95fr] gap-12 lg:gap-16 items-start">
          <div className="max-w-xl lg:pt-4">
            <p className="text-sm text-muted-foreground font-medium tracking-wide uppercase mb-4">For schools &amp; training teams</p>
            <h1 className="font-heading text-4xl sm:text-5xl font-semibold text-foreground leading-[1.12] mb-6">
              Exams that feel{" "}
              <span className="text-gradient-accent italic pr-1">fair</span>
              <span className="text-foreground">, not fragile</span>
            </h1>
            <p className="text-muted-foreground text-base sm:text-lg mb-10 leading-relaxed">
              Clear rules up front, steady monitoring during the attempt, and a paper trail if something looks off—so
              students know what to expect and staff can defend the outcome.
            </p>
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <Button
                size="lg"
                className="rounded-xl text-base h-12 px-8 glow-teal"
                onClick={() => {
                  if (isAuthenticated) {
                    if (user?.role === "admin") {
                      navigate("/admin");
                    } else {
                      navigate("/exam/setup");
                    }
                  } else {
                    navigate("/login");
                  }
                }}
              >
                {isAuthenticated ? (user?.role === "admin" ? "Open admin" : "Continue to setup") : "Log in to begin"}
                <ChevronRight className="w-5 h-5 opacity-90" />
              </Button>
              <p className="text-sm text-muted-foreground sm:max-w-[14rem]">
                New here?{" "}
                <button type="button" className="text-primary underline-offset-4 hover:underline font-medium" onClick={() => navigate("/register")}>
                  Register in a minute
                </button>
                .
              </p>
            </div>
          </div>

          <div className="relative lg:mt-2">
            <div className="absolute -inset-3 rounded-[1.35rem] bg-gradient-to-br from-primary/10 via-transparent to-secondary/30 blur-2xl opacity-80 pointer-events-none" />
            <img
              src={heroImage}
              alt="Stylized shield representing a calm exam environment"
              className="relative rounded-2xl w-full border border-border/50 shadow-2xl object-cover aspect-[4/3] sm:aspect-video lg:aspect-[5/4]"
            />
            <p className="mt-3 text-xs text-muted-foreground text-center lg:text-left px-1">
              Illustration for marketing—your live session uses the student&apos;s own camera and mic, with consent.
            </p>
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-5 sm:px-8 pb-20 lg:pb-28">
        <div className="mb-10 max-w-2xl">
          <h2 className="font-heading text-2xl sm:text-3xl font-semibold text-foreground mb-2">What actually runs</h2>
          <p className="text-muted-foreground leading-relaxed">No mystery toggles—just the few things proctors usually care about, spelled out in one place.</p>
        </div>
        <div className="grid sm:grid-cols-2 gap-5 lg:gap-6">
          {features.map((f) => (
            <Card
              key={f.title}
              className="gradient-card border-border/60 shadow-none hover:border-primary/25 transition-colors duration-200"
            >
              <CardHeader className="pb-3 pt-6">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-background/50 border border-border/50 mb-1">
                  <f.icon className="w-5 h-5 text-primary" strokeWidth={1.75} />
                </div>
                <CardTitle className="text-lg font-semibold mt-2">{f.title}</CardTitle>
                <CardDescription className="text-[15px] leading-relaxed pt-1">{f.desc}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
