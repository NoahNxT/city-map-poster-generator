package storage

import "testing"

func TestPresignEndpoint_PrefersPublicEndpoint(t *testing.T) {
	internal := "http://minio:9000"
	public := "http://localhost:9000"

	got := presignEndpoint(internal, public)
	if got != public {
		t.Fatalf("expected public endpoint %q, got %q", public, got)
	}
}

func TestPresignEndpoint_FallsBackToInternalEndpoint(t *testing.T) {
	internal := "http://minio:9000"

	got := presignEndpoint(internal, "")
	if got != internal {
		t.Fatalf("expected internal endpoint %q, got %q", internal, got)
	}
}
