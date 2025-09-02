import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Package, Plus, Upload, RefreshCw, CheckCircle, AlertCircle, Clock, Download } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export default function ListingBuilder() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedSourcing, setSelectedSourcing] = useState<string>("");
  const [selectedPurchasing, setSelectedPurchasing] = useState<string>("");
  const [generatedSKU, setGeneratedSKU] = useState<string>("");

  const userRole = (user as any)?.role || 'va';
  const isAdmin = userRole === 'admin';

  // Fetch winner sourcing items
  const { data: winnerSourcing = [] } = useQuery({
    queryKey: ['/api/sourcing', 'winner'],
    queryFn: () => apiRequest('/api/sourcing?status=winner'),
    enabled: isAdmin,
  });

  // Fetch purchasing plans for sourcing
  const { data: purchasingPlans = [] } = useQuery({
    queryKey: ['/api/purchasing'],
    queryFn: () => apiRequest('/api/purchasing'),
    enabled: isAdmin && selectedSourcing !== "",
  });

  // Fetch existing listings
  const { data: listings = [], isLoading } = useQuery({
    queryKey: ['/api/listings'],
    queryFn: () => apiRequest('/api/listings'),
  });

  // Create listing mutation
  const createListingMutation = useMutation({
    mutationFn: (data: any) => apiRequest('/api/listings', 'POST', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/listings'] });
      setIsCreateDialogOpen(false);
      toast({
        title: "Success",
        description: "Listing created successfully with auto-generated SKU",
      });
      resetForm();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Sync listings mutations
  const syncAmazonMutation = useMutation({
    mutationFn: () => apiRequest('/api/integrations/amazon/sync', 'POST'),
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/listings'] });
      toast({
        title: "Amazon Sync Complete",
        description: `Synced ${result.syncedListings} listings to Amazon`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Sync Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const syncPrepMyBusinessMutation = useMutation({
    mutationFn: () => apiRequest('/api/integrations/prepmybusiness/sync', 'POST'),
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/listings'] });
      toast({
        title: "PrepMyBusiness Sync Complete",
        description: `Synced ${result.syncedJobs} jobs to PrepMyBusiness`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Sync Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update listing sync status
  const updateSyncStatusMutation = useMutation({
    mutationFn: ({ id, amazonStatus, prepMyBusinessStatus }: { id: string; amazonStatus?: string; prepMyBusinessStatus?: string }) =>
      apiRequest(`/api/listings/${id}/sync`, 'PATCH', { amazonStatus, prepMyBusinessStatus }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/listings'] });
      toast({
        title: "Success",
        description: "Sync status updated",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setSelectedSourcing("");
    setSelectedPurchasing("");
    setGeneratedSKU("");
  };

  const generatePreviewSKU = () => {
    const sourcingItem = winnerSourcing.find((item: any) => item.id === selectedSourcing);
    if (!sourcingItem) return;

    const brand = (sourcingItem.brand || 'UNKNOWN').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    const buyPrice = parseFloat(sourcingItem.costPrice);
    const asin = sourcingItem.asin;
    
    const date = new Date();
    const dateStr = date.toISOString().slice(2, 10).replace(/-/g, '').slice(0, 6);
    
    // Calculate max brand length to stay under 40 chars
    const baseLength = buyPrice.toFixed(2).length + 1 + dateStr.length + 1 + asin.length + 2;
    const maxBrandLength = 40 - baseLength;
    
    const truncatedBrand = brand.length > maxBrandLength ? brand.substring(0, maxBrandLength) : brand;
    
    const sku = `${truncatedBrand}_${buyPrice.toFixed(2)}_${dateStr}_${asin}`;
    setGeneratedSKU(sku);
  };

  const onCreateListing = () => {
    if (!selectedSourcing) {
      toast({
        title: "Error",
        description: "Please select a sourcing item",
        variant: "destructive",
      });
      return;
    }

    createListingMutation.mutate({
      sourcingId: selectedSourcing,
      purchasingId: selectedPurchasing || null,
    });
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      draft: { label: "Draft", variant: "secondary" as const, icon: Clock },
      pending: { label: "Pending", variant: "default" as const, icon: RefreshCw },
      live: { label: "Live", variant: "default" as const, icon: CheckCircle, className: "bg-green-600 text-white" },
      error: { label: "Error", variant: "destructive" as const, icon: AlertCircle },
    };
    
    const config = statusConfig[status as keyof typeof statusConfig];
    if (!config) return null;

    const Icon = config.icon;
    return (
      <Badge variant={config.variant} className={config.className || ""}>
        <Icon className="h-3 w-3 mr-1" />
        {config.label}
      </Badge>
    );
  };

  const exportToCSV = (listings: any[]) => {
    const headers = ['SKU', 'Brand', 'ASIN', 'Buy Price', 'Amazon Status', 'PrepMyBusiness Status', 'Created Date'];
    const csvContent = [
      headers.join(','),
      ...listings.map(listing => [
        listing.skuCode,
        listing.brand,
        listing.asin,
        listing.buyPrice,
        listing.amazonSyncStatus,
        listing.prepMyBusinessSyncStatus,
        new Date(listing.createdAt).toLocaleDateString()
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = `listings_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);

    toast({
      title: "Export Complete",
      description: `Exported ${listings.length} listings to CSV`,
    });
  };

  if (!isAdmin) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground">
              Access restricted to administrators only.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Listing Builder</h1>
        </div>
        <div className="grid gap-4">
          {[...Array(3)].map((_, i) => (
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

  const filteredPurchasingPlans = purchasingPlans.filter((plan: any) => plan.sourcingId === selectedSourcing);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Listing Builder</h1>
          <p className="text-muted-foreground">
            Generate SKUs and manage Amazon/PrepMyBusiness listings
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => exportToCSV(listings)}
            disabled={listings.length === 0}
            data-testid="button-export-csv"
          >
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Button
            variant="outline"
            onClick={() => syncAmazonMutation.mutate()}
            disabled={syncAmazonMutation.isPending}
            data-testid="button-sync-amazon"
          >
            {syncAmazonMutation.isPending ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Upload className="h-4 w-4 mr-2" />
            )}
            Sync Amazon
          </Button>
          <Button
            variant="outline"
            onClick={() => syncPrepMyBusinessMutation.mutate()}
            disabled={syncPrepMyBusinessMutation.isPending}
            data-testid="button-sync-prep"
          >
            {syncPrepMyBusinessMutation.isPending ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Upload className="h-4 w-4 mr-2" />
            )}
            Sync PrepMyBusiness
          </Button>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-create-listing">
                <Plus className="h-4 w-4 mr-2" />
                Create Listing
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create New Listing</DialogTitle>
                <DialogDescription>
                  Generate a new listing with auto-generated SKU from winner deals
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Select Winner Deal *</Label>
                  <Select value={selectedSourcing} onValueChange={(value) => {
                    setSelectedSourcing(value);
                    setGeneratedSKU("");
                  }}>
                    <SelectTrigger data-testid="select-sourcing-deal">
                      <SelectValue placeholder="Choose a winner deal" />
                    </SelectTrigger>
                    <SelectContent>
                      {winnerSourcing.map((item: any) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.productName} - {item.brand} - ASIN: {item.asin}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedSourcing && (
                  <div>
                    <Label>Associated Purchasing Plan (Optional)</Label>
                    <Select value={selectedPurchasing} onValueChange={setSelectedPurchasing}>
                      <SelectTrigger data-testid="select-purchasing-plan">
                        <SelectValue placeholder="Choose purchasing plan (optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">No purchasing plan</SelectItem>
                        {filteredPurchasingPlans.map((plan: any) => (
                          <SelectItem key={plan.id} value={plan.id}>
                            Qty: {plan.plannedQuantity} - Budget: €{parseFloat(plan.plannedBudget).toFixed(2)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {selectedSourcing && (
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <Label>Generated SKU Preview</Label>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={generatePreviewSKU}
                        data-testid="button-preview-sku"
                      >
                        Preview SKU
                      </Button>
                    </div>
                    {generatedSKU && (
                      <div className="p-3 bg-muted rounded-md">
                        <code className="text-sm font-mono">{generatedSKU}</code>
                        <p className="text-xs text-muted-foreground mt-1">
                          Format: BRAND_BuyPrice_Date_ASIN (max 40 characters)
                        </p>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setIsCreateDialogOpen(false)}
                    data-testid="button-cancel"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={onCreateListing}
                    disabled={createListingMutation.isPending || !selectedSourcing}
                    data-testid="button-submit-listing"
                  >
                    {createListingMutation.isPending ? "Creating..." : "Create Listing"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-sm text-muted-foreground">Total Listings</p>
                <p className="text-2xl font-bold">{listings.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-sm text-muted-foreground">Live Listings</p>
                <p className="text-2xl font-bold text-green-600">
                  {listings.filter((l: any) => l.amazonSyncStatus === 'live').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-orange-600" />
              <div>
                <p className="text-sm text-muted-foreground">Pending Sync</p>
                <p className="text-2xl font-bold text-orange-600">
                  {listings.filter((l: any) => l.amazonSyncStatus === 'pending').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-600" />
              <div>
                <p className="text-sm text-muted-foreground">Sync Errors</p>
                <p className="text-2xl font-bold text-red-600">
                  {listings.filter((l: any) => l.amazonSyncStatus === 'error' || l.prepMyBusinessSyncStatus === 'error').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Listings */}
      <div className="grid gap-4">
        {listings.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-muted-foreground">No listings found.</p>
              <p className="text-sm text-muted-foreground mt-2">
                Create your first listing from a winner deal to start building your Amazon catalog.
              </p>
            </CardContent>
          </Card>
        ) : (
          listings.map((listing: any) => (
            <Card key={listing.id} data-testid={`card-listing-${listing.id}`}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <CardTitle className="text-lg font-mono">{listing.skuCode}</CardTitle>
                    <CardDescription className="flex items-center gap-2">
                      <span>Brand: {listing.brand}</span>
                      <span>• ASIN: {listing.asin}</span>
                      <span>• Buy Price: €{parseFloat(listing.buyPrice).toFixed(2)}</span>
                    </CardDescription>
                  </div>
                  <div className="flex flex-col gap-1 items-end">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Amazon:</span>
                      {getStatusBadge(listing.amazonSyncStatus)}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">PrepMyBusiness:</span>
                      {getStatusBadge(listing.prepMyBusinessSyncStatus)}
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <Label className="text-muted-foreground">Generated Date</Label>
                    <p className="font-medium">{listing.generatedDate}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">CSV Exported</Label>
                    <p className="font-medium">{listing.csvExported ? 'Yes' : 'No'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Last Sync</Label>
                    <p className="font-medium">
                      {listing.lastSyncAt ? new Date(listing.lastSyncAt).toLocaleDateString() : 'Never'}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Created</Label>
                    <p className="font-medium">{new Date(listing.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>

                {(listing.amazonSyncStatus === 'draft' || listing.prepMyBusinessSyncStatus === 'draft') && (
                  <div className="flex gap-2">
                    {listing.amazonSyncStatus === 'draft' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateSyncStatusMutation.mutate({ 
                          id: listing.id, 
                          amazonStatus: 'pending' 
                        })}
                        data-testid={`button-sync-amazon-${listing.id}`}
                      >
                        Sync to Amazon
                      </Button>
                    )}
                    {listing.prepMyBusinessSyncStatus === 'draft' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateSyncStatusMutation.mutate({ 
                          id: listing.id, 
                          prepMyBusinessStatus: 'pending' 
                        })}
                        data-testid={`button-sync-prep-${listing.id}`}
                      >
                        Sync to PrepMyBusiness
                      </Button>
                    )}
                  </div>
                )}

                {listing.syncErrors && (
                  <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
                    <strong>Sync Errors:</strong> {listing.syncErrors}
                  </div>
                )}

                {listing.sourcing && (
                  <div className="text-xs text-muted-foreground">
                    Source: {listing.sourcing.productName} • 
                    Submitted by {listing.sourcing.submitter?.firstName} {listing.sourcing.submitter?.lastName}
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}