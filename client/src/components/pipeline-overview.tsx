import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function PipelineOverview() {
  const { data: pipeline, isLoading: pipelineLoading } = useQuery({
    queryKey: ['/api/dashboard/pipeline'],
  });

  const { data: deals, isLoading: dealsLoading } = useQuery({
    queryKey: ['/api/deals'],
  });

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      submitted: { label: "Submitted", variant: "secondary" as const },
      reviewing: { label: "Under Review", variant: "default" as const },
      approved: { label: "Approved", variant: "default" as const },
      winner: { label: "Winner", variant: "default" as const },
      rejected: { label: "Rejected", variant: "destructive" as const },
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.submitted;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const formatPrice = (price: string | number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR'
    }).format(Number(price));
  };

  if (pipelineLoading || dealsLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Deal Pipeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="text-center">
                  <div className="w-12 h-12 bg-muted rounded-lg mx-auto mb-2"></div>
                  <div className="h-4 bg-muted rounded w-3/4 mx-auto mb-1"></div>
                  <div className="h-6 bg-muted rounded w-1/2 mx-auto"></div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const pipelineData = [
    {
      title: "Submitted",
      count: pipeline?.submitted || 0,
      icon: "fas fa-inbox",
      bgColor: "bg-blue-100",
      iconColor: "text-blue-600",
    },
    {
      title: "Under Review",
      count: pipeline?.reviewing || 0,
      icon: "fas fa-clock",
      bgColor: "bg-yellow-100",
      iconColor: "text-yellow-600",
    },
    {
      title: "Winner",
      count: pipeline?.winner || 0,
      icon: "fas fa-trophy",
      bgColor: "bg-green-100",
      iconColor: "text-green-600",
    },
    {
      title: "Approved",
      count: pipeline?.approved || 0,
      icon: "fas fa-check",
      bgColor: "bg-emerald-100",
      iconColor: "text-emerald-600",
    },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Deal Pipeline</CardTitle>
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm">
              Filter
            </Button>
            <Button variant="outline" size="sm">
              Export
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Pipeline Stages */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          {pipelineData.map((stage, index) => (
            <div key={index} className="text-center">
              <div className={`flex items-center justify-center w-12 h-12 ${stage.bgColor} rounded-lg mx-auto mb-2`}>
                <i className={`${stage.icon} ${stage.iconColor}`}></i>
              </div>
              <h4 className="text-sm font-medium text-foreground">{stage.title}</h4>
              <p className="text-xl font-bold text-foreground" data-testid={`pipeline-${stage.title.toLowerCase().replace(/\s+/g, '-')}`}>
                {stage.count}
              </p>
            </div>
          ))}
        </div>

        {/* Recent Deals Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Product
                </th>
                <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  VA
                </th>
                <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Status
                </th>
                <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Profit %
                </th>
                <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Submitted
                </th>
                <th className="text-right py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {!deals || deals.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-muted-foreground">
                    No deals available
                  </td>
                </tr>
              ) : (
                deals.slice(0, 5).map((deal: any) => (
                  <tr key={deal.id} className="hover:bg-muted/50">
                    <td className="py-4 px-4">
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-muted rounded-lg mr-3 flex items-center justify-center">
                          <i className="fas fa-image text-muted-foreground text-xs"></i>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            {deal.product?.productName || 'Unknown Product'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            ASIN: {deal.product?.asin || 'N/A'}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <span className="text-sm text-foreground">
                        {deal.submitter?.firstName} {deal.submitter?.lastName}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      {getStatusBadge(deal.status)}
                    </td>
                    <td className="py-4 px-4">
                      <span className="text-sm font-medium text-green-600">
                        {Number(deal.profitMargin || 0).toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <span className="text-sm text-muted-foreground">
                        {new Date(deal.createdAt).toLocaleDateString('de-DE')}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-right">
                      <Button variant="ghost" size="sm" data-testid={`button-details-${deal.id}`}>
                        Details
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
