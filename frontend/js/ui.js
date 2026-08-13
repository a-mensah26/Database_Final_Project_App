function showToast(message, isError) {
  let el = document.getElementById("toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "toast";
    el.className = "toast";
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.className = "toast show" + (isError ? " toast-error" : "");
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.remove("show"), 3200);
}

function setupTabs() {
  const tabs = document.querySelectorAll(".tab");
  const panels = document.querySelectorAll(".panel");
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.remove("active"));
      panels.forEach((p) => p.classList.remove("active"));
      tab.classList.add("active");
      document.getElementById(tab.dataset.panel).classList.add("active");
    });
  });
}

function renderTable(container, columns, rows, opts) {
  opts = opts || {};
  if (!rows || rows.length === 0) {
    container.innerHTML = `<div class="empty-state">${opts.emptyText || "Nothing here yet."}</div>`;
    return;
  }
  const thead = `<thead><tr>${columns.map((c) => `<th>${c.label}</th>`).join("")}</tr></thead>`;
  const tbody = `<tbody>${rows
    .map((row) => `<tr>${columns.map((c) => `<td>${c.render ? c.render(row) : (row[c.key] ?? "")}</td>`).join("")}</tr>`)
    .join("")}</tbody>`;
  container.innerHTML = `<div class="table-wrap"><table>${thead}${tbody}</table></div>`;
}

function statusPill(status) {
  const cls = status === "Vacant" ? "pill-vacant" : "pill-occupied";
  const dot = status === "Vacant" ? "dot-vacant" : "dot-occupied";
  return `<span class="pill ${cls}"><span class="dot ${dot}"></span>${status}</span>`;
}

function fmtMoney(n) {
  if (n === null || n === undefined) return "—";
  return `GH₵ ${Number(n).toFixed(2)}`;
}

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleString(undefined, {
    year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

async function requireSession(allowedRoles, redirectTo) {
  try {
    const me = await api.get("/auth/me");
    if (!allowedRoles.includes(me.role)) {
      window.location.href = redirectTo || "index.html";
      return null;
    }
    return me;
  } catch (e) {
    window.location.href = "index.html";
    return null;
  }
}
