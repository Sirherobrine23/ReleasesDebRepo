const express = require("express");
const cors = require("cors");
const express_prettify = require("express-prettify");
const fs = require("fs");
const path = require("path");
const os = require("os");
const cli_args = require("minimist")(process.argv.slice(2));
const PathRepo = path.join(path.resolve(cli_args.download_path || os.homedir(), ".DebianRepo/"), "public/");

const app = express();
app.use(cors());
app.use(express_prettify({always: true}));
app.get(["/", "/setup_script"], async (req, res) => {
  const { ConfigManeger, aptly_config_base } = require("../index");
  if (!(fs.existsSync(PathRepo))) {
    res.status(401).json({
      error: "Repo not created"
    })
    return;
  }
  const Config = await ConfigManeger();
  const Host = req.query.host || req.headers.host;
  const Protocol = req.query.protocol || req.protocol || "http";
  const Prefix = req.query.termux === "true" ? "/data/data/com.termux/files/usr" : "";
  const Components = fs.readdirSync(path.join(PathRepo, "dists", aptly_config_base.ppaDistributorID)).filter(File => fs.statSync(path.resolve(PathRepo, "dists", aptly_config_base.ppaDistributorID, File)).isDirectory());
  const ShellScript = [`#!${Prefix}/bin/env bash`, "", ""];
  let RepoConfig = ["trusted=yes"];
  if (Config.global.gpg.public_key) {
    ShellScript.push(`echo "${Config.global.gpg.public_key}" | apt-key add -`);
  }
  ShellScript.push(`echo "deb [${RepoConfig.join(" ")}] ${Protocol}://${Host}/repo ${aptly_config_base.ppaDistributorID} ${Components.join(" ")}" | sudo tee ${Prefix}/etc/apt/sources.list.d/${Config.global.repository_name}.list`);
  ShellScript.push("apt update");
  ShellScript.push("");
  ShellScript.push("exit 0");
  res.type("text/plain");
  res.send(ShellScript.join("\n"));
});

async function ReadDirRecursive(dir = "./") {
  const Files = fs.readdirSync(dir);
  let Result = [{
    path: "",
    size: 0,
    mtime: ""
  }]; Result = [];
  for (const File of Files) {
    const FilePath = path.join(dir, File);
    if (fs.statSync(FilePath).isDirectory()) {
      Result.push(...(await ReadDirRecursive(FilePath)));
    } else {
      const FileStat = fs.statSync(FilePath);
      Result.push({
        path: FilePath,
        size: FileStat.size,
        mtime: FileStat.mtime.toString(),
        type: FileStat.isDirectory() ? "dir" : "file"
      });
    }
  }
  return Result;
}

app.use("/repo", async (req, res) => {
  const PathReq = path.join(PathRepo, req.path);
  console.log(PathReq);
  if (fs.existsSync(PathReq)) {
    if (fs.statSync(PathReq).isDirectory()) {
      const Data = await ReadDirRecursive(PathReq);
      res.json(Data.map(File => {
        File.path = File.path.replace(PathReq, "/");
        return File;
      }));
    } else {
      res.sendFile(PathReq);
    }
  } else {
    res.status(404).json({
      error: "Not found"
    })
  }
});

module.exports = {
  listen: (port = 80) => app.listen(port, () => console.log(`Listening on port ${port}`)),
  app: app,
}
