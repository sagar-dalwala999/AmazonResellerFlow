import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Copy,
  ExternalLink,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import Sidebar from "@/components/sidebar";

interface PurchasingItem {
  [key: string]: string | number | undefined;
  "Product Name"?: string;
  "Brand"?: string;
  "ASIN"?: string;
  "EAN Barcode"?: string;
  "Image URL"?: string;
  "Cost Price"?: string;
  "Sale Price"?: string;
  "Buy Box (Average Last 90 Days)"?: string;
  "Profit"?: string;
  "Profit Margin"?: string;
  "FBA Seller Count"?: string;
  "FBM Seller Count"?: string;
  "Datum"?: string;
  "Source URL"?: string;
}

interface PurchasingData {
  items?: PurchasingItem[];
  headers?: string[];
  success?: boolean;
}

export default function PurchasingInbox() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const { toast } = useToast();

  // Fetch purchasing items directly from Google Sheets
  const {
    data: sheetsData,
    isLoading,
  } = useQuery({
    queryKey: ["/api/purchasing/sheets"],
    queryFn: () => apiRequest("/api/purchasing/sheets"),
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: true,
    refetchInterval: 30000, // 30 seconds
    refetchIntervalInBackground: true,
  });

  const purchasingItems: PurchasingItem[] = (sheetsData as any)?.items || [];

  // Filter out rows where essential fields are blank
  const validItems = purchasingItems.filter((item: PurchasingItem) => {
    const productName = item["Product Name"]?.toString().trim();
    const asin = item["ASIN"]?.toString().trim();
    return productName && productName !== "" && asin && asin !== "";
  });

  // Helper functions
  const formatPrice = (priceStr: string | undefined): string => {
    if (!priceStr) return "€0.00";
    
    const cleanPrice = priceStr.toString().replace(/[^\d.,]/g, "");
    if (!cleanPrice) return "€0.00";
    
    const price = parseFloat(cleanPrice.replace(",", "."));
    if (isNaN(price)) return "€0.00";
    
    return new Intl.NumberFormat("de-DE", {
      style: "currency",
      currency: "EUR",
    }).format(price);
  };

  const calculateROI = (costPrice: string | undefined, profit: string | undefined): string => {
    if (!costPrice || !profit) return "0%";
    
    const cost = parseFloat(costPrice.toString().replace(/[^\d.,]/g, "").replace(",", "."));
    const profitNum = parseFloat(profit.toString().replace(/[^\d.,]/g, "").replace(",", "."));
    
    if (isNaN(cost) || isNaN(profitNum) || cost === 0) return "0%";
    
    const roi = (profitNum / cost) * 100;
    return `${roi.toFixed(2)}%`;
  };

  const calculateEstSales = (item: PurchasingItem): string => {
    // Mock calculation - in real app this would come from data
    return "> 29";
  };

  const calculateBreakeven = (costPrice: string | undefined, profit: string | undefined): number | null => {
    if (!costPrice || !profit) return null;
    
    const cost = parseFloat(costPrice.toString().replace(/[^\d.,]/g, "").replace(",", "."));
    const profitNum = parseFloat(profit.toString().replace(/[^\d.,]/g, "").replace(",", "."));
    
    if (isNaN(cost) || isNaN(profitNum) || profitNum === 0) return null;
    
    return Math.ceil(cost / profitNum);
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
            </div>
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
            <div className="space-y-6">
              {validItems.map((item, index) => {
                const roi = calculateROI(item["Cost Price"], item["Profit"]);
                const estSales = calculateEstSales(item);
                const breakeven = calculateBreakeven(item["Cost Price"], item["Profit"]);

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
                            {item.Datum || "Date not specified"}
                            <br />
                            00:00:00
                          </div>

                          {/* Product Image and Details */}
                          <div className="flex items-start gap-3 mb-4">
                            {item["Image URL"] ? (
                              <img
                                src={item["Image URL"]?.toString()}
                                alt={item["Product Name"]?.toString() || "Product"}
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
                                      navigator.clipboard.writeText(item["ASIN"]?.toString() || "");
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
                                      navigator.clipboard.writeText(item["EAN Barcode"]?.toString() || "");
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
                                {formatPrice(item["Cost Price"]?.toString())}
                              </div>
                            </div>

                            {/* Sell Price - Green */}
                            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                              <div className="text-xs text-green-600 font-medium mb-1">
                                Sell Price
                              </div>
                              <div className="text-sm font-bold text-green-700">
                                {formatPrice(item["Sale Price"]?.toString())}
                              </div>
                              <div className="text-xs text-green-600">
                                90d:{" "}
                                {formatPrice(
                                  item["Buy Box (Average Last 90 Days)"]?.toString(),
                                )}
                              </div>
                            </div>

                            {/* Profit - Light Green */}
                            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                              <div className="text-xs text-emerald-600 font-medium mb-1">
                                Profit
                              </div>
                              <div className="text-sm font-bold text-emerald-700">
                                {formatPrice(item["Profit"]?.toString())}
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

                            {/* Source Link */}
                            <div className="border border-gray rounded-md p-3">
                              <h5 className="text-sm font-medium text-gray-700 mb-2">
                                Source
                              </h5>
                              {item["Source URL"] && item["Source URL"] !== "" ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="w-full h-8"
                                  onClick={() => window.open(item["Source URL"]?.toString(), "_blank")}
                                  data-testid={`source-link-${index}`}
                                >
                                  <ExternalLink className="w-4 h-4 mr-2" />
                                  View Source
                                </Button>
                              ) : (
                                <div className="text-xs text-gray-500">
                                  No source URL available
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}