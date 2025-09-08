import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import Sidebar from "@/components/sidebar";
import KpiCards from "@/components/kpi-cards";
import RecentActivity from "@/components/recent-activity";
import PipelineOverview from "@/components/pipeline-overview";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export default function Dashboard() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading, user } = useAuth();

  // Redirect to home if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are not logged in. Redirecting to login...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  const googleSheetsImport = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/integrations/google-sheets/import");
    },
    onSuccess: () => {
      toast({
        title: "Import successful",
        description: "Google Sheets data was successfully imported.",
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are not logged in. Redirecting to login...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Import failed",
        description: "Google Sheets import could not be performed.",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gradient-to-br from-slate-50 via-white to-blue-50/30">
      <Sidebar />
      
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Header */}
        <header className="glass border-b border-white/10 backdrop-blur-xl">
          <div className="flex items-center justify-between h-20 px-6">
            <div className="flex items-center space-x-4">
              <button className="lg:hidden p-3 rounded-xl text-muted-foreground hover:bg-white/10 transition-all duration-200">
                <i className="fas fa-bars"></i>
              </button>
              <div>
                <h1 className="text-2xl font-bold gradient-text">Dashboard</h1>
                <p className="text-xs text-muted-foreground mt-1">Welcome back, {user?.firstName}!</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              {/* Google Sheets Sync Status */}
              <div className="flex items-center space-x-3 px-4 py-2 bg-emerald-500/20 border border-emerald-500/30 rounded-xl backdrop-blur-sm">
                <div className="w-3 h-3 bg-emerald-400 rounded-full animate-glow"></div>
                <span className="text-sm font-medium text-emerald-300">Sheets Sync Active</span>
              </div>
              
              <button className="p-3 text-muted-foreground hover:bg-white/10 rounded-xl transition-all duration-200 relative">
                <i className="fas fa-bell text-lg"></i>
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
              </button>
              <button 
                className="p-3 text-muted-foreground hover:bg-white/10 rounded-xl transition-all duration-200"
                onClick={() => window.location.href = '/api/logout'}
                data-testid="button-logout"
              >
                <i className="fas fa-sign-out-alt text-lg"></i>
              </button>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-auto">
          <div className="p-8 space-y-8">
            {/* Welcome Section */}
            <div className="mb-8">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg text-muted-foreground mb-2">Analytics Overview</h2>
                  <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                    <div className="flex items-center space-x-1">
                      <i className="fas fa-calendar text-primary"></i>
                      <span>{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <i className="fas fa-clock text-primary"></i>
                      <span>Last updated: {new Date().toLocaleTimeString()}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* KPI Cards */}
            <div>
              <KpiCards />
            </div>

            {/* Quick Actions & Recent Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Quick Actions */}
              <Card className="glass border-0 card-hover">
                <CardContent className="p-8">
                  <div className="flex items-center mb-6">
                    <div className="p-3 bg-gradient-to-r from-primary to-purple-600 rounded-xl mr-4">
                      <i className="fas fa-rocket text-white"></i>
                    </div>
                    <h3 className="text-xl font-bold gradient-text">Quick Actions</h3>
                  </div>
                  <div className="space-y-4">
                    <Button 
                      className="w-full justify-between h-14 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 border-0 rounded-xl transition-all duration-300 hover:scale-105" 
                      onClick={() => window.location.href = '/deals/submit'}
                      data-testid="button-new-deal"
                    >
                      <span className="flex items-center">
                        <i className="fas fa-plus mr-3 text-lg"></i>
                        <span className="font-semibold">Submit New Deal</span>
                      </span>
                      <i className="fas fa-arrow-right text-lg"></i>
                    </Button>
                    
                    <Button 
                      className="w-full justify-between h-14 bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-700 hover:to-cyan-700 border-0 rounded-xl transition-all duration-300 hover:scale-105"
                      onClick={() => googleSheetsImport.mutate()}
                      disabled={googleSheetsImport.isPending}
                      data-testid="button-google-sheets-import"
                    >
                      <span className="flex items-center">
                        <i className={`${googleSheetsImport.isPending ? 'fas fa-spinner animate-spin' : 'fas fa-sync'} mr-3 text-lg`}></i>
                        <span className="font-semibold">{googleSheetsImport.isPending ? 'Importing...' : 'Sync Google Sheets'}</span>
                      </span>
                      <i className="fas fa-arrow-right text-lg"></i>
                    </Button>
                    
                    {user?.role === 'admin' && (
                      <Button 
                        className="w-full justify-between h-14 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 border-0 rounded-xl transition-all duration-300 hover:scale-105"
                        onClick={() => window.location.href = '/deals/evaluate'}
                        data-testid="button-deal-evaluation"
                      >
                        <span className="flex items-center">
                          <i className="fas fa-check-circle mr-3 text-lg"></i>
                          <span className="font-semibold">Deal Evaluation</span>
                        </span>
                        <i className="fas fa-arrow-right text-lg"></i>
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Recent Activity */}
              <div className="lg:col-span-2">
                <RecentActivity />
              </div>
            </div>

            {/* Pipeline Overview */}
            <PipelineOverview />

            {/* API Integration Status */}
            <Card className="glass border-0 card-hover">
              <CardContent className="p-8">
                <div className="flex items-center mb-6">
                  <div className="p-3 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-xl mr-4">
                    <i className="fas fa-plug text-white"></i>
                  </div>
                  <h3 className="text-xl font-bold gradient-text">API Integrations</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="relative p-6 bg-gradient-to-br from-emerald-500/10 to-green-400/10 border border-emerald-500/20 rounded-2xl backdrop-blur-sm hover:scale-105 transition-all duration-300">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-green-400 rounded-t-2xl"></div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-green-400 rounded-xl flex items-center justify-center shadow-lg">
                          <i className="fab fa-amazon text-white text-lg"></i>
                        </div>
                        <div>
                          <p className="font-semibold text-emerald-300">Amazon MWS</p>
                          <p className="text-xs text-emerald-400/70">Last Sync: 5 min ago</p>
                        </div>
                      </div>
                      <div className="w-4 h-4 bg-emerald-400 rounded-full animate-glow shadow-lg"></div>
                    </div>
                  </div>

                  <div className="relative p-6 bg-gradient-to-br from-blue-500/10 to-cyan-400/10 border border-blue-500/20 rounded-2xl backdrop-blur-sm hover:scale-105 transition-all duration-300">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-cyan-400 rounded-t-2xl"></div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-400 rounded-xl flex items-center justify-center shadow-lg">
                          <i className="fas fa-box text-white text-lg"></i>
                        </div>
                        <div>
                          <p className="font-semibold text-blue-300">PrepMyBusiness</p>
                          <p className="text-xs text-blue-400/70">Last Sync: 12 min ago</p>
                        </div>
                      </div>
                      <div className="w-4 h-4 bg-blue-400 rounded-full animate-glow shadow-lg"></div>
                    </div>
                  </div>

                  <div className="relative p-6 bg-gradient-to-br from-purple-500/10 to-pink-400/10 border border-purple-500/20 rounded-2xl backdrop-blur-sm hover:scale-105 transition-all duration-300">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-pink-400 rounded-t-2xl"></div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-400 rounded-xl flex items-center justify-center shadow-lg">
                          <i className="fab fa-google text-white text-lg"></i>
                        </div>
                        <div>
                          <p className="font-semibold text-purple-300">Google Sheets</p>
                          <p className="text-xs text-purple-400/70">Live Sync active</p>
                        </div>
                      </div>
                      <div className="w-4 h-4 bg-purple-400 rounded-full animate-pulse shadow-lg"></div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}
