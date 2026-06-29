// API Configuration — in dev, prefer same-origin `/api` (Vite proxy → backend) so fetch never
// crosses origins (localhost vs 127.0.0.1 vs LAN IP all break absolute http://localhost:3000).
const envApi = (import.meta.env.VITE_API_URL as string | undefined)?.trim();
const API_BASE_URL =
  envApi && envApi.length > 0
    ? envApi.replace(/\/$/, "")
    : import.meta.env.DEV
      ? "/api"
      : "http://localhost:3000/api";

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface User {
  _id: string;
  email: string;
  name: string;
  studentId?: string;
  role: "student" | "admin";
  createdAt: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
  studentId?: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

// API Client
class ApiClient {
  private baseURL: string;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const token = localStorage.getItem("auth_token");
    
    const headers: HeadersInit = {
      "Content-Type": "application/json",
      ...options.headers,
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    try {
      const response = await fetch(`${this.baseURL}${endpoint}`, {
        ...options,
        headers,
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error || data.message || "An error occurred",
        };
      }

      return {
        success: true,
        data: data.data || data,
        message: data.message,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Network error occurred";
      // "Failed to fetch" usually means backend is not running or CORS issue
      const friendlyError = message === "Failed to fetch"
        ? "Cannot connect to server. Make sure backend is running (npm run dev in backend-code folder)."
        : message;
      return {
        success: false,
        error: friendlyError,
      };
    }
  }

  // Auth endpoints
  async login(credentials: LoginRequest): Promise<ApiResponse<AuthResponse>> {
    return this.request<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify(credentials),
    });
  }

  async register(userData: RegisterRequest): Promise<ApiResponse<AuthResponse>> {
    return this.request<AuthResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify(userData),
    });
  }

  async getCurrentUser(): Promise<ApiResponse<User>> {
    return this.request<User>("/auth/me");
  }

  async logout(): Promise<ApiResponse<void>> {
    return this.request<void>("/auth/logout", {
      method: "POST",
    });
  }

  // Violation reporting with screenshot
  async reportViolation(data: {
    type: string;
    message: string;
    timestamp: Date;
    screenshot?: string | null;
    examSessionId?: string | null;
  }): Promise<ApiResponse<any>> {
    return this.request("/violations", {
      method: "POST",
      body: JSON.stringify({
        ...data,
        timestamp: data.timestamp?.toISOString?.() || new Date().toISOString(),
      }),
    });
  }

  // Exam endpoints
  async getActiveExams(): Promise<ApiResponse<any[]>> {
    return this.request<any[]>("/exams/active");
  }

  async getExamById(examId: string): Promise<ApiResponse<any>> {
    return this.request<any>(`/exams/${examId}`);
  }

  async startExamSession(examId: string): Promise<ApiResponse<any>> {
    return this.request("/exams/sessions/start", {
      method: "POST",
      body: JSON.stringify({ examId }),
    });
  }

  async submitExamSession(data: {
    sessionId: string;
    answers?: Record<string, any>;
    videoRecordingData?: string | null;
  }): Promise<ApiResponse<any>> {
    return this.request("/exams/sessions/submit", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async getExamHistory(): Promise<ApiResponse<any[]>> {
    return this.request<any[]>("/exams/sessions/history");
  }

  async getExamSession(sessionId: string): Promise<ApiResponse<any>> {
    return this.request<any>(`/exams/sessions/${sessionId}`);
  }

  // Analytics endpoints
  async getViolationAnalytics(params?: {
    startDate?: string;
    endDate?: string;
    examId?: string;
  }): Promise<ApiResponse<any>> {
    const query = new URLSearchParams(params as any).toString();
    return this.request<any>(`/analytics/violations${query ? `?${query}` : ''}`);
  }

  async getExamSessionAnalytics(params?: {
    startDate?: string;
    endDate?: string;
  }): Promise<ApiResponse<any>> {
    const query = new URLSearchParams(params as any).toString();
    return this.request<any>(`/analytics/sessions${query ? `?${query}` : ''}`);
  }

  // Admin endpoints
  async adminGetViolations(params?: {
    page?: number;
    limit?: number;
    userId?: string;
    type?: string;
    startDate?: string;
    endDate?: string;
    faceOnly?: boolean;
    hasScreenshot?: boolean;
  }): Promise<ApiResponse<any>> {
    const query = new URLSearchParams(params as any).toString();
    return this.request<any>(`/admin/violations${query ? `?${query}` : ''}`);
  }

  async adminGetViolation(violationId: string): Promise<ApiResponse<any>> {
    return this.request<any>(`/admin/violations/${violationId}`);
  }

  async adminReviewViolation(
    violationId: string,
    payload: { status: "benign" | "confirmed"; note?: string }
  ): Promise<ApiResponse<any>> {
    return this.request<any>(`/admin/violations/${violationId}/review`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  }

  async adminGetExamSessions(params?: {
    page?: number;
    limit?: number;
    userId?: string;
    examId?: string;
    status?: string;
  }): Promise<ApiResponse<any>> {
    const query = new URLSearchParams(params as any).toString();
    return this.request<any>(`/admin/sessions${query ? `?${query}` : ''}`);
  }

  async adminGetExamSessionAiSummary(sessionId: string): Promise<ApiResponse<any>> {
    return this.request<any>(`/admin/sessions/${sessionId}/ai-summary`);
  }

  async adminGetUsers(): Promise<ApiResponse<any[]>> {
    return this.request<any[]>("/admin/users");
  }

  async adminGetExams(): Promise<ApiResponse<any[]>> {
    return this.request<any[]>("/admin/exams");
  }
}

export const apiClient = new ApiClient(API_BASE_URL);
