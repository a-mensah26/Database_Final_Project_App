let ME = null;

(async function init() {
  ME = await requireSession(["Front Desk"], "index.html");
  if (!ME) return;
  document.getElementById("user-name").textContent = `${ME.full_name}`;
  setupTabs();
  wireLogout();
  wireForms();
  
  loadDashboard();
  loadRequests();
  loadRooms();
  loadCustomers();
  loadReservations();
  loadEvents();
  loadOrders();
  loadFeedback();
  loadReference();
})();

function wireLogout() {
  document.getElementById("logout-btn").addEventListener("click", async () => {
    await api.post("/auth/logout");
    window.location.href = "index.html";
  });
}

// ---------------- Dashboard ----------------
async function loadDashboard() {
  try {
    const stats = await api.get("/dashboard/stats");
    const container = document.getElementById("stat-cards");
    container.innerHTML = `
      <div class="card stat-card">
        <div class="num">${stats.unoccupied_rooms}</div>
        <div class="label">Vacant Rooms</div>
      </div>
      <div class="card stat-card">
        <div class="num">${stats.occupied_rooms}</div>
        <div class="label">Occupied Rooms</div>
      </div>
      <div class="card stat-card">
        <div class="num">${stats.occupancy_rate}%</div>
        <div class="label">Occupancy Rate</div>
      </div>
      <div class="card stat-card">
        <div class="num">${stats.upcoming_events_count}</div>
        <div class="label">Upcoming Events</div>
      </div>
    `;
  } catch (err) {
    showToast("Failed to load stats.", true);
  }

  try {
    const occupancy = await api.get("/dashboard/occupancy");
    const container = document.getElementById("occupancy-table");
    renderTable(container, [
      { label: "Room No", key: "RoomNo", render: (r) => `<span class="mono">${r.RoomNo}</span>` },
      { label: "Type", key: "RoomType" },
      { label: "Guest Name", render: (r) => r.GuestName || `<span class="text-muted">—</span>` },
      { label: "Check In", render: (r) => r.CheckIn ? new Date(r.CheckIn).toLocaleString() : "—" },
      {
        label: "Status",
        render: (r) => {
          const isVacant = r.RoomStatus === "Vacant";
          return `<span class="pill ${isVacant ? "pill-vacant" : "pill-occupied"}">${r.RoomStatus}</span>`;
        }
      }
    ], occupancy, { emptyText: "No rooms occupied." });
  } catch (err) {
    document.getElementById("occupancy-table").innerHTML = `<div class="empty-state" style="color:var(--danger)">Error loading occupancy data.</div>`;
  }
}

// ---------------- Reservation Requests ----------------
let activeApproveToken = null;
let allAvailableRoomsList = [];

async function loadRequests() {
  const container = document.getElementById("requests-table");
  try {
    const requests = await api.get("/requests");
    allAvailableRoomsList = await api.get("/public/rooms");

    renderTable(container, [
      { label: "Token", key: "RequestToken", render: (r) => `<span class="mono font-bold">${r.RequestToken}</span>` },
      { label: "Guest Name", render: (r) => `${r.CustomerFName} ${r.CustomerLName}` },
      { label: "Phone", key: "PhoneNumber" },
      { label: "Room Type", key: "RoomType" },
      { label: "Check In", render: (r) => new Date(r.CheckIn).toLocaleString() },
      { label: "Check Out", render: (r) => new Date(r.CheckOut).toLocaleString() },
      {
        label: "Status",
        render: (r) => {
          if (r.Status === "Pending") return `<span class="status-badge pending">Pending</span>`;
          if (r.Status === "Approved") return `<span class="status-badge approved">Approved (Room ${r.RoomNo})</span>`;
          return `<span class="status-badge declined">Declined</span>`;
        }
      },
      {
        label: "Actions",
        render: (r) => {
          if (r.Status !== "Pending") return `<span class="text-muted">—</span>`;
          return `
            <div class="actions">
              <button class="btn btn-gold btn-sm" onclick="openApproveModal('${r.RequestToken}', '${r.RoomType}')">Approve</button>
              <button class="btn btn-ghost btn-sm" style="color:var(--danger);" onclick="declineRequest('${r.RequestToken}')">Decline</button>
            </div>
          `;
        }
      }
    ], requests, { emptyText: "No booking requests found." });
  } catch (err) {
    container.innerHTML = `<div class="empty-state" style="color:var(--danger)">Error loading requests: ${err.message}</div>`;
  }
}

function openApproveModal(token, roomType) {
  activeApproveToken = token;
  document.getElementById("approve-modal-title-token").textContent = `Token: ${token} (${roomType})`;

  const matchingRooms = allAvailableRoomsList.filter(r => r.RoomType === roomType);
  const select = document.getElementById("approve-room-select");
  select.innerHTML = "";

  if (matchingRooms.length === 0) {
    select.innerHTML = `<option value="">No available rooms of type ${roomType}</option>`;
  } else {
    matchingRooms.forEach(room => {
      const opt = document.createElement("option");
      opt.value = room.RoomNo;
      opt.textContent = `Room ${room.RoomNo} (GH₵ ${room.RoomRate}/night)`;
      select.appendChild(opt);
    });
  }

  document.getElementById("approve-request-modal").classList.add("open");
}

async function declineRequest(token) {
  if (!confirm(`Are you sure you want to decline request ${token}?`)) return;
  try {
    await api.put(`/requests/${token}/decline`);
    showToast(`Request ${token} declined.`);
    loadRequests();
  } catch (err) {
    showToast(err.message, true);
  }
}

// ---------------- Rooms ----------------
async function loadRooms() {
  const container = document.getElementById("rooms-table");
  try {
    const rooms = await api.get("/rooms");
    renderTable(container, [
      { label: "Room No", key: "RoomNo", render: (r) => `<span class="mono">${r.RoomNo}</span>` },
      { label: "Type", key: "RoomType" },
      { label: "Rate per Night", render: (r) => fmtMoney(r.RoomRate) },
      {
        label: "Status",
        render: (r) => {
          const isVacant = r.RoomStatus === "Vacant";
          return `<span class="pill ${isVacant ? "pill-vacant" : "pill-occupied"}">${r.RoomStatus}</span>`;
        }
      },
      { label: "Assigned Housekeeper", render: (r) => r.HousekeeperName || `<span class="text-muted">Unassigned</span>` }
    ], rooms, { emptyText: "No rooms defined." });
  } catch (err) {
    container.innerHTML = `<div class="empty-state" style="color:var(--danger)">Error loading rooms.</div>`;
  }
}

// ---------------- Customers ----------------
async function loadCustomers() {
  const container = document.getElementById("customers-table");
  try {
    const custs = await api.get("/customers");
    renderTable(container, [
      { label: "Customer ID", key: "CustomerID", render: (r) => `<span class="mono">${r.CustomerID}</span>` },
      { label: "First Name", key: "CustomerFName" },
      { label: "Last Name", key: "CustomerLName" },
      { label: "Phone Number", key: "PhoneNumber" }
    ], custs, { emptyText: "No customers in database." });
  } catch (err) {
    container.innerHTML = `<div class="empty-state" style="color:var(--danger)">Error loading customers.</div>`;
  }
}

// ---------------- Reservations ----------------
async function loadReservations() {
  const container = document.getElementById("reservations-table");
  try {
    const resList = await api.get("/reservations");
    renderTable(container, [
      { label: "ID", key: "ReservationID", render: (r) => `<span class="mono font-bold">${r.ReservationID}</span>` },
      { label: "Room No", key: "RoomID", render: (r) => `<span class="mono">${r.RoomID}</span>` },
      { label: "Guest Name", render: (r) => `${r.CustomerFName} ${r.CustomerLName} (${r.CustomerID})` },
      { label: "Check In", render: (r) => new Date(r.CheckIn).toLocaleString() },
      { label: "Check Out", render: (r) => r.CheckOut ? new Date(r.CheckOut).toLocaleString() : `<span class="pill pill-occupied">Stay Active</span>` },
      {
        label: "Actions",
        render: (r) => {
          if (r.CheckOut) return `<span class="text-muted">Checked out</span>`;
          return `<button class="btn btn-primary btn-sm" onclick="checkout('${r.ReservationID}')">Check out</button>`;
        }
      }
    ], resList, { emptyText: "No reservations found." });
  } catch (err) {
    container.innerHTML = `<div class="empty-state" style="color:var(--danger)">Error loading reservations.</div>`;
  }
}

async function checkout(resId) {
  if (!confirm(`Check out guest from reservation ${resId}?`)) return;
  try {
    await api.put(`/reservations/${resId}/checkout`, {
      check_out: new Date().toISOString().slice(0, 19).replace('T', ' ')
    });
    showToast("Guest checked out successfully.");
    loadReservations();
    loadRooms();
    loadDashboard();
  } catch (err) {
    showToast(err.message, true);
  }
}

// ---------------- Events ----------------
async function loadEvents() {
  const container = document.getElementById("events-table");
  try {
    const events = await api.get("/events");
    renderTable(container, [
      { label: "Event ID", key: "EventID", render: (r) => `<span class="mono">${r.EventID}</span>` },
      { label: "Event Type", key: "EventType" },
      { label: "Date", render: (r) => new Date(r.EventDate).toLocaleDateString() },
      { label: "Duration", render: (r) => `${r.EventDuration} hrs` },
      { label: "Hall", key: "HallName" },
      { label: "Host Name", key: "HostName" }
    ], events, { emptyText: "No events scheduled." });
  } catch (err) {
    container.innerHTML = `<div class="empty-state" style="color:var(--danger)">Error loading events.</div>`;
  }
}

// ---------------- Restaurant Orders ----------------
async function loadOrders() {
  const container = document.getElementById("orders-table");
  try {
    const orders = await api.get("/restaurant-orders");
    renderTable(container, [
      { label: "Order ID", key: "OrderID", render: (r) => `<span class="mono">${r.OrderID}</span>` },
      { label: "Guest Name", render: (r) => `${r.CustomerName} (${r.CustomerID})` },
      { label: "Restaurant", key: "RestaurantName" },
      { label: "Order Details", key: "OrderDetails" }
    ], orders, { emptyText: "No orders placed." });
  } catch (err) {
    container.innerHTML = `<div class="empty-state" style="color:var(--danger)">Error loading orders.</div>`;
  }
}

// ---------------- Feedback ----------------
async function loadFeedback() {
  const container = document.getElementById("feedback-table");
  try {
    const feedbacks = await api.get("/feedback");
    renderTable(container, [
      { label: "ID", key: "FeedbackID", render: (r) => `<span class="mono">${r.FeedbackID}</span>` },
      { label: "Customer", render: (r) => `${r.CustomerName} (${r.CustomerID})` },
      { label: "Rating", render: (r) => "★".repeat(r.Rating) + "☆".repeat(5 - r.Rating) },
      { label: "Comments", key: "Comments" },
      { label: "Date", render: (r) => new Date(r.FeedbackDate).toLocaleDateString() }
    ], feedbacks, { emptyText: "No feedback logs found." });
  } catch (err) {
    container.innerHTML = `<div class="empty-state" style="color:var(--danger)">Error loading feedback.</div>`;
  }
}

// ---------------- Reference ----------------
async function loadReference() {
  const hallsContainer = document.getElementById("halls-table");
  const restContainer = document.getElementById("restaurants-table");

  try {
    const halls = await api.get("/conference-halls");
    renderTable(hallsContainer, [
      { label: "Hall ID", key: "HallID", render: (r) => `<span class="mono">${r.HallID}</span>` },
      { label: "Name", key: "HallName" },
      { label: "Capacity", key: "Capacity" }
    ], halls);
  } catch (err) { hallsContainer.innerHTML = "Error."; }

  try {
    const rests = await api.get("/restaurants");
    renderTable(restContainer, [
      { label: "Restaurant ID", key: "RestaurantID", render: (r) => `<span class="mono">${r.RestaurantID}</span>` },
      { label: "Name", key: "RestaurantName" },
      { label: "Capacity", key: "SeatingCapacity" }
    ], rests);
  } catch (err) { restContainer.innerHTML = "Error."; }
}

// ---------------- Forms Wiring ----------------
function wireForms() {
  document.getElementById("customer-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      await api.post("/customers", {
        fname: document.getElementById("cust-fname").value.trim(),
        lname: document.getElementById("cust-lname").value.trim(),
        phone: document.getElementById("cust-phone").value.trim(),
      });
      showToast("Customer added.");
      e.target.reset();
      loadCustomers();
    } catch (err) {
      showToast(err.message, true);
    }
  });

  document.getElementById("reservation-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const checkin = document.getElementById("res-checkin").value;
    const checkoutVal = document.getElementById("res-checkout").value;

    if (checkoutVal && new Date(checkoutVal) <= new Date(checkin)) {
      showToast("Check-out date must be after check-in date.", true);
      return;
    }

    try {
      await api.post("/reservations", {
        room_no: document.getElementById("res-room").value.trim(),
        customer_id: document.getElementById("res-cust").value.trim(),
        check_in: checkin,
        check_out: checkoutVal || null,
      });
      showToast("Reservation stay created.");
      e.target.reset();
      loadReservations();
      loadRooms();
      loadDashboard();
    } catch (err) {
      showToast(err.message, true);
    }
  });

  document.getElementById("event-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      await api.post("/events", {
        event_type: document.getElementById("evt-type").value,
        event_date: document.getElementById("evt-date").value,
        duration: document.getElementById("evt-duration").value,
        host_id: document.getElementById("evt-host").value.trim(),
        hall_id: document.getElementById("evt-hall").value.trim(),
      });
      showToast("Event scheduled successfully.");
      e.target.reset();
      loadEvents();
      loadDashboard();
    } catch (err) {
      showToast(err.message, true);
    }
  });

  document.getElementById("order-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      await api.post("/restaurant-orders", {
        customer_id: document.getElementById("ro-cust").value.trim(),
        restaurant_id: document.getElementById("ro-rest").value.trim(),
        order_details: document.getElementById("ro-details").value.trim(),
      });
      showToast("Order placed successfully.");
      e.target.reset();
      loadOrders();
    } catch (err) {
      showToast(err.message, true);
    }
  });

  document.getElementById("feedback-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      await api.post("/feedback", {
        customer_id: document.getElementById("fb-cust").value.trim(),
        rating: document.getElementById("fb-rating").value,
        comments: document.getElementById("fb-comments").value.trim(),
      });
      showToast("Feedback logged.");
      e.target.reset();
      loadFeedback();
    } catch (err) {
      showToast(err.message, true);
    }
  });

  // Requests Modal Actions
  const approveModal = document.getElementById("approve-request-modal");
  document.getElementById("close-approve-modal-btn").addEventListener("click", () => {
    approveModal.classList.remove("open");
  });
  
  document.getElementById("approve-request-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!activeApproveToken) return;
    const roomNo = document.getElementById("approve-room-select").value;
    try {
      await api.put(`/requests/${activeApproveToken}/approve`, { room_no: roomNo });
      showToast(`Request ${activeApproveToken} approved.`);
      approveModal.classList.remove("open");
      loadRequests();
      loadRooms();
      loadReservations();
      loadDashboard();
    } catch (err) {
      showToast(err.message, true);
    }
  });
}
