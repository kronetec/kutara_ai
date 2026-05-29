package cmd

import (
	"bufio"
	"fmt"
	"os"
	"strings"
	"syscall"

	"github.com/kronetec/kutara_ai/services/cli/internal/api"
	"github.com/kronetec/kutara_ai/services/cli/internal/config"
	"github.com/spf13/cobra"
	"golang.org/x/term"
)

var authCmd = &cobra.Command{
	Use:   "auth",
	Short: "Authentication commands",
}

var loginCmd = &cobra.Command{
	Use:   "login",
	Short: "Login to Kutara",
	RunE: func(cmd *cobra.Command, args []string) error {
		cfg, err := config.Load()
		if err != nil {
			return fmt.Errorf("load config: %w", err)
		}

		reader := bufio.NewReader(os.Stdin)

		fmt.Print("Email: ")
		email, _ := reader.ReadString('\n')
		email = strings.TrimSpace(email)

		fmt.Print("Password: ")
		passwordBytes, err := term.ReadPassword(int(syscall.Stdin))
		if err != nil {
			return fmt.Errorf("read password: %w", err)
		}
		password := string(passwordBytes)
		fmt.Println()

		client := api.New(cfg.Endpoint, "")
		resp, err := client.Login(email, password)
		if err != nil {
			return fmt.Errorf("login failed: %w", err)
		}

		cfg.Token = resp.Token
		cfg.Email = resp.User.Email

		if err := cfg.Save(); err != nil {
			return fmt.Errorf("save config: %w", err)
		}

		fmt.Printf("Logged in as %s (tier: %s)\n", resp.User.Email, resp.User.Tier)
		return nil
	},
}

var registerCmd = &cobra.Command{
	Use:   "register",
	Short: "Register a new account",
	RunE: func(cmd *cobra.Command, args []string) error {
		cfg, err := config.Load()
		if err != nil {
			return fmt.Errorf("load config: %w", err)
		}

		reader := bufio.NewReader(os.Stdin)

		fmt.Print("Email: ")
		email, _ := reader.ReadString('\n')
		email = strings.TrimSpace(email)

		fmt.Print("Password: ")
		passwordBytes, err := term.ReadPassword(int(syscall.Stdin))
		if err != nil {
			return fmt.Errorf("read password: %w", err)
		}
		password := string(passwordBytes)
		fmt.Println()

		client := api.New(cfg.Endpoint, "")
		resp, err := client.Register(email, password)
		if err != nil {
			return fmt.Errorf("register failed: %w", err)
		}

		cfg.Token = resp.Token
		cfg.Email = resp.User.Email

		if err := cfg.Save(); err != nil {
			return fmt.Errorf("save config: %w", err)
		}

		fmt.Printf("Registered as %s (tier: %s)\n", resp.User.Email, resp.User.Tier)
		return nil
	},
}

var logoutCmd = &cobra.Command{
	Use:   "logout",
	Short: "Logout from Kutara",
	RunE: func(cmd *cobra.Command, args []string) error {
		cfg, err := config.Load()
		if err != nil {
			return fmt.Errorf("load config: %w", err)
		}

		cfg.Token = ""
		cfg.Email = ""

		if err := cfg.Save(); err != nil {
			return fmt.Errorf("save config: %w", err)
		}

		fmt.Println("Logged out.")
		return nil
	},
}

var statusCmd = &cobra.Command{
	Use:   "status",
	Short: "Show account status",
	RunE: func(cmd *cobra.Command, args []string) error {
		cfg, err := config.Load()
		if err != nil {
			return fmt.Errorf("load config: %w", err)
		}

		if cfg.Token == "" {
			fmt.Println("Not logged in.")
			return nil
		}

		client := api.New(cfg.Endpoint, cfg.Token)
		user, err := client.Status()
		if err != nil {
			return fmt.Errorf("get status: %w", err)
		}

		fmt.Printf("Email: %s\n", user.Email)
		fmt.Printf("Tier: %s\n", user.Tier)
		fmt.Printf("Questions remaining: %d\n", user.QuestionsRemaining)
		if user.LockedUntil != "" {
			fmt.Printf("Locked until: %s\n", user.LockedUntil)
		}
		return nil
	},
}

func init() {
	authCmd.AddCommand(loginCmd)
	authCmd.AddCommand(registerCmd)
	authCmd.AddCommand(logoutCmd)
	authCmd.AddCommand(statusCmd)

	loginCmd.Flags().StringP("email", "e", "", "Email address")
	loginCmd.Flags().StringP("password", "p", "", "Password")
}
