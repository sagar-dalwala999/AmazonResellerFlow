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
  SquarePen,
  Target,
  Eye,
  User,
  Search,
  Bell,
  Package,
  X,
  FileText,
  Download,
  Image as ImageIcon,
  Paperclip,
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

interface FileUploadSectionProps {
  rowIndex: number;
  asin: string;
  uploadFile: any;
  deleteFile: any;
}

export function FileUploadSection({ rowIndex, asin, uploadFile, deleteFile }: FileUploadSectionProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Fetch files for this row
  const { data: filesData } = useQuery({
    queryKey: ['/api/purchasing/files', rowIndex],
    queryFn: async () => {
      const response = await fetch(`/api/purchasing/files/${rowIndex}`);
      if (!response.ok) {
        throw new Error('Failed to fetch files');
      }
      return response.json();
    },
    enabled: !!rowIndex && rowIndex >= 0,
    staleTime: 5 * 60 * 1000, // 5 minutes - prevent unnecessary refetches
    gcTime: 10 * 60 * 1000, // 10 minutes - keep in cache longer
    refetchOnWindowFocus: false, // Don't refetch when window regains focus
  });

  const files = filesData?.files || [];
  const handleFileSelect = (selectedFiles: FileList | null) => {
    if (!selectedFiles || selectedFiles.length === 0) return;
    
    const file = selectedFiles[0];
    if (file) {
      uploadFile.mutate({ rowIndex, asin, file });
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const droppedFiles = e.dataTransfer.files;
    handleFileSelect(droppedFiles);
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return <ImageIcon className="w-4 h-4" />;
    if (mimeType.includes('pdf')) return <FileText className="w-4 h-4" />;
    return <Paperclip className="w-4 h-4" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="mt-4 space-y-2">
      {/* File Upload Area */}
      <div
        className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
          isDragOver ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
        }`}
        onClick={() => fileInputRef.current?.click()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={(e) => handleFileSelect(e.target.files)}
          accept="image/*,.pdf,.doc,.docx,.txt"
        />
        <Upload className="w-6 h-6 mx-auto mb-2 text-gray-400" />
        <p className="text-sm text-gray-600">
          Drop files here or click to upload
        </p>
        <p className="text-xs text-gray-500">
          Images, PDFs, Documents (Max 10MB)
        </p>
      </div>

      {/* Uploaded Files List */}
      {files.length > 0 && (
        <div className="space-y-2">
          <h5 className="text-sm font-medium text-gray-700">Uploaded Files:</h5>
          {files.map((file: any) => (
            <div key={file.id} className="flex items-center justify-between p-2 bg-gray-50 rounded border">
              <div className="flex items-center space-x-2">
                {getFileIcon(file.mimeType)}
                <span className="text-sm text-gray-700">{file.filename}</span>
                <span className="text-xs text-gray-500">({formatFileSize(file.size)})</span>
              </div>
              <div className="flex items-center space-x-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => window.open(`/api/purchasing/files/download/${file.id}`, '_blank')}
                  className="h-6 w-6 p-0"
                >
                  <Download className="w-3 h-3" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => deleteFile.mutate(file.id)}
                  className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function PurchasingInbox() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [notesModalOpen, setNotesModalOpen] = useState(false);
  const [editingNotes, setEditingNotes] = useState<{
    rowIndex: number;
    item: GoogleSheetsSourcingItem;
    notes: string;
  } | null>(null);

  // Fetch purchasing items directly from Google Sheets
  const {
    data: sheetsData,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["/api/purchasing/sheets"],
    queryFn: () => apiRequest("/api/purchasing/sheets"),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
    refetchInterval: 30000, // 30 seconds
    refetchIntervalInBackground: true,
  });

  // Fetch archived items from database (only items where archived = true)
  const { data: archivedData } = useQuery({
    queryKey: ["/api/purchasing/items", "archived"],
    queryFn: () => apiRequest("/api/purchasing/items?archived=true"),
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const purchasingItems: GoogleSheetsSourcingItem[] = (sheetsData as any)?.items || [];

  // Add archived items to the display list and mark them as archived
  const archivedItems = (archivedData as any) || [];
  const archivedSheetItems = archivedItems.map((item: any) => ({
    ...item,
    _isArchived: true,
    _originalRowIndex: item.originalRowIndex,
  }));

  // Filter out rows where essential fields are blank
  const validItems = purchasingItems
    .filter((item: GoogleSheetsSourcingItem) => {
      const productName = item["Product Name"]?.toString().trim();
      const asin = item["ASIN"]?.toString().trim();
      return productName && productName !== "" && asin && asin !== "";
    })
    .map((item, originalIndex) => ({
      ...item,
      _originalRowIndex: originalIndex + 2, // +2 because sheets are 1-indexed and have header row
    }))
    .concat(
      archivedSheetItems.filter((archivedItem: any) => {
        const productName = archivedItem["Product Name"]?.toString().trim();
        const asin = archivedItem["ASIN"]?.toString().trim();
        return productName && productName !== "" && asin && asin !== "";
      })
    );

  // Update Status (from column V)
  const updateStatus = useMutation({
    mutationFn: async ({
      rowIndex,
      status,
    }: {
      rowIndex: number;
      status: string;
    }) => {
      const response = await fetch("/api/purchasing/update-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rowIndex, status }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update status");
      }

      return response.json();
    },
    onSuccess: (data, variables) => {
      toast({
        description: `Status updated to "${variables.status}"`,
      });

      // Invalidate and refetch the sheets data to get updated information
      queryClient.invalidateQueries({ queryKey: ["/api/purchasing/sheets"] });
    },
    onError: (error: any) => {
      if (isUnauthorizedError(error)) {
        toast({
          variant: "destructive",
          description: "Session expired. Please log in again.",
        });
        window.location.href = "/api/login";
        return;
      }

      toast({
        variant: "destructive",
        description: error.message || "Failed to update status",
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
      const response = await fetch("/api/purchasing/update-sourcing-method", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rowIndex, sourcingMethod }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update sourcing method");
      }

      return response.json();
    },
    onSuccess: (data, variables) => {
      toast({
        description: `Sourcing method updated to "${variables.sourcingMethod}"`,
      });

      // Invalidate and refetch the sheets data to get updated information
      queryClient.invalidateQueries({ queryKey: ["/api/purchasing/sheets"] });
    },
    onError: (error: any) => {
      if (isUnauthorizedError(error)) {
        toast({
          variant: "destructive",
          description: "Session expired. Please log in again.",
        });
        window.location.href = "/api/login";
        return;
      }

      toast({
        variant: "destructive",
        description: error.message || "Failed to update sourcing method",
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
      const response = await fetch("/api/purchasing/update-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rowIndex, notes }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update notes");
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        description: "Notes updated successfully",
      });

      // Invalidate and refetch the sheets data to get updated information
      queryClient.invalidateQueries({ queryKey: ["/api/purchasing/sheets"] });
      setNotesModalOpen(false);
      setEditingNotes(null);
    },
    onError: (error: any) => {
      if (isUnauthorizedError(error)) {
        toast({
          variant: "destructive",
          description: "Session expired. Please log in again.",
        });
        window.location.href = "/api/login";
        return;
      }

      toast({
        variant: "destructive",
        description: error.message || "Failed to update notes",
      });
    },
  });

  // File upload mutations
  const uploadFile = useMutation({
    mutationFn: async ({ rowIndex, asin, file }: { rowIndex: number; asin: string; file: File }) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('rowIndex', rowIndex.toString());
      formData.append('asin', asin);

      const response = await fetch('/api/purchasing/files/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to upload file');
      }

      return response.json();
    },
    onSuccess: (data, variables) => {
      toast({
        description: `File uploaded successfully`,
      });

      // Invalidate files query to refresh the file list
      queryClient.invalidateQueries({ 
        queryKey: ['/api/purchasing/files', variables.rowIndex] 
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        description: error.message || 'Failed to upload file',
      });
    },
  });

  const deleteFile = useMutation({
    mutationFn: async (fileId: string) => {
      return apiRequest(`/api/purchasing/files/${fileId}`, "DELETE");
    },
    onSuccess: (data, fileId) => {
      toast({
        description: "File deleted successfully",
      });

      // Invalidate all file queries to refresh file lists
      queryClient.invalidateQueries({ 
        queryKey: ['/api/purchasing/files']
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        description: error.message || "Failed to delete file",
      });
    },
  });

  // Save items to database
  const saveItemsToDatabase = useMutation({
    mutationFn: async (items: any[]) => {
      return apiRequest("/api/purchasing/items/save", "POST", items);
    },
    onSuccess: () => {
      console.log("✅ Items saved to database successfully");
    },
    onError: (error: any) => {
      console.error("❌ Failed to save items to database:", error);
      // Silent fail for auto-save
    },
  });

  // Auto-save items to database when data changes
  React.useEffect(() => {
    if (validItems.length > 0 && !isLoading && user) {
      console.log("🔄 Auto-syncing items to database...");
      
      // Transform items to match database schema
      const itemsToSave = validItems
        .filter(item => !(item as any)._isArchived) // Don't save archived items again
        .map((item: any) => ({
          originalRowIndex: item._originalRowIndex,
          productName: item["Product Name"] || "",
          brand: item["Brand"] || "",
          asin: item["ASIN"] || "",
          eanBarcode: item["EAN Barcode"] || "",
          imageUrl: item["Image URL"] || "",
          costPrice: item["Cost Price"] || "",
          salePrice: item["Sale Price"] || "",
          buyBoxAverage: item["Buy Box (Average Last 90 Days)"] || "",
          profit: item["Profit"] || "",
          profitMargin: item["Profit Margin"] || "",
          roi: item["R.O.I."] || "",
          estimatedSales: item["Estimated Sales"] || "",
          fbaSellerCount: item["FBA Seller Count"] || "",
          fbmSellerCount: item["FBM Seller Count"] || "",
          status: item["Status"] || "",
          notes: item["Notes"] || "",
          sourcingMethod: item["Sourcing Method"] || "",
          sourceUrl: item["Source URL"] || "",
          amazonUrl: item["Amazon URL"] || "",
          datum: item["Datum"] || "",
        }));

      if (itemsToSave.length > 0) {
        saveItemsToDatabase.mutate(itemsToSave);
      }
    }
  }, [validItems, isLoading, user]);

  // Archive item with optimistic updates
  const archiveItem = useMutation({
    mutationFn: async (rowIndex: number) => {
      return apiRequest(`/api/purchasing/items/${rowIndex}/archive`, "POST");
    },
    onMutate: async (rowIndex: number) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["/api/purchasing/sheets"] });

      // Snapshot the previous value
      const previousData = queryClient.getQueryData(["/api/purchasing/sheets"]);

      // Optimistically update to hide the item
      queryClient.setQueryData(["/api/purchasing/sheets"], (old: any) => {
        if (!old || !old.items) return old;
        
        return {
          ...old,
          items: old.items.map((item: any, index: number) => {
            const currentRowIndex = index + 2; // +2 for 1-indexed sheets with header
            if (currentRowIndex === rowIndex) {
              return { ...item, _isArchived: true };
            }
            return item;
          })
        };
      });

      // Return a context with the previous data
      return { previousData };
    },
    onError: (err, rowIndex, context) => {
      // If the mutation fails, use the context to roll back
      if (context?.previousData) {
        queryClient.setQueryData(["/api/purchasing/sheets"], context.previousData);
      }
      
      if (isUnauthorizedError(err)) {
        toast({
          variant: "destructive",
          description: "Session expired. Please log in again.",
        });
        window.location.href = "/api/login";
        return;
      }

      toast({
        variant: "destructive",
        description: (err as any).message || "Failed to archive item",
      });
    },
    onSuccess: () => {
      toast({
        description: "Item archived successfully",
      });
      
      // Refetch both sheets data and archived data
      queryClient.invalidateQueries({ queryKey: ["/api/purchasing/sheets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/purchasing/items", "archived"] });
    },
    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: ["/api/purchasing/sheets"] });
    },
  });

  // Delete item with optimistic updates
  const deleteItem = useMutation({
    mutationFn: async (rowIndex: number) => {
      return apiRequest(`/api/purchasing/items/${rowIndex}`, "DELETE");
    },
    onMutate: async (rowIndex: number) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["/api/purchasing/sheets"] });

      // Snapshot the previous value
      const previousData = queryClient.getQueryData(["/api/purchasing/sheets"]);

      // Optimistically remove the item
      queryClient.setQueryData(["/api/purchasing/sheets"], (old: any) => {
        if (!old || !old.items) return old;
        
        return {
          ...old,
          items: old.items.filter((_: any, index: number) => {
            const currentRowIndex = index + 2; // +2 for 1-indexed sheets with header
            return currentRowIndex !== rowIndex;
          })
        };
      });

      // Return a context with the previous data
      return { previousData };
    },
    onError: (err, rowIndex, context) => {
      // If the mutation fails, use the context to roll back
      if (context?.previousData) {
        queryClient.setQueryData(["/api/purchasing/sheets"], context.previousData);
      }
      
      if (isUnauthorizedError(err)) {
        toast({
          variant: "destructive",
          description: "Session expired. Please log in again.",
        });
        window.location.href = "/api/login";
        return;
      }

      toast({
        variant: "destructive",
        description: (err as any).message || "Failed to delete item",
      });
    },
    onSuccess: () => {
      toast({
        description: "Item deleted permanently",
      });
      
      // Refetch data
      queryClient.invalidateQueries({ queryKey: ["/api/purchasing/sheets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/purchasing/items", "archived"] });
    },
    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: ["/api/purchasing/sheets"] });
    },
  });

  // Helper functions
  const parsePrice = (priceStr: string | number | undefined): number => {
    if (!priceStr) return 0;
    const cleanPrice = priceStr.toString().replace(/[^\d.,]/g, "");
    if (!cleanPrice) return 0;
    const price = parseFloat(cleanPrice.replace(",", "."));
    return isNaN(price) ? 0 : price;
  };

  const formatPrice = (priceStr: string | number | undefined): string => {
    const price = parsePrice(priceStr);
    return new Intl.NumberFormat("de-DE", {
      style: "currency",
      currency: "EUR",
    }).format(price);
  };

  // Handle edit notes
  const handleEditNotes = (item: any) => {
    setEditingNotes({
      rowIndex: item._originalRowIndex,
      item: item,
      notes: item["Notes"] || "",
    });
    setNotesModalOpen(true);
  };

  // Handle archive item
  const handleArchiveItem = (item: any) => {
    archiveItem.mutate(item._originalRowIndex);
  };

  // Handle delete item
  const handleDeleteItem = (item: any) => {
    if (window.confirm("Are you sure you want to permanently delete this item? This action cannot be undone.")) {
      deleteItem.mutate(item._originalRowIndex);
    }
  };

  if (isAuthLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Authentication Required</h1>
          <p className="text-gray-600 mb-4">
            You need to be logged in to access this page.
          </p>
          <Button
            onClick={() => (window.location.href = "/api/login")}
            data-testid="login-button"
          >
            Login
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar />
      
      <div className="flex-1 overflow-auto">
        <div className="container mx-auto p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-foreground">
                Purchasing Inbox
              </h1>
              <p className="text-muted-foreground mt-1">
                Manage and review purchasing products from Google Sheets
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="secondary" data-testid="product-count">
                {validItems.length} Products
              </Badge>
              <p className="text-sm text-muted-foreground">
                Last updated: {new Date().toLocaleTimeString()}
              </p>
            </div>
            <Button onClick={() => refetch()} variant="outline">
              Refresh Data
            </Button>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : validItems.length === 0 ? (
            <div className="text-center py-12">
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No purchasing products found
              </h3>
              <p className="text-gray-500">
                Products will appear here when added to the Google Sheets.
              </p>
            </div>
          ) : (
            <>
              {/* Product Cards */}
              <div className="space-y-6">
                {validItems.map(
                  (
                    item: GoogleSheetsSourcingItem & { _originalRowIndex: number },
                    index: number,
                  ) => {
                    const isFBAWarehouse =
                      item["Status"]?.toLowerCase() === "fba warehouse";
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
                          <div className="flex flex-col lg:flex-row gap-6">
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
                                <div className="flex justify-between items-center">
                                  <span className="text-gray-600">ASIN</span>
                                  <div className="flex items-center gap-2">
                                    <span
                                      className="text-gray-900 font-medium"
                                      data-testid={`product-asin-${index}`}
                                    >
                                      {item["ASIN"] || "N/A"}
                                    </span>
                                    {item["ASIN"] && item["ASIN"] !== "N/A" && (
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-4 w-4 p-0 text-gray-500 hover:text-gray-700"
                                        onClick={() => {
                                          navigator.clipboard.writeText(item["ASIN"]);
                                          toast({
                                            description: `ASIN ${item["ASIN"]} copied to clipboard`,
                                          });
                                        }}
                                        data-testid={`copy-asin-${index}`}
                                      >
                                        <Copy className="w-3 h-3" />
                                      </Button>
                                    )}
                                  </div>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-gray-600">EAN</span>
                                  <div className="flex items-center gap-2">
                                    <span
                                      className="text-gray-900"
                                      data-testid={`product-ean-${index}`}
                                    >
                                      {item["EAN Barcode"] || "N/A"}
                                    </span>
                                    {item["EAN Barcode"] && item["EAN Barcode"] !== "N/A" && (
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-4 w-4 p-0 text-gray-500 hover:text-gray-700"
                                        onClick={() => {
                                          navigator.clipboard.writeText(item["EAN Barcode"]);
                                          toast({
                                            description: `EAN ${item["EAN Barcode"]} copied to clipboard`,
                                          });
                                        }}
                                        data-testid={`copy-ean-${index}`}
                                      >
                                        <Copy className="w-3 h-3" />
                                      </Button>
                                    )}
                                  </div>
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
                                  <h5 className="text-sm font-medium text-gray-700 mb-2">
                                    Stock Levels
                                  </h5>
                                  <div className="space-y-1 text-xs">
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
                                  <h5 className="text-sm font-medium text-gray-700 mb-2">
                                    Active Offers
                                  </h5>
                                  <div className="space-y-1 text-xs">
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
                            <div className="lg:w-[300px] w-full grid grid-cols-1 gap-2">
                              {/* Status Dropdown */}
                              <Select
                                defaultValue={item["Status"] || ""}
                                onValueChange={(value) => {
                                  updateStatus.mutate({
                                    rowIndex: (item as any)._originalRowIndex,
                                    status: value,
                                  });
                                }}
                              >
                                <SelectTrigger
                                  className="w-full h-8"
                                  data-testid={`status-${index}`}
                                >
                                  <SelectValue placeholder="Select Status" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Prep">
                                    <div className="flex items-center gap-2 text-blue-600">
                                      <Package className="w-4 h-4" />
                                      Prep
                                    </div>
                                  </SelectItem>
                                  <SelectItem value="FBA Warehouse">
                                    <div className="flex items-center gap-2 text-green-600">
                                      <CheckCircle2 className="w-4 h-4" />
                                      FBA Warehouse
                                    </div>
                                  </SelectItem>
                                  <SelectItem value="Gated">
                                    <div className="flex items-center gap-2 text-yellow-600">
                                      <Bell className="w-4 h-4" />
                                      Gated
                                    </div>
                                  </SelectItem>
                                  <SelectItem value="Return">
                                    <div className="flex items-center gap-2 text-red-500">
                                      <X className="w-4 h-4" />
                                      Return
                                    </div>
                                  </SelectItem>
                                  <SelectItem value="Cancelled">
                                    <div className="flex items-center gap-2 text-red-500">
                                      <X className="w-4 h-4" />
                                      Cancelled
                                    </div>
                                  </SelectItem>
                                  <SelectItem value="Out of Stock">
                                    <div className="flex items-center gap-2 text-red-500">
                                      <X className="w-4 h-4" />
                                      Out of Stock
                                    </div>
                                  </SelectItem>
                                  <SelectItem value="Low Stock">
                                    <div className="flex items-center gap-2 text-orange-500">
                                      <Bell className="w-4 h-4" />
                                      Low Stock
                                    </div>
                                  </SelectItem>
                                  <SelectItem value="On hold">
                                    <div className="flex items-center gap-2 text-yellow-500">
                                      <Bell className="w-4 h-4" />
                                      On hold
                                    </div>
                                  </SelectItem>
                                  <SelectItem value="Pre-Order">
                                    <div className="flex items-center gap-2 text-blue-500">
                                      <Target className="w-4 h-4" />
                                      Pre-Order
                                    </div>
                                  </SelectItem>
                                  <SelectItem value="Not profitable anymore">
                                    <div className="flex items-center gap-2 text-red-500">
                                      <X className="w-4 h-4" />
                                      Not profitable anymore
                                    </div>
                                  </SelectItem>
                                  <SelectItem value="Price changed">
                                    <div className="flex items-center gap-2 text-orange-500">
                                      <Bell className="w-4 h-4" />
                                      Price changed
                                    </div>
                                  </SelectItem>
                                  <SelectItem value="Amazon active">
                                    <div className="flex items-center gap-2 text-red-500">
                                      <X className="w-4 h-4" />
                                      Amazon active
                                    </div>
                                  </SelectItem>
                                  <SelectItem value="Recent price increase">
                                    <div className="flex items-center gap-2 text-red-500">
                                      <X className="w-4 h-4" />
                                      Recent price increase
                                    </div>
                                  </SelectItem>
                                  <SelectItem value="Already submitted">
                                    <div className="flex items-center gap-2 text-red-500">
                                      <X className="w-4 h-4" />
                                      Already submitted
                                    </div>
                                  </SelectItem>
                                  <SelectItem value="Not enough profit for sale volume">
                                    <div className="flex items-center gap-2 text-red-500">
                                      <X className="w-4 h-4" />
                                      Not enough profit for sale volume
                                    </div>
                                  </SelectItem>
                                  <SelectItem value="Buy price changed">
                                    <div className="flex items-center gap-2 text-red-500">
                                      <X className="w-4 h-4" />
                                      Buy price changed
                                    </div>
                                  </SelectItem>
                                  <SelectItem value="Instable Price">
                                    <div className="flex items-center gap-2 text-red-500">
                                      <X className="w-4 h-4" />
                                      Instable Price
                                    </div>
                                  </SelectItem>
                                  <SelectItem value="Already selling">
                                    <div className="flex items-center gap-2 text-red-500">
                                      <X className="w-4 h-4" />
                                      Already selling
                                    </div>
                                  </SelectItem>
                                  <SelectItem value="Hazmat">
                                    <div className="flex items-center gap-2 text-red-500">
                                      <X className="w-4 h-4" />
                                      Hazmat
                                    </div>
                                  </SelectItem>
                                  <SelectItem value="Bad store">
                                    <div className="flex items-center gap-2 text-red-500">
                                      <X className="w-4 h-4" />
                                      Bad store
                                    </div>
                                  </SelectItem>
                                  <SelectItem value="Restricted Brand">
                                    <div className="flex items-center gap-2 text-red-500">
                                      <X className="w-4 h-4" />
                                      Restricted Brand
                                    </div>
                                  </SelectItem>
                                  <SelectItem value="Too heavy weight">
                                    <div className="flex items-center gap-2 text-red-500">
                                      <X className="w-4 h-4" />
                                      Too heavy weight
                                    </div>
                                  </SelectItem>
                                  <SelectItem value="Potential IP claims">
                                    <div className="flex items-center gap-2 text-red-500">
                                      <X className="w-4 h-4" />
                                      Potential IP claims
                                    </div>
                                  </SelectItem>
                                  <SelectItem value="Private Label">
                                    <div className="flex items-center gap-2 text-red-500">
                                      <X className="w-4 h-4" />
                                      Private Label
                                    </div>
                                  </SelectItem>
                                  <SelectItem value="No Source URL">
                                    <div className="flex items-center gap-2 text-red-500">
                                      <X className="w-4 h-4" />
                                      No Source URL
                                    </div>
                                  </SelectItem>
                                  <SelectItem value="Gated">
                                    <div className="flex items-center gap-2 text-red-500">
                                      <X className="w-4 h-4" />
                                      Gated
                                    </div>
                                  </SelectItem>
                                  <SelectItem value="Too many offers">
                                    <div className="flex items-center gap-2 text-red-500">
                                      <X className="w-4 h-4" />
                                      Too many offers
                                    </div>
                                  </SelectItem>
                                  <SelectItem value="Low stock">
                                    <div className="flex items-center gap-2 text-red-500">
                                      <X className="w-4 h-4" />
                                      Low stock
                                    </div>
                                  </SelectItem>
                                  <SelectItem value="Out of stock">
                                    <div className="flex items-center gap-2 text-red-500">
                                      <X className="w-4 h-4" />
                                      Out of stock
                                    </div>
                                  </SelectItem>
                                  <SelectItem value="FBA Stock > 3 months sales">
                                    <div className="flex items-center gap-2 text-red-500">
                                      <X className="w-4 h-4" />
                                      FBA Stock &gt; 3 months sales
                                    </div>
                                  </SelectItem>
                                  <SelectItem value="Transparency Code needed">
                                    <div className="flex items-center gap-2 text-red-500">
                                      <X className="w-4 h-4" />
                                      Transparency Code needed
                                    </div>
                                  </SelectItem>
                                  <SelectItem value="Buybox suppressed">
                                    <div className="flex items-center gap-2 text-red-500">
                                      <X className="w-4 h-4" />
                                      Buybox suppressed
                                    </div>
                                  </SelectItem>
                                  <SelectItem value="Different Amount">
                                    <div className="flex items-center gap-2 text-red-500">
                                      <X className="w-4 h-4" />
                                      Different Amount
                                    </div>
                                  </SelectItem>
                                  <SelectItem value="Brand active">
                                    <div className="flex items-center gap-2 text-red-500">
                                      <X className="w-4 h-4" />
                                      Brand active
                                    </div>
                                  </SelectItem>
                                </SelectContent>
                              </Select>

                              {/* Sourcing Method */}
                              <Select
                                defaultValue={item["Sourcing Method"] || ""}
                                onValueChange={(value) => {
                                  updateSourcingMethod.mutate({
                                    rowIndex: (item as any)._originalRowIndex,
                                    sourcingMethod: value,
                                  });
                                }}
                              >
                                <SelectTrigger
                                  className="w-full h-8"
                                  data-testid={`sourcing-method-${index}`}
                                >
                                  <SelectValue placeholder="Select Sourcing Method" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Profitpath">
                                    <div className="flex items-center gap-2">
                                      <Target className="w-4 h-4" />
                                      Profitpath
                                    </div>
                                  </SelectItem>
                                  <SelectItem value="Storefront Stalking">
                                    <div className="flex items-center gap-2">
                                      <Eye className="w-4 h-4" />
                                      Storefront Stalking
                                    </div>
                                  </SelectItem>
                                  <SelectItem value="Manual">
                                    <div className="flex items-center gap-2">
                                      <User className="w-4 h-4" />
                                      Manual
                                    </div>
                                  </SelectItem>
                                  <SelectItem value="Idealo Scraper">
                                    <div className="flex items-center gap-2">
                                      <Search className="w-4 h-4" />
                                      Idealo Scraper
                                    </div>
                                  </SelectItem>
                                  <SelectItem value="Qogita price alert">
                                    <div className="flex items-center gap-2">
                                      <Bell className="w-4 h-4" />
                                      Qogita price alert
                                    </div>
                                  </SelectItem>
                                  <SelectItem value="Wholesale">
                                    <div className="flex items-center gap-2">
                                      <Package className="w-4 h-4" />
                                      Wholesale
                                    </div>
                                  </SelectItem>
                                  <SelectItem value="Idealo notifier">
                                    <div className="flex items-center gap-2">
                                      <Bell className="w-4 h-4" />
                                      Idealo notifier
                                    </div>
                                  </SelectItem>
                                </SelectContent>
                              </Select>

                              {/* Notes and Action Buttons */}
                              <Button
                                variant="outline"
                                size="sm"
                                className="w-full justify-start"
                                onClick={() => handleEditNotes(item)}
                                data-testid={`edit-notes-${index}`}
                              >
                                <SquarePen className="w-4 h-4 mr-2" />
                                {item["Notes"] ? "Edit Notes" : "Add Notes"}
                              </Button>

                              {/* File Upload Section */}
                              <FileUploadSection
                                rowIndex={item._originalRowIndex}
                                asin={item["ASIN"] || ""}
                                uploadFile={uploadFile}
                                deleteFile={deleteFile}
                              />

                              {/* Action Buttons */}
                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="flex-1"
                                  onClick={() => handleArchiveItem(item)}
                                  disabled={archiveItem.isPending}
                                  data-testid={`archive-${index}`}
                                >
                                  <Archive className="w-4 h-4 mr-1" />
                                  Archive
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="flex-1 text-red-600 hover:text-red-700"
                                  onClick={() => handleDeleteItem(item)}
                                  disabled={deleteItem.isPending}
                                  data-testid={`delete-${index}`}
                                >
                                  <Trash2 className="w-4 h-4 mr-1" />
                                  Delete
                                </Button>
                              </div>

                              {/* Source URL */}
                              {item["Source URL"] && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="w-full justify-start"
                                  onClick={() => window.open(item["Source URL"], "_blank")}
                                  data-testid={`source-link-${index}`}
                                >
                                  <ExternalLink className="w-4 h-4 mr-2" />
                                  View Source
                                </Button>
                              )}

                              {/* Amazon URL */}
                              {item["Amazon URL"] && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="w-full justify-start"
                                  onClick={() => window.open(item["Amazon URL"], "_blank")}
                                  data-testid={`amazon-link-${index}`}
                                >
                                  <ExternalLink className="w-4 h-4 mr-2" />
                                  View on Amazon
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      </Card>
                    );
                  },
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Notes Dialog */}
      <Dialog open={notesModalOpen} onOpenChange={setNotesModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Edit Notes for {editingNotes?.item["Product Name"] || "Product"}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              placeholder="Add your notes here..."
              value={editingNotes?.notes || ""}
              onChange={(e) => {
                if (editingNotes) {
                  setEditingNotes({
                    ...editingNotes,
                    notes: e.target.value,
                  });
                }
              }}
              className="min-h-[200px]"
              data-testid="notes-textarea"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setNotesModalOpen(false);
                setEditingNotes(null);
              }}
              data-testid="cancel-notes"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (editingNotes) {
                  updateNotes.mutate({
                    rowIndex: editingNotes.rowIndex,
                    notes: editingNotes.notes,
                  });
                }
              }}
              disabled={updateNotes.isPending}
              data-testid="save-notes"
            >
              {updateNotes.isPending ? "Saving..." : "Save Notes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}