package tui

import (
	"strings"
	"time"

	"github.com/charmbracelet/bubbles/textarea"
	"github.com/charmbracelet/bubbles/viewport"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/kronetec/kutara_ai/services/cli/internal/api"
)

type Message struct {
	Role    string
	Content string
	Time    time.Time
}

type Model string

const (
	ModelFree  Model = "llama3.1:8b"
	ModelBasic Model = "llama3.1:70b"
	ModelPro   Model = "claude-sonnet-4-6"
)

type pane int

const (
	paneChat pane = iota
	paneSSH
)

type StatusInfo struct {
	Email              string
	Tier               string
	QuestionsRemaining int
	LockedUntil        string
}

type model struct {
	client *api.Client

	messages    []Message
	input       textarea.Model
	viewport    viewport.Model
	activeModel Model
	availableModels []Model

	activePane  pane
	showHelp    bool
	showPalette bool
	paletteInput string
	loading     bool
	err         error
	status      StatusInfo

	width  int
	height int

	sshPanel    modelSSHPanel
	streamCh    chan api.StreamChunk
	streamModel string
	streamMsg   string
}

type modelSSHPanel struct {
	open bool
	connections []string
	activeConn int
}

func NewModel(client *api.Client, status StatusInfo) *model {
	ta := textarea.New()
	ta.Placeholder = "Type a message... (use / for commands)"
	ta.SetWidth(80)
	ta.SetHeight(3)
	ta.ShowLineNumbers = false
	ta.CharLimit = 4000
	ta.FocusedStyle.CursorLine = ta.FocusedStyle.CursorLine.Background(lipgloss.NoColor{})
	ta.KeyMap.InsertNewline.SetEnabled(false)

	vp := viewport.New(80, 20)
	vp.Style = StyleChatPane
	vp.KeyMap.PageDown.SetEnabled(false)
	vp.KeyMap.PageUp.SetEnabled(false)

	return &model{
		client:          client,
		messages:        []Message{},
		input:           ta,
		viewport:        vp,
		activeModel:     ModelFree,
		availableModels: []Model{ModelFree, ModelBasic, ModelPro},
		activePane:      paneChat,
		status:          status,
		sshPanel: modelSSHPanel{
			open:        false,
			connections: []string{},
			activeConn:  0,
		},
		width:  100,
		height: 30,
	}
}

func (m *model) Init() tea.Cmd {
	return textarea.Blink
}

func (m *model) nextModel() {
	for i, mod := range m.availableModels {
		if mod == m.activeModel {
			next := (i + 1) % len(m.availableModels)
			m.activeModel = m.availableModels[next]
			return
		}
	}
	m.activeModel = m.availableModels[0]
}

func (m *model) modelLabel() string {
	switch m.activeModel {
	case ModelFree:
		return "FREE llama3.1:8b"
	case ModelBasic:
		return "BASIC llama3.1:70b"
	case ModelPro:
		return "PRO claude-sonnet-4-6"
	}
	return string(m.activeModel)
}

func (m *model) modelDescription() string {
	switch m.activeModel {
	case ModelFree:
		return "Free tier - 5 questions/week"
	case ModelBasic:
		return "Basic tier - €5/month"
	case ModelPro:
		return "Pro tier - premium models"
	}
	return ""
}

func (m *model) handleCommand(cmd string) tea.Cmd {
	cmd = strings.TrimSpace(cmd)

	switch {
	case strings.HasPrefix(cmd, "/model"):
		parts := strings.Fields(cmd)
		if len(parts) > 1 {
			for _, mod := range m.availableModels {
				if strings.Contains(string(mod), parts[1]) {
					m.activeModel = mod
					m.setError(nil)
					return nil
				}
			}
		}
		m.setErrorString("Available models: /model llama3.1:8b, /model llama3.1:70b, /model claude-sonnet-4-6")

	case cmd == "/help":
		m.showHelp = !m.showHelp

	case cmd == "/clear":
		m.messages = []Message{}
		m.viewport.SetContent("")

	case cmd == "/ssh":
		m.sshPanel.open = !m.sshPanel.open
		m.activePane = paneSSH

	case cmd == "/status":
		user, err := m.client.Status()
		if err != nil {
			m.setError(err)
			return nil
		}
		m.status = StatusInfo{
			Email:              user.Email,
			Tier:               user.Tier,
			QuestionsRemaining: user.QuestionsRemaining,
		}

	case strings.HasPrefix(cmd, "/ssh "):
		parts := strings.Fields(cmd)
		if len(parts) >= 2 {
			return m.runSSHCommand(strings.Join(parts[1:], " "))
		}

	case cmd == "":
		return nil

	default:
		m.setErrorString("Unknown command: " + cmd + ". Try /help")
	}

	return nil
}

func (m *model) runSSHCommand(cmd string) tea.Cmd {
	m.loading = true
	return func() tea.Msg {
		// SSH command execution via API or direct
		result, err := m.client.SendChat("Execute SSH command: "+cmd, string(m.activeModel))
		if err != nil {
			return errMsg{err}
		}
		return sshResultMsg{output: result.Message}
	}
}

func (m *model) setError(err error) {
	m.err = err
}

func (m *model) setErrorString(s string) {
	m.err = &errString{s}
}

type errString struct{ s string }

func (e *errString) Error() string { return e.s }

type errMsg struct{ err error }
type sshResultMsg struct {
	output string
}
