import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <div className="flex items-center justify-center space-x-3 mb-6">
            <div className="flex items-center justify-center w-16 h-16 bg-primary rounded-xl">
              <i className="fas fa-box text-primary-foreground text-2xl"></i>
            </div>
            <h1 className="text-4xl font-bold text-foreground">ResellerPro</h1>
          </div>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Die umfassende Amazon-Reselling-Management-Plattform für effiziente Deal-Bewertung, 
            Einkaufsplanung und SKU-Management.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          <Card>
            <CardContent className="p-6 text-center">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <i className="fas fa-handshake text-blue-600 text-xl"></i>
              </div>
              <h3 className="text-lg font-semibold mb-2">Deal-Management</h3>
              <p className="text-muted-foreground">
                Effiziente Erfassung und Bewertung von Produktdeals durch VAs und Admins.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 text-center">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <i className="fas fa-shopping-cart text-green-600 text-xl"></i>
              </div>
              <h3 className="text-lg font-semibold mb-2">Einkaufsplanung</h3>
              <p className="text-muted-foreground">
                Automatisierte Budgetplanung und Volumenberechnung für genehmigte Deals.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 text-center">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <i className="fas fa-barcode text-purple-600 text-xl"></i>
              </div>
              <h3 className="text-lg font-semibold mb-2">SKU-Generation</h3>
              <p className="text-muted-foreground">
                Automatische SKU-Erstellung mit direkter Amazon- und PrepMyBusiness-Integration.
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="text-center">
          <Button 
            size="lg" 
            className="px-8 py-4 text-lg"
            onClick={() => window.location.href = '/api/login'}
            data-testid="button-login"
          >
            <i className="fas fa-sign-in-alt mr-2"></i>
            Jetzt anmelden
          </Button>
        </div>
      </div>
    </div>
  );
}
