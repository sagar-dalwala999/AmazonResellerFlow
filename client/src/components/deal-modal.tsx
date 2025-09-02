import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface DealModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface DealForm {
  productName: string;
  asin: string;
  buyPrice: string;
  sellPrice: string;
  category: string;
  notes: string;
}

export default function DealModal({ open, onOpenChange }: DealModalProps) {
  const { toast } = useToast();
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
      
      // Reset form and close modal
      setFormData({
        productName: '',
        asin: '',
        buyPrice: '',
        sellPrice: '',
        category: '',
        notes: '',
      });
      setProfitMargin('');
      onOpenChange(false);
      
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Neuen Deal erfassen</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label htmlFor="modal-productName">Produktname *</Label>
              <Input
                id="modal-productName"
                placeholder="z.B. Apple iPhone 15 Pro"
                value={formData.productName}
                onChange={(e) => handleInputChange('productName', e.target.value)}
                data-testid="modal-input-product-name"
              />
            </div>
            <div>
              <Label htmlFor="modal-asin">ASIN *</Label>
              <Input
                id="modal-asin"
                placeholder="B0XXXXXXXXX"
                value={formData.asin}
                onChange={(e) => handleInputChange('asin', e.target.value)}
                data-testid="modal-input-asin"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <Label htmlFor="modal-buyPrice">Einkaufspreis (€) *</Label>
              <Input
                id="modal-buyPrice"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={formData.buyPrice}
                onChange={(e) => handleInputChange('buyPrice', e.target.value)}
                data-testid="modal-input-buy-price"
              />
            </div>
            <div>
              <Label htmlFor="modal-sellPrice">Verkaufspreis (€) *</Label>
              <Input
                id="modal-sellPrice"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={formData.sellPrice}
                onChange={(e) => handleInputChange('sellPrice', e.target.value)}
                data-testid="modal-input-sell-price"
              />
            </div>
            <div>
              <Label htmlFor="modal-profitMargin">Profit Margin (%)</Label>
              <Input
                id="modal-profitMargin"
                type="number"
                step="0.1"
                placeholder="0.0"
                value={profitMargin}
                readOnly
                className="bg-muted"
                data-testid="modal-text-profit-margin"
              />
            </div>
          </div>

          <div>
            <Label>Kategorie</Label>
            <Select value={formData.category} onValueChange={(value) => handleInputChange('category', value)}>
              <SelectTrigger data-testid="modal-select-category">
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
            <Label htmlFor="modal-notes">Notizen</Label>
            <Textarea
              id="modal-notes"
              rows={3}
              placeholder="Zusätzliche Informationen zum Deal..."
              value={formData.notes}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              data-testid="modal-textarea-notes"
            />
          </div>

          <div className="flex items-center justify-end space-x-4 pt-4 border-t border-border">
            <Button 
              type="button" 
              variant="outline"
              onClick={() => onOpenChange(false)}
              data-testid="modal-button-cancel"
            >
              Abbrechen
            </Button>
            <Button 
              type="submit" 
              disabled={submitDeal.isPending}
              data-testid="modal-button-submit"
            >
              {submitDeal.isPending ? 'Wird eingereicht...' : 'Deal einreichen'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
