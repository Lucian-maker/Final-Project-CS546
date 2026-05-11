# NYCHCom - NYC Housing Compliance

CS546 Group 24 final project.
Real-time violation tracking, compliance
alerts, and legal resource navigator for NYC tenants, landlords, and admins.

# Github Reposity: https://github.com/Lucian-maker/Final-Project-CS546

## Project Setup

- All project files are located in /Final-Project-CS546, including seed.js. 

```bash
npm install
npm run seed
npm start
```

- Server runs on http://localhost:3000.

## Test Logins

- Included in seed.js, listed here for convenience. 

| Role      | Email                   | Password      |
|-----------|-------------------------|---------------|
| Admin     | admin@nychcom.test      | AdminPass1!   |
| Tenant    | tenant@nychcom.test     | TenantPass1!  |
| Landlord  | landlord@nychcom.test   | LandlordPass1!|


## Features

### Admin, Tenant, and Landlord Roles 
-- Admin -- 
- Specialized admin control menu. 
- User management privileges (change name, role, etc). 
- View system-wise analytics.
- View, filter, and export system logs.

-- Tenant -- 
- Specialized Tenant Dashboard.
- View current tenant rating. 
- View saved properties 

-- Landlord -- 
- Specialized Landlord Dashboard. 
- View current landlord trust core. 
- View owned properties. 
- View saved properties. 

### Dashboard 
- Every role has a unique tile for access to their dashboard. 
- Search violations. 
- View pending & active violations by different due dates. 

-- Explore --
- Open properties menu 
- Open violations menu 
- View evidence vault
- View your reviews & comments 
- Open notifications menu
- Open disputes menu 
- Open tickets menu 
- View attorney information 

-- Community Insights -- 
- View the highest rated property.
- View the most reviewed property.
- View the most discussed property. 

### Notifications
- Accessible both through the dashboard and the main top bar. 
- Notifications appear in the main top bar if there are unreads. 
- Text popups also appear for notifications.
- Notifications can be cleared individually.
- All notifications can be marked as read at once.

### Evidence Vault 
- Users can filter evidence by violation id, property id, evidence type, and keywords. 
- Users can upload evidence to a chosen violation id. 
- Shown evidence is based on owned and/or saved properties for tenants/landlords.
- Admins can see all evidence. 
- You can only delete your own evidence if you are a tenant or a landlord. 
- Admins can delete any evidence. 

### Rating & Comments
- Tenants receive a 'tenant rating' score out of 5 stars in their tenant dashboard. 
- Landlords receive a 'trust score' out of 5 stars in their landlord dashboard. 
- Any user can leave a comment and/or review on a property. 
- Any user can view comments and reviews on properties. 
- Highest rated, most reviewed, and most discussed community insights are generated.
- Property ratings are computed from the average of all ratings on a property. 
- Like or dislike comments and reviews. 

### Properties Pages
- Admins are the only users that can create properties. 
- All users can filter properties by many fields. 
- All properties are viewable by users.
- All users can view details of a specific property.
- Tenants and landlords can save properties. 
- Landlords can claim properties (if they own them). 
- List violations on file for the property. 

### Violations Pages
- Any user can create a violation. 
- Any user can filter their violations by many fields. 
- Tenants can only see saved properties violations. 
- Landlords can only see saved or owned properties violations. 
- Admins can see all violations.
- All users can view details of their violations. 
- All users can update the status of their violations
- All users can file a dispute. 
- Violation details are exportable via a PDF report. 
- Status changes are updateable and recorded per violation. 

### Disputes
- Users can view their disputes via the dashboard. 
- Users can view specific details for a dispute
- Only admins can update disputes 

### Tickets 
- Users can view tickets menu via the dashboard. 
- All users can open a ticket. 
- Any user can view their own tickets. 
- Only admins can view all tickets. 
- Users can update their tickets (status or priority)
- Admins can update all tickets 
- All users can view information on their individual displayed tickets. 

### Attorneys - WIP 
- Attorneys menu is viewable from the dashboard. 
- Here you can view contact information for different attorneys. 

