// LocalStorage helpers for FairXI

const SQUAD_KEY = 'fairxi_saved_squad';
const MATCHES_KEY = 'fairxi_my_matches';

export const getSavedSquad = () => {
  try {
    return JSON.parse(localStorage.getItem(SQUAD_KEY) || '[]');
  } catch {
    return [];
  }
};

export const saveSquad = (players) => {
  const clean = (players || []).map((p) => ({
    name: p.name,
    phone: p.phone,
    position: p.position,
    rating: p.rating,
  }));
  localStorage.setItem(SQUAD_KEY, JSON.stringify(clean));
};

export const clearSquad = () => localStorage.removeItem(SQUAD_KEY);

export const getMyMatches = () => {
  try {
    return JSON.parse(localStorage.getItem(MATCHES_KEY) || '[]');
  } catch {
    return [];
  }
};

export const addMyMatch = (m) => {
  const all = getMyMatches();
  // dedupe by match_id
  const filtered = all.filter((x) => x.match_id !== m.match_id);
  filtered.unshift({
    match_id: m.match_id,
    admin_token: m.admin_token,
    name: m.name,
    date_time: m.date_time,
    location: m.location,
    created_at: new Date().toISOString(),
  });
  localStorage.setItem(MATCHES_KEY, JSON.stringify(filtered.slice(0, 50)));
};

export const removeMyMatch = (match_id) => {
  const all = getMyMatches().filter((x) => x.match_id !== match_id);
  localStorage.setItem(MATCHES_KEY, JSON.stringify(all));
};
