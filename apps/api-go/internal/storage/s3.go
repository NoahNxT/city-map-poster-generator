package storage

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"

	"city-map-poster-generator/apps/api-go/internal/config"
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
	awsCfg, err := awsconfig.LoadDefaultConfig(
		ctx,
		awsconfig.WithRegion(cfg.S3Region),
		awsconfig.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(cfg.S3AccessKeyID, cfg.S3SecretAccessKey, "")),
		awsconfig.WithEndpointResolverWithOptions(
			aws.EndpointResolverWithOptionsFunc(func(service, region string, _ ...interface{}) (aws.Endpoint, error) {
				if service == s3.ServiceID {
					return aws.Endpoint{URL: cfg.S3EndpointURL, HostnameImmutable: true}, nil
				}
				return aws.Endpoint{}, &aws.EndpointNotFoundError{}
			}),
		),
	)
	if err != nil {
		return nil, fmt.Errorf("load aws config: %w", err)
	}

	s3Client := s3.NewFromConfig(awsCfg, func(o *s3.Options) {
		o.UsePathStyle = true
	})

	return &Client{
		cfg:     cfg,
		s3:      s3Client,
		presign: s3.NewPresignClient(s3Client),
	}, nil
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
	return rewritePublicURL(resp.URL, c.cfg.S3PublicEndpointURL), nil
}

func rewritePublicURL(rawURL, publicBase string) string {
	if strings.TrimSpace(publicBase) == "" {
		return rawURL
	}
	source, err := url.Parse(rawURL)
	if err != nil {
		return rawURL
	}
	target, err := url.Parse(publicBase)
	if err != nil || target.Scheme == "" || target.Host == "" {
		return rawURL
	}
	source.Scheme = target.Scheme
	source.Host = target.Host
	return source.String()
}
