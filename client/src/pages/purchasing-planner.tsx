import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertPurchasingPlanSchema } from "@shared/schema";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ShoppingCart, Plus, AlertTriangle, TrendingUp, Calculator, DollarSign } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const purchasingFormSchema = insertPurchasingPlanSchema.extend({
  plannedQuantity: z.string().min(1, "Quantity is required"),
  costPerUnit: z.string().min(1, "Cost per unit is required"),
  plannedBudget: z.string().min(1, "Budget is required"),
  weeklyBudgetAllocated: z.string().optional(),
});

type PurchasingFormData = z.infer<typeof purchasingFormSchema>;

export default function PurchasingPlanner() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedSourcing, setSelectedSourcing] = useState<string>("");
  const [liveCalculations, setLiveCalculations] = useState({
    quantity: 0,
    costPerUnit: 0,
    totalBudget: 0,
    expectedRevenue: 0,
    expectedProfit: 0,
    profitMargin: 0,
    roi: 0,
  });

  const userRole = user?.role || 'va';
  const isAdmin = userRole === 'admin';

  // Fetch winner sourcing items for planning
  const { data: winnerSourcing = [] } = useQuery({
    queryKey: ['/api/sourcing', 'winner'],
    queryFn: () => apiRequest('/api/sourcing?status=winner'),
    enabled: isAdmin,
  });

  // Fetch purchasing plans
  const { data: purchasingPlans = [], isLoading } = useQuery({
    queryKey: ['/api/purchasing'],
    queryFn: () => apiRequest('/api/purchasing'),
  });

  // Add purchasing plan mutation
  const addPlanMutation = useMutation({
    mutationFn: (data: any) => apiRequest('/api/purchasing', { method: 'POST', body: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/purchasing'] });
      setIsAddDialogOpen(false);
      toast({
        title: "Success",
        description: "Purchasing plan created successfully",
      });
      form.reset();
      setSelectedSourcing("");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update plan mutation
  const updatePlanMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: any }) =>
      apiRequest(`/api/purchasing/${id}`, { method: 'PATCH', body: updates }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/purchasing'] });
      toast({
        title: "Success",
        description: "Plan updated successfully",
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

  const form = useForm<PurchasingFormData>({
    resolver: zodResolver(purchasingFormSchema),
    defaultValues: {
      sourcingId: "",
      plannedQuantity: "",
      costPerUnit: "",
      plannedBudget: "",
      weeklyBudgetAllocated: "",
    },
  });

  // Live calculations based on form values
  useEffect(() => {
    const quantity = parseInt(form.watch("plannedQuantity")) || 0;
    const costPerUnit = parseFloat(form.watch("costPerUnit")) || 0;
    const totalBudget = quantity * costPerUnit;

    // Get sale price from selected sourcing item
    const sourcingItem = winnerSourcing.find((item: any) => item.id === selectedSourcing);
    const salePrice = sourcingItem ? parseFloat(sourcingItem.salePrice) : 0;

    const expectedRevenue = quantity * salePrice;
    const expectedProfit = expectedRevenue - totalBudget;
    const profitMargin = expectedRevenue > 0 ? (expectedProfit / expectedRevenue) * 100 : 0;
    const roi = totalBudget > 0 ? (expectedProfit / totalBudget) * 100 : 0;

    setLiveCalculations({
      quantity,
      costPerUnit,
      totalBudget,
      expectedRevenue,
      expectedProfit,
      profitMargin,
      roi,
    });

    // Update planned budget in form
    form.setValue("plannedBudget", totalBudget.toString());
  }, [form.watch("plannedQuantity"), form.watch("costPerUnit"), selectedSourcing, winnerSourcing, form]);

  const onSubmit = (data: PurchasingFormData) => {
    if (!selectedSourcing) {
      toast({
        title: "Error",
        description: "Please select a sourcing item",
        variant: "destructive",
      });
      return;
    }

    addPlanMutation.mutate({
      sourcingId: selectedSourcing,
      plannedQuantity: parseInt(data.plannedQuantity),
      costPerUnit: parseFloat(data.costPerUnit),
      plannedBudget: parseFloat(data.plannedBudget),
      weeklyBudgetAllocated: data.weeklyBudgetAllocated ? parseFloat(data.weeklyBudgetAllocated) : null,
    });
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      planned: { label: "Planned", variant: "secondary" as const },
      ordered: { label: "Ordered", variant: "default" as const },
      received: { label: "Received", variant: "success" as const },
      cancelled: { label: "Cancelled", variant: "destructive" as const },
    };
    
    const config = statusConfig[status as keyof typeof statusConfig];
    if (!config) return null;

    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const calculateActualPerformance = (plan: any) => {
    const actualProfit = parseFloat(plan.actualProfit || 0);
    const expectedProfit = parseFloat(plan.expectedProfit || 0);
    const variance = expectedProfit > 0 ? ((actualProfit - expectedProfit) / expectedProfit) * 100 : 0;
    
    return {
      actualProfit,
      expectedProfit,
      variance,
      isAboveTarget: variance >= 0,
    };
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
          <h1 className="text-3xl font-bold">Purchasing Planner</h1>
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

  const totalBudgetAllocated = purchasingPlans.reduce((sum: number, plan: any) => 
    sum + parseFloat(plan.plannedBudget || 0), 0
  );

  const totalExpectedRevenue = purchasingPlans.reduce((sum: number, plan: any) => 
    sum + parseFloat(plan.expectedRevenue || 0), 0
  );

  const totalExpectedProfit = purchasingPlans.reduce((sum: number, plan: any) => 
    sum + parseFloat(plan.expectedProfit || 0), 0
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Purchasing Planner</h1>
          <p className="text-muted-foreground">
            Plan purchases for winner deals with live profit calculations
          </p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-plan">
              <Plus className="h-4 w-4 mr-2" />
              Create Plan
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Create Purchasing Plan</DialogTitle>
              <DialogDescription>
                Plan your purchase for a winner deal with live profit calculations
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <Label>Select Winner Deal</Label>
                    <Select value={selectedSourcing} onValueChange={setSelectedSourcing}>
                      <SelectTrigger data-testid="select-sourcing-item">
                        <SelectValue placeholder="Choose a winner deal" />
                      </SelectTrigger>
                      <SelectContent>
                        {winnerSourcing.map((item: any) => (
                          <SelectItem key={item.id} value={item.id}>
                            {item.productName} - ASIN: {item.asin} (€{parseFloat(item.salePrice).toFixed(2)})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <FormField
                    control={form.control}
                    name="plannedQuantity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Planned Quantity *</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} data-testid="input-quantity" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="costPerUnit"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cost per Unit (€) *</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" {...field} data-testid="input-cost-per-unit" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="weeklyBudgetAllocated"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Weekly Budget Allocation (€)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" {...field} data-testid="input-weekly-budget" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Live Calculations Display */}
                {selectedSourcing && liveCalculations.quantity > 0 && (
                  <Card className="border-2 border-blue-200 bg-blue-50/50">
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Calculator className="h-5 w-5" />
                        Live Calculations
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <Label className="text-muted-foreground">Total Budget</Label>
                          <p className="text-xl font-bold">€{liveCalculations.totalBudget.toFixed(2)}</p>
                        </div>
                        <div>
                          <Label className="text-muted-foreground">Expected Revenue</Label>
                          <p className="text-xl font-bold text-green-600">€{liveCalculations.expectedRevenue.toFixed(2)}</p>
                        </div>
                        <div>
                          <Label className="text-muted-foreground">Expected Profit</Label>
                          <p className={`text-xl font-bold ${liveCalculations.expectedProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            €{liveCalculations.expectedProfit.toFixed(2)}
                          </p>
                        </div>
                        <div>
                          <Label className="text-muted-foreground">Profit Margin</Label>
                          <p className={`text-xl font-bold ${liveCalculations.profitMargin >= 15 ? 'text-green-600' : 'text-yellow-600'}`}>
                            {liveCalculations.profitMargin.toFixed(1)}%
                          </p>
                        </div>
                        <div>
                          <Label className="text-muted-foreground">ROI</Label>
                          <p className={`text-xl font-bold ${liveCalculations.roi >= 25 ? 'text-green-600' : 'text-yellow-600'}`}>
                            {liveCalculations.roi.toFixed(1)}%
                          </p>
                        </div>
                        <div className="col-span-1 md:col-span-3">
                          {liveCalculations.profitMargin < 15 && (
                            <div className="flex items-center gap-2 text-yellow-600">
                              <AlertTriangle className="h-4 w-4" />
                              <span className="text-sm">Warning: Profit margin below 15%</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

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
                    disabled={addPlanMutation.isPending || !selectedSourcing}
                    data-testid="button-submit-plan"
                  >
                    {addPlanMutation.isPending ? "Creating..." : "Create Plan"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-sm text-muted-foreground">Total Budget</p>
                <p className="text-2xl font-bold">€{totalBudgetAllocated.toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-sm text-muted-foreground">Expected Revenue</p>
                <p className="text-2xl font-bold text-green-600">€{totalExpectedRevenue.toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Calculator className="h-5 w-5 text-purple-600" />
              <div>
                <p className="text-sm text-muted-foreground">Expected Profit</p>
                <p className="text-2xl font-bold text-purple-600">€{totalExpectedProfit.toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-orange-600" />
              <div>
                <p className="text-sm text-muted-foreground">Active Plans</p>
                <p className="text-2xl font-bold">{purchasingPlans.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Purchasing Plans */}
      <div className="grid gap-4">
        {purchasingPlans.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-muted-foreground">No purchasing plans found.</p>
              <p className="text-sm text-muted-foreground mt-2">
                Create your first plan from a winner deal to start purchasing planning.
              </p>
            </CardContent>
          </Card>
        ) : (
          purchasingPlans.map((plan: any) => {
            const performance = calculateActualPerformance(plan);

            return (
              <Card key={plan.id} data-testid={`card-plan-${plan.id}`}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <CardTitle className="text-lg">
                        {plan.sourcing?.productName || 'Unknown Product'}
                      </CardTitle>
                      <CardDescription className="flex items-center gap-2">
                        <span>ASIN: {plan.sourcing?.asin}</span>
                        <span>• Quantity: {plan.plannedQuantity}</span>
                        {plan.marginWarning && (
                          <Badge variant="destructive" className="text-xs">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Low Margin
                          </Badge>
                        )}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(plan.status)}
                      {plan.status === 'planned' && (
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updatePlanMutation.mutate({ 
                              id: plan.id, 
                              updates: { status: 'ordered', orderDate: new Date() }
                            })}
                            data-testid={`button-order-${plan.id}`}
                          >
                            Mark Ordered
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <Label className="text-muted-foreground">Planned Budget</Label>
                      <p className="font-medium">€{parseFloat(plan.plannedBudget).toFixed(2)}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Expected Revenue</Label>
                      <p className="font-medium text-green-600">€{parseFloat(plan.expectedRevenue || 0).toFixed(2)}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Expected Profit</Label>
                      <p className="font-medium text-purple-600">€{parseFloat(plan.expectedProfit || 0).toFixed(2)}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Cost per Unit</Label>
                      <p className="font-medium">€{parseFloat(plan.costPerUnit).toFixed(2)}</p>
                    </div>
                  </div>

                  {plan.status !== 'planned' && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm border-t pt-4">
                      <div>
                        <Label className="text-muted-foreground">Actual Spent</Label>
                        <p className="font-medium">€{parseFloat(plan.actualSpent || 0).toFixed(2)}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">Actual Revenue</Label>
                        <p className="font-medium">€{parseFloat(plan.actualRevenue || 0).toFixed(2)}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">Actual Profit</Label>
                        <p className={`font-medium ${performance.actualProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          €{performance.actualProfit.toFixed(2)}
                        </p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">Variance</Label>
                        <p className={`font-medium ${performance.isAboveTarget ? 'text-green-600' : 'text-red-600'}`}>
                          {performance.variance > 0 ? '+' : ''}{performance.variance.toFixed(1)}%
                        </p>
                      </div>
                    </div>
                  )}

                  {plan.weeklyBudgetAllocated && (
                    <div className="text-xs text-muted-foreground">
                      Weekly Budget: €{parseFloat(plan.weeklyBudgetAllocated).toFixed(2)} • 
                      Created: {new Date(plan.createdAt).toLocaleDateString()}
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