let ME = null;

(async function init() {
  ME = await requireSession(["Front Desk"], "index.html");
  if (!ME) return;
  document.getElementById("user-name").textContent = `${ME.full_name} · ${ME.staff_id || ""}`;
  setupTabs();
  wireLogout();
  wireForms();
  loadDashboard();
  loadRooms();
  loadCustomers();
  loadReservations();
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
      <div class="stat-card"><div class="label">Your ID</div><div class="value mono">${ME.staff_id || "—"}</div></div>
    `;
    renderTable(document.getElementById("occupancy-table"), [
      { label: "Room", key: "RoomNo" },
      { label: "Type", key: "RoomType" },
      { label: "Status", render: (r) => statusPill(r.RoomStatus) },
      { label: "Guest", render: (r) => r.GuestName || "—" },
      { label: "Check-in", render: (r) => fmtDate(r.CheckIn) },
    ], occ, { emptyText: "No rooms found." });
  } catch (e) {
    showToast(e.message, true);
  }

  try {
    const events = await api.get("/dashboard/upcoming-events");
    renderTable(document.getElementById("events-table"), [
      { label: "Event", key: "EventType" },
      { label: "Date", render: (r) => fmtDate(r.EventDate) },
      { label: "Hall", key: "HallName" },
      { label: "Host", key: "HostName" },
    ], events, { emptyText: "No upcoming events." });
  } catch (e) {
    showToast(e.message, true);
  }
}

// ---------------- Rooms ----------------
async function loadRooms() {
  try {
    const rooms = await api.get("/rooms");
    renderTable(document.getElementById("rooms-table"), [
      { label: "Room", key: "RoomNo" },
      { label: "Type", key: "RoomType" },
      { label: "Rate", render: (r) => fmtMoney(r.RoomRate) },
      { label: "Status", render: (r) => statusPill(r.RoomStatus) },
      {
        label: "", render: (r) => `<button class="btn btn-ghost btn-sm" data-toggle="${r.RoomNo}" data-current="${r.RoomStatus}">
          Mark ${r.RoomStatus === "Vacant" ? "Occupied" : "Vacant"}</button>`,
      },
    ], rooms, { emptyText: "No rooms found." });

    document.querySelectorAll("[data-toggle]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const roomNo = btn.dataset.toggle;
        const next = btn.dataset.current === "Vacant" ? "Occupied" : "Vacant";
        try {
          await api.patch(`/rooms/${roomNo}/status`, { status: next });
          showToast(`${roomNo} marked ${next}.`);
          loadRooms();
          loadDashboard();
        } catch (e) {
          showToast(e.message, true);
        }
      });
    });
  } catch (e) {
    showToast(e.message, true);
  }
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
    ], customers, { emptyText: "No customers yet." });
  } catch (e) {
    showToast(e.message, true);
  }
}

// ---------------- Reservations ----------------
async function loadReservations() {
  try {
    const reservations = await api.get("/reservations");
    renderTable(document.getElementById("reservations-table"), [
      { label: "ID", render: (r) => `<span class="mono">${r.ReservationID}</span>` },
      { label: "Room", key: "RoomID" },
      { label: "Customer", key: "CustomerName" },
      { label: "Check-in", render: (r) => fmtDate(r.CheckIn) },
      { label: "Check-out", render: (r) => (r.CheckOut ? fmtDate(r.CheckOut) : "Currently checked in") },
      {
        label: "", render: (r) => (r.CheckOut ? "" :
          `<button class="btn btn-ghost btn-sm" data-checkout="${r.ReservationID}">Check out now</button>`),
      },
    ], reservations, { emptyText: "No reservations yet." });

    document.querySelectorAll("[data-checkout]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        try {
          await api.put(`/reservations/${btn.dataset.checkout}/checkout`, {
            check_out: new Date().toISOString().slice(0, 19).replace("T", " "),
          });
          showToast("Guest checked out.");
          loadReservations();
          loadRooms();
          loadDashboard();
        } catch (e) {
          showToast(e.message, true);
        }
      });
    });
  } catch (e) {
    showToast(e.message, true);
  }
}

// ---------------- Reference (halls/restaurants, read-only) ----------------
async function loadReference() {
  try {
    const halls = await api.get("/conference-halls");
    renderTable(document.getElementById("halls-table"), [
      { label: "ID", render: (r) => `<span class="mono">${r.HallID}</span>` },
      { label: "Name", key: "HallName" },
      { label: "Capacity", key: "Capacity" },
    ], halls, { emptyText: "No halls found." });
  } catch (e) { showToast(e.message, true); }

  try {
    const restaurants = await api.get("/restaurants");
    renderTable(document.getElementById("restaurants-table"), [
      { label: "ID", render: (r) => `<span class="mono">${r.RestaurantID}</span>` },
      { label: "Name", key: "RestaurantName" },
      { label: "Seats", key: "SeatingCapacity" },
    ], restaurants, { emptyText: "No restaurants found." });
  } catch (e) { showToast(e.message, true); }
}

// ---------------- Forms ----------------
function wireForms() {
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
    } catch (err) {
      showToast(err.message, true);
    }
  });

  document.getElementById("reservation-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const toApiDatetime = (v) => (v ? v.replace("T", " ") + ":00" : null);
    try {
      await api.post("/reservations", {
        room_id: document.getElementById("r-room").value.trim(),
        customer_id: document.getElementById("r-customer").value.trim(),
        check_in: toApiDatetime(document.getElementById("r-checkin").value),
        check_out: toApiDatetime(document.getElementById("r-checkout").value),
      });
      showToast("Reservation created.");
      e.target.reset();
      loadReservations();
      loadRooms();
      loadDashboard();
    } catch (err) {
      showToast(err.message, true);
    }
  });
}
