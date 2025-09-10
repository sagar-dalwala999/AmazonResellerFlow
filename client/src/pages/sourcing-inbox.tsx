import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  ExternalLink,
  Edit3,
  Upload,
  Trash2,
  Copy,
  CheckCircle2,
  Archive
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import Sidebar from "@/components/sidebar";
import { isUnauthorizedError } from "@/lib/authUtils";

interface SourcingItem {
  [key: string]: string;
}

export default function SourcingInbox() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [notesModalOpen, setNotesModalOpen] = useState(false);
  const [editingNotes, setEditingNotes] = useState<{rowIndex: number, item: SourcingItem, currentNotes: string} | null>(null);
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

  const sourcingItems = sheetsData?.items || [];
  const archivedItems = archivedData?.items || [];

  // Get list of archived ASINs for filtering (items that have been explicitly archived)
  const archivedAsins = new Set(archivedItems.map((item: any) => item.asin));

  // Filter out rows where essential fields are blank AND exclude archived items
  // Also keep track of original row indices
  const validItems = sourcingItems
    .map((item: SourcingItem, originalIndex: number) => ({
      ...item,
      _originalRowIndex: originalIndex
    }))
    .filter((item: SourcingItem & { _originalRowIndex: number }) => {
      const productName = item['Product Name']?.trim();
      const asin = item['ASIN']?.trim();
      const hasValidData = productName && productName !== '' && asin && asin !== '';
      const isNotArchived = !archivedAsins.has(asin);
      return hasValidData && isNotArchived;
    });


  // Update Product Review (Winner status)
  const updateProductReview = useMutation({
    mutationFn: async ({ rowIndex, productReview }: { rowIndex: number; productReview: string }) => {
      return apiRequest('PATCH', `/api/sourcing/sheets/${rowIndex}/product-review`, {
        productReview
      });
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

  // Update Notes
  const updateNotes = useMutation({
    mutationFn: async ({ rowIndex, notes }: { rowIndex: number; notes: string }) => {
      return apiRequest('PATCH', `/api/sourcing/sheets/${rowIndex}/notes`, {
        notes
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
      return apiRequest('/api/sourcing/items/save', 'POST', items);
    },
    onSuccess: () => {
      console.log('✅ Items saved to database successfully');
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
      return apiRequest(`/api/sourcing/items/${rowIndex}/archive`, 'POST');
    },
    onMutate: async (rowIndex: number) => {
      console.log('🎯 OPTIMISTIC ARCHIVE - Starting onMutate for rowIndex:', rowIndex);
      
      // Cancel outgoing refetches so they don't overwrite our optimistic update
      await queryClient.cancelQueries({ queryKey: ["/api/sourcing/sheets"] });
      console.log('🎯 OPTIMISTIC ARCHIVE - Cancelled queries');
      
      // Snapshot the previous value for rollback
      const previousData = queryClient.getQueryData(["/api/sourcing/sheets"]);
      console.log('🎯 OPTIMISTIC ARCHIVE - Previous data:', previousData?.items?.length, 'items');
      
      // Optimistically update to remove the item being archived
      queryClient.setQueryData(["/api/sourcing/sheets"], (old: any) => {
        console.log('🎯 OPTIMISTIC ARCHIVE - Old data before filter:', old?.items?.length, 'items');
        if (!old?.items) {
          console.log('🎯 OPTIMISTIC ARCHIVE - No items in old data, returning old');
          return old;
        }
        
        // Find the item that is being archived by _originalRowIndex
        // The rowIndex parameter is the _originalRowIndex from the clicked item
        const itemToRemove = old.items[rowIndex];
        console.log('🎯 OPTIMISTIC ARCHIVE - Item to remove at rowIndex', rowIndex, ':', {
          ASIN: itemToRemove?.ASIN,
          ProductName: itemToRemove?.['Product Name']?.substring(0, 50) + '...'
        });
        
        // Filter out the item at the specific rowIndex
        const filteredItems = old.items.filter((item: any, index: number) => {
          const shouldKeep = index !== rowIndex;
          if (!shouldKeep) {
            console.log('🎯 OPTIMISTIC ARCHIVE - Removing item at index:', index, 'ASIN:', item?.ASIN);
          }
          return shouldKeep;
        });
        
        console.log('🎯 OPTIMISTIC ARCHIVE - Filtered to:', filteredItems.length, 'items (removed 1)');
        
        return {
          ...old,
          items: filteredItems
        };
      });
      
      // Verify the update worked
      const updatedData = queryClient.getQueryData(["/api/sourcing/sheets"]);
      console.log('🎯 OPTIMISTIC ARCHIVE - Updated data after setQueryData:', updatedData?.items?.length, 'items');
      
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
        queryClient.setQueryData(["/api/sourcing/sheets"], context.previousData);
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
      return apiRequest(`/api/sourcing/items/${rowIndex}`, 'DELETE');
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
          items: filteredItems
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
        queryClient.setQueryData(["/api/sourcing/sheets"], context.previousData);
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

  const handleEditNotes = (rowIndex: number, item: SourcingItem) => {
    setEditingNotes({ rowIndex, item, currentNotes: item.Notes || '' });
    setNotesText(item.Notes || '');
    setNotesModalOpen(true);
  };

  const handleSaveNotes = () => {
    if (editingNotes) {
      updateNotes.mutate({
        rowIndex: editingNotes.rowIndex,
        notes: notesText
      });
    }
  };

  const handleMarkAsWinner = (rowIndex: number) => {
    updateProductReview.mutate({
      rowIndex,
      productReview: "Winner"
    });
  };

  const handleArchiveItem = (item: SourcingItem & { _originalRowIndex: number }) => {
    console.log('📦 Archiving item with ASIN:', item['ASIN'], 'Original row:', item._originalRowIndex);
    archiveItem.mutate(item._originalRowIndex);
  };

  const handleDeleteItem = (item: SourcingItem & { _originalRowIndex: number }) => {
    if (confirm('Are you sure you want to delete this item? This will remove it from Google Sheets and cannot be undone.')) {
      console.log('🗑️ Deleting item with original row index:', item._originalRowIndex);
      deleteItem.mutate(item._originalRowIndex);
    }
  };

  // Auto-sync filtered items to database
  const syncItemsToDatabase = () => {
    if (validItems.length > 0) {
      const itemsToSave = validItems.map((item: SourcingItem, index: number) => ({
        rowIndex: index,
        datum: item.Datum || '',
        imageUrl: item['Image URL'] || '',
        brand: item.Brand || '',
        productName: item['Product Name'] || '',
        asin: item.ASIN || '',
        eanBarcode: item['EAN Barcode'] || '',
        sourceUrl: item['Source URL'] || '',
        amazonUrl: item['Amazon URL'] || '',
        costPrice: item['Cost Price'] || '',
        salePrice: item['Sale Price'] || '',
        buyBoxAverage: item['Buy Box (Average Last 90 Days)'] || '',
        profit: item.Profit || '',
        profitMargin: item['Profit Margin'] || '',
        roi: item['R.O.I.'] || '',
        estimatedSales: item['Estimated Sales'] || '',
        fbaSellerCount: item['FBA Seller Count'] || '',
        fbmSellerCount: item['FBM Seller Count'] || '',
        productReview: item['Product Review'] || '',
        notes: item.Notes || '',
        sourcingMethod: item['Sourcing Method'] || '',
      }));
      
      saveItemsToDatabase.mutate(itemsToSave);
    }
  };

  // Auto-sync on data load (only if user is authenticated and auth is loaded)
  React.useEffect(() => {
    if (validItems.length > 0 && !saveItemsToDatabase.isPending && user && !isAuthLoading) {
      console.log('🔄 Auto-syncing items to database...');
      syncItemsToDatabase();
    }
  }, [validItems.length, user, isAuthLoading]);

  const formatPrice = (price: string) => {
    if (!price) return "€0.00";
    return price.includes('€') ? price : `€${price}`;
  };

  const parsePrice = (price: string): number => {
    if (!price) return 0;
    return parseFloat(price.replace(/[^\d.,]/g, '').replace(',', '.')) || 0;
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
              <h1 className="text-3xl font-bold text-gray-900">Sourcing Inbox</h1>
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
            {validItems.map((item: SourcingItem, index: number) => {
              const isWinner = item['Product Review']?.toLowerCase() === 'winner';
              const buyPrice = parsePrice(item['Cost Price']);
              const sellPrice = parsePrice(item['Sale Price']);
              const profit = parsePrice(item['Profit']);
              const roi = item['R.O.I.'] || '0%';
              const estSales = item['Estimated Sales'] || '0';
              const breakeven = sellPrice > 0 ? Math.ceil(buyPrice / profit) : 0;

              return (
                <Card 
                  key={`${item.ASIN}-${index}`}
                  className="border border-gray-200 shadow-sm hover:shadow-md transition-shadow bg-white"
                  data-testid={`product-card-${index}`}
                >
                  <div className="p-4">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                      {/* Left Column - Date/Time and Product Image/Info */}
                      <div className="lg:col-span-2">
                        <div className="flex flex-col space-y-3">
                          {/* Date/Time */}
                          <div className="text-xs text-gray-500">
                            <span>{item.Datum || 'Feb 7, 2025'}</span><br />
                            <span>00:00:00</span>
                          </div>
                          
                          {/* Product Image and Basic Info */}
                          <div className="flex items-start space-x-2">
                            {item['Image URL'] ? (
                              <img
                                src={item['Image URL']}
                                alt={item['Product Name'] || 'Product'}
                                className="w-12 h-12 rounded-lg object-cover bg-gray-100"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  target.style.display = 'none';
                                }}
                              />
                            ) : (
                              <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center">
                                <span className="text-gray-400 text-xs">No Image</span>
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <h3 className="font-medium text-gray-900 text-xs leading-tight line-clamp-2" data-testid={`product-title-${index}`}>
                                {item['Product Name'] || 'Unknown Product'}
                              </h3>
                              <p className="text-xs text-gray-600 mt-1">{item['Brand'] || 'Unknown Brand'}</p>
                            </div>
                          </div>
                          
                          {/* Basic Product Data */}
                          <div className="space-y-1 text-xs">
                            <div className="flex items-center justify-between">
                              <span className="text-gray-600">ASIN:</span>
                              <span className="text-gray-900 font-medium" data-testid={`product-asin-${index}`}>{item['ASIN'] || 'N/A'}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-gray-600">EAN:</span>
                              <span className="text-gray-900" data-testid={`product-ean-${index}`}>{item['EAN Barcode'] || 'N/A'}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Middle Column - Pricing Information */}
                      <div className="lg:col-span-3">
                        <div className="space-y-3">
                          <h4 className="text-sm font-medium text-gray-700">💰 Pricing</h4>
                          <div className="space-y-2 text-xs">
                            <div className="flex items-center justify-between">
                              <span className="text-gray-600">Buy Price:</span>
                              <span className="text-blue-600 font-medium">{formatPrice(item['Cost Price'])}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-gray-600">Sell Price:</span>
                              <span className="text-green-600 font-medium">{formatPrice(item['Sale Price'])}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-gray-600">Profit:</span>
                              <span className={`font-medium ${profit > 15 ? 'text-green-600' : profit > 5 ? 'text-orange-600' : 'text-red-600'}`}>
                                {formatPrice(item['Profit'])}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-gray-600">ROI:</span>
                              <span className="text-purple-600 font-medium">{roi}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Middle Right Column - Performance Data */}
                      <div className="lg:col-span-3">
                        <div className="space-y-3">
                          <h4 className="text-sm font-medium text-gray-700">📊 Performance</h4>
                          <div className="space-y-2 text-xs">
                            <div className="flex items-center justify-between">
                              <span className="text-gray-600">Est. Sales:</span>
                              <span className="text-orange-600 font-medium">{estSales}/mo</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-gray-600">Breakeven:</span>
                              <span className="text-gray-900 font-medium">{breakeven}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-gray-600">FBA Sellers:</span>
                              <span className="text-blue-600 font-medium">{item['FBA Seller Count'] || '0'}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-gray-600">FBM Sellers:</span>
                              <span className="text-green-600 font-medium">{item['FBM Seller Count'] || '0'}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Right Column - Status and Actions */}
                      <div className="lg:col-span-2">
                        <div className="space-y-3">
                          {/* Winner Status */}
                          <div>
                            {isWinner ? (
                              <Badge className="bg-green-500 text-white w-full justify-center">
                                <CheckCircle2 className="w-3 h-3 mr-1" />
                                Winner
                              </Badge>
                            ) : (
                              <Button
                                size="sm"
                                onClick={() => handleMarkAsWinner(index)}
                                disabled={updateProductReview.isPending}
                                className="bg-green-500 hover:bg-green-600 text-white w-full"
                                data-testid={`mark-winner-${index}`}
                              >
                                Mark as Winner
                              </Button>
                            )}
                          </div>

                          {/* Sourcing Method */}
                          <div>
                            <Select defaultValue={item['Sourcing Method'] || 'Online Arbitrage'}>
                              <SelectTrigger className="w-full h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Online Arbitrage">Online Arbitrage</SelectItem>
                                <SelectItem value="Retail Arbitrage">Retail Arbitrage</SelectItem>
                                <SelectItem value="Wholesale">Wholesale</SelectItem>
                                <SelectItem value="Private Label">Private Label</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>

                      {/* Far Right Column - Action Buttons */}
                      <div className="lg:col-span-2">
                        <div className="flex flex-col gap-2">
                          {item['Amazon URL'] && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => window.open(item['Amazon URL'], '_blank')}
                              data-testid={`amazon-link-${index}`}
                              className="w-full justify-start"
                            >
                              <ExternalLink className="w-4 h-4 mr-2" />
                              Amazon
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEditNotes(index, item)}
                            data-testid={`edit-notes-${index}`}
                            className="w-full justify-start text-blue-600 hover:text-blue-700"
                          >
                            <Edit3 className="w-4 h-4 mr-2" />
                            Notes
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleArchiveItem(item as SourcingItem & { _originalRowIndex: number })}
                            disabled={archiveItem.isPending}
                            className="w-full justify-start text-orange-600 hover:text-orange-700"
                            data-testid={`archive-${index}`}
                          >
                            <Archive className="w-4 h-4 mr-2" />
                            Archive
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteItem(item as SourcingItem & { _originalRowIndex: number })}
                            disabled={deleteItem.isPending}
                            className="w-full justify-start text-red-600 hover:text-red-700"
                            data-testid={`delete-${index}`}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Notes Section - Full Width */}
                    {item.Notes && (
                      <div className="mt-4 pt-4 border-t border-gray-100">
                        <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700">
                          <span className="font-medium text-gray-900">Notes: </span>
                          {item.Notes}
                        </div>
                      </div>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>

          {validItems.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500">No valid products found in Google Sheets.</p>
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
                {editingNotes?.item['Product Name'] || 'Product'}
              </h4>
              <p className="text-sm text-gray-600">ASIN: {editingNotes?.item['ASIN']}</p>
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
            <Button
              variant="outline"
              onClick={() => setNotesModalOpen(false)}
            >
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