import { useEffect, useState } from "react";
import { API_URL, apiFetch } from "../api";
import { APP_CONFIG } from "../config";

// Suggestions for "where" fields: our campus places plus event venues from our partner, Team 4.
// Students can still type anything (it's a <datalist>, not a fixed dropdown).
//
// Venues come from OUR server (/api/partner-venues, Week 10/11), which calls Team 4 and keeps a saved copy.
// If Team 4 is down and nothing is saved, the list simply has the campus places only: the form never breaks.
//
// Use: <input list="place-suggestions" ... /> <PlaceSuggestions id="place-suggestions" />

let venuesRequest = null; // one request per page load, shared by every field on the page

function loadVenues() {
  if (!venuesRequest) {
    venuesRequest = apiFetch(`${API_URL}/api/partner-venues`)
      .then((response) => (response.ok ? response.json() : []))
      .then((data) => (Array.isArray(data) ? data : []))
      .catch(() => []);
  }
  return venuesRequest;
}

function PlaceSuggestions({ id, showNote = true }) {
  const [venues, setVenues] = useState([]);

  useEffect(() => {
    let active = true;
    loadVenues().then((list) => {
      if (active) setVenues(list);
    });
    return () => {
      active = false;
    };
  }, []);

  const campus = new Set(APP_CONFIG.campusPlaces.map((p) => p.toLowerCase()));
  const partner = venues.filter((v) => v && v.name && !campus.has(v.name.toLowerCase()));

  return (
    <>
      <datalist id={id}>
        {APP_CONFIG.campusPlaces.map((p) => (
          <option key={`campus-${p}`} value={p} />
        ))}
        {partner.map((v) => (
          <option key={`venue-${v.id}`} value={v.name} label={`Event venue${v.location ? ` · ${v.location}` : ""}`} />
        ))}
      </datalist>
      {showNote && partner.length > 0 && (
        <small className="muted" style={{ display: "block", marginTop: "4px" }}>
          Suggestions include {partner.length} event venue{partner.length === 1 ? "" : "s"} from our partner, Team 4.
        </small>
      )}
    </>
  );
}

export default PlaceSuggestions;
