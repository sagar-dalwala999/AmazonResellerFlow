import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import Sidebar from "@/components/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function DealEvaluation() {
  const { toast } = useToast();
  const { user, isAuthenticated, isLoading } = useAuth();
  const queryClient = useQueryClient();

  // Redirect if not admin
  useEffect(() => {
    if (!isLoading && isAuthenticated && user?.role !== 'admin') {
      toast({
        title: "Zugriff verweigert",
        description: "Sie haben keine Berechtigung für diese Seite.",
        variant: "destructive",
      });
      window.location.href = '/';
    }
  }, [user, isAuthenticated, isLoading, toast]);

  const { data: deals, isLoading: dealsLoading } = useQuery({
    queryKey: ['/api/deals'],
    enabled: !!user && user.role === 'admin',
  });

  const updateDealStatus = useMutation({
    mutationFn: async ({ dealId, status, reviewNotes }: { dealId: string; status: string; reviewNotes?: string }) => {
      await apiRequest("PATCH", `/api/deals/${dealId}/status`, { status, reviewNotes });
    },
    onSuccess: () => {
      toast({
        title: "Status aktualisiert",
        description: "Der Deal-Status wurde erfolgreich aktualisiert.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/deals'] });
      queryClient.invalidateQueries({ queryKey: ['/api/activities'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/pipeline'] });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "Sie sind nicht angemeldet. Weiterleitung zur Anmeldung...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Fehler",
        description: "Status konnte nicht aktualisiert werden.",
        variant: "destructive",
      });
    },
  });

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      submitted: { label: "Eingereicht", variant: "secondary" as const },
      reviewing: { label: "In Bewertung", variant: "default" as const },
      approved: { label: "Genehmigt", variant: "default" as const },
      winner: { label: "Winner", variant: "default" as const },
      rejected: { label: "Abgelehnt", variant: "destructive" as const },
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

  if (isLoading || dealsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user || user.role !== 'admin') {
    return null;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Header */}
        <header className="bg-card border-b border-border">
          <div className="flex items-center justify-between h-16 px-6">
            <h1 className="text-xl font-semibold text-foreground">Deal Bewertung</h1>
            <Button 
              variant="outline"
              onClick={() => window.location.href = '/'}
              data-testid="button-back-dashboard"
            >
              <i className="fas fa-arrow-left mr-2"></i>
              Zurück zum Dashboard
            </Button>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-auto bg-background p-6">
          <div className="space-y-6">
            {!deals || deals.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <i className="fas fa-inbox text-4xl text-muted-foreground mb-4"></i>
                  <h3 className="text-lg font-semibold text-foreground mb-2">Keine Deals zu bewerten</h3>
                  <p className="text-muted-foreground">
                    Es sind derzeit keine Deals zur Bewertung vorhanden.
                  </p>
                </CardContent>
              </Card>
            ) : (
              deals.map((deal: any) => (
                <Card key={deal.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
                          <i className="fas fa-image text-muted-foreground text-xs"></i>
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold">{deal.product?.productName || 'Unbekanntes Produkt'}</h3>
                          <p className="text-sm text-muted-foreground">ASIN: {deal.product?.asin}</p>
                        </div>
                      </CardTitle>
                      {getStatusBadge(deal.status)}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
                      <div>
                        <p className="text-sm text-muted-foreground">Eingereicht von</p>
                        <p className="font-medium">{deal.submitter?.firstName} {deal.submitter?.lastName}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Einkaufspreis</p>
                        <p className="font-medium">{formatPrice(deal.buyPrice)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Verkaufspreis</p>
                        <p className="font-medium">{formatPrice(deal.sellPrice)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Profit Margin</p>
                        <p className="font-medium text-green-600">{Number(deal.profitMargin).toFixed(1)}%</p>
                      </div>
                    </div>

                    {deal.notes && (
                      <div className="mb-6">
                        <p className="text-sm text-muted-foreground mb-2">Notizen</p>
                        <p className="text-sm bg-muted p-3 rounded-md">{deal.notes}</p>
                      </div>
                    )}

                    {deal.status === 'submitted' || deal.status === 'reviewing' ? (
                      <div className="flex items-center space-x-3">
                        <Button
                          size="sm"
                          onClick={() => updateDealStatus.mutate({ 
                            dealId: deal.id, 
                            status: 'reviewing' 
                          })}
                          disabled={updateDealStatus.isPending}
                          data-testid={`button-review-${deal.id}`}
                        >
                          <i className="fas fa-eye mr-2"></i>
                          In Bewertung
                        </Button>
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => updateDealStatus.mutate({ 
                            dealId: deal.id, 
                            status: 'approved',
                            reviewNotes: 'Deal genehmigt für weitere Prüfung'
                          })}
                          disabled={updateDealStatus.isPending}
                          data-testid={`button-approve-${deal.id}`}
                        >
                          <i className="fas fa-check mr-2"></i>
                          Genehmigen
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => updateDealStatus.mutate({ 
                            dealId: deal.id, 
                            status: 'winner',
                            reviewNotes: 'Ausgezeichnet als Winner - bereit für Einkaufsplanung'
                          })}
                          disabled={updateDealStatus.isPending}
                          className="bg-green-600 hover:bg-green-700"
                          data-testid={`button-winner-${deal.id}`}
                        >
                          <i className="fas fa-trophy mr-2"></i>
                          Als Winner markieren
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => updateDealStatus.mutate({ 
                            dealId: deal.id, 
                            status: 'rejected',
                            reviewNotes: 'Deal entspricht nicht den Kriterien'
                          })}
                          disabled={updateDealStatus.isPending}
                          data-testid={`button-reject-${deal.id}`}
                        >
                          <i className="fas fa-times mr-2"></i>
                          Ablehnen
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                        <i className="fas fa-info-circle"></i>
                        <span>
                          Deal wurde am {new Date(deal.reviewedAt).toLocaleDateString('de-DE')} bewertet
                        </span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
