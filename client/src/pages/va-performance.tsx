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
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">VA Performance</h1>
        </div>
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
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-bold gradient-text">VA Performance</h1>
          <p className="text-muted-foreground mt-2">
            Weekly performance metrics and success tracking
          </p>
          <div className="flex items-center space-x-4 mt-4 text-sm text-muted-foreground">
            <div className="flex items-center space-x-1">
              <i className="fas fa-chart-line text-primary"></i>
              <span>{selectedWeeks} weeks tracking</span>
            </div>
            <div className="flex items-center space-x-1">
              <i className="fas fa-user text-primary"></i>
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

      {/* Overall Performance Summary */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Award className="h-5 w-5 text-purple-600" />
              <div>
                <p className="text-sm text-muted-foreground">Avg Profit</p>
                <p className="text-2xl font-bold text-purple-600">€{totalStats.avgProfit.toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-sm text-muted-foreground">Total Deals</p>
                <p className="text-2xl font-bold">{totalStats.totalDeals}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-sm text-muted-foreground">Winners</p>
                <p className="text-2xl font-bold text-green-600">{totalStats.totalWinners}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-orange-600" />
              <div>
                <p className="text-sm text-muted-foreground">Success Rate</p>
                <p className="text-2xl font-bold text-orange-600">{totalStats.successRate.toFixed(1)}%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <User className="h-5 w-5 text-indigo-600" />
              <div>
                <p className="text-sm text-muted-foreground">Total Profit</p>
                <p className="text-2xl font-bold text-indigo-600">€{totalStats.totalProfit.toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Performance Targets */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Performance Targets
          </CardTitle>
          <CardDescription>
            Current performance against weekly targets
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Average Profit per Deal</Label>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold">€{totalStats.avgProfit.toFixed(2)}</span>
                {getPerformanceBadge(totalStats.avgProfit, 15)}
              </div>
              <p className="text-xs text-muted-foreground">Target: €15+</p>
            </div>
            
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Weekly Deals</Label>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold">
                  {weeklyStats.length > 0 ? (weeklyStats[0]?.deals || 0) : 0}
                </span>
                {getPerformanceBadge(weeklyStats.length > 0 ? (weeklyStats[0]?.deals || 0) : 0, 10)}
              </div>
              <p className="text-xs text-muted-foreground">Target: 10+ deals/week</p>
            </div>
            
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Success Rate</Label>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold">{totalStats.successRate.toFixed(1)}%</span>
                {getPerformanceBadge(totalStats.successRate, 20, true)}
              </div>
              <p className="text-xs text-muted-foreground">Target: 20%+</p>
            </div>
            
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Weekly Profit</Label>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold">
                  €{weeklyStats.length > 0 ? (weeklyStats[0]?.profit || 0).toFixed(2) : '0.00'}
                </span>
                {getPerformanceBadge(weeklyStats.length > 0 ? (weeklyStats[0]?.profit || 0) : 0, 150)}
              </div>
              <p className="text-xs text-muted-foreground">Target: €150+/week</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Weekly Performance Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Weekly Performance Breakdown
          </CardTitle>
          <CardDescription>
            Last {selectedWeeks} weeks performance details
          </CardDescription>
        </CardHeader>
        <CardContent>
          {weeklyStats.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No performance data available for the selected period.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {weeklyStats.map((week: any, index: number) => {
                const previousWeek = weeklyStats[index + 1];
                const profitTrend = previousWeek ? getWeeklyTrend(week.profit, previousWeek.profit) : 0;
                const dealsTrend = previousWeek ? getWeeklyTrend(week.deals, previousWeek.deals) : 0;
                const successRateTrend = previousWeek ? getWeeklyTrend(week.successRate, previousWeek.successRate) : 0;

                return (
                  <Card key={week.week} className={index === 0 ? "border-2 border-blue-200" : ""} data-testid={`card-week-${week.week}`}>
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-center">
                        <CardTitle className="text-lg">{week.week}</CardTitle>
                        {index === 0 && (
                          <Badge variant="default" className="bg-blue-600 text-white">Current Week</Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        <div>
                          <Label className="text-muted-foreground">Deals</Label>
                          <div className="flex items-center gap-2">
                            <p className="text-xl font-bold">{week.deals}</p>
                            {previousWeek && (
                              <Badge variant={dealsTrend >= 0 ? "default" : "secondary"} className={dealsTrend >= 0 ? "bg-green-600 text-white text-xs" : "text-xs"}>
                                {dealsTrend >= 0 ? '+' : ''}{dealsTrend.toFixed(0)}%
                              </Badge>
                            )}
                          </div>
                        </div>
                        
                        <div>
                          <Label className="text-muted-foreground">Winners</Label>
                          <div className="flex items-center gap-2">
                            <p className="text-xl font-bold text-green-600">{week.winners}</p>
                            <Badge variant="secondary" className="text-xs">
                              {week.successRate.toFixed(1)}%
                            </Badge>
                          </div>
                        </div>
                        
                        <div>
                          <Label className="text-muted-foreground">Avg Profit</Label>
                          <p className="text-xl font-bold text-purple-600">€{week.avgProfit.toFixed(2)}</p>
                        </div>
                        
                        <div>
                          <Label className="text-muted-foreground">Total Profit</Label>
                          <div className="flex items-center gap-2">
                            <p className="text-xl font-bold text-indigo-600">€{week.profit.toFixed(2)}</p>
                            {previousWeek && (
                              <Badge variant={profitTrend >= 0 ? "default" : "secondary"} className={profitTrend >= 0 ? "bg-green-600 text-white text-xs" : "text-xs"}>
                                {profitTrend >= 0 ? '+' : ''}{profitTrend.toFixed(0)}%
                              </Badge>
                            )}
                          </div>
                        </div>
                        
                        <div>
                          <Label className="text-muted-foreground">Success Rate</Label>
                          <div className="flex items-center gap-2">
                            <p className="text-xl font-bold text-orange-600">{week.successRate.toFixed(1)}%</p>
                            {previousWeek && (
                              <Badge variant={successRateTrend >= 0 ? "default" : "secondary"} className={successRateTrend >= 0 ? "bg-green-600 text-white text-xs" : "text-xs"}>
                                {successRateTrend >= 0 ? '+' : ''}{successRateTrend.toFixed(0)}%
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Performance Insights */}
      <Card>
        <CardHeader>
          <CardTitle>Performance Insights</CardTitle>
          <CardDescription>
            Key insights based on your recent performance
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {totalStats.successRate >= 25 && (
              <div className="flex items-center gap-2 text-green-600">
                <TrendingUp className="h-4 w-4" />
                <span className="text-sm">Excellent success rate! You're exceeding the 20% target.</span>
              </div>
            )}
            
            {totalStats.avgProfit >= 20 && (
              <div className="flex items-center gap-2 text-green-600">
                <Award className="h-4 w-4" />
                <span className="text-sm">Outstanding profit margins! Keep focusing on high-value deals.</span>
              </div>
            )}
            
            {totalStats.successRate < 15 && totalStats.totalDeals > 10 && (
              <div className="flex items-center gap-2 text-orange-600">
                <Target className="h-4 w-4" />
                <span className="text-sm">Consider focusing on deal quality over quantity to improve success rate.</span>
              </div>
            )}
            
            {totalStats.avgProfit < 10 && totalStats.totalDeals > 5 && (
              <div className="flex items-center gap-2 text-orange-600">
                <TrendingDown className="h-4 w-4" />
                <span className="text-sm">Look for deals with higher profit margins to improve average profit.</span>
              </div>
            )}
            
            {weeklyStats.length >= 2 && weeklyStats[0] && weeklyStats[1] && weeklyStats[0].deals > weeklyStats[1].deals && (
              <div className="flex items-center gap-2 text-blue-600">
                <BarChart3 className="h-4 w-4" />
                <span className="text-sm">Great momentum! You're submitting more deals than last week.</span>
              </div>
            )}
            
            {totalStats.totalDeals === 0 && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span className="text-sm">Start submitting deals to see your performance metrics here.</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}