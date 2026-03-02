package storage

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"city-map-poster-generator/apps/api/internal/config"
	"github.com/aws/aws-sdk-go-v2/aws"
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

type Client struct {
	cfg     config.Config
	s3      *s3.Client
	presign *s3.PresignClient
}

func New(ctx context.Context, cfg config.Config) (*Client, error) {
	internalClient, err := newS3Client(ctx, cfg, strings.TrimSpace(cfg.S3EndpointURL))
	if err != nil {
		return nil, err
	}
	presignClient, err := newS3Client(ctx, cfg, presignEndpoint(cfg.S3EndpointURL, cfg.S3PublicEndpointURL))
	if err != nil {
		return nil, err
	}

	return &Client{
		cfg:     cfg,
		s3:      internalClient,
		presign: s3.NewPresignClient(presignClient),
	}, nil
}

func newS3Client(ctx context.Context, cfg config.Config, endpointURL string) (*s3.Client, error) {
	awsCfg, err := awsconfig.LoadDefaultConfig(
		ctx,
		awsconfig.WithRegion(cfg.S3Region),
		awsconfig.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(cfg.S3AccessKeyID, cfg.S3SecretAccessKey, "")),
	)
	if err != nil {
		return nil, fmt.Errorf("load aws config: %w", err)
	}

	endpointURL = strings.TrimSpace(endpointURL)
	return s3.NewFromConfig(awsCfg, func(o *s3.Options) {
		if endpointURL != "" {
			o.BaseEndpoint = aws.String(endpointURL)
		}
		o.UsePathStyle = true
		// MinIO/S3-compatible providers may reject optional checksum query params
		// on presigned GET URLs; keep checksums only when an operation requires it.
		o.RequestChecksumCalculation = aws.RequestChecksumCalculationWhenRequired
		o.ResponseChecksumValidation = aws.ResponseChecksumValidationWhenRequired
	}), nil
}

func presignEndpoint(internalURL, publicURL string) string {
	publicURL = strings.TrimSpace(publicURL)
	if publicURL != "" {
		return publicURL
	}
	return strings.TrimSpace(internalURL)
}

func (c *Client) EnsureBuckets(ctx context.Context) error {
	for _, bucket := range []string{c.cfg.S3BucketPreviews, c.cfg.S3BucketArtifacts} {
		_, err := c.s3.HeadBucket(ctx, &s3.HeadBucketInput{Bucket: aws.String(bucket)})
		if err == nil {
			continue
		}
		_, createErr := c.s3.CreateBucket(ctx, &s3.CreateBucketInput{Bucket: aws.String(bucket)})
		if createErr != nil {
			return fmt.Errorf("ensure bucket %s: %w", bucket, createErr)
		}
	}
	return nil
}

func (c *Client) ObjectExists(ctx context.Context, bucket, key string) bool {
	_, err := c.s3.HeadObject(ctx, &s3.HeadObjectInput{Bucket: aws.String(bucket), Key: aws.String(key)})
	return err == nil
}

func (c *Client) UploadFile(ctx context.Context, bucket, key, path, contentType string) error {
	f, err := os.Open(filepath.Clean(path))
	if err != nil {
		return err
	}
	defer f.Close()
	_, err = c.s3.PutObject(ctx, &s3.PutObjectInput{
		Bucket:      aws.String(bucket),
		Key:         aws.String(key),
		Body:        f,
		ContentType: aws.String(contentType),
	})
	return err
}

func (c *Client) UploadBytes(ctx context.Context, bucket, key string, data []byte, contentType string) error {
	_, err := c.s3.PutObject(ctx, &s3.PutObjectInput{
		Bucket:      aws.String(bucket),
		Key:         aws.String(key),
		Body:        bytes.NewReader(data),
		ContentType: aws.String(contentType),
	})
	return err
}

func (c *Client) UploadReader(ctx context.Context, bucket, key string, reader io.Reader, contentType string) error {
	_, err := c.s3.PutObject(ctx, &s3.PutObjectInput{
		Bucket:      aws.String(bucket),
		Key:         aws.String(key),
		Body:        reader,
		ContentType: aws.String(contentType),
	})
	return err
}

func (c *Client) SignedURL(ctx context.Context, bucket, key string, ttlSeconds int) (string, error) {
	resp, err := c.presign.PresignGetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(bucket),
		Key:    aws.String(key),
	}, s3.WithPresignExpires(time.Duration(ttlSeconds)*time.Second))
	if err != nil {
		return "", err
	}
	return resp.URL, nil
}

func (c *Client) SignedPutURL(ctx context.Context, bucket, key, contentType string, ttlSeconds int) (string, error) {
	resp, err := c.presign.PresignPutObject(ctx, &s3.PutObjectInput{
		Bucket:      aws.String(bucket),
		Key:         aws.String(key),
		ContentType: aws.String(contentType),
	}, s3.WithPresignExpires(time.Duration(ttlSeconds)*time.Second))
	if err != nil {
		return "", err
	}
	return resp.URL, nil
}

func (c *Client) GetObjectBytes(ctx context.Context, bucket, key string) ([]byte, error) {
	resp, err := c.s3.GetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(bucket),
		Key:    aws.String(key),
	})
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	return io.ReadAll(resp.Body)
}

type ObjectMeta struct {
	Size        int64
	ETag        string
	ContentType string
}

func (c *Client) HeadObject(ctx context.Context, bucket, key string) (*ObjectMeta, error) {
	out, err := c.s3.HeadObject(ctx, &s3.HeadObjectInput{
		Bucket: aws.String(bucket),
		Key:    aws.String(key),
	})
	if err != nil {
		return nil, err
	}
	var size int64
	if out.ContentLength != nil {
		size = *out.ContentLength
	}
	meta := &ObjectMeta{
		Size: size,
		ETag: strings.TrimSpace(strings.Trim(*out.ETag, `"`)),
	}
	if out.ContentType != nil {
		meta.ContentType = strings.TrimSpace(*out.ContentType)
	}
	return meta, nil
}

func UploadWithSignedPUT(ctx context.Context, url string, payload []byte, contentType string) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodPut, url, bytes.NewReader(payload))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", contentType)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 1024))
		return fmt.Errorf("signed put failed with %d: %s", resp.StatusCode, strings.TrimSpace(string(body)))
	}
	return nil
}
