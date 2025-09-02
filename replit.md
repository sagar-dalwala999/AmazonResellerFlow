# Overview

ResellerPro is a comprehensive Amazon reselling management platform designed to streamline deal evaluation, purchasing planning, and SKU management. The application serves as a central hub for Virtual Assistants (VAs) and administrators to efficiently manage the entire product lifecycle from initial deal submission to final SKU generation and Amazon synchronization.

The platform features a role-based system where VAs can submit product deals for evaluation, while administrators review and approve deals, manage purchasing plans, and oversee SKU operations. The system tracks profit margins, manages inventory planning, and provides detailed analytics through an intuitive dashboard interface.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
The client-side application is built using React with TypeScript, utilizing a component-based architecture. The frontend leverages Vite as the build tool and development server, with Wouter for client-side routing. The UI is constructed using shadcn/ui components built on top of Radix UI primitives, providing a consistent and accessible design system. Styling is handled through Tailwind CSS with a custom design token system defined in CSS variables.

The application follows a page-based routing structure with protected routes based on user roles. State management is handled through TanStack Query for server state and React's built-in state management for local component state. The frontend communicates with the backend through a custom API client that handles authentication, error management, and request/response processing.

## Backend Architecture
The server-side is built on Express.js with TypeScript, following a modular architecture pattern. The application uses a three-layer architecture consisting of route handlers, business logic (storage layer), and database access. The server implements session-based authentication using Replit's OpenID Connect integration with PostgreSQL session storage.

API routes are organized by feature domains (deals, products, purchasing, etc.) and implement proper error handling and validation. The backend uses Zod for request/response validation and provides comprehensive logging for debugging and monitoring purposes.

## Database Design
The application uses PostgreSQL as the primary database with Drizzle ORM for type-safe database operations. The schema includes core entities for users, products, deals, purchasing plans, SKUs, and activity logging. The database design supports role-based access control with enum types for user roles and entity statuses.

Key relationships include products linked to deals through ASINs, deals connected to purchasing plans for volume planning, and comprehensive activity logging for audit trails. The schema supports both manual data entry and future integrations with external systems.

## Authentication & Authorization
Authentication is implemented using Replit's OpenID Connect provider with session-based state management. User sessions are stored in PostgreSQL using connect-pg-simple for persistence across server restarts. The system implements role-based authorization with admin and VA roles, controlling access to different features and API endpoints.

The authentication layer includes middleware for protected routes, user session management, and automatic token refresh handling. Authorization is enforced both at the API level and in the frontend UI to prevent unauthorized access to administrative features.

# External Dependencies

## Database Infrastructure
- **PostgreSQL**: Primary database using Neon serverless PostgreSQL for scalable data storage
- **Drizzle ORM**: Type-safe database operations with automatic migration support
- **connect-pg-simple**: PostgreSQL session store for Express sessions

## Authentication Services
- **Replit OpenID Connect**: Primary authentication provider for user management
- **Passport.js**: Authentication middleware with OpenID Connect strategy
- **Express Session**: Session management with PostgreSQL persistence

## UI Framework & Styling
- **React**: Frontend framework with TypeScript support
- **Radix UI**: Accessible component primitives for complex UI elements
- **shadcn/ui**: Pre-built component library with consistent design patterns
- **Tailwind CSS**: Utility-first CSS framework with custom design token system
- **Lucide React**: Icon library for consistent iconography

## Development & Build Tools
- **Vite**: Fast development server and build tool with React plugin support
- **ESBuild**: Fast bundler for server-side code compilation
- **TypeScript**: Type safety across the entire application stack
- **Replit Development Tools**: Cartographer plugin for enhanced development experience

## State Management & Data Fetching
- **TanStack Query**: Server state management with caching and synchronization
- **React Hook Form**: Form state management with validation support
- **Zod**: Runtime type validation for API requests and responses

## Future Integration Targets
- **Amazon APIs**: Product data synchronization and marketplace integration
- **Google Sheets**: Data import/export capabilities for deal management
- **PrepMyBusiness**: SKU synchronization and inventory management