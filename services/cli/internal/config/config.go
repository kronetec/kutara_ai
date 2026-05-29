package config

import (
	"fmt"
	"os"
	"path/filepath"

	"gopkg.in/yaml.v3"
)

type Config struct {
	Endpoint string `yaml:"endpoint"`
	Token    string `yaml:"token"`
	Email    string `yaml:"email"`
	Theme    string `yaml:"theme"`
	Model    string `yaml:"model"`

	configPath string
}

var defaultPath string

func init() {
	home, _ := os.UserHomeDir()
	defaultPath = filepath.Join(home, ".kutara.yaml")
}

func SetPath(path string) {
	defaultPath = path
}

func Load() (*Config, error) {
	cfg := &Config{
		Endpoint:   "https://api.kutara.org",
		Theme:      "dark",
		Model:      "llama3.1:8b",
		configPath: defaultPath,
	}

	data, err := os.ReadFile(defaultPath)
	if err != nil {
		if os.IsNotExist(err) {
			return cfg, nil
		}
		return cfg, fmt.Errorf("read config: %w", err)
	}

	if err := yaml.Unmarshal(data, cfg); err != nil {
		return cfg, fmt.Errorf("parse config: %w", err)
	}
	cfg.configPath = defaultPath

	return cfg, nil
}

func (c *Config) Save() error {
	data, err := yaml.Marshal(c)
	if err != nil {
		return fmt.Errorf("marshal config: %w", err)
	}
	if err := os.WriteFile(c.configPath, data, 0600); err != nil {
		return fmt.Errorf("write config: %w", err)
	}
	return nil
}

func (c *Config) Path() string {
	return c.configPath
}
