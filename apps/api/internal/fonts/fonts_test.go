package fonts

import "testing"

func TestParseWeightKey(t *testing.T) {
	cases := map[string]int{
		"regular": 400,
		"bold":    700,
		"300":     300,
		"300i":    300,
		"light":   300,
		"invalid": 0,
	}
	for input, expected := range cases {
		if got := parseWeightKey(input); got != expected {
			t.Fatalf("parseWeightKey(%q) = %d, expected %d", input, got, expected)
		}
	}
}

func TestPickWeightURLSelectsClosestWeight(t *testing.T) {
	files := map[string]string{
		"300": "https://example.com/light.ttf",
		"400": "https://example.com/regular.ttf",
		"700": "https://example.com/bold.ttf",
	}
	if got := pickWeightURL(files, 700); got != "https://example.com/bold.ttf" {
		t.Fatalf("expected bold url, got %s", got)
	}
	if got := pickWeightURL(files, 500); got != "https://example.com/regular.ttf" {
		t.Fatalf("expected regular url as closest match, got %s", got)
	}
}
