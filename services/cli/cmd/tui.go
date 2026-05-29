package cmd

import (
	"fmt"
	"os"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/kronetec/kutara_ai/services/cli/internal/api"
	"github.com/kronetec/kutara_ai/services/cli/internal/config"
	"github.com/kronetec/kutara_ai/services/cli/internal/tui"
)

func startTUI(cfg *config.Config) {
	client := api.New(cfg.Endpoint, cfg.Token)

	user, err := client.Status()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Status check failed: %v\n", err)
		fmt.Println("Starting TUI without status...")
		startTUIWithClient(client, tui.StatusInfo{
			Email: cfg.Email,
			Tier:  "unknown",
		})
		return
	}

	startTUIWithClient(client, tui.StatusInfo{
		Email:              user.Email,
		Tier:               user.Tier,
		QuestionsRemaining: user.QuestionsRemaining,
		LockedUntil:        user.LockedUntil,
	})
}

func startTUIWithClient(client *api.Client, status tui.StatusInfo) {
	m := tui.NewModel(client, status)
	p := tea.NewProgram(m, tea.WithAltScreen())
	if _, err := p.Run(); err != nil {
		fmt.Fprintf(os.Stderr, "TUI error: %v\n", err)
		os.Exit(1)
	}
}
