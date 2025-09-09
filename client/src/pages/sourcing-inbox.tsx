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
  const { user } = useAuth();
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

  const sourcingItems = sheetsData?.items || [];

  // Filter out rows where essential fields are blank
  const validItems = sourcingItems.filter((item: SourcingItem) => {
    const productName = item['Product Name']?.trim();
    const asin = item['ASIN']?.trim();
    return productName && productName !== '' && asin && asin !== '';
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
      return apiRequest('POST', '/api/sourcing/items/save', items);
    },
    onSuccess: () => {
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

  // Archive item
  const archiveItem = useMutation({
    mutationFn: async (rowIndex: number) => {
      return apiRequest('POST', `/api/sourcing/items/${rowIndex}/archive`);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Item archived successfully",
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
        description: "Failed to archive item",
        variant: "destructive",
      });
    },
  });

  // Delete item
  const deleteItem = useMutation({
    mutationFn: async (rowIndex: number) => {
      return apiRequest('DELETE', `/api/sourcing/items/${rowIndex}`);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Item deleted successfully",
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

  const handleArchiveItem = (rowIndex: number) => {
    archiveItem.mutate(rowIndex);
  };

  const handleDeleteItem = (rowIndex: number) => {
    if (confirm('Are you sure you want to delete this item? This will remove it from Google Sheets and cannot be undone.')) {
      deleteItem.mutate(rowIndex);
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

  // Auto-sync on data load
  React.useEffect(() => {
    if (validItems.length > 0 && !saveItemsToDatabase.isPending) {
      syncItemsToDatabase();
    }
  }, [validItems.length]);

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

  if (isLoading) {
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
                  <CardContent className="p-6">
                    <div className="flex gap-6">
                      {/* Product Image */}
                      <div className="flex-shrink-0">
                        {item['Image URL'] ? (
                          <img
                            src={item['Image URL']}
                            alt={item['Product Name'] || 'Product'}
                            className="w-24 h-24 rounded-lg object-cover bg-gray-100"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                            }}
                          />
                        ) : (
                          <div className="w-24 h-24 rounded-lg bg-gray-100 flex items-center justify-center">
                            <span className="text-gray-400 text-xs">No Image</span>
                          </div>
                        )}
                      </div>

                      {/* Main Content */}
                      <div className="flex-1 space-y-4">
                        {/* Product Title and Brand */}
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900 mb-1" data-testid={`product-title-${index}`}>
                            {item['Product Name'] || 'Unknown Product'}
                          </h3>
                          <p className="text-sm text-gray-600">{item['Brand'] || 'Unknown Brand'}</p>
                        </div>

                        {/* ASIN and EAN */}
                        <div className="flex gap-6 text-sm text-gray-600">
                          <div data-testid={`product-asin-${index}`}>
                            <span className="font-medium">ASIN:</span> {item['ASIN'] || 'N/A'}
                          </div>
                          <div data-testid={`product-ean-${index}`}>
                            <span className="font-medium">EAN:</span> {item['EAN Barcode'] || 'N/A'}
                          </div>
                        </div>

                        {/* Pricing Row */}
                        <div className="flex flex-wrap gap-3">
                          <Badge variant="outline" className="text-blue-600 bg-blue-50 border-blue-200">
                            Buy Price: {formatPrice(item['Cost Price'])}
                          </Badge>
                          <Badge variant="outline" className="text-green-600 bg-green-50 border-green-200">
                            Sell Price: {formatPrice(item['Sale Price'])}
                          </Badge>
                          <Badge variant="outline" className={getProfitColor(item['Profit'])}>
                            Profit: {formatPrice(item['Profit'])}
                          </Badge>
                          <Badge variant="outline" className="text-purple-600 bg-purple-50 border-purple-200">
                            ROI: {roi}
                          </Badge>
                          <Badge variant="outline" className="text-orange-600 bg-orange-50 border-orange-200">
                            Est. Sales: {estSales}/mo
                          </Badge>
                          <Badge variant="outline" className="text-orange-600 bg-orange-50 border-orange-200">
                            Breakeven: {breakeven}
                          </Badge>
                        </div>

                        {/* Status and Method Row */}
                        <div className="flex items-center gap-4">
                          {isWinner ? (
                            <Badge className="bg-green-500 text-white">
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              Winner
                            </Badge>
                          ) : (
                            <Button
                              size="sm"
                              onClick={() => handleMarkAsWinner(index)}
                              disabled={updateProductReview.isPending}
                              className="bg-green-500 hover:bg-green-600 text-white"
                              data-testid={`mark-winner-${index}`}
                            >
                              Mark as Winner
                            </Button>
                          )}
                          
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-600">Sourcing Method:</span>
                            <Select defaultValue={item['Sourcing Method'] || 'Online Arbitrage'}>
                              <SelectTrigger className="w-48 h-8">
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

                        {/* Stock Levels and Active Offers */}
                        <div className="grid grid-cols-2 gap-6">
                          {/* Stock Levels */}
                          <div>
                            <h4 className="text-sm font-medium text-gray-700 mb-2">📊 Stock Levels</h4>
                            <div className="grid grid-cols-3 gap-2 text-sm">
                              <div>
                                <span className="text-gray-600">Amazon:</span>
                                <span className="ml-1 font-medium">150</span>
                              </div>
                              <div>
                                <span className="text-gray-600">FBA:</span>
                                <span className="ml-1 font-medium">{item['FBA Seller Count'] || '0'}</span>
                              </div>
                              <div className="text-green-600">
                                <span>FBM:</span>
                                <span className="ml-1 font-medium">{item['FBM Seller Count'] || '0'}</span>
                              </div>
                            </div>
                          </div>

                          {/* Active Offers */}
                          <div>
                            <h4 className="text-sm font-medium text-gray-700 mb-2">🏷️ Active Offers</h4>
                            <div className="grid grid-cols-3 gap-2 text-sm">
                              <div>
                                <span className="text-gray-600">FBA Offers:</span>
                                <span className="ml-1 font-medium text-blue-600">12</span>
                              </div>
                              <div>
                                <span className="text-gray-600">FBM Offers:</span>
                                <span className="ml-1 font-medium">8</span>
                              </div>
                              <div>
                                <span className="text-gray-600">Total:</span>
                                <span className="ml-1 font-medium">20</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Notes Section */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-sm font-medium text-gray-700">Notes</h4>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleEditNotes(index, item)}
                              data-testid={`edit-notes-${index}`}
                            >
                              <Edit3 className="w-4 h-4" />
                            </Button>
                          </div>
                          <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700">
                            {item.Notes || 'No notes available'}
                          </div>
                        </div>

                        {/* Files Upload Section */}
                        <div>
                          <h4 className="text-sm font-medium text-gray-700 mb-2">📁 Files</h4>
                          <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center bg-gray-50 hover:bg-gray-100 transition-colors">
                            <Upload className="w-5 h-5 text-gray-400 mx-auto mb-2" />
                            <p className="text-sm text-gray-600">
                              Click to upload or drag and drop
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              PDF, DOC, XLS, images up to 10MB
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex-shrink-0 flex flex-col gap-2">
                        {item['Amazon URL'] && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => window.open(item['Amazon URL'], '_blank')}
                            data-testid={`amazon-link-${index}`}
                          >
                            <ExternalLink className="w-4 h-4" />
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleArchiveItem(index)}
                          disabled={archiveItem.isPending}
                          className="text-orange-600 hover:text-orange-700"
                          data-testid={`archive-${index}`}
                        >
                          <Archive className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteItem(index)}
                          disabled={deleteItem.isPending}
                          className="text-red-600 hover:text-red-700"
                          data-testid={`delete-${index}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
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