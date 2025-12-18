// Food Rescue – role-based front-end logic (vanilla JS, local only)

const STORAGE_KEYS = {
  LISTINGS: "food-rescue:listings:v2",
  USERS: "food-rescue:users:v1",
  SESSION: "food-rescue:session:v1",
};

const LISTING_STATUS = {
  AVAILABLE: "AVAILABLE",
  CLAIMED: "CLAIMED",
};

let state = {
  currentUser: null,
  users: [],
  listings: [],
};

// Utilities --------------------------------------------------------
function generateId(prefix = "L") {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function loadJson(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function saveJson(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

function showToast(message) {
  const toast = document.getElementById("toast");
  toast.innerHTML = `<span class="toast-dot"></span><span>${message}</span>`;
  toast.classList.add("visible");
  clearTimeout(showToast._timeout);
  showToast._timeout = setTimeout(() => {
    toast.classList.remove("visible");
  }, 2200);
}

function minutesSince(timestamp) {
  return (Date.now() - timestamp) / (1000 * 60);
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString();
  } catch {
    return dateStr;
  }
}

// Auth + view switching ---------------------------------------------
function setCurrentUser(user) {
  state.currentUser = user;
  saveJson(STORAGE_KEYS.SESSION, user);

  const indicator = document.getElementById("user-indicator");
  if (user) {
    indicator.textContent = `${user.name} (${user.role === "DONOR" ? "Donor" : "Charity"})`;
  } else {
    indicator.textContent = "Guest";
  }
}

function switchView(id) {
  document.querySelectorAll(".view").forEach((v) => v.classList.remove("view--active"));
  const target = document.getElementById(id);
  if (target) target.classList.add("view--active");
}

// Stats line + home snapshot ---------------------------------------
function refreshStats() {
  const statsLine = document.getElementById("stats-line");
  const homeStat = document.getElementById("home-stat-line");

  const total = state.listings.length;
  const available = state.listings.filter((l) => l.status === LISTING_STATUS.AVAILABLE).length;
  const claimed = state.listings.filter((l) => l.status === LISTING_STATUS.CLAIMED).length;

  const text = `Available: ${available} · Claimed: ${claimed} · Total listings: ${total}`;
  if (statsLine) statsLine.textContent = text;
  if (homeStat)
    homeStat.textContent =
      available === 0
        ? "No meals waiting right now. Be the first to create a listing."
        : `${available} surplus donation${available === 1 ? "" : "s"} waiting to be rescued.`;
}

// Rendering helpers ------------------------------------------------
function canDeleteListingNow(listing, userId) {
  if (!state.currentUser || state.currentUser.role !== "DONOR") return false;
  if (listing.createdByUserId !== userId) return false;
  if (listing.status !== LISTING_STATUS.AVAILABLE) return false;
  return minutesSince(listing.createdAt) <= 10;
}

function baseCardHtml(listing) {
  return `
    <div class="listing-title">${listing.foodDescription}</div>
    <div class="listing-meta-row">
      <span class="pill">Donor: ${listing.donorName}</span>
      <span class="pill pill-soft">${listing.donorType}</span>
      <span class="pill pill-soft">${listing.quantity}</span>
    </div>
    <div class="listing-meta-row">
      <span class="small-label">Pickup</span>
      <span class="small-value">${listing.pickupWindow} · ${listing.location}</span>
    </div>
    <div class="listing-meta-row">
      <span class="small-label">Safe until</span>
      <span class="small-value">${formatDate(listing.expiryDate)}</span>
    </div>
    ${
      listing.notes
        ? `<div class="listing-meta-row"><span class="small-label">Notes</span><span class="small-value">${listing.notes}</span></div>`
        : ""
    }
  `;
}

function renderDonorHistory() {
  if (!state.currentUser || state.currentUser.role !== "DONOR") return;
  const userId = state.currentUser.id;
  const container = document.getElementById("donor-history-container");
  const empty = document.getElementById("donor-history-empty");

  container.innerHTML = "";
  const items = state.listings
    .filter((l) => l.createdByUserId === userId)
    .slice()
    .sort((a, b) => b.createdAt - a.createdAt);

  if (items.length === 0) {
    empty.style.display = "block";
    return;
  }
  empty.style.display = "none";

  items.forEach((listing) => {
    const card = document.createElement("article");
    card.className = "listing-card";
    card.dataset.id = listing.id;

    const main = document.createElement("div");
    main.className = "listing-main";
    main.innerHTML = baseCardHtml(listing);

    if (listing.imageDataUrl) {
      const img = document.createElement("img");
      img.src = listing.imageDataUrl;
      img.alt = "Donation photo";
      img.style.maxWidth = "100%";
      img.style.borderRadius = "8px";
      img.style.marginTop = "4px";
      img.style.maxHeight = "130px";
      img.style.objectFit = "cover";
      main.appendChild(img);
    }

    const secondary = document.createElement("div");
    secondary.className = "listing-secondary";

    const roles = document.createElement("div");
    roles.className = "listing-roles";
    roles.innerHTML = `
      <span><span class="small-label">Status</span> · <span class="small-value">${
        listing.status === LISTING_STATUS.AVAILABLE ? "Available" : "Claimed"
      }</span></span>
      <span><span class="small-label">Charity</span> · <span class="small-value">${
        listing.charityName || "Not yet claimed"
      }</span></span>
    `;

    const actions = document.createElement("div");
    actions.className = "listing-actions";

    if (canDeleteListingNow(listing, userId)) {
      const del = document.createElement("button");
      del.className = "btn btn-danger btn-small";
      del.textContent = "Delete (within 10 min)";
      del.addEventListener("click", () => deleteListing(listing.id));
      actions.appendChild(del);
    }

    if (listing.status === LISTING_STATUS.CLAIMED && listing.charityUserId) {
      const claimedBtn = document.createElement("button");
      claimedBtn.className = "btn btn-outline btn-small";
      claimedBtn.textContent = listing.donorClaimAck ? "Claimed ✓" : "Mark as claimed";
      claimedBtn.disabled = !!listing.donorClaimAck;
      claimedBtn.addEventListener("click", () => markClaimedAck(listing.id, "DONOR"));
      actions.appendChild(claimedBtn);

      const chat = createChatBox(listing);
      secondary.appendChild(chat);
    }

    secondary.appendChild(roles);
    secondary.appendChild(actions);

    card.appendChild(main);
    card.appendChild(secondary);
    container.appendChild(card);
  });
}

function renderDonorAvailableFromOthers() {
  if (!state.currentUser || state.currentUser.role !== "DONOR") return;
  const userId = state.currentUser.id;
  const container = document.getElementById("donor-available-container");
  const empty = document.getElementById("donor-available-empty");

  container.innerHTML = "";
  const items = state.listings
    .filter((l) => l.status === LISTING_STATUS.AVAILABLE && l.createdByUserId !== userId)
    .slice()
    .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));

  if (items.length === 0) {
    empty.style.display = "block";
    return;
  }
  empty.style.display = "none";

  items.forEach((listing) => {
    const card = document.createElement("article");
    card.className = "listing-card";
    card.dataset.id = listing.id;

    const main = document.createElement("div");
    main.className = "listing-main";
    main.innerHTML = baseCardHtml(listing);

    const secondary = document.createElement("div");
    secondary.className = "listing-secondary";
    const roles = document.createElement("div");
    roles.className = "listing-roles";
    roles.innerHTML = `
      <span><span class="small-label">Status</span> · <span class="small-value">Available</span></span>
      <span><span class="small-label">Charity</span> · <span class="small-value">${
        listing.charityName || "Not yet claimed"
      }</span></span>
    `;
    const actions = document.createElement("div");
    actions.className = "listing-actions";
    const note = document.createElement("span");
    note.className = "hint";
    note.textContent = "Viewing only – donors cannot claim listings.";
    actions.appendChild(note);
    secondary.appendChild(roles);
    secondary.appendChild(actions);

    card.appendChild(main);
    card.appendChild(secondary);
    container.appendChild(card);
  });
}

function renderCharityAvailable() {
  if (!state.currentUser || state.currentUser.role !== "CHARITY") return;
  const searchInput = document.getElementById("charity-search");
  const query = (searchInput.value || "").toLowerCase().trim();
  const container = document.getElementById("charity-available-container");
  const empty = document.getElementById("charity-available-empty");

  container.innerHTML = "";
  let items = state.listings.filter((l) => l.status === LISTING_STATUS.AVAILABLE);
  if (query) {
    items = items.filter((l) => {
      const text = (
        l.foodDescription +
        " " +
        l.donorName +
        " " +
        l.location +
        " " +
        (l.notes || "")
      )
        .toLowerCase()
        .trim();
      return text.includes(query);
    });
  }

  if (items.length === 0) {
    empty.style.display = "block";
    return;
  }
  empty.style.display = "none";

  items
    .slice()
    .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate))
    .forEach((listing) => {
      const card = document.createElement("article");
      card.className = "listing-card";

      const main = document.createElement("div");
      main.className = "listing-main";
      main.innerHTML = baseCardHtml(listing);

      if (listing.imageDataUrl) {
        const img = document.createElement("img");
        img.src = listing.imageDataUrl;
        img.alt = "Donation photo";
        img.style.maxWidth = "100%";
        img.style.borderRadius = "8px";
        img.style.marginTop = "4px";
        img.style.maxHeight = "130px";
        img.style.objectFit = "cover";
        main.appendChild(img);
      }

      const secondary = document.createElement("div");
      secondary.className = "listing-secondary";
      const roles = document.createElement("div");
      roles.className = "listing-roles";
      roles.innerHTML = `
        <span><span class="small-label">Donor</span> · <span class="small-value">${
          listing.donorName
        }</span></span>
        <span><span class="small-label">Status</span> · <span class="small-value">Available</span></span>
      `;

      const actions = document.createElement("div");
      actions.className = "listing-actions";
      const btn = document.createElement("button");
      btn.className = "btn btn-primary btn-small";
      btn.textContent = "Claim this listing";
      btn.addEventListener("click", () => claimListingAsCharity(listing.id));
      actions.appendChild(btn);

      secondary.appendChild(roles);
      secondary.appendChild(actions);
      card.appendChild(main);
      card.appendChild(secondary);
      container.appendChild(card);
    });
}

function renderCharityClaimed() {
  if (!state.currentUser || state.currentUser.role !== "CHARITY") return;
  const userId = state.currentUser.id;
  const container = document.getElementById("charity-claimed-container");
  const empty = document.getElementById("charity-claimed-empty");

  container.innerHTML = "";
  const items = state.listings
    .filter((l) => l.charityUserId === userId)
    .slice()
    .sort((a, b) => b.claimedAt - a.claimedAt);

  if (items.length === 0) {
    empty.style.display = "block";
    return;
  }
  empty.style.display = "none";

  items.forEach((listing) => {
    const card = document.createElement("article");
    card.className = "listing-card";

    const main = document.createElement("div");
    main.className = "listing-main";
    main.innerHTML = baseCardHtml(listing);

    const secondary = document.createElement("div");
    secondary.className = "listing-secondary";
    const roles = document.createElement("div");
    roles.className = "listing-roles";
    roles.innerHTML = `
      <span><span class="small-label">Donor</span> · <span class="small-value">${
        listing.donorName
      }</span></span>
      <span><span class="small-label">Status</span> · <span class="small-value">Claimed</span></span>
    `;

    const actions = document.createElement("div");
    actions.className = "listing-actions";
    const claimedBtn = document.createElement("button");
    claimedBtn.className = "btn btn-outline btn-small";
    claimedBtn.textContent = listing.charityClaimAck ? "Claimed ✓" : "Mark as claimed";
    claimedBtn.disabled = !!listing.charityClaimAck;
    claimedBtn.addEventListener("click", () => markClaimedAck(listing.id, "CHARITY"));
    actions.appendChild(claimedBtn);

    const chat = createChatBox(listing);
    secondary.appendChild(roles);
    secondary.appendChild(actions);
    secondary.appendChild(chat);

    card.appendChild(main);
    card.appendChild(secondary);
    container.appendChild(card);
  });
}

// Chat box shared between donor & charity --------------------------
function createChatBox(listing) {
  const box = document.createElement("div");
  box.className = "chat-box";

  const title = document.createElement("p");
  title.className = "small-label";
  title.textContent = "Donor ↔ Charity chat";
  box.appendChild(title);

  const messagesEl = document.createElement("div");
  messagesEl.className = "chat-messages";
  (listing.chat || []).forEach((msg) => {
    const row = document.createElement("div");
    row.className = "chat-message";
    const who =
      msg.senderRole === "DONOR"
        ? `Donor (${msg.senderName})`
        : `Charity (${msg.senderName})`;
    const meta = document.createElement("span");
    meta.className = "chat-meta";
    const time = new Date(msg.timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
    meta.textContent = `${who} • ${time}`;
    const body = document.createElement("span");
    body.textContent = msg.text;
    row.appendChild(meta);
    row.appendChild(body);
    messagesEl.appendChild(row);
  });
  box.appendChild(messagesEl);

  const inputRow = document.createElement("div");
  inputRow.className = "chat-input-row";
  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = "Type a message…";
  const sendBtn = document.createElement("button");
  sendBtn.className = "btn btn-secondary btn-small";
  sendBtn.textContent = "Send";
  sendBtn.addEventListener("click", () => {
    const text = input.value.trim();
    if (!text || !state.currentUser) return;
    addChatMessage(listing.id, text);
    input.value = "";
  });
  inputRow.appendChild(input);
  inputRow.appendChild(sendBtn);
  box.appendChild(inputRow);

  return box;
}

// Actions ----------------------------------------------------------
function deleteListing(id) {
  const idx = state.listings.findIndex((l) => l.id === id);
  if (idx === -1) return;
  const sure = window.confirm("Delete this listing? This cannot be undone.");
  if (!sure) return;
  state.listings.splice(idx, 1);
  saveJson(STORAGE_KEYS.LISTINGS, state.listings);
  renderAllForCurrentUser();
  refreshStats();
  showToast("Listing deleted.");
}

function claimListingAsCharity(id) {
  if (!state.currentUser || state.currentUser.role !== "CHARITY") {
    showToast("Login as a charity to claim listings.");
    return;
  }
  const listing = state.listings.find((l) => l.id === id);
  if (!listing || listing.status !== LISTING_STATUS.AVAILABLE) return;

  listing.status = LISTING_STATUS.CLAIMED;
  listing.charityUserId = state.currentUser.id;
  listing.charityName = state.currentUser.name;
  listing.claimedAt = Date.now();
  listing.chat = listing.chat || [];

  saveJson(STORAGE_KEYS.LISTINGS, state.listings);
  renderAllForCurrentUser();
  refreshStats();
  showToast("Listing claimed successfully.");
}

function markClaimedAck(id, role) {
  const listing = state.listings.find((l) => l.id === id);
  if (!listing) return;
  if (role === "DONOR") {
    listing.donorClaimAck = true;
  } else {
    listing.charityClaimAck = true;
  }
  saveJson(STORAGE_KEYS.LISTINGS, state.listings);
  renderAllForCurrentUser();
  const both = listing.donorClaimAck && listing.charityClaimAck;
  showToast(both ? "Both sides confirmed. Booking marked as fully claimed." : "Claim confirmed.");
}

function addChatMessage(listingId, text) {
  const listing = state.listings.find((l) => l.id === listingId);
  if (!listing || !state.currentUser) return;
  listing.chat = listing.chat || [];
  listing.chat.push({
    id: generateId("M"),
    senderUserId: state.currentUser.id,
    senderName: state.currentUser.name,
    senderRole: state.currentUser.role,
    text,
    timestamp: Date.now(),
  });
  saveJson(STORAGE_KEYS.LISTINGS, state.listings);
  renderAllForCurrentUser();
}

// Form handling ----------------------------------------------------
function handleLoginSubmit(event) {
  event.preventDefault();
  const nameEl = document.getElementById("loginName");
  const emailEl = document.getElementById("loginEmail");
  const passEl = document.getElementById("loginPassword");
  const name = nameEl.value.trim();
  const password = passEl.value.trim();
  if (!name || password.length < 4) {
    showToast("Please enter your name and a PIN of at least 4 characters.");
    return;
  }
  const email = emailEl.value.trim();

  // Store a lightweight user record; role is chosen next
  const existing = state.users.find(
    (u) => u.name === name && u.password === password && u.email === email
  );
  let user;
  if (existing) {
    user = existing;
  } else {
    user = {
      id: generateId("U"),
      name,
      email,
      password,
      role: null,
    };
    state.users.push(user);
    saveJson(STORAGE_KEYS.USERS, state.users);
  }

  // Temporarily store user without role
  setCurrentUser({ ...user, role: null });
  switchView("view-role");
}

function handleRoleSubmit(event) {
  event.preventDefault();
  if (!state.currentUser) return;
  const roleInput = document.querySelector('input[name="role"]:checked');
  if (!roleInput) {
    showToast("Please select a role to continue.");
    return;
  }
  const role = roleInput.value;

  // Persist role on user
  const userIdx = state.users.findIndex((u) => u.id === state.currentUser.id);
  if (userIdx !== -1) {
    state.users[userIdx].role = role;
    saveJson(STORAGE_KEYS.USERS, state.users);
  }

  setCurrentUser({ ...state.currentUser, role });
  if (role === "DONOR") {
    const welcome = document.getElementById("donor-welcome");
    if (welcome)
      welcome.textContent = `Welcome, ${state.currentUser.name}. Share surplus food safely and quickly.`;
    switchView("view-donor");
  } else {
    const welcome = document.getElementById("charity-welcome");
    if (welcome)
      welcome.textContent = `Welcome, ${state.currentUser.name}. Reserve donations that match your community's needs.`;
    switchView("view-charity");
  }
  renderAllForCurrentUser();
}

function handleLogout() {
  setCurrentUser(null);
  saveJson(STORAGE_KEYS.SESSION, null);
  switchView("view-home");
  renderAllForCurrentUser();
}

function handleDonorCreate(event) {
  event.preventDefault();
  if (!state.currentUser || state.currentUser.role !== "DONOR") {
    showToast("Login as a donor to create listings.");
    return;
  }

  const orgTypeEl = document.getElementById("donorOrgType");
  const titleEl = document.getElementById("donorFoodTitle");
  const qtyEl = document.getElementById("donorQuantity");
  const expiryEl = document.getElementById("donorExpiry");
  const pickupEl = document.getElementById("donorPickup");
  const locationEl = document.getElementById("donorLocation");
  const notesEl = document.getElementById("donorNotes");
  const imageEl = document.getElementById("donorImage");

  if (
    !orgTypeEl.value ||
    !titleEl.value.trim() ||
    !qtyEl.value.trim() ||
    !expiryEl.value ||
    !pickupEl.value.trim() ||
    !locationEl.value.trim()
  ) {
    showToast("Please fill in all required fields.");
    return;
  }

  const file = imageEl.files && imageEl.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = () => {
      createListingWithImage(reader.result);
    };
    reader.readAsDataURL(file);
  } else {
    createListingWithImage(null);
  }

  function createListingWithImage(imageDataUrl) {
    const listing = {
      id: generateId("L"),
      donorName: state.currentUser.name,
      donorType: orgTypeEl.value,
      donorUserId: state.currentUser.id,
      foodDescription: titleEl.value.trim(),
      quantity: qtyEl.value.trim(),
      expiryDate: expiryEl.value,
      pickupWindow: pickupEl.value.trim(),
      location: locationEl.value.trim(),
      notes: notesEl.value.trim(),
      imageDataUrl,
      createdByUserId: state.currentUser.id,
      createdAt: Date.now(),
      status: LISTING_STATUS.AVAILABLE,
      charityUserId: null,
      charityName: "",
      donorClaimAck: false,
      charityClaimAck: false,
      chat: [],
    };

    state.listings.push(listing);
    saveJson(STORAGE_KEYS.LISTINGS, state.listings);
    renderAllForCurrentUser();
    refreshStats();
    showToast("Listing created successfully.");
    event.target.reset();
  }
}

// Render dispatcher ------------------------------------------------
function renderAllForCurrentUser() {
  if (state.currentUser && state.currentUser.role === "DONOR") {
    renderDonorHistory();
    renderDonorAvailableFromOthers();
  }
  if (state.currentUser && state.currentUser.role === "CHARITY") {
    renderCharityAvailable();
    renderCharityClaimed();
  }
  refreshStats();
}

// Tabs & home buttons ----------------------------------------------
function initTabs() {
  document.querySelectorAll(".dashboard-tabs").forEach((tabsRoot) => {
    const tabs = tabsRoot.querySelectorAll(".dashboard-tab");
    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        const targetId = tab.getAttribute("data-target");
        const panelRoot = tabsRoot.parentElement;
        panelRoot.querySelectorAll(".dashboard-tab").forEach((t) =>
          t.classList.remove("dashboard-tab--active")
        );
        panelRoot.querySelectorAll(".dashboard-panel").forEach((p) =>
          p.classList.remove("dashboard-panel--active")
        );
        tab.classList.add("dashboard-tab--active");
        const panel = document.getElementById(targetId);
        if (panel) panel.classList.add("dashboard-panel--active");
      });
    });
  });
}

function initHomeButtons() {
  const btnOpenLogin = document.getElementById("btn-open-login");
  const btnSkip = document.getElementById("btn-skip-login");
  if (btnOpenLogin) {
    btnOpenLogin.addEventListener("click", () => {
      document.getElementById("loginName").focus();
    });
  }
  if (btnSkip) {
    btnSkip.addEventListener("click", () => {
      showToast("Browsing as guest. Login to create or claim listings.");
    });
  }
}

// Init -------------------------------------------------------------
function init() {
  state.users = loadJson(STORAGE_KEYS.USERS, []);
  state.listings = loadJson(STORAGE_KEYS.LISTINGS, []);
  const session = loadJson(STORAGE_KEYS.SESSION, null);
  if (session && session.id) {
    setCurrentUser(session);
    if (session.role === "DONOR") {
      switchView("view-donor");
    } else if (session.role === "CHARITY") {
      switchView("view-charity");
    } else {
      switchView("view-role");
    }
  } else {
    switchView("view-home");
  }

  document.getElementById("login-form").addEventListener("submit", handleLoginSubmit);
  document.getElementById("role-form").addEventListener("submit", handleRoleSubmit);
  document.getElementById("btn-role-back").addEventListener("click", () => switchView("view-home"));
  document.getElementById("btn-logout-1").addEventListener("click", handleLogout);
  document.getElementById("btn-logout-2").addEventListener("click", handleLogout);
  document.getElementById("donor-create-form").addEventListener("submit", handleDonorCreate);
  document.getElementById("charity-search").addEventListener("input", () => {
    clearTimeout(document.getElementById("charity-search")._debounce);
    document.getElementById("charity-search")._debounce = setTimeout(
      renderCharityAvailable,
      140
    );
  });

  initTabs();
  initHomeButtons();
  renderAllForCurrentUser();
}

window.addEventListener("DOMContentLoaded", init);


