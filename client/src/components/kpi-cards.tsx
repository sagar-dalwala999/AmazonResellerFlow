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
      iconBg: "bg-blue-50",
      iconColor: "text-blue-600",
      change: "+12%",
      changeLabel: "vs. last month",
    },
    {
      title: "Winner Products",
      value: kpis?.winnerProducts || 0,
      icon: "fas fa-trophy",
      iconBg: "bg-green-50",
      iconColor: "text-green-600",
      change: "+8%",
      changeLabel: "Success rate",
    },
    {
      title: "Monthly Profit",
      value: formatCurrency(kpis?.monthlyProfit || 0),
      icon: "fas fa-euro-sign",
      iconBg: "bg-emerald-50",
      iconColor: "text-emerald-600",
      change: "+23%",
      changeLabel: "vs. last month",
    },
    {
      title: "Available Budget",
      value: formatCurrency(kpis?.availableBudget || 0),
      icon: "fas fa-wallet",
      iconBg: "bg-purple-50",
      iconColor: "text-purple-600",
      change: "82%",
      changeLabel: "of total budget",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {kpiData.map((kpi, index) => (
        <Card key={index}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">{kpi.title}</p>
                <p className="text-2xl font-bold text-foreground" data-testid={`kpi-${kpi.title.toLowerCase().replace(/\s+/g, '-')}`}>
                  {kpi.value}
                </p>
              </div>
              <div className={`p-3 ${kpi.iconBg} rounded-lg`}>
                <i className={`${kpi.icon} ${kpi.iconColor}`}></i>
              </div>
            </div>
            <div className="mt-4 flex items-center">
              <span className="text-sm text-green-600 font-medium">{kpi.change}</span>
              <span className="text-sm text-muted-foreground ml-2">{kpi.changeLabel}</span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
