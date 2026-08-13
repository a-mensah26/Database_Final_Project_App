(async function initLandingPage() {
  // Check if session is already active, redirect if so
  try {
    const me = await api.get("/auth/me");
    goToDashboard(me.role);
  } catch (_) {
    // not logged in - stay on landing page
  }

  // Load public showcase data
  loadPublicShowcase();
  setupModalAndTabs();
  setupCustomerPortal();
  wireForms();
})();

function goToDashboard(role) {
  window.location.href = role === "Manager" ? "manager.html" : "frontdesk.html";
}

// ---------------- Load Public Showcase ----------------
async function loadPublicShowcase() {
  const eventsContainer = document.getElementById("public-events-list");

  try {
    const events = await api.get("/public/events");
    if (!events || events.length === 0) {
      eventsContainer.innerHTML = `<div class="empty-state">No upcoming public events scheduled yet.</div>`;
    } else {
      renderTable(eventsContainer, [
        { label: "Event Type", key: "EventType" },
        { label: "Date", render: (r) => new Date(r.EventDate).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) },
        { label: "Duration", render: (r) => `${r.EventDuration} hrs` },
        { label: "Hall", key: "HallName" },
        { label: "Capacity", key: "Capacity" }
      ], events, { emptyText: "No events scheduled." });
    }
  } catch (e) {
    eventsContainer.innerHTML = `<div class="empty-state" style="color:var(--danger)">Failed to load events.</div>`;
  }
}

// ---------------- Setup Modal and Tabs ----------------
function setupModalAndTabs() {
  const modal = document.getElementById("portal-modal");
  const openBtn = document.getElementById("open-portal-btn");
  const closeBtn = document.getElementById("close-portal-btn");

  // Open / Close Modal
  openBtn.addEventListener("click", () => {
    document.getElementById("error-banner").classList.remove("show");
    modal.classList.add("open");
  });
  closeBtn.addEventListener("click", () => {
    modal.classList.remove("open");
  });
  
  // Close modal if clicking outside the card
  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      modal.classList.remove("open");
    }
  });
}

// ---------------- Forms Wiring ----------------
function wireForms() {
  const errorBanner = document.getElementById("error-banner");

  // Login Form
  const loginForm = document.getElementById("login-form");
  const submitBtn = document.getElementById("submit-btn");

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorBanner.classList.remove("show");
    submitBtn.disabled = true;
    submitBtn.textContent = "Signing in…";

    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value;

    try {
      const me = await api.post("/auth/login", { username, password });
      goToDashboard(me.role);
    } catch (err) {
      errorBanner.textContent = err.message || "Sign in failed.";
      errorBanner.classList.add("show");
      submitBtn.disabled = false;
      submitBtn.textContent = "Sign In";
    }
  });
}

// ---------------- Customer Booking & Tracking ----------------
function setupCustomerPortal() {
  const tabRequestBtn = document.getElementById("tab-request-btn");
  const tabTrackBtn = document.getElementById("tab-track-btn");
  const panelRequest = document.getElementById("panel-request");
  const panelTrack = document.getElementById("panel-track");

  // Tab navigation
  tabRequestBtn.addEventListener("click", () => {
    tabRequestBtn.classList.add("active");
    tabTrackBtn.classList.remove("active");
    panelRequest.classList.add("active");
    panelTrack.classList.remove("active");
  });

  tabTrackBtn.addEventListener("click", () => {
    tabTrackBtn.classList.add("active");
    tabRequestBtn.classList.remove("active");
    panelTrack.classList.add("active");
    panelRequest.classList.remove("active");
  });

  // Stay Request Submit
  const bookingForm = document.getElementById("customer-booking-form");
  const submitBtn = document.getElementById("cust-submit-btn");

  bookingForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const payload = {
      fname: document.getElementById("cust-fname").value.trim(),
      lname: document.getElementById("cust-lname").value.trim(),
      phone: document.getElementById("cust-phone").value.trim(),
      room_type: document.getElementById("cust-roomtype").value,
      check_in: document.getElementById("cust-checkin").value,
      check_out: document.getElementById("cust-checkout").value
    };

    if (!payload.check_in || !payload.check_out) {
      showToast("Check-in and Check-out dates are required.", true);
      return;
    }

    const checkInDate = new Date(payload.check_in);
    const checkOutDate = new Date(payload.check_out);
    if (checkOutDate <= checkInDate) {
      showToast("Check-out date must be after check-in date.", true);
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Submitting Stay Request…";

    try {
      const res = await api.post("/public/requests", payload);
      showToast("Stay request submitted successfully!");
      
      // Render token information card
      const resultContainer = document.getElementById("track-result-container");
      resultContainer.style.display = "block";
      resultContainer.innerHTML = `
        <div class="status-tracking-card" style="border-left: 6px solid var(--accent);">
          <div class="status-badge pending">Pending Approval</div>
          <h3 class="status-title" style="margin-top:0.75rem;">Your stay request was received!</h3>
          <p style="font-size:0.9rem; color:var(--text-muted); margin-bottom:1rem;">
            Please write down your tracking token below. You can track your booking status anytime using the status tab.
          </p>
          <div style="font-size: 1.5rem; font-weight: 700; color: var(--accent); background: var(--primary-light); padding: 0.75rem 1rem; border-radius: 6px; display: inline-block; font-family: 'IBM Plex Mono', monospace; margin-bottom: 1rem;">
            ${res.token}
          </div>
          <div style="font-size:0.85rem; color:var(--text-muted);">
            Name: ${payload.fname} ${payload.lname} | Type: ${payload.room_type}
          </div>
        </div>
      `;

      // Auto-switch to Track tab and input token
      tabTrackBtn.click();
      document.getElementById("track-token").value = res.token;
      bookingForm.reset();
    } catch (err) {
      showToast(err.message || "Failed to submit request.", true);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Submit Stay Request";
    }
  });

  // Tracking Submit
  const trackForm = document.getElementById("customer-track-form");
  const trackSubmitBtn = document.getElementById("track-submit-btn");
  const resultContainer = document.getElementById("track-result-container");

  trackForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    trackSubmitBtn.disabled = true;
    trackSubmitBtn.textContent = "Searching…";
    resultContainer.style.display = "none";

    const token = document.getElementById("track-token").value.trim().toUpperCase();
    if (!token) {
      trackSubmitBtn.disabled = false;
      trackSubmitBtn.textContent = "Track Status";
      return;
    }

    try {
      const req = await api.get(`/public/requests/${token}`);
      resultContainer.style.display = "block";
      
      let badgeClass = "pending";
      let statusText = "Pending Review";
      let statusDesc = "Your request is currently being reviewed by our front desk staff. No action is required from you.";
      let borderCol = "var(--accent)";

      if (req.Status === "Approved") {
        badgeClass = "approved";
        statusText = "Approved & Confirmed";
        statusDesc = `Welcome home! Your request has been approved. Room <strong>${req.RoomNo}</strong> was assigned.`;
        borderCol = "var(--success)";
      } else if (req.Status === "Declined") {
        badgeClass = "declined";
        statusText = "Declined";
        statusDesc = "Unfortunately, we cannot accommodate your stay request at this time. Please contact front desk support.";
        borderCol = "var(--danger)";
      }

      resultContainer.innerHTML = `
        <div class="status-tracking-card" style="border-left: 6px solid ${borderCol};">
          <div class="status-badge ${badgeClass}">${statusText}</div>
          <h3 class="status-title" style="margin-top:0.75rem;">Status for Token: ${req.RequestToken}</h3>
          <p style="font-size:0.9rem; color:var(--text-main); margin-bottom:1rem;">
            ${statusDesc}
          </p>
          <div style="font-size:0.85rem; color:var(--text-muted); line-height:1.5; border-top: 1px solid var(--line); padding-top: 0.75rem;">
            <strong>Guest Name:</strong> ${req.CustomerFName} ${req.CustomerLName}<br/>
            <strong>Room Type:</strong> ${req.RoomType}<br/>
            <strong>Dates:</strong> ${new Date(req.CheckIn).toLocaleString()} to ${new Date(req.CheckOut).toLocaleString()}
          </div>
        </div>
      `;
    } catch (err) {
      resultContainer.style.display = "block";
      resultContainer.innerHTML = `
        <div class="status-tracking-card" style="border-left: 6px solid var(--danger);">
          <div class="status-badge declined">Error</div>
          <h3 class="status-title" style="margin-top:0.75rem;">Request Not Found</h3>
          <p style="font-size:0.9rem; color:var(--text-muted);">
            The token entered was not found. Please double-check your receipt token and try again.
          </p>
        </div>
      `;
    } finally {
      trackSubmitBtn.disabled = false;
      trackSubmitBtn.textContent = "Track Status";
    }
  });
}
