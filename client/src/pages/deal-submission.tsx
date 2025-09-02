import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import Sidebar from "@/components/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface DealForm {
  productName: string;
  asin: string;
  buyPrice: string;
  sellPrice: string;
  category: string;
  notes: string;
}

export default function DealSubmission() {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const [formData, setFormData] = useState<DealForm>({
    productName: '',
    asin: '',
    buyPrice: '',
    sellPrice: '',
    category: '',
    notes: '',
  });

  const [profitMargin, setProfitMargin] = useState<string>('');

  const calculateProfitMargin = (buyPrice: string, sellPrice: string) => {
    const buy = parseFloat(buyPrice) || 0;
    const sell = parseFloat(sellPrice) || 0;
    
    if (buy > 0 && sell > 0) {
      const profit = sell - buy;
      const margin = (profit / sell) * 100;
      setProfitMargin(margin.toFixed(1));
    } else {
      setProfitMargin('');
    }
  };

  const handleInputChange = (field: keyof DealForm, value: string) => {
    const newFormData = { ...formData, [field]: value };
    setFormData(newFormData);
    
    if (field === 'buyPrice' || field === 'sellPrice') {
      calculateProfitMargin(
        field === 'buyPrice' ? value : formData.buyPrice,
        field === 'sellPrice' ? value : formData.sellPrice
      );
    }
  };

  const submitDeal = useMutation({
    mutationFn: async (dealData: any) => {
      await apiRequest("POST", "/api/deals", dealData);
    },
    onSuccess: () => {
      toast({
        title: "Deal eingereicht",
        description: "Ihr Deal wurde erfolgreich zur Bewertung eingereicht.",
      });
      
      // Reset form
      setFormData({
        productName: '',
        asin: '',
        buyPrice: '',
        sellPrice: '',
        category: '',
        notes: '',
      });
      setProfitMargin('');
      
      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['/api/deals'] });
      queryClient.invalidateQueries({ queryKey: ['/api/activities'] });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "Sie sind nicht angemeldet. Weiterleitung zur Anmeldung...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Fehler",
        description: "Deal konnte nicht eingereicht werden.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.productName || !formData.asin || !formData.buyPrice || !formData.sellPrice) {
      toast({
        title: "Unvollständige Daten",
        description: "Bitte füllen Sie alle Pflichtfelder aus.",
        variant: "destructive",
      });
      return;
    }

    submitDeal.mutate({
      ...formData,
      buyPrice: parseFloat(formData.buyPrice),
      sellPrice: parseFloat(formData.sellPrice),
    });
  };

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Header */}
        <header className="bg-card border-b border-border">
          <div className="flex items-center justify-between h-16 px-6">
            <h1 className="text-xl font-semibold text-foreground">Deal Erfassung</h1>
            <Button 
              variant="outline"
              onClick={() => window.location.href = '/'}
              data-testid="button-back-dashboard"
            >
              <i className="fas fa-arrow-left mr-2"></i>
              Zurück zum Dashboard
            </Button>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-auto bg-background p-6">
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle>Neuen Deal erfassen</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label htmlFor="productName">Produktname *</Label>
                    <Input
                      id="productName"
                      placeholder="z.B. Apple iPhone 15 Pro"
                      value={formData.productName}
                      onChange={(e) => handleInputChange('productName', e.target.value)}
                      data-testid="input-product-name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="asin">ASIN *</Label>
                    <Input
                      id="asin"
                      placeholder="B0XXXXXXXXX"
                      value={formData.asin}
                      onChange={(e) => handleInputChange('asin', e.target.value)}
                      data-testid="input-asin"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <Label htmlFor="buyPrice">Einkaufspreis (€) *</Label>
                    <Input
                      id="buyPrice"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={formData.buyPrice}
                      onChange={(e) => handleInputChange('buyPrice', e.target.value)}
                      data-testid="input-buy-price"
                    />
                  </div>
                  <div>
                    <Label htmlFor="sellPrice">Verkaufspreis (€) *</Label>
                    <Input
                      id="sellPrice"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={formData.sellPrice}
                      onChange={(e) => handleInputChange('sellPrice', e.target.value)}
                      data-testid="input-sell-price"
                    />
                  </div>
                  <div>
                    <Label htmlFor="profitMargin">Profit Margin (%)</Label>
                    <Input
                      id="profitMargin"
                      type="number"
                      step="0.1"
                      placeholder="0.0"
                      value={profitMargin}
                      readOnly
                      className="bg-muted"
                      data-testid="text-profit-margin"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="category">Kategorie</Label>
                  <Select value={formData.category} onValueChange={(value) => handleInputChange('category', value)}>
                    <SelectTrigger data-testid="select-category">
                      <SelectValue placeholder="Kategorie wählen..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="electronics">Elektronik</SelectItem>
                      <SelectItem value="clothing">Bekleidung</SelectItem>
                      <SelectItem value="home">Haus & Garten</SelectItem>
                      <SelectItem value="sports">Sport & Freizeit</SelectItem>
                      <SelectItem value="beauty">Beauty & Gesundheit</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="notes">Notizen</Label>
                  <Textarea
                    id="notes"
                    rows={3}
                    placeholder="Zusätzliche Informationen zum Deal..."
                    value={formData.notes}
                    onChange={(e) => handleInputChange('notes', e.target.value)}
                    data-testid="textarea-notes"
                  />
                </div>

                <div className="flex items-center justify-end space-x-4 pt-4 border-t border-border">
                  <Button 
                    type="button" 
                    variant="outline"
                    onClick={() => window.location.href = '/'}
                    data-testid="button-cancel"
                  >
                    Abbrechen
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={submitDeal.isPending}
                    data-testid="button-submit-deal"
                  >
                    {submitDeal.isPending ? 'Wird eingereicht...' : 'Deal einreichen'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
}
