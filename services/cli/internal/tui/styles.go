package tui

import (
	"github.com/charmbracelet/lipgloss"
)

var (
	ColorPrimary   = lipgloss.Color("#8B5CF6")
	ColorSecondary = lipgloss.Color("#10B981")
	ColorSurface   = lipgloss.Color("#1E1B2E")
	ColorMuted     = lipgloss.Color("#6B7280")
	ColorText      = lipgloss.Color("#E2E8F0")
	ColorError     = lipgloss.Color("#EF4444")
	ColorWarning   = lipgloss.Color("#F59E0B")

	StyleApp = lipgloss.NewStyle().
		Background(lipgloss.Color("#0F0D1A")).
		Padding(0, 1)

	StyleStatusBar = lipgloss.NewStyle().
		Background(ColorPrimary).
		Foreground(ColorText).
		Padding(0, 1).
		Width(100).
		MaxWidth(100).
		Bold(true)

	StyleStatusBarRight = lipgloss.NewStyle().
		Background(ColorPrimary).
		Foreground(ColorText).
		Padding(0, 1).
		Align(lipgloss.Right)

	StyleChatPane = lipgloss.NewStyle().
		Background(ColorSurface).
		Padding(1, 2).
		Width(80)

	StyleUserBubble = lipgloss.NewStyle().
		Background(lipgloss.Color("#2D2A4A")).
		Foreground(ColorText).
		Padding(0, 2).
		Border(lipgloss.RoundedBorder()).
		BorderForeground(ColorPrimary).
		Width(76)

	StyleAIBubble = lipgloss.NewStyle().
		Background(lipgloss.Color("#1A1B2E")).
		Foreground(ColorText).
		Padding(0, 2).
		Border(lipgloss.RoundedBorder()).
		BorderForeground(ColorSecondary).
		Width(76)

	StyleInputBar = lipgloss.NewStyle().
		Background(lipgloss.Color("#1E1B2E")).
		Foreground(ColorText).
		Padding(0, 1).
		Border(lipgloss.RoundedBorder()).
		BorderForeground(ColorPrimary).
		Width(100)

	StyleHelp = lipgloss.NewStyle().
		Foreground(ColorMuted).
		Padding(0, 1)

	StyleError = lipgloss.NewStyle().
		Foreground(ColorError).
		Bold(true)

	StyleTitle = lipgloss.NewStyle().
		Foreground(ColorPrimary).
		Bold(true)

	StyleModelTag = lipgloss.NewStyle().
		Background(ColorPrimary).
		Foreground(ColorText).
		Padding(0, 1).
		Bold(true)

	StyleLocked = lipgloss.NewStyle().
		Background(ColorError).
		Foreground(ColorText).
		Padding(0, 1).
		Bold(true)

	StyleDivider = lipgloss.NewStyle().
		Foreground(ColorMuted).
		Padding(0, 1)
)
