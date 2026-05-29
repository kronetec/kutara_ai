package tui

import "github.com/charmbracelet/bubbles/key"

type keymap struct {
	Send           key.Binding
	Quit           key.Binding
	NewChat        key.Binding
	ModelSelect    key.Binding
	SSHPanel       key.Binding
	Help           key.Binding
	ClearChat      key.Binding
	CommandPalette key.Binding
}

var keys = keymap{
	Send: key.NewBinding(
		key.WithKeys("enter"),
		key.WithHelp("enter", "send message"),
	),
	Quit: key.NewBinding(
		key.WithKeys("ctrl+c", "ctrl+q"),
		key.WithHelp("ctrl+q", "quit"),
	),
	NewChat: key.NewBinding(
		key.WithKeys("ctrl+n"),
		key.WithHelp("ctrl+n", "new chat"),
	),
	ModelSelect: key.NewBinding(
		key.WithKeys("tab"),
		key.WithHelp("tab", "switch model"),
	),
	SSHPanel: key.NewBinding(
		key.WithKeys("ctrl+e"),
		key.WithHelp("ctrl+e", "ssh panel"),
	),
	Help: key.NewBinding(
		key.WithKeys("ctrl+h"),
		key.WithHelp("ctrl+h", "help"),
	),
	ClearChat: key.NewBinding(
		key.WithKeys("ctrl+l"),
		key.WithHelp("ctrl+l", "clear chat"),
	),
	CommandPalette: key.NewBinding(
		key.WithKeys("/"),
		key.WithHelp("/", "command palette"),
	),
}

func (k keymap) FullHelp() [][]key.Binding {
	return [][]key.Binding{
		{k.Send, k.NewChat, k.ModelSelect},
		{k.SSHPanel, k.ClearChat, k.Help, k.Quit},
	}
}

func (k keymap) ShortHelp() []key.Binding {
	return []key.Binding{k.Send, k.ModelSelect, k.SSHPanel, k.Quit}
}
