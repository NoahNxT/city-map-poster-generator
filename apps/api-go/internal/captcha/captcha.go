package captcha

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"city-map-poster-generator/apps/api-go/internal/config"
)

type Verifier struct {
	cfg    config.Config
	client *http.Client
}

func New(cfg config.Config) *Verifier {
	return &Verifier{
		cfg: cfg,
		client: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

func (v *Verifier) Verify(ctx context.Context, token *string, remoteIP string) error {
	if !v.cfg.CaptchaRequired {
		return nil
	}
	if strings.TrimSpace(v.cfg.TurnstileSecret) == "" {
		return fmt.Errorf("CAPTCHA is enabled but TURNSTILE_SECRET_KEY is missing")
	}
	if token == nil || strings.TrimSpace(*token) == "" {
		return fmt.Errorf("captchaToken is required")
	}

	form := url.Values{}
	form.Set("secret", v.cfg.TurnstileSecret)
	form.Set("response", strings.TrimSpace(*token))
	form.Set("remoteip", remoteIP)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, v.cfg.TurnstileVerifyURL, strings.NewReader(form.Encode()))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := v.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	var payload struct {
		Success bool `json:"success"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return err
	}
	if !payload.Success {
		return fmt.Errorf("CAPTCHA verification failed")
	}
	return nil
}
