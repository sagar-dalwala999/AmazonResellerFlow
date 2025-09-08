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
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Header */}
        <header className="bg-card border-b border-border">
          <div className="flex items-center justify-between h-16 px-6">
            <div className="flex items-center space-x-4">
              <button className="lg:hidden p-2 rounded-md text-muted-foreground hover:bg-accent">
                <i className="fas fa-bars"></i>
              </button>
              <h1 className="text-xl font-semibold text-foreground">Dashboard</h1>
            </div>
            
            <div className="flex items-center space-x-4">
              {/* Google Sheets Sync Status */}
              <div className="flex items-center space-x-2 px-3 py-1 bg-green-50 border border-green-200 rounded-md">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-xs font-medium text-green-700">Google Sheets Sync active</span>
              </div>
              
              <button className="p-2 text-muted-foreground hover:bg-accent rounded-md">
                <i className="fas fa-bell"></i>
              </button>
              <button 
                className="p-2 text-muted-foreground hover:bg-accent rounded-md"
                onClick={() => window.location.href = '/api/logout'}
                data-testid="button-logout"
              >
                <i className="fas fa-sign-out-alt"></i>
              </button>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-auto bg-background">
          <div className="p-6 space-y-6">
            {/* KPI Cards */}
            <KpiCards />

            {/* Quick Actions & Recent Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Quick Actions */}
              <Card>
                <CardContent className="p-6">
                  <h3 className="text-lg font-semibold text-foreground mb-4">Quick Actions</h3>
                  <div className="space-y-3">
                    <Button 
                      className="w-full justify-between" 
                      onClick={() => window.location.href = '/deals/submit'}
                      data-testid="button-new-deal"
                    >
                      <span className="flex items-center">
                        <i className="fas fa-plus mr-3"></i>
                        Submit New Deal
                      </span>
                      <i className="fas fa-arrow-right"></i>
                    </Button>
                    
                    <Button 
                      variant="secondary" 
                      className="w-full justify-between"
                      onClick={() => googleSheetsImport.mutate()}
                      disabled={googleSheetsImport.isPending}
                      data-testid="button-google-sheets-import"
                    >
                      <span className="flex items-center">
                        <i className="fas fa-sync mr-3"></i>
                        {googleSheetsImport.isPending ? 'Importing...' : 'Google Sheets Import'}
                      </span>
                      <i className="fas fa-arrow-right"></i>
                    </Button>
                    
                    {user?.role === 'admin' && (
                      <Button 
                        variant="secondary" 
                        className="w-full justify-between"
                        onClick={() => window.location.href = '/deals/evaluate'}
                        data-testid="button-deal-evaluation"
                      >
                        <span className="flex items-center">
                          <i className="fas fa-check-circle mr-3"></i>
                          Deal Evaluation
                        </span>
                        <i className="fas fa-arrow-right"></i>
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
            <Card>
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-foreground mb-4">API Integrations</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                        <i className="fab fa-amazon text-green-600"></i>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-green-900">Amazon MWS</p>
                        <p className="text-xs text-green-700">Last Sync: 5 min ago</p>
                      </div>
                    </div>
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                        <i className="fas fa-box text-blue-600"></i>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-blue-900">PrepMyBusiness</p>
                        <p className="text-xs text-blue-700">Last Sync: 12 min ago</p>
                      </div>
                    </div>
                    <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-gray-50 border border-gray-200 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                        <i className="fab fa-google text-gray-600"></i>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">Google Sheets</p>
                        <p className="text-xs text-gray-700">Live Sync active</p>
                      </div>
                    </div>
                    <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
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
