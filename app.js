let allCheckins = [];
let trips = [];
let markerLayer;
let map;

const $ = (id) => document.getElementById(id);

function dateOnly(iso) {
  return iso ? iso.slice(0, 10) : "";
}

function niceDate(iso) {
  if (!iso) return "Unknown date";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
  }[c]));
}

function tripOptions() {
  $("trip").innerHTML =
    `<option value="">All check-ins</option>` +
    trips.map(t => `<option value="${esc(t.id)}">${esc(t.name)}</option>`).join("");
}

function setTripDates() {
  const id = $("trip").value;
  const trip = trips.find(t => t.id === id);

  if (!trip) {
    $("start").value = "";
    $("end").value = "";
  } else {
     $("start").value = trip.start;
     $("end").value = trip.end;
  }

  draw.hasFit = false;
  draw();
}

function filtered() {
  const start = $("start").value;
  const end = $("end").value;
  const q = $("search").value.trim().toLowerCase();

  return allCheckins.filter(c => {
    const d = dateOnly(c.date);
    if (start && d < start) return false;
    if (end && d > end) return false;
    if (q) {
      const hay = [c.beer, c.brewery, c.venue, c.city, c.state, c.country, c.style]
        .join(" ").toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

function clearMarkers() {
  if (markerLayer) markerLayer.clearLayers();
}

function popup(c) {
  const rating = c.rating ? `⭐ ${c.rating.toFixed(2)}` : "No rating";
  return `<strong>${esc(c.beer)}</strong><br>${esc(c.brewery)}<br>${rating}<br>${esc(c.venue || "No venue")}<br>${esc(c.city)}${c.state ? ", " + esc(c.state) : ""}<br>${esc(niceDate(c.date))}`;
}

function showDetails(c) {
  $("details").innerHTML = `
    <h2>Check-in details</h2>
    <div class="detail-title">${esc(c.beer)}</div>
    <div class="detail-brewery">${esc(c.brewery)}</div>
    <div class="detail-grid">
      <div><strong>Date</strong>${esc(niceDate(c.date))}</div>
      <div><strong>Rating</strong>${c.rating ? "⭐ " + esc(c.rating.toFixed(2)) : "—"}</div>
      <div><strong>Venue</strong>${esc(c.venue || "—")}</div>
      <div><strong>Location</strong>${esc([c.city, c.state, c.country].filter(Boolean).join(", ") || "—")}</div>
      <div><strong>Style</strong>${esc(c.style || "—")}</div>
      <div><strong>ABV</strong>${c.abv != null ? esc(c.abv) + "%" : "—"}</div>
      <div><strong>Serving</strong>${esc(c.serving || "—")}</div>
      <div><strong>Photo</strong>${c.photo ? "Yes" : "No"}</div>
    </div>`;
}

function draw() {
  clearMarkers();
  const rows = filtered();
  const bounds = [];

  markerLayer = L.markerClusterGroup({
    showCoverageOnHover: true,
    spiderfyOnMaxZoom: true,
    spiderfyDistanceMultiplier: 1.35,
    removeOutsideVisibleBounds: true,
    disableClusteringAtZoom: 15,
    maxClusterRadius: 55,
    animate: true,
    animateAddingMarkers: false
  });

  rows.forEach(c => {
    const m = L.marker([c.lat, c.lng], {
    });
    m.bindPopup(popup(c));
    m.on("click", () => showDetails(c));
    markerLayer.addLayer(m);
    bounds.push([c.lat, c.lng]);
  });

  markerLayer.addTo(map);

  const tripId = $("trip").value;
  const trip = trips.find(t => t.id === tripId);
  $("summary").textContent =
    `${rows.length.toLocaleString()} mapped check-ins` +
    (trip ? ` • ${trip.name}` : "") +
    (allCheckins.length !== rows.length ? ` • ${allCheckins.length.toLocaleString()} total mapped` : "") +
    " • zoom in to separate busy locations";

  if (bounds.length && !draw.hasFit) {
    map.fitBounds(bounds, { padding: [30, 30] });
    draw.hasFit = true;
  }
}

async function init() {
  try {
    if (typeof L === "undefined") {
      throw new Error("Leaflet did not load. Check the browser console for the CDN error.");
    }
    const response = await fetch("checkins.json");
    const data = await response.json();
    allCheckins = data.checkins || [];
    trips = data.trips || [];
    tripOptions();
    
    map = L.map("map").setView([39.5, -98.35], 4);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    const params = new URLSearchParams(window.location.search);
    const tripId = params.get("trip");

    if (tripId) {
      $("trip").value = tripId;
      setTripDates();

      history.replaceState({}, "", window.location.pathname);
    }    

    $("trip").addEventListener("change", setTripDates);
    $("start").addEventListener("change", () => { $("trip").value = ""; draw(); });
    $("end").addEventListener("change", () => { $("trip").value = ""; draw(); });
    $("search").addEventListener("input", draw);
    $("reset").addEventListener("click", () => {
      $("trip").value = "";
      $("start").value = "";
      $("end").value = "";
      $("search").value = "";
      draw.hasFit = false;
      draw();
    });

    draw();
  } catch (err) {
    $("summary").textContent = "Could not load check-in data.";
    console.error(err);
  }
}

init();
