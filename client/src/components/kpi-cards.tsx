import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";

export default function KpiCards() {
  const { data: kpis, isLoading } = useQuery({
    queryKey: ['/api/dashboard/kpis'],
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="animate-pulse">
                <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                <div className="h-8 bg-muted rounded w-1/2 mb-4"></div>
                <div className="h-3 bg-muted rounded w-1/3"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const kpiData = [
    {
      title: "Active Deals",
      value: kpis?.activeDeals || 0,
      icon: "fas fa-handshake",
      gradient: "from-blue-500 to-cyan-400",
      bgColor: "bg-gradient-to-br from-blue-500/10 to-cyan-400/10",
      change: "+12%",
      changeLabel: "vs. last month",
      trend: "up",
    },
    {
      title: "Winner Products",
      value: kpis?.winnerProducts || 0,
      icon: "fas fa-trophy",
      gradient: "from-emerald-500 to-teal-400",
      bgColor: "bg-gradient-to-br from-emerald-500/10 to-teal-400/10",
      change: "+8%",
      changeLabel: "Success rate",
      trend: "up",
    },
    {
      title: "Monthly Profit",
      value: formatCurrency(kpis?.monthlyProfit || 0),
      icon: "fas fa-euro-sign",
      gradient: "from-yellow-500 to-orange-400",
      bgColor: "bg-gradient-to-br from-yellow-500/10 to-orange-400/10",
      change: "+23%",
      changeLabel: "vs. last month",
      trend: "up",
    },
    {
      title: "Available Budget",
      value: formatCurrency(kpis?.availableBudget || 0),
      icon: "fas fa-wallet",
      gradient: "from-purple-500 to-pink-400",
      bgColor: "bg-gradient-to-br from-purple-500/10 to-pink-400/10",
      change: "82%",
      changeLabel: "of total budget",
      trend: "neutral",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {kpiData.map((kpi, index) => (
        <Card key={index} className="card-hover glass border-0 relative overflow-hidden group">
          <div className={`absolute inset-0 ${kpi.bgColor} opacity-20 group-hover:opacity-30 transition-opacity duration-300`}></div>
          <CardContent className="p-6 relative">
            <div className="flex items-center justify-between mb-4">
              <div className="flex-1">
                <p className="text-sm font-medium text-muted-foreground mb-2">{kpi.title}</p>
                <p className="text-3xl font-bold gradient-text" data-testid={`kpi-${kpi.title.toLowerCase().replace(/\s+/g, '-')}`}>
                  {kpi.value}
                </p>
              </div>
              <div className={`p-4 rounded-2xl bg-gradient-to-br ${kpi.gradient} shadow-lg animate-float`} style={{ animationDelay: `${index * 0.5}s` }}>
                <i className={`${kpi.icon} text-white text-xl`}></i>
              </div>
            </div>
            <div className="flex items-center justify-between pt-4 border-t border-white/10">
              <div className="flex items-center space-x-2">
                <div className={`flex items-center space-x-1 px-2 py-1 rounded-full ${
                  kpi.trend === 'up' ? 'bg-emerald-500/20 text-emerald-400' : 
                  kpi.trend === 'down' ? 'bg-red-500/20 text-red-400' : 
                  'bg-gray-500/20 text-gray-400'
                }`}>
                  {kpi.trend === 'up' && <i className="fas fa-arrow-up text-xs"></i>}
                  {kpi.trend === 'down' && <i className="fas fa-arrow-down text-xs"></i>}
                  {kpi.trend === 'neutral' && <i className="fas fa-minus text-xs"></i>}
                  <span className="text-sm font-semibold">{kpi.change}</span>
                </div>
              </div>
              <span className="text-xs text-muted-foreground">{kpi.changeLabel}</span>
            </div>
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${kpi.gradient} opacity-60"></div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
