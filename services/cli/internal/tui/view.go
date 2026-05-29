package tui

import (
	"fmt"
	"strings"

	"github.com/charmbracelet/glamour"
	"github.com/charmbracelet/lipgloss"
)

func (m *model) View() string {
	if m.width == 0 {
		m.width = 100
	}
	if m.height == 0 {
		m.height = 30
	}

	rendered := m.renderStatusBar() + "\n"

	if m.sshPanel.open {
		rendered += m.renderSSHPanel() + "\n"
	} else {
		rendered += m.renderMessages() + "\n"
	}

	rendered += m.renderInputBar()

	if m.showHelp {
		rendered += "\n" + m.renderHelp()
	}

	if m.err != nil {
		rendered += "\n" + StyleError.Render("✖ "+m.err.Error())
	}

	return StyleApp.Render(rendered)
}

func (m *model) renderStatusBar() string {
	left := fmt.Sprintf(" ⚡ kutara")
	right := fmt.Sprintf(" %s | %s | %d/%d",
		m.modelLabel(),
		strings.ToUpper(m.status.Tier),
		m.status.QuestionsRemaining,
		5,
	)
	if m.loading {
		left += " ●"
	}

	bar := lipgloss.JoinHorizontal(
		lipgloss.Top,
		StyleStatusBar.Render(left),
		StyleStatusBarRight.Width(m.width-lipgloss.Width(left)-2).Render(right),
	)
	return bar
}

func (m *model) renderMessages() string {
	m.viewport.Width = m.width - 4
	m.viewport.Height = m.height - 8

	if len(m.messages) == 0 {
		m.viewport.SetContent(m.renderWelcome())
	} else {
		m.viewport.SetContent(m.renderMessageList())
	}
	return m.viewport.View()
}

func (m *model) renderWelcome() string {
	return lipgloss.JoinVertical(lipgloss.Left,
		StyleTitle.Render("Welcome to Kutara AI"),
		"",
		"Your self-hosted AI assistant",
		"",
		fmt.Sprintf("Model: %s", m.modelLabel()),
		fmt.Sprintf("Tier: %s", m.status.Tier),
		"",
		"Type a message to start chatting.",
		"Use /help for available commands.",
		"Press Tab to switch models.",
	)
}

func (m *model) renderMessageList() string {
	var b strings.Builder
	for i, msg := range m.messages {
		if i > 0 {
			b.WriteString("\n")
		}

		timeStr := msg.Time.Format("15:04")
		switch msg.Role {
		case "user":
			b.WriteString(StyleUserBubble.Width(m.width - 8).Render(
				StyleTitle.Render("You ") + StyleDivider.Render(timeStr) + "\n" +
					m.renderMarkdown(msg.Content),
			))
		case "assistant":
			b.WriteString(StyleAIBubble.Width(m.width - 8).Render(
				StyleModelTag.Render("Kutara ") + StyleDivider.Render(timeStr) + "\n" +
					m.renderMarkdown(msg.Content),
			))
		case "system":
			b.WriteString(StyleAIBubble.Width(m.width - 8).Render(
				StyleDivider.Render(timeStr) + "\n" + msg.Content,
			))
		}
	}
	return b.String()
}

func (m *model) renderInputBar() string {
	input := m.input.View()
	help := StyleHelp.Render("/help | [Tab] Model  [Ctrl+N] New  [Ctrl+E] SSH  [Ctrl+Q] Exit")

	if m.showPalette {
		input = m.renderCommandPalette() + "\n" + help
		return lipgloss.JoinVertical(lipgloss.Left,
			StyleDivider.Render(strings.Repeat("─", m.width-2)),
			input,
		)
	}

	return lipgloss.JoinVertical(lipgloss.Left,
		StyleDivider.Render(strings.Repeat("─", m.width-2)),
		input,
		help,
	)
}

func (m *model) renderCommandPalette() string {
	return StyleInputBar.Width(m.width - 4).Render(
		" Command: " + m.paletteInput + "▌",
	)
}

func (m *model) renderHelp() string {
	help := lipgloss.JoinVertical(lipgloss.Left,
		StyleTitle.Render("Commands"),
		"",
		"  /help          - Show this help",
		"  /clear         - Clear chat",
		"  /model <name>  - Switch model (llama3.1:8b, llama3.1:70b, claude-sonnet-4-6)",
		"  /ssh <cmd>     - Run SSH command",
		"  /status        - Show account status",
		"  /ssh           - Toggle SSH panel",
		"",
		StyleTitle.Render("Keyboard Shortcuts"),
		"",
		"  Enter    - Send message",
		"  Tab      - Switch model",
		"  Ctrl+N   - New chat",
		"  Ctrl+E   - Toggle SSH panel",
		"  Ctrl+L   - Clear chat",
		"  Ctrl+H   - Toggle help",
		"  Ctrl+Q   - Quit",
	)
	return lipgloss.NewStyle().
		Width(m.width - 4).
		Padding(1, 2).
		Render(help)
}

func (m *model) renderSSHPanel() string {
	header := StyleTitle.Render(" SSH Connections")
	content := " SSH panel - connect to your servers\n\n"
	content += " Commands:\n"
	content += "  /ssh user@host:port password\n"
	content += "  /ssh run \"command\"\n"

	return lipgloss.JoinVertical(lipgloss.Left,
		header,
		StyleChatPane.Width(m.width-4).Render(content),
	)
}

func (m *model) renderMarkdown(text string) string {
	renderer, err := glamour.NewTermRenderer(
		glamour.WithAutoStyle(),
		glamour.WithWordWrap(m.width-16),
	)
	if err != nil {
		return text
	}

	out, err := renderer.Render(text)
	if err != nil {
		return text
	}
	return strings.TrimRight(out, "\n")
}
