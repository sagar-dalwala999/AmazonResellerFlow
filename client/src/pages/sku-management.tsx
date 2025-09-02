import Sidebar from "@/components/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function SkuManagement() {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Header */}
        <header className="bg-card border-b border-border">
          <div className="flex items-center justify-between h-16 px-6">
            <h1 className="text-xl font-semibold text-foreground">SKU Management</h1>
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
          <Card>
            <CardHeader>
              <CardTitle>SKU Management</CardTitle>
            </CardHeader>
            <CardContent className="p-8 text-center">
              <i className="fas fa-barcode text-4xl text-muted-foreground mb-4"></i>
              <h3 className="text-lg font-semibold text-foreground mb-2">SKU Management in Entwicklung</h3>
              <p className="text-muted-foreground mb-6">
                Das SKU Management System wird in einer zukünftigen Version verfügbar sein.
                Hier können Sie SKUs generieren und die Synchronisation mit Amazon und PrepMyBusiness verwalten.
              </p>
              <Button onClick={() => window.location.href = '/'}>
                Zurück zum Dashboard
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
}
