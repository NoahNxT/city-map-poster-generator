import http from "k6/http";
import { check, sleep } from "k6";

const API_BASE = __ENV.API_BASE_URL || "http://localhost:8000";

export const options = {
  thresholds: {
    http_req_failed: ["rate<0.02"],
    http_req_duration: ["p(95)<1200"],
  },
  scenarios: {
    snapshot_requests: {
      executor: "ramping-vus",
      startVUs: 5,
      stages: [
        { duration: "30s", target: Number(__ENV.PEAK_VUS || 20) },
        { duration: "60s", target: Number(__ENV.PEAK_VUS || 20) },
        { duration: "20s", target: 0 },
      ],
    },
  },
};

const payload = JSON.stringify({
  city: "Antwerp",
  country: "Belgium",
  latitude: "51.2211097",
  longitude: "4.3997081",
  distance: 12000,
  width: 11.81,
  height: 15.75,
  includeWater: true,
  includeParks: true,
});

const params = {
  headers: {
    "Content-Type": "application/json",
  },
};

export default function () {
  const response = http.post(`${API_BASE}/v2/render/snapshot`, payload, params);
  check(response, {
    "status is 200": (r) => r.status === 200,
  });
  sleep(0.3);
}
