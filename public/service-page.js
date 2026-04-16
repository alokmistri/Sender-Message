(function () {
  async function loadServiceAd() {
    try {
      const response = await fetch("/api/ads/active?slot=services");
      const data = await response.json();
      if (!response.ok || !data.ad || !data.ad.imageUrl) return;
      document.getElementById("serviceAdImage").src = data.ad.imageUrl;
      document.getElementById("serviceAdText").textContent = data.ad.adText || "Featured service";
      document.getElementById("serviceAdLink").href = data.ad.adLink || "#";
      document.getElementById("serviceAdCard").classList.remove("is-hidden");
    } catch (error) {}
  }

  loadServiceAd();
})();
