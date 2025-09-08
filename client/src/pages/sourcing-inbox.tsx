import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Download,
  RefreshCw,
  Bug,
  AlertTriangle,
  ExternalLink,
  Edit3,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import Sidebar from "@/components/sidebar";

export default function SourcingInbox() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [isDebugOpen, setIsDebugOpen] = useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<{
    rowIndex: number;
    item: Record<string, string>;
  } | null>(null);
  const [notesModalOpen, setNotesModalOpen] = useState(false);
  const [editingNotes, setEditingNotes] = useState<{rowIndex: number, item: Record<string, string>, currentNotes: string} | null>(null);
  const [notesText, setNotesText] = useState("");

  // Fetch sourcing items directly from Google Sheets
  const {
    data: sheetsData,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["/api/sourcing/sheets"],
    queryFn: () => apiRequest("/api/sourcing/sheets"),
    staleTime: 0, // Always consider data stale
    gcTime: 0, // Don't cache the data (renamed from cacheTime in v5)
    refetchOnWindowFocus: true, // Refetch when window gains focus
    refetchInterval: 10000, // Auto-refresh every 10 seconds
    refetchIntervalInBackground: true, // Keep refreshing even when window is not focused
  });

  const sourcingItems = sheetsData?.items || [];
  const headers = sheetsData?.headers || [];

  // Filter out rows where all fields are blank
  const filteredItems = sourcingItems.filter((item: Record<string, string>) => {
    // Check if at least one field has content
    return headers.some((header: string) => {
      const value = item[header];
      return value && value.trim() !== "";
    });
  });

  // Refresh sheets data mutation
  const refreshSheetsMutation = useMutation({
    mutationFn: async () => {
      // Invalidate and refetch the data immediately
      await queryClient.invalidateQueries({
        queryKey: ["/api/sourcing/sheets"],
      });
      return refetch();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Data refreshed from Google Sheets",
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

  // Mark as winner mutation - updates Google Sheets directly
  const markAsWinnerMutation = useMutation({
    mutationFn: async ({
      rowIndex,
      productReview,
    }: {
      rowIndex: number;
      productReview: string;
    }) => {
      return apiRequest(
        `/api/sourcing/sheets/${rowIndex}/product-review`,
        "PATCH",
        { productReview },
      );
    },
    onSuccess: (data, variables) => {
      toast({
        title: "Success!",
        description: `Product marked as "Winner" in Google Sheets (Row ${variables.rowIndex + 1})`,
        variant: "default",
      });
      // Invalidate and refetch the sheets data to show the update
      queryClient.invalidateQueries({ queryKey: ["/api/sourcing/sheets"] });
      setConfirmModalOpen(false);
      setSelectedProduct(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `Failed to update Google Sheets: ${error.message}`,
        variant: "destructive",
      });
      setConfirmModalOpen(false);
      setSelectedProduct(null);
    },
  });

  // Show confirmation modal
  const showMarkAsWinnerConfirm = (
    rowIndex: number,
    item: Record<string, string>,
  ) => {
    setSelectedProduct({ rowIndex, item });
    setConfirmModalOpen(true);
  };

  // Handle confirm mark as winner
  const handleConfirmMarkAsWinner = () => {
    if (selectedProduct) {
      markAsWinnerMutation.mutate({
        rowIndex: selectedProduct.rowIndex,
        productReview: "Winner",
      });
    }
  };

  // Notes editing mutation - updates Google Sheets directly
  const editNotesMutation = useMutation({
    mutationFn: async ({ rowIndex, notes }: { rowIndex: number, notes: string }) => {
      return apiRequest(`/api/sourcing/sheets/${rowIndex}/notes`, 'PATCH', { notes });
    },
    onSuccess: (data, variables) => {
      toast({
        title: "Success!",
        description: `Notes updated for row ${variables.rowIndex + 1}`,
        variant: "default",
      });
      // Invalidate and refetch the sheets data to show the update
      queryClient.invalidateQueries({ queryKey: ["/api/sourcing/sheets"] });
      setNotesModalOpen(false);
      setEditingNotes(null);
      setNotesText("");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `Failed to update Notes: ${error.message}`,
        variant: "destructive",
      });
      setNotesModalOpen(false);
      setEditingNotes(null);
      setNotesText("");
    },
  });

  // Show Notes editing modal
  const showEditNotesModal = (rowIndex: number, item: Record<string, string>) => {
    const currentNotes = item['Notes'] || '';
    setEditingNotes({ rowIndex, item, currentNotes });
    setNotesText(currentNotes);
    setNotesModalOpen(true);
  };

  // Handle save Notes
  const handleSaveNotes = () => {
    if (editingNotes) {
      editNotesMutation.mutate({
        rowIndex: editingNotes.rowIndex,
        notes: notesText
      });
    }
  };

  // Google Sheets connection test mutation
  const testConnectionMutation = useMutation({
    mutationFn: () => apiRequest("/api/integrations/google-sheets/test"),
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
        timestamp: new Date().toISOString(),
      });
      setIsDebugOpen(true);
      toast({
        title: "Test failed",
        description: "Debug window opened. See details.",
        variant: "destructive",
      });
    },
  });
  console.log(filteredItems);
  // Google Sheets import mutation
  const importSheetsMutation = useMutation({
    mutationFn: () =>
      apiRequest("/api/integrations/google-sheets/import", "POST"),
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/sourcing"] });

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

  const formatCellValue = (value: string, headerName?: string) => {
    if (!value || value === "") return "-";

    // Check if it's a date in DD.MM.YYYY format (for Datum column)
    if (headerName === "Datum" && /^\d{2}\.\d{2}\.\d{4}$/.test(value)) {
      const [day, month, year] = value.split(".");
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));

      // Format as readable date
      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    }

    // Check if it's a URL
    if (value.startsWith("http://") || value.startsWith("https://")) {
      return (
        <a
          href={value}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:text-blue-800 underline flex items-center gap-1"
        >
          <ExternalLink className="h-3 w-3" />
          Link
        </a>
      );
    }

    // Check if it's a number (for better formatting)
    const num = parseFloat(value);
    if (
      !isNaN(num) &&
      value.includes(".") &&
      !value.includes("/") &&
      !value.includes("http")
    ) {
      return num.toFixed(2);
    }

    return value;
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
                  <h1 className="text-2xl font-bold gradient-text">
                    Sourcing Inbox
                  </h1>
                  <p className="text-xs text-muted-foreground mt-1">
                    Loading...
                  </p>
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
                <h1 className="text-2xl font-bold gradient-text">
                  Sourcing Inbox
                </h1>
                <p className="text-xs text-muted-foreground mt-1">
                  Import deals from Google Sheets
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3 px-4 py-2 bg-blue-500/20 border border-blue-500/30 rounded-xl backdrop-blur-sm">
                <div className="w-3 h-3 bg-blue-400 rounded-full animate-glow"></div>
                <span className="text-sm font-medium text-blue-600">
                  {filteredItems.length} items
                </span>
              </div>
              <button
                className="p-3 text-muted-foreground hover:bg-black/5 rounded-xl transition-all duration-200"
                onClick={() => (window.location.href = "/api/logout")}
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
                  <h2 className="text-lg text-muted-foreground mb-2">
                    Google Sheets Integration
                  </h2>
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
                    onClick={() => refreshSheetsMutation.mutate()}
                    disabled={refreshSheetsMutation.isPending || isLoading}
                    data-testid="button-refresh-sheets"
                  >
                    {refreshSheetsMutation.isPending || isLoading ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    Sync Now
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

              {/* Google Sheets Data Table */}
              <Card className="card-hover">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Download className="h-5 w-5" />
                    Google Sheets Sourcing Data
                  </CardTitle>
                  <CardDescription>
                    <div className="flex items-center gap-2">
                      <span>Live data from Google Sheets</span>
                      <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-green-100 text-green-700 rounded-full">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                        Auto-sync every 10s
                      </span>
                      {sheetsData?.lastUpdated && (
                        <span className="text-xs text-muted-foreground">
                          Last updated:{" "}
                          {new Date(sheetsData.lastUpdated).toLocaleString()}
                        </span>
                      )}
                    </div>
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {filteredItems.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Download className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>No data found in Google Sheets</p>
                      <p className="text-sm">
                        Make sure the "Sourcing" tab contains data in columns
                        A1-U1
                      </p>
                    </div>
                  ) : (
                    <div className="w-full">
                      <div className="grid grid-cols-1 gap-4">
                        {filteredItems.map(
                          (item: Record<string, string>, rowIndex: number) => {
                            const isWinner =
                              item["Product Review"]?.toLowerCase() ===
                              "winner";
                            return (
                              <Card
                                key={rowIndex}
                                data-testid={`card-sourcing-${rowIndex}`}
                                className={`p-4 ${isWinner ? "border-green-200 bg-green-50" : "border-gray-200"}`}
                              >
                                <div className="flex gap-4">
                                  {/* Product Image */}
                                  <div className="flex-shrink-0">
                                    {item["Image URL"] ? (
                                      <img
                                        src={item["Image URL"]}
                                        alt={item["Product Name"] || "Product"}
                                        className="w-24 h-24 object-cover rounded-lg border"
                                        onError={(e) => {
                                          const target =
                                            e.target as HTMLImageElement;
                                          target.src =
                                            "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjI0IiBoZWlnaHQ9IjI0IiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik04IDlIMTZWMTFIOFY5WiIgZmlsbD0iIzlDQTNBRiIvPgo8cGF0aCBkPSJNOCAxM0gxNlYxNUg4VjEzWiIgZmlsbD0iIzlDQTNBRiIvPgo8L3N2Zz4K";
                                        }}
                                      />
                                    ) : (
                                      <div className="w-24 h-24 bg-gray-100 rounded-lg border flex items-center justify-center">
                                        <span className="text-gray-400 text-xs">
                                          No Image
                                        </span>
                                      </div>
                                    )}
                                  </div>

                                  {/* Main Content */}
                                  <div className="flex-1 grid grid-cols-4 gap-4">
                                    {/* Column 1: Basic Info */}
                                    <div className="space-y-2">
                                      <div>
                                        <p className="text-xs text-gray-500">
                                          Date
                                        </p>
                                        <p className="text-sm font-medium">
                                          {formatCellValue(
                                            item["Datum"] || "",
                                            "Datum",
                                          )}
                                        </p>
                                      </div>
                                      <div>
                                        <p className="text-xs text-gray-500">
                                          Brand
                                        </p>
                                        <p className="text-sm font-medium">
                                          {item["Brand"] || "-"}
                                        </p>
                                      </div>
                                      <div>
                                        <p className="text-xs text-gray-500">
                                          ASIN
                                        </p>
                                        <p className="text-sm font-mono">
                                          {item["ASIN"] || "-"}
                                        </p>
                                      </div>
                                    </div>

                                    {/* Column 2: Product Details */}
                                    <div className="space-y-2">
                                      <div>
                                        <p className="text-xs text-gray-500">
                                          Product Name
                                        </p>
                                        <p
                                          className="text-sm font-medium line-clamp-2"
                                          title={item["Product Name"]}
                                        >
                                          {item["Product Name"] || "-"}
                                        </p>
                                      </div>
                                      <div>
                                        <p className="text-xs text-gray-500">
                                          EAN Barcode
                                        </p>
                                        <p className="text-sm font-mono text-xs">
                                          {item["EAN Barcode"] || "-"}
                                        </p>
                                      </div>
                                    </div>

                                    {/* Column 3: Pricing & Profit */}
                                    <div className="space-y-2">
                                      <div className="grid grid-cols-2 gap-2">
                                        <div>
                                          <p className="text-xs text-gray-500">
                                            Cost Price
                                          </p>
                                          <p className="text-sm font-bold text-red-600">
                                            {item["Cost Price"] || "-"}
                                          </p>
                                        </div>
                                        <div>
                                          <p className="text-xs text-gray-500">
                                            Sale Price
                                          </p>
                                          <p className="text-sm font-bold text-green-600">
                                            {item["Sale Price"] || "-"}
                                          </p>
                                        </div>
                                      </div>
                                      <div className="grid grid-cols-2 gap-2">
                                        <div>
                                          <p className="text-xs text-gray-500">
                                            Profit
                                          </p>
                                          <p className="text-sm font-bold text-blue-600">
                                            {item["Profit"] || "-"}
                                          </p>
                                        </div>
                                        <div>
                                          <p className="text-xs text-gray-500">
                                            Margin
                                          </p>
                                          <p className="text-sm font-bold">
                                            {item["Profit Margin"] || "-"}%
                                          </p>
                                        </div>
                                      </div>
                                      <div>
                                        <p className="text-xs text-gray-500">
                                          ROI
                                        </p>
                                        <p className="text-sm font-bold text-purple-600">
                                          {item["R.O.I."] || "-"}
                                        </p>
                                      </div>
                                    </div>

                                    {/* Column 4: Market Data & Actions */}
                                    <div className="space-y-2">
                                      <div className="grid grid-cols-2 gap-2">
                                        <div>
                                          <p className="text-xs text-gray-500">
                                            Est. Sales
                                          </p>
                                          <p className="text-sm font-medium">
                                            {item["Estimated Sales"] || "-"}
                                          </p>
                                        </div>
                                        <div>
                                          <p className="text-xs text-gray-500">
                                            Buy Box
                                          </p>
                                          <p className="text-sm font-medium">
                                            {item[
                                              "Buy Box (Average Last 90 Days)"
                                            ] || "-"}
                                          </p>
                                        </div>
                                      </div>
                                      <div className="grid grid-cols-2 gap-2">
                                        <div>
                                          <p className="text-xs text-gray-500">
                                            FBA Sellers
                                          </p>
                                          <p className="text-sm">
                                            {item["FBA Seller Count"] || "-"}
                                          </p>
                                        </div>
                                        <div>
                                          <p className="text-xs text-gray-500">
                                            FBM Sellers
                                          </p>
                                          <p className="text-sm">
                                            {item["FBM Seller Count"] || "-"}
                                          </p>
                                        </div>
                                      </div>
                                      <div className="space-y-2">
                                        <div>
                                          <p className="text-xs text-gray-500">
                                            Sourcing Method
                                          </p>
                                          <p className="text-sm">
                                            {item["Sourcing Method"] || "-"}
                                          </p>
                                        </div>
                                        <div>
                                          <div className="flex items-center gap-2">
                                            <p className="text-xs text-gray-500">
                                              Notes
                                            </p>
                                            <Button
                                              size="sm"
                                              variant="ghost"
                                              className="h-4 w-4 p-0 text-gray-400 hover:text-gray-600"
                                              onClick={() => showEditNotesModal(rowIndex, item)}
                                              data-testid={`button-edit-notes-${rowIndex}`}
                                            >
                                              <Edit3 className="h-3 w-3" />
                                            </Button>
                                          </div>
                                          <p className="text-sm">{item['Notes'] || '-'}</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          {!isWinner ? (
                                            <Button
                                              size="sm"
                                              className="bg-green-600 hover:bg-green-700 text-white text-xs px-3 py-1 h-6"
                                              onClick={() =>
                                                showMarkAsWinnerConfirm(
                                                  rowIndex,
                                                  item,
                                                )
                                              }
                                              data-testid={`button-mark-winner-${rowIndex}`}
                                              disabled={
                                                markAsWinnerMutation.isPending
                                              }
                                            >
                                              {markAsWinnerMutation.isPending
                                                ? "Updating..."
                                                : "Mark Winner"}
                                            </Button>
                                          ) : (
                                            <span className="inline-flex items-center gap-1 px-3 py-1 text-xs bg-green-100 text-green-700 rounded-full font-medium">
                                              ✓ Winner
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Quick Links */}
                                  <div className="flex-shrink-0 flex flex-col gap-1">
                                    {item["Amazon URL"] && (
                                      <a
                                        href={item["Amazon URL"]}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs text-blue-600 hover:text-blue-800"
                                      >
                                        <ExternalLink className="h-4 w-4" />
                                      </a>
                                    )}
                                    {item["Source URL"] && (
                                      <a
                                        href={item["Source URL"]}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs text-gray-600 hover:text-gray-800"
                                      >
                                        <ExternalLink className="h-4 w-4" />
                                      </a>
                                    )}
                                  </div>
                                </div>
                              </Card>
                            );
                          },
                        )}
                      </div>
                      <div className="mt-4 text-sm text-muted-foreground">
                        Showing {filteredItems.length} rows with{" "}
                        {headers.length} columns (A1-U1)
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
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

        {/* Confirmation Modal for Mark as Winner */}
        <Dialog open={confirmModalOpen} onOpenChange={setConfirmModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Mark as Winner</DialogTitle>
              <DialogDescription>
                Are you sure you want to mark this product as "Winner" in Google
                Sheets?
              </DialogDescription>
            </DialogHeader>
            {selectedProduct && (
              <div className="py-4">
                <div className="space-y-2">
                  <p>
                    <strong>Product:</strong>{" "}
                    {selectedProduct.item["Product Name"] || "Unknown"}
                  </p>
                  <p>
                    <strong>Brand:</strong>{" "}
                    {selectedProduct.item["Brand"] || "Unknown"}
                  </p>
                  <p>
                    <strong>ASIN:</strong>{" "}
                    {selectedProduct.item["ASIN"] || "Unknown"}
                  </p>
                  <p>
                    <strong>Row:</strong> {selectedProduct.rowIndex + 1}
                  </p>
                </div>
                <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                  <p className="text-sm text-yellow-800">
                    <strong>Note:</strong> This will update the "Product Review"
                    column in your Google Sheets to "Winner" and cannot be
                    undone through this interface.
                  </p>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setConfirmModalOpen(false)}
                disabled={markAsWinnerMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirmMarkAsWinner}
                disabled={markAsWinnerMutation.isPending}
                className="bg-green-600 hover:bg-green-700"
              >
                {markAsWinnerMutation.isPending
                  ? "Updating..."
                  : "Yes, Mark as Winner"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Notes Editing Modal */}
        <Dialog open={notesModalOpen} onOpenChange={setNotesModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Notes</DialogTitle>
              <DialogDescription>
                Update the notes for this product in Google Sheets.
              </DialogDescription>
            </DialogHeader>
            {editingNotes && (
              <div className="py-4">
                <div className="space-y-2 mb-4">
                  <p><strong>Product:</strong> {editingNotes.item['Product Name'] || 'Unknown'}</p>
                  <p><strong>Brand:</strong> {editingNotes.item['Brand'] || 'Unknown'}</p>
                  <p><strong>ASIN:</strong> {editingNotes.item['ASIN'] || 'Unknown'}</p>
                  <p><strong>Row:</strong> {editingNotes.rowIndex + 1}</p>
                </div>
                <div className="space-y-2">
                  <label htmlFor="notes-textarea" className="text-sm font-medium">
                    Notes:
                  </label>
                  <Textarea
                    id="notes-textarea"
                    value={notesText}
                    onChange={(e) => setNotesText(e.target.value)}
                    placeholder="Enter your notes here..."
                    rows={4}
                    className="w-full"
                  />
                  <p className="text-xs text-gray-500">
                    This will update the "Notes" column in your Google Sheets.
                  </p>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => setNotesModalOpen(false)}
                disabled={editNotesMutation.isPending}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleSaveNotes}
                disabled={editNotesMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {editNotesMutation.isPending ? 'Saving...' : 'Save Notes'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
