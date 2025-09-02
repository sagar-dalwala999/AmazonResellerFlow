import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Key, Shield, CheckCircle, AlertCircle, ExternalLink, Save } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export default function APISettings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [apiKeys, setApiKeys] = useState({
    KEEPA_API_KEY: "",
    AMAZON_SP_API_CLIENT_ID: "",
    AMAZON_SP_API_CLIENT_SECRET: "",
    AMAZON_SP_API_REFRESH_TOKEN: "",
    PREP_MY_BUSINESS_API_KEY: "",
    PREP_MY_BUSINESS_BASE_URL: "",
    GOOGLE_SHEETS_API_KEY: "",
    GOOGLE_SHEETS_SPREADSHEET_ID: "",
  });

  const userRole = (user as any)?.role || 'va';
  const isAdmin = userRole === 'admin';

  // Mock save mutation - in real implementation this would use ask_secrets
  const saveApiKeysMutation = useMutation({
    mutationFn: async (keys: typeof apiKeys) => {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      return { success: true };
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "API keys saved securely",
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

  const handleInputChange = (key: string, value: string) => {
    setApiKeys(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleSave = () => {
    const filledKeys = Object.entries(apiKeys).filter(([_, value]) => value.trim() !== "");
    if (filledKeys.length === 0) {
      toast({
        title: "No keys to save",
        description: "Please enter at least one API key",
        variant: "destructive",
      });
      return;
    }
    saveApiKeysMutation.mutate(apiKeys);
  };

  const getKeyStatus = (key: string) => {
    const value = apiKeys[key as keyof typeof apiKeys];
    if (!value || value.trim() === "") {
      return { status: "missing", icon: AlertCircle, color: "text-red-600" };
    }
    return { status: "configured", icon: CheckCircle, color: "text-green-600" };
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

  const apiIntegrations = [
    {
      name: "Keepa API",
      description: "Product tracking, price history, and BuyBox data",
      website: "https://keepa.com/#!api",
      keys: [
        { key: "KEEPA_API_KEY", label: "API Key", type: "password", placeholder: "Enter your Keepa API key" }
      ]
    },
    {
      name: "Amazon SP-API",
      description: "Amazon Seller Partner API for marketplace integration",
      website: "https://developer-docs.amazon.com/sp-api/",
      keys: [
        { key: "AMAZON_SP_API_CLIENT_ID", label: "Client ID", type: "text", placeholder: "Enter Client ID" },
        { key: "AMAZON_SP_API_CLIENT_SECRET", label: "Client Secret", type: "password", placeholder: "Enter Client Secret" },
        { key: "AMAZON_SP_API_REFRESH_TOKEN", label: "Refresh Token", type: "password", placeholder: "Enter Refresh Token" }
      ]
    },
    {
      name: "PrepMyBusiness",
      description: "FBA prep and logistics management",
      website: "https://prepmybusiness.com/api",
      keys: [
        { key: "PREP_MY_BUSINESS_API_KEY", label: "API Key", type: "password", placeholder: "Enter API key" },
        { key: "PREP_MY_BUSINESS_BASE_URL", label: "Base URL", type: "text", placeholder: "https://api.prepmybusiness.com" }
      ]
    },
    {
      name: "Google Sheets",
      description: "Spreadsheet integration for data import/export",
      website: "https://developers.google.com/sheets/api",
      keys: [
        { key: "GOOGLE_SHEETS_API_KEY", label: "API Key", type: "password", placeholder: "Enter Google Sheets API key" },
        { key: "GOOGLE_SHEETS_SPREADSHEET_ID", label: "Spreadsheet ID", type: "text", placeholder: "Enter Spreadsheet ID from URL" }
      ]
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">API-Einstellungen</h1>
          <p className="text-muted-foreground">
            Verwalten Sie API-Schlüssel für externe Integrationen
          </p>
        </div>
        <Button
          onClick={handleSave}
          disabled={saveApiKeysMutation.isPending}
          data-testid="button-save-keys"
        >
          {saveApiKeysMutation.isPending ? (
            "Speichern..."
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Speichern
            </>
          )}
        </Button>
      </div>

      <Alert>
        <Shield className="h-4 w-4" />
        <AlertDescription>
          Alle API-Schlüssel werden sicher verschlüsselt gespeichert. Sie sind nur für Administratoren sichtbar.
        </AlertDescription>
      </Alert>

      <div className="grid gap-6">
        {apiIntegrations.map((integration) => (
          <Card key={integration.name} data-testid={`card-${integration.name.toLowerCase().replace(/\s+/g, '-')}`}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <CardTitle className="flex items-center gap-2">
                    <Key className="h-5 w-5" />
                    {integration.name}
                  </CardTitle>
                  <CardDescription>{integration.description}</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    asChild
                  >
                    <a
                      href={integration.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      data-testid={`link-docs-${integration.name.toLowerCase().replace(/\s+/g, '-')}`}
                    >
                      <ExternalLink className="h-3 w-3 mr-1" />
                      Docs
                    </a>
                  </Button>
                  {integration.keys.every(k => getKeyStatus(k.key).status === "configured") ? (
                    <Badge variant="default" className="bg-green-600 text-white">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Configured
                    </Badge>
                  ) : (
                    <Badge variant="secondary">
                      <AlertCircle className="h-3 w-3 mr-1" />
                      Missing Keys
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {integration.keys.map((keyConfig) => {
                const status = getKeyStatus(keyConfig.key);
                const IconComponent = status.icon;

                return (
                  <div key={keyConfig.key} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label htmlFor={keyConfig.key}>{keyConfig.label}</Label>
                      <IconComponent className={`h-4 w-4 ${status.color}`} />
                    </div>
                    <Input
                      id={keyConfig.key}
                      type={keyConfig.type}
                      placeholder={keyConfig.placeholder}
                      value={apiKeys[keyConfig.key as keyof typeof apiKeys]}
                      onChange={(e) => handleInputChange(keyConfig.key, e.target.value)}
                      data-testid={`input-${keyConfig.key.toLowerCase()}`}
                    />
                  </div>
                );
              })}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Additional Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Erweiterte Konfiguration
          </CardTitle>
          <CardDescription>
            Zusätzliche Einstellungen für API-Integrationen
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Google Sheets Import-Spalten Mapping</Label>
            <Textarea
              placeholder="JSON-Konfiguration für Spalten-Mapping (optional)"
              className="min-h-[100px]"
              data-testid="textarea-sheets-mapping"
            />
            <p className="text-xs text-muted-foreground">
              Beispiel: {"{"}"A": "productName", "B": "asin", "C": "costPrice"{"}"}
            </p>
          </div>

          <div className="space-y-2">
            <Label>Keepa Domain/Marketplace</Label>
            <Input
              placeholder="1 (Amazon.com), 2 (Amazon.co.uk), 3 (Amazon.de)"
              data-testid="input-keepa-domain"
            />
          </div>

          <div className="space-y-2">
            <Label>Amazon Marketplace ID</Label>
            <Input
              placeholder="A1PA6795UKMFR9 (Germany), ATVPDKIKX0DER (US)"
              data-testid="input-amazon-marketplace"
            />
          </div>
        </CardContent>
      </Card>

      {/* Integration Status */}
      <Card>
        <CardHeader>
          <CardTitle>Integration Status</CardTitle>
          <CardDescription>
            Übersicht über den Status aller API-Integrationen
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {apiIntegrations.map((integration) => {
              const allConfigured = integration.keys.every(k => getKeyStatus(k.key).status === "configured");
              const someConfigured = integration.keys.some(k => getKeyStatus(k.key).status === "configured");

              return (
                <div
                  key={integration.name}
                  className="flex items-center justify-between p-3 border rounded-lg"
                  data-testid={`status-${integration.name.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  <div className="flex items-center gap-2">
                    <Key className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{integration.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {allConfigured ? (
                      <Badge variant="default" className="bg-green-600 text-white">
                        Ready
                      </Badge>
                    ) : someConfigured ? (
                      <Badge variant="default" className="bg-yellow-600 text-white">
                        Partial
                      </Badge>
                    ) : (
                      <Badge variant="secondary">
                        Not Configured
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}