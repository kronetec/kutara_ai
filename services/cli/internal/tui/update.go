package tui

import (
	"fmt"
	"strings"
	"time"

	"github.com/charmbracelet/bubbles/key"
	tea "github.com/charmbracelet/bubbletea"
)

type streamingMsg string
type streamingDoneMsg struct{}
type streamingErrorMsg struct{ err error }

func (m *model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	var cmds []tea.Cmd

	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height
		m.input.SetWidth(msg.Width - 4)
		m.viewport.Width = msg.Width - 4
		m.viewport.Height = msg.Height - 8
		return m, nil

	case tea.KeyMsg:
		switch {
		case key.Matches(msg, keys.Quit):
			return m, tea.Quit

		case key.Matches(msg, keys.NewChat):
			m.messages = nil
			m.input.Reset()
			m.viewport.SetContent("")
			m.err = nil
			return m, nil

		case key.Matches(msg, keys.ModelSelect):
			m.nextModel()
			return m, nil

		case key.Matches(msg, keys.SSHPanel):
			m.sshPanel.open = !m.sshPanel.open
			if m.sshPanel.open {
				m.activePane = paneSSH
			} else {
				m.activePane = paneChat
			}
			return m, nil

		case key.Matches(msg, keys.Help):
			m.showHelp = !m.showHelp
			return m, nil

		case key.Matches(msg, keys.ClearChat):
			m.messages = nil
			m.input.Reset()
			m.viewport.SetContent("")
			return m, nil

		case key.Matches(msg, keys.CommandPalette):
			m.showPalette = !m.showPalette
			if m.showPalette {
				m.paletteInput = ""
			}
			return m, nil

		case key.Matches(msg, keys.Send):
			if m.showPalette {
				m.showPalette = false
				cmd := strings.TrimSpace(m.paletteInput)
				if cmd != "" {
					cmd2 := m.handleCommand(cmd)
					return m, cmd2
				}
				return m, nil
			}

			content := m.input.Value()
			if strings.TrimSpace(content) == "" {
				return m, nil
			}

			if strings.HasPrefix(content, "/") {
				m.input.Reset()
				cmd2 := m.handleCommand(content)
				return m, cmd2
			}

			m.input.Reset()
			m.loading = true
			m.err = nil

			m.messages = append(m.messages, Message{
				Role:    "user",
				Content: content,
				Time:    time.Now(),
			})

			return m, m.streamChat(content)
		}

	case streamingMsg:
		lastIdx := len(m.messages) - 1
		if lastIdx >= 0 && m.messages[lastIdx].Role == "assistant" {
			m.messages[lastIdx].Content += string(msg)
		} else {
			m.messages = append(m.messages, Message{
				Role:    "assistant",
				Content: string(msg),
				Time:    time.Now(),
			})
		}
		m.updateViewportScroll()
		return m, m.readNextChunk

	case streamingDoneMsg:
		m.loading = false
		m.streamCh = nil
		m.updateViewportScroll()
		return m, nil

	case streamingErrorMsg:
		m.loading = false
		m.err = msg.err
		m.messages = append(m.messages, Message{
			Role:    "system",
			Content: fmt.Sprintf("Error: %v", msg.err),
			Time:    time.Now(),
		})
		return m, nil

	case errMsg:
		m.loading = false
		m.err = msg.err
		return m, nil

	case sshResultMsg:
		m.loading = false
		m.messages = append(m.messages, Message{
			Role:    "system",
			Content: "SSH Output:\n" + msg.output,
			Time:    time.Now(),
		})
		return m, nil
	}

	if !m.showPalette {
		var cmd tea.Cmd
		m.input, cmd = m.input.Update(msg)
		cmds = append(cmds, cmd)
	}

	return m, tea.Batch(cmds...)
}

func (m *model) streamChat(content string) tea.Cmd {
	ch, err := m.client.SendChatStream(content, string(m.activeModel))
	if err != nil {
		return func() tea.Msg { return streamingErrorMsg{err} }
	}

	m.streamCh = ch
	m.streamModel = string(m.activeModel)
	m.streamMsg = content

	return m.readNextChunk
}

func (m *model) readNextChunk() tea.Msg {
	chunk, ok := <-m.streamCh
	if !ok {
		return streamingDoneMsg{}
	}
	if chunk.Error != "" {
		return streamingErrorMsg{fmt.Errorf(chunk.Error)}
	}
	if chunk.Done {
		return streamingDoneMsg{}
	}
	return streamingMsg(chunk.Content)
}

func (m *model) updateViewportScroll() {
	m.viewport.SetContent(m.renderMessageList())
	m.viewport.GotoBottom()
}
