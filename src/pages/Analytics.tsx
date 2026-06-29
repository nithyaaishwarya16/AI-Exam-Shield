import type React from "react";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { apiClient } from "@/lib/api";
import {
  Shield,
  BarChart3,
  TrendingUp,
  AlertTriangle,
  Copy,
  MousePointer,
  Monitor,
  Terminal,
  Clipboard,
  UserX,
  Users,
  Smartphone,
  Eye,
  EyeOff,
  Volume2,
  Maximize,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const violationIconMap: Record<string, React.ElementType> = {
  "tab-switch": Monitor,
  copy: Copy,
  paste: Clipboard,
  "right-click": MousePointer,
  "dev-tools": Terminal,
  minimize: Monitor,
  "no-face": UserX,
  "multiple-faces": Users,
  "prohibited-object": Smartphone,
  "gaze-away": Eye,
  "face-obscured": EyeOff,
  "loud-noise": Volume2,
  "fullscreen-exit": Maximize,
};

export default function Analytics() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [violationAnalytics, setViolationAnalytics] = useState<any>(null);
  const [sessionAnalytics, setSessionAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.role !== 'admin') {
      navigate("/");
      return;
    }
    loadAnalytics();
  }, [user, navigate]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      const [violationsRes, sessionsRes] = await Promise.all([
        apiClient.getViolationAnalytics(),
        apiClient.getExamSessionAnalytics(),
      ]);

      if (violationsRes.success) {
        setViolationAnalytics(violationsRes.data);
      }
      if (sessionsRes.success) {
        setSessionAnalytics(sessionsRes.data);
      }
    } catch (error) {
      console.error("Failed to load analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen gradient-hero">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Analytics Dashboard</h1>
            <p className="text-muted-foreground">Detailed violation and session analytics</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate("/admin")}>
              <Shield className="w-4 h-4 mr-2" />
              Admin Dashboard
            </Button>
            <Button onClick={() => navigate("/")}>
              Back to Home
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12 text-muted-foreground">Loading analytics...</div>
        ) : (
          <div className="space-y-8">
            {/* Violation Analytics */}
            {violationAnalytics && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5" />
                    Violation Analytics
                  </CardTitle>
                  <CardDescription>Statistics and trends for violations</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    <div className="p-4 bg-muted/30 rounded-lg">
                      <div className="text-sm text-muted-foreground mb-1">Total Violations</div>
                      <div className="text-2xl font-bold">{violationAnalytics.summary?.totalViolations || 0}</div>
                    </div>
                    <div className="p-4 bg-muted/30 rounded-lg">
                      <div className="text-sm text-muted-foreground mb-1">Affected Users</div>
                      <div className="text-2xl font-bold">{violationAnalytics.summary?.totalUsers || 0}</div>
                    </div>
                    <div className="p-4 bg-muted/30 rounded-lg">
                      <div className="text-sm text-muted-foreground mb-1">Sessions with Violations</div>
                      <div className="text-2xl font-bold">{violationAnalytics.summary?.totalSessions || 0}</div>
                    </div>
                    <div className="p-4 bg-muted/30 rounded-lg">
                      <div className="text-sm text-muted-foreground mb-1">Avg per User</div>
                      <div className="text-2xl font-bold">
                        {violationAnalytics.summary?.averageViolationsPerUser || '0'}
                      </div>
                    </div>
                  </div>

                  {/* Violations by Type */}
                  {violationAnalytics.byType && violationAnalytics.byType.length > 0 && (
                    <div className="mt-6">
                      <h3 className="font-semibold mb-4">Violations by Type</h3>
                      <div className="space-y-2">
                        {violationAnalytics.byType.map((item: any) => {
                          const Icon = violationIconMap[item._id] || AlertTriangle;
                          const label = String(item._id || "").replace("-", " ");

                          return (
                            <div
                              key={item._id}
                              className="flex items-center justify-between p-3 bg-muted/20 rounded"
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                                  <Icon className="w-4 h-4 text-destructive" />
                                </div>
                                <span className="font-medium capitalize">{label}</span>
                              </div>
                              <span className="text-lg font-bold">{item.count}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Top Violators */}
                  {violationAnalytics.byUser && violationAnalytics.byUser.length > 0 && (
                    <div className="mt-6">
                      <h3 className="font-semibold mb-4">Top Violators</h3>
                      <div className="space-y-2">
                        {violationAnalytics.byUser.map((item: any, index: number) => (
                          <div key={item._id} className="flex items-center justify-between p-3 bg-muted/20 rounded">
                            <div>
                              <span className="font-medium">{item.userName}</span>
                              <span className="text-sm text-muted-foreground ml-2">({item.userEmail})</span>
                            </div>
                            <span className="text-lg font-bold">{item.count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Session Analytics */}
            {sessionAnalytics && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5" />
                    Exam Session Analytics
                  </CardTitle>
                  <CardDescription>Statistics for exam sessions</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="p-4 bg-muted/30 rounded-lg">
                      <div className="text-sm text-muted-foreground mb-1">Total Sessions</div>
                      <div className="text-2xl font-bold">{sessionAnalytics.totalSessions || 0}</div>
                    </div>
                    <div className="p-4 bg-muted/30 rounded-lg">
                      <div className="text-sm text-muted-foreground mb-1">Completed</div>
                      <div className="text-2xl font-bold text-green-500">{sessionAnalytics.completedSessions || 0}</div>
                    </div>
                    <div className="p-4 bg-muted/30 rounded-lg">
                      <div className="text-sm text-muted-foreground mb-1">Completion Rate</div>
                      <div className="text-2xl font-bold">{sessionAnalytics.completionRate || 0}%</div>
                    </div>
                  </div>

                  {/* Sessions by Status */}
                  {sessionAnalytics.byStatus && sessionAnalytics.byStatus.length > 0 && (
                    <div className="mt-6">
                      <h3 className="font-semibold mb-4">Sessions by Status</h3>
                      <div className="space-y-2">
                        {sessionAnalytics.byStatus.map((item: any) => (
                          <div key={item._id} className="flex items-center justify-between p-3 bg-muted/20 rounded">
                            <span className="font-medium capitalize">{item._id}</span>
                            <div className="flex items-center gap-4">
                              <span className="text-sm text-muted-foreground">
                                Avg Violations: {item.avgViolations?.toFixed(1) || '0'}
                              </span>
                              <span className="text-lg font-bold">{item.count}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
