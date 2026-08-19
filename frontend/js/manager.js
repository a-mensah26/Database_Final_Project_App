let ME = null;

(async function init() {
  ME = await requireSession(["Manager"], "index.html");
  if (!ME) return;
  document.getElementById("user-name").textContent = ME.full_name;
  setupTabs();
  wireLogout();
  wireForms();

  loadDashboard();
  loadReports();
  loadRequests();
  loadRooms();
  loadCustomers();
  loadReservations();
  loadStaff();
  loadHalls();
  loadRestaurants();
  loadEvents();
  loadOrders();
  loadInvoices();
  loadFeedback();
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
    showToast("Failed to load metrics.", true);
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

// ---------------- Reports ----------------
async function loadReports() {
  const roomsCont = document.getElementById("report-rooms-table");
  const invoicesCont = document.getElementById("report-invoices-table");
  const workloadCont = document.getElementById("report-workload-table");
  const hallCont = document.getElementById("report-hall-table");

  try {
    const data = await api.get("/reports/room-inventory");
    renderTable(roomsCont, [
      { label: "Type", key: "RoomType" },
      { label: "Total Rooms", key: "TotalRooms" },
      { label: "Avg Rate", render: (r) => fmtMoney(r.AvgRate) },
      { label: "Occupied", key: "OccupiedCount" },
      { label: "Vacant", key: "VacantCount" }
    ], data);
  } catch (e) { roomsCont.innerHTML = "Error."; }

  try {
    const data = await api.get("/reports/outstanding-invoices");
    renderTable(invoicesCont, [
      { label: "Invoice No", key: "InvoiceNo", render: (r) => `<span class="mono">${r.InvoiceNo}</span>` },
      { label: "Customer", render: (r) => `${r.CustomerName} (${r.CustomerID})` },
      { label: "Payable", render: (r) => fmtMoney(r.AmountPayable) },
      { label: "Balance Due", render: (r) => fmtMoney(r.BalanceDue) }
    ], data, { emptyText: "No outstanding balances!" });
  } catch (e) { invoicesCont.innerHTML = "Error."; }

  try {
    const data = await api.get("/reports/frontdesk-workload");
    renderTable(workloadCont, [
      { label: "Staff ID", key: "StaffID", render: (r) => `<span class="mono">${r.StaffID}</span>` },
      { label: "Staff Name", key: "StaffName" },
      { label: "Shift", key: "Shift" },
      { label: "Stays Handled", key: "ReservationsHandled" }
    ], data);
  } catch (e) { workloadCont.innerHTML = "Error."; }

  try {
    const data = await api.get("/reports/hall-utilisation");
    renderTable(hallCont, [
      { label: "Hall ID", key: "HallID", render: (r) => `<span class="mono">${r.HallID}</span>` },
      { label: "Hall Name", key: "HallName" },
      { label: "Events Hosted", key: "EventsHosted" },
      { label: "Total Hours Booked", render: (r) => `${r.TotalHoursBooked} hrs` }
    ], data);
  } catch (e) { hallCont.innerHTML = "Error."; }
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
      { label: "Guest Name", render: (r) => `${r.CustomerName} (${r.CustomerID})` },
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
    showToast("Guest checked out.");
    loadReservations();
    loadRooms();
    loadDashboard();
    loadReports();
    loadInvoices();
  } catch (err) {
    showToast(err.message, true);
  }
}

// ---------------- Staff ----------------
async function loadStaff() {
  const container = document.getElementById("staff-table");
  try {
    const staff = await api.get("/staff");
    renderTable(container, [
      { label: "Staff ID", key: "StaffID", render: (r) => `<span class="mono">${r.StaffID}</span>` },
      { label: "Name", render: (r) => `${r.StaffName}` },
      { label: "Role/Subtype", key: "StaffRole" },
      { label: "Shift", render: (r) => r.Shift || "—" },
      { label: "Floor", render: (r) => r.AssignedFloor !== null ? r.AssignedFloor : "—" }
    ], staff, { emptyText: "No staff registered." });
  } catch (err) {
    container.innerHTML = `<div class="empty-state" style="color:var(--danger)">Error loading staff.</div>`;
  }
}

// ---------------- Halls & Restaurants ----------------
async function loadHalls() {
  const container = document.getElementById("halls-table");
  try {
    const halls = await api.get("/conference-halls");
    renderTable(container, [
      { label: "Hall ID", key: "HallID", render: (r) => `<span class="mono">${r.HallID}</span>` },
      { label: "Name", key: "HallName" },
      { label: "Capacity", key: "Capacity" }
    ], halls);
  } catch (err) { container.innerHTML = "Error."; }
}

async function loadRestaurants() {
  const container = document.getElementById("restaurants-table");
  try {
    const rests = await api.get("/restaurants");
    renderTable(container, [
      { label: "Restaurant ID", key: "RestaurantID", render: (r) => `<span class="mono">${r.RestaurantID}</span>` },
      { label: "Name", key: "RestaurantName" },
      { label: "Capacity", key: "SeatingCapacity" }
    ], rests);
  } catch (err) { container.innerHTML = "Error."; }
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

// ---------------- Invoices ----------------
async function loadInvoices() {
  const container = document.getElementById("invoices-table");
  try {
    const invoices = await api.get("/invoices");
    renderTable(container, [
      { label: "Invoice No", key: "InvoiceNo", render: (r) => `<span class="mono font-bold">${r.InvoiceNo}</span>` },
      { label: "Guest ID", key: "CustomerID", render: (r) => `<span class="mono">${r.CustomerID}</span>` },
      { label: "Amount Payable", render: (r) => fmtMoney(r.AmountPayable) },
      { label: "Amount Paid", render: (r) => fmtMoney(r.AmountPaid) },
      {
        label: "Actions",
        render: (r) => {
          const isPaid = parseFloat(r.AmountPaid) >= parseFloat(r.AmountPayable);
          if (isPaid) return `<span class="status-badge approved">Fully Paid</span>`;
          return `<button class="btn btn-primary btn-sm" onclick="receivePayment('${r.InvoiceNo}', '${r.AmountPayable}', '${r.AmountPaid}')">Record Payment</button>`;
        }
      }
    ], invoices, { emptyText: "No invoices logged." });
  } catch (err) {
    container.innerHTML = `<div class="empty-state" style="color:var(--danger)">Error loading invoices: Managers only.</div>`;
  }
}

async function receivePayment(invNo, payable, currentPaid) {
  const balance = parseFloat(payable) - parseFloat(currentPaid);
  const amountStr = prompt(`Outstanding balance is GH₵ ${balance.toFixed(2)}. Enter payment amount to record:`, balance.toFixed(2));
  if (amountStr === null) return;
  const payVal = parseFloat(amountStr);
  if (isNaN(payVal) || payVal <= 0) {
    showToast("Invalid payment amount.", true);
    return;
  }
  const newPaid = parseFloat(currentPaid) + payVal;
  try {
    await api.put(`/invoices/${invNo}`, { amount_paid: newPaid });
    showToast(`Payment of GH₵ ${payVal} recorded.`);
    loadInvoices();
    loadReports();
  } catch (err) {
    showToast(err.message, true);
  }
}

// ---------------- Feedback ----------------
async function loadFeedback() {
  const container = document.getElementById("feedback-table");
  try {
    const feedbacks = await api.get("/feedback");
    renderTable(container, [
      { label: "Feedback ID", key: "FeedbackID", render: (r) => `<span class="mono">${r.FeedbackID}</span>` },
      { label: "Customer", render: (r) => `${r.CustomerName} (${r.CustomerID})` },
      { label: "Rating", render: (r) => "★".repeat(r.Rating) + "☆".repeat(5 - r.Rating) },
      { label: "Comments", key: "Comments" },
      { label: "Date", render: (r) => new Date(r.FeedbackDate).toLocaleDateString() },
      {
        label: "Actions",
        render: (r) => `<button class="btn btn-ghost btn-sm" style="color:var(--danger);" onclick="deleteFeedback('${r.FeedbackID}')">Delete</button>`
      }
    ], feedbacks, { emptyText: "No feedback logged." });
  } catch (err) {
    container.innerHTML = `<div class="empty-state" style="color:var(--danger)">Error loading feedback.</div>`;
  }
}

async function deleteFeedback(fbId) {
  if (!confirm(`Delete feedback log ${fbId}?`)) return;
  try {
    await api.delete(`/feedback/${fbId}`);
    showToast("Feedback deleted.");
    loadFeedback();
  } catch (err) { showToast(err.message, true); }
}

// ---------------- Forms Wiring ----------------
function wireForms() {
  document.getElementById("room-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      await api.post("/rooms", {
        room_no: document.getElementById("room-no").value.trim(),
        room_type: document.getElementById("room-type").value.trim(),
        room: document.getElementById("room-rate").value,
        housekeeper_id: document.getElementById("room-hk").value.trim() || null,
      });
      showToast("Room added successfully.");
      e.target.reset();
      loadRooms();
      loadDashboard();
      loadReports();
    } catch (err) { showToast(err.message, true); }
  });

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
    } catch (err) { showToast(err.message, true); }
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
      loadReports();
    } catch (err) { showToast(err.message, true); }
  });

  document.getElementById("hall-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      await api.post("/conference-halls", {
        name: document.getElementById("hall-name").value.trim(),
        capacity: document.getElementById("hall-capacity").value,
      });
      showToast("Conference hall added.");
      e.target.reset();
      loadHalls();
      loadReports();
    } catch (err) { showToast(err.message, true); }
  });

  document.getElementById("restaurant-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      await api.post("/restaurants", {
        name: document.getElementById("rest-name").value.trim(),
        seats: document.getElementById("rest-capacity").value,
      });
      showToast("Restaurant added.");
      e.target.reset();
      loadRestaurants();
    } catch (err) { showToast(err.message, true); }
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
      loadReports();
    } catch (err) { showToast(err.message, true); }
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
    } catch (err) { showToast(err.message, true); }
  });

  document.getElementById("invoice-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      await api.post("/invoices", {
        customer_id: document.getElementById("inv-cust").value.trim(),
        amount_payable: document.getElementById("inv-amount").value,
        amount_paid: document.getElementById("inv-paid").value || "0.00",
      });
      showToast("Invoice created.");
      e.target.reset();
      loadInvoices();
      loadReports();
    } catch (err) { showToast(err.message, true); }
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
      loadReports();
    } catch (err) {
      showToast(err.message, true);
    }
  });
}
