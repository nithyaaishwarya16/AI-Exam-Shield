import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { apiClient } from "@/lib/api";
import { Shield, Clock, CheckCircle, XCircle, AlertTriangle, Eye } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface ExamSession {
  _id: string;
  examName: string;
  startTime: string;
  endTime?: string;
  duration: number;
  status: string;
  violationCount: number;
  score?: number;
  examId?: {
    name: string;
    type: string;
  };
}

export default function StudentDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [sessions, setSessions] = useState<ExamSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadExamHistory();
  }, []);

  const loadExamHistory = async () => {
    try {
      const response = await apiClient.getExamHistory();
      if (response.success && response.data) {
        setSessions(response.data);
      }
    } catch (error) {
      console.error("Failed to load exam history:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (minutes: number) => {
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      'in-progress': { icon: Clock, color: 'text-blue-500', bg: 'bg-blue-500/10', label: 'In Progress' },
      'completed': { icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-500/10', label: 'Completed' },
      'submitted': { icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-500/10', label: 'Submitted' },
      'auto-submitted': { icon: AlertTriangle, color: 'text-red-500', bg: 'bg-red-500/10', label: 'Auto-Submitted' },
      'terminated': { icon: XCircle, color: 'text-red-500', bg: 'bg-red-500/10', label: 'Terminated' },
    };
    return badges[status as keyof typeof badges] || badges.completed;
  };

  const getScoreColor = (score?: number) => {
    if (!score) return 'text-muted-foreground';
    if (score >= 80) return 'text-green-500';
    if (score >= 60) return 'text-yellow-500';
    return 'text-red-500';
  };

  const stats = {
    total: sessions.length,
    completed: sessions.filter(s => s.status === 'completed' || s.status === 'submitted').length,
    inProgress: sessions.filter(s => s.status === 'in-progress').length,
    avgScore: sessions.filter(s => s.score !== null && s.score !== undefined).length > 0
      ? sessions.reduce((sum, s) => sum + (s.score || 0), 0) / sessions.filter(s => s.score !== null).length
      : 0,
  };

  return (
    <div className="min-h-screen gradient-hero">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Student Dashboard</h1>
            <p className="text-muted-foreground">View your exam history and results</p>
          </div>
          <Button onClick={() => navigate("/")}>
            <Shield className="w-4 h-4 mr-2" />
            Back to Home
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Exams</CardDescription>
              <CardTitle className="text-2xl">{stats.total}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Completed</CardDescription>
              <CardTitle className="text-2xl text-green-500">{stats.completed}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>In Progress</CardDescription>
              <CardTitle className="text-2xl text-blue-500">{stats.inProgress}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Average Score</CardDescription>
              <CardTitle className={`text-2xl ${getScoreColor(stats.avgScore)}`}>
                {stats.avgScore > 0 ? `${stats.avgScore.toFixed(1)}%` : 'N/A'}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Exam History */}
        <Card>
          <CardHeader>
            <CardTitle>Exam History</CardTitle>
            <CardDescription>Your past and current exam sessions</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : sessions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Eye className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No exam history found</p>
                <p className="text-sm mt-2">Start an exam to see your history here</p>
              </div>
            ) : (
              <div className="space-y-4">
                {sessions.map((session) => {
                  const badge = getStatusBadge(session.status);
                  const StatusIcon = badge.icon;
                  const startDate = new Date(session.startTime);
                  const endDate = session.endTime ? new Date(session.endTime) : null;
                  
                  return (
                    <div
                      key={session._id}
                      className="border border-border rounded-lg p-4 hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-semibold text-lg">{session.examName}</h3>
                            <span className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${badge.bg} ${badge.color}`}>
                              <StatusIcon className="w-3 h-3" />
                              {badge.label}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-muted-foreground">
                            <div>
                              <span className="font-medium">Started:</span> {startDate.toLocaleString()}
                            </div>
                            {endDate && (
                              <div>
                                <span className="font-medium">Ended:</span> {endDate.toLocaleString()}
                              </div>
                            )}
                            <div>
                              <span className="font-medium">Duration:</span> {formatDuration(session.duration)}
                            </div>
                            <div>
                              <span className="font-medium">Violations:</span> {session.violationCount}
                            </div>
                          </div>
                          {session.score !== null && session.score !== undefined && (
                            <div className="mt-2">
                              <span className="text-sm text-muted-foreground">Score: </span>
                              <span className={`font-bold text-lg ${getScoreColor(session.score)}`}>
                                {session.score.toFixed(1)}%
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
