package ssh

import (
	"bytes"
	"fmt"
	"io"
	"net"
	"os/user"
	"time"

	"golang.org/x/crypto/ssh"
	"golang.org/x/term"
)

type Client struct {
	Host     string
	Port     int
	User     string
	Password string
}

type SSHCommand struct {
	Command string
	Output  io.Writer
}

func NewClient(host string, port int, user, password string) *Client {
	return &Client{
		Host:     host,
		Port:     port,
		User:     user,
		Password: password,
	}
}

func (c *Client) Connect() (*ssh.Client, error) {
	addr := fmt.Sprintf("%s:%d", c.Host, c.Port)
	config := &ssh.ClientConfig{
		User:            c.User,
		Auth:            []ssh.AuthMethod{ssh.Password(c.Password)},
		HostKeyCallback: ssh.InsecureIgnoreHostKey(),
		Timeout:         10 * time.Second,
	}

	client, err := ssh.Dial("tcp", addr, config)
	if err != nil {
		return nil, fmt.Errorf("ssh dial: %w", err)
	}

	return client, nil
}

func (c *Client) Run(cmd string) (string, error) {
	client, err := c.Connect()
	if err != nil {
		return "", err
	}
	defer client.Close()

	session, err := client.NewSession()
	if err != nil {
		return "", fmt.Errorf("ssh session: %w", err)
	}
	defer session.Close()

	var stdout, stderr bytes.Buffer
	session.Stdout = &stdout
	session.Stderr = &stderr

	if err := session.Run(cmd); err != nil {
		return stdout.String() + stderr.String(), fmt.Errorf("ssh run: %w", err)
	}

	return stdout.String() + stderr.String(), nil
}

func (c *Client) Terminal() error {
	client, err := c.Connect()
	if err != nil {
		return err
	}
	defer client.Close()

	session, err := client.NewSession()
	if err != nil {
		return fmt.Errorf("ssh session: %w", err)
	}
	defer session.Close()

	fd := int(0)
	oldState, err := term.MakeRaw(fd)
	if err != nil {
		return fmt.Errorf("terminal raw mode: %w", err)
	}
	defer term.Restore(fd, oldState)

	session.Stdout = struct{ io.Writer }{osWriter{}}
	session.Stderr = struct{ io.Writer }{osWriter{}}
	session.Stdin = struct{ io.Reader }{osReader{}}

	modes := ssh.TerminalModes{
		ssh.ECHO:          1,
		ssh.TTY_OP_ISPEED: 14400,
		ssh.TTY_OP_OSPEED: 14400,
	}

	width, height := 80, 24
	if w, h, err := term.GetSize(fd); err == nil {
		width, height = w, h
	}

	if err := session.RequestPty("xterm-256color", height, width, modes); err != nil {
		return fmt.Errorf("request pty: %w", err)
	}

	if err := session.Shell(); err != nil {
		return fmt.Errorf("shell: %w", err)
	}

	return session.Wait()
}

type osWriter struct{}
type osReader struct{}

func (osWriter) Write(p []byte) (int, error) {
	return writeToStdout(p)
}

func (osReader) Read(p []byte) (int, error) {
	return readFromStdin(p)
}

var writeToStdout = func(p []byte) (int, error) { return len(p), nil }
var readFromStdin = func(p []byte) (int, error) { return 0, nil }

func SetupIO(writeFn func([]byte) (int, error), readFn func([]byte) (int, error)) {
	writeToStdout = writeFn
	readFromStdin = readFn
}

func DefaultUser() string {
	u, err := user.Current()
	if err != nil {
		return "root"
	}
	return u.Username
}

func ResolveHost(host string) (string, error) {
	ips, err := net.LookupHost(host)
	if err != nil {
		return "", fmt.Errorf("dns lookup: %w", err)
	}
	if len(ips) == 0 {
		return "", fmt.Errorf("no IP found for %s", host)
	}
	return ips[0], nil
}
