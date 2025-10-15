# Screenshot Documentation Guide

This guide explains what screenshots to take and where to place them to showcase the voting app's features.

## 📁 Folder Structure

```
docs/
└── screenshots/
    ├── admin/          # Admin panel screenshots
    ├── user/           # User interface screenshots
    └── features/       # Feature-specific screenshots
```

## 📸 Screenshots to Take

### 1. Login & Authentication (`/docs/screenshots/user/`)

#### `login-page.png`
- **What to show**: The main login page
- **URL**: `http://192.168.0.174:3000`
- **Description**: Shows the clean login interface with username/password fields

#### `admin-login.png`
- **What to show**: Admin login page or admin login in action
- **URL**: `http://192.168.0.174:3000` (with admin credentials)
- **Description**: Demonstrates admin access to the system

### 2. User Experience (`/docs/screenshots/user/`)

#### `user-dashboard.png`
- **What to show**: User's main dashboard when logged in
- **Description**: Shows the voting interface from a regular user's perspective

#### `voting-interface.png`
- **What to show**: Active voting page with options to select
- **Description**: Demonstrates the clean, intuitive voting interface

#### `vote-confirmation.png`
- **What to show**: Success message after submitting a vote
- **Description**: Shows feedback to users after successful vote submission

#### `waiting-for-results.png`
- **What to show**: User view when vote is ended, showing results
- **Description**: User's view of voting results (if applicable)

### 3. Admin Panel (`/docs/screenshots/admin/`)

#### `admin-dashboard.png`
- **What to show**: Main admin dashboard with statistics
- **Description**: Overview of the admin panel with key metrics and navigation

#### `create-vote-form.png`
- **What to show**: The "Start Vote" tab with the vote creation form
- **Description**: Shows how admins create new votes with options and settings

#### `vote-creation-options.png`
- **What to show**: Vote creation form with multiple options added and anonymous checkbox
- **Description**: Demonstrates setting up vote options and anonymous voting feature

#### `real-time-monitoring.png`
- **What to show**: Admin dashboard during active voting showing real-time progress
- **Description**: Live monitoring of voting progress with user statistics

#### `user-management.png`
- **What to show**: User Management tab with list of users and actions
- **Description**: Shows admin capability to manage users, add/remove accounts

#### `add-user-form.png`
- **What to show**: The add user form in the User Management section
- **Description**: Demonstrates how admins can add new users to the system

### 4. Results & Features (`/docs/screenshots/features/`)

#### `results-anonymous.png`
- **What to show**: Results page for an anonymous vote (only showing vote counts)
- **Description**: Demonstrates anonymous voting results - only numbers, no voter names

#### `results-with-names.png`
- **What to show**: Results page for a non-anonymous vote showing voter names
- **Description**: Shows detailed results with voter names displayed as tags below vote counts

#### `vote-history.png`
- **What to show**: Historical votes tab with past voting data
- **Description**: Demonstrates the historical data viewing and export capabilities

#### `vote-details-popup.png`
- **What to show**: Detailed view of a specific vote from history
- **Description**: Shows comprehensive vote details including participation and results

#### `export-options.png`
- **What to show**: Export buttons (JSON/CSV) in action
- **Description**: Demonstrates data export functionality

#### `responsive-mobile.png`
- **What to show**: The application running on a mobile device or narrow window
- **Description**: Shows responsive design working on mobile devices

### 5. Technical Features (`/docs/screenshots/features/`)

#### `docker-startup.png`
- **What to show**: Terminal showing `docker-compose up --build` command and startup
- **Description**: Shows the simple deployment process

#### `network-access.png`
- **What to show**: Application accessed via IP address (192.168.0.174:3000)
- **Description**: Demonstrates LAN access capability

#### `real-time-updates.png`
- **What to show**: Multiple browser windows showing real-time vote updates
- **Description**: Shows WebSocket real-time functionality

## 📝 Screenshot Guidelines

### Quality Standards:
- **Resolution**: Minimum 1920x1080 for desktop screenshots
- **Format**: PNG preferred for UI screenshots
- **Content**: Include browser address bar to show URLs
- **Clean**: Hide personal information, use test data

### What to Include:
- **Full browser window** (including URL bar)
- **Relevant UI elements** clearly visible
- **Test data** that demonstrates functionality
- **Multiple states** when showing interactions

### What to Avoid:
- **Personal information** or real user data
- **Blurry or low-quality** images  
- **Cropped screenshots** that miss important context
- **Empty states** unless specifically documenting them

### Naming Convention:
- Use **kebab-case** (lowercase with hyphens)
- Be **descriptive** but concise
- Include **version numbers** if taking multiple shots of same feature

### Example Screenshot Session:

1. **Start the application**: `docker-compose up --build`
2. **Open multiple browser windows/tabs**
3. **Log in as admin** in one window
4. **Log in as users** in other windows  
5. **Create a vote** and document the process
6. **Have users vote** and capture real-time updates
7. **View results** in both anonymous and named modes
8. **Explore admin features** systematically
9. **Test mobile responsiveness**
10. **Document export functionality**

## 🎯 Key Features to Highlight

Make sure screenshots demonstrate:
- ✅ **Easy deployment** with Docker
- ✅ **Clean, modern UI** design
- ✅ **Real-time updates** and interactivity
- ✅ **Anonymous vs named voting** distinction
- ✅ **Comprehensive admin panel**
- ✅ **User management** capabilities
- ✅ **Historical data** and export features
- ✅ **Mobile responsiveness**
- ✅ **Network accessibility**
- ✅ **Security features** (login system)

After taking screenshots, place them in the appropriate folders and update the main README.md to reference them!
