#!/usr/bin/env node
if (!(process.platform === "linux" || process.platform === "android")) {
  console.log("This script is only for Linux");
  process.exit(1);
}
const cli_args = require("minimist")(process.argv.slice(2));
const path = require("path");
const js_yaml = require("js-yaml");
const fs = require("fs");
const os = require("os");
const child_process = require("child_process");
const crypto = require("crypto");
const cron = require("cron");
const clicolor = require("cli-color");
const github_releases = require("./src/github");
const aptly = require("./src/aptly");
const express_repo = require("./src/express");

async function ConfigManeger() {
  let ConfigBase = {
    global: {
      path: path.resolve(cli_args.download_path || os.homedir(), ".DebianRepo/"),
      tmp: path.resolve(cli_args.download_path || os.homedir(), ".DebianRepo/tmp/"),
      repository_name: crypto.randomBytes(16).toString("hex"),
      gpg: {
        passphrase: cli_args.gpg_passphrase || "",
        public_key: cli_args.gpg_public_key || "",
        private_key: cli_args.gpg_private_key || "",
      },
      cron: {
        enable: cli_args.cron || false,
        interval: cli_args.interval || "0 0 * * *"
      },
      list_size: 5
    },
    github: {
      repos: [
        {
          user: "shiftkey",
          repo: "desktop",
          token: undefined,
          github_enterprise: undefined
        }
      ]
    }

  };
  let ConfigPath = path.join(cli_args.save_path || process.cwd(), "config.yaml");
  if (cli_args.config) {
    if (typeof cli_args.config !== "string") {
      console.log("config.yaml is not found");
      process.exit(1);
    }
    ConfigPath = path.resolve(cli_args.config);
  };
  if (!fs.existsSync(ConfigPath)) {
    console.log("config.yaml is not found");
    fs.writeFileSync(ConfigPath, js_yaml.dump(ConfigBase));
    console.log("config.yaml is created");
    if (!cli_args.docker) process.exit(1);
  } else {
    try {ConfigBase = js_yaml.load(fs.readFileSync(ConfigPath, "utf8"));} catch (err) {
      console.log("Error on load Config File");
      process.exit(2);
    }
  }

  // Parse Config File
  const Config = {
    global: {
      path: ConfigBase.global.path || path.resolve(os.homedir(), ".DebianRepo/"),
      tmp: ConfigBase.global.tmp || path.resolve(os.homedir(), ".DebianRepo/tmp/"),
      repository_name: ConfigBase.global.repository_name || crypto.randomBytes(16).toString("hex"),
      cron: {
        enable: ConfigBase.global.cron.enable || false,
        interval: ConfigBase.global.cron.interval || "0 0 * * *"
      },
      list_size: ConfigBase.global.list_size || 5,
      gpg: {
        passphrase: ConfigBase.global.gpg.passphrase || "",
        public_key: ConfigBase.global.gpg.public_key || "",
        private_key: ConfigBase.global.gpg.private_key || ""
      }
    },
    github: {
      repos: ConfigBase.github.repos.filter(repo => repo.user && repo.repo)
    }
  }

  // Show dropead repos
  console.log("Dropead Repos");
  console.log("============");
  console.log("Github:", ConfigBase.github.repos.length - Config.github.repos.length);
  console.log("============");
  console.log();
  
  return Config;
}

module.exports.ConfigManeger = ConfigManeger;

const aptly_config_base = {
    rootDir: "~/.aptly",
    downloadConcurrency: 4,
    downloadSpeedLimit: 0,
    downloadRetries: 0,
    databaseOpenAttempts: -1,
    architectures: [],
    dependencyFollowSuggests: false,
    dependencyFollowRecommends: false,
    dependencyFollowAllVariants: false,
    dependencyFollowSource: false,
    dependencyVerboseResolve: false,
    gpgDisableSign: false,
    gpgDisableVerify: false,
    gpgProvider: "gpg2",
    downloadSourcePackages: false,
    skipLegacyPool: false,
    ppaDistributorID: "apt_repo",
    ppaCodename: "focal",
    skipContentsPublishing: false,
    FileSystemPublishEndpoints: {},
    S3PublishEndpoints: {},
    SwiftPublishEndpoints: {}
  }
module.exports.aptly_config_base = aptly_config_base;

async function DownloadAndOrganize() {
  const Config = await ConfigManeger();

  if (!(fs.existsSync(Config.global.path))) fs.mkdirSync(Config.global.path, {recursive: true});
  if (!(fs.existsSync(Config.global.tmp))) fs.mkdirSync(Config.global.tmp, {recursive: true});

  // Get Github Releases
  const releases = [];
  for (let repository of Config.github.repos) {
    try {
      if (repository.github_enterprise) {
        const Enter = await github_releases.Enterprise(repository.user, repository.repo, repository.token, Config.global.list_size, repository.github_enterprise);
        releases.push({
          type: "github",
          user: repository.user,
          repo: repository.repo,
          releases: Enter
        });
      } else {
        const GitHub = await github_releases.Github_com(repository.user, repository.repo, repository.token, Config.global.list_size);
        releases.push({
          type: "github",
          user: repository.user,
          repo: repository.repo,
          releases: GitHub
        });
      }
    } catch (err) {console.log(err);}
  }

  const aptly_config = aptly_config_base;
  aptly_config.rootDir = Config.global.path;
  fs.writeFileSync(path.join(os.homedir(), ".aptly.conf"), JSON.stringify(aptly_config, null, 4));

  // Download Files And Add to aptly
  const Components = [];
  for (let release of releases) {
    try {aptly.AddBranch(`${release.user}_${release.repo}`, aptly_config.ppaDistributorID);} catch (err) {console.log(err);}
    if (!(Components.includes(`${release.user}_${release.repo}`))) Components.push(`${release.user}_${release.repo}`);
    for (let release_item of release.releases) {
      try {
        const dir_path = path.join(Config.global.tmp, release.type, release.user, release.repo, release_item.tag_name);
        const PathFile = path.join(dir_path, release_item.file_name);
        if (!(fs.existsSync(PathFile))) {
          if (!(fs.existsSync(dir_path))) fs.mkdirSync(dir_path, {recursive: true});
          console.log(clicolor.green(`Downloading ${release_item.file_name} (${release_item.file_url})`));
          child_process.execFileSync("wget", ["-O", PathFile, release_item.file_url], {stdio: "pipe"});
          console.log(clicolor.yellow(`Add ${release_item.file_name} to aptly`));
          try {aptly.AddFiles(`${release.user}_${release.repo}`, PathFile);} catch (err) {console.log(clicolor.red(`Can't add ${release_item.file_name} to aptly`));}
        } else console.log(clicolor.yellow(`${release_item.file_name} is already downloaded`));
      } catch (err) {
        console.log(clicolor.red(`Error on Download ${release_item.file_name}`));
      }
    }
  }
  
  // Publish aptly repository
  try {
    console.log("Publish aptly repository");
    if (fs.existsSync(path.resolve(Config.global.path, "public"))) fs.rmSync(path.resolve(Config.global.path, "public"), {recursive: true, force: true});
    aptly.PublishRepo(aptly_config.ppaDistributorID, Config.global.gpg.passphrase, "", false, ...Components);
    const RepoDir = path.join(Config.global.path, "public");
    fs.writeFileSync(path.join(RepoDir, "AddRepository.sh"), aptly.CreateSetupFile(false, false, path.resolve(Config.global.path, "public"),  ...Components));
  } catch (err) {
    console.log(err);
    process.exit(1);
  }
  fs.rmSync(Config.global.tmp, {recursive: true, force: true});
  fs.rmSync(path.join(os.homedir(), ".aptly.conf"), {force: true});
  fs.rmSync(path.resolve(Config.global.path, "db"), {force: true, recursive: true});
  fs.rmSync(path.resolve(Config.global.path, "pool"), {force: true, recursive: true});
  return;
}

// Main Function
async function main() {
  const Config = await ConfigManeger();
  if (cli_args.express) express_repo.listen(parseInt(cli_args.express) || 8080);
  await DownloadAndOrganize();
  // Cron
  if (cli_args.cron || Config.global.cron.enable) {
    const cronjob = new cron.CronJob(Config.global.cron.interval, async () => {
      await DownloadAndOrganize();
      console.log("Complete");
    });
    cronjob.start();
  }
}

main();
