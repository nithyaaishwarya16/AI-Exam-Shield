import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { apiClient } from "@/lib/api";
import { 
  Shield, Users, AlertTriangle, FileText, BarChart3, Eye, 
  Search, Filter, Calendar, X, Download, CheckCircle, XCircle, LogOut,
  ChevronLeft, ChevronRight
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

interface Violation {
  _id: string;
  type: string;
  message: string;
  timestamp: string;
  userName: string;
  userEmail: string;
  userId?: {
    name: string;
    email: string;
    studentId?: string;
  };
  screenshot?: string | null;
  hasScreenshot?: boolean;
  examSessionId?: string;
  review?: {
    status: "pending" | "benign" | "confirmed";
    note?: string | null;
    reviewedAt?: string | null;
  };
}

interface ExamSession {
  _id: string;
  examName: string;
  userName: string;
  userEmail: string;
  startTime: string;
  endTime?: string;
  status: string;
  violationCount: number;
  score?: number;
}

interface AiSessionSummary {
  riskScore: number;
  summary: string;
  flaggedReasons: string[];
  recommendedActions: string[];
  topEvidence?: Array<{
    timestamp: string;
    type: string;
    why: string;
    hasScreenshot: boolean;
  }>;
  model?: string | null;
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [violations, setViolations] = useState<Violation[]>([]);
  const [sessions, setSessions] = useState<ExamSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'violations' | 'sessions'>('violations');
  
  // Violation review state
  const [selectedViolation, setSelectedViolation] = useState<Violation | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const itemsPerPage = 20;

  // AI session summary state
  const [aiSession, setAiSession] = useState<ExamSession | null>(null);
  const [aiSummary, setAiSummary] = useState<AiSessionSummary | null>(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  useEffect(() => {
    if (user?.role !== 'admin') {
      navigate("/");
      return;
    }
    loadData();
  }, [user, navigate, currentPage]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [violationsRes, sessionsRes] = await Promise.all([
        apiClient.adminGetViolations({ 
          limit: itemsPerPage,
          page: currentPage,
          type: filterType !== 'all' ? filterType : undefined,
          faceOnly: true,
          hasScreenshot: true,
        }),
        apiClient.adminGetExamSessions({ limit: 50 }),
      ]);

      if (violationsRes.success) {
        const data = violationsRes.data?.data || violationsRes.data || [];
        setViolations(Array.isArray(data) ? data : []);
        if (violationsRes.data?.pagination) {
          setTotalPages(violationsRes.data.pagination.pages || 1);
        }
      }
      if (sessionsRes.success) {
        setSessions(sessionsRes.data?.data || sessionsRes.data || []);
      }
    } catch (error) {
      console.error("Failed to load admin data:", error);
    } finally {
      setLoading(false);
    }
  };

  const openViolationDetail = async (violation: Violation) => {
    // Load full violation details including screenshot
    try {
      const res = await apiClient.adminGetViolation(violation._id);
      if (res.success && res.data) {
        setSelectedViolation(res.data);
        setIsDetailOpen(true);
      }
    } catch (error) {
      console.error("Failed to load violation details:", error);
      setSelectedViolation(violation);
      setIsDetailOpen(true);
    }
  };

  const getScreenshotSrc = (screenshot?: string | null) => {
    if (!screenshot) return null;
    // Supports both full data URL and raw base64 payload from backend.
    if (screenshot.startsWith("data:image/")) return screenshot;
    return `data:image/jpeg;base64,${screenshot}`;
  };

  const downloadScreenshot = () => {
    if (!selectedViolation?.screenshot) return;
    const src = getScreenshotSrc(selectedViolation.screenshot);
    if (!src) return;
    const link = document.createElement('a');
    link.href = src;
    link.download = `violation-${selectedViolation._id}-${new Date(selectedViolation.timestamp).toISOString()}.jpg`;
    link.click();
  };

  const violationStats = {
    total: violations.length,
    byType: violations.reduce((acc, v) => {
      acc[v.type] = (acc[v.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
  };

  const sessionStats = {
    total: sessions.length,
    completed: sessions.filter(s => s.status === 'completed' || s.status === 'submitted').length,
    inProgress: sessions.filter(s => s.status === 'in-progress').length,
    terminated: sessions.filter(s => s.status === 'terminated' || s.status === 'auto-submitted').length,
  };

  // Filter violations
  const filteredViolations = violations.filter(v => {
    const matchesSearch = searchQuery === "" || 
      v.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.userEmail.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesType = filterType === "all" || v.type === filterType;
    
    return matchesSearch && matchesType;
  });

  const uniqueTypes = Array.from(new Set(violations.map(v => v.type)));

  const getViolationTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      'tab-switch': 'bg-red-500/10 text-red-500',
      'multiple-faces': 'bg-red-500/10 text-red-500',
      'prohibited-object': 'bg-orange-500/10 text-orange-500',
      'gaze-away': 'bg-yellow-500/10 text-yellow-500',
      'no-face': 'bg-yellow-500/10 text-yellow-500',
      'face-obscured': 'bg-yellow-500/10 text-yellow-500',
      'loud-noise': 'bg-blue-500/10 text-blue-500',
      'copy': 'bg-purple-500/10 text-purple-500',
      'paste': 'bg-purple-500/10 text-purple-500',
    };
    return colors[type] || 'bg-gray-500/10 text-gray-500';
  };

  const openAiSummary = async (session: ExamSession) => {
    setAiSession(session);
    setAiSummary(null);
    setAiError(null);
    setAiOpen(true);
    setAiLoading(true);
    try {
      const res = await apiClient.adminGetExamSessionAiSummary(session._id);
      if (res.success && res.data) {
        setAiSummary(res.data as AiSessionSummary);
      } else {
        setAiError(res.error || "Failed to generate AI summary");
      }
    } catch (e) {
      setAiError(e instanceof Error ? e.message : "Failed to generate AI summary");
    } finally {
      setAiLoading(false);
    }
  };

  const markViolation = async (status: "benign" | "confirmed") => {
    if (!selectedViolation?._id) return;
    try {
      const res = await apiClient.adminReviewViolation(selectedViolation._id, { status });
      if (res.success && res.data) {
        setSelectedViolation(res.data);
        setViolations((prev) =>
          prev.map((v) => (v._id === selectedViolation._id ? { ...v, review: res.data.review } : v))
        );
      }
    } catch (error) {
      console.error("Failed to mark violation:", error);
    }
  };

  return (
    <div className="min-h-screen gradient-hero">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Admin Dashboard</h1>
            <p className="text-muted-foreground">Violation Review & Exam Session Management</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate("/analytics")}>
              <BarChart3 className="w-4 h-4 mr-2" />
              Analytics
            </Button>
            <Button onClick={() => navigate("/")}>
              <Shield className="w-4 h-4 mr-2" />
              Back to Home
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                await logout();
                navigate("/login");
              }}
            >
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Violations</CardDescription>
              <CardTitle className="text-2xl">{violationStats.total}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Sessions</CardDescription>
              <CardTitle className="text-2xl">{sessionStats.total}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Completed</CardDescription>
              <CardTitle className="text-2xl text-green-500">{sessionStats.completed}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>In Progress</CardDescription>
              <CardTitle className="text-2xl text-blue-500">{sessionStats.inProgress}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-4">
          <Button
            variant={activeTab === 'violations' ? 'default' : 'outline'}
            onClick={() => setActiveTab('violations')}
          >
            <AlertTriangle className="w-4 h-4 mr-2" />
            Violations ({violationStats.total})
          </Button>
          <Button
            variant={activeTab === 'sessions' ? 'default' : 'outline'}
            onClick={() => setActiveTab('sessions')}
          >
            <FileText className="w-4 h-4 mr-2" />
            Exam Sessions ({sessionStats.total})
          </Button>
        </div>

        {/* Violations Tab */}
        {activeTab === 'violations' && (
          <Card>
            <CardHeader>
              <CardTitle>Violation Review Interface</CardTitle>
              <CardDescription>Face-related violations with screenshot evidence only</CardDescription>
            </CardHeader>
            <CardContent>
              {/* Filters */}
              <div className="flex flex-col md:flex-row gap-4 mb-6">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search violations by message, student name, or email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="w-[180px]">
                    <Filter className="w-4 h-4 mr-2" />
                    <SelectValue placeholder="Filter by type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {uniqueTypes.map(type => (
                      <SelectItem key={type} value={type}>
                        {type.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearchQuery("");
                    setFilterType("all");
                  }}
                >
                  <X className="w-4 h-4 mr-2" />
                  Clear Filters
                </Button>
              </div>

              {loading ? (
                <div className="text-center py-8 text-muted-foreground">Loading violations...</div>
              ) : filteredViolations.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <AlertTriangle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No violations found</p>
                  {searchQuery || filterType !== "all" ? (
                    <p className="text-sm mt-2">Try adjusting your filters</p>
                  ) : null}
                </div>
              ) : (
                <>
                  <div className="space-y-4">
                    {filteredViolations.map((violation) => (
                      <div
                        key={violation._id}
                        className="border border-border rounded-lg p-4 hover:bg-muted/30 transition-colors cursor-pointer"
                        onClick={() => openViolationDetail(violation)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                              <Badge className={getViolationTypeColor(violation.type)}>
                                {violation.type.replace('-', ' ')}
                              </Badge>
                              {violation.review?.status && violation.review.status !== "pending" && (
                                <Badge variant="outline">
                                  {violation.review.status}
                                </Badge>
                              )}
                              <span className="text-sm text-muted-foreground flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {new Date(violation.timestamp).toLocaleString()}
                              </span>
                              {violation.hasScreenshot && (
                                <Badge variant="outline" className="text-xs">
                                  📷 Screenshot Available
                                </Badge>
                              )}
                            </div>
                            <p className="font-medium mb-2">{violation.message}</p>
                            <div className="text-sm text-muted-foreground space-y-1">
                              <div>
                                <span className="font-medium">Student:</span> {violation.userName} ({violation.userEmail})
                                {violation.userId?.studentId && (
                                  <span className="ml-2">• ID: {violation.userId.studentId}</span>
                                )}
                              </div>
                              {violation.examSessionId && (
                                <div>
                                  <span className="font-medium">Session ID:</span> {violation.examSessionId}
                                </div>
                              )}
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              openViolationDetail(violation);
                            }}
                            className="ml-4"
                          >
                            <Eye className="w-4 h-4 mr-2" />
                            Review
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between mt-6 pt-4 border-t">
                      <div className="text-sm text-muted-foreground">
                        Page {currentPage} of {totalPages}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                          disabled={currentPage === 1}
                        >
                          <ChevronLeft className="w-4 h-4" />
                          Previous
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                          disabled={currentPage === totalPages}
                        >
                          Next
                          <ChevronRight className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Sessions Tab */}
        {activeTab === 'sessions' && (
          <Card>
            <CardHeader>
              <CardTitle>Exam Sessions</CardTitle>
              <CardDescription>All exam sessions across all students</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : sessions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No exam sessions found</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {sessions.map((session) => (
                    <div
                      key={session._id}
                      className="border border-border rounded-lg p-4 hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-semibold">{session.examName}</h3>
                            <span className={`px-2 py-1 text-xs font-medium rounded ${
                              session.status === 'completed' || session.status === 'submitted'
                                ? 'bg-green-500/10 text-green-500'
                                : session.status === 'in-progress'
                                ? 'bg-blue-500/10 text-blue-500'
                                : 'bg-red-500/10 text-red-500'
                            }`}>
                              {session.status}
                            </span>
                          </div>
                          <div className="text-sm text-muted-foreground space-y-1">
                            <div>
                              <span className="font-medium">Student:</span> {session.userName} ({session.userEmail})
                            </div>
                            <div>
                              <span className="font-medium">Started:</span> {new Date(session.startTime).toLocaleString()}
                            </div>
                            {session.endTime && (
                              <div>
                                <span className="font-medium">Ended:</span> {new Date(session.endTime).toLocaleString()}
                              </div>
                            )}
                            <div>
                              <span className="font-medium">Violations:</span> {session.violationCount}
                            </div>
                            {session.score !== null && session.score !== undefined && (
                              <div>
                                <span className="font-medium">Score:</span> {session.score.toFixed(1)}%
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="ml-4 flex flex-col gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openAiSummary(session)}
                          >
                            <Eye className="w-4 h-4 mr-2" />
                            AI Summary
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* AI Session Summary Dialog */}
        <Dialog open={aiOpen} onOpenChange={setAiOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary" />
                AI Session Review
              </DialogTitle>
              <DialogDescription>
                {aiSession
                  ? `Session ${aiSession._id} • ${aiSession.userName} • ${aiSession.examName}`
                  : "Session review"}
              </DialogDescription>
            </DialogHeader>

            {aiLoading && (
              <div className="text-sm text-muted-foreground">Generating summary…</div>
            )}

            {!aiLoading && aiError && (
              <div className="text-sm text-destructive">{aiError}</div>
            )}

            {!aiLoading && aiSummary && (
              <div className="space-y-5">
                <div className="flex items-center justify-between border rounded-lg p-3">
                  <div>
                    <div className="text-sm text-muted-foreground">Risk score</div>
                    <div className="text-2xl font-bold">{aiSummary.riskScore}/100</div>
                  </div>
                  <div className="text-xs text-muted-foreground text-right">
                    Model: {aiSummary.model || "Not configured"}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-sm font-semibold">Summary</div>
                  <div className="text-sm text-muted-foreground border rounded-lg p-3">
                    {aiSummary.summary}
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="text-sm font-semibold">Why it was flagged</div>
                    <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
                      {aiSummary.flaggedReasons?.map((r, i) => (
                        <li key={`${r}-${i}`}>{r}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="space-y-2">
                    <div className="text-sm font-semibold">Recommended review steps</div>
                    <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
                      {aiSummary.recommendedActions?.map((r, i) => (
                        <li key={`${r}-${i}`}>{r}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                {aiSummary.topEvidence && aiSummary.topEvidence.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-sm font-semibold">Top evidence</div>
                    <div className="space-y-2">
                      {aiSummary.topEvidence.slice(0, 8).map((ev, i) => (
                        <div key={`${ev.timestamp}-${i}`} className="border rounded-lg p-3">
                          <div className="flex items-center justify-between">
                            <div className="text-sm font-medium">{ev.type}</div>
                            <div className="text-xs text-muted-foreground">
                              {new Date(ev.timestamp).toLocaleString()}
                            </div>
                          </div>
                          <div className="text-sm text-muted-foreground mt-1">
                            {ev.why}
                          </div>
                          {ev.hasScreenshot && (
                            <div className="text-xs text-muted-foreground mt-2">
                              📷 Screenshot available (see Violations tab)
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Violation Detail Dialog */}
        <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-destructive" />
                Violation Details
              </DialogTitle>
              <DialogDescription>
                Review violation evidence and student information
              </DialogDescription>
            </DialogHeader>
            
            {selectedViolation && (
              <div className="space-y-6">
                {/* Violation Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Violation Type</label>
                    <div className="mt-1">
                      <Badge className={getViolationTypeColor(selectedViolation.type)}>
                        {selectedViolation.type.replace('-', ' ')}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Timestamp</label>
                    <div className="mt-1 text-sm">
                      {new Date(selectedViolation.timestamp).toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Review Status</label>
                    <div className="mt-1 text-sm">
                      {selectedViolation.review?.status || "pending"}
                    </div>
                  </div>
                  <div className="col-span-2">
                    <label className="text-sm font-medium text-muted-foreground">Message</label>
                    <div className="mt-1 p-3 bg-muted/30 rounded-lg">
                      {selectedViolation.message}
                    </div>
                  </div>
                </div>

                {/* Student Info */}
                <div className="border-t pt-4">
                  <h3 className="font-semibold mb-3">Student Information</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Name</label>
                      <div className="mt-1 text-sm">{selectedViolation.userName}</div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Email</label>
                      <div className="mt-1 text-sm">{selectedViolation.userEmail}</div>
                    </div>
                    {selectedViolation.userId?.studentId && (
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Student ID</label>
                        <div className="mt-1 text-sm">{selectedViolation.userId.studentId}</div>
                      </div>
                    )}
                    {selectedViolation.examSessionId && (
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Exam Session</label>
                        <div className="mt-1 text-sm font-mono text-xs">{selectedViolation.examSessionId}</div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Screenshot */}
                {selectedViolation.screenshot && (
                  <div className="border-t pt-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold">Evidence Screenshot</h3>
                      <Button variant="outline" size="sm" onClick={downloadScreenshot}>
                        <Download className="w-4 h-4 mr-2" />
                        Download
                      </Button>
                    </div>
                    <div className="border rounded-lg overflow-hidden bg-black">
                      <img
                        src={getScreenshotSrc(selectedViolation.screenshot) || ""}
                        alt="Violation screenshot"
                        className="w-full h-auto max-h-96 object-contain"
                      />
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="border-t pt-4 flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsDetailOpen(false)}>
                    Close
                  </Button>
                  <Button variant="outline" onClick={() => markViolation("benign")}>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Mark Benign
                  </Button>
                  <Button onClick={() => markViolation("confirmed")}>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Confirm Violation
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
