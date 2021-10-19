#!/usr/bin/env node
const cli_args = require("minimist")(process.argv.slice(2));
const path = require("path");
const js_yaml = require("js-yaml");
const fs = require("fs");
const os = require("os");
const child_process = require("child_process");
const cron = require("cron");

const github_releases = require("./src/github");
const gitlab_releases = require("./src/gitlab");

async function ConfigManeger() {
  let ConfigBase = {
    global: {
      path: path.resolve(cli_args.download_path || os.homedir(), ".DebianRepo/"),
      tmp: path.resolve(cli_args.download_path || os.homedir(), ".DebianRepo/tmp/")
    },
    gitlab: {
      repos: [
        {
          token: null,
          id: null
        }
      ]
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
  let ConfigPath = path.join(process.cwd(), "config.yaml");
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
    process.exit(1);
  } else {
    try {ConfigBase = js_yaml.load(fs.readFileSync(ConfigPath, "utf8"));} catch (err) {
      console.log("Error on load Config File");
      process.exit(2);
    }
  }

  // Parse Config File
  const Config = {
    global: {
      path: ConfigBase.global.path,
      tmp: ConfigBase.global.tmp,
      cron: {
        enable: cli_args.cron || false,
        interval: cli_args.interval || "0 0 * * *"
      }
    },
    gitlab: {
      repos: ConfigBase.gitlab.repos.filter(repo => repo.id)
    },
    github: {
      repos: ConfigBase.github.repos.filter(repo => repo.user && repo.repo)
    }
  }

  // Show dropead repos
  console.log("Dropead Repos");
  console.log("============");
  console.log("Gitlab:", ConfigBase.gitlab.repos.length - Config.gitlab.repos.length);
  console.log("Github:", ConfigBase.github.repos.length - Config.github.repos.length);
  console.log("============");
  console.log();
  
  return Config;
}

async function DownloadAndOrganize() {
  const Config = await ConfigManeger();

  if (!(fs.existsSync(Config.global.path))) fs.mkdirSync(Config.global.path, {recursive: true});
  if (!(fs.existsSync(Config.global.tmp))) fs.mkdirSync(Config.global.tmp, {recursive: true});

  // Get Github Releases
  const releases = [];
  for (let repository of Config.github.repos) {
    try {
      if (repository.github_enterprise) {
        const Enter = await github_releases.Enterprise(repository.user, repository.repo, repository.token, repository.github_enterprise);
        releases.push({
          type: "github",
          user: repository.user,
          repo: repository.repo,
          releases: Enter
        });
      } else {
        const GitHub = await github_releases.Github_com(repository.user, repository.repo, repository.token);
        releases.push({
          type: "github",
          user: repository.user,
          repo: repository.repo,
          releases: GitHub
        });
      }
    } catch (err) {console.log(err);}
  }

  // Download Files
  const FilesDownload = [];
  for (let release of releases) {
    for (let release_item of release.releases) {
      console.log(`Downloading ${release_item.file_name} (${release_item.file_url})`);
      try {
        const dir_path = path.join(Config.global.tmp, release.type, release.user, release.repo, release_item.tag_name);
        if (!(fs.existsSync(dir_path))) fs.mkdirSync(dir_path, {recursive: true});
        const PathFile = path.join(dir_path, release_item.file_name);
        if (!(fs.existsSync(PathFile))) {
          child_process.execSync(`wget -O "${PathFile}" ${release_item.file_url}`, {stdio: "pipe"});
          FilesDownload.push(PathFile);
        } else console.log("File is already downloaded");
      } catch (err) {
        console.log(`Failed to download ${release_item.file_name} (${release_item.file_url})`);
      }
    }
  }
  
  return FilesDownload;
}

// Main Function
async function main() {
  const Config = await ConfigManeger();
  
  // Cron
  if (Config.global.cron.enable) {
    cron.CronJob(Config.global.cron.interval, async () => {
      await DownloadAndOrganize();
      console.log("Complete");
    });
  } else return await DownloadAndOrganize();
}

main();