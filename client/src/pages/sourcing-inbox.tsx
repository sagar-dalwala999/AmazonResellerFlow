import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertSourcingSchema } from "@shared/schema";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Download, Plus, RefreshCw, CheckCircle, Clock, XCircle, Eye } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const sourcingFormSchema = insertSourcingSchema.extend({
  datum: z.string().optional(),
  imageUrl: z.string().url().optional().or(z.literal("")),
  costPrice: z.string().min(1, "Cost price is required"),
  salePrice: z.string().min(1, "Sale price is required"),
  buyBoxAverage90Days: z.string().optional(),
  estimatedSales: z.string().optional(),
  fbaSellerCount: z.string().optional(),
  fbmSellerCount: z.string().optional(),
  productReview: z.string().optional(),
});

type SourcingFormData = z.infer<typeof sourcingFormSchema>;

export default function SourcingInbox() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  const userRole = (user as any)?.role || 'va';
  const isAdmin = userRole === 'admin';

  // Fetch sourcing items
  const { data: sourcingItems = [], isLoading } = useQuery({
    queryKey: ['/api/sourcing', filterStatus],
    queryFn: () => apiRequest(`/api/sourcing?status=${filterStatus === 'all' ? '' : filterStatus}`),
  });

  // Add sourcing mutation
  const addSourcingMutation = useMutation({
    mutationFn: (data: any) => apiRequest('/api/sourcing', 'POST', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sourcing'] });
      setIsAddDialogOpen(false);
      toast({
        title: "Success",
        description: "Sourcing item added successfully",
      });
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update status mutation (admin only)
  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status, reviewNotes }: { id: string; status: string; reviewNotes?: string }) =>
      apiRequest(`/api/sourcing/${id}/status`, 'PATCH', { status, reviewNotes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sourcing'] });
      toast({
        title: "Success",
        description: "Status updated successfully",
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

  // Google Sheets connection test mutation
  const testConnectionMutation = useMutation({
    mutationFn: () => apiRequest('/api/integrations/google-sheets/test'),
    onSuccess: (result: any) => {
      if (result.success) {
        toast({
          title: "Verbindung erfolgreich",
          description: `Spreadsheet "${result.spreadsheet.title}" gefunden. ${result.spreadsheet.rowCount} Zeilen verfügbar.`,
        });
      } else {
        toast({
          title: "Verbindungsfehler",
          description: result.error,
          variant: "destructive",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Test fehlgeschlagen",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Google Sheets import mutation
  const importSheetsMutation = useMutation({
    mutationFn: () => apiRequest('/api/integrations/google-sheets/import', 'POST'),
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/sourcing'] });
      
      if (result.errors && result.errors.length > 0) {
        toast({
          title: "Import mit Warnungen",
          description: `${result.importedRows} von ${result.totalRows} Zeilen importiert. ${result.errors.length} Fehler gefunden.`,
          variant: "default",
        });
      } else {
        toast({
          title: "Import erfolgreich",
          description: `${result.importedRows} Deals aus Google Sheets importiert`,
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Import-Fehler",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const form = useForm<SourcingFormData>({
    resolver: zodResolver(sourcingFormSchema),
    defaultValues: {
      productName: "",
      asin: "",
      brand: "",
      costPrice: "",
      salePrice: "",
      imageUrl: "",
      sourceUrl: "",
      amazonUrl: "",
      eanBarcode: "",
      notes: "",
      sourcingMethod: "",
    },
  });

  const onSubmit = (data: SourcingFormData) => {
    addSourcingMutation.mutate({
      ...data,
      costPrice: parseFloat(data.costPrice),
      salePrice: parseFloat(data.salePrice),
      buyBoxAverage90Days: data.buyBoxAverage90Days ? parseFloat(data.buyBoxAverage90Days) : null,
      estimatedSales: data.estimatedSales ? parseInt(data.estimatedSales) : null,
      fbaSellerCount: data.fbaSellerCount ? parseInt(data.fbaSellerCount) : null,
      fbmSellerCount: data.fbmSellerCount ? parseInt(data.fbmSellerCount) : null,
      productReview: data.productReview ? parseFloat(data.productReview) : null,
      datum: data.datum ? new Date(data.datum) : new Date(),
    });
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      new: { label: "New", variant: "secondary" as const, icon: Clock },
      under_review: { label: "Under Review", variant: "default" as const, icon: Eye },
      winner: { label: "Winner", variant: "default" as const, icon: CheckCircle },
      no_go: { label: "No-Go", variant: "destructive" as const, icon: XCircle },
    };
    
    const config = statusConfig[status as keyof typeof statusConfig];
    if (!config) return null;

    const Icon = config.icon;
    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const calculateProfit = (costPrice: number, salePrice: number) => {
    const profit = salePrice - costPrice;
    const margin = salePrice > 0 ? (profit / salePrice) * 100 : 0;
    return { profit, margin };
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Sourcing Inbox</h1>
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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Sourcing Inbox</h1>
          <p className="text-muted-foreground">
            Google Sheets Integration - Manage your product sourcing pipeline
          </p>
        </div>
        <div className="flex gap-2">
          {isAdmin && (
            <>
              <Button
                variant="outline"
                onClick={() => testConnectionMutation.mutate()}
                disabled={testConnectionMutation.isPending}
                data-testid="button-test-sheets"
              >
                {testConnectionMutation.isPending ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Test Verbindung
              </Button>
              <Button
                variant="outline"
                onClick={() => importSheetsMutation.mutate()}
                disabled={importSheetsMutation.isPending}
                data-testid="button-import-sheets"
              >
                {importSheetsMutation.isPending ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                Import from Sheets
              </Button>
            </>
          )}
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-sourcing">
                <Plus className="h-4 w-4 mr-2" />
                Add Sourcing
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add New Sourcing Item</DialogTitle>
                <DialogDescription>
                  Add a new product for sourcing evaluation. All 28 columns from Google Sheets are supported.
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="productName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Product Name *</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-product-name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="asin"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>ASIN *</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-asin" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="brand"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Brand</FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value || ''} data-testid="input-brand" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="eanBarcode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>EAN/Barcode</FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value || ''} data-testid="input-ean" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="costPrice"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Cost Price (€) *</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.01" {...field} data-testid="input-cost-price" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="salePrice"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Sale Price (€) *</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.01" {...field} data-testid="input-sale-price" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="buyBoxAverage90Days"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>BuyBox Avg 90 Days (€)</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.01" {...field} data-testid="input-buybox-avg" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="estimatedSales"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Estimated Sales/Month</FormLabel>
                          <FormControl>
                            <Input type="number" {...field} data-testid="input-estimated-sales" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="fbaSellerCount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>FBA Seller Count</FormLabel>
                          <FormControl>
                            <Input type="number" {...field} data-testid="input-fba-sellers" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="fbmSellerCount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>FBM Seller Count</FormLabel>
                          <FormControl>
                            <Input type="number" {...field} data-testid="input-fbm-sellers" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="productReview"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Product Review (1-5)</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.1" min="1" max="5" {...field} data-testid="input-product-review" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="sourcingMethod"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Sourcing Method</FormLabel>
                          <FormControl>
                            <Select onValueChange={field.onChange} value={field.value || ''}>
                              <SelectTrigger data-testid="select-sourcing-method">
                                <SelectValue placeholder="Select method" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="google-sheets">Google Sheets</SelectItem>
                                <SelectItem value="manual">Manual Entry</SelectItem>
                                <SelectItem value="keepa">Keepa API</SelectItem>
                                <SelectItem value="amazon-scraping">Amazon Scraping</SelectItem>
                              </SelectContent>
                            </Select>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    <FormField
                      control={form.control}
                      name="imageUrl"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Image URL</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-image-url" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="sourceUrl"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Source URL</FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value || ''} data-testid="input-source-url" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="amazonUrl"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Amazon URL</FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value || ''} data-testid="input-amazon-url" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="notes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Notes</FormLabel>
                          <FormControl>
                            <Textarea {...field} value={field.value || ''} data-testid="textarea-notes" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsAddDialogOpen(false)}
                      data-testid="button-cancel"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={addSourcingMutation.isPending}
                      data-testid="button-submit-sourcing"
                    >
                      {addSourcingMutation.isPending ? "Adding..." : "Add Sourcing"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-48" data-testid="select-filter-status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="new">New</SelectItem>
            <SelectItem value="under_review">Under Review</SelectItem>
            <SelectItem value="winner">Winner</SelectItem>
            <SelectItem value="no_go">No-Go</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Sourcing Items */}
      <div className="grid gap-4">
        {sourcingItems.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-muted-foreground">No sourcing items found.</p>
            </CardContent>
          </Card>
        ) : (
          sourcingItems.map((item: any) => {
            const { profit, margin } = calculateProfit(
              parseFloat(item.costPrice),
              parseFloat(item.salePrice)
            );

            return (
              <Card key={item.id} data-testid={`card-sourcing-${item.id}`}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <CardTitle className="text-lg">{item.productName}</CardTitle>
                      <CardDescription className="flex items-center gap-2">
                        <span>ASIN: {item.asin}</span>
                        {item.brand && <span>• Brand: {item.brand}</span>}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(item.status)}
                      {isAdmin && item.status === 'new' && (
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateStatusMutation.mutate({ id: item.id, status: 'under_review' })}
                            data-testid={`button-review-${item.id}`}
                          >
                            Review
                          </Button>
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => updateStatusMutation.mutate({ id: item.id, status: 'winner' })}
                            data-testid={`button-approve-${item.id}`}
                          >
                            Winner
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => updateStatusMutation.mutate({ id: item.id, status: 'no_go' })}
                            data-testid={`button-reject-${item.id}`}
                          >
                            No-Go
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <Label className="text-muted-foreground">Cost Price</Label>
                      <p className="font-medium">€{parseFloat(item.costPrice).toFixed(2)}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Sale Price</Label>
                      <p className="font-medium">€{parseFloat(item.salePrice).toFixed(2)}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Profit</Label>
                      <p className={`font-medium ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        €{profit.toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Margin</Label>
                      <p className={`font-medium ${margin >= 15 ? 'text-green-600' : 'text-yellow-600'}`}>
                        {margin.toFixed(1)}%
                      </p>
                    </div>
                  </div>

                  {item.notes && (
                    <div>
                      <Label className="text-muted-foreground">Notes</Label>
                      <p className="text-sm">{item.notes}</p>
                    </div>
                  )}

                  {item.submitter && (
                    <div className="text-xs text-muted-foreground">
                      Submitted by {item.submitter.firstName} {item.submitter.lastName} • 
                      {new Date(item.createdAt).toLocaleDateString()}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}