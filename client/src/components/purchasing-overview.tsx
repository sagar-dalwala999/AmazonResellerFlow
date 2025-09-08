import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, Package, TrendingUp, DollarSign } from "lucide-react";

interface PurchasingItem {
  [key: string]: string;
}

interface PurchasingData {
  headers: string[];
  items: PurchasingItem[];
  totalRows: number;
  lastUpdated: string;
}

export default function PurchasingOverview() {
  const { data: purchasingData, isLoading, error } = useQuery<PurchasingData>({
    queryKey: ["/api/purchasing/sheets"],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  if (isLoading) {
    return (
      <Card className="glass border-0 card-hover">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Purchasing Queue
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="glass border-0 card-hover">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Purchasing Queue
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Unable to load purchasing data. The Purchasing tab may not exist yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  const items = purchasingData?.items || [];
  
  // Calculate totals
  const totalProducts = items.length;
  const totalCostPrice = items.reduce((sum: number, item: PurchasingItem) => {
    const cost = parseFloat(item['Cost Price']?.replace(/[^\d.,]/g, '').replace(',', '.')) || 0;
    return sum + cost;
  }, 0);
  
  const totalProfit = items.reduce((sum: number, item: PurchasingItem) => {
    const profit = parseFloat(item['Profit']?.replace(/[^\d.,]/g, '').replace(',', '.')) || 0;
    return sum + profit;
  }, 0);

  return (
    <Card className="glass border-0 card-hover">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Purchasing Queue
          </div>
          <Badge variant="secondary">{totalProducts} Winner Products</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {totalProducts === 0 ? (
          <div className="text-center py-8">
            <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
            <p className="text-sm text-muted-foreground">
              No products in purchasing queue yet.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Mark products as "Winner" to see them here.
            </p>
          </div>
        ) : (
          <>
            {/* Summary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-gradient-to-br from-blue-500/10 to-blue-400/10 border border-blue-500/20 rounded-xl p-4">
                <div className="flex items-center space-x-3">
                  <Package className="h-8 w-8 text-blue-500" />
                  <div>
                    <p className="text-2xl font-bold text-blue-600">{totalProducts}</p>
                    <p className="text-xs text-blue-500/70">Products</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-gradient-to-br from-red-500/10 to-red-400/10 border border-red-500/20 rounded-xl p-4">
                <div className="flex items-center space-x-3">
                  <DollarSign className="h-8 w-8 text-red-500" />
                  <div>
                    <p className="text-2xl font-bold text-red-600">€{totalCostPrice.toFixed(2)}</p>
                    <p className="text-xs text-red-500/70">Total Cost</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-gradient-to-br from-green-500/10 to-green-400/10 border border-green-500/20 rounded-xl p-4">
                <div className="flex items-center space-x-3">
                  <TrendingUp className="h-8 w-8 text-green-500" />
                  <div>
                    <p className="text-2xl font-bold text-green-600">€{totalProfit.toFixed(2)}</p>
                    <p className="text-xs text-green-500/70">Est. Profit</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Product List */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-muted-foreground mb-3">
                Recent Winner Products
              </h4>
              
              {items.slice(0, 5).map((item: PurchasingItem, index: number) => (
                <div 
                  key={index} 
                  className="flex items-center justify-between p-3 bg-white/50 dark:bg-gray-800/50 rounded-lg border border-gray-200/50 dark:border-gray-700/50"
                >
                  <div className="flex items-center space-x-3 flex-1 min-w-0">
                    {item['Image URL'] && (
                      <img
                        src={item['Image URL']}
                        alt={item['Product Name'] || 'Product'}
                        className="w-10 h-10 rounded-lg object-cover bg-gray-100"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                        }}
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                        {item['Product Name'] || 'Unknown Product'}
                      </p>
                      <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                        <span>{item['Brand'] || 'Unknown Brand'}</span>
                        <span>•</span>
                        <span>Cost: {item['Cost Price'] || '-'}</span>
                        <span>•</span>
                        <span>Profit: {item['Profit'] || '-'}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Badge 
                      variant="outline" 
                      className="bg-green-50 text-green-700 border-green-200"
                    >
                      Winner
                    </Badge>
                    
                    {item['Amazon URL'] && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0"
                        onClick={() => window.open(item['Amazon URL'], '_blank')}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              
              {items.length > 5 && (
                <Button 
                  variant="outline" 
                  className="w-full mt-4"
                  onClick={() => window.location.href = '/purchasing'}
                >
                  View All {items.length} Products
                </Button>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}