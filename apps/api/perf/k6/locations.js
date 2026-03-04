import http from "k6/http";
import { check, sleep } from "k6";

const API_BASE = __ENV.API_BASE_URL || "http://localhost:8000";

export const options = {
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<350"],
  },
  scenarios: {
    warm_cache_locations: {
      executor: "constant-vus",
      vus: Number(__ENV.VUS || 15),
      duration: __ENV.DURATION || "90s",
    },
  },
};

const queries = [
  "Antwerp, Belgium",
  "Paris, France",
  "Berlin, Germany",
  "Amsterdam, Netherlands",
  "Brussels, Belgium",
];

export default function () {
  const query = queries[Math.floor(Math.random() * queries.length)];
  const response = http.get(
    `${API_BASE}/v2/locations?q=${encodeURIComponent(query)}&limit=8`,
  );
  check(response, {
    "status is 200": (r) => r.status === 200,
  });
  sleep(0.2);
}
