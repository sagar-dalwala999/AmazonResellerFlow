import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { apiRequest } from "@/lib/queryClient";
import { TrendingUp, TrendingDown, Target, Award, BarChart3, Calendar, User } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import Sidebar from "@/components/sidebar";

export default function VAPerformance() {
  const { user } = useAuth();
  const [selectedWeeks, setSelectedWeeks] = useState<string>("4");
  const [selectedUserId, setSelectedUserId] = useState<string>("");

  const userRole = (user as any)?.role || 'va';
  const isAdmin = userRole === 'admin';
  const currentUserId = (user as any)?.id || '';

  // Set default user ID
  const targetUserId = isAdmin && selectedUserId ? selectedUserId : currentUserId;

  // Fetch VA performance data
  const { data: performanceData, isLoading } = useQuery({
    queryKey: ['/api/va/performance', targetUserId, selectedWeeks],
    queryFn: () => apiRequest(`/api/va/performance/${targetUserId}?weeks=${selectedWeeks}`),
    enabled: !!targetUserId,
  });

  // Fetch all users for admin dropdown
  const { data: allUsers = [] } = useQuery({
    queryKey: ['/api/users'],
    queryFn: () => apiRequest('/api/users'),
    enabled: isAdmin,
  });

  if (isLoading) {
    return (
      <div className="flex h-screen overflow-hidden bg-gradient-to-br from-slate-50 via-white to-blue-50/30">
        <Sidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <header className="glass border-b border-black/10 backdrop-blur-xl">
            <div className="flex items-center justify-between h-20 px-6">
              <div className="flex items-center space-x-4">
                <div>
                  <h1 className="text-2xl font-bold gradient-text">VA Performance</h1>
                  <p className="text-xs text-muted-foreground mt-1">Loading...</p>
                </div>
              </div>
            </div>
          </header>
          <main className="flex-1 overflow-auto">
            <div className="p-8 space-y-6">
              <div className="grid gap-4">
                {[...Array(4)].map((_, i) => (
                  <Card key={i} className="animate-pulse">
                    <CardContent className="pt-6">
                      <div className="h-4 bg-muted rounded w-3/4 mb-4"></div>
                      <div className="h-3 bg-muted rounded w-1/2"></div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  const weeklyStats = performanceData?.weeklyStats || [];
  const totalStats = performanceData?.totalStats || {
    avgProfit: 0,
    totalDeals: 0,
    totalWinners: 0,
    successRate: 0,
    totalProfit: 0,
  };

  const getPerformanceBadge = (value: number, threshold: number, isPercentage: boolean = false) => {
    const isGood = value >= threshold;
    const displayValue = isPercentage ? `${value.toFixed(1)}%` : value.toFixed(2);
    
    return (
      <Badge variant={isGood ? "default" : "secondary"} className={isGood ? "bg-green-600 text-white" : ""}>
        {isGood ? (
          <TrendingUp className="h-3 w-3 mr-1" />
        ) : (
          <TrendingDown className="h-3 w-3 mr-1" />
        )}
        {displayValue}
      </Badge>
    );
  };

  const getWeeklyTrend = (currentValue: number, previousValue: number) => {
    if (previousValue === 0) return 0;
    return ((currentValue - previousValue) / previousValue) * 100;
  };

  return (
    <div className="flex h-screen overflow-hidden bg-gradient-to-br from-slate-50 via-white to-blue-50/30">
      <Sidebar />
      
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Header */}
        <header className="glass border-b border-black/10 backdrop-blur-xl">
          <div className="flex items-center justify-between h-20 px-6">
            <div className="flex items-center space-x-4">
              <button className="lg:hidden p-3 rounded-xl text-muted-foreground hover:bg-black/5 transition-all duration-200">
                <i className="fas fa-bars"></i>
              </button>
              <div>
                <h1 className="text-2xl font-bold gradient-text">VA Performance</h1>
                <p className="text-xs text-muted-foreground mt-1">Performance metrics and tracking</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3 px-4 py-2 bg-purple-500/20 border border-purple-500/30 rounded-xl backdrop-blur-sm">
                <div className="w-3 h-3 bg-purple-400 rounded-full animate-glow"></div>
                <span className="text-sm font-medium text-purple-600">{selectedWeeks} weeks tracking</span>
              </div>
              <button 
                className="p-3 text-muted-foreground hover:bg-black/5 rounded-xl transition-all duration-200"
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
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-lg text-muted-foreground mb-2">Performance Overview</h2>
                  <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                    <div className="flex items-center space-x-1">
                      <User className="h-4 w-4 text-primary" />
                      <span>{isAdmin ? 'Admin view' : 'Personal metrics'}</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  {isAdmin && (
                    <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                      <SelectTrigger className="w-48" data-testid="select-user">
                        <SelectValue placeholder="Select VA" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">All VAs</SelectItem>
                        {allUsers.map((user: any) => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.firstName} {user.lastName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <Select value={selectedWeeks} onValueChange={setSelectedWeeks}>
                    <SelectTrigger className="w-32" data-testid="select-weeks">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="4">4 Weeks</SelectItem>
                      <SelectItem value="8">8 Weeks</SelectItem>
                      <SelectItem value="12">12 Weeks</SelectItem>
                      <SelectItem value="26">26 Weeks</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Performance Summary Cards */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card className="card-hover">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Deals</CardTitle>
                    <BarChart3 className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{totalStats.totalDeals}</div>
                    <div className="flex items-center space-x-2 text-xs text-muted-foreground mt-1">
                      <Target className="h-3 w-3" />
                      <span>Submitted products</span>
                    </div>
                  </CardContent>
                </Card>

                <Card className="card-hover">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Winner Products</CardTitle>
                    <Award className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">{totalStats.totalWinners}</div>
                    <div className="flex items-center space-x-2 text-xs text-muted-foreground mt-1">
                      <TrendingUp className="h-3 w-3" />
                      <span>Approved deals</span>
                    </div>
                  </CardContent>
                </Card>

                <Card className="card-hover">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {getPerformanceBadge(totalStats.successRate, 20, true)}
                    </div>
                    <div className="flex items-center space-x-2 text-xs text-muted-foreground mt-1">
                      <Target className="h-3 w-3" />
                      <span>Target: 20%+</span>
                    </div>
                  </CardContent>
                </Card>

                <Card className="card-hover">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Average Profit</CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {getPerformanceBadge(totalStats.avgProfit, 5, false)}
                    </div>
                    <div className="flex items-center space-x-2 text-xs text-muted-foreground mt-1">
                      <Target className="h-3 w-3" />
                      <span>Target: €5.00+</span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Weekly Performance Breakdown */}
              <Card className="card-hover">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Weekly Performance Breakdown
                  </CardTitle>
                  <CardDescription>
                    Detailed week-by-week performance metrics for the last {selectedWeeks} weeks
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {weeklyStats.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <BarChart3 className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>No performance data available for the selected period</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {weeklyStats.map((weekStat: any, index: number) => {
                        const prevWeekStat = index > 0 ? weeklyStats[index - 1] : null;
                        const profitTrend = prevWeekStat ? getWeeklyTrend(weekStat.avgProfit, prevWeekStat.avgProfit) : 0;
                        const dealsTrend = prevWeekStat ? getWeeklyTrend(weekStat.totalDeals, prevWeekStat.totalDeals) : 0;

                        return (
                          <div key={weekStat.weekStart} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                            <div className="flex justify-between items-center mb-3">
                              <div>
                                <h4 className="font-medium">
                                  Week of {new Date(weekStat.weekStart).toLocaleDateString()}
                                </h4>
                                <p className="text-sm text-muted-foreground">
                                  {weekStat.totalDeals} deals submitted • {weekStat.totalWinners} winners
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-lg font-semibold">
                                  {weekStat.successRate.toFixed(1)}% success rate
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  €{weekStat.avgProfit.toFixed(2)} avg profit
                                </p>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                              <div>
                                <Label className="text-muted-foreground">Deals Submitted</Label>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{weekStat.totalDeals}</span>
                                  {prevWeekStat && (
                                    <Badge variant={dealsTrend >= 0 ? "default" : "secondary"} className="text-xs">
                                      {dealsTrend >= 0 ? "+" : ""}{dealsTrend.toFixed(0)}%
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              <div>
                                <Label className="text-muted-foreground">Winners</Label>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-green-600">{weekStat.totalWinners}</span>
                                </div>
                              </div>
                              <div>
                                <Label className="text-muted-foreground">Success Rate</Label>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{weekStat.successRate.toFixed(1)}%</span>
                                  {weekStat.successRate >= 20 ? (
                                    <TrendingUp className="h-3 w-3 text-green-600" />
                                  ) : (
                                    <TrendingDown className="h-3 w-3 text-yellow-600" />
                                  )}
                                </div>
                              </div>
                              <div>
                                <Label className="text-muted-foreground">Avg Profit</Label>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">€{weekStat.avgProfit.toFixed(2)}</span>
                                  {prevWeekStat && (
                                    <Badge variant={profitTrend >= 0 ? "default" : "secondary"} className="text-xs">
                                      {profitTrend >= 0 ? "+" : ""}{profitTrend.toFixed(0)}%
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Performance Goals */}
              <Card className="card-hover">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5" />
                    Performance Goals & Targets
                  </CardTitle>
                  <CardDescription>
                    Key performance indicators and targets for VA performance
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-3">
                      <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                        <div>
                          <h4 className="font-medium">Success Rate Target</h4>
                          <p className="text-sm text-muted-foreground">Minimum 20% of deals approved</p>
                        </div>
                        <div className="text-right">
                          <Badge variant={totalStats.successRate >= 20 ? "default" : "secondary"}>
                            {totalStats.successRate >= 20 ? "✓ Met" : "⚠ Below Target"}
                          </Badge>
                        </div>
                      </div>
                      
                      <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                        <div>
                          <h4 className="font-medium">Quality Target</h4>
                          <p className="text-sm text-muted-foreground">Average profit per deal €5+</p>
                        </div>
                        <div className="text-right">
                          <Badge variant={totalStats.avgProfit >= 5 ? "default" : "secondary"}>
                            {totalStats.avgProfit >= 5 ? "✓ Met" : "⚠ Below Target"}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                        <div>
                          <h4 className="font-medium">Activity Target</h4>
                          <p className="text-sm text-muted-foreground">Minimum 5 deals per week</p>
                        </div>
                        <div className="text-right">
                          <Badge variant="secondary">
                            Tracking
                          </Badge>
                        </div>
                      </div>
                      
                      <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                        <div>
                          <h4 className="font-medium">Consistency Target</h4>
                          <p className="text-sm text-muted-foreground">Regular weekly submissions</p>
                        </div>
                        <div className="text-right">
                          <Badge variant="secondary">
                            Tracking
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}