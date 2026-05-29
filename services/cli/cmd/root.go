package cmd

import (
	"fmt"
	"os"

	"github.com/kronetec/kutara_ai/services/cli/internal/config"
	"github.com/spf13/cobra"
)

var (
	cfgFile  string
	version  = "0.1.0"
)

var rootCmd = &cobra.Command{
	Use:   "kutara",
	Short: "Kutara AI - Self-hosted AI assistant",
	Long: `Kutara AI CLI - Your self-hosted AI assistant with chat, SSH, and server management.
Complete documentation at https://kutara.org`,
}

func Execute() {
	if err := rootCmd.Execute(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func init() {
	cobra.OnInitialize(initConfig)
	rootCmd.PersistentFlags().StringVar(&cfgFile, "config", "", "config file (default ~/.kutara.yaml)")
	rootCmd.AddCommand(authCmd)
	rootCmd.AddCommand(chatCmd)
	rootCmd.AddCommand(configCmd)
	rootCmd.AddCommand(sshCmd)
	rootCmd.Flags().BoolP("version", "v", false, "Print version")
	rootCmd.Run = func(cmd *cobra.Command, args []string) {
		showVersion, _ := cmd.Flags().GetBool("version")
		if showVersion {
			fmt.Printf("kutara version %s\n", version)
			return
		}
		cfg, err := config.Load()
		if err != nil {
			fmt.Fprintf(os.Stderr, "Config load error: %v\n", err)
			os.Exit(1)
		}
		if cfg.Token == "" {
			fmt.Println("Not logged in. Run: kutara auth login")
			return
		}
		startTUI(cfg)
	}
}

func initConfig() {
	if cfgFile != "" {
		config.SetPath(cfgFile)
	}
}
