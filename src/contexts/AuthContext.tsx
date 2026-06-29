import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { apiClient, type User, type LoginRequest, type RegisterRequest } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

export type AuthActionResult =
  | { ok: true }
  | { ok: false; error: string };

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (credentials: LoginRequest) => Promise<AuthActionResult>;
  register: (userData: RegisterRequest) => Promise<AuthActionResult>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  // Check for existing token on mount
  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    if (token) {
      refreshUser();
    } else {
      setIsLoading(false);
    }
  }, []);

  const refreshUser = async () => {
    try {
      const response = await apiClient.getCurrentUser();
      if (response.success && response.data) {
        setUser(response.data);
      } else {
        // Token invalid, clear it
        localStorage.removeItem("auth_token");
        setUser(null);
      }
    } catch (error) {
      localStorage.removeItem("auth_token");
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (credentials: LoginRequest): Promise<AuthActionResult> => {
    try {
      setIsLoading(true);
      const response = await apiClient.login(credentials);
      
      if (response.success && response.data) {
        localStorage.setItem("auth_token", response.data.token);
        setUser(response.data.user);
        toast({
          title: "Login successful",
          description: `Welcome back, ${response.data.user.name}!`,
        });
        return { ok: true };
      } else {
        const message = response.error || "Invalid email or password";
        toast({
          title: "Login failed",
          description: message,
          variant: "destructive",
        });
        return { ok: false, error: message };
      }
    } catch (error) {
      const message = "An error occurred during login";
      toast({
        title: "Login error",
        description: message,
        variant: "destructive",
      });
      return { ok: false, error: message };
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (userData: RegisterRequest): Promise<AuthActionResult> => {
    try {
      setIsLoading(true);
      const response = await apiClient.register(userData);
      
      if (response.success && response.data) {
        localStorage.setItem("auth_token", response.data.token);
        setUser(response.data.user);
        toast({
          title: "Registration successful",
          description: `Welcome, ${response.data.user.name}!`,
        });
        return { ok: true };
      } else {
        const message = response.error || "Registration failed. Please try again.";
        toast({
          title: "Registration failed",
          description: message,
          variant: "destructive",
        });
        return { ok: false, error: message };
      }
    } catch (error) {
      const message = "An error occurred during registration";
      toast({
        title: "Registration error",
        description: message,
        variant: "destructive",
      });
      return { ok: false, error: message };
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await apiClient.logout();
    } catch (error) {
      // Continue with logout even if API call fails
    } finally {
      localStorage.removeItem("auth_token");
      setUser(null);
      toast({
        title: "Logged out",
        description: "You have been successfully logged out",
      });
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
