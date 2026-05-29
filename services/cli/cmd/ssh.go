package cmd

import (
	"fmt"

	"github.com/kronetec/kutara_ai/services/cli/internal/ssh"
	"github.com/spf13/cobra"
)

var sshCmd = &cobra.Command{
	Use:   "ssh",
	Short: "SSH commands",
}

var sshRunCmd = &cobra.Command{
	Use:   "run [command]",
	Short: "Run a command on a remote server",
	Args: cobra.MinimumNArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		host, _ := cmd.Flags().GetString("host")
		port, _ := cmd.Flags().GetInt("port")
		user, _ := cmd.Flags().GetString("user")
		password, _ := cmd.Flags().GetString("password")

		if host == "" {
			host = "93.90.201.219"
		}
		if user == "" {
			user = "root"
		}
		if port == 0 {
			port = 22
		}
		if password == "" {
			return fmt.Errorf("password is required (use --password)")
		}

		client := ssh.NewClient(host, port, user, password)
		command := args[0]

		output, err := client.Run(command)
		if err != nil {
			fmt.Fprint(cmd.OutOrStdout(), output)
			return fmt.Errorf("ssh run: %w", err)
		}

		fmt.Fprint(cmd.OutOrStdout(), output)
		return nil
	},
}

var sshConnectCmd = &cobra.Command{
	Use:   "connect",
	Short: "Open an interactive SSH terminal",
	RunE: func(cmd *cobra.Command, args []string) error {
		host, _ := cmd.Flags().GetString("host")
		port, _ := cmd.Flags().GetInt("port")
		user, _ := cmd.Flags().GetString("user")
		password, _ := cmd.Flags().GetString("password")

		if host == "" {
			host = "93.90.201.219"
		}
		if user == "" {
			user = "root"
		}
		if port == 0 {
			port = 22
		}
		if password == "" {
			return fmt.Errorf("password is required (use --password)")
		}

		client := ssh.NewClient(host, port, user, password)
		return client.Terminal()
	},
}

func init() {
	sshCmd.AddCommand(sshRunCmd)
	sshCmd.AddCommand(sshConnectCmd)

	sshRunCmd.Flags().StringP("host", "H", "", "Remote host (default: 93.90.201.219)")
	sshRunCmd.Flags().IntP("port", "P", 22, "SSH port")
	sshRunCmd.Flags().StringP("user", "u", "root", "SSH user")
	sshRunCmd.Flags().StringP("password", "p", "", "SSH password")

	sshConnectCmd.Flags().StringP("host", "H", "", "Remote host (default: 93.90.201.219)")
	sshConnectCmd.Flags().IntP("port", "P", 22, "SSH port")
	sshConnectCmd.Flags().StringP("user", "u", "root", "SSH user")
	sshConnectCmd.Flags().StringP("password", "p", "", "SSH password")
}
