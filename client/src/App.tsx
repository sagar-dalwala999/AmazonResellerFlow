import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { useAuth } from "@/hooks/useAuth";
import Landing from "@/pages/landing";
import Dashboard from "@/pages/dashboard";
import SourcingInbox from "@/pages/sourcing-inbox";
import PurchasingPlanner from "@/pages/purchasing-planner";
import ListingBuilder from "@/pages/listing-builder";
import VAPerformance from "@/pages/va-performance";
import DealSubmission from "@/pages/deal-submission";
import DealEvaluation from "@/pages/deal-evaluation";
import Purchasing from "@/pages/purchasing";
import SkuManagement from "@/pages/sku-management";
import NotFound from "@/pages/not-found";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <Switch>
      {!isAuthenticated ? (
        <Route path="/" component={Landing} />
      ) : (
        <>
          <Route path="/" component={Dashboard} />
          <Route path="/sourcing" component={SourcingInbox} />
          <Route path="/purchasing" component={PurchasingPlanner} />
          <Route path="/listings" component={ListingBuilder} />
          <Route path="/performance" component={VAPerformance} />
          <Route path="/deals/submit" component={DealSubmission} />
          <Route path="/deals/evaluate" component={DealEvaluation} />
          <Route path="/legacy/purchasing" component={Purchasing} />
          <Route path="/legacy/sku-management" component={SkuManagement} />
        </>
      )}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Toaster />
      <Router />
    </QueryClientProvider>
  );
}

export default App;
