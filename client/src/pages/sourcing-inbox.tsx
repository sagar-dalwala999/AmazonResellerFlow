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
import { Download, Plus, RefreshCw, CheckCircle, Clock, XCircle, Eye, Bug, AlertTriangle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import Sidebar from "@/components/sidebar";

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
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [isDebugOpen, setIsDebugOpen] = useState(false);

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
      setDebugInfo(result);
      if (result.success) {
        toast({
          title: "Connection successful",
          description: `Spreadsheet "${result.spreadsheet?.title}" found. ${result.spreadsheet?.rowCount} rows available.`,
        });
      } else {
        setIsDebugOpen(true);
        toast({
          title: "Connection error",
          description: "Debug window opened. See details.",
          variant: "destructive",
        });
      }
    },
    onError: (error: Error) => {
      setDebugInfo({ 
        success: false, 
        error: error.message,
        fullError: error,
        timestamp: new Date().toISOString()
      });
      setIsDebugOpen(true);
      toast({
        title: "Test failed",
        description: "Debug window opened. See details.",
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
          title: "Import with warnings",
          description: `${result.importedRows} of ${result.totalRows} rows imported. ${result.errors.length} errors found.`,
          variant: "default",
        });
      } else {
        toast({
          title: "Import successful",
          description: `${result.importedRows} deals imported from Google Sheets`,
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Import error",
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
      <div className="flex h-screen overflow-hidden bg-gradient-to-br from-slate-50 via-white to-blue-50/30">
        <Sidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <header className="glass border-b border-black/10 backdrop-blur-xl">
            <div className="flex items-center justify-between h-20 px-6">
              <div className="flex items-center space-x-4">
                <div>
                  <h1 className="text-2xl font-bold gradient-text">Sourcing Inbox</h1>
                  <p className="text-xs text-muted-foreground mt-1">Loading...</p>
                </div>
              </div>
            </div>
          </header>
          <main className="flex-1 overflow-auto">
            <div className="p-8 space-y-6">
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
          </main>
        </div>
      </div>
    );
  }

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
                <h1 className="text-2xl font-bold gradient-text">Sourcing Inbox</h1>
                <p className="text-xs text-muted-foreground mt-1">Import deals from Google Sheets</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3 px-4 py-2 bg-blue-500/20 border border-blue-500/30 rounded-xl backdrop-blur-sm">
                <div className="w-3 h-3 bg-blue-400 rounded-full animate-glow"></div>
                <span className="text-sm font-medium text-blue-600">{sourcingItems.length} items</span>
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
                  <h2 className="text-lg text-muted-foreground mb-2">Google Sheets Integration</h2>
                </div>
                <div className="flex gap-2">
                  <Button
                    className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 border-0 text-white"
                    onClick={() => testConnectionMutation.mutate()}
                    disabled={testConnectionMutation.isPending}
                    data-testid="button-test-sheets"
                  >
                    {testConnectionMutation.isPending ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Bug className="h-4 w-4 mr-2" />
                    )}
                    Test Connection
                  </Button>
                  <Button
                    className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 border-0 text-white"
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
                  {debugInfo && (
                    <Button
                      variant="outline"
                      onClick={() => setIsDebugOpen(true)}
                      data-testid="button-debug"
                    >
                      <Bug className="h-4 w-4 mr-2" />
                      Debug Info
                    </Button>
                  )}
                </div>
              </div>
              
              {/* Filter Controls */}
              <div className="flex justify-between items-center">
                <div className="flex gap-4 items-center">
                  <Label className="text-sm font-medium">Filter by status:</Label>
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
                <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                  <DialogTrigger asChild>
                    <Button data-testid="button-add-sourcing">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Sourcing
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Add New Sourcing Item</DialogTitle>
                      <DialogDescription>
                        Add a new product for sourcing evaluation
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
                                  <Input placeholder="Enter product name" {...field} data-testid="input-product-name" />
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
                                  <Input placeholder="B01234ABCD" {...field} data-testid="input-asin" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="costPrice"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Cost Price (€) *</FormLabel>
                                <FormControl>
                                  <Input type="number" step="0.01" placeholder="0.00" {...field} data-testid="input-cost-price" />
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
                                  <Input type="number" step="0.01" placeholder="0.00" {...field} data-testid="input-sale-price" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        <FormField
                          control={form.control}
                          name="notes"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Notes</FormLabel>
                              <FormControl>
                                <Textarea placeholder="Additional notes..." {...field} data-testid="textarea-notes" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <div className="flex justify-end gap-2 pt-4">
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
                            {addSourcingMutation.isPending ? (
                              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                            ) : null}
                            Add Sourcing
                          </Button>
                        </div>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
              </div>

              {/* Sourcing Items Grid */}
              <div className="grid gap-4">
                {sourcingItems.length === 0 ? (
                  <Card>
                    <CardContent className="pt-6 text-center">
                      <p className="text-muted-foreground">No sourcing items found</p>
                    </CardContent>
                  </Card>
                ) : (
                  sourcingItems.map((item: any) => {
                    const { profit, margin } = calculateProfit(parseFloat(item.costPrice), parseFloat(item.salePrice));
                    
                    return (
                      <Card key={item.id} data-testid={`card-sourcing-${item.id}`} className="card-hover">
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
          </div>
        </main>

        {/* Debug Dialog */}
        <Dialog open={isDebugOpen} onOpenChange={setIsDebugOpen}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
                Google Sheets Debug Information
              </DialogTitle>
              <DialogDescription>
                Detailed information about the connection and errors
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              {debugInfo && (
                <div className="bg-muted p-4 rounded-lg">
                  <pre className="text-xs overflow-auto">
                    {JSON.stringify(debugInfo, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}