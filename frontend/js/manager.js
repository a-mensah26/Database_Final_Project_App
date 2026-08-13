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
  loadRooms();
  loadCustomers();
  loadReservations();
  loadStaff();
  loadHalls();
  loadRestaurants();
  loadEvents();
  loadInvoices();
  loadOrders();
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
    const [rate, available, occ] = await Promise.all([
      api.get("/dashboard/occupancy-rate"),
      api.get("/dashboard/available-rooms"),
      api.get("/dashboard/occupancy"),
    ]);
    const occupiedNow = occ.filter((r) => r.RoomStatus === "Occupied").length;
    document.getElementById("stat-cards").innerHTML = `
      <div class="stat-card"><div class="label">Occupancy rate</div><div class="value">${rate.occupied_pct}%</div></div>
      <div class="stat-card"><div class="label">Rooms occupied</div><div class="value">${occupiedNow}</div></div>
      <div class="stat-card"><div class="label">Rooms available</div><div class="value">${available.length}</div></div>
      <div class="stat-card"><div class="label">Vacancy rate</div><div class="value">${rate.vacant_pct}%</div></div>
    `;
    renderTable(document.getElementById("occupancy-table"), [
      { label: "Room", key: "RoomNo" },
      { label: "Type", key: "RoomType" },
      { label: "Status", render: (r) => statusPill(r.RoomStatus) },
      { label: "Guest", render: (r) => r.GuestName || "—" },
      { label: "Check-in", render: (r) => fmtDate(r.CheckIn) },
    ], occ, { emptyText: "No rooms found." });
  } catch (e) { showToast(e.message, true); }
}

// ---------------- Reports ----------------
async function loadReports() {
  try {
    const inv = await api.get("/reports/room-inventory");
    renderTable(document.getElementById("rpt-inventory"), [
      { label: "Type", key: "RoomType" },
      { label: "Rooms", key: "TotalRooms" },
      { label: "Avg rate", render: (r) => fmtMoney(r.AvgRate) },
      { label: "Occupied", key: "OccupiedCount" },
      { label: "Vacant", key: "VacantCount" },
    ], inv);
  } catch (e) { showToast(e.message, true); }

  try {
    const wl = await api.get("/reports/frontdesk-workload");
    renderTable(document.getElementById("rpt-workload"), [
      { label: "Staff", key: "StaffName" },
      { label: "Shift", key: "Shift" },
      { label: "Handled", key: "ReservationsHandled" },
    ], wl);
  } catch (e) { showToast(e.message, true); }

  try {
    const halls = await api.get("/reports/hall-utilisation");
    renderTable(document.getElementById("rpt-halls"), [
      { label: "Hall", key: "HallName" },
      { label: "Capacity", key: "Capacity" },
      { label: "Events", key: "EventsHosted" },
      { label: "Hours booked", key: "TotalHoursBooked" },
    ], halls);
  } catch (e) { showToast(e.message, true); }

  try {
    const out = await api.get("/reports/outstanding-invoices");
    renderTable(document.getElementById("rpt-outstanding"), [
      { label: "Invoice", render: (r) => `<span class="mono">${r.InvoiceNo}</span>` },
      { label: "Customer", key: "CustomerName" },
      { label: "Balance due", render: (r) => `<span class="dot dot-outstanding"></span>${fmtMoney(r.BalanceDue)}` },
    ], out, { emptyText: "No outstanding balances." });
  } catch (e) { showToast(e.message, true); }
}

// ---------------- Rooms ----------------
async function loadRooms() {
  try {
    const rooms = await api.get("/rooms");
    renderTable(document.getElementById("rooms-table"), [
      { label: "Room", key: "RoomNo" },
      { label: "Type", render: (r) => `<input class="mono" style="width:100px" value="${r.RoomType}" data-edit-type="${r.RoomNo}" />` },
      { label: "Rate", render: (r) => `<input type="number" step="0.01" style="width:90px" value="${r.RoomRate}" data-edit-rate="${r.RoomNo}" />` },
      { label: "Status", render: (r) => statusPill(r.RoomStatus) },
      {
        label: "", render: (r) => `
          <button class="btn btn-ghost btn-sm" data-save="${r.RoomNo}">Save</button>
          <button class="btn btn-ghost btn-sm" data-toggle="${r.RoomNo}" data-current="${r.RoomStatus}">
            Mark ${r.RoomStatus === "Vacant" ? "Occupied" : "Vacant"}</button>`,
      },
    ], rooms, { emptyText: "No rooms found." });

    document.querySelectorAll("[data-save]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const roomNo = btn.dataset.save;
        const type = document.querySelector(`[data-edit-type="${roomNo}"]`).value;
        const rate = document.querySelector(`[data-edit-rate="${roomNo}"]`).value;
        try {
          await api.put(`/rooms/${roomNo}`, { room_type: type, rate });
          showToast(`${roomNo} updated.`);
          loadRooms();
        } catch (e) { showToast(e.message, true); }
      });
    });
    document.querySelectorAll("[data-toggle]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const roomNo = btn.dataset.toggle;
        const next = btn.dataset.current === "Vacant" ? "Occupied" : "Vacant";
        try {
          await api.patch(`/rooms/${roomNo}/status`, { status: next });
          showToast(`${roomNo} marked ${next}.`);
          loadRooms();
          loadDashboard();
        } catch (e) { showToast(e.message, true); }
      });
    });
  } catch (e) { showToast(e.message, true); }
}

// ---------------- Customers ----------------
async function loadCustomers() {
  try {
    const customers = await api.get("/customers");
    renderTable(document.getElementById("customers-table"), [
      { label: "ID", render: (r) => `<span class="mono">${r.CustomerID}</span>` },
      { label: "First name", key: "CustomerFName" },
      { label: "Last name", key: "CustomerLName" },
      { label: "Phone", render: (r) => `<span class="mono">${r.PhoneNumber}</span>` },
      { label: "", render: (r) => `<button class="btn btn-danger btn-sm" data-del-customer="${r.CustomerID}">Delete</button>` },
    ], customers, { emptyText: "No customers yet." });

    document.querySelectorAll("[data-del-customer]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (!confirm("Delete this customer? This can't be undone.")) return;
        try {
          await api.del(`/customers/${btn.dataset.delCustomer}`);
          showToast("Customer deleted.");
          loadCustomers();
        } catch (e) { showToast(e.message, true); }
      });
    });
  } catch (e) { showToast(e.message, true); }
}

// ---------------- Reservations ----------------
async function loadReservations() {
  try {
    const reservations = await api.get("/reservations");
    renderTable(document.getElementById("reservations-table"), [
      { label: "ID", render: (r) => `<span class="mono">${r.ReservationID}</span>` },
      { label: "Room", key: "RoomID" },
      { label: "Customer", key: "CustomerName" },
      { label: "Staff", key: "StaffID" },
      { label: "Check-in", render: (r) => fmtDate(r.CheckIn) },
      { label: "Check-out", render: (r) => (r.CheckOut ? fmtDate(r.CheckOut) : "Currently checked in") },
      {
        label: "", render: (r) => (r.CheckOut
          ? `<button class="btn btn-danger btn-sm" data-del-res="${r.ReservationID}" disabled title="Completed bookings can't be deleted">Delete</button>`
          : `<button class="btn btn-ghost btn-sm" data-checkout="${r.ReservationID}">Check out</button>
             <button class="btn btn-danger btn-sm" data-del-res="${r.ReservationID}">Delete</button>`),
      },
    ], reservations, { emptyText: "No reservations yet." });

    document.querySelectorAll("[data-checkout]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        try {
          await api.put(`/reservations/${btn.dataset.checkout}/checkout`, {
            check_out: new Date().toISOString().slice(0, 19).replace("T", " "),
          });
          showToast("Guest checked out.");
          loadReservations(); loadRooms(); loadDashboard();
        } catch (e) { showToast(e.message, true); }
      });
    });
    document.querySelectorAll("[data-del-res]:not([disabled])").forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (!confirm("Delete this reservation?")) return;
        try {
          await api.del(`/reservations/${btn.dataset.delRes}`);
          showToast("Reservation deleted.");
          loadReservations();
        } catch (e) { showToast(e.message, true); }
      });
    });
  } catch (e) { showToast(e.message, true); }
}

// ---------------- Staff ----------------
async function loadStaff() {
  try {
    const staff = await api.get("/staff");
    renderTable(document.getElementById("staff-table"), [
      { label: "ID", render: (r) => `<span class="mono">${r.StaffID}</span>` },
      { label: "Name", key: "StaffName" },
      { label: "Role", key: "StaffRole" },
      { label: "Shift", render: (r) => r.Shift || "—" },
      { label: "Floor", render: (r) => (r.AssignedFloor ?? "—") },
      { label: "", render: (r) => `<button class="btn btn-danger btn-sm" data-del-staff="${r.StaffID}">Delete</button>` },
    ], staff, { emptyText: "No staff yet." });

    document.querySelectorAll("[data-del-staff]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (!confirm("Delete this staff member?")) return;
        try {
          await api.del(`/staff/${btn.dataset.delStaff}`);
          showToast("Staff member removed.");
          loadStaff();
        } catch (e) { showToast(e.message, true); }
      });
    });
  } catch (e) { showToast(e.message, true); }
}

// ---------------- Halls / Restaurants ----------------
async function loadHalls() {
  try {
    const halls = await api.get("/conference-halls");
    renderTable(document.getElementById("halls-table"), [
      { label: "ID", render: (r) => `<span class="mono">${r.HallID}</span>` },
      { label: "Name", key: "HallName" },
      { label: "Capacity", key: "Capacity" },
    ], halls, { emptyText: "No halls yet." });
  } catch (e) { showToast(e.message, true); }
}

async function loadRestaurants() {
  try {
    const restaurants = await api.get("/restaurants");
    renderTable(document.getElementById("restaurants-table"), [
      { label: "ID", render: (r) => `<span class="mono">${r.RestaurantID}</span>` },
      { label: "Name", key: "RestaurantName" },
      { label: "Seats", key: "SeatingCapacity" },
    ], restaurants, { emptyText: "No restaurants yet." });
  } catch (e) { showToast(e.message, true); }
}

// ---------------- Events ----------------
async function loadEvents() {
  try {
    const events = await api.get("/events");
    renderTable(document.getElementById("events-table"), [
      { label: "ID", render: (r) => `<span class="mono">${r.EventID}</span>` },
      { label: "Type", key: "EventType" },
      { label: "Date", render: (r) => fmtDate(r.EventDate) },
      { label: "Duration (hrs)", key: "EventDuration" },
      { label: "Hall", key: "HallName" },
      { label: "Host", key: "HostName" },
    ], events, { emptyText: "No events scheduled." });
  } catch (e) { showToast(e.message, true); }
}

// ---------------- Invoices / Orders ----------------
async function loadInvoices() {
  try {
    const invoices = await api.get("/invoices");
    renderTable(document.getElementById("invoices-table"), [
      { label: "Invoice", render: (r) => `<span class="mono">${r.InvoiceNo}</span>` },
      { label: "Customer", key: "CustomerID" },
      { label: "Payable", render: (r) => fmtMoney(r.AmountPayable) },
      {
        label: "Paid", render: (r) => `<input type="number" step="0.01" style="width:100px" value="${r.AmountPaid}" data-edit-paid="${r.InvoiceNo}" />`,
      },
      { label: "", render: (r) => `<button class="btn btn-ghost btn-sm" data-save-invoice="${r.InvoiceNo}">Save</button>` },
    ], invoices, { emptyText: "No invoices yet." });

    document.querySelectorAll("[data-save-invoice]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const invNo = btn.dataset.saveInvoice;
        const paid = document.querySelector(`[data-edit-paid="${invNo}"]`).value;
        try {
          await api.put(`/invoices/${invNo}`, { amount_paid: paid });
          showToast(`${invNo} updated.`);
          loadInvoices();
          loadReports();
        } catch (e) { showToast(e.message, true); }
      });
    });
  } catch (e) { showToast(e.message, true); }
}

async function loadOrders() {
  try {
    const orders = await api.get("/restaurant-orders");
    renderTable(document.getElementById("orders-table"), [
      { label: "Order", render: (r) => `<span class="mono">${r.OrderID}</span>` },
      { label: "Customer", key: "CustomerName" },
      { label: "Restaurant", key: "RestaurantName" },
      { label: "Invoice", render: (r) => r.InvoiceID || "—" },
      { label: "Details", key: "OrderDetails" },
    ], orders, { emptyText: "No orders yet." });
  } catch (e) { showToast(e.message, true); }
}

// ---------------- Forms ----------------
function wireForms() {
  document.getElementById("room-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      await api.post("/rooms", {
        room_no: document.getElementById("rm-no").value.trim(),
        room_type: document.getElementById("rm-type").value.trim(),
        rate: document.getElementById("rm-rate").value,
        housekeeper_id: document.getElementById("rm-hk").value.trim() || null,
      });
      showToast("Room added.");
      e.target.reset();
      loadRooms(); loadDashboard();
    } catch (err) { showToast(err.message, true); }
  });

  document.getElementById("customer-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      await api.post("/customers", {
        fname: document.getElementById("c-fname").value.trim(),
        lname: document.getElementById("c-lname").value.trim(),
        phone: document.getElementById("c-phone").value.trim(),
      });
      showToast("Customer added.");
      e.target.reset();
      loadCustomers();
    } catch (err) { showToast(err.message, true); }
  });

  document.getElementById("reservation-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const toApiDatetime = (v) => (v ? v.replace("T", " ") + ":00" : null);
    try {
      await api.post("/reservations", {
        room_id: document.getElementById("r-room").value.trim(),
        customer_id: document.getElementById("r-customer").value.trim(),
        staff_id: document.getElementById("r-staff").value.trim(),
        check_in: toApiDatetime(document.getElementById("r-checkin").value),
        check_out: toApiDatetime(document.getElementById("r-checkout").value),
      });
      showToast("Reservation created.");
      e.target.reset();
      loadReservations(); loadRooms(); loadDashboard();
    } catch (err) { showToast(err.message, true); }
  });

  const roleSelect = document.getElementById("s-role");
  const floorWrap = document.getElementById("s-floor-wrap");
  roleSelect.addEventListener("change", () => {
    floorWrap.style.display = roleSelect.value === "Housekeeping" ? "block" : "none";
  });

  document.getElementById("staff-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      await api.post("/staff", {
        fname: document.getElementById("s-fname").value.trim(),
        lname: document.getElementById("s-lname").value.trim(),
        role: roleSelect.value,
        shift: document.getElementById("s-shift").value,
        floor: document.getElementById("s-floor").value || null,
      });
      showToast("Staff member added.");
      e.target.reset();
      loadStaff();
    } catch (err) { showToast(err.message, true); }
  });

  document.getElementById("hall-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      await api.post("/conference-halls", {
        name: document.getElementById("h-name").value.trim(),
        capacity: document.getElementById("h-cap").value,
      });
      showToast("Hall added.");
      e.target.reset();
      loadHalls();
    } catch (err) { showToast(err.message, true); }
  });

  document.getElementById("restaurant-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      await api.post("/restaurants", {
        name: document.getElementById("rt-name").value.trim(),
        seating_capacity: document.getElementById("rt-seats").value,
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
        event_type: document.getElementById("e-type").value,
        event_date: document.getElementById("e-date").value,
        duration: document.getElementById("e-duration").value,
        host_id: document.getElementById("e-host").value.trim(),
        hall_id: document.getElementById("e-hall").value.trim(),
      });
      showToast("Event scheduled.");
      e.target.reset();
      loadEvents();
    } catch (err) { showToast(err.message, true); }
  });
}
