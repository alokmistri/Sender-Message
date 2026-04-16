(function () {
  const body = document.body;
  if (!body || body.classList.contains("admin-body") || body.classList.contains("splash-body")) {
    return;
  }

  const links = [
    { label: "About Us", path: "/about" },
    { label: "Support", path: "/support" },
    { label: "Terms & Policy", path: "/terms" },
    { label: "Why Choose Us", path: "/why" }
  ];

  const currentPath = window.location.pathname;
  const nav = document.createElement("nav");
  nav.className = "top-nav";

  const inner = document.createElement("div");
  inner.className = "top-nav-inner";

  links.forEach((item) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "top-nav-button";
    if (currentPath === item.path || currentPath === `${item.path}.html`) {
      button.classList.add("is-active");
    }
    button.textContent = item.label;
    button.addEventListener("click", () => {
      window.location.href = item.path;
    });
    inner.appendChild(button);
  });

  nav.appendChild(inner);
  body.insertBefore(nav, body.firstChild);
  body.classList.add("has-top-nav");
})();
