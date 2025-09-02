import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

export default function Sidebar() {
  const { user } = useAuth();
  const currentPath = window.location.pathname;

  const navigationItems = [
    { href: '/', icon: 'fas fa-tachometer-alt', label: 'Dashboard', roles: ['admin', 'va'] },
    { href: '/sourcing', icon: 'fas fa-inbox', label: 'Sourcing Inbox', roles: ['admin', 'va'] },
    { href: '/purchasing', icon: 'fas fa-shopping-cart', label: 'Purchasing Planner', roles: ['admin'] },
    { href: '/listings', icon: 'fas fa-barcode', label: 'Listing Builder', roles: ['admin'] },
    { href: '/performance', icon: 'fas fa-chart-line', label: 'VA Performance', roles: ['admin', 'va'] },
  ];

  const filteredItems = navigationItems.filter(item => 
    !user?.role || item.roles.includes(user.role)
  );

  return (
    <aside className="hidden lg:flex lg:flex-shrink-0">
      <div className="flex flex-col w-64 bg-card border-r border-border">
        {/* Logo/Header */}
        <div className="flex items-center justify-between h-16 px-6 border-b border-border">
          <div className="flex items-center space-x-3">
            <div className="flex items-center justify-center w-8 h-8 bg-primary rounded-lg">
              <i className="fas fa-box text-primary-foreground text-sm"></i>
            </div>
            <span className="text-lg font-semibold text-foreground">ResellerPro</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-2">
          {filteredItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors",
                currentPath === item.href
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
              data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
            >
              <i className={`${item.icon} mr-3`}></i>
              {item.label}
            </a>
          ))}
        </nav>

        {/* User Profile */}
        <div className="px-4 py-4 border-t border-border">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
              <span className="text-xs font-medium text-primary-foreground">
                {user?.firstName?.[0] || '?'}{user?.lastName?.[0] || ''}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {user?.role === 'admin' ? 'Admin' : 'VA'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
