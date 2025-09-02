import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function RecentActivity() {
  const { data: activities, isLoading } = useQuery({
    queryKey: ['/api/activities'],
  });

  const getActivityIcon = (action: string) => {
    const iconMap: Record<string, { icon: string; bgColor: string; iconColor: string }> = {
      'deal_submitted': { icon: 'fas fa-check', bgColor: 'bg-green-100', iconColor: 'text-green-600' },
      'deal_status_updated': { icon: 'fas fa-star', bgColor: 'bg-blue-100', iconColor: 'text-blue-600' },
      'sku_generated': { icon: 'fas fa-barcode', bgColor: 'bg-orange-100', iconColor: 'text-orange-600' },
      'purchase_created': { icon: 'fas fa-shopping-cart', bgColor: 'bg-purple-100', iconColor: 'text-purple-600' },
    };
    
    return iconMap[action] || { icon: 'fas fa-info', bgColor: 'bg-gray-100', iconColor: 'text-gray-600' };
  };

  const formatTimeAgo = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'gerade eben';
    if (diffInMinutes < 60) return `vor ${diffInMinutes} Minuten`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `vor ${diffInHours} Stunden`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    return `vor ${diffInDays} Tagen`;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Letzte Aktivitäten</CardTitle>
            <Button variant="ghost" size="sm">Alle anzeigen</Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-start space-x-4 animate-pulse">
                <div className="w-8 h-8 bg-muted rounded-full"></div>
                <div className="flex-1">
                  <div className="h-4 bg-muted rounded w-3/4 mb-1"></div>
                  <div className="h-3 bg-muted rounded w-1/4"></div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Letzte Aktivitäten</CardTitle>
          <Button variant="ghost" size="sm">Alle anzeigen</Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {!activities || activities.length === 0 ? (
            <div className="text-center py-8">
              <i className="fas fa-history text-2xl text-muted-foreground mb-2"></i>
              <p className="text-muted-foreground">Keine aktuellen Aktivitäten</p>
            </div>
          ) : (
            activities.slice(0, 5).map((activity: any) => {
              const { icon, bgColor, iconColor } = getActivityIcon(activity.action);
              
              return (
                <div key={activity.id} className="flex items-start space-x-4">
                  <div className={`flex-shrink-0 w-8 h-8 ${bgColor} rounded-full flex items-center justify-center`}>
                    <i className={`${icon} ${iconColor} text-xs`}></i>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground" data-testid={`activity-${activity.id}`}>
                      {activity.description}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatTimeAgo(activity.createdAt)}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}
