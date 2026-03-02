package queue

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
)

type JobEnvelope struct {
	JobID   string          `json:"jobId"`
	ClientIP string         `json:"clientIp"`
	Payload json.RawMessage `json:"payload"`
}

type RedisQueue struct {
	redis     *redis.Client
	queueName string
}

func New(redisClient *redis.Client, queueName string) *RedisQueue {
	return &RedisQueue{redis: redisClient, queueName: queueName}
}

func (q *RedisQueue) QueueKey() string {
	return fmt.Sprintf("queue:%s", q.queueName)
}

func (q *RedisQueue) Enqueue(ctx context.Context, env JobEnvelope) error {
	encoded, err := json.Marshal(env)
	if err != nil {
		return err
	}
	return q.redis.RPush(ctx, q.QueueKey(), encoded).Err()
}

func (q *RedisQueue) Dequeue(ctx context.Context, timeout time.Duration) (*JobEnvelope, error) {
	result, err := q.redis.BLPop(ctx, timeout, q.QueueKey()).Result()
	if err == redis.Nil {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	if len(result) != 2 {
		return nil, fmt.Errorf("unexpected queue payload")
	}
	var env JobEnvelope
	if err := json.Unmarshal([]byte(result[1]), &env); err != nil {
		return nil, err
	}
	return &env, nil
}
