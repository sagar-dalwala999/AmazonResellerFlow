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
} from "@/components/ui/dialog";
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
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import Sidebar from "@/components/sidebar";

export default function SourcingInbox() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [isDebugOpen, setIsDebugOpen] = useState(false);

  // Fetch sourcing items directly from Google Sheets
  const { data: sheetsData, isLoading, refetch } = useQuery({
    queryKey: ["/api/sourcing/sheets"],
    queryFn: () => apiRequest("/api/sourcing/sheets"),
    staleTime: 0, // Always consider data stale
    cacheTime: 0, // Don't cache the data
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
      await queryClient.invalidateQueries({ queryKey: ["/api/sourcing/sheets"] });
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
                  {sourcingItems.length} items
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
                          Last updated: {new Date(sheetsData.lastUpdated).toLocaleString()}
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
                      <div
                        className="overflow-x-auto rounded-md border"
                        style={{ maxWidth: "100%" }}
                      >
                        <Table className="w-max min-w-full">
                          <TableHeader>
                            <TableRow>
                              <TableHead className="font-semibold sticky left-0 bg-background border-r min-w-[60px] z-10">
                                #
                              </TableHead>
                              {headers.map((header: string, index: number) => (
                                <TableHead
                                  key={index}
                                  className="font-semibold min-w-[150px] whitespace-nowrap px-4"
                                >
                                  {header ||
                                    `Column ${String.fromCharCode(65 + index)}`}
                                </TableHead>
                              ))}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredItems.map(
                              (
                                item: Record<string, string>,
                                rowIndex: number,
                              ) => (
                                <TableRow
                                  key={rowIndex}
                                  data-testid={`row-sourcing-${rowIndex}`}
                                >
                                  <TableCell className="font-medium sticky left-0 bg-background border-r z-10">
                                    {rowIndex + 1}
                                  </TableCell>
                                  {headers.map(
                                    (header: string, colIndex: number) => (
                                      <TableCell
                                        key={colIndex}
                                        className="min-w-[150px] whitespace-nowrap px-4"
                                      >
                                        {formatCellValue(
                                          item[header] || "",
                                          header,
                                        )}
                                      </TableCell>
                                    ),
                                  )}
                                </TableRow>
                              ),
                            )}
                          </TableBody>
                        </Table>
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
      </div>
    </div>
  );
}
