package api

import (
	"bufio"
	"encoding/json"
	"fmt"
	"strings"
)

type ChatRequest struct {
	Message string `json:"message"`
	Model   string `json:"model,omitempty"`
	Stream  bool   `json:"stream"`
}

type ChatResponse struct {
	Message string `json:"message"`
	Model   string `json:"model"`
	Usage   Usage  `json:"usage,omitempty"`
}

type Usage struct {
	PromptTokens     int `json:"promptTokens"`
	CompletionTokens int `json:"completionTokens"`
}

type StreamChunk struct {
	Content string `json:"content"`
	Done    bool   `json:"done"`
	Error   string `json:"error,omitempty"`
}

func (c *Client) SendChat(message, model string) (*ChatResponse, error) {
	req := &ChatRequest{
		Message: message,
		Model:   model,
		Stream:  false,
	}
	resp := &ChatResponse{}
	if err := c.Post("/api/chat", req, resp); err != nil {
		return nil, err
	}
	return resp, nil
}

func (c *Client) SendChatStream(message, model string) (chan StreamChunk, error) {
	req := &ChatRequest{
		Message: message,
		Model:   model,
		Stream:  true,
	}

	body, err := c.Stream("POST", "/api/chat", req)
	if err != nil {
		return nil, err
	}

	ch := make(chan StreamChunk, 100)

	go func() {
		defer body.Close()
		defer close(ch)

		scanner := bufio.NewScanner(body)
		for scanner.Scan() {
			line := scanner.Text()
			if !strings.HasPrefix(line, "data: ") {
				continue
			}

			data := strings.TrimPrefix(line, "data: ")
			if data == "[DONE]" {
				ch <- StreamChunk{Done: true}
				return
			}

			var chunk StreamChunk
			if err := json.Unmarshal([]byte(data), &chunk); err != nil {
				ch <- StreamChunk{Error: fmt.Sprintf("parse error: %v", err)}
				return
			}

			ch <- chunk
		}

		if err := scanner.Err(); err != nil {
			ch <- StreamChunk{Error: fmt.Sprintf("read error: %v", err)}
		}
	}()

	return ch, nil
}
