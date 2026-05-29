package cmd

import (
	"fmt"
	"os"

	"github.com/kronetec/kutara_ai/services/cli/internal/api"
	"github.com/kronetec/kutara_ai/services/cli/internal/config"
	"github.com/kronetec/kutara_ai/services/cli/internal/tui"
	"github.com/spf13/cobra"
)

var chatCmd = &cobra.Command{
	Use:   "chat [message]",
	Short: "Chat with Kutara AI",
	Long: `Send a message to Kutara AI and get a response.
If no message is provided, starts the interactive TUI.`,
	Args: cobra.MaximumNArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		cfg, err := config.Load()
		if err != nil {
			return fmt.Errorf("load config: %w", err)
		}

		if cfg.Token == "" {
			fmt.Fprintln(os.Stderr, "Not logged in. Run: kutara auth login")
			return nil
		}

		client := api.New(cfg.Endpoint, cfg.Token)

		if len(args) == 0 {
			user, err := client.Status()
			if err != nil {
				return fmt.Errorf("get status: %w", err)
			}

			status := tui.StatusInfo{
				Email:              user.Email,
				Tier:               user.Tier,
				QuestionsRemaining: user.QuestionsRemaining,
				LockedUntil:        user.LockedUntil,
			}

			startTUIWithClient(client, status)
			return nil
		}

		stream, _ := cmd.Flags().GetBool("stream")
		model, _ := cmd.Flags().GetString("model")

		if model == "" {
			model = cfg.Model
		}

		if stream {
			return streamChat(client, args[0], model)
		}

		return sendChat(client, args[0], model)
	},
}

func sendChat(client *api.Client, message, model string) error {
	resp, err := client.SendChat(message, model)
	if err != nil {
		return fmt.Errorf("chat error: %w", err)
	}

	fmt.Println(resp.Message)
	return nil
}

func streamChat(client *api.Client, message, model string) error {
	ch, err := client.SendChatStream(message, model)
	if err != nil {
		return fmt.Errorf("chat error: %w", err)
	}

	for chunk := range ch {
		if chunk.Error != "" {
			return fmt.Errorf("chat error: %s", chunk.Error)
		}
		if chunk.Done {
			fmt.Println()
			return nil
		}
		fmt.Print(chunk.Content)
	}
	return nil
}

func init() {
	chatCmd.Flags().BoolP("stream", "s", false, "Stream the response")
	chatCmd.Flags().StringP("model", "m", "", "Model to use (default: config value)")
}
