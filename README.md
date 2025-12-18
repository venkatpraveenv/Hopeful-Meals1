## Food Rescue – Web Application

Food Rescue is a lightweight web application designed to **reduce food waste** by connecting **supermarkets, restaurants, and farms (donors)** with **local charities** and **volunteer drivers**.  
This version is a front-end–only prototype that runs entirely in the browser and persists data using `localStorage`.

### Features

- **Donors**
  - Create surplus food listings with details (type, quantity, expiry, pickup window, location).
  - See the status of each listing (Available, Claimed, Driver Assigned, Completed, Cancelled).
- **Charities**
  - Browse all **Available** listings.
  - Claim listings and mark that the charity will receive the food.
- **Volunteer Drivers**
  - See listings that have been claimed by a charity but still need a driver.
  - Volunteer to deliver and update delivery status to **Completed**.
- **Shared**
  - All actions update a single, shared list on the page.
  - State is saved in `localStorage` so reloading the page preserves current data.

### Tech Stack

- **HTML5** for structure
- **Modern CSS** (flexbox, responsive layout, CSS variables) for a clean, accessible UI
- **Vanilla JavaScript** (no frameworks) for application logic and state management

### Getting Started

1. Open the project folder:

   - `C:\Users\VENKAT PRAVEEN V\OneDrive\Documents\IDTL 2.0`

2. Locate the `index.html` file.

3. Open `index.html` in a modern browser:

   - Right-click `index.html` → **Open with** → choose your browser (Chrome, Edge, Firefox, etc.).

No build step, server, or installation is required.

### Usage Guide

- **Donor flow**
  1. In the **Donor – Create Listing** panel, fill in the form (donor name, organization, food details, expiry, pickup window, location).
  2. Click **Create Listing**.
  3. The listing appears in the **All Listings** section with status **Available**.

- **Charity flow**
  1. In the **Charity – Claim Food** panel, see the list of **Available** listings.
  2. Click **Claim** on a listing and enter the charity name and contact.
  3. The listing status changes to **Claimed (Awaiting Driver)** and appears under the charity and driver views.

- **Driver flow**
  1. In the **Volunteer Driver – Deliveries** panel, view listings with status **Claimed (Awaiting Driver)**.
  2. Click **Volunteer to Deliver**, fill in your name and contact, and confirm.
  3. The listing status becomes **Driver Assigned**.
  4. After the delivery is complete, click **Mark as Delivered** to set status to **Completed**.

### Data & Limitations

- All data is stored **locally** in your browser using `localStorage`.
  - Clearing site data or switching browsers will clear listings.
  - There is no real multi-user backend; it’s a single-device prototype suitable for demos.

To turn this into a production multi-user system, you can plug the UI into a backend API (Node/Express, Django, etc.) with a database (PostgreSQL, MongoDB, etc.) and add authentication for each role.


