package cmd

import (
	"fmt"

	"github.com/kronetec/kutara_ai/services/cli/internal/config"
	"github.com/spf13/cobra"
)

var configCmd = &cobra.Command{
	Use:   "config",
	Short: "Configuration commands",
}

var configShowCmd = &cobra.Command{
	Use:   "show",
	Short: "Show current configuration",
	RunE: func(cmd *cobra.Command, args []string) error {
		cfg, err := config.Load()
		if err != nil {
			return fmt.Errorf("load config: %w", err)
		}

		fmt.Printf("Config file: %s\n", cfg.Path())
		fmt.Printf("Endpoint: %s\n", cfg.Endpoint)
		fmt.Printf("Email: %s\n", cfg.Email)
		fmt.Printf("Theme: %s\n", cfg.Theme)
		fmt.Printf("Model: %s\n", cfg.Model)
		fmt.Printf("Token: %s\n", maskString(cfg.Token, 8))
		return nil
	},
}

var configSetCmd = &cobra.Command{
	Use:   "set",
	Short: "Set a configuration value",
	Long: `Set a configuration value.
Available keys: endpoint, theme, model`,
	Args: cobra.ExactArgs(2),
	RunE: func(cmd *cobra.Command, args []string) error {
		key, value := args[0], args[1]

		cfg, err := config.Load()
		if err != nil {
			return fmt.Errorf("load config: %w", err)
		}

		switch key {
		case "endpoint":
			cfg.Endpoint = value
		case "theme":
			cfg.Theme = value
		case "model":
			cfg.Model = value
		default:
			return fmt.Errorf("unknown config key: %s (available: endpoint, theme, model)", key)
		}

		if err := cfg.Save(); err != nil {
			return fmt.Errorf("save config: %w", err)
		}

		fmt.Printf("Set %s = %s\n", key, value)
		return nil
	},
}

func init() {
	configCmd.AddCommand(configShowCmd)
	configCmd.AddCommand(configSetCmd)
}

func maskString(s string, visible int) string {
	if len(s) <= visible {
		return s
	}
	return s[:visible] + "..." + s[len(s)-4:]
}
