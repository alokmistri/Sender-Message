(function () {
  const seenOnboarding = localStorage.getItem("seenOnboarding");
  const isLocalhost =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1";

  if (seenOnboarding === "true" && !isLocalhost) {
    window.location.replace("/signup.html");
    return;
  }

  const screens = [
    {
      title: "Bulk Messaging Services",
      description: "Send messages to multiple users instantly and grow your business.",
      artClass: "onboarding-art-bulk"
    },
    {
      title: "Masking Message Services",
      description: "Send messages using your business name to build trust.",
      artClass: "onboarding-art-mask"
    },
    {
      title: "Send WhatsApp Messages in Bulk",
      description: "Send rich messages with images and links via WhatsApp.",
      artClass: "onboarding-art-whatsapp"
    },
    {
      title: "Send Bulk Email Messages",
      description: "Send professional emails to your customers easily.",
      artClass: "onboarding-art-email"
    }
  ];

  let currentScreen = 0;

  const stepText = document.getElementById("onboardingStepText");
  const title = document.getElementById("onboardingTitle");
  const description = document.getElementById("onboardingDescription");
  const art = document.getElementById("onboardingArt");
  const dots = Array.from(document.querySelectorAll(".onboarding-dot"));
  const prevButton = document.getElementById("onboardingPrevBtn");
  const nextButton = document.getElementById("onboardingNextBtn");

  function renderScreen() {
    const screen = screens[currentScreen];

    stepText.textContent = `Step ${currentScreen + 1} of ${screens.length}`;
    title.textContent = screen.title;
    description.textContent = screen.description;
    art.className = `onboarding-art ${screen.artClass}`;

    dots.forEach((dot, index) => {
      dot.classList.toggle("is-active", index === currentScreen);
    });

    prevButton.disabled = currentScreen === 0;
    prevButton.classList.toggle("is-disabled", currentScreen === 0);
    nextButton.textContent = currentScreen === screens.length - 1 ? "Sign Up" : "Next";
  }

  function next() {
    if (currentScreen === screens.length - 1) {
      localStorage.setItem("seenOnboarding", "true");
      window.location.href = "/signup.html";
      return;
    }

    currentScreen += 1;
    renderScreen();
  }

  function prev() {
    if (currentScreen === 0) {
      return;
    }

    currentScreen -= 1;
    renderScreen();
  }

  nextButton.addEventListener("click", next);
  prevButton.addEventListener("click", prev);

  renderScreen();
})();
