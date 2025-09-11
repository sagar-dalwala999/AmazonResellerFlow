import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  ExternalLink,
  Edit3,
  Upload,
  Trash2,
  Copy,
  CheckCircle2,
  Archive,
  ChevronDown,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import Sidebar from "@/components/sidebar";
import { isUnauthorizedError } from "@/lib/authUtils";
import { GoogleSheetsSourcingItem, SourcingItem } from "@shared/schema";

interface SheetsData {
  items?: GoogleSheetsSourcingItem[];
  headers?: string[];
  success?: boolean;
}

export default function SourcingInbox() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [notesModalOpen, setNotesModalOpen] = useState(false);
  const [editingNotes, setEditingNotes] = useState<{
    rowIndex: number;
    item: GoogleSheetsSourcingItem;
    currentNotes: string;
  } | null>(null);
  const [notesText, setNotesText] = useState("");

  // Fetch sourcing items directly from Google Sheets
  const {
    data: sheetsData,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["/api/sourcing/sheets"],
    queryFn: () => apiRequest("/api/sourcing/sheets"),
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: true,
    refetchInterval: 10000,
    refetchIntervalInBackground: true,
  });

  // Fetch archived items from database (only items where archived = true)
  const { data: archivedData } = useQuery({
    queryKey: ["/api/sourcing/items", "archived"],
    queryFn: () => apiRequest("/api/sourcing/items?archived=true"),
    enabled: !!user,
    staleTime: 0, // Force fresh data
    gcTime: 0,
  });

  const sourcingItems: GoogleSheetsSourcingItem[] =
    (sheetsData as any)?.items || [];
  const archivedItems: any[] = (archivedData as any)?.items || [];

  // Get list of archived ASINs for filtering (items that have been explicitly archived)
  const archivedAsins = new Set(archivedItems.map((item: any) => item.asin));

  // Filter out rows where essential fields are blank AND exclude archived items
  // Also keep track of original row indices
  const validItems = sourcingItems
    .map((item: GoogleSheetsSourcingItem, originalIndex: number) => ({
      ...item,
      _originalRowIndex: originalIndex,
    }))
    .filter(
      (item: GoogleSheetsSourcingItem & { _originalRowIndex: number }) => {
        const productName = item["Product Name"]?.trim();
        const asin = item["ASIN"]?.trim();
        const hasValidData =
          productName && productName !== "" && asin && asin !== "";
        const isNotArchived = !archivedAsins.has(asin);
        return hasValidData && isNotArchived;
      },
    );

  // Update Product Review (Winner status)
  const updateProductReview = useMutation({
    mutationFn: async ({
      rowIndex,
      productReview,
    }: {
      rowIndex: number;
      productReview: string;
    }) => {
      return apiRequest(
        "PATCH",
        `/api/sourcing/sheets/${rowIndex}/product-review`,
        {
          productReview,
        },
      );
    },
    onSuccess: (data, variables) => {
      toast({
        title: "Success",
        description: `Product marked as ${variables.productReview}`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/sourcing/sheets"] });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to update product review",
        variant: "destructive",
      });
    },
  });

  // Update Sourcing Method
  const updateSourcingMethod = useMutation({
    mutationFn: async ({
      rowIndex,
      sourcingMethod,
    }: {
      rowIndex: number;
      sourcingMethod: string;
    }) => {
      return apiRequest(
        "PATCH",
        `/api/sourcing/sheets/${rowIndex}/sourcing-method`,
        {
          sourcingMethod,
        },
      );
    },
    onSuccess: (data, variables) => {
      toast({
        title: "Success",
        description: `Sourcing method updated to "${variables.sourcingMethod}"`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/sourcing/sheets"] });
    },
    onError: (error) => {
      console.error("❌ Error updating sourcing method:", error);
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to update sourcing method",
        variant: "destructive",
      });
    },
  });

  // Update Notes
  const updateNotes = useMutation({
    mutationFn: async ({
      rowIndex,
      notes,
    }: {
      rowIndex: number;
      notes: string;
    }) => {
      return apiRequest("PATCH", `/api/sourcing/sheets/${rowIndex}/notes`, {
        notes,
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Notes updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/sourcing/sheets"] });
      setNotesModalOpen(false);
      setEditingNotes(null);
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to update notes",
        variant: "destructive",
      });
    },
  });

  // Save items to database
  const saveItemsToDatabase = useMutation({
    mutationFn: async (items: any[]) => {
      return apiRequest("/api/sourcing/items/save", "POST", items);
    },
    onSuccess: () => {
      console.log("✅ Items saved to database successfully");
      toast({
        title: "Success",
        description: "Items saved to database successfully",
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to save items to database",
        variant: "destructive",
      });
    },
  });

  // Archive item with optimistic updates
  const archiveItem = useMutation({
    mutationFn: async (rowIndex: number) => {
      return apiRequest(`/api/sourcing/items/${rowIndex}/archive`, "POST");
    },
    onMutate: async (rowIndex: number) => {
      console.log(
        "🎯 OPTIMISTIC ARCHIVE - Starting onMutate for rowIndex:",
        rowIndex,
      );

      // Cancel outgoing refetches so they don't overwrite our optimistic update
      await queryClient.cancelQueries({ queryKey: ["/api/sourcing/sheets"] });
      console.log("🎯 OPTIMISTIC ARCHIVE - Cancelled queries");

      // Snapshot the previous value for rollback
      const previousData = queryClient.getQueryData([
        "/api/sourcing/sheets",
      ]) as SheetsData | undefined;
      console.log(
        "🎯 OPTIMISTIC ARCHIVE - Previous data:",
        previousData?.items?.length,
        "items",
      );

      // Optimistically update to remove the item being archived
      queryClient.setQueryData(["/api/sourcing/sheets"], (old: any) => {
        console.log(
          "🎯 OPTIMISTIC ARCHIVE - Old data before filter:",
          old?.items?.length,
          "items",
        );
        if (!old?.items) {
          console.log(
            "🎯 OPTIMISTIC ARCHIVE - No items in old data, returning old",
          );
          return old;
        }

        // Find the item that is being archived by _originalRowIndex
        // The rowIndex parameter is the _originalRowIndex from the clicked item
        const itemToRemove = old.items[rowIndex];
        console.log(
          "🎯 OPTIMISTIC ARCHIVE - Item to remove at rowIndex",
          rowIndex,
          ":",
          {
            ASIN: itemToRemove?.ASIN,
            ProductName:
              itemToRemove?.["Product Name"]?.substring(0, 50) + "...",
          },
        );

        // Filter out the item at the specific rowIndex
        const filteredItems = old.items.filter((item: any, index: number) => {
          const shouldKeep = index !== rowIndex;
          if (!shouldKeep) {
            console.log(
              "🎯 OPTIMISTIC ARCHIVE - Removing item at index:",
              index,
              "ASIN:",
              item?.ASIN,
            );
          }
          return shouldKeep;
        });

        console.log(
          "🎯 OPTIMISTIC ARCHIVE - Filtered to:",
          filteredItems.length,
          "items (removed 1)",
        );

        return {
          ...old,
          items: filteredItems,
        };
      });

      // Verify the update worked
      const updatedData = queryClient.getQueryData(["/api/sourcing/sheets"]) as
        | SheetsData
        | undefined;
      console.log(
        "🎯 OPTIMISTIC ARCHIVE - Updated data after setQueryData:",
        updatedData?.items?.length,
        "items",
      );

      return { previousData };
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Item archived successfully",
      });
      // Invalidate both queries to refresh the data
      queryClient.invalidateQueries({ queryKey: ["/api/sourcing/items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sourcing/sheets"] });
    },
    onError: (error, rowIndex, context) => {
      // Revert the optimistic update
      if (context?.previousData) {
        queryClient.setQueryData(
          ["/api/sourcing/sheets"],
          context.previousData,
        );
      }

      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to archive item",
        variant: "destructive",
      });
    },
  });

  // Delete item with optimistic updates
  const deleteItem = useMutation({
    mutationFn: async (rowIndex: number) => {
      return apiRequest(`/api/sourcing/items/${rowIndex}`, "DELETE");
    },
    onMutate: async (rowIndex: number) => {
      // Cancel outgoing refetches so they don't overwrite our optimistic update
      await queryClient.cancelQueries({ queryKey: ["/api/sourcing/sheets"] });

      // Snapshot the previous value for rollback
      const previousData = queryClient.getQueryData(["/api/sourcing/sheets"]);

      // Optimistically update to remove the item being deleted
      queryClient.setQueryData(["/api/sourcing/sheets"], (old: any) => {
        if (!old?.items) return old;

        // Filter out the item at the specific rowIndex
        const filteredItems = old.items.filter((item: any, index: number) => {
          // Remove the item at the rowIndex being deleted
          return index !== rowIndex;
        });

        return {
          ...old,
          items: filteredItems,
        };
      });

      return { previousData };
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Item deleted successfully",
      });
      // Refetch to get the accurate data
      queryClient.invalidateQueries({ queryKey: ["/api/sourcing/sheets"] });
    },
    onError: (error, rowIndex, context) => {
      // Revert the optimistic update
      if (context?.previousData) {
        queryClient.setQueryData(
          ["/api/sourcing/sheets"],
          context.previousData,
        );
      }

      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to delete item",
        variant: "destructive",
      });
    },
  });

  const handleEditNotes = (
    rowIndex: number,
    item: GoogleSheetsSourcingItem,
  ) => {
    setEditingNotes({ rowIndex, item, currentNotes: item.Notes || "" });
    setNotesText(item.Notes || "");
    setNotesModalOpen(true);
  };

  const handleSaveNotes = () => {
    if (editingNotes) {
      updateNotes.mutate({
        rowIndex: editingNotes.rowIndex,
        notes: notesText,
      });
    }
  };

  const handleMarkAsWinner = (rowIndex: number) => {
    updateProductReview.mutate({
      rowIndex,
      productReview: "Winner",
    });
  };

  const handleArchiveItem = (
    item: GoogleSheetsSourcingItem & { _originalRowIndex: number },
  ) => {
    console.log(
      "📦 Archiving item with ASIN:",
      item["ASIN"],
      "Original row:",
      item._originalRowIndex,
    );
    archiveItem.mutate(item._originalRowIndex);
  };

  const handleDeleteItem = (
    item: GoogleSheetsSourcingItem & { _originalRowIndex: number },
  ) => {
    if (
      confirm(
        "Are you sure you want to delete this item? This will remove it from Google Sheets and cannot be undone.",
      )
    ) {
      console.log(
        "🗑️ Deleting item with original row index:",
        item._originalRowIndex,
      );
      deleteItem.mutate(item._originalRowIndex);
    }
  };

  // Auto-sync filtered items to database
  const syncItemsToDatabase = () => {
    if (validItems.length > 0) {
      const itemsToSave = validItems.map(
        (
          item: GoogleSheetsSourcingItem & { _originalRowIndex: number },
          index: number,
        ) => ({
          rowIndex: index,
          datum: item.Datum || "",
          imageUrl: item["Image URL"] || "",
          brand: item.Brand || "",
          productName: item["Product Name"] || "",
          asin: item.ASIN || "",
          eanBarcode: item["EAN Barcode"] || "",
          sourceUrl: item["Source URL"] || "",
          amazonUrl: item["Amazon URL"] || "",
          costPrice: item["Cost Price"] || "",
          salePrice: item["Sale Price"] || "",
          buyBoxAverage: item["Buy Box (Average Last 90 Days)"] || "",
          profit: item.Profit || "",
          profitMargin: item["Profit Margin"] || "",
          roi: item["R.O.I."] || "",
          estimatedSales: item["Estimated Sales"] || "",
          fbaSellerCount: item["FBA Seller Count"] || "",
          fbmSellerCount: item["FBM Seller Count"] || "",
          productReview: item["Product Review"] || "",
          notes: item.Notes || "",
          sourcingMethod: item["Sourcing Method"] || "",
        }),
      );

      saveItemsToDatabase.mutate(itemsToSave);
    }
  };

  // Auto-sync on data load (only if user is authenticated and auth is loaded)
  React.useEffect(() => {
    if (
      validItems.length > 0 &&
      !saveItemsToDatabase.isPending &&
      user &&
      !isAuthLoading
    ) {
      console.log("🔄 Auto-syncing items to database...");
      syncItemsToDatabase();
    }
  }, [validItems.length, user, isAuthLoading]);

  const formatPrice = (price: string) => {
    if (!price) return "€0.00";
    return price.includes("€") ? price : `€${price}`;
  };

  const parsePrice = (price: string): number => {
    if (!price) return 0;
    return parseFloat(price.replace(/[^\d.,]/g, "").replace(",", ".")) || 0;
  };

  const getProfitColor = (profitStr: string) => {
    const profit = parsePrice(profitStr);
    if (profit > 15) return "text-green-600 bg-green-50 border-green-200";
    if (profit > 5) return "text-orange-600 bg-orange-50 border-orange-200";
    return "text-red-600 bg-red-50 border-red-200";
  };

  if (isLoading || isAuthLoading) {
    return (
      <div className="flex h-screen bg-gray-50">
        <Sidebar />
        <div className="flex-1 p-8">
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 p-8 overflow-auto">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Sourcing Inbox
              </h1>
              <p className="text-gray-600 mt-2">
                {validItems.length} products from Google Sheets
              </p>
            </div>
            <Button onClick={() => refetch()} variant="outline">
              Refresh Data
            </Button>
          </div>

          {/* Product Cards */}
          <div className="space-y-6">
            {validItems.map(
              (
                item: GoogleSheetsSourcingItem & { _originalRowIndex: number },
                index: number,
              ) => {
                const isWinner =
                  item["Product Review"]?.toLowerCase() === "winner";
                const buyPrice = parsePrice(item["Cost Price"]);
                const sellPrice = parsePrice(item["Sale Price"]);
                const profit = parsePrice(item["Profit"]);
                const roi = item["R.O.I."] || "0%";
                const estSales = item["Estimated Sales"] || "0";
                const breakeven =
                  profit > 0 ? Math.ceil(buyPrice / profit) : null;

                return (
                  <Card
                    key={`${item.ASIN}-${index}`}
                    className="border border-gray-200 shadow-sm hover:shadow-md transition-shadow bg-white"
                    data-testid={`product-card-${index}`}
                  >
                    <div className="p-6">
                      {/* Top Section: Product Info + Colored Metric Cards */}
                      <div className="flex flex-col lg:flex-row gap-6 mb-6">
                        {/* Left: Product Information */}
                        <div className="flex-shrink-0 w-full lg:w-64">
                          {/* Date */}
                          <div className="text-sm text-gray-500 mb-4">
                            {item.Datum || "Feb 7, 2025"}
                            <br />
                            00:00:00
                          </div>

                          {/* Product Image and Details */}
                          <div className="flex items-start gap-3 mb-4">
                            {item["Image URL"] ? (
                              <img
                                src={item["Image URL"]}
                                alt={item["Product Name"] || "Product"}
                                className="w-16 h-16 rounded-lg object-cover bg-gray-100"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  target.style.display = "none";
                                }}
                              />
                            ) : (
                              <div className="w-16 h-16 rounded-lg bg-gray-100 flex items-center justify-center">
                                <span className="text-gray-400 text-xs">
                                  No Image
                                </span>
                              </div>
                            )}
                            <div className="flex-1">
                              <h3
                                className="font-medium text-gray-900 text-sm leading-tight mb-1"
                                data-testid={`product-title-${index}`}
                              >
                                {item["Product Name"] || "Unknown Product"}
                              </h3>
                              <p className="text-sm text-gray-600">
                                {item["Brand"] || "Unknown Brand"}
                              </p>
                            </div>
                          </div>

                          {/* ASIN and EAN */}
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-gray-600">ASIN</span>
                              <span
                                className="text-gray-900 font-medium"
                                data-testid={`product-asin-${index}`}
                              >
                                {item["ASIN"] || "N/A"}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">EAN</span>
                              <span
                                className="text-gray-900"
                                data-testid={`product-ean-${index}`}
                              >
                                {item["EAN Barcode"] || "N/A"}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Right: Colored Metric Cards Grid */}
                        <div className="flex-1">
                          <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 mb-4">
                            {/* Buy Price - Blue */}
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                              <div className="text-xs text-blue-600 font-medium mb-1">
                                Buy Price
                              </div>
                              <div className="text-sm font-bold text-blue-700">
                                {formatPrice(item["Cost Price"])}
                              </div>
                            </div>

                            {/* Sell Price - Green */}
                            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                              <div className="text-xs text-green-600 font-medium mb-1">
                                Sell Price
                              </div>
                              <div className="text-sm font-bold text-green-700">
                                {formatPrice(item["Sale Price"])}
                              </div>
                              <div className="text-xs text-green-600">
                                90d:{" "}
                                {formatPrice(
                                  item["Buy Box (Average Last 90 Days)"],
                                )}
                              </div>
                            </div>

                            {/* Profit - Light Green */}
                            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                              <div className="text-xs text-emerald-600 font-medium mb-1">
                                Profit
                              </div>
                              <div className="text-sm font-bold text-emerald-700">
                                {formatPrice(item["Profit"])}
                              </div>
                              <div className="text-xs text-emerald-600">
                                {item["Profit Margin"] || "0%"} margin
                              </div>
                            </div>

                            {/* ROI - Purple */}
                            <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                              <div className="text-xs text-purple-600 font-medium mb-1">
                                ROI
                              </div>
                              <div className="text-sm font-bold text-purple-700">
                                {roi}
                              </div>
                            </div>

                            {/* Est. Sales - Orange */}
                            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                              <div className="text-xs text-orange-600 font-medium mb-1">
                                Est. Sales
                              </div>
                              <div className="text-sm font-bold text-orange-700">
                                {estSales}/mo
                              </div>
                            </div>

                            {/* Breakeven - Beige */}
                            <div className="bg-stone-50 border border-stone-200 rounded-lg p-3">
                              <div className="text-xs text-stone-600 font-medium mb-1">
                                Breakeven
                              </div>
                              <div className="text-sm font-bold text-stone-700">
                                {breakeven ? `${breakeven} units` : "N/A"}
                              </div>
                              <div className="text-xs text-stone-600">
                                To recover costs
                              </div>
                            </div>
                          </div>
                          <div className="lg:grid-cols-3 grid-cols-1 grid gap-3">
                            <div className="border border-gray rounded-md p-3">
                              <h5 className="text-sm font-medium text-gray-700 mb-3">
                                Stock Levels
                              </h5>
                              <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Amazon:</span>
                                  <span className="font-medium">150</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-blue-600">FBA:</span>
                                  <span className="font-medium">
                                    {item["FBA Seller Count"] || "0"}
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-green-600">FBM:</span>
                                  <span className="font-medium">
                                    {item["FBM Seller Count"] || "0"}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Active Offers */}
                            <div className="border border-gray rounded-md p-3">
                              <h5 className="text-sm font-medium text-gray-700 mb-3">
                                Active Offers
                              </h5>
                              <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                  <span className="text-blue-600">
                                    FBA Offers:
                                  </span>
                                  <span className="font-medium">12</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-green-600">
                                    FBM Offers:
                                  </span>
                                  <span className="font-medium">8</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Total:</span>
                                  <span className="font-medium">20</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="ls:w-[350px] w-full">
                          {/* Winner Status */}
                          <div className="flex items-center justify-between mb-4">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <div className="flex items-center gap-2 cursor-pointer">
                                  {isWinner ? (
                                    <div className="flex items-center bg-green-500 text-white px-3 py-1 rounded-md text-sm">
                                      <CheckCircle2 className="w-4 h-4 mr-1" />
                                      Winner
                                    </div>
                                  ) : (
                                    <div className="flex items-center text-gray-600 px-3 py-1 border border-gray-300 rounded-md text-sm hover:bg-gray-50">
                                      Mark Status
                                    </div>
                                  )}
                                  <ChevronDown className="w-4 h-4 text-gray-400" />
                                </div>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent
                                align="start"
                                data-testid={`winner-dropdown-${index}`}
                              >
                                <DropdownMenuItem
                                  onClick={() =>
                                    updateProductReview.mutate({
                                      rowIndex: (item as any)._originalRowIndex,
                                      productReview: "Winner",
                                    })
                                  }
                                  data-testid={`mark-winner-${index}`}
                                >
                                  <CheckCircle2 className="w-4 h-4 mr-2 text-green-600" />
                                  Mark as Winner
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() =>
                                    updateProductReview.mutate({
                                      rowIndex: (item as any)._originalRowIndex,
                                      productReview: "No Go",
                                    })
                                  }
                                  data-testid={`mark-no-go-${index}`}
                                >
                                  Mark as No Go
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() =>
                                    updateProductReview.mutate({
                                      rowIndex: (item as any)._originalRowIndex,
                                      productReview: "",
                                    })
                                  }
                                  data-testid={`clear-status-${index}`}
                                >
                                  Clear Status
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>

                            {/* Sourcing Method */}
                            <Select
                              defaultValue={
                                item["Sourcing Method"] || "Online Arbitrage"
                              }
                              onValueChange={(value) => {
                                updateSourcingMethod.mutate({
                                  rowIndex: (item as any)._originalRowIndex,
                                  sourcingMethod: value,
                                });
                              }}
                            >
                              <SelectTrigger
                                className="w-40 h-8"
                                data-testid={`sourcing-method-${index}`}
                              >
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Online Arbitrage">
                                  Online Arbitrage
                                </SelectItem>
                                <SelectItem value="Retail Arbitrage">
                                  Retail Arbitrage
                                </SelectItem>
                                <SelectItem value="Wholesale">
                                  Wholesale
                                </SelectItem>
                                <SelectItem value="Private Label">
                                  Private Label
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex gap-3 pt-4 border-t border-gray-100 mt-4">
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1"
                            >
                              <ExternalLink className="w-4 h-4 mr-2" />
                              Amazon
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                handleArchiveItem(
                                  item as GoogleSheetsSourcingItem & {
                                    _originalRowIndex: number;
                                  },
                                )
                              }
                              disabled={archiveItem.isPending}
                              className="text-orange-600 hover:text-orange-700"
                              data-testid={`archive-${index}`}
                            >
                              <Archive className="w-4 h-4 mr-2" />
                              Archive
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                handleDeleteItem(
                                  item as GoogleSheetsSourcingItem & {
                                    _originalRowIndex: number;
                                  },
                                )
                              }
                              disabled={deleteItem.isPending}
                              className="text-red-600 hover:text-red-700"
                              data-testid={`delete-${index}`}
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete
                            </Button>
                          </div>
                        </div>
                      </div>

                      {/* Bottom Section: Stock Levels, Active Offers, Notes, Files */}
                      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 pt-4 border-t border-gray-100">
                        {/* Stock Levels */}

                        {/* Notes */}
                        <div>
                          <h5 className="text-sm font-medium text-gray-700 mb-3">
                            Notes
                          </h5>
                          <div className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3 min-h-[80px]">
                            {item.Notes ||
                              "This is a test note for the LED plant light. Great profit margins and good sales velocity."}
                          </div>
                        </div>

                        {/* Files */}
                        <div>
                          <h5 className="text-sm font-medium text-gray-700 mb-3">
                            Files
                          </h5>
                          <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                            <div className="text-blue-500 mb-2">
                              <Upload className="w-6 h-6 mx-auto" />
                            </div>
                            <div className="text-sm text-blue-600 mb-1">
                              Click to upload
                            </div>
                            <div className="text-xs text-gray-500">
                              or drag and drop
                            </div>
                            <div className="text-xs text-gray-500">
                              PDF, DOC, XLS, images up to 10MB
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              },
            )}
          </div>

          {validItems.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500">
                No valid products found in Google Sheets.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Notes Edit Modal */}
      <Dialog open={notesModalOpen} onOpenChange={setNotesModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Notes</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <h4 className="font-medium mb-2">
                {editingNotes?.item["Product Name"] || "Product"}
              </h4>
              <p className="text-sm text-gray-600">
                ASIN: {editingNotes?.item["ASIN"]}
              </p>
            </div>
            <Textarea
              value={notesText}
              onChange={(e) => setNotesText(e.target.value)}
              placeholder="Enter your notes here..."
              rows={4}
              data-testid="notes-textarea"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNotesModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveNotes}
              disabled={updateNotes.isPending}
              data-testid="save-notes-button"
            >
              {updateNotes.isPending ? "Saving..." : "Save Notes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
