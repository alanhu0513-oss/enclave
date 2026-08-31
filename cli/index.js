#!/usr/bin/env node

const { Command } = require("commander");
const chalk = require("chalk");
const ora = require("ora");
const inquirer = require("inquirer");
const fs = require("fs");
const path = require("path");
const FormData = require("form-data");
const fetch = require("node-fetch");

const program = new Command();
const API_URL = process.env.ENCLAVE_API_URL || "https://enclave-production-d818.up.railway.app";
const API_KEY = process.env.ENCLAVE_API_KEY || "";

program
  .name("enclave")
  .description("Enclave CLI - Deepfake detection tools")
  .version("1.0.0");

// Scan command
program
  .command("scan <file>")
  .description("Scan a file for deepfakes")
  .option("-f, --format <format>", "Output format (json, text)", "text")
  .option("-t, --type <type>", "File type (image, audio, video)", "image")
  .action(async (file, options) => {
    const spinner = ora("Scanning for deepfakes...").start();

    try {
      if (!fs.existsSync(file)) {
        spinner.fail("File not found");
        process.exit(1);
      }

      const formData = new FormData();
      formData.append("file", fs.createReadStream(file));
      formData.append("type", options.type);

      const response = await fetch(`${API_URL}/api/scan/file`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          ...formData.getHeaders(),
        },
        body: formData,
      });

      const result = await response.json();

      if (options.format === "json") {
        spinner.succeed("Scan complete");
        console.log(JSON.stringify(result, null, 2));
      } else {
        spinner.succeed("Scan complete");
        console.log(chalk.bold("\nScan Results:"));
        console.log(`  File: ${chalk.cyan(file)}`);
        console.log(`  Deepfake Score: ${getScoreColor(result.score || result.confidence || 0)}`);
        console.log(`  Verdict: ${getVerdict(result)}`);
        if (result.details) {
          console.log(`  Details: ${chalk.gray(result.details)}`);
        }
      }
    } catch (error) {
      spinner.fail(`Scan failed: ${error.message}`);
      process.exit(1);
    }
  });

// Shield commands
program
  .command("shield")
  .description("Manage identity shields")
  .action(async () => {
    const { action } = await inquirer.prompt([
      {
        type: "list",
        name: "action",
        message: "Shield action:",
        choices: ["list", "enable", "disable", "status"],
      },
    ]);

    const spinner = ora("Fetching shields...").start();

    try {
      const response = await fetch(`${API_URL}/api/shields`, {
        headers: { Authorization: `Bearer ${API_KEY}` },
      });
      const { shields } = await response.json();

      spinner.stop();

      if (action === "list" || action === "status") {
        console.log(chalk.bold("\nActive Shields:"));
        for (const shield of shields) {
          const status = shield.enabled ? chalk.green("ON") : chalk.red("OFF");
          console.log(`  ${shield.name}: ${status}`);
        }
      }
    } catch (error) {
      spinner.fail(`Failed: ${error.message}`);
    }
  });

// Auth commands
program
  .command("login")
  .description("Authenticate with Enclave")
  .action(async () => {
    const { email, password } = await inquirer.prompt([
      { type: "input", name: "email", message: "Email:" },
      { type: "password", name: "password", message: "Password:" },
    ]);

    const spinner = ora("Authenticating...").start();

    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const result = await response.json();

      if (result.token) {
        spinner.succeed("Login successful!");
        console.log(chalk.gray("Token saved to ~/.enclave/config.json"));

        // Save token
        const configDir = path.join(require("os").homedir(), ".enclave");
        if (!fs.existsSync(configDir)) fs.mkdirSync(configDir, { recursive: true });
        fs.writeFileSync(path.join(configDir, "config.json"), JSON.stringify({ token: result.token }, null, 2));
      } else {
        spinner.fail("Login failed");
      }
    } catch (error) {
      spinner.fail(`Login failed: ${error.message}`);
    }
  });

// Status command
program
  .command("status")
  .description("Check Enclave API status")
  .action(async () => {
    const spinner = ora("Checking status...").start();

    try {
      const response = await fetch(`${API_URL}/api/health`);
      const result = await response.json();

      spinner.succeed("API is healthy");
      console.log(`  Status: ${chalk.green(result.status)}`);
      console.log(`  Version: ${chalk.cyan(result.version || "1.0.0")}`);
    } catch (error) {
      spinner.fail("API is unreachable");
    }
  });

function getScoreColor(score) {
  if (score >= 0.8) return chalk.red(`${(score * 100).toFixed(1)}% (DANGEROUS)`);
  if (score >= 0.5) return chalk.yellow(`${(score * 100).toFixed(1)}% (SUSPICIOUS)`);
  return chalk.green(`${(score * 100).toFixed(1)}% (SAFE)`);
}

function getVerdict(result) {
  if (result.score >= 0.8) return chalk.red("DEEPFAKE DETECTED");
  if (result.score >= 0.5) return chalk.yellow("SUSPICIOUS");
  return chalk.green("LIKELY AUTHENTIC");
}

program.parse();
