package httpapi

import (
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

type apiMetrics struct {
	registry *prometheus.Registry

	requestDuration *prometheus.HistogramVec
	requestTotal    *prometheus.CounterVec
	cacheEvents     *prometheus.CounterVec
}

func newAPIMetrics() *apiMetrics {
	registry := prometheus.NewRegistry()
	m := &apiMetrics{
		registry: registry,
		requestDuration: prometheus.NewHistogramVec(
			prometheus.HistogramOpts{
				Namespace: "city_map",
				Subsystem: "api",
				Name:      "http_request_duration_seconds",
				Help:      "HTTP request duration for selected API endpoints.",
				Buckets: []float64{
					0.05, 0.1, 0.2, 0.35, 0.5, 0.75, 1.0, 1.5, 2.5, 5.0,
				},
			},
			[]string{"route", "method"},
		),
		requestTotal: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Namespace: "city_map",
				Subsystem: "api",
				Name:      "http_requests_total",
				Help:      "HTTP request totals for selected API endpoints.",
			},
			[]string{"route", "method", "status"},
		),
		cacheEvents: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Namespace: "city_map",
				Subsystem: "api",
				Name:      "cache_events_total",
				Help:      "Cache hit and miss totals for hot paths.",
			},
			[]string{"cache", "result"},
		),
	}
	registry.MustRegister(m.requestDuration, m.requestTotal, m.cacheEvents)
	return m
}

func (m *apiMetrics) handler() http.Handler {
	return promhttp.HandlerFor(m.registry, promhttp.HandlerOpts{})
}

func (m *apiMetrics) observeCache(cacheName string, hit bool) {
	result := "miss"
	if hit {
		result = "hit"
	}
	m.cacheEvents.WithLabelValues(cacheName, result).Inc()
}

func (m *apiMetrics) middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		wrapped := &statusRecorder{ResponseWriter: w, statusCode: http.StatusOK}
		start := time.Now()

		next.ServeHTTP(wrapped, r)

		route := routePattern(r)
		if !shouldTrackRoute(route) {
			return
		}
		duration := time.Since(start).Seconds()
		method := strings.ToUpper(strings.TrimSpace(r.Method))
		status := strconv.Itoa(wrapped.statusCode)

		m.requestDuration.WithLabelValues(route, method).Observe(duration)
		m.requestTotal.WithLabelValues(route, method, status).Inc()
	})
}

type statusRecorder struct {
	http.ResponseWriter
	statusCode int
}

func (s *statusRecorder) WriteHeader(statusCode int) {
	s.statusCode = statusCode
	s.ResponseWriter.WriteHeader(statusCode)
}

func routePattern(r *http.Request) string {
	routeCtx := chi.RouteContext(r.Context())
	if routeCtx != nil {
		route := strings.TrimSpace(routeCtx.RoutePattern())
		if route != "" {
			return route
		}
	}
	return strings.TrimSpace(r.URL.Path)
}

func shouldTrackRoute(route string) bool {
	switch route {
	case "/v2/locations", "/v2/preview", "/v2/render/snapshot":
		return true
	default:
		return false
	}
}
