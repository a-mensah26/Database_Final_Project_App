(async function redirectIfAlreadyLoggedIn() {
  try {
    const me = await api.get("/auth/me");
    goToDashboard(me.role);
  } catch (_) {
    // not logged in — stay on the login page
  }
})();

function goToDashboard(role) {
  window.location.href = role === "Manager" ? "manager.html" : "frontdesk.html";
}

const form = document.getElementById("login-form");
const errorBanner = document.getElementById("error-banner");
const submitBtn = document.getElementById("submit-btn");

form.addEventListener("submit", async (e) => {
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
    submitBtn.textContent = "Sign in";
  }
});
