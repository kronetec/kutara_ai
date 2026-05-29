package api

import (
	"fmt"
	"strings"
)

type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type RegisterRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type AuthResponse struct {
	Token    string `json:"token"`
	User     User   `json:"user"`
}

type User struct {
	ID                 int    `json:"id"`
	Email              string `json:"email"`
	Tier               string `json:"tier"`
	QuestionsRemaining int    `json:"questionsRemaining"`
	LockedUntil        string `json:"lockedUntil,omitempty"`
}

func (c *Client) Login(email, password string) (*AuthResponse, error) {
	req := &LoginRequest{Email: email, Password: password}
	resp := &AuthResponse{}
	if err := c.Post("/api/auth/login", req, resp); err != nil {
		if strings.Contains(err.Error(), "401") {
			return nil, fmt.Errorf("invalid email or password")
		}
		return nil, err
	}
	return resp, nil
}

func (c *Client) Register(email, password string) (*AuthResponse, error) {
	req := &RegisterRequest{Email: email, Password: password}
	resp := &AuthResponse{}
	if err := c.Post("/api/auth/register", req, resp); err != nil {
		return nil, err
	}
	return resp, nil
}

func (c *Client) Status() (*User, error) {
	user := &User{}
	if err := c.Get("/api/auth/me", user); err != nil {
		return nil, err
	}
	return user, nil
}
