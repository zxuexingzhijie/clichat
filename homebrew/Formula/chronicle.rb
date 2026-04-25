# typed: false
# frozen_string_literal: true

class Chronicle < Formula
  desc "AI-driven CLI interactive novel game"
  homepage "https://github.com/OWNER/chronicle-cli"
  version "1.1.0"
  license "MIT"

  on_macos do
    if Hardware::CPU.arm?
      url "https://github.com/OWNER/chronicle-cli/releases/download/v#{version}/chronicle-darwin-arm64.tar.gz"
      sha256 "PLACEHOLDER_DARWIN_ARM64"
    else
      url "https://github.com/OWNER/chronicle-cli/releases/download/v#{version}/chronicle-darwin-x64.tar.gz"
      sha256 "PLACEHOLDER_DARWIN_X64"
    end
  end

  on_linux do
    url "https://github.com/OWNER/chronicle-cli/releases/download/v#{version}/chronicle-linux-x64.tar.gz"
    sha256 "PLACEHOLDER_LINUX_X64"
  end

  def install
    bin.install "chronicle"
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/chronicle --version")
  end
end
